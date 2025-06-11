
/**
 * وظائف Firebase لإدارة موافقة المهام
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared/utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { createCallableFunction } from '../shared/function-utils';
import { CallableRequest } from '../shared/types';
// Removed client-side imports: import { query, collection, where, orderBy, getDocs } from 'firebase/firestore';

/**
 * نوع بيانات طلب إنشاء مهمة تتطلب موافقة
 */
interface CreateTaskWithApprovalRequest {
    title: string;
    description?: string;
    startDate?: { seconds: number };
    dueDate?: { seconds: number };
    priority?: string;
    assignedToUserId?: string;
    departmentId?: string;
    categoryName?: string;
    organizationId: string;
    approvalLevel: 'department' | 'organization';
    notes?: string;
    milestones?: Array<{
        id: string;
        description: string;
        completed: boolean;
        weight: number;
        dueDate?: { seconds: number };
    }>;
    durationValue?: number;
    durationUnit?: string;
}

/**
 * إنشاء مهمة تتطلب موافقة
 */
export const createTaskWithApproval = createCallableFunction<CreateTaskWithApprovalRequest>(async (request: CallableRequest<CreateTaskWithApprovalRequest>) => {
    const { data, auth } = request;
    const functionName = 'createTaskWithApproval';
    logFunctionStart(functionName, data);

    try {
        // التحقق من تسجيل الدخول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لإنشاء مهمة جديدة.'
            );
        }

        const userId = auth.uid;

        // التحقق من البيانات المطلوبة
        validateInput(data, [
            'title',
            'organizationId',
            'approvalLevel'
        ]);

        const {
            title,
            description,
            startDate,
            dueDate,
            priority,
            assignedToUserId,
            departmentId,
            categoryName,
            organizationId,
            approvalLevel,
            notes,
            milestones,
            durationValue,
            durationUnit
        } = data;

        // التحقق من صلاحيات المستخدم
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'لم يتم العثور على المستخدم.'
            );
        }

        const userData = userDoc.data();
        
        // التحقق من عضوية المستخدم في المؤسسة
        if (userData?.organizationId !== organizationId) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'ليس لديك صلاحية لإنشاء مهام في هذه المؤسسة.'
            );
        }

        // تحديد معرف القسم النهائي
        let finalDepartmentId: string | null = null;

        // التحقق من صلاحيات إنشاء المهام حسب مستوى الموافقة
        if (approvalLevel === 'department') {
            const isAdminRole = userData?.isOrgOwner || userData?.isOrgAdmin;

            if (isAdminRole) {
                finalDepartmentId = departmentId || null;
                if (!finalDepartmentId) {
                    throw new functions.https.HttpsError(
                        'permission-denied',
                        'يجب اختيار قسم لإنشاء مهمة على مستوى القسم.'
                    );
                }
            } else {
                finalDepartmentId = userData?.departmentId || null;
                if (!finalDepartmentId) {
                    throw new functions.https.HttpsError(
                        'permission-denied',
                        'يجب أن تكون عضواً في قسم لإنشاء مهام على مستوى القسم.'
                    );
                }
            }

            const departmentTaskCreationRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer', 'isOrgTechnician'];
            if (!departmentTaskCreationRoles.includes(userData?.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'ليس لديك صلاحية لإنشاء مهام على مستوى القسم.'
                );
            }
        } else if (approvalLevel === 'organization') {
            const allowedRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer'];
            if (!allowedRoles.includes(userData?.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'ليس لديك صلاحية لإنشاء مهام على مستوى المؤسسة.'
                );
            }
        }

        let assigneeName = null;
        let departmentName = null;

        if (assignedToUserId) {
            const assigneeDoc = await db.collection('users').doc(assignedToUserId).get();
            if (assigneeDoc.exists) {
                assigneeName = assigneeDoc.data()?.name || assigneeDoc.data()?.displayName || 'مستخدم غير معروف';
            }
        }

        if (finalDepartmentId) {
            const departmentDoc = await db.collection('organizations').doc(organizationId).collection('departments').doc(finalDepartmentId).get();
            if (departmentDoc.exists) {
                departmentName = departmentDoc.data()?.name || 'قسم غير معروف';
            }
        }

        let processedMilestones: Array<{
            id: string;
            description: string;
            completed: boolean;
            weight: number;
            dueDate: admin.firestore.Timestamp | null;
        }> | null = null;

        if (milestones && milestones.length > 0) {
            processedMilestones = milestones.map(milestone => ({
                id: milestone.id,
                description: milestone.description,
                completed: milestone.completed,
                weight: milestone.weight,
                dueDate: milestone.dueDate ? admin.firestore.Timestamp.fromMillis(milestone.dueDate.seconds * 1000) : null
            }));
        }

        const taskData = {
            userId: userId,
            description: title,
            details: description || '',
            status: 'pending-approval',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            startDate: startDate ? admin.firestore.Timestamp.fromMillis(startDate.seconds * 1000) : null,
            dueDate: dueDate ? admin.firestore.Timestamp.fromMillis(dueDate.seconds * 1000) : null,
            priority: priority || 'medium',
            priorityReason: null,
            assignedToUserId: assignedToUserId || null,
            assigneeName: assigneeName,
            departmentId: finalDepartmentId || null,
            departmentName: departmentName,
            taskCategoryName: categoryName || null,
            organizationId,
            taskContext: approvalLevel === 'department' ? 'department' : 'organization',
            accountType: 'organization',
            order: Date.now(),
            milestones: processedMilestones,
            durationValue: durationValue || null,
            durationUnit: durationUnit || null,
            requiresApproval: true,
            approvalLevel: approvalLevel,
            submittedBy: userId,
            submittedByName: userData?.name || userData?.displayName || 'مستخدم غير معروف',
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            notes: notes || null
        };

        const taskRef = await db.collection('tasks').add(taskData);
        await createApprovalNotifications({ ...taskData, id: taskRef.id }, organizationId);

        logFunctionEnd(functionName, { taskId: taskRef.id });
        return {
            success: true,
            taskId: taskRef.id,
            message: `تم إرسال المهمة للموافقة على مستوى ${approvalLevel === 'department' ? 'القسم' : 'المؤسسة'}`
        };

    } catch (error: any) {
        logFunctionError(functionName, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to create task with approval: ${error.message || 'Unknown error'}`
        );
    }
});

/**
 * نوع بيانات طلب الموافقة على مهمة
 */
interface ApproveTaskRequest {
    taskId: string;
    approved: boolean;
    rejectionReason?: string;
}

/**
 * الموافقة على مهمة أو رفضها
 */
export const approveTask = createCallableFunction<ApproveTaskRequest>(async (request: CallableRequest<ApproveTaskRequest>) => {
    const { data, auth } = request;
    const functionName = 'approveTask';
    logFunctionStart(functionName, data);

    try {
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للموافقة على المهام.'
            );
        }

        const userId = auth.uid;
        validateInput(data, ['taskId', 'approved']);
        const { taskId, approved, rejectionReason } = data;

        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (!taskDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'المهمة غير موجودة.');
        }
        const taskData = taskDoc.data();
        if (!taskData?.requiresApproval || taskData.status !== 'pending-approval') {
            throw new functions.https.HttpsError('failed-precondition', 'هذه المهمة لا تتطلب موافقة أو تمت معالجتها بالفعل.');
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'لم يتم العثور على المستخدم.');
        }
        const userData = userDoc.data();
        const canApprove = await checkApprovalPermissions(userData, taskData);
        if (!canApprove) {
            throw new functions.https.HttpsError('permission-denied', 'ليس لديك صلاحية للموافقة على هذه المهمة.');
        }

        const updateData: any = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            approved: approved,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const approverDoc = await db.collection('users').doc(userId).get(); // جلب اسم الموافق
        const approverName = approverDoc.exists ? approverDoc.data()?.name || approverDoc.data()?.displayName || 'مسئول غير معروف' : 'مسئول غير معروف';

        if (approved) {
            updateData.status = 'pending';
            updateData.approvedBy = userId;
            updateData.approvedByName = approverName;
        } else {
            updateData.status = 'cancelled';
            updateData.rejectedBy = userId;
            updateData.rejectedAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.rejectionReason = rejectionReason || 'لم يتم تحديد سبب الرفض';
            updateData.approvedByName = approverName; // Still set approver name on rejection
        }

        await db.collection('tasks').doc(taskId).update(updateData);
        await updatePendingApprovalNotifications(taskId);
        await createApprovalResultNotification(taskData, approved, userId, rejectionReason);

        logFunctionEnd(functionName, { taskId, approved });
        return {
            success: true,
            message: approved ? 'تمت الموافقة على المهمة بنجاح' : 'تم رفض المهمة'
        };

    } catch (error: any) {
        logFunctionError(functionName, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to approve task: ${error.message || 'Unknown error'}`
        );
    }
});

/**
 * إنشاء إشعارات للمسئولين عن المهام المعلقة
 */
async function createApprovalNotifications(taskData: any, organizationId: string): Promise<void> {
    try {
        const approvalLevel = taskData.approvalLevel;
        const departmentId = taskData.departmentId;
        let approversQuery: admin.firestore.Query;

        // تحديد الأدوار التي يمكنها الموافقة على مستوى القسم
        const departmentApprovalRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor'];

        if (approvalLevel === 'department' && departmentId) {
            approversQuery = db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('departmentId', '==', departmentId)
                .where('role', 'in', departmentApprovalRoles); // المشرفون + إدارة المؤسسة ضمن هذا القسم
        } else if (approvalLevel === 'organization') {
            approversQuery = db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('role', 'in', ['isOrgOwner', 'isOrgAdmin']); // مالك وأدمن المؤسسة فقط
        } else {
            console.warn(`[ApprovalNotifications] Invalid approval level or missing departmentId for task ${taskData.id}`);
            return;
        }

        const approversSnapshot = await approversQuery.get();
        const batch = db.batch();
        let notificationCount = 0;

        approversSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            // لا داعي للتحقق من الصلاحيات هنا مرة أخرى، الاستعلام قام بذلك
            const notificationRef = db.collection('notifications').doc();
            const notificationData = {
                userId: doc.id,
                organizationId: organizationId,
                departmentId: approvalLevel === 'department' ? departmentId : null,
                type: 'task_approval_pending',
                title: 'مهمة تحتاج موافقة',
                message: `مهمة جديدة "${taskData.description}" تحتاج موافقتك على مستوى ${approvalLevel === 'department' ? 'القسم' : 'المؤسسة'}`,
                priority: 'medium',
                status: 'unread',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                actionLink: `/org/tasks?taskId=${taskData.id}`, // رابط مباشر للمهمة
                actionText: 'عرض المهمة',
                relatedEntityId: taskData.id,
                relatedEntityType: 'task',
                metadata: {
                    taskId: taskData.id,
                    approvalLevel: approvalLevel,
                    submittedBy: taskData.submittedBy
                }
            };
            batch.set(notificationRef, notificationData);
            notificationCount++;
        });

        if (notificationCount > 0) {
            await batch.commit();
            console.log(`[ApprovalNotifications] Created ${notificationCount} notifications for ${approvalLevel} level approval of task ${taskData.id}`);
        } else {
            console.log(`[ApprovalNotifications] No approvers found for ${approvalLevel} level approval of task ${taskData.id}. Department: ${departmentId}`);
        }

    } catch (error) {
        console.error('[ApprovalNotifications] Error creating notifications:', error);
    }
}

/**
 * إنشاء إشعار لمُرسل المهمة عند الموافقة أو الرفض
 */
async function createApprovalResultNotification(taskData: any, approved: boolean, approverUserId: string, rejectionReason?: string): Promise<void> {
    try {
        const submittedBy = taskData.submittedBy;
        if (!submittedBy) return;

        const notificationData = {
            userId: submittedBy,
            organizationId: taskData.organizationId,
            departmentId: taskData.departmentId || null,
            type: approved ? 'task_approved' : 'task_rejected',
            title: approved ? 'تمت الموافقة على المهمة' : 'تم رفض المهمة',
            message: approved
                ? `تمت الموافقة على مهمتك "${taskData.description}" وأصبحت نشطة الآن`
                : `تم رفض مهمتك "${taskData.description}"${rejectionReason ? `. السبب: ${rejectionReason}` : ''}`,
            priority: approved ? 'medium' : 'high',
            status: 'unread',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            actionLink: `/org/tasks?taskId=${taskData.id}`,
            actionText: 'عرض المهمة',
            relatedEntityId: taskData.id,
            relatedEntityType: 'task',
            metadata: {
                taskId: taskData.id,
                approved: approved,
                approverUserId: approverUserId,
                rejectionReason: rejectionReason || null
            }
        };

        await db.collection('notifications').add(notificationData);
        console.log(`[ApprovalResultNotification] Created ${approved ? 'approval' : 'rejection'} notification for user ${submittedBy} for task ${taskData.id}`);

    } catch (error) {
        console.error('[ApprovalResultNotification] Error creating result notification:', error);
    }
}

/**
 * تحديث إشعارات الموافقة المعلقة عند اتخاذ قرار
 */
async function updatePendingApprovalNotifications(taskId: string): Promise<void> {
    try {
        const notificationsQuery = await db.collection('notifications')
            .where('type', '==', 'task_approval_pending')
            .where('relatedEntityId', '==', taskId)
            .where('status', '==', 'unread')
            .get();

        if (!notificationsQuery.empty) {
            const batch = db.batch();
            notificationsQuery.docs.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'read',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            console.log(`[PendingApprovalNotifications] Updated ${notificationsQuery.size} pending approval notifications for task ${taskId}`);
        }
    } catch (error) {
        console.error('[PendingApprovalNotifications] Error updating pending notifications:', error);
    }
}

/**
 * التحقق من صلاحيات الموافقة
 */
async function checkApprovalPermissions(userData: any, taskData: any): Promise<boolean> {
    const approvalLevel = taskData.approvalLevel;
    const userRole = userData.role;

    // الأدوار التي يمكنها الموافقة على مستوى القسم
    const departmentApprovalRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor'];

    // الأدوار التي يمكنها الموافقة على مستوى المؤسسة
    const orgApprovalRoles = ['isOrgOwner', 'isOrgAdmin'];

    if (approvalLevel === 'department') {
        // للموافقة على مستوى القسم: مشرف القسم أو أعلى، ويجب أن يكون المستخدم في نفس القسم أو يكون مالك/أدمن المؤسسة
        const isApproverRole = departmentApprovalRoles.includes(userRole);
        const isInSameDepartment = userData.departmentId === taskData.departmentId;
        const isOrgAdminOrOwner = orgApprovalRoles.includes(userRole); // مالك أو أدمن المؤسسة يمكنه الموافقة على مهام الأقسام

        return (isApproverRole && isInSameDepartment) || isOrgAdminOrOwner;
    } else if (approvalLevel === 'organization') {
        // للموافقة على مستوى المؤسسة: مالك أو أدمن المؤسسة فقط
        return orgApprovalRoles.includes(userRole) &&
               userData.organizationId === taskData.organizationId;
    }
    return false;
}

/**
 * دالة لجلب المهام المعلقة للموافقة للمستخدم الحالي
 */
export const getPendingApprovalTasksForCurrentUser = createCallableFunction(async (request: CallableRequest) => {
    const { auth } = request;
    const functionName = 'getPendingApprovalTasksForCurrentUser';
    logFunctionStart(functionName);

    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول لعرض المهام المعلقة للموافقة.');
    }

    const userClaims = auth.token; // Custom claims are available in auth.token

    try {
        let tasksQuery: admin.firestore.Query;

        // إذا كان المستخدم مالك أو أدمن المؤسسة، يرون جميع مهام المؤسسة المعلقة
        if (userClaims.isOrgOwner || userClaims.isOrgAdmin) {
            tasksQuery = db.collection('tasks')
                .where('status', '==', 'pending-approval')
                .where('requiresApproval', '==', true)
                .where('organizationId', '==', userClaims.organizationId)
                .orderBy('submittedAt', 'desc');
        } else if (userClaims.isOrgSupervisor && userClaims.departmentId) {
            // إذا كان مشرف قسم، يرى مهام قسمه فقط التي تتطلب موافقة قسم
            tasksQuery = db.collection('tasks')
                .where('status', '==', 'pending-approval')
                .where('requiresApproval', '==', true)
                .where('organizationId', '==', userClaims.organizationId)
                .where('approvalLevel', '==', 'department')
                .where('departmentId', '==', userClaims.departmentId)
                .orderBy('submittedAt', 'desc');
        } else {
            // الأدوار الأخرى لا ترى أي مهام للموافقة عبر هذه الدالة
            logFunctionEnd(functionName, { tasks: [] });
            return { tasks: [] };
        }

        const snapshot = await tasksQuery.get();
        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logFunctionEnd(functionName, { count: tasks.length });
        return { tasks };

    } catch (error: any) {
        logFunctionError(functionName, error);
        throw new functions.https.HttpsError('internal', `Failed to get pending approval tasks: ${error.message || 'Unknown error'}`);
    }
});

    