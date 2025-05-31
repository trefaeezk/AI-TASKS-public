/**
 * وظائف Firebase للمستخدمين الفرديين
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared/utils';
import { ensureUserOwnership } from './utils';
import { PermissionKey } from '../shared/permissions';
import { createCallableFunction } from '../shared/function-utils';
// تم حذف v1-compatibility و CORS - لم يعودا مطلوبين

/**
 * نوع بيانات طلب إنشاء مستخدم فردي
 */
interface CreateIndividualUserRequest {
    name: string;
    email?: string;
}

/**
 * إنشاء مستخدم فردي جديد
 * هذه الدالة تستخدم للتسجيل الذاتي للمستخدمين الفرديين
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد واستخدام createUser في index.ts بدلاً منها
 */
// export const createIndividualUser = createCallableFunction<CreateIndividualUserRequest>(async (request) => {
//     // تم تعطيل هذه الوظيفة مؤقتًا لتقليل استهلاك الموارد
//     // استخدم createUser في index.ts بدلاً منها مع تحديد accountType: 'individual'
// });

/**
 * نوع بيانات طلب الحصول على بيانات المستخدم الفردي
 */
interface GetIndividualUserDataRequest {
    uid?: string;
}

/**
 * الحصول على بيانات المستخدم الفردي
 */
export const getIndividualUserData = createCallableFunction<GetIndividualUserDataRequest>(async (request) => {
    const functionName = 'getIndividualUserData';
    console.log(`[Individual] --- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = request.auth.uid;
        const targetUid = request.data.uid || uid;

        // التحقق من أن المستخدم يحاول الوصول إلى بياناته الخاصة فقط
        if (uid !== targetUid) {
            ensureUserOwnership(request, targetUid);
        }

        // الحصول على بيانات المستخدم من Firestore
        const individualDoc = await db.collection('individuals').doc(targetUid).get();
        if (!individualDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "لم يتم العثور على بيانات المستخدم الفردي."
            );
        }

        // إرجاع بيانات المستخدم
        const userData = individualDoc.data();
        return {
            uid: targetUid,
            ...userData
        };

    } catch (error: any) {
        console.error(`[Individual] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to get individual user data: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب تحديث بيانات المستخدم الفردي
 */
interface UpdateIndividualUserDataRequest {
    uid?: string;
    name?: string;
    customPermissions?: string[];
}

/**
 * تحديث بيانات المستخدم الفردي
 */
export const updateIndividualUserData = createCallableFunction<UpdateIndividualUserDataRequest>(async (request) => {
    const functionName = 'updateIndividualUserData';
    console.log(`[Individual] --- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = request.auth.uid;
        const targetUid = request.data.uid || uid;
        const { name, customPermissions } = request.data;

        // التحقق من أن المستخدم يحاول تحديث بياناته الخاصة فقط
        if (uid !== targetUid) {
            ensureUserOwnership(request, targetUid);
        }

        // التحقق من وجود المستخدم في مجموعة individuals
        const individualDoc = await db.collection('individuals').doc(targetUid).get();
        if (!individualDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "لم يتم العثور على بيانات المستخدم الفردي."
            );
        }

        // تحديث بيانات المستخدم
        const updateData: { [key: string]: any } = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (name !== undefined) {
            updateData.name = name;
        }

        if (customPermissions !== undefined && Array.isArray(customPermissions)) {
            updateData.customPermissions = customPermissions;
        }

        await db.collection('individuals').doc(targetUid).update(updateData);

        console.log(`[Individual] Successfully updated individual user data for ${targetUid}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Individual] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to update individual user data: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * تصدير بيانات المستخدم الفردي
 */
export const exportIndividualData = createCallableFunction(async (request) => {
    const functionName = 'exportIndividualData';
    console.log(`[Individual] --- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = request.auth.uid;

        // التحقق من أن المستخدم فردي
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        if (customClaims.role !== 'independent') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'هذه الوظيفة متاحة فقط للمستخدمين الفرديين.'
            );
        }

        // الحصول على بيانات المستخدم
        const individualDoc = await db.collection('individuals').doc(uid).get();
        const userData = individualDoc.exists ? individualDoc.data() : {};

        // الحصول على مهام المستخدم
        const tasksSnapshot = await db.collection('individuals').doc(uid).collection('tasks').get();
        const tasks = tasksSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // الحصول على تقارير المستخدم
        const reportsSnapshot = await db.collection('individuals').doc(uid).collection('reports').get();
        const reports = reportsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // إرجاع البيانات
        return {
            user: userData,
            tasks,
            reports
        };

    } catch (error: any) {
        console.error(`[Individual] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to export individual data: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب استيراد بيانات المستخدم الفردي
 */
interface ImportIndividualDataRequest {
    tasks?: any[];
    reports?: any[];
}

/**
 * استيراد بيانات المستخدم الفردي
 */
export const importIndividualData = createCallableFunction<ImportIndividualDataRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'importIndividualData';
    console.log(`[Individual] --- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = context.auth.uid;
        const { tasks, reports } = data;

        // التحقق من أن المستخدم فردي
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        if (customClaims.role !== 'independent') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'هذه الوظيفة متاحة فقط للمستخدمين الفرديين.'
            );
        }

        // استيراد المهام
        if (tasks && Array.isArray(tasks)) {
            const batch = db.batch();

            for (const task of tasks) {
                const { id, ...taskData } = task;
                const taskRef = db.collection('individuals').doc(uid).collection('tasks').doc(id);
                batch.set(taskRef, {
                    ...taskData,
                    importedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            await batch.commit();
            console.log(`[Individual] Imported ${tasks.length} tasks for user ${uid}.`);
        }

        // استيراد التقارير
        if (reports && Array.isArray(reports)) {
            const batch = db.batch();

            for (const report of reports) {
                const { id, ...reportData } = report;
                const reportRef = db.collection('individuals').doc(uid).collection('reports').doc(id);
                batch.set(reportRef, {
                    ...reportData,
                    importedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            await batch.commit();
            console.log(`[Individual] Imported ${reports.length} reports for user ${uid}.`);
        }

        return { success: true };

    } catch (error: any) {
        console.error(`[Individual] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to import individual data: ${error.message || 'Unknown internal server error.'}`
        );
    }
});
