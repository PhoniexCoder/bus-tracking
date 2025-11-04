# Bus Tracking PWA - Backend API

FastAPI backend service for the Bus Tracking Progressive Web App. This service bridges the Fleet API and provides real-time GPS tracking, device management, and CCTV streaming endpoints.

**🔒 Now with JWT Authentication!** All API endpoints are secured with JWT tokens. See [AUTHENTICATION.md](./AUTHENTICATION.md) for details.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# From the backend directory
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `backend/.env` file (see `.env.example`):

```env
# Fleet API Credentials
FLEET_USERNAME=geu.ddn
FLEET_PASSWORD=123456

# Device IDs (comma-separated)
DEVICE_IDS=000088832714,000088832758

# API Configuration
BASE_URL=http://fleet.lagaam.in
API_HOST=0.0.0.0
API_PORT=8000

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# JWT Authentication
JWT_SECRET_KEY=<generate-your-own-secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Generate a secure JWT secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Run the Server

```bash
# Development mode
python app.py

# Or using uvicorn directly
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Server will start on `http://localhost:8000`

## 🔐 Authentication

All API endpoints require JWT authentication. See [AUTHENTICATION.md](./AUTHENTICATION.md) for complete documentation.

**Quick Start:**

1. **Login** to get a token:
```bash
POST /auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

2. **Use token** in subsequent requests:
```bash
GET /api/live
Headers: Authorization: Bearer <your_token>
```

**Default users:**
- `admin/admin123` (admin role)
- `driver/driver123` (driver role)
- `parent/parent123` (parent role)

## 📡 API Endpoints

### Authentication
- `POST /auth/login` - Login and receive JWT token
- `GET /auth/me` - Get current user information (requires auth)

### Health & Status
- `GET /` - API information and available endpoints
- `GET /api/health` - Health check with device status

### GPS Tracking (🔒 Requires Authentication)
- `GET /api/live` - Live GPS data for all devices
- `GET /api/gps/{device_id}` - GPS data for specific device
- `GET /api/liveplate?device_id={id}` - GPS data with plate number
- `GET /api/liveplate_all` - All devices with plate numbers

### Video Streaming
- `GET /api/video/{device_id}/{channel}/{stream}` - RTSP streaming URL
  - Channels: 1-4
  - Streams: 0 (main/high quality), 1 (sub/low quality)

### WebSocket
- `WS /ws/live` - Real-time GPS updates (broadcasts every 5 seconds)

## 🔧 Configuration

All configuration is done via environment variables loaded from the root `.env.local` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `FLEET_USERNAME` | Fleet API username | Required |
| `FLEET_PASSWORD` | Fleet API password | Required |
| `DEVICE_IDS` | Comma-separated device IDs | Required |
| `BASE_URL` | Fleet API base URL | `http://fleet.lagaam.in` |
| `API_HOST` | Server host | `0.0.0.0` |
| `API_PORT` | Server port | `8000` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |
| `ENVIRONMENT` | Environment mode | `development` |

## 🏗️ Architecture

- **GPS Worker Thread**: Fetches GPS data every 10 seconds from Fleet API
- **WebSocket Broadcaster**: Pushes updates to connected clients every 5 seconds
- **Session Management**: Automatically manages Fleet API authentication tokens
- **CORS**: Configurable cross-origin resource sharing

## 🔒 Security Features

- Environment-based configuration (no hardcoded credentials)
- Restricted CORS origins
- JWT session management with Fleet API
- Configurable per-environment settings

## 📦 Dependencies

- **FastAPI**: Modern web framework for building APIs
- **Uvicorn**: ASGI server
- **Requests**: HTTP library for Fleet API calls
- **python-dotenv**: Environment variable management
- **websockets**: WebSocket support

## 🐛 Debugging

Enable debug logging in development:
```python
ENVIRONMENT=development
```

Check server health:
```bash
curl http://localhost:8000/api/health
```

## 📝 Notes

- SSL verification is disabled for Fleet API calls (development only)
- GPS coordinates are updated every 10 seconds
- WebSocket clients receive broadcasts every 5 seconds
- RTSP URLs require VLC or HLS conversion for browser playback
