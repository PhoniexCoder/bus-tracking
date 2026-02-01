# Bus Tracker PWA

A production-ready Progressive Web Application for real-time bus tracking with student and admin dashboards.

## Features

- 🚌 Real-time bus tracking using fleet.lagaam.in APIs
- 📱 Progressive Web App with offline capabilities
- 🔐 Authentication (Student, Admin)
- 🗺️ Google Maps integration for location services
- 🔥 Firebase Firestore for data storage
- 📊 Real-time dashboard updates
- 📱 Fully responsive design

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

\`\`\`bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Fleet API Configuration
NEXT_PUBLIC_FLEET_API_BASE_URL=https://fleet.lagaam.in

# App Configuration
NEXT_PUBLIC_APP_ID=bus_tracker_app
NEXT_PUBLIC_APP_NAME=Bus Tracker

# Firebase Auth Token (optional)
NEXT_PUBLIC_INITIAL_AUTH_TOKEN=your_initial_auth_token_here
\`\`\`

### API Keys Setup

#### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable Authentication and Firestore
4. Get your config from Project Settings > General > Your apps
5. Set up Firestore security rules:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Private user data
    match /artifacts/{appId}/users/{userId}/{path=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Unauthenticated access for server-side caching
    match /artifacts/{appId}/public/data/fleetCache/{document=**} {
      allow read, write: if true;
    }

    // Public shared data
    match /artifacts/{appId}/public/data/{path=**} {
      allow read, write: if request.auth != null;
    }
  }
}
\`\`\`

#### 2. Google Maps API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Maps JavaScript API
   - Directions API
   - Geocoding API
3. Create an API key and restrict it to your domain
4. Add the API key to your environment variables

#### 3. Fleet API Access
- Ensure you have valid credentials for fleet.lagaam.in
- The base URL is already configured in the environment

## Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Copy `.env.example` to `.env.local` and fill in your API keys
4. Run the development server:
   \`\`\`bash
   npm run dev
   ```

## Integration & ERP

The system supports seamless integration with ERPs via "Magic Links" for parents.

### Magic Link Format
Generate this URL in your ERP system to give parents direct, zero-login access:

```
https://your-domain.com/parent/dashboard?busId=<BUS_NUMBER>
```

- **busId**: The visual bus number (e.g., `26`) or Plate Number.
- **studentName** (Optional): Personalize the header (e.g., `&studentName=Rahul`).

**Example**:
`https://bus-tracker.vercel.app/parent/dashboard?busId=26&studentName=Rahul`

## Demo Credentials

For testing purposes, you can use these demo credentials:

- **Admin**: Username: `admin123`, Password: `demo123`

## Deployment

### Vercel Deployment
1. Connect your repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy

### Environment Variables in Production
Make sure to set all required environment variables in your production environment. The app will validate required variables on startup.

## Security Notes

- All API keys are stored as environment variables
- Firebase security rules restrict data access
- Authentication tokens are managed securely
- No sensitive data is exposed in client-side code

## PWA Features

- Installable on mobile devices
- Offline functionality with service worker
- Push notifications ready (can be extended)
- App-like experience with proper manifest

## Architecture

- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth + fleet.lagaam.in integration
- **Maps**: Google Maps JavaScript API
- **Real-time Updates**: Firestore listeners + API polling

## Support

For issues or questions, please check the documentation or create an issue in the repository.
