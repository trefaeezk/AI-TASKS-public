/**
 * وظائف مساعدة مشتركة للمؤسسات والأفراد
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { LegacyCallableContext } from './function-utils';

// تهيئة Firebase Admin SDK
try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
        console.log("Firebase Admin SDK Initialized in shared/utils.ts");
    }
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
}

// قاعدة بيانات Firestore
export const db = admin.firestore();

/**
 * التحقق من أن المستخدم مسجل الدخول
 */
export const ensureAuthenticated = (context: LegacyCallableContext): string => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }
    return context.auth.uid;
};

/**
 * التحقق من أن المستخدم مسجل الدخول (للوظائف HTTP)
 */
export const ensureAuthenticatedHttp = async (req: functions.https.Request): Promise<string> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
};

/**
 * الحصول على نوع النظام (مؤسسة أو فردي)
 */
export const getSystemType = async (): Promise<'organization' | 'individual' | null> => {
    const settingsDoc = await db.collection('system').doc('settings').get();
    if (!settingsDoc.exists) {
        return null;
    }

    const data = settingsDoc.data();
    return data?.type as 'organization' | 'individual';
};

/**
 * التحقق مما إذا كان المستخدم عضوًا في مؤسسة
 */
export const isOrganizationMember = async (userId: string, orgId: string): Promise<boolean> => {
    const memberDoc = await db.collection('organizations').doc(orgId)
        .collection('members').doc(userId).get();
    return memberDoc.exists;
};

/**
 * التحقق مما إذا كان المستخدم مديرًا في مؤسسة
 */
export const isOrganizationAdmin = async (userId: string, orgId: string): Promise<boolean> => {
    const memberDoc = await db.collection('organizations').doc(orgId)
        .collection('members').doc(userId).get();

    if (!memberDoc.exists) {
        return false;
    }

    const data = memberDoc.data();
    const isOrgAdmin = data?.role === 'isOrgOwner' || data?.role === 'isOrgAdmin';
    return isOrgAdmin;
};

/**
 * الحصول على معلومات المستخدم من Firestore
 */
export const getUserData = async (userId: string, collection: 'users' | 'individuals' = 'users'): Promise<any> => {
    const userDoc = await db.collection(collection).doc(userId).get();
    return userDoc.exists ? userDoc.data() : null;
};

/**
 * تنسيق رسائل الخطأ
 */
export const formatError = (error: any, defaultMessage: string = 'حدث خطأ غير معروف.'): string => {
    if (error instanceof Error) {
        return error.message || defaultMessage;
    }
    if (typeof error === 'string') {
        return error;
    }
    return defaultMessage;
};
