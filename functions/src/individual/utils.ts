/**
 * وظائف مساعدة للمستخدمين الفرديين
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db, ensureAuthenticated } from '../shared/utils';

/**
 * التحقق من أن المستخدم يحاول الوصول إلى بياناته الخاصة فقط
 */
export const ensureUserOwnership = (context: any, userId: string): void => {
    const callerUid = ensureAuthenticated(context);

    if (callerUid !== userId) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'لا يمكنك الوصول إلى بيانات مستخدم آخر.'
        );
    }

    console.log(`[Individual] Authorization Success: User ${callerUid} accessing own data.`);
};

/**
 * التحقق من أن المستخدم يحاول الوصول إلى بياناته الخاصة فقط (للوظائف HTTP)
 */
export const ensureUserOwnershipHttp = async (req: functions.https.Request, userId: string): Promise<string> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (decodedToken.uid !== userId) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'لا يمكنك الوصول إلى بيانات مستخدم آخر.'
        );
    }

    console.log(`[Individual] Authorization Success: User ${decodedToken.uid} accessing own data.`);
    return decodedToken.uid;
};

/**
 * الحصول على بيانات المستخدم الفردي
 */
export const getIndividualUserData = async (userId: string) => {
    const userDoc = await db.collection('individuals').doc(userId).get();
    return userDoc.exists ? userDoc.data() : null;
};

/**
 * التحقق مما إذا كان المستخدم فرديًا
 * إذا كان المستخدم لديه دور 'isIndependent' ولكن ليس لديه وثيقة في مجموعة individuals، يتم إنشاء الوثيقة تلقائيًا
 */
export const isIndividualUser = async (userId: string, createIfNotExists: boolean = false): Promise<boolean> => {
    // التحقق من وجود وثيقة للمستخدم في مجموعة individuals
    const userDoc = await db.collection('individuals').doc(userId).get();
    if (userDoc.exists) {
        return true;
    }

    // التحقق من custom claims للمستخدم
    try {
        const userRecord = await admin.auth().getUser(userId);
        const customClaims = userRecord.customClaims || {};
        const isIndependent = customClaims.role === 'isIndependent' || customClaims.accountType === 'individual';

        // إذا كان المستخدم مستقلاً ولكن ليس لديه وثيقة، وتم طلب إنشاء الوثيقة
        if (isIndependent && createIfNotExists) {
            console.log(`Creating individual document for user ${userId}`);

            // إنشاء وثيقة المستخدم الفردي
            await db.collection('individuals').doc(userId).set({
                name: userRecord.displayName || '',
                email: userRecord.email || '',
                role: 'isIndependent',
                accountType: 'individual',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // تحديث custom claims إذا لزم الأمر
            if (!customClaims.accountType || !customClaims.role) {
                await admin.auth().setCustomUserClaims(userId, {
                    ...customClaims,
                    role: 'isIndependent',
                    accountType: 'individual'
                });
            }

            return true;
        }

        return isIndependent;
    } catch (error) {
        console.error(`Error checking if user ${userId} is individual:`, error);
        return false;
    }
};

/**
 * التحقق من صلاحية الوصول للمستخدم الفردي
 * يسمح للمستخدم بالوصول لبياناته الخاصة أو لمدراء النظام
 */
export const ensureIndividualAccess = async (context: any, targetUserId: string): Promise<void> => {
    // التحقق من المصادقة
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول لاستخدام هذه الوظيفة.'
        );
    }

    const currentUserId = context.auth.uid;
    const token = context.auth.token || {};

    // السماح لمدراء النظام بالوصول لجميع البيانات
    const isSystemOwner = token.isSystemOwner === true || token.role === 'isSystemOwner';
    const isSystemAdmin = token.isSystemAdmin === true || token.role === 'isSystemAdmin';

    if (isSystemOwner || isSystemAdmin) {
        console.log(`[ensureIndividualAccess] ✅ System admin ${currentUserId} accessing user ${targetUserId} data`);
        return;
    }

    // السماح للمستخدم بالوصول لبياناته الخاصة فقط
    if (currentUserId === targetUserId) {
        console.log(`[ensureIndividualAccess] ✅ User ${currentUserId} accessing own data`);
        return;
    }

    // رفض الوصول في جميع الحالات الأخرى
    console.error(`[ensureIndividualAccess] ❌ User ${currentUserId} attempted to access user ${targetUserId} data without permission`);
    throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية للوصول لبيانات هذا المستخدم.'
    );
};
