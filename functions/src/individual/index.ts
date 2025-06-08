/**
 * وظائف Firebase للمستخدمين الفرديين
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared/utils';
import { ensureUserOwnership, ensureIndividualAccess } from './utils';
import { PermissionKey } from '../shared/permissions';
import { createCallableFunction, createHttpFunction } from '../shared/function-utils';
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

        if (customClaims.role !== 'isIndependent') {
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

        if (customClaims.role !== 'isIndependent') {
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

/**
 * حذف جميع بيانات المستخدم الفردي
 * يحذف البيانات من مجموعة individuals والمجموعات الفرعية
 */
export const deleteIndividualUserData = createCallableFunction<{ userId: string }>(async (request) => {
    const functionName = 'deleteIndividualUserData';
    console.log(`🚀 --- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من المصادقة
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لاستخدام هذه الوظيفة.'
            );
        }

        // التحقق من الصلاحيات - يجب أن يكون مدير نظام أو المستخدم نفسه
        const currentUserId = request.auth.uid;
        const token = request.auth.token || {};

        // السماح لمدراء النظام بحذف أي بيانات
        const isSystemOwner = token.isSystemOwner === true || token.role === 'isSystemOwner';
        const isSystemAdmin = token.isSystemAdmin === true || token.role === 'isSystemAdmin';

        if (!isSystemOwner && !isSystemAdmin && currentUserId !== request.data.userId) {
            console.error(`[${functionName}] User ${currentUserId} attempted to delete data for user ${request.data.userId} without system admin permissions`);
            console.error(`[${functionName}] User role: ${token.role}`);
            console.error(`[${functionName}] User claims:`, token);

            throw new functions.https.HttpsError(
                'permission-denied',
                'ليس لديك صلاحية لحذف بيانات هذا المستخدم. هذه العملية مخصصة لمدراء النظام فقط.'
            );
        }

        console.log(`[${functionName}] ✅ User ${currentUserId} (${token.role}) has permission to delete data for user ${request.data.userId}`);

        const { userId } = request.data;
        console.log(`[${functionName}] بدء حذف بيانات المستخدم الفردي: ${userId}`);

        let deletedCount = 0;

        // 1. حذف المهام المرتبطة بالمستخدم من المجموعة الرئيسية
        console.log(`[${functionName}] حذف المهام من المجموعة الرئيسية...`);
        const tasksQuery = await db.collection('tasks')
            .where('userId', '==', userId)
            .get();

        const assignedTasksQuery = await db.collection('tasks')
            .where('assignedToUserId', '==', userId)
            .get();

        const createdTasksQuery = await db.collection('tasks')
            .where('createdBy', '==', userId)
            .get();

        // دمج جميع المهام وحذفها
        const allTaskIds = new Set<string>();
        tasksQuery.docs.forEach(doc => allTaskIds.add(doc.id));
        assignedTasksQuery.docs.forEach(doc => allTaskIds.add(doc.id));
        createdTasksQuery.docs.forEach(doc => allTaskIds.add(doc.id));

        if (allTaskIds.size > 0) {
            const batch = db.batch();
            allTaskIds.forEach(taskId => {
                batch.delete(db.collection('tasks').doc(taskId));
            });
            await batch.commit();
            deletedCount += allTaskIds.size;
            console.log(`[${functionName}] تم حذف ${allTaskIds.size} مهمة من المجموعة الرئيسية`);
        }

        // 2. حذف الاجتماعات المرتبطة بالمستخدم
        console.log(`[${functionName}] حذف الاجتماعات...`);
        const meetingsQuery = await db.collection('meetings')
            .where('createdBy', '==', userId)
            .get();

        if (meetingsQuery.size > 0) {
            const batch = db.batch();
            meetingsQuery.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += meetingsQuery.size;
            console.log(`[${functionName}] تم حذف ${meetingsQuery.size} اجتماع`);
        }

        // إزالة المستخدم من الاجتماعات كمشارك
        const allMeetingsQuery = await db.collection('meetings').get();
        let updatedMeetingsCount = 0;

        if (allMeetingsQuery.size > 0) {
            const batch = db.batch();
            allMeetingsQuery.docs.forEach(doc => {
                const data = doc.data();
                if (data.participants && Array.isArray(data.participants)) {
                    const originalCount = data.participants.length;
                    const updatedParticipants = data.participants.filter((p: any) => p.userId !== userId);

                    if (updatedParticipants.length < originalCount) {
                        batch.update(doc.ref, {
                            participants: updatedParticipants,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        updatedMeetingsCount++;
                    }
                }
            });

            if (updatedMeetingsCount > 0) {
                await batch.commit();
                console.log(`[${functionName}] تم إزالة المستخدم من ${updatedMeetingsCount} اجتماع كمشارك`);
            }
        }

        // 3. حذف الأهداف والنتائج الرئيسية
        console.log(`[${functionName}] حذف الأهداف والنتائج الرئيسية...`);

        // حذف الأهداف
        const objectivesQuery = await db.collection('objectives')
            .where('createdBy', '==', userId)
            .get();

        const assignedObjectivesQuery = await db.collection('objectives')
            .where('assignedTo', '==', userId)
            .get();

        // دمج الأهداف المنشأة والمعينة
        const allObjectiveIds = new Set<string>();
        objectivesQuery.docs.forEach(doc => allObjectiveIds.add(doc.id));
        assignedObjectivesQuery.docs.forEach(doc => allObjectiveIds.add(doc.id));

        if (allObjectiveIds.size > 0) {
            const batch = db.batch();
            allObjectiveIds.forEach(objectiveId => {
                batch.delete(db.collection('objectives').doc(objectiveId));
            });
            await batch.commit();
            deletedCount += allObjectiveIds.size;
            console.log(`[${functionName}] تم حذف ${allObjectiveIds.size} هدف`);
        }

        // حذف النتائج الرئيسية
        const keyResultsQuery = await db.collection('keyResults')
            .where('createdBy', '==', userId)
            .get();

        const assignedKeyResultsQuery = await db.collection('keyResults')
            .where('assignedTo', '==', userId)
            .get();

        // دمج النتائج المنشأة والمعينة
        const allKeyResultIds = new Set<string>();
        keyResultsQuery.docs.forEach(doc => allKeyResultIds.add(doc.id));
        assignedKeyResultsQuery.docs.forEach(doc => allKeyResultIds.add(doc.id));

        if (allKeyResultIds.size > 0) {
            const batch = db.batch();
            allKeyResultIds.forEach(keyResultId => {
                batch.delete(db.collection('keyResults').doc(keyResultId));
            });
            await batch.commit();
            deletedCount += allKeyResultIds.size;
            console.log(`[${functionName}] تم حذف ${allKeyResultIds.size} نتيجة رئيسية`);
        }

        // 4. حذف الإشعارات المرتبطة بالمستخدم
        const notificationsQuery = await db.collection('notifications')
            .where('userId', '==', userId)
            .get();

        if (notificationsQuery.size > 0) {
            const batch = db.batch();
            notificationsQuery.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += notificationsQuery.size;
            console.log(`[${functionName}] تم حذف ${notificationsQuery.size} إشعار`);
        }

        // 5. حذف وثيقة المستخدم من مجموعة individuals
        const individualDoc = await db.collection('individuals').doc(userId).get();
        if (individualDoc.exists) {
            await db.collection('individuals').doc(userId).delete();
            deletedCount++;
            console.log(`[${functionName}] تم حذف وثيقة المستخدم من مجموعة individuals`);
        }

        // 6. حذف المهام الفرعية (النظام القديم)
        const tasksSnapshot = await db.collection('individuals').doc(userId).collection('tasks').get();
        if (tasksSnapshot.size > 0) {
            const batch = db.batch();
            tasksSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += tasksSnapshot.size;
            console.log(`[${functionName}] تم حذف ${tasksSnapshot.size} مهمة فرعية (النظام القديم)`);
        }

        // 7. حذف التقارير الفرعية (النظام القديم)
        const reportsSnapshot = await db.collection('individuals').doc(userId).collection('reports').get();
        if (reportsSnapshot.size > 0) {
            const batch = db.batch();
            reportsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += reportsSnapshot.size;
            console.log(`[${functionName}] تم حذف ${reportsSnapshot.size} تقرير فرعي (النظام القديم)`);
        }

        console.log(`[${functionName}] ✅ تم حذف جميع بيانات المستخدم الفردي ${userId} بنجاح`);
        console.log(`[${functionName}] إجمالي العناصر المحذوفة: ${deletedCount}`);

        return {
            success: true,
            deletedCount,
            message: `تم حذف ${deletedCount} عنصر من بيانات المستخدم الفردي`
        };

    } catch (error: any) {
        console.error(`[${functionName}] خطأ في حذف بيانات المستخدم الفردي:`, error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError(
            'internal',
            `فشل في حذف بيانات المستخدم الفردي: ${error.message}`
        );
    }
});

/**
 * نسخة HTTP من دالة حذف بيانات المستخدم الفردي - للتطوير المحلي
 */
export const deleteIndividualUserDataHttp = createHttpFunction<{ userId: string }>(async (request) => {
    const functionName = 'deleteIndividualUserDataHttp';
    console.log(`🚀 --- ${functionName} HTTP Function triggered ---`);

    try {
        // التحقق من المصادقة
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لاستخدام هذه الوظيفة.'
            );
        }

        // التحقق من الصلاحيات - يجب أن يكون مدير نظام أو المستخدم نفسه
        const currentUserId = request.auth.uid;
        const token = request.auth.token || {};

        // السماح لمدراء النظام بحذف أي بيانات
        const isSystemOwner = token.isSystemOwner === true || token.role === 'isSystemOwner';
        const isSystemAdmin = token.isSystemAdmin === true || token.role === 'isSystemAdmin';

        if (!isSystemOwner && !isSystemAdmin && currentUserId !== request.data.userId) {
            console.error(`[${functionName}] User ${currentUserId} attempted to delete data for user ${request.data.userId} without system admin permissions`);
            console.error(`[${functionName}] User role: ${token.role}`);
            console.error(`[${functionName}] User claims:`, token);

            throw new functions.https.HttpsError(
                'permission-denied',
                'ليس لديك صلاحية لحذف بيانات هذا المستخدم. هذه العملية مخصصة لمدراء النظام فقط.'
            );
        }

        console.log(`[${functionName}] ✅ User ${currentUserId} (${token.role}) has permission to delete data for user ${request.data.userId}`);

        const { userId } = request.data;
        console.log(`[${functionName}] بدء حذف بيانات المستخدم الفردي: ${userId}`);

        let deletedCount = 0;

        // 1. حذف وثيقة المستخدم من مجموعة individuals
        const individualDoc = await db.collection('individuals').doc(userId).get();
        if (individualDoc.exists) {
            await db.collection('individuals').doc(userId).delete();
            deletedCount++;
            console.log(`[${functionName}] تم حذف وثيقة المستخدم من مجموعة individuals`);
        }

        // 2. حذف المهام الفرعية (النظام القديم)
        const tasksSnapshot = await db.collection('individuals').doc(userId).collection('tasks').get();
        if (tasksSnapshot.size > 0) {
            const batch = db.batch();
            tasksSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += tasksSnapshot.size;
            console.log(`[${functionName}] تم حذف ${tasksSnapshot.size} مهمة فرعية`);
        }

        // 3. حذف التقارير الفرعية (النظام القديم)
        const reportsSnapshot = await db.collection('individuals').doc(userId).collection('reports').get();
        if (reportsSnapshot.size > 0) {
            const batch = db.batch();
            reportsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            deletedCount += reportsSnapshot.size;
            console.log(`[${functionName}] تم حذف ${reportsSnapshot.size} تقرير فرعي`);
        }

        console.log(`[${functionName}] ✅ تم حذف جميع بيانات المستخدم الفردي ${userId} بنجاح`);
        console.log(`[${functionName}] إجمالي العناصر المحذوفة: ${deletedCount}`);

        return {
            success: true,
            deletedCount,
            message: `تم حذف ${deletedCount} عنصر من بيانات المستخدم الفردي`
        };

    } catch (error: any) {
        console.error(`[${functionName}] خطأ في حذف بيانات المستخدم الفردي:`, error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError(
            'internal',
            `فشل في حذف بيانات المستخدم الفردي: ${error.message}`
        );
    }
});
