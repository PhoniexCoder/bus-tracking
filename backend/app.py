import asyncio
import json
import logging
import os
import sys
import time
import threading
import cv2
import numpy as np
import subprocess
import shlex
from datetime import datetime
from typing import Generator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel

from config import (
    FLEET_USERNAME, FLEET_PASSWORD, DEVICE_IDS, BASE_URL,
    API_HOST, API_PORT, ENVIRONMENT, ALLOWED_ORIGINS,
    ADMIN_USERNAME, ADMIN_PASSWORD,
)
from contextlib import asynccontextmanager
from fleet_client import FleetAPIClient
from ws_manager import WebSocketManager
from auth import (
    create_access_token, get_current_user, verify_password, hash_password,
    check_login_rate_limit,
)

# ── Logging ────────────────────────────────────────────────────────────

log_dir = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(log_dir, "backend.log"), mode="a", encoding="utf-8"),
    ],
)

logger = logging.getLogger(__name__)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# ── Global State ───────────────────────────────────────────────────────

fleet_client = FleetAPIClient(BASE_URL, FLEET_USERNAME, FLEET_PASSWORD, DEVICE_IDS)
ws_manager = WebSocketManager()

live_state: dict = {}
_live_lock = threading.Lock()

USERS_DB = {
    ADMIN_USERNAME: {
        "username": ADMIN_USERNAME,
        "hashed_password": hash_password(ADMIN_PASSWORD),
        "role": "admin",
        "email": f"{ADMIN_USERNAME}@bustracking.com",
    }
}

server_start_time = time.time()

class StreamManager:
    def __init__(self, idle_timeout: int = 30):
        self._streams: dict = {}
        self._lock = threading.Lock()
        self.idle_timeout = idle_timeout

    def get(self, key: tuple) -> subprocess.Popen | None:
        with self._lock:
            entry = self._streams.get(key)
            if entry and entry["proc"].poll() is None:
                entry["last_used"] = time.time()
                return entry["proc"]
            return None

    def set(self, key: tuple, proc: subprocess.Popen):
        with self._lock:
            old = self._streams.get(key)
            if old:
                try:
                    old["proc"].kill()
                except Exception:
                    pass
            self._streams[key] = {"proc": proc, "last_used": time.time()}

    def cleanup(self):
        now = time.time()
        with self._lock:
            stale = [k for k, v in self._streams.items()
                     if now - v["last_used"] > self.idle_timeout]
            for k in stale:
                try:
                    self._streams[k]["proc"].kill()
                except Exception:
                    pass
                del self._streams[k]

    def close_all(self):
        with self._lock:
            for entry in self._streams.values():
                try:
                    entry["proc"].kill()
                except Exception:
                    pass
            self._streams.clear()

stream_manager = StreamManager()

# ── Pydantic models ───────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

# ── App lifecycle ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Bus Management API Starting...")
    logger.info(f"Environment: {ENVIRONMENT}")
    logger.info(f"CORS origins: {', '.join(ALLOWED_ORIGINS)}")
    logger.info(f"API running on: http://{API_HOST}:{API_PORT}")
    logger.info("=" * 60)

    fleet_client.ensure_session()

    discovered = fleet_client.discover_devices()
    if discovered:
        new_ids = [d["device_id"] for d in discovered]
        DEVICE_IDS.clear()
        DEVICE_IDS.extend(new_ids)
        fleet_client.update_device_ids(new_ids)
        with _live_lock:
            live_state.clear()
            for i, d in enumerate(discovered):
                live_state[d["device_id"]] = {
                    "device_id": d["device_id"], "online": False,
                    "latitude": 28.6139, "longitude": 77.2090,
                    "speed_kmh": 0.0, "last_update": time.time(),
                    "plate_number": d["plate"] or f"BUS-{i+1}",
                }
        logger.info("Monitoring %d device(s): %s", len(DEVICE_IDS), ", ".join(DEVICE_IDS))
    else:
        logger.warning("No devices discovered — API will have limited functionality")

    gps_thread = threading.Thread(target=_gps_worker, daemon=True)
    gps_thread.start()

    broadcast_task = asyncio.create_task(_periodic_broadcast())

    cleanup_thread = threading.Thread(target=_stream_cleanup_worker, daemon=True)
    cleanup_thread.start()

    yield

    logger.info("Shutting down...")
    broadcast_task.cancel()
    stream_manager.close_all()
    await ws_manager.close_all()
    fleet_client.close()
    logger.info("Shutdown complete")


app = FastAPI(title="Bus Management API", debug=(ENVIRONMENT == "development"), lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Error handlers ─────────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP {exc.status_code} error at {request.url.path}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path),
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error at {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "details": exc.errors(),
            "path": str(request.url.path),
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception at {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if ENVIRONMENT == "development" else "An unexpected error occurred",
            "path": str(request.url.path),
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

# ── Request logging middleware ─────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    logger.info(f"> {request.method} {request.url.path} from {request.client.host}")
    try:
        response = await call_next(request)
        duration = (time.time() - start) * 1000
        logger.info(f"< {request.method} {request.url.path} - {response.status_code} ({duration:.2f}ms)")
        return response
    except Exception as e:
        logger.error(f"[ERR] {request.method} {request.url.path} - Error: {str(e)}")
        raise

# ── GPS Worker ─────────────────────────────────────────────────────────

def _gps_worker():
    logger.info("Starting GPS worker thread...")
    while True:
        try:
            results = fleet_client.fetch_all_gps()
            with _live_lock:
                for dev_id, status in results.items():
                    if dev_id not in live_state:
                        continue
                    lng = float(status.get("mlng", 0))
                    lat = float(status.get("mlat", 0))
                    speed = float(status.get("sp", 0)) / 10.0
                    online = status.get("ol") == 1
                    if lat != 0 and lng != 0:
                        live_state[dev_id].update({
                            "online": online,
                            "latitude": lat,
                            "longitude": lng,
                            "speed_kmh": speed,
                            "last_update": time.time(),
                        })
        except Exception as e:
            logger.exception(f"Critical GPS worker error: {e}")
        time.sleep(5)

# ── WebSocket broadcast ────────────────────────────────────────────────

async def _periodic_broadcast():
    logger.info("WebSocket broadcast task started")
    while True:
        try:
            await asyncio.sleep(5)
            result = _build_device_entries()
            await ws_manager.broadcast(json.dumps(result))
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.exception(f"Error in periodic broadcast: {e}")

def _build_device_entries() -> list[dict]:
    entries = []
    for dev in DEVICE_IDS:
        with _live_lock:
            state = live_state.get(dev, {}).copy()
        plate, device_info = fleet_client.get_device_info(dev)
        entries.append({
            "gps": state,
            "plate_number": plate or state.get("plate_number"),
            "device_info": device_info,
            "device_id": dev,
            "device_name": dev,
        })
    return entries

# ── MJPEG Streaming ────────────────────────────────────────────────────

def _stream_cleanup_worker():
    while True:
        time.sleep(10)
        stream_manager.cleanup()

def _mjpeg_frames(device_id: str, channel: int) -> Generator[bytes, None, None]:
    key = (device_id, channel)
    rtmp_url = fleet_client.build_rtmp_url(device_id, channel, stream=1)
    if not rtmp_url:
        return

    proc = stream_manager.get(key)
    if proc is None:
        cmd = (
            f'ffmpeg -hide_banner -loglevel error -re -r 10 -i "{rtmp_url}" '
            f"-an -vf scale=640:360 -pix_fmt bgr24 -f rawvideo -"
        )
        proc = subprocess.Popen(
            shlex.split(cmd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=10**7,
        )
        stream_manager.set(key, proc)

    frame_size = 640 * 360 * 3
    while True:
        try:
            raw_frame = proc.stdout.read(frame_size)
        except (ValueError, OSError):
            break
        if not raw_frame or len(raw_frame) < frame_size:
            break
        frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((360, 640, 3))
        success, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 55])
        if not success:
            continue
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"

# ── Endpoints ──────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "Bus Management API",
        "endpoints": {
            "login": "/auth/login",
            "live_data": "/api/live",
            "device_gps": "/api/gps/{device_id}",
            "video_stream_rtmp": "/api/video/{device_id}/{channel}/{stream}",
            "video_stream_mjpeg": "/api/video_feed/{device_id}/{channel}",
            "video_info": "/api/video_info/{device_id}",
            "devices_status": "/api/devices/status",
            "all_buses_data": "/api/liveplate_all",
        },
        "available_devices": DEVICE_IDS,
        "authentication": "Bearer token required for API endpoints",
    }

@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    if check_login_rate_limit(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    logger.info(f"Login attempt for user: {credentials.username}")
    user = USERS_DB.get(credentials.username)
    if not user or not verify_password(credentials.password, user["hashed_password"]):
        logger.warning(f"Failed login attempt for user: {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"], "email": user["email"]}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
            "email": user["email"],
        },
    }

@app.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user.get("sub"),
        "role": current_user.get("role"),
        "email": current_user.get("email"),
    }

@app.get("/api/live")
async def api_live(current_user: dict = Depends(get_current_user)):
    with _live_lock:
        return JSONResponse(content=live_state.copy())

@app.get("/api/gps/{device_id}")
async def api_gps_device(device_id: str, current_user: dict = Depends(get_current_user)):
    with _live_lock:
        if device_id not in live_state:
            return JSONResponse(
                content={"error": "Device not found", "valid_ids": DEVICE_IDS},
                status_code=404,
            )
        return JSONResponse(content=live_state[device_id].copy())

@app.get("/api/liveplate")
async def api_live_with_plate(device_id: str | None = None, current_user: dict = Depends(get_current_user)):
    dev = device_id or (DEVICE_IDS[0] if DEVICE_IDS else None)
    if not dev:
        return JSONResponse(content={"error": "No devices configured"}, status_code=404)
    with _live_lock:
        if dev not in live_state:
            return JSONResponse(content={"error": "unknown device_id"}, status_code=404)
        state = live_state[dev].copy()
    plate, device_info = fleet_client.get_device_info(dev)
    return JSONResponse(content={
        "gps": state,
        "plate_number": plate,
        "device_info": device_info,
        "device_id": dev,
        "device_name": dev,
    })

@app.get("/api/liveplate_all")
async def api_liveplate_all(current_user: dict = Depends(get_current_user)):
    return JSONResponse(content=_build_device_entries())

@app.get("/api/video/{device_id}/{channel}/{stream}")
async def api_video_stream(
    device_id: str, channel: int, stream: int,
    current_user: dict = Depends(get_current_user),
):
    if device_id not in DEVICE_IDS:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    if channel not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Invalid channel. Must be 1-4")
    if stream not in [0, 1]:
        raise HTTPException(status_code=400, detail="Invalid stream. Must be 0 or 1")

    rtmp_url = fleet_client.build_rtmp_url(device_id, channel, stream)
    if not rtmp_url:
        raise HTTPException(status_code=500, detail="Failed to generate RTMP URL")
    return JSONResponse(content={
        "device_id": device_id, "channel": channel, "stream": stream,
        "rtmp_url": rtmp_url,
        "note": "Use VLC or convert to HLS/MJPEG for browser playback.",
    })

@app.get("/api/video_feed/{device_id}/{channel}")
async def api_video_feed(device_id: str, channel: int, request: Request):
    if channel not in [0, 1, 2, 3]:
        raise HTTPException(status_code=400, detail="Invalid channel. Must be 0-3")
    if not fleet_client.get_online_status(device_id):
        raise HTTPException(status_code=503, detail=f"Device {device_id} is currently offline")

    if "*" not in ALLOWED_ORIGINS:
        origin = request.headers.get("origin") or request.headers.get("referer") or ""
        if origin:
            parsed = origin.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
            allowed = any(
                parsed == o_clean or parsed.endswith("." + o_clean)
                for o_clean in [
                    o.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
                    for o in ALLOWED_ORIGINS
                ]
            )
            if not allowed:
                logger.warning("MJPEG origin not allowed: %s", origin)
                raise HTTPException(status_code=403, detail="Origin not allowed")

    rtmp_url = fleet_client.build_rtmp_url(device_id, channel, stream=1)
    if not rtmp_url:
        raise HTTPException(status_code=500, detail="Failed to generate streaming URL")
    return StreamingResponse(
        _mjpeg_frames(device_id, channel),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )

@app.get("/api/devices/status")
async def api_devices_status(current_user: dict = Depends(get_current_user)):
    result = {}
    for device_id in DEVICE_IDS:
        online = fleet_client.get_online_status(device_id)
        plate, device_info = fleet_client.get_device_info(device_id)
        result[device_id] = {
            "online": online,
            "plate_number": plate or f"BUS-{device_id}",
            "channels": {0: online, 1: online, 2: online, 3: online},
            "last_check": datetime.utcnow().isoformat(),
        }
    return JSONResponse(content=result)

@app.get("/api/video_info/{device_id}")
async def api_video_info(device_id: str, current_user: dict = Depends(get_current_user)):
    if device_id not in DEVICE_IDS:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    online = fleet_client.get_online_status(device_id)
    plate, device_info = fleet_client.get_device_info(device_id)
    channels = [
        {
            "channel": ch,
            "mjpeg_url": f"/api/video_feed/{device_id}/{ch}",
            "rtmp_url": fleet_client.build_rtmp_url(device_id, ch, 1),
            "available": online,
        }
        for ch in [0, 1, 2, 3]
    ]
    return JSONResponse(content={
        "device_id": device_id, "plate_number": plate, "online": online,
        "channels": channels,
        "note": "Use mjpeg_url for browser playback, rtmp_url for VLC/external players",
    })

@app.get("/api/health")
async def health_check():
    with _live_lock:
        devices_online = sum(1 for dev in live_state.values() if dev["online"])
        last_updates = [dev.get("last_update", 0) for dev in live_state.values()]
    newest_update = max(last_updates) if last_updates else 0
    time_since_update = time.time() - newest_update if newest_update else 0
    has_session = fleet_client._jsession is not None

    is_healthy = devices_online > 0 and has_session and time_since_update < 60
    return {
        "status": "healthy" if is_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": time.time() - server_start_time,
        "fleet_api": {"connected": has_session},
        "devices": {
            "total": len(DEVICE_IDS),
            "online": devices_online,
            "offline": len(DEVICE_IDS) - devices_online,
        },
        "gps_data": {
            "last_update_seconds_ago": round(time_since_update, 2),
            "is_fresh": time_since_update < 30,
        },
        "websocket": {"active_connections": ws_manager.count},
        "environment": ENVIRONMENT,
    }

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    origin = websocket.headers.get("origin") or ""
    if "*" not in ALLOWED_ORIGINS and origin:
        parsed = origin.replace("https://", "").replace("http://", "").replace("ws://", "").replace("wss://", "").split(":")[0]
        allowed = any(
            parsed == o_clean or parsed.endswith("." + o_clean)
            for o_clean in [
                o.replace("https://", "").replace("http://", "").replace("ws://", "").replace("wss://", "").split(":")[0]
                for o in ALLOWED_ORIGINS
            ]
        )
        if not allowed:
            logger.warning("WebSocket origin not allowed: %s", origin)
            await websocket.close(code=1008)
            return

    await websocket.accept()
    await ws_manager.add(websocket)
    try:
        result = _build_device_entries()
        await websocket.send_text(json.dumps(result))
        while True:
            await asyncio.sleep(1)
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        await ws_manager.remove(websocket)
