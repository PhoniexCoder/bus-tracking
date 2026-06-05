# Quick Start Guide - Bus Tracking PWA

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **pnpm** or **npm**
- **Git**

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd bus-tracking-pwa
pnpm install
cd backend && pip install -r requirements.txt && cd ..
```

### 2. Configure Environment

```bash
# Frontend — copy and edit all vars
cp .env.example .env.local
# Required: ERP_SSO_PUBLIC_KEY, SESSION_SECRET, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
# Required: FIREBASE_SERVICE_ACCOUNT_JSON, BACKEND_API_USERNAME, BACKEND_API_PASSWORD

# Backend — copy and set fleet credentials
cp backend/.env.example backend/.env
# Required: FLEET_USERNAME, FLEET_PASSWORD, DEVICE_IDS
```

See [.env.local.example](./.env.local.example) for the complete list of frontend variables.

### 3. Start Backend

```bash
cd backend && python app.py
# http://localhost:8000
```

### 4. Start Frontend

```bash
cd bus-tracking-pwa && pnpm dev
# http://localhost:3000
```

## Auth

**Primary**: ERP redirects to `/api/auth/sso?token=<RS256_JWT>`. The app validates the JWT, sets a session cookie, and redirects to the dashboard.

**Fallback**: The `/login` page accepts username/password and authenticates via Firebase Auth, then creates the same session cookie.

No default/ demo credentials exist. All users are provisioned by the ERP or configured via Firebase Console.

## Features

| Dashboard | Access | Features |
|-----------|--------|----------|
| Admin | `/admin/dashboard` | Fleet map, bus/stop management, camera feeds |
| Parent | `/parent/dashboard` | Assigned bus tracking, ETA, live location |

## Key Config

### Frontend (`.env.local`)

| Variable | Notes |
|----------|-------|
| `ERP_SSO_PUBLIC_KEY` | ERP's RS256 public key (PEM, single-line with \n) |
| `SESSION_SECRET` | 32+ char random string for cookie signing |
| `PROXY_ALLOWED_DOMAINS` | Comma-separated domains the proxy may fetch |
| `CSP_HEADER` | Optional override for Content-Security-Policy |

### Backend (`backend/.env`)

| Variable | Notes |
|----------|-------|
| `FLEET_USERNAME` / `FLEET_PASSWORD` | Fleet API credentials |
| `DEVICE_IDS` | Comma-separated GPS device IDs |
| `ALLOWED_ORIGINS` | CORS origins (defaults restricted in production) |
| `ENVIRONMENT` | `development` or `production` |

## Troubleshooting

| Issue | Check |
|-------|-------|
| Backend won't start | `FLEET_USERNAME`, `FLEET_PASSWORD`, `DEVICE_IDS` in `backend/.env` |
| No GPS data | Fleet API credentials, device IDs, backend health at `/api/health` |
| Map blank | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and Maps JS API enabled |
| SSO fails | `ERP_SSO_PUBLIC_KEY` format, SESSION_SECRET set, token not expired |
| 403 on proxy | `PROXY_ALLOWED_DOMAINS` must include the target domain |
