/**
 * وظائف Firebase لإدارة إعدادات النظام
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './shared/utils';
// تم حذف v1-compatibility و CORS - لم يعودا مطلوبين
import { createCallableFunction } from './shared/function-utils';

/**
 * نوع بيانات طلب الحصول على إعدادات النظام
 */
interface GetSystemSettingsRequest {
    // لا توجد معلمات مطلوبة
}

/**
 * الحصول على إعدادات النظام
 */
export const getSystemSettings = createCallableFunction<GetSystemSettingsRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'getSystemSettings';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        // الحصول على إعدادات النظام من Firestore
        const settingsDoc = await db.collection('system').doc('settings').get();

        if (!settingsDoc.exists) {
            return { exists: false };
        }

        // إرجاع إعدادات النظام
        return {
            exists: true,
            settings: settingsDoc.data()
        };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to get system settings: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب إعداد النظام
 */
interface SetupSystemRequest {
    type: 'organization' | 'individual';
    organizationName?: string;
    settings?: any;
}

/**
 * إعداد النظام
 */
export const setupSystem = createCallableFunction<SetupSystemRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'setupSystem';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const { type, organizationName, settings } = data;

        // التحقق من صحة المدخلات
        if (!type || (type !== 'organization' && type !== 'individual')) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير نوع النظام (organization أو individual)."
            );
        }

        if (type === 'organization' && !organizationName) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير اسم المؤسسة لنظام المؤسسة."
            );
        }

        // التحقق مما إذا كانت إعدادات النظام موجودة بالفعل
        const settingsDoc = await db.collection('system').doc('settings').get();

        if (settingsDoc.exists) {
            throw new functions.https.HttpsError(
                "already-exists",
                "تم إعداد النظام بالفعل."
            );
        }

        // إعداد النظام
        await db.collection('system').doc('settings').set({
            type,
            ...(type === 'organization' && { organizationName }),
            settings: settings || {
                allowSelfRegistration: type === 'individual',
                defaultUserRole: type === 'individual' ? 'isIndependent' : 'isOrgAssistant',
                autoActivateUsers: type === 'individual',
                enableNotifications: true
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid
        });

        // تعيين المستخدم الحالي كمالك النظام
        await admin.auth().setCustomUserClaims(context.auth.uid, {
            isSystemOwner: true,
            role: 'isSystemOwner'
        });

        // تحديث وثيقة المستخدم في Firestore
        await db.collection('users').doc(context.auth.uid).set({
            role: 'isSystemOwner',
            email: context.auth.token.email || '',
            name: context.auth.token.name || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`System setup completed by user ${context.auth.uid}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to setup system: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب تبديل نوع النظام
 */
interface SwitchSystemTypeRequest {
    type: 'organization' | 'individual';
}

/**
 * تبديل نوع النظام بين الأفراد والمؤسسات
 */
export const switchSystemType = createCallableFunction<SwitchSystemTypeRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'switchSystemType';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        console.log(`[${functionName}] Function called with data:`, data);

        // التحقق من وجود مستخدم مسجل الدخول
        if (!context.auth) {
            console.log(`[${functionName}] Authentication required but not provided`);
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = context.auth.uid;
        console.log(`[${functionName}] User ID:`, uid);

        const { type } = data;
        console.log(`[${functionName}] Requested system type:`, type);

        // التحقق من صحة المدخلات
        if (!type || (type !== 'organization' && type !== 'individual')) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير نوع النظام (organization أو individual)."
            );
        }

        // الحصول على معلومات المستخدم الحالية
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};
        const currentRole = customClaims.role || 'isIndependent';

        // تحديد الدور الجديد بناءً على نوع النظام
        let newRole = currentRole;

        if (type === 'individual') {
            // التحويل إلى نظام الأفراد
            newRole = 'isIndependent';

            // التحقق مما إذا كان المستخدم موجودًا بالفعل في مجموعة individuals
            const individualDoc = await db.collection('individuals').doc(uid).get();

            if (!individualDoc.exists) {
                // إنشاء وثيقة المستخدم الفردي في Firestore
                await db.collection('individuals').doc(uid).set({
                    name: userRecord.displayName || '',
                    email: userRecord.email || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } else {
            // التحويل إلى نظام المؤسسات
            // نحافظ على دور المستخدم كما هو
            newRole = currentRole;

            // التحقق مما إذا كان المستخدم موجودًا بالفعل في مجموعة users
            const userDoc = await db.collection('users').doc(uid).get();

            if (!userDoc.exists) {
                // إنشاء وثيقة المستخدم في Firestore
                await db.collection('users').doc(uid).set({
                    name: userRecord.displayName || '',
                    email: userRecord.email || '',
                    role: newRole,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        // تحديث custom claims للمستخدم
        console.log(`[${functionName}] Updating custom claims for user ${uid} with role ${newRole}`);
        await admin.auth().setCustomUserClaims(uid, {
            ...customClaims,
            role: newRole
        });
        console.log(`[${functionName}] Custom claims updated successfully`);

        console.log(`[${functionName}] User ${uid} switched to ${type} system with role ${newRole}.`);
        const result = {
            success: true,
            type,
            role: newRole
        };
        console.log(`[${functionName}] Returning result:`, result);
        return result;

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to switch system type: ${error.message || 'Unknown internal server error.'}`
        );
    }
});
