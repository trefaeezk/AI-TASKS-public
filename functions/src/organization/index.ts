/**
 * وظائف Firebase للمؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { db } from '../shared/utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { ensureOrgAdmin, ensureOrgMembership, ensureCanInviteToOrganization } from './utils';
import { createCallableFunction } from '../shared/function-utils';
import { v1Functions } from '../shared/v1-compatibility';

// تصدير وظائف طلبات إنشاء المؤسسات
export * from './requests';

// تصدير وظائف دعوات المؤسسات
export * from './invitations';

// تصدير وظائف إدارة الحسابات
export * from './account';

// تصدير وظائف إدارة الأعضاء
export * from './members';

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

// تكوين CORS
const corsHandler = cors({ origin: true });

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

        // إضافة المستخدم الحالي كمسؤول في المؤسسة
        await db.collection('organizations').doc(orgId).collection('members').doc(uid).set({
            role: 'admin',
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
 * نوع بيانات طلب إضافة عضو إلى المؤسسة
 */
interface AddOrganizationMemberRequest {
    orgId: string;
    userId: string;
    role: string;
}

/**
 * إضافة عضو إلى المؤسسة
 */
export const addOrganizationMember = createCallableFunction<AddOrganizationMemberRequest>(async (request) => {
    const data = request.data;
    const context = {
        auth: request.auth ? {
            uid: request.auth.uid,
            token: request.auth.token
        } : undefined,
        rawRequest: request.rawRequest
    };
    const functionName = 'addOrganizationMember';
    console.log(`[Organization] --- ${functionName} Cloud Function triggered ---`);

    try {
        const { orgId, userId, role } = data;

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

        const validRoles = ['admin', 'engineer', 'supervisor', 'technician', 'assistant', 'user'];
        if (!role || typeof role !== "string" || !validRoles.includes(role)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `يجب توفير دور صالح. الأدوار الصالحة هي: ${validRoles.join(', ')}`
            );
        }

        // التحقق من أن المستخدم يملك صلاحيات إضافة أعضاء في المؤسسة
        await ensureCanInviteToOrganization(context, orgId);

        // التحقق من وجود المستخدم
        try {
            await admin.auth().getUser(userId);
        } catch (error) {
            throw new functions.https.HttpsError(
                "not-found",
                "لم يتم العثور على المستخدم."
            );
        }

        // التحقق من وجود المؤسسة
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (!orgDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "لم يتم العثور على المؤسسة."
            );
        }

        // إضافة المستخدم كعضو في المؤسسة
        await db.collection('organizations').doc(orgId).collection('members').doc(userId).set({
            role,
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Organization] Successfully added user ${userId} to organization ${orgId} with role ${role}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[Organization] Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to add organization member: ${error.message || 'Unknown internal server error.'}`
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
                .where('role', '==', 'admin').get();

            if (adminsSnapshot.size <= 1) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "لا يمكن إزالة المدير الوحيد من المؤسسة."
                );
            }
        }

        // إزالة المستخدم من المؤسسة
        await db.collection('organizations').doc(orgId).collection('members').doc(userId).delete();

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
 * دالة HTTP لجلب أعضاء المؤسسة
 * تتطلب أن يكون المستدعي عضوًا في المؤسسة
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد واستخدام getOrganizationMembers بدلاً منها
 */
// export const getOrganizationMembersHttp = functions.https.onRequest(async (req, res) => {
//     // تم تعطيل هذه الوظيفة مؤقتًا لتقليل استهلاك الموارد
//     // استخدم getOrganizationMembers بدلاً منها
// });