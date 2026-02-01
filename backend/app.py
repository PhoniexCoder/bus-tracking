import requests
import time
import urllib3
import threading
import asyncio
import json
import os
import logging
import sys
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from typing import Dict, Set
from pydantic import BaseModel
from dotenv import load_dotenv

# Import authentication utilities
from auth import (
    create_access_token,
    get_current_user,
    get_current_admin_user,
    verify_password,
    hash_password
)

# Load environment variables from .env file
load_dotenv()

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ------------------ LOGGING CONFIGURATION ------------------

# Ensure logs directory exists
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'backend.log')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, mode='a', encoding='utf-8')
    ]
)

# Create logger
logger = logging.getLogger(__name__)

# Suppress noisy loggers
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# ------------------ CONFIGURATION ------------------

USERNAME = os.getenv("FLEET_USERNAME")
PASSWORD = os.getenv("FLEET_PASSWORD")

# Parse device IDs from comma-separated string
DEVICE_IDS = os.getenv("DEVICE_IDS", "").split(",")
DEVICE_IDS = [dev_id.strip() for dev_id in DEVICE_IDS if dev_id.strip()]

BASE_URL = os.getenv("BASE_URL", "http://fleet.lagaam.in")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Parse allowed origins from comma-separated string
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Validate required configuration
if not USERNAME or not PASSWORD:
    raise ValueError("FLEET_USERNAME and FLEET_PASSWORD must be set in .env file")

if not DEVICE_IDS:
    raise ValueError("DEVICE_IDS must be set in .env file")

print(f"🚀 Starting Bus Management API in {ENVIRONMENT} mode")
print(f"📍 Monitoring {len(DEVICE_IDS)} device(s): {', '.join(DEVICE_IDS)}")
print(f"🔒 CORS allowed origins: {', '.join(ALLOWED_ORIGINS)}")

# ------------------ FASTAPI SETUP ------------------

app = FastAPI(title="Bus Management API", debug=(ENVIRONMENT == "development"))

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ ERROR HANDLERS ------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with detailed logging."""
    logger.error(f"HTTP {exc.status_code} error at {request.url.path}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed logging."""
    logger.error(f"Validation error at {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "details": exc.errors(),
            "path": str(request.url.path),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions with detailed logging."""
    logger.exception(f"Unhandled exception at {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if ENVIRONMENT == "development" else "An unexpected error occurred",
            "path": str(request.url.path),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# ------------------ REQUEST LOGGING MIDDLEWARE ------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests and responses."""
    start_time = time.time()
    
    # Log request
    logger.info(f"→ {request.method} {request.url.path} from {request.client.host}")
    
    try:
        response = await call_next(request)
        
        # Calculate duration
        duration = (time.time() - start_time) * 1000  # Convert to ms
        
        # Log response
        logger.info(f"← {request.method} {request.url.path} - {response.status_code} ({duration:.2f}ms)")
        
        return response
    except Exception as e:
        logger.error(f"✗ {request.method} {request.url.path} - Error: {str(e)}")
        raise

# ------------------ GLOBAL STATE ------------------

# Temporary in-memory user database (replace with actual database in production)
# Password hashes generated using: generate_hash.py
USERS_DB = {
    "admin": {
        "username": "admin",
        "hashed_password": "$2b$12$FtQzYtnhxpLpsofdmCPYluoQ0uYcQxjjW3LTuDaEpYd5kE/zWeiCm",  # password: admin123
        "role": "admin",
        "email": "admin@bustracking.com"
    }
}

# Pydantic models for request/response
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

live_state: Dict = {
    dev_id: {
        "device_id": dev_id,
        "online": False,
        "latitude": 28.6139,   
        "longitude": 77.2090,
        "speed_kmh": 0.0,
        "last_update": time.time(),
        "plate_number": f"BUS-{i+1}"
    } for i, dev_id in enumerate(DEVICE_IDS)
}

websocket_clients: Set[WebSocket] = set()
current_jsession = None
jsession_lock = threading.Lock()
start_time = time.time()  # Track server start time for uptime

# ------------------ AUTH & HELPERS ------------------

def get_jsession():
    """Authenticate and return new jsession token."""
    global current_jsession
    try:
        logger.debug("Requesting new Fleet API session token...")
        url = f"{BASE_URL}/StandardApiAction_login.action"
        params = {"account": USERNAME, "password": PASSWORD}
        r = requests.get(url, params=params, verify=False, timeout=10)
        data = r.json()
        if "jsession" in data:
            logger.info(f"✓ Fleet API authentication successful: {data['jsession'][:20]}...")
            current_jsession = data["jsession"]
            return current_jsession
        else:
            logger.error(f"✗ Fleet API login failed: {data}")
            return None
    except Exception as e:
        logger.exception(f"✗ Error getting Fleet API session: {e}")
        return None


def build_rtsp_url(device_id: str, channel: int, stream: int):
    """Construct RTSP streaming URL for a given device/channel/stream."""
    global current_jsession
    if not current_jsession:
        current_jsession = get_jsession()
        if not current_jsession:
            return None
    return (
        f"rtsp://fleet.lagaam.in:6604/3/3?"
        f"AVType=1&jsession={current_jsession}&DevIDNO={device_id}&Channel={channel}&Stream={stream}"
    )

import re
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin
try:
    if not firebase_admin._apps:
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            cred = credentials.Certificate(json.loads(service_account_json))
            # Get project_id from env or json
            project_id = os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") or json.loads(service_account_json).get("project_id")
            firebase_admin.initialize_app(cred, {
                'projectId': project_id,
            })
            logger.info("✓ Firebase Admin SDK initialized")
        else:
            logger.warning("! FIREBASE_SERVICE_ACCOUNT_JSON not found. Auto-mapping disabled.")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin: {e}")

def sync_erp_id(device_id: str, plate: str, vid: str):
    """
    Auto-Map ERP ID:
    1. Extract digits from vid (e.g. "Bus26" -> "26").
    2. Check Firestore for this bus.
    3. If erpId is missing or different, update it.
    """
    try:
        if not firebase_admin._apps: return
        
        # Extract ID (digits only from vid)
        match = re.search(r'\d+', vid)
        if not match:
             # Fallback to whole vid if no digits
             erp_id = vid
        else:
             erp_id = match.group()
        
        if not erp_id: return

        db = firestore.client()
        # The frontend stores public data in artifacts/{APP_ID}/public/data/buses
        # We need APP_ID. Let's assume it matches the project structure or specific path.
        # Actually, the path is `artifacts/{APP_ID}/public/data/buses`
        # We need to find the correct collection.
        # Let's search recursively or assume a standard path if we know APP_ID.
        # Frontend uses config.app.id. We can try to guess or use a wild card query if possible?
        # NO, Firestore Admin requires exact path.
        # HACK: We will list collections in 'artifacts' to find the app id dynamically if needed, 
        # or just use the one from env if we set it.
        # Let's try the standard path from the deleted file logs:
        # "artifacts/1:512166176631:web:736a1cfffc46b3e2b0a372/public/data/buses"
        app_id_from_json = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "{}")).get("client_id") 
        # Wait, APP_ID is in .env.local as NEXT_PUBLIC_FIREBASE_APP_ID!
        # But we didn't copy that to backend .env.
        # Let's rely on querying the 'buses' collection if we can find it.
        # Or better, just ask user to restart backend after I add APP_ID to .env?
        # For now, let's look for the document with busId == device_id in ALL 'buses' collections? No.
        
        # We'll use a hardcoded path prefix based on the known App ID from previous steps or env.
        # Re-reading .env.local: NEXT_PUBLIC_FIREBASE_APP_ID=1:512166176631:web:736a1cfffc46b3e2b0a372
        app_id = "1:512166176631:web:736a1cfffc46b3e2b0a372" 
        
        buses_ref = db.collection(f"artifacts/{app_id}/public/data/buses")
        
        # Check if bus exists
        docs = buses_ref.where("busId", "==", device_id).limit(1).get()
        
        if docs:
            bus_doc = docs[0]
            current_data = bus_doc.to_dict()
            if current_data.get("erpId") != erp_id:
                logger.info(f"🔄 Auto-Mapping: Updating {device_id} ({vid}) -> ERP ID: {erp_id}")
                bus_doc.reference.update({"erpId": erp_id})
        else:
            # Create new bus document if missing
            logger.info(f"🆕 Auto-Mapping: Creating new bus for {device_id} ({vid}) -> ERP ID: {erp_id}")
            new_bus_ref = buses_ref.document()
            new_bus_ref.set({
                "busId": device_id,
                "erpId": erp_id,
                "plateNumber": erp_id,  # Use ERP ID (e.g. "26") as display name/plate
                "device_type": "GPS_TRACKER",
                "createdAt": firestore.SERVER_TIMESTAMP,
                "model": "Generic Bus",
                "capacity": "40"
            })

    except Exception as e:
        logger.error(f"Auto-Map Error: {e}")

def fetch_device_info(dev_id: str):
    """Fetch plate (vid) and raw device info for a device from the fleet API."""
    global current_jsession
    try:
        if not current_jsession:
            current_jsession = get_jsession()
            if not current_jsession:
                logger.warning(f"Cannot fetch device info for {dev_id}: No valid session")
                return None, None
        url = f"{BASE_URL}/StandardApiAction_getDeviceByVehicle.action"
        params = {"jsession": current_jsession, "devIdno": dev_id}
        response = requests.get(url, params=params, verify=False, timeout=10)
        data = response.json()
        if data.get("result") == 0 and data.get("devices"):
            device_data = data["devices"][0]
            plate = device_data.get("vid") or device_data.get("vehi_idno")
            vid = device_data.get("vid")
            
            vid = device_data.get("vid")
            
            # --- AUTO-SYNC REMOVED for this endpoint ---
            # (Handled in fetch_gps_data to prefer GPS VID)
            # -----------------
            
            logger.debug(f"Fetched device info for {dev_id}: plate={plate}")
            return plate, device_data
        else:
            logger.warning(f"No device info found for {dev_id}: {data.get('result')}")
    except Exception as e:
        logger.error(f"Failed to fetch device info for {dev_id}: {e}")
    return None, None


def fetch_gps_data():
    """Fetch GPS data for all buses."""
    global current_jsession
    if not current_jsession:
        current_jsession = get_jsession()
        if not current_jsession:
            logger.error("Cannot fetch GPS data: No valid Fleet API session")
            return

    for dev_id in DEVICE_IDS:
        url = f"{BASE_URL}/StandardApiAction_getDeviceStatus.action"
        params = {
            "jsession": current_jsession,
            "devIdno": dev_id,
            "toMap": 1,
            "language": "en"
        }
        try:
            response = requests.get(url, params=params, verify=False, timeout=10)
            data = response.json()

            if data.get("result") == 0 and "status" in data and data["status"]:
                device_status = data["status"][0]
                lng = float(device_status.get("mlng", 0))
                lat = float(device_status.get("mlat", 0))
                speed = float(device_status.get("sp", 0)) / 10.0
                online = device_status.get("ol") == 1
                gps_vid = device_status.get("vid")  # Extract VID from GPS status (e.g. "Bus26")

                # --- AUTO-SYNC (Moved here to use GPS VID) ---
                if gps_vid:
                    threading.Thread(target=sync_erp_id, args=(dev_id, gps_vid, gps_vid)).start()
                # ---------------------------------------------

                if lat != 0 and lng != 0:
                    live_state[dev_id].update({
                        "online": online,
                        "latitude": lat,
                        "longitude": lng,
                        "speed_kmh": speed,
                        "last_update": time.time(),
                        "vid": gps_vid,           # Store VID
                        "plate_number": gps_vid   # Use GPS VID as plate number
                    })
                    logger.debug(f"Updated GPS for {dev_id}: lat={lat}, lng={lng}, vid={gps_vid}")
                else:
                    logger.warning(f"Invalid coordinates for {dev_id}: lat={lat}, lng={lng}")
            else:
                logger.warning(f"No GPS status data for {dev_id}: result={data.get('result')}")

        except requests.exceptions.Timeout:
            logger.error(f"GPS update timeout for {dev_id}")
        except requests.exceptions.RequestException as e:
            logger.error(f"GPS update network error for {dev_id}: {e}")
        except Exception as e:
            logger.exception(f"GPS update unexpected error for {dev_id}: {e}")


def gps_worker():
    """Continuously fetch GPS data in background."""
    logger.info("Starting GPS worker thread...")
    while True:
        try:
            fetch_gps_data()
        except Exception as e:
            logger.exception(f"Critical GPS worker error: {e}")
        time.sleep(5)

# ------------------ BROADCASTING ------------------

async def broadcast_update():
    """Broadcast live state updates to WebSocket clients."""
    if websocket_clients:
        # Convert live_state dict to array format matching /api/liveplate_all
        result = []
        for dev in DEVICE_IDS:
            gps_data = live_state.get(dev, {})
            plate, device_info = fetch_device_info(dev)
            final_plate = gps_data.get("plate_number") or plate
            entry = {
                "gps": gps_data,
                "plate_number": final_plate,
                "device_info": device_info,
                "device_id": dev,
                "device_name": dev,
            }
            result.append(entry)
        
        message = json.dumps(result)
        disconnected_clients = []

        for client in websocket_clients:
            try:
                await client.send_text(message)
            except Exception:
                disconnected_clients.append(client)

        for client in disconnected_clients:
            websocket_clients.remove(client)

# ------------------ WEBSOCKET ------------------

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.add(websocket)
    try:
        # Send initial data in array format matching /api/liveplate_all
        result = []
        for dev in DEVICE_IDS:
            gps_data = live_state.get(dev, {})
            plate, device_info = fetch_device_info(dev)
            final_plate = gps_data.get("plate_number") or plate
            entry = {
                "gps": gps_data,
                "plate_number": final_plate,
                "device_info": device_info,
                "device_id": dev,
                "device_name": dev,
            }
            result.append(entry)
        # Safely send initial snapshot; handle clients that disconnect immediately
        try:
            await websocket.send_text(json.dumps(result))
        except WebSocketDisconnect:
            # Client disconnected before initial send completed
            return
        except Exception:
            # Any other send error; stop handling this websocket
            return
        
        while True:
            await asyncio.sleep(1)
            try:
                _ = await websocket.receive_text()
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        websocket_clients.discard(websocket)

# ------------------ API ENDPOINTS ------------------

@app.get("/")
async def root():
    return {
        "message": "Bus Management API",
        "endpoints": {
            "login": "/auth/login",
            "live_data": "/api/live",
            "device_gps": "/api/gps/{device_id}",
            "video_stream": "/api/video/{device_id}/{channel}/{stream}"
        },
        "available_devices": DEVICE_IDS,
        "authentication": "Bearer token required for API endpoints"
    }

# ------------------ AUTHENTICATION ENDPOINTS ------------------

@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """
    Authenticate user and return JWT access token.
    
    Default credentials:
    - admin/admin123 (full access)
    - driver/driver123 (driver access)
    - parent/parent123 (parent access)
    """
    logger.info(f"Login attempt for user: {credentials.username}")
    user = USERS_DB.get(credentials.username)
    
    if not user or not verify_password(credentials.password, user["hashed_password"]):
        logger.warning(f"Failed login attempt for user: {credentials.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info(f"Successful login for user: {credentials.username} (role: {user['role']})")
    
    # Create access token with user info
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "email": user["email"]
        }
    )
    
    # Return token and user info (excluding password)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
            "email": user["email"]
        }
    }

@app.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user information."""
    return {
        "username": current_user.get("sub"),
        "role": current_user.get("role"),
        "email": current_user.get("email")
    }

# ------------------ PROTECTED API ENDPOINTS ------------------

@app.get("/api/live")
async def api_live(current_user: dict = Depends(get_current_user)):
    """Get live GPS data for all devices (requires authentication)."""
    return JSONResponse(content=live_state)

@app.get("/api/gps/{device_id}")
async def api_gps_device(device_id: str, current_user: dict = Depends(get_current_user)):
    """Get GPS data for specific device (requires authentication)."""
    if device_id not in live_state:
        return JSONResponse(
            content={"error": "Device not found", "valid_ids": DEVICE_IDS},
            status_code=404
        )
    return JSONResponse(content=live_state[device_id])

@app.get("/api/video/{device_id}/{channel}/{stream}")
async def api_video_stream(
    device_id: str, 
    channel: int, 
    stream: int,
    current_user: dict = Depends(get_current_user)
):
    """Get RTSP video stream URL (requires authentication)."""
    if device_id not in DEVICE_IDS:
        return JSONResponse(
            content={"error": "Device not found", "valid_ids": DEVICE_IDS},
            status_code=404
        )

    if channel not in [1, 2, 3, 4]:
        return JSONResponse(
            content={"error": "Invalid channel. Must be 1–4"},
            status_code=400
        )

    if stream not in [0, 1]:
        return JSONResponse(
            content={"error": "Invalid stream. Must be 0 or 1"},
            status_code=400
        )

    rtsp_url = build_rtsp_url(device_id, channel, stream)
    if not rtsp_url:
        return JSONResponse(
            content={"error": "Failed to generate RTSP URL"},
            status_code=500
        )

    return JSONResponse(content={
        "device_id": device_id,
        "channel": channel,
        "stream": stream,
        "rtsp_url": rtsp_url,
        "note": "Use VLC or convert to HLS for browser playback."
    })

@app.get("/api/health")
async def health_check():
    """Enhanced health check endpoint with system metrics."""
    try:
        # Count online devices
        devices_online = sum(1 for dev in live_state.values() if dev["online"])
        
        # Calculate last update times
        last_updates = [dev.get("last_update", 0) for dev in live_state.values()]
        oldest_update = min(last_updates) if last_updates else 0
        newest_update = max(last_updates) if last_updates else 0
        time_since_last_update = time.time() - newest_update if newest_update else 0
        
        # Check Fleet API session
        has_session = current_jsession is not None
        
        # Overall health status
        is_healthy = (
            devices_online > 0 and 
            has_session and 
            time_since_last_update < 60  # Data should be < 60 seconds old
        )
        
        health_data = {
            "status": "healthy" if is_healthy else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": time.time() - start_time,
            "fleet_api": {
                "connected": has_session,
                "session_valid": has_session
            },
            "devices": {
                "total": len(DEVICE_IDS),
                "online": devices_online,
                "offline": len(DEVICE_IDS) - devices_online,
                "device_ids": DEVICE_IDS
            },
            "gps_data": {
                "last_update_seconds_ago": round(time_since_last_update, 2),
                "oldest_data_age": round(time.time() - oldest_update, 2) if oldest_update else None,
                "is_fresh": time_since_last_update < 30
            },
            "websocket": {
                "active_connections": len(websocket_clients)
            },
            "environment": ENVIRONMENT
        }
        
        logger.debug(f"Health check: {health_data['status']}")
        return health_data
        
    except Exception as e:
        logger.exception("Health check error")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

# --- Add endpoints expected by the frontend ---
@app.get("/api/liveplate")
def api_live_with_plate(device_id: str | None = None, current_user: dict = Depends(get_current_user)):
    """Get live GPS data with plate number (requires authentication)."""
    dev = device_id or (DEVICE_IDS[0] if DEVICE_IDS else None)
    
    # 1. Try direct lookup
    if dev and dev in live_state:
        target_dev_id = dev
    else:
        # 2. Try looking up by VID / Plate / ERP ID
        target_dev_id = None
        for d_id, data in live_state.items():
            # Check vid, plate_number, or even fuzzy match
            if str(data.get("vid")) == str(dev) or \
               str(data.get("plate_number")) == str(dev) or \
               str(data.get("vid")).replace("BusNo.", "") == str(dev):
                target_dev_id = d_id
                break
    
    if not target_dev_id:
        return JSONResponse(content={"error": "unknown device_id"}, status_code=404)
        
    plate, device_info = fetch_device_info(target_dev_id)
    # Prefer GPS-derived plate ("Bus26") over "BusNo.6"
    gps_data = live_state[target_dev_id]
    final_plate = gps_data.get("plate_number") or plate

    return JSONResponse(content={
        "gps": gps_data,
        "plate_number": final_plate,
        "device_info": device_info,
        "device_id": target_dev_id,
        "device_name": target_dev_id,
    })

@app.get("/api/liveplate_all")
def api_liveplate_all(current_user: dict = Depends(get_current_user)):
    """Get live GPS data for all devices with plate numbers (requires authentication)."""
    result = []
    for dev in DEVICE_IDS:
        gps_data = live_state.get(dev, {})
        plate, device_info = fetch_device_info(dev)
        # Prefer GPS-derived plate ("Bus26") over "BusNo.6"
        final_plate = gps_data.get("plate_number") or plate
        
        entry = {
            "gps": gps_data,
            "plate_number": final_plate,
            "device_info": device_info,
            "device_id": dev,
            "device_name": dev,
        }
        result.append(entry)
    return JSONResponse(content=result)

# ------------------ STARTUP ------------------

@app.on_event("startup")
async def startup_event():
    """Initialize background tasks on startup."""
    logger.info("=" * 60)
    logger.info("🚀 Bus Management API Starting...")
    logger.info(f"Environment: {ENVIRONMENT}")
    logger.info(f"Monitoring {len(DEVICE_IDS)} device(s): {', '.join(DEVICE_IDS)}")
    logger.info(f"CORS origins: {', '.join(ALLOWED_ORIGINS)}")
    logger.info(f"API running on: http://{API_HOST}:{API_PORT}")
    logger.info("=" * 60)
    
    # Start GPS worker thread
    logger.info("Starting GPS worker thread...")
    gps_thread = threading.Thread(target=gps_worker, daemon=True)
    gps_thread.start()

    # Start WebSocket broadcast task
    logger.info("Starting WebSocket broadcast task...")
    asyncio.create_task(periodic_broadcast())
    
    logger.info("✓ All services started successfully")

async def periodic_broadcast():
    """Broadcast GPS updates to WebSocket clients every 5 seconds."""
    logger.info("WebSocket broadcast task started")
    while True:
        try:
            await asyncio.sleep(5)
            await broadcast_update()
        except Exception as e:
            logger.exception(f"Error in periodic broadcast: {e}")

# ------------------ MAIN ------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=API_HOST, 
        port=API_PORT, 
        log_level="info" if ENVIRONMENT == "development" else "warning"
    )
