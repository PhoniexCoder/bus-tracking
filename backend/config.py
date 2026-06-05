import os
from dotenv import load_dotenv

load_dotenv()

# Fleet API
FLEET_USERNAME = os.getenv("FLEET_USERNAME")
FLEET_PASSWORD = os.getenv("FLEET_PASSWORD")
DEVICE_IDS = [d.strip() for d in os.getenv("DEVICE_IDS", "").split(",") if d.strip()]
BASE_URL = os.getenv("BASE_URL", "http://fleet.lagaam.in")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Admin credentials
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# CORS
_DEFAULT_ORIGINS = "*" if ENVIRONMENT == "development" else "http://localhost:3000,https://bus-tracking.com"
ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS)
ALLOWED_ORIGINS = [o.strip() for o in ORIGINS_ENV.split(",") if o.strip()]

# JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Rate limiting
LOGIN_RATE_LIMIT = int(os.getenv("LOGIN_RATE_LIMIT", "5"))
LOGIN_RATE_WINDOW = int(os.getenv("LOGIN_RATE_WINDOW", "60"))

# Validate required config
if not FLEET_USERNAME or not FLEET_PASSWORD:
    raise ValueError("FLEET_USERNAME and FLEET_PASSWORD must be set in .env file")
if not DEVICE_IDS:
    import logging
    logging.getLogger(__name__).warning("DEVICE_IDS not set — will auto-discover on startup")
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    raise ValueError("ADMIN_USERNAME and ADMIN_PASSWORD must be set in environment variables")
if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be set and at least 32 characters long in .env file")
