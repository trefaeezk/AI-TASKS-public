/**
 * وظائف Firebase لإدارة طلبات إنشاء المؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db, ensureAuthenticated } from '../shared/utils';
// تم حذف v1-compatibility - لم يعد مطلوب
import { createCallableFunction } from '../shared/function-utils';
import { CallableRequest } from '../shared/types';

/**
 * نوع بيانات طلب إنشاء مؤسسة جديدة
 */
interface RequestOrganizationRequest {
    name: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
}

/**
 * إرسال طلب لإنشاء مؤسسة جديدة
 */
export const requestOrganization = createCallableFunction<RequestOrganizationRequest>(async (request: CallableRequest<RequestOrganizationRequest>) => {
    const { data, auth } = request;
    const functionName = 'requestOrganization';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لإرسال طلب إنشاء مؤسسة.'
            );
        }
        const uid = auth.uid;

        // التحقق من صحة المدخلات
        const { name, description, contactEmail, contactPhone } = data;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير اسم صالح للمؤسسة.'
            );
        }

        // الحصول على معلومات المستخدم
        const userRecord = await admin.auth().getUser(uid);

        // التحقق من عدم وجود طلب معلق للمستخدم نفسه
        const existingRequestsQuery = await db.collection('organizationRequests')
            .where('userId', '==', uid)
            .where('status', '==', 'pending')
            .get();

        if (!existingRequestsQuery.empty) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'لديك طلب إنشاء مؤسسة معلق بالفعل. يرجى الانتظار حتى تتم معالجة طلبك الحالي.'
            );
        }

        // إنشاء طلب جديد
        const requestData = {
            name: name.trim(),
            description: description || '',
            contactEmail: contactEmail || userRecord.email,
            contactPhone: contactPhone || '',
            userId: uid,
            userName: userRecord.displayName || '',
            userEmail: userRecord.email,
            status: 'pending', // pending, approved, rejected
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // حفظ الطلب في Firestore
        const requestRef = await db.collection('organizationRequests').add(requestData);

        console.log(`Organization request created with ID: ${requestRef.id}`);

        // إرسال إشعار للمسؤولين (يمكن تنفيذه لاحقًا)
        // TODO: إرسال إشعار للمسؤولين

        return {
            success: true,
            requestId: requestRef.id
        };
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to create organization request: ${error.message || 'Unknown error'}`
        );
    }
});

/**
 * نوع بيانات طلب الموافقة على طلب إنشاء مؤسسة
 */
interface ApproveOrganizationRequestRequest {
    requestId: string;
}

/**
 * الموافقة على طلب إنشاء مؤسسة
 */
export const approveOrganizationRequest = createCallableFunction<ApproveOrganizationRequestRequest>(async (request: CallableRequest<ApproveOrganizationRequestRequest>) => {
    const { data, auth } = request;
    const functionName = 'approveOrganizationRequest';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من أن المستخدم مسؤول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للموافقة على طلب إنشاء مؤسسة.'
            );
        }
        const uid = auth.uid;

        // التحقق من أن المستخدم مالك النظام (الأدوار الجديدة فقط)
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        const isSystemOwner = customClaims.isSystemOwner === true;

        if (!isSystemOwner) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'يجب أن تكون مالك النظام للموافقة على طلبات إنشاء المؤسسات.'
            );
        }

        // التحقق من صحة المدخلات
        const { requestId } = data;

        if (!requestId || typeof requestId !== 'string') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير معرف طلب صالح.'
            );
        }

        // الحصول على الطلب
        const requestDoc = await db.collection('organizationRequests').doc(requestId).get();

        if (!requestDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'الطلب غير موجود.'
            );
        }

        const requestData = requestDoc.data();

        if (requestData?.status !== 'pending') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'لا يمكن الموافقة على طلب تمت معالجته بالفعل.'
            );
        }

        // إنشاء المؤسسة
        const organizationData = {
            name: requestData.name,
            description: requestData.description,
            createdBy: requestData.userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const organizationRef = await db.collection('organizations').add(organizationData);
        const organizationId = organizationRef.id;

        // إضافة المستخدم كمالك للمؤسسة (الدور الجديد)
        await db.collection('organizations').doc(organizationId).collection('members').doc(requestData.userId).set({
            role: 'org_owner',
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // تحديث حالة الطلب
        await db.collection('organizationRequests').doc(requestId).update({
            status: 'approved',
            organizationId,
            approvedBy: uid,
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // تحديث custom claims للمستخدم
        const requesterRecord = await admin.auth().getUser(requestData.userId);

        // تعيين المستخدم كمالك في المؤسسة (النمط الجديد is* فقط)
        const newClaims = {
            role: 'isOrgOwner',
            accountType: 'organization',
            organizationId,
            // النمط الجديد is* فقط - بدون أي توافق قديم
            isSystemOwner: false,
            isSystemAdmin: false,
            isOrgOwner: true,
            isOrgAdmin: false,
            isOrgSupervisor: false,
            isOrgEngineer: false,
            isOrgTechnician: false,
            isOrgAssistant: false,
            isIndependent: false
        };

        console.log(`Setting custom claims for organization creator (${requestData.userId}):`, newClaims);
        await admin.auth().setCustomUserClaims(requestData.userId, newClaims);

        // إنشاء وثيقة المستخدم في مجموعة users إذا لم تكن موجودة
        const userDocRef = db.collection('users').doc(requestData.userId);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            await userDocRef.set({
                name: requesterRecord.displayName || '',
                email: requesterRecord.email,
                role: 'isOrgOwner',
                // النمط الجديد is* فقط - بدون أي توافق قديم
                isSystemOwner: false,
                isSystemAdmin: false,
                isOrgOwner: true,
                isOrgAdmin: false,
                isOrgSupervisor: false,
                isOrgEngineer: false,
                isOrgTechnician: false,
                isOrgAssistant: false,
                isIndependent: false,
                accountType: 'organization',
                organizationId,
                organizationName: organizationData.name,
                customPermissions: [],
                disabled: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Created user document for organization creator (${requestData.userId})`);
        } else {
            await userDocRef.update({
                role: 'isOrgOwner',
                // النمط الجديد is* فقط - بدون أي توافق قديم
                isSystemOwner: false,
                isSystemAdmin: false,
                isOrgOwner: true,
                isOrgAdmin: false,
                isOrgSupervisor: false,
                isOrgEngineer: false,
                isOrgTechnician: false,
                isOrgAssistant: false,
                isIndependent: false,
                accountType: 'organization',
                organizationId,
                organizationName: organizationData.name,
                // حذف جميع الأنماط القديمة نهائياً
                isAdmin: admin.firestore.FieldValue.delete(),
                isOwner: admin.firestore.FieldValue.delete(),
                admin: admin.firestore.FieldValue.delete(),
                owner: admin.firestore.FieldValue.delete(),
                system_owner: admin.firestore.FieldValue.delete(),
                system_admin: admin.firestore.FieldValue.delete(),
                org_owner: admin.firestore.FieldValue.delete(),
                org_admin: admin.firestore.FieldValue.delete(),
                org_supervisor: admin.firestore.FieldValue.delete(),
                org_engineer: admin.firestore.FieldValue.delete(),
                org_technician: admin.firestore.FieldValue.delete(),
                org_assistant: admin.firestore.FieldValue.delete(),
                independent: admin.firestore.FieldValue.delete(),
                canManageSystem: admin.firestore.FieldValue.delete(),
                canManageUsers: admin.firestore.FieldValue.delete(),
                canManageOrganization: admin.firestore.FieldValue.delete(),
                canManageProjects: admin.firestore.FieldValue.delete(),
                canViewReports: admin.firestore.FieldValue.delete(),
                canCreateTasks: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Updated user document for organization creator (${requestData.userId})`);
        }

        // إرسال إشعار للمستخدم (يمكن تنفيذه لاحقًا)
        // TODO: إرسال إشعار للمستخدم

        return {
            success: true,
            organizationId
        };
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to approve organization request: ${error.message || 'Unknown error'}`
        );
    }
});

/**
 * نوع بيانات طلب رفض طلب إنشاء مؤسسة
 */
interface RejectOrganizationRequestRequest {
    requestId: string;
    reason?: string;
}

/**
 * رفض طلب إنشاء مؤسسة
 */
export const rejectOrganizationRequest = createCallableFunction<RejectOrganizationRequestRequest>(async (request: CallableRequest<RejectOrganizationRequestRequest>) => {
    const { data, auth } = request;
    const functionName = 'rejectOrganizationRequest';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من أن المستخدم مسؤول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لرفض طلب إنشاء مؤسسة.'
            );
        }
        const uid = auth.uid;

        // التحقق من أن المستخدم مالك النظام (الأدوار الجديدة فقط)
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        const isSystemOwner = customClaims.isSystemOwner === true;

        if (!isSystemOwner) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'يجب أن تكون مالك النظام لرفض طلبات إنشاء المؤسسات.'
            );
        }

        // التحقق من صحة المدخلات
        const { requestId, reason } = data;

        if (!requestId || typeof requestId !== 'string') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير معرف طلب صالح.'
            );
        }

        // الحصول على الطلب
        const requestDoc = await db.collection('organizationRequests').doc(requestId).get();

        if (!requestDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'الطلب غير موجود.'
            );
        }

        const requestData = requestDoc.data();

        if (requestData?.status !== 'pending') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'لا يمكن رفض طلب تمت معالجته بالفعل.'
            );
        }

        // تحديث حالة الطلب
        await db.collection('organizationRequests').doc(requestId).update({
            status: 'rejected',
            rejectionReason: reason || '',
            rejectedBy: uid,
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // إرسال إشعار للمستخدم (يمكن تنفيذه لاحقًا)
        // TODO: إرسال إشعار للمستخدم

        return {
            success: true
        };
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to reject organization request: ${error.message || 'Unknown error'}`
        );
    }
});
