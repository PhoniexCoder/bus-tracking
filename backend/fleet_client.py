import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


class FleetAPIClient:
    def __init__(self, base_url: str, username: str, password: str, device_ids: list[str], cache_ttl: int = 30):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.device_ids = device_ids
        self._cache_ttl = cache_ttl

        self._jsession: str | None = None
        self._session_lock = threading.Lock()
        self._http = requests.Session()
        self._http.verify = False
        self._http.timeout = 10

        self._device_info_cache: dict = {}
        self._cache_lock = threading.Lock()

        self._discovered_plates: dict[str, str | None] = {}

        self._executor = ThreadPoolExecutor(max_workers=min(len(device_ids) or 1, 8))

    # ── Session Management ──────────────────────────────────────────

    def _login(self) -> bool:
        url = f"{self.base_url}/StandardApiAction_login.action"
        params = {"account": self.username, "password": self.password}
        try:
            response = self._http.get(url, params=params)
            data = response.json()
            if "jsession" in data:
                self._jsession = data["jsession"]
                logger.info("Fleet API authentication successful")
                return True
            logger.error("Fleet API login failed: %s", data)
        except Exception as e:
            logger.exception("Fleet API login error: %s", e)
        self._jsession = None
        return False

    def ensure_session(self) -> bool:
        if self._jsession:
            return True
        with self._session_lock:
            if self._jsession:
                return True
            return self._login()

    def _request(self, action: str, params: dict | None = None, use_session: bool = True) -> dict | None:
        if use_session and not self.ensure_session():
            return None

        url = f"{self.base_url}/{action}.action"
        req_params: dict = {}
        if use_session:
            req_params["jsession"] = self._jsession
        if params:
            req_params.update(params)

        try:
            response = self._http.get(url, params=req_params)
            data = response.json()

            if use_session and data.get("result", 0) != 0:
                with self._session_lock:
                    self._jsession = None
                    if self._login():
                        req_params["jsession"] = self._jsession
                        response = self._http.get(url, params=req_params)
                        data = response.json()
            return data
        except requests.exceptions.Timeout:
            logger.error("Fleet API timeout: %s", action)
        except requests.exceptions.RequestException as e:
            logger.error("Fleet API network error: %s - %s", action, e)
        except Exception as e:
            logger.exception("Fleet API error: %s - %s", action, e)
        return None

    # ── Data Fetching ───────────────────────────────────────────────

    def discover_devices(self) -> list[dict]:
        data = self._request("StandardApiAction_queryUserVehicle", use_session=True)
        devices = []
        if data and data.get("result") == 0 and data.get("vehicles"):
            now = time.time()
            self._discovered_plates.clear()
            with self._cache_lock:
                self._device_info_cache.clear()
                for vehicle in data["vehicles"]:
                    plate = vehicle.get("nm")
                    for device in vehicle.get("dl", []):
                        device_id = device.get("id")
                        if device_id:
                            devices.append({"device_id": device_id, "plate": plate})
                            self._discovered_plates[device_id] = plate
                            self._device_info_cache[device_id] = {
                                "plate": plate,
                                "device_info": {"vid": plate, "vehi_idno": plate} if plate else None,
                                "time": now,
                            }
            logger.info("Discovered %d devices from Fleet API", len(devices))
            for d in devices:
                logger.info("  Device %s: %s", d["device_id"], d["plate"] or "no plate")
            return devices
        logger.warning("No devices discovered from Fleet API")
        return []

    def get_gps_data(self, dev_id: str) -> dict | None:
        data = self._request("StandardApiAction_getDeviceStatus", {
            "devIdno": dev_id, "toMap": 1, "language": "en"
        })
        if data and data.get("result") == 0 and data.get("status"):
            return data["status"][0]
        return None

    def get_device_info(self, dev_id: str) -> tuple[str | None, dict | None]:
        now = time.time()
        with self._cache_lock:
            cached = self._device_info_cache.get(dev_id)
            if cached and now - cached["time"] < self._cache_ttl:
                return cached["plate"], cached["device_info"]

        plate = self._discovered_plates.get(dev_id)
        device_info = {"vid": plate} if plate else None

        with self._cache_lock:
            self._device_info_cache[dev_id] = {
                "plate": plate, "device_info": device_info, "time": now
            }
        return plate, device_info

    def get_online_status(self, dev_id: str) -> bool:
        data = self._request("StandardApiAction_getDeviceOlStatus", {"devIdno": dev_id})
        if data and data.get("result") == 0 and data.get("status"):
            return data["status"][0].get("onLine", False)
        return False

    def get_device_id_by_vehicle(self, vehicle_id: str) -> str | None:
        data = self._request("StandardApiAction_getDeviceByVehicle", {"vehiIdno": vehicle_id})
        if data and data.get("result") == 0 and data.get("devices"):
            return data["devices"][0].get("did")
        return None

    def fetch_all_gps(self) -> dict[str, dict]:
        results: dict[str, dict] = {}
        futures = {
            self._executor.submit(self.get_gps_data, dev_id): dev_id
            for dev_id in self.device_ids
        }
        for future in as_completed(futures):
            dev_id = futures[future]
            try:
                status = future.result()
                if status:
                    results[dev_id] = status
            except Exception as e:
                logger.error("GPS fetch error for %s: %s", dev_id, e)
        return results

    def build_rtmp_url(self, device_id: str, channel: int, stream: int) -> str | None:
        if not self.ensure_session():
            return None
        return (
            f"rtmp://fleet.lagaam.in:6604/3/3?"
            f"AVType=1&jsession={self._jsession}&DevIDNO={device_id}&Channel={channel}&Stream={stream}"
        )

    def update_device_ids(self, device_ids: list[str]):
        self.device_ids = device_ids
        self._executor.shutdown(wait=False)
        self._executor = ThreadPoolExecutor(max_workers=min(len(device_ids) or 1, 8))

    def close(self):
        self._http.close()
        self._executor.shutdown(wait=False)
