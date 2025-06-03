/**
 * وظائف Firebase لإدارة دعوات المؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db, ensureAuthenticated } from '../shared/utils';
import { canInviteToOrganization, ensureCanInviteToOrganization } from '../shared/organization-utils';
// تم حذف v1-compatibility - لم يعد مطلوب
import { createCallableFunction } from '../shared/function-utils';
import { CallableRequest } from '../shared/types';

/**
 * نوع بيانات طلب دعوة مستخدم للانضمام إلى مؤسسة
 */
interface InviteUserToOrganizationRequest {
    organizationId: string;
    email: string;
    role: string;
    departmentId?: string;
}

/**
 * دعوة مستخدم للانضمام إلى مؤسسة
 */
export const inviteUserToOrganization = createCallableFunction<InviteUserToOrganizationRequest>(async (request: CallableRequest<InviteUserToOrganizationRequest>) => {
    const { data, auth } = request;
    const functionName = 'inviteUserToOrganization';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لدعوة مستخدم للانضمام إلى مؤسسة.'
            );
        }
        const uid = auth.uid;

        // التحقق من صحة المدخلات
        const { organizationId, email, role, departmentId } = data;

        if (!organizationId || typeof organizationId !== 'string') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير معرف مؤسسة صالح.'
            );
        }

        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير بريد إلكتروني صالح.'
            );
        }

        const validRoles = ['org_admin', 'org_engineer', 'org_supervisor', 'org_technician', 'org_assistant'];
        if (!role || typeof role !== 'string' || !validRoles.includes(role)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `يجب توفير دور صالح. الأدوار الصالحة هي: ${validRoles.join(', ')}`
            );
        }

        // التحقق من أن المستخدم يملك صلاحيات دعوة مستخدمين للمؤسسة
        const canInvite = await canInviteToOrganization(uid, organizationId);

        if (!canInvite) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'ليس لديك صلاحيات لدعوة مستخدمين إلى هذه المؤسسة. يجب أن تكون مسؤولاً أو مشرفاً أو مهندساً.'
            );
        }

        // الحصول على معلومات المؤسسة
        const organizationDoc = await db.collection('organizations').doc(organizationId).get();

        if (!organizationDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'المؤسسة غير موجودة.'
            );
        }

        const organizationData = organizationDoc.data();

        // البحث عن المستخدم بواسطة البريد الإلكتروني
        let invitedUserRecord;
        try {
            invitedUserRecord = await admin.auth().getUserByEmail(email);
        } catch (error) {
            // إذا لم يتم العثور على المستخدم، نستمر بإنشاء دعوة بالبريد الإلكتروني فقط
            console.log(`User with email ${email} not found, creating invitation without user ID.`);
        }

        // التحقق من عدم وجود دعوة معلقة للمستخدم نفسه
        const existingInvitationsQuery = await db.collection('organizationInvitations')
            .where('email', '==', email)
            .where('organizationId', '==', organizationId)
            .where('status', '==', 'pending')
            .get();

        if (!existingInvitationsQuery.empty) {
            throw new functions.https.HttpsError(
                'already-exists',
                'هناك دعوة معلقة بالفعل لهذا المستخدم في هذه المؤسسة.'
            );
        }

        // التحقق مما إذا كان المستخدم عضوًا بالفعل في المؤسسة
        if (invitedUserRecord) {
            const memberDoc = await db.collection('organizations').doc(organizationId)
                .collection('members').doc(invitedUserRecord.uid).get();

            if (memberDoc.exists) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    'المستخدم عضو بالفعل في هذه المؤسسة.'
                );
            }
        }

        // إنشاء دعوة جديدة
        const invitationData = {
            organizationId,
            organizationName: organizationData?.name || '',
            email,
            role,
            departmentId: departmentId || null,
            status: 'pending', // pending, accepted, rejected
            invitedBy: uid,
            invitedByName: auth?.token.name || '',
            userId: invitedUserRecord?.uid || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // حفظ الدعوة في Firestore
        const invitationRef = await db.collection('organizationInvitations').add(invitationData);

        console.log(`Organization invitation created with ID: ${invitationRef.id}`);

        // إرسال إيميل الدعوة
        try {
            // استيراد دالة إرسال الإيميل
            const { sendOrganizationInvitationEmail } = await import('../email/index');

            // إنشاء رابط الدعوة
            const invitationUrl = `https://studio--tasks-intelligence.web.app/invitation/${invitationRef.id}`;

            // الحصول على اسم المرسل
            const inviterName = auth?.token?.name || auth?.token?.email || 'مدير المؤسسة';

            // إرسال الإيميل
            const emailSent = await sendOrganizationInvitationEmail(
                email,
                organizationData?.name || 'المؤسسة',
                inviterName,
                role,
                invitationUrl
            );

            if (emailSent) {
                console.log(`✅ Invitation email sent successfully to ${email}`);
            } else {
                console.warn(`⚠️ Failed to send invitation email to ${email}`);
            }
        } catch (emailError) {
            console.error('Error sending invitation email:', emailError);
            // لا نفشل العملية إذا فشل إرسال الإيميل
        }

        return {
            success: true,
            invitationId: invitationRef.id
        };
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to invite user to organization: ${error.message || 'Unknown error'}`
        );
    }
});

/**
 * نوع بيانات طلب جلب معلومات الدعوة العامة
 */
interface GetInvitationInfoRequest {
    invitationId: string;
}

/**
 * جلب معلومات الدعوة العامة (للمستخدمين غير المسجلين)
 * يعرض فقط المعلومات الآمنة والضرورية
 * يتبع نفس نمط listFirebaseUsers
 */
export const getInvitationInfo = createCallableFunction<GetInvitationInfoRequest>(async (request: CallableRequest<GetInvitationInfoRequest>) => {
    const { data } = request;
    const functionName = 'getInvitationInfo';
    console.log(`--- ${functionName} Cloud Function triggered ---`);
    console.log(`Fetching invitation info for ID: ${data.invitationId}`);

    try {
        // التحقق من صحة المدخلات
        const { invitationId } = data;

        if (!invitationId || typeof invitationId !== 'string') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير معرف دعوة صالح.'
            );
        }

        // الحصول على الدعوة
        const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();

        if (!invitationDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'الدعوة غير موجودة أو انتهت صلاحيتها.'
            );
        }

        const invitationData = invitationDoc.data();

        // التحقق من أن الدعوة معلقة
        if (invitationData?.status !== 'pending') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `هذه الدعوة ${invitationData?.status === 'accepted' ? 'تم قبولها بالفعل' : 'تم رفضها بالفعل'}.`
            );
        }

        // جلب معلومات المؤسسة (مثل نمط listFirebaseUsers)
        console.log(`Fetching organization data for ID: ${invitationData.organizationId}`);
        const organizationDoc = await db.collection('organizations').doc(invitationData.organizationId).get();
        const organizationData = organizationDoc.exists ? organizationDoc.data() : null;

        if (!organizationData) {
            console.warn(`Organization ${invitationData.organizationId} not found in Firestore`);
        } else {
            console.log(`Successfully fetched organization: ${organizationData.name}`);
        }

        // جلب معلومات القسم إذا كان محدد (مع معالجة الأخطاء)
        let departmentData: any = null;
        if (invitationData.departmentId) {
            try {
                console.log(`Fetching department data for ID: ${invitationData.departmentId}`);
                const departmentDoc = await db.collection('organizations')
                    .doc(invitationData.organizationId)
                    .collection('departments')
                    .doc(invitationData.departmentId)
                    .get();

                if (departmentDoc.exists) {
                    const docData = departmentDoc.data();
                    if (docData) {
                        departmentData = docData;
                        console.log(`Successfully fetched department: ${departmentData.name}`);
                    }
                } else {
                    console.warn(`Department ${invitationData.departmentId} not found`);
                }
            } catch (departmentError) {
                console.error(`Error fetching department ${invitationData.departmentId}:`, departmentError);
                // لا نفشل العملية إذا فشل جلب القسم
            }
        }

        // إرجاع المعلومات الآمنة فقط (مثل نمط listFirebaseUsers)
        const result = {
            success: true,
            invitation: {
                id: invitationId,
                email: invitationData.email,
                role: invitationData.role,
                status: invitationData.status,
                invitedByName: invitationData.invitedByName || 'مدير المؤسسة',
                createdAt: invitationData.createdAt,
                departmentId: invitationData.departmentId || null
            },
            organization: {
                id: invitationData.organizationId,
                name: organizationData?.name || 'مؤسسة غير معروفة',
                description: organizationData?.description || null,
                type: organizationData?.type || null,
                website: organizationData?.website || null
            },
            department: departmentData ? {
                id: invitationData.departmentId,
                name: departmentData.name || 'قسم غير معروف',
                description: departmentData.description || null
            } : null
        };

        console.log(`Successfully processed invitation info for ${invitationData.email}`);
        return result;
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to get invitation info: ${error.message || 'Unknown error'}`
        );
    }
});

/**
 * نوع بيانات طلب قبول دعوة للانضمام إلى مؤسسة
 */
interface AcceptOrganizationInvitationRequest {
    invitationId: string;
}

/**
 * قبول دعوة للانضمام إلى مؤسسة
 */
export const acceptOrganizationInvitation = createCallableFunction<AcceptOrganizationInvitationRequest>(async (request: CallableRequest<AcceptOrganizationInvitationRequest>) => {
    const { data, auth } = request;
    const functionName = 'acceptOrganizationInvitation';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لقبول دعوة الانضمام إلى مؤسسة.'
            );
        }
        const uid = auth.uid;

        // التحقق من صحة المدخلات
        const { invitationId } = data;

        if (!invitationId || typeof invitationId !== 'string') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير معرف دعوة صالح.'
            );
        }

        // الحصول على الدعوة
        const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();

        if (!invitationDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'الدعوة غير موجودة.'
            );
        }

        const invitationData = invitationDoc.data();

        // التحقق من أن الدعوة للمستخدم الحالي
        if (invitationData?.userId && invitationData.userId !== uid) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'هذه الدعوة ليست لك.'
            );
        }

        // التحقق من أن البريد الإلكتروني للدعوة يتطابق مع بريد المستخدم
        const userRecord = await admin.auth().getUser(uid);
        if (invitationData?.email !== userRecord.email) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'هذه الدعوة ليست لبريدك الإلكتروني.'
            );
        }

        // التحقق من أن الدعوة معلقة
        if (invitationData?.status !== 'pending') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'لا يمكن قبول دعوة تمت معالجتها بالفعل.'
            );
        }

        // إضافة المستخدم كعضو في المؤسسة
        await db.collection('organizations').doc(invitationData.organizationId)
            .collection('members').doc(uid).set({
                role: invitationData.role,
                email: userRecord.email,
                name: userRecord.displayName || '',
                joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                invitationId: invitationId
            });

        // تحديث حالة الدعوة
        await db.collection('organizationInvitations').doc(invitationId).update({
            status: 'accepted',
            userId: uid, // تحديث معرف المستخدم إذا لم يكن موجودًا
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // تحديث custom claims للمستخدم
        const customClaims = userRecord.customClaims || {};

        await admin.auth().setCustomUserClaims(uid, {
            ...customClaims,
            role: invitationData.role,
            accountType: 'organization',
            organizationId: invitationData.organizationId
        });

        return {
            success: true,
            organizationId: invitationData.organizationId
        };
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            `Failed to accept organization invitation: ${error.message || 'Unknown error'}`
        );
    }
});

/**
 * نوع بيانات طلب رفض دعوة للانضمام إلى مؤسسة
 */
interface RejectOrganizationInvitationRequest {
    invitationId: string;
}

/**
 * رفض دعوة للانضمام إلى مؤسسة
 */
export const rejectOrganizationInvitation = createCallableFunction<RejectOrganizationInvitationRequest>(async (request: CallableRequest<RejectOrganizationInvitationRequest>) => {
    const { data, auth } = request;
    const functionName = 'rejectOrganizationInvitation';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول لرفض دعوة الانضمام إلى مؤسسة.'
            );
        }
        const uid = auth.uid;

        // التحقق من صحة المدخلات
        const { invitationId } = data;

        if (!invitationId || typeof invitationId !== 'string') {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'يجب توفير معرف دعوة صالح.'
            );
        }

        // الحصول على الدعوة
        const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();

        if (!invitationDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'الدعوة غير موجودة.'
            );
        }

        const invitationData = invitationDoc.data();

        // التحقق من أن الدعوة للمستخدم الحالي
        if (invitationData?.userId && invitationData.userId !== uid) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'هذه الدعوة ليست لك.'
            );
        }

        // التحقق من أن البريد الإلكتروني للدعوة يتطابق مع بريد المستخدم
        const userRecord = await admin.auth().getUser(uid);
        if (invitationData?.email !== userRecord.email) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'هذه الدعوة ليست لبريدك الإلكتروني.'
            );
        }

        // التحقق من أن الدعوة معلقة
        if (invitationData?.status !== 'pending') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'لا يمكن رفض دعوة تمت معالجتها بالفعل.'
            );
        }

        // تحديث حالة الدعوة
        await db.collection('organizationInvitations').doc(invitationId).update({
            status: 'rejected',
            userId: uid, // تحديث معرف المستخدم إذا لم يكن موجودًا
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

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
            `Failed to reject organization invitation: ${error.message || 'Unknown error'}`
        );
    }
});
