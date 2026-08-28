import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { DEMO_MODE } from './demo';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// In demo mode we don't require real Firebase credentials — writes/reads are
// intercepted at the page layer and never actually hit Firebase.
if (!DEMO_MODE && (!firebaseConfig.apiKey || !firebaseConfig.projectId)) {
  const missing: string[] = [];
  if (!firebaseConfig.apiKey) missing.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.storageBucket) missing.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!firebaseConfig.messagingSenderId) missing.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!firebaseConfig.appId) missing.push('VITE_FIREBASE_APP_ID');
  console.error('Missing Firebase environment variables:', missing);
  throw new Error(
    `Missing Firebase configuration. Missing variables: ${missing.join(', ')}. ` +
    `Set VITE_FIREBASE_* in .env.local, or set VITE_DEV_DEMO=true to preview the UI without Firebase.`,
  );
}

// Give Firebase harmless dummies in demo mode so initializeApp doesn't crash.
const app = initializeApp(DEMO_MODE ? {
  apiKey: 'demo', authDomain: 'demo.firebaseapp.com', projectId: 'demo-project',
  storageBucket: 'demo.appspot.com', messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
} : firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

if (!DEMO_MODE && typeof window !== 'undefined') {
  try { getAnalytics(app); }
  catch (error) { console.warn('Firebase Analytics initialization failed:', error); }
}

export default app;
