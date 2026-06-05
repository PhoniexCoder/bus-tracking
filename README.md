# Bus Tracker PWA

A production-ready Progressive Web Application for real-time bus tracking with admin and parent dashboards. Authenticated via ERP SSO (RS256 JWT redirect) with a Firebase Auth fallback.

## Features

- Real-time bus tracking using fleet.lagaam.in APIs
- ERP Single Sign-On (RS256 JWT via URL redirect)
- Firebase Firestore for data storage
- Google Maps integration with live bus markers
- WebSocket real-time dashboard updates
- Progressive Web App with offline capabilities
- Role-based dashboards (Admin, Parent)
- CSP, HSTS, and Permissions-Policy security headers

## Architecture

- **Frontend**: Next.js 14 with App Router
- **Backend**: FastAPI (Python) — fleet API proxy + WebSocket broadcast
- **Auth**: ERP SSO (RS256 JWT) / Firebase Auth fallback
- **Database**: Firebase Firestore
- **Maps**: Google Maps JavaScript API
- **Real-time**: WebSocket broadcast every 5s

## Quick Start

```
cp .env.example .env.local          # configure all vars
cp backend/.env.example backend/.env # configure fleet credentials
pnpm install
pnpm dev                             # frontend :3000
cd backend && python app.py          # backend  :8000
```

See [QUICK_START.md](./QUICK_START.md) for detailed setup.

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ERP_SSO_PUBLIC_KEY` | ERP RS256 public key for JWT validation |
| `SESSION_SECRET` | Secret for signing local session cookies |
| `PROXY_ALLOWED_DOMAINS` | Domains the CORS proxy may forward to |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK credentials (server-side) |
| `BACKEND_API_USERNAME/PASSWORD` | Backend API credentials (server-side) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JS API key |

See [.env.local.example](./.env.local.example) for the complete list.

## Auth Flow

1. **ERP SSO (primary)**: ERP redirects user to `/api/auth/sso?token=<RS256_JWT>`, the endpoint validates the JWT, sets an httpOnly `bus_session` cookie, and redirects to the role-based dashboard.
2. **Fallback login**: `/login` page uses Firebase `signInWithEmailAndPassword`, then bridges to the same session cookie via `/api/auth/login`.
3. All protected pages and API routes check the `bus_session` cookie. Logout clears the cookie.

## Security

- All security headers set in middleware (CSP, HSTS, X-Frame-Options, Permissions-Policy, etc.)
- CORS proxy restricted to `PROXY_ALLOWED_DOMAINS` allowlist
- Backend CORS defaults to restrictive origins in production
- WebSocket endpoint validates Origin header against allowlist
- No hardcoded credentials; all secrets from env vars
- CSP overridable via `CSP_HEADER` env var

Now let's delete the old individual login pages since we have a unified login:

```typescriptreact file="app/student/login/page.tsx" isDeleted="true"
...deleted...
