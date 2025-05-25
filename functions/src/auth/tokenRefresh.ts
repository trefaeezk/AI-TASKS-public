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

        // التحقق من أن الطابع الزمني لم يتم إضافته مؤخراً لتجنب التحديث المتكرر
        const lastRefreshTime = customClaims.tokenRefreshTime || 0;
        const now = Date.now();
        const minRefreshInterval = 5000; // 5 ثوان

        if (now - lastRefreshTime < minRefreshInterval) {
            console.log(`[tokenRefresh] Skipping token refresh for user ${uid}, too recent (${now - lastRefreshTime}ms ago)`);
            return;
        }

        // إضافة طابع زمني لإجبار تحديث الـ token
        const updatedClaims = {
            ...customClaims,
            tokenRefreshTime: now,
            lastRefreshSource: 'addTokenRefreshTimestamp'
        };

        // تحديث custom claims
        await admin.auth().setCustomUserClaims(uid, updatedClaims);
        console.log(`[tokenRefresh] Added timestamp to force token refresh for user ${uid}`);
    } catch (error) {
        console.error(`[tokenRefresh] Error forcing token refresh for user ${uid}:`, error);
        throw error;
    }
};
