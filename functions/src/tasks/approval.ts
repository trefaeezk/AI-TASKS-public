
/**
 * وظائف Firebase لإدارة موافقة المهام
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared/utils'; // Correct import for Admin SDK Firestore instance
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { createCallableFunction } from '../shared/function-utils';
import { CallableRequest } from '../shared/types';
// Removed client-side imports

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
    assignedToUserIds?: string[]; // For multiple assignees
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
    requiresApproval?: boolean; // Added to determine if approval is actually needed
    taskContext?: 'department' | 'organization' | 'individual'; // Added this line
}

/**
 * إنشاء إشعار للمكلفين بالمهمة
 */
async function sendTaskAssignmentNotification(
    taskData: {
        id: string;
        description: string;
        organizationId: string;
        departmentId?: string | null;
        approvalLevel?: string;
    },
    assigneeUids: string[]
): Promise<void> {
    if (!assigneeUids || assigneeUids.length === 0) {
        console.log(`[sendTaskAssignmentNotification] No assignees for task ${taskData.id}, skipping notification.`);
        return;
    }

    const batch = db.batch();
    let notificationCount = 0;

    for (const assigneeUid of assigneeUids) {
        const notificationRef = db.collection('notifications').doc(); // Auto-generate ID
        const notificationPayload = {
            userId: assigneeUid,
            organizationId: taskData.organizationId,
            departmentId: taskData.departmentId || null,
            type: 'task_assigned' as const,
            title: 'تم إسناد مهمة جديدة إليك',
            message: `مهمة "${taskData.description}" تم إسنادها إليك.`,
            priority: 'medium' as const,
            status: 'unread' as const,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            actionLink: `/org/tasks?taskId=${taskData.id}`,
            actionText: 'عرض المهمة',
            relatedEntityId: taskData.id,
            relatedEntityType: 'task' as const,
            metadata: {
                taskId: taskData.id,
                approvalLevel: taskData.approvalLevel,
            }
        };
        batch.set(notificationRef, notificationPayload);
        notificationCount++;
    }

    if (notificationCount > 0) {
        await batch.commit();
        console.log(`[sendTaskAssignmentNotification] Created ${notificationCount} assignment notifications for task ${taskData.id}.`);
    }
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
            // approvalLevel is only required if requiresApproval is true
        ]);

        const {
            title,
            description,
            startDate,
            dueDate,
            priority,
            assignedToUserId,
            assignedToUserIds,
            departmentId,
            categoryName,
            organizationId,
            approvalLevel, // This dictates where the approval request goes
            notes,
            milestones,
            durationValue,
            durationUnit,
            requiresApproval = false, // Default to false if not provided
            taskContext // This is now available from the interface
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

        let finalDepartmentId: string | null = null;
        // Use approvalLevel if requiresApproval is true, otherwise use taskContext from data
        const effectiveContext = requiresApproval ? approvalLevel : taskContext;

        if (effectiveContext === 'department') {
            finalDepartmentId = departmentId || userData?.departmentId || null;
            if (!finalDepartmentId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'يجب تحديد القسم للمهام على مستوى القسم.'
                );
            }
        }


        let assigneeName = null;

        if (assignedToUserId) {
            const assigneeDoc = await db.collection('users').doc(assignedToUserId).get();
            if (assigneeDoc.exists) {
                assigneeName = assigneeDoc.data()?.name || assigneeDoc.data()?.displayName || 'مستخدم غير معروف';
            }
        }

        let departmentName = null;
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

        const taskDataForFirestore: any = {
            userId: userId,
            description: title,
            details: description || '',
            status: requiresApproval ? 'pending-approval' : 'pending', // Set to pending if no approval needed
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            startDate: startDate ? admin.firestore.Timestamp.fromMillis(startDate.seconds * 1000) : null,
            dueDate: dueDate ? admin.firestore.Timestamp.fromMillis(dueDate.seconds * 1000) : null,
            priority: priority || 'medium',
            priorityReason: null,
            assignedToUserId: assignedToUserId || null,
            assignedToUserIds: assignedToUserIds || null,
            assigneeName: assigneeName,
            departmentId: finalDepartmentId,
            departmentName: departmentName,
            taskCategoryName: categoryName || null,
            organizationId,
            taskContext: requiresApproval ? (approvalLevel === 'department' ? 'department' : 'organization') : (taskContext || 'individual'),
            accountType: 'organization',
            order: Date.now(),
            milestones: processedMilestones,
            durationValue: durationValue || null,
            durationUnit: durationUnit || null,
            requiresApproval: requiresApproval,
            approvalLevel: requiresApproval ? approvalLevel : null, // Only set if approval is required
            submittedBy: requiresApproval ? userId : null,
            submittedByName: requiresApproval ? (userData?.name || userData?.displayName || 'مستخدم غير معروف') : null,
            submittedAt: requiresApproval ? admin.firestore.FieldValue.serverTimestamp() : null,
            notes: notes || null
        };

        const taskRef = await db.collection('tasks').add(taskDataForFirestore);

        if (requiresApproval) {
            await createApprovalNotifications({ ...taskDataForFirestore, id: taskRef.id }, organizationId);
            // Removed toast call from here
        } else {
            // If no approval is needed, send assignment notifications directly
            const assignees = taskDataForFirestore.assignedToUserIds || (taskDataForFirestore.assignedToUserId ? [taskDataForFirestore.assignedToUserId] : []);
            if (assignees.length > 0) {
                await sendTaskAssignmentNotification({ ...taskDataForFirestore, id: taskRef.id }, assignees);
            }
            // Removed toast call from here
        }


        logFunctionEnd(functionName, { taskId: taskRef.id });
        return {
            success: true,
            taskId: taskRef.id,
            message: requiresApproval
                ? `تم إرسال المهمة للموافقة على مستوى ${approvalLevel === 'department' ? 'القسم' : 'المؤسسة'}`
                : 'تم إنشاء المهمة بنجاح'
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

        const taskDocRef = db.collection('tasks').doc(taskId);
        const taskDoc = await taskDocRef.get();

        if (!taskDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'المهمة غير موجودة.');
        }
        const taskData = taskDoc.data() as Task; // Assuming Task type from types/task.ts
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
        const approverDoc = await db.collection('users').doc(userId).get();
        const approverName = approverDoc.exists ? approverDoc.data()?.name || approverDoc.data()?.displayName || 'مسئول غير معروف' : 'مسئول غير معروف';

        if (approved) {
            updateData.status = 'pending'; // Task becomes active pending
            updateData.approvedBy = userId;
            updateData.approvedByName = approverName;
        } else {
            updateData.status = 'cancelled'; // Or another appropriate status for rejected tasks
            updateData.rejectedBy = userId;
            updateData.rejectedAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.rejectionReason = rejectionReason || 'لم يتم تحديد سبب الرفض';
            updateData.approvedByName = approverName; // Keep approver name for rejection as well for consistency
        }

        await taskDocRef.update(updateData);
        await updatePendingApprovalNotifications(taskId);
        await createApprovalResultNotification(taskData, approved, userId, rejectionReason);

        // If approved and assigned, send assignment notification
        if (approved) {
            const finalTaskData = { ...taskData, ...updateData, id: taskId }; // Merge for full task data
            const assignees = finalTaskData.assignedToUserIds || (finalTaskData.assignedToUserId ? [finalTaskData.assignedToUserId] : []);
            if (assignees.length > 0) {
                await sendTaskAssignmentNotification(finalTaskData, assignees);
            }
        }


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
        const departmentIdForTask = taskData.departmentId; // Use departmentId from task
        const notifiedUserIds = new Set<string>();
        const batch = db.batch();
        let notificationCount = 0;

        // 1. Notify department supervisors if department-level approval
        if (approvalLevel === 'department' && departmentIdForTask) {
            const supervisorQuery = db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('departmentId', '==', departmentIdForTask) // Specific department of the task
                .where('isOrgSupervisor', '==', true); // Ensure role field matches what's in custom claims and Firestore

            const supervisorSnapshot = await supervisorQuery.get();
            supervisorSnapshot.docs.forEach(doc => {
                if (!notifiedUserIds.has(doc.id)) {
                    const notificationRef = db.collection('notifications').doc();
                    batch.set(notificationRef, {
                        userId: doc.id, organizationId, departmentId: departmentIdForTask, type: 'task_approval_pending',
                        title: 'مهمة تحتاج موافقة قسم', message: `مهمة "${taskData.description}" تحتاج موافقتك (قسم).`,
                        priority: 'medium', status: 'unread', createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        actionLink: `/org/tasks?taskId=${taskData.id}`, actionText: 'عرض المهمة',
                        relatedEntityId: taskData.id, relatedEntityType: 'task',
                        metadata: { taskId: taskData.id, approvalLevel, submittedBy: taskData.submittedBy }
                    });
                    notifiedUserIds.add(doc.id);
                    notificationCount++;
                }
            });
        }

        // 2. Notify Org Owners and Org Admins for both department and organization level approvals
        // Query for Org Owners
        const orgOwnerQuery = db.collection('users')
            .where('organizationId', '==', organizationId)
            .where('isOrgOwner', '==', true);
        const orgOwnerSnapshot = await orgOwnerQuery.get();

        orgOwnerSnapshot.docs.forEach(doc => {
             if (!notifiedUserIds.has(doc.id)) {
                const notificationRef = db.collection('notifications').doc();
                const title = approvalLevel === 'department'
                    ? `مهمة قسم ("${taskData.departmentName || departmentIdForTask}") تحتاج موافقة`
                    : 'مهمة مؤسسة تحتاج موافقة';
                const message = approvalLevel === 'department'
                    ? `مهمة "${taskData.description}" في قسم "${taskData.departmentName || departmentIdForTask}" تحتاج موافقتك.`
                    : `مهمة "${taskData.description}" تحتاج موافقتك (مؤسسة).`;

                batch.set(notificationRef, {
                    userId: doc.id, organizationId, departmentId: approvalLevel === 'department' ? departmentIdForTask : null,
                    type: 'task_approval_pending', title, message,
                    priority: 'medium', status: 'unread', createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    actionLink: `/org/tasks?taskId=${taskData.id}`, actionText: 'عرض المهمة',
                    relatedEntityId: taskData.id, relatedEntityType: 'task',
                    metadata: { taskId: taskData.id, approvalLevel, submittedBy: taskData.submittedBy }
                });
                notifiedUserIds.add(doc.id);
                notificationCount++;
            }
        });

        // Query for Org Admins
        const orgAdminQuery = db.collection('users')
            .where('organizationId', '==', organizationId)
            .where('isOrgAdmin', '==', true);
        const orgAdminSnapshot = await orgAdminQuery.get();

        orgAdminSnapshot.docs.forEach(doc => {
             if (!notifiedUserIds.has(doc.id)) { // Avoid duplicate notifications
                const notificationRef = db.collection('notifications').doc();
                const title = approvalLevel === 'department'
                    ? `مهمة قسم ("${taskData.departmentName || departmentIdForTask}") تحتاج موافقة`
                    : 'مهمة مؤسسة تحتاج موافقة';
                const message = approvalLevel === 'department'
                    ? `مهمة "${taskData.description}" في قسم "${taskData.departmentName || departmentIdForTask}" تحتاج موافقتك.`
                    : `مهمة "${taskData.description}" تحتاج موافقتك (مؤسسة).`;

                batch.set(notificationRef, {
                    userId: doc.id, organizationId, departmentId: approvalLevel === 'department' ? departmentIdForTask : null,
                    type: 'task_approval_pending', title, message,
                    priority: 'medium', status: 'unread', createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    actionLink: `/org/tasks?taskId=${taskData.id}`, actionText: 'عرض المهمة',
                    relatedEntityId: taskData.id, relatedEntityType: 'task',
                    metadata: { taskId: taskData.id, approvalLevel, submittedBy: taskData.submittedBy }
                });
                notifiedUserIds.add(doc.id);
                notificationCount++;
            }
        });


        if (notificationCount > 0) {
            await batch.commit();
            console.log(`[ApprovalNotifications] Created ${notificationCount} notifications for ${approvalLevel} approval of task ${taskData.id}`);
        } else {
            console.log(`[ApprovalNotifications] No approvers found for ${approvalLevel} approval of task ${taskData.id}. Department: ${departmentIdForTask}`);
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
        const notificationsQuery = db.collection('notifications')
            .where('type', '==', 'task_approval_pending')
            .where('relatedEntityId', '==', taskId)
            .where('status', '==', 'unread');

        const notificationsSnapshot = await notificationsQuery.get();

        if (!notificationsSnapshot.empty) {
            const batch = db.batch();
            notificationsSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'read', // Mark as read instead of deleting
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            console.log(`[PendingApprovalNotifications] Updated ${notificationsSnapshot.size} pending approval notifications for task ${taskId}`);
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
    // Ensure role field matches what's in custom claims and Firestore for user
    const userRole = userData.isOrgOwner ? 'isOrgOwner' :
                     userData.isOrgAdmin ? 'isOrgAdmin' :
                     userData.isOrgSupervisor ? 'isOrgSupervisor' :
                     userData.role; // Fallback to general role if specific flags aren't true

    const userOrganizationId = userData.organizationId;
    const userDepartmentId = userData.departmentId;

    const taskOrganizationId = taskData.organizationId;
    const taskDepartmentId = taskData.departmentId;

    // Basic check: User must belong to the same organization as the task
    if (userOrganizationId !== taskOrganizationId) {
        return false;
    }

    // Org Owners and Admins can approve any task in their organization
    if (userRole === 'isOrgOwner' || userRole === 'isOrgAdmin') {
        return true;
    }

    // Department-level approval
    if (approvalLevel === 'department') {
        // Supervisors can approve tasks in their own department
        if (userRole === 'isOrgSupervisor' && userDepartmentId === taskDepartmentId) {
            return true;
        }
    }
    // Organization-level approval is already covered by OrgOwner/OrgAdmin check

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
                .where('organizationId', '==', userClaims.organizationId) // Filter by user's org
                .orderBy('submittedAt', 'desc');
        } else if (userClaims.isOrgSupervisor && userClaims.departmentId) {
            // إذا كان مشرف قسم، يرى مهام قسمه فقط التي تتطلب موافقة قسم
            tasksQuery = db.collection('tasks')
                .where('status', '==', 'pending-approval')
                .where('requiresApproval', '==', true)
                .where('organizationId', '==', userClaims.organizationId) // Filter by user's org
                .where('approvalLevel', '==', 'department')
                .where('departmentId', '==', userClaims.departmentId) // Filter by user's dept
                .orderBy('submittedAt', 'desc');
        } else {
            // الأدوار الأخرى لا ترى أي مهام للموافقة عبر هذه الدالة
            logFunctionEnd(functionName, { tasks: [] });
            return { tasks: [] };
        }

        const snapshot = await tasksQuery.get();
        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Task) // Cast to Task to resolve spread type error
        }));

        logFunctionEnd(functionName, { count: tasks.length });
        return { tasks };

    } catch (error: any) {
        logFunctionError(functionName, error);
        throw new functions.https.HttpsError('internal', `Failed to get pending approval tasks: ${error.message || 'Unknown error'}`);
    }
});

interface Task {
  id: string;
  description: string;
  status: string;
  // Add other necessary fields from your Task type
  [key: string]: any; // To allow other properties
}

    