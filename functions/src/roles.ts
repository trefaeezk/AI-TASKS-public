/**
 * وظائف Firebase لإدارة الأدوار والصلاحيات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { db } from './shared/utils';
import { createCallableFunction, LegacyCallableContext } from './shared/function-utils';

// تكوين CORS
const corsHandler = cors({ origin: true });

/**
 * التحقق من أن المستخدم مسؤول
 */
export const ensureAdmin = (context: LegacyCallableContext): void => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    if (!context.auth.token.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'يجب أن تكون مسؤولاً للوصول إلى هذه الوظيفة.'
        );
    }

    console.log(`Authorization Success: User ${context.auth.uid} is an admin.`);
};

/**
 * التحقق من أن المستخدم مسؤول (للوظائف HTTP)
 */
export const ensureAdminHttp = async (req: functions.https.Request): Promise<string> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (!decodedToken.admin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'يجب أن تكون مسؤولاً للوصول إلى هذه الوظيفة.'
        );
    }

    console.log(`Authorization Success: User ${decodedToken.uid} is an admin.`);
    return decodedToken.uid;
};

/**
 * نوع بيانات طلب تحديث دور المستخدم
 */
interface UpdateUserRoleRequest {
    uid: string;
    role: string;
}

/**
 * تحديث دور المستخدم
 */
export const updateUserRole = createCallableFunction<UpdateUserRoleRequest>(async (request) => {
    const functionName = 'updateUserRole';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // تحويل request إلى LegacyCallableContext
        const context: LegacyCallableContext = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token
            } : undefined,
            rawRequest: request.rawRequest
        };
        ensureAdmin(context);

        const { uid, role } = request.data;

        // التحقق من صحة المدخلات
        if (!uid || typeof uid !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "يجب توفير معرف المستخدم.");
        }

        const validRoles = ['admin', 'engineer', 'supervisor', 'technician', 'assistant', 'user', 'independent'];
        if (!role || typeof role !== "string" || !validRoles.includes(role)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `يجب توفير دور صالح. الأدوار الصالحة هي: ${validRoles.join(', ')}`
            );
        }

        // تحديث claims المستخدم
        const claims: { admin?: boolean; role: string } = { role };
        if (role === 'admin') {
            claims.admin = true;
        }

        await admin.auth().setCustomUserClaims(uid, claims);

        // تحديث بيانات المستخدم في Firestore
        // التحقق من وجود المستخدم في Firestore
        const userDoc = await db.collection('users').doc(uid).get();

        if (userDoc.exists) {
            // تحديث الوثيقة الموجودة
            await db.collection('users').doc(uid).update({
                role: role,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // إنشاء وثيقة جديدة إذا لم تكن موجودة
            // الحصول على معلومات المستخدم من Auth
            const userRecord = await admin.auth().getUser(uid);

            await db.collection('users').doc(uid).set({
                role: role,
                email: userRecord.email || '',
                name: userRecord.displayName || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        console.log(`Successfully updated role for user ${uid} to '${role}'.`);
        return { success: true };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to update user role: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب تحديث صلاحيات المستخدم
 */
interface UpdateUserPermissionsRequest {
    uid: string;
    permissions: string[];
}

/**
 * تحديث صلاحيات المستخدم
 */
export const updateUserPermissions = createCallableFunction<UpdateUserPermissionsRequest>(async (request) => {
    const functionName = 'updateUserPermissions';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // تحويل request إلى LegacyCallableContext
        const context: LegacyCallableContext = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token
            } : undefined,
            rawRequest: request.rawRequest
        };
        ensureAdmin(context);

        const { uid, permissions } = request.data;

        // التحقق من صحة المدخلات
        if (!uid || typeof uid !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "يجب توفير معرف المستخدم.");
        }

        if (!Array.isArray(permissions)) {
            throw new functions.https.HttpsError("invalid-argument", "يجب توفير مصفوفة الصلاحيات.");
        }

        // تحديث بيانات المستخدم في Firestore
        // التحقق من وجود المستخدم في Firestore
        const userDoc = await db.collection('users').doc(uid).get();

        if (userDoc.exists) {
            // تحديث الوثيقة الموجودة
            await db.collection('users').doc(uid).update({
                customPermissions: permissions,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // إنشاء وثيقة جديدة إذا لم تكن موجودة
            // الحصول على معلومات المستخدم من Auth
            const userRecord = await admin.auth().getUser(uid);

            // الحصول على دور المستخدم من custom claims
            const userClaims = (await admin.auth().getUser(uid)).customClaims || {};
            const userRole = userClaims.role || 'independent';

            await db.collection('users').doc(uid).set({
                role: userRole,
                email: userRecord.email || '',
                name: userRecord.displayName || '',
                customPermissions: permissions,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        console.log(`Successfully updated permissions for user ${uid}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to update user permissions: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

// إضافة وظائف HTTP
export * from './roles-http';
