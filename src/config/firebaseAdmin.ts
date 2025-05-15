'use server';

import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let initializationError: Error | null = null;
let adminInitialized = false; // Flag to prevent multiple initialization attempts

// --- Initialization Logic ---
function initializeFirebaseAdmin() {
    // Check if already initialized
    if (adminInitialized) {
        console.log('[Admin SDK] Already successfully initialized.');
        return;
    }
    // Check if an app instance already exists (e.g., from a previous attempt or another part of the code)
    if (admin.apps.length > 0) {
        console.log('[Admin SDK] Found existing Firebase app instance.');
        adminApp = admin.apps[0]; // Use the existing app
        adminInitialized = true; // Mark as initialized since an app exists
        initializationError = null;
        return;
    }

    console.log(`[Admin SDK] Attempting initialization...`);
    try {
        // Use Application Default Credentials (ADC) - Correct for Firebase/GCP environments
        console.log('[Admin SDK] Initializing using Application Default Credentials (ADC)...');
        // Call initializeApp() without arguments relies on ADC in Firebase env
        adminApp = admin.initializeApp();
        console.log('[Admin SDK] Initialization successful.');
        adminInitialized = true; // Mark as successfully initialized
        initializationError = null; // Clear any previous error
    } catch (error: any) {
        console.error('[Admin SDK] Initialization failed:', error);
        adminApp = null;
        adminInitialized = false;
         // Store a more specific error message
         initializationError = new Error(
            `فشل تهيئة مسؤول Firebase: ${error.message || 'سبب غير معروف'}. ` +
            `تأكد من أن بيئة التشغيل لديها الصلاحيات اللازمة أو أن متغيرات البيئة (مثل GOOGLE_APPLICATION_CREDENTIALS للتطوير المحلي) تم تعيينها بشكل صحيح.`
            // `Firebase Admin initialization failed: ${error.message || 'Unknown reason'}. ` +
            // `Ensure the runtime environment has the necessary permissions or environment variables (like GOOGLE_APPLICATION_CREDENTIALS for local dev) are set correctly.`
         );
    }
}

// Call the initialization function immediately when the module loads.
initializeFirebaseAdmin();

// --- Instance Getters ---
// Getters now handle the possibility of initialization failure gracefully

// Helper function to safely get the auth instance
export async function getFirebaseAuth(): Promise<Auth> {
     if (!adminInitialized) {
        console.warn('[Admin SDK] getFirebaseAuth called but not initialized. Attempting re-initialization...');
        initializeFirebaseAdmin(); // Attempt initialization again
     }

     // Check initialization status again after attempting re-init
     if (!adminInitialized || !adminApp) {
        const errorMessage = initializationError?.message || 'لم يتم تهيئة مسؤول Firebase بنجاح.';
        console.error('[Admin SDK] Cannot get auth instance after initialization attempt:', errorMessage);
        throw new Error(
           `فشل في الوصول إلى مصادقة مسؤول Firebase: ${errorMessage} تحقق من تكوين الخادم وسجلاته.`
        );
    }

    try {
         // console.log('[Admin SDK] Returning auth instance.'); // Keep logging minimal
        return getAuth(adminApp);
    } catch (error: any) {
        console.error('[Admin SDK] Error getting auth instance:', error);
        throw new Error(`خطأ داخلي عند الحصول على مصادقة مسؤول Firebase: ${error.message}`);
    }
};

// Helper function to safely get the Firestore DB instance
export async function getFirebaseDb(): Promise<Firestore> {
     if (!adminInitialized) {
        console.warn('[Admin SDK] getFirebaseDb called but not initialized. Attempting re-initialization...');
        initializeFirebaseAdmin(); // Attempt initialization again
     }

      // Check initialization status again after attempting re-init
     if (!adminInitialized || !adminApp) {
        const errorMessage = initializationError?.message || 'لم يتم تهيئة مسؤول Firebase بنجاح.';
        console.error('[Admin SDK] Cannot get Firestore instance after initialization attempt:', errorMessage);
        throw new Error(
           `فشل في الوصول إلى قاعدة بيانات مسؤول Firebase: ${errorMessage} تحقق من تكوين الخادم وسجلاته.`
        );
    }

    try {
        // console.log('[Admin SDK] Returning Firestore instance.'); // Keep logging minimal
        return getFirestore(adminApp);
    } catch (error: any) {
         console.error('[Admin SDK] Error getting Firestore instance:', error);
         throw new Error(`خطأ داخلي عند الحصول على قاعدة بيانات مسؤول Firebase: ${error.message}`);
    }
};

// Export the admin app instance if needed elsewhere (though getters are preferred)
export { adminApp as firebaseAdminApp };