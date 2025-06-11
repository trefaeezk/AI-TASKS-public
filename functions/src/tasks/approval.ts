/**
 * وظائف Firebase لإدارة موافقة المهام
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared/utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { createCallableFunction } from '../shared/function-utils';
import { CallableRequest } from '../shared/types';

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
            // التحقق من نوع الدور
            const isAdminRole = userData?.role === 'isOrgOwner' || userData?.role === 'isOrgAdmin';

            if (isAdminRole) {
                // للأدوار الإدارية: يجب تحديد قسم يدوياً
                finalDepartmentId = departmentId || null;
                if (!finalDepartmentId) {
                    throw new functions.https.HttpsError(
                        'permission-denied',
                        'يجب اختيار قسم لإنشاء مهمة على مستوى القسم.'
                    );
                }
            } else {
                // للأدوار غير الإدارية: استخدام قسمهم الحالي تلقائياً
                finalDepartmentId = userData?.departmentId || null;
                if (!finalDepartmentId) {
                    throw new functions.https.HttpsError(
                        'permission-denied',
                        'يجب أن تكون عضواً في قسم لإنشاء مهام على مستوى القسم.'
                    );
                }
            }

            // التحقق من صلاحيات إنشاء مهام القسم
            const departmentTaskRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer', 'isOrgTechnician'];
            if (!departmentTaskRoles.includes(userData?.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'ليس لديك صلاحية لإنشاء مهام على مستوى القسم.'
                );
            }
        } else if (approvalLevel === 'organization') {
            // للمهام على مستوى المؤسسة، يجب أن يكون المستخدم مسئول قسم على الأقل
            const allowedRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer'];
            if (!allowedRoles.includes(userData?.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'ليس لديك صلاحية لإنشاء مهام على مستوى المؤسسة.'
                );
            }
        }

        // جلب أسماء إضافية للمهمة
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

        // معالجة نقاط التتبع
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

        // إنشاء المهمة مع حالة pending-approval
        const taskData = {
            userId: userId, // إضافة userId المطلوب
            description: title,
            details: description || '',
            status: 'pending-approval',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            startDate: startDate ? admin.firestore.Timestamp.fromMillis(startDate.seconds * 1000) : null,
            dueDate: dueDate ? admin.firestore.Timestamp.fromMillis(dueDate.seconds * 1000) : null,
            priority: priority || 'medium',
            priorityReason: null, // إضافة priorityReason
            assignedToUserId: assignedToUserId || null,
            assigneeName: assigneeName,
            departmentId: finalDepartmentId || null,
            departmentName: departmentName,
            taskCategoryName: categoryName || null,
            organizationId,
            taskContext: approvalLevel === 'department' ? 'department' : 'organization',
            accountType: 'organization', // المهام التي تتطلب موافقة هي دائماً مهام مؤسسة
            order: Date.now(),

            // نقاط التتبع والمدة
            milestones: processedMilestones,
            durationValue: durationValue || null,
            durationUnit: durationUnit || null,

            // حقول الموافقة
            requiresApproval: true,
            approvalLevel: approvalLevel,
            submittedBy: userId,
            submittedByName: userData?.name || userData?.displayName || 'مستخدم غير معروف',
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            notes: notes || null
        };

        // إضافة المهمة إلى قاعدة البيانات
        const taskRef = await db.collection('tasks').add(taskData);

        // إنشاء إشعارات للمسئولين
        await createApprovalNotifications({
            ...taskData,
            id: taskRef.id
        }, organizationId);

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
        // التحقق من تسجيل الدخول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للموافقة على المهام.'
            );
        }

        const userId = auth.uid;

        // التحقق من البيانات المطلوبة
        validateInput(data, ['taskId', 'approved']);

        const { taskId, approved, rejectionReason } = data;

        // جلب بيانات المهمة
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (!taskDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'المهمة غير موجودة.'
            );
        }

        const taskData = taskDoc.data();
        
        // التحقق من أن المهمة تتطلب موافقة
        if (!taskData?.requiresApproval || taskData.status !== 'pending-approval') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'هذه المهمة لا تتطلب موافقة أو تمت معالجتها بالفعل.'
            );
        }

        // التحقق من صلاحيات الموافقة
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'لم يتم العثور على المستخدم.'
            );
        }

        const userData = userDoc.data();
        const canApprove = await checkApprovalPermissions(userData, taskData);
        
        if (!canApprove) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'ليس لديك صلاحية للموافقة على هذه المهمة.'
            );
        }

        // تحديث المهمة
        const updateData: any = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            approved: approved, // حفظ نتيجة الموافقة
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (approved) {
            updateData.status = 'pending'; // تحويل إلى مهمة عادية
            updateData.approvedBy = userId;
            // جلب اسم المسئول
            const approverDoc = await db.collection('users').doc(userId).get();
            if (approverDoc.exists) {
                updateData.approvedByName = approverDoc.data()?.name || approverDoc.data()?.displayName || 'مسئول غير معروف';
            }
        } else {
            updateData.status = 'cancelled'; // رفض المهمة
            updateData.rejectedBy = userId;
            updateData.rejectedAt = admin.firestore.FieldValue.serverTimestamp();
            updateData.rejectionReason = rejectionReason || 'لم يتم تحديد سبب الرفض';
            // جلب اسم المسئول
            const approverDoc = await db.collection('users').doc(userId).get();
            if (approverDoc.exists) {
                updateData.approvedByName = approverDoc.data()?.name || approverDoc.data()?.displayName || 'مسئول غير معروف';
            }
        }

        await db.collection('tasks').doc(taskId).update(updateData);

        // تحديث إشعارات الموافقة المعلقة (تحويلها إلى مقروءة)
        await updatePendingApprovalNotifications(taskId);

        // إنشاء إشعار لمُرسل المهمة
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

        // جلب المسئولين المناسبين حسب مستوى الموافقة
        let approversQuery;

        if (approvalLevel === 'department' && departmentId) {
            // للمهام على مستوى القسم: مشرفو ومهندسو القسم + إدارة المؤسسة
            approversQuery = db.collection('users')
                .where('organizationId', '==', organizationId)
                .where('departmentId', '==', departmentId);
        } else if (approvalLevel === 'organization') {
            // للمهام على مستوى المؤسسة: مالك وأدمن المؤسسة فقط
            approversQuery = db.collection('users')
                .where('organizationId', '==', organizationId);
        } else {
            return; // مستوى موافقة غير صحيح
        }

        const approversSnapshot = await approversQuery.get();

        // إنشاء إشعارات للمسئولين المناسبين
        const batch = db.batch();

        approversSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            const userRole = userData.role;

            // التحقق من صلاحيات الموافقة
            let canApprove = false;

            if (approvalLevel === 'department') {
                const departmentApprovalRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer'];
                canApprove = departmentApprovalRoles.includes(userRole);
            } else if (approvalLevel === 'organization') {
                const orgApprovalRoles = ['isOrgOwner', 'isOrgAdmin'];
                canApprove = orgApprovalRoles.includes(userRole);
            }

            if (canApprove) {
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
                    actionLink: `/org/tasks`,
                    actionText: 'عرض المهام',
                    relatedEntityId: taskData.id,
                    relatedEntityType: 'task',
                    metadata: {
                        taskId: taskData.id,
                        approvalLevel: approvalLevel,
                        submittedBy: taskData.submittedBy
                    }
                };

                batch.set(notificationRef, notificationData);
            }
        });

        await batch.commit();
        console.log(`[Approval] Created notifications for ${approvalLevel} level approval`);

    } catch (error) {
        console.error('[Approval] Error creating notifications:', error);
        // لا نرمي خطأ هنا لأن فشل الإشعارات لا يجب أن يوقف إنشاء المهمة
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
            actionLink: `/org/tasks`,
            actionText: 'عرض المهام',
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
        console.log(`[Approval] Created ${approved ? 'approval' : 'rejection'} notification for user ${submittedBy}`);

    } catch (error) {
        console.error('[Approval] Error creating result notification:', error);
    }
}

/**
 * تحديث إشعارات الموافقة المعلقة عند اتخاذ قرار
 */
async function updatePendingApprovalNotifications(taskId: string): Promise<void> {
    try {
        // البحث عن جميع الإشعارات المتعلقة بهذه المهمة
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
            console.log(`[Approval] Updated ${notificationsQuery.size} pending approval notifications for task ${taskId}`);
        }

    } catch (error) {
        console.error('[Approval] Error updating pending notifications:', error);
        // لا نرمي خطأ هنا لأن فشل تحديث الإشعارات لا يجب أن يوقف العملية
    }
}

/**
 * التحقق من صلاحيات الموافقة
 */
async function checkApprovalPermissions(userData: any, taskData: any): Promise<boolean> {
    const approvalLevel = taskData.approvalLevel;
    const userRole = userData.role;

    if (approvalLevel === 'department') {
        // للموافقة على مستوى القسم: مشرف القسم أو أعلى
        const departmentApprovalRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer'];
        return departmentApprovalRoles.includes(userRole) &&
               userData.departmentId === taskData.departmentId;
    } else if (approvalLevel === 'organization') {
        // للموافقة على مستوى المؤسسة: مالك أو أدمن المؤسسة فقط
        const orgApprovalRoles = ['isOrgOwner', 'isOrgAdmin'];
        return orgApprovalRoles.includes(userRole) &&
               userData.organizationId === taskData.organizationId;
    }

    return false;
}
