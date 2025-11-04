# JWT Authentication Guide

## Overview

The backend API now uses JWT (JSON Web Token) authentication to secure all API endpoints. This provides stateless, scalable authentication without requiring session storage.

## Configuration

JWT settings are configured in `backend/.env`:

```env
JWT_SECRET_KEY=xOibLokHF10ClyY62uLi7ehAOghLQ8jOW8Db41vpcz8
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**⚠️ IMPORTANT:** Change `JWT_SECRET_KEY` in production! Generate a new secure key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Default Users

Three demo users are available for testing:

| Username | Password  | Role   | Email                    |
|----------|-----------|--------|--------------------------|
| admin    | admin123  | admin  | admin@bustracking.com   |
| driver   | driver123 | driver | driver@bustracking.com  |
| parent   | parent123 | parent | parent@bustracking.com  |

## API Endpoints

### 1. Login

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "username": "admin",
    "role": "admin",
    "email": "admin@bustracking.com"
  }
}
```

### 2. Get Current User

**Endpoint:** `GET /auth/me`

**Headers:**
```
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "username": "admin",
  "role": "admin",
  "email": "admin@bustracking.com"
}
```

### 3. Protected Endpoints

All `/api/*` endpoints now require authentication:

- `GET /api/live` - Get live GPS data for all devices
- `GET /api/gps/{device_id}` - Get GPS data for specific device
- `GET /api/liveplate?device_id=xxx` - Get GPS with plate number
- `GET /api/liveplate_all` - Get all devices with plate numbers
- `GET /api/video/{device_id}/{channel}/{stream}` - Get RTSP video URL

**Required Header:**
```
Authorization: Bearer <your_jwt_token>
```

## Usage Examples

### Using cURL

```bash
# 1. Login and get token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Use token to access protected endpoint
curl http://localhost:8000/api/live \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using JavaScript/Fetch

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:8000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});

const { access_token } = await loginResponse.json();

// 2. Access protected endpoint
const dataResponse = await fetch('http://localhost:8000/api/live', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});

const liveData = await dataResponse.json();
```

### Using Python

```python
import requests

# 1. Login
response = requests.post('http://localhost:8000/auth/login', json={
    'username': 'admin',
    'password': 'admin123'
})
token = response.json()['access_token']

# 2. Access protected endpoint
headers = {'Authorization': f'Bearer {token}'}
response = requests.get('http://localhost:8000/api/live', headers=headers)
data = response.json()
```

## Frontend Integration

### Next.js API Route Example

Create `app/api/bus-data/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    // Get JWT token from your auth system
    const token = await getBackendAuthToken();
    
    const response = await fetch(`${BACKEND_URL}/api/live`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Backend API request failed');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bus data' },
      { status: 500 }
    );
  }
}

async function getBackendAuthToken(): Promise<string> {
  // Option 1: Store backend JWT in environment variable
  // Option 2: Create a service account and login programmatically
  // Option 3: Use API key authentication for server-to-server
  
  const response = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.BACKEND_USERNAME,
      password: process.env.BACKEND_PASSWORD,
    }),
  });

  const { access_token } = await response.json();
  return access_token;
}
```

## Testing

Run the test suite to verify authentication:

```bash
cd backend
python test_auth.py
```

## Token Management

### Token Structure

JWT tokens contain:
- `sub`: Username
- `role`: User role (admin/driver/parent)
- `email`: User email
- `exp`: Expiration timestamp

### Token Expiration

Tokens expire after 30 minutes by default. Handle expiration in your frontend:

```typescript
if (response.status === 401) {
  // Token expired or invalid
  // Redirect to login or refresh token
}
```

## Security Best Practices

1. **Never commit JWT secret to git** - Use environment variables
2. **Use HTTPS in production** - Prevent token interception
3. **Store tokens securely** - Use httpOnly cookies or secure storage
4. **Implement token refresh** - For better UX with long sessions
5. **Add rate limiting** - Prevent brute force attacks
6. **Log authentication attempts** - Monitor for suspicious activity

## Adding New Users

### Option 1: Update USERS_DB (Development)

Edit `backend/app.py` and add to `USERS_DB`:

```python
"newuser": {
    "username": "newuser",
    "hashed_password": "GENERATED_HASH_HERE",
    "role": "driver",
    "email": "newuser@bustracking.com"
}
```

Generate hash using:
```bash
cd backend
python generate_hash.py "new_password"
```

### Option 2: Database Integration (Production)

Replace the in-memory `USERS_DB` with a proper database (PostgreSQL, MongoDB, etc.):

```python
from sqlalchemy import create_engine
# ... use SQLAlchemy or similar ORM
```

## Troubleshooting

### "Could not validate credentials"

- Token expired: Login again to get a new token
- Token malformed: Check Authorization header format
- Secret key mismatch: Verify JWT_SECRET_KEY in .env

### "Incorrect username or password"

- Verify username exists in USERS_DB
- Check password matches hashed_password
- Use test_auth.py to verify credentials

### "403 Forbidden"

- Missing Authorization header
- Token not included in request
- Role-based access denied (admin-only endpoint)

## Next Steps

1. **Token Refresh**: Implement refresh tokens for seamless re-authentication
2. **Role-Based Access Control (RBAC)**: Restrict endpoints by user role
3. **Database Integration**: Move from in-memory to persistent user storage
4. **Password Reset**: Add forgot password functionality
5. **2FA**: Add two-factor authentication for enhanced security
