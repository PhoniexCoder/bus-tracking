# 🚀 Quick Reference - Bus Tracking PWA

## 🔴 URGENT: Before Sharing with Client

```bash
# 1. Remove sensitive files from git
git rm --cached bus-tracking-7dcff-firebase-adminsdk-fbsvc-a118dbc578.json
git rm --cached *.crt *.pem
git commit -m "Remove sensitive files"
git push

# 2. Verify .env files are not committed
git status  # Should not show any .env files
```

---

## ⚡ Quick Start Commands

### Frontend
```bash
# Install dependencies
pnpm install

# Development
pnpm dev          # http://localhost:3000

# Production
pnpm build
pnpm start
```

### Backend
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt
pip install websockets  # REQUIRED!

# Run backend
python app.py         # http://localhost:8000

# Alternative (conda)
$env:CONDA_PREFIX = "a:\bus-tracking-pwa\.conda"
$env:PATH = "a:\bus-tracking-pwa\.conda;a:\bus-tracking-pwa\.conda\Scripts;a:\bus-tracking-pwa\.conda\Library\bin;" + $env:PATH
python backend\app.py
```

---

## 🔑 Demo Credentials

```
Admin:
  Username: admin
  Password: admin123

Parent/Student:
  ID: student123
  Password: demo123
```

---

## 🌐 Key URLs

### Development
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Backend Docs: http://localhost:8000/docs
- WebSocket: ws://localhost:8000/ws/live

### Pages
- Login: `/login`
- Admin Dashboard: `/admin/dashboard`
- Parent Dashboard: `/parent/dashboard`
- Driver Dashboard: removed in current build

---

## 🔧 Environment Variables

### Required in `.env.local` (Frontend)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Required in `backend/.env`
```bash
FLEET_USERNAME=
FLEET_PASSWORD=
DEVICE_IDS=000088832714,000088832758
API_HOST=0.0.0.0
API_PORT=8000
ALLOWED_ORIGINS=http://localhost:3000
ENVIRONMENT=development
JWT_SECRET_KEY=your-secret-key-32-chars-minimum
```

---

## 📊 Key Features

✅ Real-time GPS tracking via WebSocket  
✅ Admin dashboard (view/add/edit buses)  
✅ Parent dashboard (view assigned bus)  
✅ Google Maps integration  
✅ Role-based authentication  
✅ Progressive Web App  
✅ Mobile responsive  
✅ Auto-reconnect WebSocket  
✅ Connection status indicator  

---

## 🐛 Common Issues

### WebSocket Error
**Symptom**: Red "Connecting..." indicator  
**Fix**: 
1. Ensure backend is running
2. Check `pip install websockets` was run
3. Verify `NEXT_PUBLIC_BACKEND_WS_URL` is correct

### No Buses Showing
**Fix**:
1. Check backend logs: `backend/logs/backend.log`
2. Verify `DEVICE_IDS` in `backend/.env`
3. Check Firebase connection
4. Try adding bus manually via "Add Bus" button

### Maps Not Loading
**Fix**:
1. Check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
2. Verify API key restrictions in Google Cloud Console
3. Ensure billing is enabled for Google Maps

### Login Fails
**Fix**:
1. Check Firebase Authentication is enabled
2. Verify `JWT_SECRET_KEY` matches between frontend/backend
3. Check browser console for errors

---

## 📂 Important Files

### Configuration
- `package.json` - Frontend dependencies
- `tsconfig.json` - TypeScript config
- `.env.local` - Frontend environment (create from example)
- `backend/.env` - Backend environment (create from .env.example)
- `backend/requirements.txt` - Python dependencies

### Documentation
- `CLIENT_DEPLOYMENT_GUIDE.md` - Full deployment guide
- `PRODUCTION_CHECKLIST.md` - Pre-launch checklist
- `PROJECT_SUMMARY.md` - Project overview
- `README.md` - General readme

### Code
- `app/admin/dashboard/page.tsx` - Admin dashboard
- `app/parent/dashboard/page.tsx` - Parent dashboard
- `backend/app.py` - Backend API server
- `backend/auth.py` - Authentication logic

---

## 🔒 Security Checklist

Before production:
- [ ] Remove Firebase admin SDK key from repo
- [ ] Remove SSL certificates from repo
- [ ] Generate new JWT secret
- [ ] Update CORS origins to production domain
- [ ] Enable HTTPS/WSS
- [ ] Restrict API keys to production domain
- [ ] Update Firestore security rules

---

## 📈 Performance

- WebSocket replaces 60-120 HTTP requests/min
- GPS updates every 5 seconds
- Supports 50-100 concurrent users
- API response < 500ms
- Page load < 3 seconds

---

## 📱 Mobile Install

1. Open website in mobile browser
2. Tap browser menu
3. Select "Add to Home Screen"
4. App installs like native app

---

## 🆘 Emergency Contacts

**Backend Issues**: Check `backend/logs/backend.log`  
**Frontend Issues**: Check browser console (F12)  
**Firebase**: https://console.firebase.google.com/  
**Google Maps**: https://console.cloud.google.com/  

---

## 📊 Tech Stack

**Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS  
**Backend**: FastAPI, Python 3.11, WebSocket, JWT  
**Database**: Firebase Firestore  
**Maps**: Google Maps JavaScript API  
**Authentication**: Firebase Auth + JWT  
**Real-time**: WebSocket (ws/wss protocol)  

---

## 💡 Quick Tips

1. **Always run backend before frontend**
2. **WebSocket requires `websockets` package**
3. **Check logs first when debugging**
4. **Use browser console for frontend errors**
5. **Firebase Console for database issues**
6. **Device ID is the primary identifier**
7. **Green dot = WebSocket connected**

---

## 📞 Support Commands

```bash
# Check if backend running
curl http://localhost:8000/health

# Check WebSocket
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8000/ws/live

# View backend logs
cat backend/logs/backend.log

# Build production
pnpm build
```

---

## 🎯 Next Steps After Handover

**Phase 1** (Critical):
1. Token refresh mechanism
2. Delete bus functionality
3. Replace alerts with toasts

**Phase 2** (Important):
4. Driver dashboard completion (not applicable; feature removed)
5. Push notifications
6. Attendance tracking

**Phase 3** (Nice-to-have):
7. Camera streaming
8. Historical data
9. Reports & analytics

---

**Last Updated**: November 2, 2025  
**Version**: 1.0  
**Status**: Production Ready (with security fixes)
