/**
 * وظائف HTTP لإدارة الأدوار والصلاحيات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { createHttpFunction } from './shared/function-utils';
import { v1Functions } from './shared/v1-compatibility';
// تعريف دالة ensureAdminHttp مباشرة لتجنب مشاكل الاستيراد
const ensureAdminHttp = async (req: functions.https.Request): Promise<string> => {
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

// تهيئة Firebase Admin SDK إذا لم يكن مهيئًا بالفعل
if (admin.apps.length === 0) {
    admin.initializeApp();
    console.log("Firebase Admin SDK Initialized in roles-http.ts");
}

// تكوين CORS
const corsHandler = cors({ origin: true });

// قاعدة بيانات Firestore
const db = admin.firestore();

/**
 * تحديث دور المستخدم (HTTP)
 */
export const updateUserRoleHttp = createHttpFunction((req, res) => {
    const functionName = 'updateUserRoleHttp';

    // Handle CORS
    corsHandler(req, res, async () => {
        console.log(`--- ${functionName} Cloud Function triggered ---`);
        console.log(`${functionName} called with method:`, req.method);

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method Not Allowed' });
            return;
        }

        try {
            // التحقق من صلاحيات المسؤول
            const adminUid = await ensureAdminHttp(req);

            const { uid, role } = req.body;

            // التحقق من صحة المدخلات
            if (!uid || typeof uid !== "string") {
                res.status(400).json({ error: 'يجب توفير معرف المستخدم.' });
                return;
            }

            const validRoles = ['org_admin', 'org_engineer', 'org_supervisor', 'org_technician', 'org_assistant', 'independent'];
            if (!role || typeof role !== "string" || !validRoles.includes(role)) {
                res.status(400).json({
                    error: `يجب توفير دور صالح. الأدوار الصالحة هي: ${validRoles.join(', ')}`
                });
                return;
            }

            // تحديث claims المستخدم
            const claims: { org_admin?: boolean; role: string } = { role };
            if (role === 'org_admin') {
                claims.org_admin = true;
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

            console.log(`Successfully updated role for user ${uid} to '${role}' by admin ${adminUid}.`);
            res.status(200).json({ success: true });

        } catch (error: any) {
            console.error(`Error in ${functionName}:`, error);

            let statusCode = 500;
            let errorMessage = `Failed to update user role: ${error.message || 'Unknown internal server error.'}`;

            if (error instanceof functions.https.HttpsError) {
                if (error.code === 'unauthenticated') {
                    statusCode = 401;
                } else if (error.code === 'permission-denied') {
                    statusCode = 403;
                } else if (error.code === 'invalid-argument') {
                    statusCode = 400;
                }
                errorMessage = error.message;
            }

            res.status(statusCode).json({
                error: errorMessage,
                code: error.code || 'unknown'
            });
        }
    });
});

/**
 * تحديث صلاحيات المستخدم (HTTP)
 */
export const updateUserPermissionsHttp = createHttpFunction((req, res) => {
    const functionName = 'updateUserPermissionsHttp';

    // Handle CORS
    corsHandler(req, res, async () => {
        console.log(`--- ${functionName} Cloud Function triggered ---`);
        console.log(`${functionName} called with method:`, req.method);

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method Not Allowed' });
            return;
        }

        try {
            // التحقق من صلاحيات المسؤول
            const adminUid = await ensureAdminHttp(req);

            const { uid, permissions } = req.body;

            // التحقق من صحة المدخلات
            if (!uid || typeof uid !== "string") {
                res.status(400).json({ error: 'يجب توفير معرف المستخدم.' });
                return;
            }

            if (!Array.isArray(permissions)) {
                res.status(400).json({ error: 'يجب توفير مصفوفة الصلاحيات.' });
                return;
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
                const userRole = userClaims.role || 'org_assistant';

                await db.collection('users').doc(uid).set({
                    role: userRole,
                    email: userRecord.email || '',
                    name: userRecord.displayName || '',
                    customPermissions: permissions,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            console.log(`Successfully updated permissions for user ${uid} by admin ${adminUid}.`);
            res.status(200).json({ success: true });

        } catch (error: any) {
            console.error(`Error in ${functionName}:`, error);

            let statusCode = 500;
            let errorMessage = `Failed to update user permissions: ${error.message || 'Unknown internal server error.'}`;

            if (error instanceof functions.https.HttpsError) {
                if (error.code === 'unauthenticated') {
                    statusCode = 401;
                } else if (error.code === 'permission-denied') {
                    statusCode = 403;
                } else if (error.code === 'invalid-argument') {
                    statusCode = 400;
                }
                errorMessage = error.message;
            }

            res.status(statusCode).json({
                error: errorMessage,
                code: error.code || 'unknown'
            });
        }
    });
});
