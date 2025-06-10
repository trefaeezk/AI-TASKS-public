/**
 * وظائف Firebase للمؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// تم حذف cors - لم يعد مطلوب
import { db } from '../shared/utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { ensureOrgAdmin, ensureOrgMembership, ensureCanInviteToOrganization } from './utils';
import { createCallableFunction } from '../shared/function-utils';
// تم حذف v1-compatibility - لم يعد مطلوب

// تصدير وظائف طلبات إنشاء المؤسسات
export * from './requests';

// تصدير وظائف دعوات المؤسسات
export * from './invitations';

// تصدير وظائف إدارة الحسابات
export * from './account';

// تصدير وظائف إدارة الأعضاء - تم دمجها في هذا الملف

// تصدير وظائف نظام التخطيط السنوي (OKRs)
export * from './okr';
export * from './keyResults';
export * from './taskLinks';

// تصدير وظائف ربط المهام بالنتائج الرئيسية
// استخدام إعادة تصدير محددة لتجنب تضارب الأسماء
import * as taskKeyResultFunctions from './taskKeyResultFunctions';
export {
  getUnlinkedKeyResults,
  getUnlinkedTasks
} from './taskKeyResultFunctions';

export * from './createTaskForKeyResult';

// تصدير وظائف إحصائيات OKR
import * as okrStats from './okrStats';
export {
  getOkrStats,
  exportOkrReport,
  exportOkrToExcel
} from './okrStats';

// تم حذف CORS - لم يعد مطلوب

/**
 * نوع بيانات طلب إنشاء مؤسسة جديدة
 */
interface CreateOrganizationRequest {
    name: string;
    description?: string;
}

/**
 * إنشاء مؤسسة جديدة
 */
export const createOrganization = createCallableFunction<CreateOrganizationRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'createOrganization';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = context.auth.uid;
        const { name, description } = data;

        // التحقق من صحة المدخلات
        if (!name || typeof name !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير اسم المؤسسة."
            );
        }

        // إنشاء وثيقة المؤسسة في Firestore
        const orgRef = db.collection('organizations').doc();
        const orgId = orgRef.id;

        await orgRef.set({
            name,
            description: description || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: uid
        });

        // إضافة المستخدم الحالي كمالك في المؤسسة
        await db.collection('organizations').doc(orgId).collection('members').doc(uid).set({
            role: 'isOrgOwner', // Corrected to isOrgOwner
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Organization] Successfully created organization ${orgId} by user ${uid}.`);
        return { orgId };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to create organization: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب الحصول على معلومات المؤسسة
 */
interface GetOrganizationRequest {
    orgId: string;
}

/**
 * الحصول على معلومات المؤسسة
 */
export const getOrganization = createCallableFunction<GetOrganizationRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'getOrganization';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        const { orgId } = data;

        // التحقق من صحة المدخلات
        if (!orgId || typeof orgId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المؤسسة."
            );
        }

        // التحقق من أن المستخدم عضو في المؤسسة
        await ensureOrgMembership(context, orgId);

        // الحصول على معلومات المؤسسة
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (!orgDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "لم يتم العثور على المؤسسة."
            );
        }

        // إرجاع معلومات المؤسسة
        return {
            id: orgId,
            ...orgDoc.data()
        };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to get organization: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب تحديث معلومات المؤسسة
 */
interface UpdateOrganizationRequest {
    orgId: string;
    name?: string;
    description?: string;
}

/**
 * تحديث معلومات المؤسسة
 */
export const updateOrganization = createCallableFunction<UpdateOrganizationRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'updateOrganization';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        const { orgId, name, description } = data;

        // التحقق من صحة المدخلات
        if (!orgId || typeof orgId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المؤسسة."
            );
        }

        // التحقق من أن المستخدم مدير في المؤسسة
        await ensureOrgAdmin(context, orgId);

        // تحديث معلومات المؤسسة
        const updateData: { [key: string]: any } = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (name !== undefined) {
            updateData.name = name;
        }

        if (description !== undefined) {
            updateData.description = description;
        }

        await db.collection('organizations').doc(orgId).update(updateData);

        console.log(`[Organization] Successfully updated organization ${orgId}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to update organization: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب إزالة عضو من المؤسسة
 */
interface RemoveOrganizationMemberRequest {
    orgId: string;
    userId: string;
}

/**
 * إزالة عضو من المؤسسة
 */
export const removeOrganizationMember = createCallableFunction<RemoveOrganizationMemberRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'removeOrganizationMember';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        const { orgId, userId } = data;

        // التحقق من صحة المدخلات
        if (!orgId || typeof orgId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المؤسسة."
            );
        }

        if (!userId || typeof userId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المستخدم."
            );
        }

        // التحقق من أن المستخدم مدير في المؤسسة
        await ensureOrgAdmin(context, orgId);

        // التحقق من أن المستخدم ليس المدير الوحيد في المؤسسة
        if (context.auth?.uid === userId) {
            const adminsSnapshot = await db.collection('organizations').doc(orgId).collection('members')
                .where('role', '==', 'isOrgAdmin').get();

            if (adminsSnapshot.size <= 1) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "لا يمكن إزالة المدير الوحيد من المؤسسة."
                );
            }
        }

        // الحصول على بيانات المستخدم الحالية
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        // التحقق من وجود عضويات أخرى في مؤسسات أخرى
        const allOrgsSnapshot = await db.collection('organizations').get();
        let hasOtherMemberships = false;

        for (const orgDoc of allOrgsSnapshot.docs) {
            if (orgDoc.id !== orgId) {
                const memberInOtherOrg = await orgDoc.ref.collection('members').doc(userId).get();
                if (memberInOtherOrg.exists) {
                    hasOtherMemberships = true;
                    break;
                }
            }
        }

        // إزالة المستخدم من المؤسسة
        await db.collection('organizations').doc(orgId).collection('members').doc(userId).delete();

        // حذف جميع الدعوات المعلقة للمستخدم في هذه المؤسسة
        const pendingInvitationsQuery = await db.collection('organizationInvitations')
            .where('userId', '==', userId)
            .where('organizationId', '==', orgId)
            .where('status', '==', 'pending')
            .get();

        if (!pendingInvitationsQuery.empty) {
            const batch = db.batch();
            pendingInvitationsQuery.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`[Organization] Deleted ${pendingInvitationsQuery.size} pending invitations for user ${userId} in organization ${orgId}`);
        }

        // حذف الدعوات بناءً على البريد الإلكتروني أيضاً (للحالات التي لم يتم ربط userId بها)
        if (userData?.email) {
            const emailInvitationsQuery = await db.collection('organizationInvitations')
                .where('email', '==', userData.email)
                .where('organizationId', '==', orgId)
                .where('status', '==', 'pending')
                .get();

            if (!emailInvitationsQuery.empty) {
                const batch = db.batch();
                emailInvitationsQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`[Organization] Deleted ${emailInvitationsQuery.size} email-based pending invitations for ${userData.email} in organization ${orgId}`);
            }
        }

        // تحديث بيانات المستخدم في مجموعة users
        if (userData) {
            const updateData: any = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // إذا لم يكن لديه عضويات أخرى، تحويله إلى مستقل
            if (!hasOtherMemberships) {
                updateData.accountType = 'individual';
                updateData.role = 'isIndependent';
                updateData.organizationId = null;
                updateData.organizationName = null; // حذف اسم المؤسسة
                updateData.departmentId = null;
                updateData.isIndependent = true;
                updateData.isOrgOwner = false;
                updateData.isOrgAdmin = false;
                updateData.isOrgSupervisor = false;
                updateData.isOrgEngineer = false;
                updateData.isOrgTechnician = false;
                updateData.isOrgAssistant = false;
            } else {
                // إذا كان لديه عضويات أخرى، إزالة معرف هذه المؤسسة فقط
                if (userData.organizationId === orgId) {
                    updateData.organizationId = null;
                    updateData.organizationName = null; // حذف اسم المؤسسة
                    updateData.departmentId = null;
                }
            }

            await db.collection('users').doc(userId).update(updateData);
        }

        // تحديث Firebase Auth Custom Claims
        try {
            const userRecord = await admin.auth().getUser(userId);
            const currentClaims = userRecord.customClaims || {};

            let newClaims: any = { ...currentClaims };

            if (!hasOtherMemberships) {
                // تحويل إلى مستقل
                newClaims = {
                    ...currentClaims,
                    role: 'isIndependent',
                    accountType: 'individual',
                    organizationId: null,
                    departmentId: null,
                    isIndependent: true,
                    isOrgOwner: false,
                    isOrgAdmin: false,
                    isOrgSupervisor: false,
                    isOrgEngineer: false,
                    isOrgTechnician: false,
                    isOrgAssistant: false
                };
            } else {
                // إزالة معرف هذه المؤسسة فقط
                if (currentClaims.organizationId === orgId) {
                    newClaims.organizationId = null;
                    newClaims.departmentId = null;
                }
            }

            await admin.auth().setCustomUserClaims(userId, newClaims);
            console.log(`[Organization] Updated custom claims for user ${userId}`);
        } catch (claimsError) {
            console.error(`[Organization] Error updating custom claims for user ${userId}:`, claimsError);
            // لا نوقف العملية إذا فشل تحديث Claims
        }

        console.log(`[Organization] Successfully removed user ${userId} from organization ${orgId}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to remove organization member: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

interface UpdateOrganizationMemberRequest {
    orgId: string;
    userId: string;
    role?: string;
    departmentId?: string | null;
}

/**
 * تحديث عضو في المؤسسة
 */
export const updateOrganizationMember = createCallableFunction<UpdateOrganizationMemberRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'updateOrganizationMember';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        const { orgId, userId, role, departmentId } = data;

        // التحقق من صحة المدخلات
        if (!orgId || typeof orgId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المؤسسة."
            );
        }

        if (!userId || typeof userId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المستخدم."
            );
        }

        // التحقق من أن المستخدم يملك صلاحيات تعديل أعضاء في المؤسسة
        await ensureCanInviteToOrganization(context, orgId);

        // التحقق من وجود العضو في المؤسسة
        const memberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(userId).get();
        if (!memberDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "العضو غير موجود في المؤسسة."
            );
        }

        // إعداد البيانات للتحديث
        const updateData: { [key: string]: any } = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (role !== undefined) {
            const validRoles = ['isOrgOwner', 'isOrgAdmin', 'isOrgEngineer', 'isOrgSupervisor', 'isOrgTechnician', 'isOrgAssistant'];
            if (!validRoles.includes(role)) {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    `يجب توفير دور صالح. الأدوار الصالحة هي: ${validRoles.join(', ')}`
                );
            }
            updateData.role = role;
        }

        if (departmentId !== undefined) {
            updateData.departmentId = departmentId;
        }

        // تحديث بيانات العضو في members
        await db.collection('organizations').doc(orgId).collection('members').doc(userId).update(updateData);

        // تحديث بيانات المستخدم في مجموعة users
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userUpdateData: any = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // تحديث الدور إذا تم تغييره
            if (role !== undefined) {
                userUpdateData.role = role;
                // تحديث الأدوار المنطقية
                userUpdateData.isOrgOwner = role === 'isOrgOwner';
                userUpdateData.isOrgAdmin = role === 'isOrgAdmin';
                userUpdateData.isOrgSupervisor = role === 'isOrgSupervisor';
                userUpdateData.isOrgEngineer = role === 'isOrgEngineer';
                userUpdateData.isOrgTechnician = role === 'isOrgTechnician';
                userUpdateData.isOrgAssistant = role === 'isOrgAssistant';
                userUpdateData.isIndependent = false;
            }

            // تحديث معرف القسم إذا تم تغييره
            if (departmentId !== undefined) {
                userUpdateData.departmentId = departmentId;
            }

            // تحديث معرف المؤسسة إذا لم يكن موجوداً
            if (!userData?.organizationId) {
                userUpdateData.organizationId = orgId;
                userUpdateData.accountType = 'organization';
            }

            await db.collection('users').doc(userId).update(userUpdateData);
        }

        // تحديث Firebase Auth Custom Claims
        try {
            const userRecord = await admin.auth().getUser(userId);
            const currentClaims = userRecord.customClaims || {};

            let newClaims: any = { ...currentClaims };

            // تحديث الدور في Claims
            if (role !== undefined) {
                newClaims.role = role;
                newClaims.isOrgOwner = role === 'isOrgOwner';
                newClaims.isOrgAdmin = role === 'isOrgAdmin';
                newClaims.isOrgSupervisor = role === 'isOrgSupervisor';
                newClaims.isOrgEngineer = role === 'isOrgEngineer';
                newClaims.isOrgTechnician = role === 'isOrgTechnician';
                newClaims.isOrgAssistant = role === 'isOrgAssistant';
                newClaims.isIndependent = false;
                newClaims.accountType = 'organization';
            }

            // تحديث معرف القسم في Claims
            if (departmentId !== undefined) {
                newClaims.departmentId = departmentId;
            }

            // تحديث معرف المؤسسة في Claims إذا لم يكن موجوداً
            if (!currentClaims.organizationId) {
                newClaims.organizationId = orgId;
                newClaims.accountType = 'organization';
            }

            await admin.auth().setCustomUserClaims(userId, newClaims);
            console.log(`[Organization] Updated custom claims for user ${userId}`);
        } catch (claimsError) {
            console.error(`[Organization] Error updating custom claims for user ${userId}:`, claimsError);
            // لا نوقف العملية إذا فشل تحديث Claims
        }

        console.log(`[Organization] Successfully updated user ${userId} in organization ${orgId}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to update organization member: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب الحصول على أعضاء المؤسسة
 */
interface GetOrganizationMembersRequest {
    orgId: string;
}

/**
 * الحصول على أعضاء المؤسسة
 */
export const getOrganizationMembers = createCallableFunction<GetOrganizationMembersRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'getOrganizationMembers';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        const { orgId } = data;

        // التحقق من صحة المدخلات
        if (!orgId || typeof orgId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المؤسسة."
            );
        }

        // التحقق من أن المستخدم عضو في المؤسسة
        await ensureOrgMembership(context, orgId);

        // الحصول على أعضاء المؤسسة
        const membersSnapshot = await db.collection('organizations').doc(orgId).collection('members').get();

        // الحصول على معلومات المستخدمين
        const membersPromises = membersSnapshot.docs.map(async (doc) => {
            const userId = doc.id;
            const memberData = doc.data();

            try {
                const userRecord = await admin.auth().getUser(userId);

                return {
                    uid: userId,
                    email: userRecord.email,
                    name: userRecord.displayName,
                    role: memberData.role,
                    joinedAt: memberData.joinedAt
                };
            } catch (error) {
                console.error(`Error getting user ${userId}:`, error);
                return {
                    uid: userId,
                    role: memberData.role,
                    joinedAt: memberData.joinedAt,
                    error: 'User not found'
                };
            }
        });

        const members = await Promise.all(membersPromises);

        return { members };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to get organization members: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب إزالة المستخدم من القسم
 */
interface RemoveUserFromDepartmentRequest {
    orgId: string;
    userId: string;
}

/**
 * إزالة المستخدم من القسم (تحويله إلى فرد بدون قسم)
 */
export const removeUserFromDepartment = createCallableFunction<RemoveUserFromDepartmentRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'removeUserFromDepartment';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        const { orgId, userId } = data;

        // التحقق من صحة المدخلات
        if (!orgId || typeof orgId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المؤسسة."
            );
        }

        if (!userId || typeof userId !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير معرف المستخدم."
            );
        }

        // التحقق من أن المستخدم يملك صلاحيات إدارة أعضاء في المؤسسة
        await ensureCanInviteToOrganization(context, orgId);

        // التحقق من وجود العضو في المؤسسة
        const memberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(userId).get();
        if (!memberDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "العضو غير موجود في المؤسسة."
            );
        }

        // تحديث بيانات العضو في members (إزالة القسم)
        await db.collection('organizations').doc(orgId).collection('members').doc(userId).update({
            departmentId: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // تحديث بيانات المستخدم في مجموعة users
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            await db.collection('users').doc(userId).update({
                departmentId: null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // تحديث Firebase Auth Custom Claims
        try {
            const userRecord = await admin.auth().getUser(userId);
            const currentClaims = userRecord.customClaims || {};

            const newClaims: any = {
                ...currentClaims,
                departmentId: null
            };

            await admin.auth().setCustomUserClaims(userId, newClaims);
            console.log(`[Organization] Updated custom claims for user ${userId} - removed from department`);
        } catch (claimsError) {
            console.error(`[Organization] Error updating custom claims for user ${userId}:`, claimsError);
            // لا نوقف العملية إذا فشل تحديث Claims
        }

        console.log(`[Organization] Successfully removed user ${userId} from department in organization ${orgId}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to remove user from department: ${error.message || 'Unknown internal server error.'}`
        );
    }
});



    