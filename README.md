# Alcohol Tracker

A full-stack web application for tracking personal alcohol consumption built with React, TypeScript, Tailwind CSS, and Firebase.

## Features

- 🔐 **Google Sign-In**: Secure authentication with Google (any user can sign up)
- 👤 **User Data Isolation**: Each user's data is completely separated and private
- 📊 **Dashboard**: View daily and weekly statistics with goal tracking
- ➕ **Add Entry**: Track alcohol consumption with details
- 📜 **History**: Browse and manage past entries
- ⏰ **Sessions**: Group entries by events or activities
- 📝 **Drink Library**: Quick-select from your favorite drinks
- 🎯 **Goals**: Set and track weekly/monthly consumption limits
- 🔒 **Firebase Integration**: Secure cloud storage

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Firebase** (Firestore & Auth)
- **React Router** for SPA routing
- **Vite** as build tool
- **date-fns** for date formatting

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure Firebase:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore Database
   - **Enable Google Authentication**:
     - Go to Authentication → Sign-in method
     - Click on "Google" provider
     - Toggle "Enable" and set your project support email
     - Add your authorized domains if needed
     - Click "Save"
   - Get your Firebase configuration:
     - Go to Project Settings → General tab
     - Scroll down to "Your apps" section
     - If you don't have a web app, click "Add app" and select Web (</>)
     - Copy the configuration values
   - Set up environment variables:
     - Copy `.env.example` to `.env`:
       ```bash
       cp .env.example .env
       ```
     - Open `.env` and fill in your Firebase credentials:
       ```env
       VITE_FIREBASE_API_KEY=your-api-key-here
       VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
       VITE_FIREBASE_PROJECT_ID=your-project-id
       VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
       VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
       VITE_FIREBASE_APP_ID=your-app-id
       VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
       ```
     - **Important**: Never commit `.env` files to version control (already in `.gitignore`)

3. Set up Firestore:
   - Go to Firestore Database in Firebase Console
   - **Important**: Configure security rules to allow reads and writes:
     - Navigate to Firestore Database → Rules tab
     - For development, you can use these permissive rules:
       ```
       rules_version = '2';
       service cloud.firestore {
         match /databases/{database}/documents {
           match /{document=**} {
             allow read, write: if true;
           }
         }
       }
       ```
     - ⚠️ **WARNING**: The above rules allow anyone to read/write. Only use for development!
     - For production, implement proper user-based security rules:
       ```
       rules_version = '2';
       service cloud.firestore {
         match /databases/{database}/documents {
           // Users can only read/write their own entries
           match /entries/{entryId} {
             allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
             allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
           }
           
           // Users can only read/write their own sessions
           match /sessions/{sessionId} {
             allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
             allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
           }
           
           // Users can only read/write their own drink library
           match /drinkLibrary/{drinkId} {
             allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
             allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
           }
           
           // Users can only read/write their own goals
           match /goals/{goalId} {
             allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
             allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
           }
         }
       }
       ```
     - This ensures users can only access their own data based on `userId` field
   - The collections (`entries`, `sessions`, `drinkLibrary`, `goals`) will be created automatically when you use the app

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/      # Reusable React components
│   ├── Layout.tsx           # Main layout with navigation
│   └── ProtectedRoute.tsx   # Route protection wrapper
├── contexts/       # React contexts
│   └── AuthContext.tsx      # Authentication state management
├── pages/          # Page components
│   ├── Dashboard.tsx        # Main dashboard with stats and charts
│   ├── AddEntry.tsx         # Quick log entry form
│   ├── History.tsx          # Entry history browser
│   ├── Sessions.tsx         # Session/event management
│   ├── DrinkLibrary.tsx     # Drink library management
│   ├── Goals.tsx            # Goal setting and tracking
│   └── Login.tsx            # Google Sign-In page
├── config/         # Configuration files
│   └── firebase.ts          # Firebase initialization
├── types/          # TypeScript type definitions
│   └── index.ts             # Type definitions
├── App.tsx         # Main app component with routing
├── main.tsx        # Application entry point
└── index.css       # Global styles with Tailwind
```

## Security Notes

- **Environment Variables**: All Firebase credentials are stored in `.env` files which are gitignored
- **API Keys**: Firebase API keys in client-side code are safe to expose (they're meant to be public)
- **Security Rules**: Real security comes from Firestore security rules - ensure they're properly configured
- **Never Commit**: Never commit `.env` or `.env.local` files to version control

## Making the Repository Public

If you plan to make this repository public:

1. ✅ Ensure `.env` and `.env.local` are in `.gitignore` (already done)
2. ✅ Use `.env.example` as a template (already created)
3. ✅ All Firebase config now uses environment variables (already updated)
4. ✅ No hardcoded secrets in source code (already fixed)

Before pushing to a public repository:
```bash
# Verify no secrets are committed
git status
# Should NOT show .env or .env.local files

# Double-check what will be committed
git add -n .
```

## License

MIT

