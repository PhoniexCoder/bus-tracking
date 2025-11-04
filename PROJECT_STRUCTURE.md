# 🏗️ Bus Tracking PWA - Project Structure

This document explains the organized project structure with separated frontend and backend.

## 📁 Project Structure

```
bus-tracking-pwa/
├── backend/                    # Python FastAPI Backend
│   ├── app.py                  # Main FastAPI application
│   ├── requirements.txt        # Python dependencies
│   └── README.md               # Backend documentation
│
├── app/                        # Next.js App Router pages
│   ├── admin/                  # Admin dashboard routes
│   │   ├── dashboard/          # Main admin dashboard
│   │   └── cameras/            # Camera feeds page
│   ├── parent/                 # Parent dashboard routes
│   │   └── dashboard/          # Parent tracking page
│   ├── api/                    # Next.js API routes
│   └── login.tsx               # Login page
│
├── components/                 # Reusable React components
│   ├── ui/                     # shadcn/ui components
│   └── google-map.tsx          # Google Maps component
│
├── lib/                        # Utility libraries
│   ├── firebase.ts             # Firebase client config
│   ├── firebase-admin.ts       # Firebase admin SDK
│   ├── firestore.ts            # Firestore helpers
│   ├── google-maps.ts          # Google Maps services
│   ├── config.ts               # App configuration
│   └── utils.ts                # Utility functions
│
├── contexts/                   # React contexts
│   └── auth-context.tsx        # Authentication context
│
├── public/                     # Static assets
│   ├── sw.js                   # Service worker
│   └── ...                     # Images, icons, etc.
│
├── .env.local                  # Environment variables (NOT in Git)
├── .env.example                # Environment template (safe to commit)
├── .gitignore                  # Git ignore rules
├── package.json                # Node.js dependencies
├── tsconfig.json               # TypeScript configuration
├── next.config.mjs             # Next.js configuration
└── README.md                   # Project documentation
```

## 🔧 Configuration Files

### Root Level
- **`.env.local`**: Contains all environment variables (frontend + backend)
- **`.env.example`**: Template for environment variables
- **`.gitignore`**: Excludes sensitive files from Git

### Frontend (Next.js)
- **`package.json`**: Node.js dependencies and scripts
- **`tsconfig.json`**: TypeScript compiler options
- **`next.config.mjs`**: Next.js framework configuration
- **`tailwind.config.ts`**: Tailwind CSS configuration
- **`components.json`**: shadcn/ui component configuration

### Backend (Python)
- **`backend/requirements.txt`**: Python dependencies
- **`backend/app.py`**: FastAPI application entry point

## 🚀 Running the Application

### Frontend (Next.js)
```bash
# Install dependencies
npm install
# or
pnpm install

# Run development server
npm run dev
# or
pnpm dev

# Access at http://localhost:3000
```

### Backend (FastAPI)
```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run server
python app.py

# Access at http://localhost:8000
```

## 🗂️ Removed/Deprecated Files

The following files/folders have been cleaned up:

### Old Backend Location
- ❌ `Check/` folder - **Moved to `backend/`**
  - `combined6.py` → `backend/app.py`
  - `.env` → Merged into root `.env.local`
  - `.env.example` → `backend/.env.example`
  - `README.md` → `backend/README.md`
  - `ENVIRONMENT_SETUP.md` → Consolidated into main docs

### Unnecessary Files
- ❌ Root level scattered files (moved to proper locations)
- ❌ Duplicate environment files
- ❌ Old documentation files

## 🔐 Environment Variables

All environment variables are now in a single `.env.local` file at the root:

### Backend Variables (Python/FastAPI)
```bash
FLEET_USERNAME=
FLEET_PASSWORD=
DEVICE_IDS=
API_HOST=
API_PORT=
ALLOWED_ORIGINS=
ENVIRONMENT=
```

### Frontend Variables (Next.js)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_BACKEND_BASE_URL=
# ... etc
```

## 📝 Key Improvements

1. **Clear Separation**: Frontend and backend are now clearly separated
2. **Single .env File**: One `.env.local` for all configuration
3. **Better Organization**: Files are in logical directories
4. **Removed Duplication**: No duplicate configs or scattered files
5. **Documentation**: Clear README files in each section
6. **Production Ready**: Proper structure for deployment

## 🎯 Next Steps

1. ✅ **DONE**: Separated backend into `backend/` folder
2. ✅ **DONE**: Consolidated environment variables
3. ✅ **DONE**: Created proper documentation
4. **TODO**: Set up Docker containers
5. **TODO**: Add CI/CD pipeline
6. **TODO**: Implement API authentication

## 📚 Documentation

- **Root `/README.md`**: Overall project documentation
- **`/backend/README.md`**: Backend API documentation
- **`/FIREBASE_SCHEMA.md`**: Firestore database schema
- **`.env.example`**: Environment variable reference

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Update documentation if needed
5. Submit a pull request

## 📄 License

[Your License Here]
