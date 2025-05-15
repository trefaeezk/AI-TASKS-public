// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { firebaseConfig } from '../../firebaseConfig';

// تهيئة تطبيق Firebase إذا لم يكن مهيئًا بالفعل
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// خدمات Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
