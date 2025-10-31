# Alcohol Tracker

A full-stack web application for tracking personal alcohol consumption built with React, TypeScript, Tailwind CSS, and Firebase.

## Features

- 🔐 **Google Sign-In**: Secure authentication with Google
- 👤 **User Data Isolation**: Each user's data is completely separated and private
- 📊 **Dashboard**: View daily and weekly statistics with goal tracking
- ➕ **Add Entry**: Track alcohol consumption with details
- 📜 **History**: Browse and manage past entries
- ⏰ **Sessions**: Group entries by events or activities
- 📝 **Drink Library**: Quick-select from your favorite drinks
- 🎯 **Goals**: Set and track weekly/monthly consumption limits
- ✨ **Modern Animations**: Smooth, polished UI with modern animations

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Firebase** (Firestore & Auth)
- **React Router** for SPA routing
- **Vite** as build tool
- **date-fns** for date formatting
- **Recharts** for data visualization

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Firebase project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd alcohol-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your Firebase credentials:
     ```env
     VITE_FIREBASE_API_KEY=your-api-key
     VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=your-project-id
     VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
     VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
     VITE_FIREBASE_APP_ID=your-app-id
     VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
     ```
   - Get these values from Firebase Console → Project Settings → General

4. Configure Firebase:
   - Enable Firestore Database
   - Enable Google Authentication
   - Set up Firestore Security Rules (see below)

5. Run the development server:
```bash
npm run dev
```

## Firestore Security Rules

**Important:** Configure proper security rules in Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    match /entries/{entryId} {
      allow read, write: if isOwner(resource.data.userId);
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
    }
    
    match /sessions/{sessionId} {
      allow read, write: if isOwner(resource.data.userId);
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
    }
    
    match /drinkLibrary/{drinkId} {
      allow read, write: if isOwner(resource.data.userId);
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
    }
    
    match /goals/{goalId} {
      allow read, write: if isOwner(resource.data.userId);
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add all `VITE_FIREBASE_*` environment variables in Vercel Settings → Environment Variables
4. Deploy

## Project Structure

```
src/
├── components/      # Reusable React components
├── contexts/       # React contexts
├── pages/          # Page components
├── config/         # Configuration files
├── types/          # TypeScript type definitions
└── index.css       # Global styles
```

## License

MIT
