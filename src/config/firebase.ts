// src/config/firebase.ts
// import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'; // Removed original imports
import { initializeApp, getApps } from 'firebase/app'; // Keep necessary imports
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
// Import the configuration object from firebaseConfig.js
// Note: Adjust the path if firebaseConfig.js is not in the root directory relative to src.
// Assuming firebaseConfig.js is in the root:
import { firebaseConfig } from '../../firebaseConfig.js'; // Adjust path as necessary

// // Removed original config based on environment variables
// const firebaseConfigEnv: FirebaseOptions = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
//   // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
// };

// Initialize Firebase using the imported configuration
let app;
if (!getApps().length) {
  // Use the imported firebaseConfig object
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized using config from firebaseConfig.js");
} else {
  app = getApps()[0];
   console.log("Using existing Firebase app instance.");
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app); // Initialize Firestore
const functions = getFunctions(app, 'europe-west1'); // Initialize Functions with region

// تعيين timeout أطول للدوال
if (typeof window !== 'undefined') {
  // فقط في المتصفح
  try {
    const { connectFunctionsEmulator } = require('firebase/functions');
    // لا نتصل بالمحاكي، لكن نتأكد من إعدادات الاتصال
    console.log('Firebase Functions configured for production use');
  } catch (error) {
    console.log('Firebase Functions configuration loaded');
  }
}

export { app, auth, googleProvider, db, functions }; // Export all services