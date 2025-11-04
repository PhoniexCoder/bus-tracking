# 🚀 Quick Start Guide - Bus Tracking PWA

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)
- **pnpm** or **npm** (package manager)
- **Git** (version control)

## 🏃‍♂️ Getting Started (5 Minutes)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd bus-tracking-pwa
```

### 2. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your credentials
# - Firebase API keys
# - Google Maps API key
# - Fleet API credentials
```

### 3. Start the Backend

```bash
# Navigate to backend folder
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy and configure backend environment
cp .env.example .env
# Edit .env with your Fleet API credentials

# Start the backend server
python app.py
```

Backend will start on **http://localhost:8000** ✅

### 4. Start the Frontend

Open a new terminal:

```bash
# From project root
cd bus-tracking-pwa

# Install Node dependencies
pnpm install
# or: npm install

# Start development server
pnpm dev
# or: npm run dev
```

Frontend will start on **http://localhost:3000** ✅

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (FastAPI auto-generated)

## 🔑 Default Login Credentials

### Admin Login
- **Username**: `admin123` (or your configured admin ID)
- **Password**: `password123` (first login creates account)
- **Role**: Select "Admin"

### Parent Login
- **Username**: `parent123` (or your configured parent ID)
- **Password**: `password123` (first login creates account)
- **Role**: Select "Parent"

## 📱 Features Available

### Admin Dashboard (`/admin/dashboard`)
- View all buses on map
- Real-time GPS tracking
- Manage bus routes and stops
- Add/remove buses
- Access camera feeds (`/admin/cameras`)

### Parent Dashboard (`/parent/dashboard`)
- Track child's bus in real-time
- View distance and ETA
- See bus location on map
- Auto-refresh every 10 seconds

### Camera Feeds (`/admin/cameras`)
- View CCTV feeds from all buses
- Single camera view (full screen)
- Grid view (all cameras)
- 4 channels per bus
- Main/Sub quality toggle

## 🔧 Configuration

### Backend Configuration (`backend/.env`)

```bash
FLEET_USERNAME=your_fleet_username
FLEET_PASSWORD=your_fleet_password
DEVICE_IDS=device1,device2,device3
ALLOWED_ORIGINS=http://localhost:3000
API_PORT=8000
ENVIRONMENT=development
```

### Frontend Configuration (`.env.local`)

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key

# Backend URL
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000
```

## 🐛 Troubleshooting

### Backend Not Starting
```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Install missing dependencies
cd backend
pip install -r requirements.txt
```

### Frontend Not Starting
```bash
# Clear cache and reinstall
rm -rf node_modules .next
pnpm install
pnpm dev
```

### No GPS Data Showing
1. Check backend is running (`http://localhost:8000/api/health`)
2. Verify Fleet API credentials in `backend/.env`
3. Check device IDs are correct
4. Look at backend terminal for error messages

### Map Not Loading
1. Verify Google Maps API key in `.env.local`
2. Enable Maps JavaScript API in Google Cloud Console
3. Check browser console for errors

### Firebase Auth Not Working
1. Verify Firebase configuration in `.env.local`
2. Enable Email/Password auth in Firebase Console
3. Check Firebase rules allow read/write

## 📚 Additional Resources

- [Project Structure](./PROJECT_STRUCTURE.md) - Detailed folder organization
- [Backend API Docs](./backend/README.md) - API endpoints and usage
- [Firebase Schema](./FIREBASE_SCHEMA.md) - Database structure
- [Reorganization Summary](./REORGANIZATION_SUMMARY.md) - Recent changes

## 🎯 Next Steps

1. **Add Your Buses**: Configure device IDs in `backend/.env`
2. **Set Up Firebase**: Create Firebase project and add credentials
3. **Get Google Maps Key**: Enable Maps APIs in Google Cloud
4. **Create Admin Account**: First login creates the account
5. **Assign Buses**: Use admin dashboard to assign buses to routes

## 💡 Tips

- **Development**: Both servers support hot-reload
- **API Testing**: Use `http://localhost:8000/docs` for interactive API docs
- **Debugging**: Check browser console and terminal outputs
- **CORS Issues**: Ensure backend `ALLOWED_ORIGINS` includes your frontend URL

## 🆘 Getting Help

1. Check terminal outputs for error messages
2. Review [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for architecture
3. Check [Backend README](./backend/README.md) for API details
4. Look at browser console for frontend errors

---

**Ready to go!** 🎉 Both servers should now be running and you can access the application at http://localhost:3000
