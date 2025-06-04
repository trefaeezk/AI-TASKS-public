// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { firebaseConfig } from '../../firebaseConfig';

// تهيئة تطبيق Firebase إذا لم يكن مهيئًا بالفعل
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// خدمات Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// إعداد Functions مع التعامل مع البيئات المختلفة
let functions: any;

if (typeof window !== 'undefined') {
  // في المتصفح
  functions = getFunctions(app, 'europe-west1');

  // تحقق من البيئة
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isLocalhost = window.location.hostname === 'localhost';

  console.log('🔧 Firebase Functions Configuration:');
  console.log('  - Environment:', process.env.NODE_ENV);
  console.log('  - Hostname:', window.location.hostname);
  console.log('  - Project ID:', firebaseConfig.projectId);
  console.log('  - Region: europe-west1');

  // في حالة التطوير المحلي، يمكن استخدام المحاكي إذا كان متاحاً
  if (isDevelopment && isLocalhost) {
    try {
      // محاولة الاتصال بمحاكي Functions إذا كان يعمل
      // connectFunctionsEmulator(functions, 'localhost', 5001);
      // console.log('🔧 Connected to Functions Emulator');
    } catch (error) {
      console.log('🔧 Functions Emulator not available, using production');
    }
  }
} else {
  // في الخادم (SSR)
  functions = null;
}

export { functions };
// إعداد Google Provider مع المعاملات المطلوبة
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;
