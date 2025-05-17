/**
 * وظائف Firebase لإدارة تحديث token المستخدم
 */

import * as admin from 'firebase-admin';

/**
 * إضافة طابع زمني إلى custom claims للمستخدم
 * هذا يجبر Firebase على إصدار token جديد في المرة القادمة التي يتم فيها استدعاء getIdToken
 * 
 * @param uid معرف المستخدم
 * @returns وعد بإتمام العملية
 */
export const addTokenRefreshTimestamp = async (uid: string): Promise<void> => {
    try {
        // الحصول على معلومات المستخدم الحالية
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        // إضافة طابع زمني لإجبار تحديث الـ token
        const updatedClaims = {
            ...customClaims,
            tokenRefreshTime: Date.now()
        };

        // تحديث custom claims
        await admin.auth().setCustomUserClaims(uid, updatedClaims);
        console.log(`[tokenRefresh] Added timestamp to force token refresh for user ${uid}`);
    } catch (error) {
        console.error(`[tokenRefresh] Error forcing token refresh for user ${uid}:`, error);
        throw error;
    }
};
