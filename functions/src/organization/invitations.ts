
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
    console.log(`[${functionName}] --- Cloud Function triggered ---`);
    console.log(`[${functionName}] Request data:`, data);

    try {
        if (!auth) {
            console.error(`[${functionName}] Error: User not authenticated.`);
            throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول لدعوة مستخدم للانضمام إلى مؤسسة.');
        }
        const uid = auth.uid;
        console.log(`[${functionName}] Authenticated user UID: ${uid}`);

        const { organizationId, email, role, departmentId } = data;

        if (!organizationId || typeof organizationId !== 'string') {
            console.error(`[${functionName}] Error: Invalid organizationId.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير معرف مؤسسة صالح.');
        }
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            console.error(`[${functionName}] Error: Invalid email.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير بريد إلكتروني صالح.');
        }
        const validRoles = ['isOrgAdmin', 'isOrgEngineer', 'isOrgSupervisor', 'isOrgTechnician', 'isOrgAssistant', 'isOrgOwner'];
        if (!role || typeof role !== 'string' || !validRoles.includes(role)) {
            console.error(`[${functionName}] Error: Invalid role provided: ${role}. Valid roles: ${validRoles.join(', ')}`);
            throw new functions.https.HttpsError('invalid-argument', `يجب توفير دور صالح. الأدوار الصالحة هي: ${validRoles.join(', ')}`);
        }
        console.log(`[${functionName}] Input validated. Org ID: ${organizationId}, Email: ${email}, Role: ${role}`);

        console.log(`[${functionName}] Checking invitation permissions for user ${uid} in org ${organizationId}`);
        const canInvite = await canInviteToOrganization(uid, organizationId);
        if (!canInvite) {
            console.error(`[${functionName}] Error: User ${uid} does not have permission to invite to organization ${organizationId}.`);
            throw new functions.https.HttpsError('permission-denied', 'ليس لديك صلاحيات لدعوة مستخدمين إلى هذه المؤسسة.');
        }
        console.log(`[${functionName}] User ${uid} has invitation permissions.`);

        const organizationDoc = await db.collection('organizations').doc(organizationId).get();
        if (!organizationDoc.exists) {
            console.error(`[${functionName}] Error: Organization ${organizationId} not found.`);
            throw new functions.https.HttpsError('not-found', 'المؤسسة غير موجودة.');
        }
        const organizationData = organizationDoc.data();
        console.log(`[${functionName}] Organization data fetched: ${organizationData?.name}`);

        let invitedUserRecord;
        try {
            invitedUserRecord = await admin.auth().getUserByEmail(email);
            console.log(`[${functionName}] Invited user found by email: ${invitedUserRecord.uid}`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                console.log(`[${functionName}] User with email ${email} not found, creating invitation without user ID.`);
            } else {
                console.error(`[${functionName}] Error fetching user by email ${email}:`, error);
                 // لا ترمي خطأ هنا، فقط سجل الخطأ، فقد يتمكن المستخدم من التسجيل لاحقًا
            }
        }

        const existingInvitationsQuery = await db.collection('organizationInvitations')
            .where('email', '==', email)
            .where('organizationId', '==', organizationId)
            .where('status', '==', 'pending')
            .get();
        if (!existingInvitationsQuery.empty) {
            console.warn(`[${functionName}] Pending invitation already exists for ${email} in organization ${organizationId}.`);
            throw new functions.https.HttpsError('already-exists', 'هناك دعوة معلقة بالفعل لهذا المستخدم في هذه المؤسسة.');
        }

        if (invitedUserRecord) {
            const memberDoc = await db.collection('organizations').doc(organizationId).collection('members').doc(invitedUserRecord.uid).get();
            if (memberDoc.exists) {
                console.warn(`[${functionName}] User ${invitedUserRecord.uid} is already a member of organization ${organizationId}.`);
                throw new functions.https.HttpsError('already-exists', 'المستخدم عضو بالفعل في هذه المؤسسة.');
            }
        }

        const invitationData = {
            organizationId,
            email,
            role,
            departmentId: departmentId || null,
            status: 'pending',
            invitedBy: uid,
            invitedByName: auth?.token.name || auth?.token.email || 'مدير المؤسسة',
            userId: invitedUserRecord?.uid || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        console.log(`[${functionName}] Invitation data prepared:`, invitationData);

        const invitationRef = await db.collection('organizationInvitations').add(invitationData);
        console.log(`[${functionName}] Organization invitation created with ID: ${invitationRef.id}`);

        // إنشاء OTP للدعوة وإضافته للدعوة
        const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
        const invitationOTP = generateOTP();
        const otpExpiryTime = new Date();
        otpExpiryTime.setHours(otpExpiryTime.getHours() + 12); // صالح لمدة 12 ساعة

        // إضافة OTP للدعوة
        await invitationRef.update({
            otp: invitationOTP,
            otpExpiryTime: admin.firestore.Timestamp.fromDate(otpExpiryTime),
            otpUsed: false,
            otpAttempts: 0, // عداد محاولات OTP
            maxOtpAttempts: 5, // حد أقصى 5 محاولات
            otpCreatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[${functionName}] OTP added to invitation ${invitationRef.id}`);

        console.log(`[${functionName}] Attempting to send invitation email to ${email}`);
        try {
            const { sendOrganizationInvitationEmail, sendOTPEmail } = await import('../email/index');
            
            // قراءة APP_BASE_URL من متغيرات البيئة
            const appBaseUrlFromEnv = process.env.APP_BASE_URL;
            const appBaseUrlFromConfig = functions.config().app?.base_url; // طريقة قديمة، لكن نتركها للتوافق
            const appBaseUrl = appBaseUrlFromEnv || appBaseUrlFromConfig || 'https://tasks-intelligence.web.app'; // قيمة افتراضية
            
            let envSource = 'Fallback Default';
            if (appBaseUrlFromEnv) {
                envSource = 'process.env.APP_BASE_URL';
            } else if (appBaseUrlFromConfig) {
                envSource = 'functions.config().app.base_url';
            }

            if (appBaseUrl === 'https://tasks-intelligence.web.app' && (!appBaseUrlFromEnv && !appBaseUrlFromConfig)) {
                 console.warn(`[${functionName}] ⚠️ تحذير: متغير البيئة APP_BASE_URL (أو functions.config().app.base_url) غير معين. يتم استخدام القيمة الافتراضية: '${appBaseUrl}'. يرجى تعيين هذا المتغير في ملف .env الخاص بالدوال (للتطوير) أو في تكوين دوال Firebase (للنشر) لضمان صحة روابط الدعوات. مصدر القيمة المستخدمة: ${envSource}`);
            }
            console.log(`[${functionName}] Using APP_BASE_URL: ${appBaseUrl} (From: ${envSource})`);

            const invitationUrl = `${appBaseUrl}/invitation/${invitationRef.id}`;
            const inviterName = auth?.token?.name || auth?.token?.email || 'مدير المؤسسة';

            console.log(`[${functionName}] Constructed invitation URL: ${invitationUrl}`);
            console.log(`[${functionName}] Inviter name: ${inviterName}`);

            // إرسال الإيميل الأول - الدعوة
            const emailSent = await sendOrganizationInvitationEmail(
                email,
                organizationData?.name || 'المؤسسة',
                inviterName,
                role,
                invitationUrl
            );

            if (emailSent) {
                console.log(`[${functionName}] ✅ Invitation email sent successfully to ${email}`);

                // إرسال الإيميل الثاني - OTP منفصل
                console.log(`[${functionName}] Sending OTP email to ${email}`);
                const otpEmailSent = await sendOTPEmail({
                to: email,
                otp: invitationOTP,
                expiryTime: otpExpiryTime,
                subject: 'رمز التحقق للدعوة - Tasks Intelligence',
                title: 'رمز التحقق للدعوة',
                message: 'لإكمال عملية قبول الدعوة، يرجى استخدام رمز التحقق التالي:',
                logContext: 'INVITATION'
            });

                if (otpEmailSent) {
                    console.log(`[${functionName}] ✅ OTP email sent successfully to ${email}`);
                } else {
                    console.warn(`[${functionName}] ⚠️ Failed to send OTP email to ${email}`);
                }
            } else {
                console.warn(`[${functionName}] ⚠️ Failed to send invitation email to ${email}`);
            }
        } catch (emailError) {
            console.error(`[${functionName}] ❌ Error sending invitation email to ${email}:`, emailError);
        }

        return { success: true, invitationId: invitationRef.id };
    } catch (error: any) {
        console.error(`[${functionName}] ❌ Top-level error:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to invite user to organization: ${error.message || 'Unknown error'}`);
    }
});

// ... (rest of the file: getInvitationInfo, acceptOrganizationInvitation, rejectOrganizationInvitation)
// Keep the rest of the file as is. Only sendOrganizationInvitationEmail related logging was added.

/**
 * نوع بيانات طلب جلب معلومات الدعوة العامة
 */
interface GetInvitationInfoRequest {
    invitationId: string;
    otp?: string; // رمز التحقق من الإيميل
}

/**
 * جلب معلومات الدعوة العامة (للمستخدمين غير المسجلين)
 * يعرض فقط المعلومات الآمنة والضرورية
 * يتبع نفس نمط listFirebaseUsers
 */
export const getInvitationInfo = createCallableFunction<GetInvitationInfoRequest>(async (request: CallableRequest<GetInvitationInfoRequest>) => {
    const { data } = request;
    const functionName = 'getInvitationInfo';
    console.log(`[${functionName}] --- Cloud Function triggered ---`);
    console.log(`[${functionName}] Fetching invitation info for ID: ${data.invitationId}`);

    try {
        const { invitationId, otp } = data;
        if (!invitationId || typeof invitationId !== 'string') {
            console.error(`[${functionName}] Error: Invalid invitationId.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير معرف دعوة صالح.');
        }

        const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();
        if (!invitationDoc.exists) {
            console.warn(`[${functionName}] Invitation ${invitationId} not found.`);
            throw new functions.https.HttpsError('not-found', 'الدعوة غير موجودة أو انتهت صلاحيتها.');
        }

        const invitationData = invitationDoc.data();
        console.log(`[${functionName}] Invitation data fetched:`, invitationData);

        // التحقق من OTP إذا تم توفيره
        if (!otp) {
            // إذا لم يتم توفير OTP، نطلب من المستخدم إدخاله
            throw new functions.https.HttpsError('failed-precondition', 'يجب إدخال رمز التحقق المرسل إلى بريدك الإلكتروني.');
        }

        // التحقق من صحة OTP
        if (!invitationData?.otp) {
            console.warn(`[${functionName}] No OTP stored for invitation ${invitationId}`);
            throw new functions.https.HttpsError('failed-precondition', 'هذه الدعوة لا تحتوي على رمز أمان.');
        }

        // التحقق من عدد المحاولات
        const currentAttempts = invitationData.otpAttempts || 0;
        const maxAttempts = invitationData.maxOtpAttempts || 5;

        if (currentAttempts >= maxAttempts) {
            console.warn(`[${functionName}] Too many OTP attempts for invitation ${invitationId}`);
            throw new functions.https.HttpsError('resource-exhausted', 'تم تجاوز الحد الأقصى لمحاولات إدخال رمز التحقق.');
        }

        if (invitationData.otp !== otp) {
            // زيادة عداد المحاولات الفاشلة
            await db.collection('organizationInvitations').doc(invitationId).update({
                otpAttempts: admin.firestore.FieldValue.increment(1),
                lastFailedAttempt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.warn(`[${functionName}] Invalid OTP provided for invitation ${invitationId}. Attempts: ${currentAttempts + 1}/${maxAttempts}`);
            throw new functions.https.HttpsError('permission-denied', `رمز التحقق غير صحيح. المحاولات المتبقية: ${maxAttempts - currentAttempts - 1}`);
        }

        // التحقق من انتهاء صلاحية OTP
        if (invitationData.otpExpiryTime && invitationData.otpExpiryTime.toDate() < new Date()) {
            console.warn(`[${functionName}] OTP expired for invitation ${invitationId}`);
            throw new functions.https.HttpsError('deadline-exceeded', 'انتهت صلاحية رمز التحقق.');
        }

        console.log(`[${functionName}] OTP verified successfully for invitation ${invitationId}`);

        // تسجيل النجاح وإعادة تعيين عداد المحاولات
        await db.collection('organizationInvitations').doc(invitationId).update({
            otpAttempts: 0, // إعادة تعيين العداد بعد النجاح
            lastSuccessfulAttempt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (invitationData?.status !== 'pending') {
            console.warn(`[${functionName}] Invitation ${invitationId} status is not pending: ${invitationData?.status}`);
            throw new functions.https.HttpsError('failed-precondition', `هذه الدعوة ${invitationData?.status === 'accepted' ? 'تم قبولها بالفعل' : 'تم رفضها بالفعل'}.`);
        }

        console.log(`[${functionName}] Fetching organization data for ID: ${invitationData.organizationId}`);
        const organizationDoc = await db.collection('organizations').doc(invitationData.organizationId).get();
        const organizationData = organizationDoc.exists ? organizationDoc.data() : null;

        if (!organizationData) {
            console.warn(`[${functionName}] Organization ${invitationData.organizationId} not found for invitation ${invitationId}`);
        } else {
            console.log(`[${functionName}] Successfully fetched organization: ${organizationData.name}`);
        }

        let departmentData: any = null;
        if (invitationData.departmentId) {
            try {
                console.log(`[${functionName}] Fetching department data for ID: ${invitationData.departmentId}`);
                const departmentDoc = await db.collection('organizations').doc(invitationData.organizationId).collection('departments').doc(invitationData.departmentId).get();
                if (departmentDoc.exists) {
                    departmentData = departmentDoc.data();
                    console.log(`[${functionName}] Successfully fetched department: ${departmentData.name}`);
                } else {
                    console.warn(`[${functionName}] Department ${invitationData.departmentId} not found for invitation ${invitationId}`);
                }
            } catch (departmentError) {
                console.error(`[${functionName}] Error fetching department ${invitationData.departmentId}:`, departmentError);
            }
        }

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
        console.log(`[${functionName}] Successfully processed invitation info for ${invitationData.email}`);
        return result;
    } catch (error: any) {
        console.error(`[${functionName}] ❌ Top-level error:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to get invitation info: ${error.message || 'Unknown error'}`);
    }
}, { requireAuth: false });

interface AcceptOrganizationInvitationRequest {
    invitationId: string;
    otp: string; // رمز التحقق (مطلوب)
    email: string; // البريد الإلكتروني
    password: string; // كلمة المرور لإنشاء الحساب
    displayName?: string; // الاسم (اختياري)
}

export const acceptOrganizationInvitation = createCallableFunction<AcceptOrganizationInvitationRequest>(async (request: CallableRequest<AcceptOrganizationInvitationRequest>) => {
    const { data } = request;
    const functionName = 'acceptOrganizationInvitation';
    console.log(`[${functionName}] --- Cloud Function triggered ---`);
    console.log(`[${functionName}] Request data (password masked):`, { ...data, password: '****' });

    try {
        const { invitationId, otp, email, password, displayName } = data;

        // التحقق من البيانات المطلوبة
        if (!invitationId || typeof invitationId !== 'string') {
            console.error(`[${functionName}] Error: Invalid invitationId.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير معرف دعوة صالح.');
        }

        if (!otp || typeof otp !== 'string') {
            console.error(`[${functionName}] Error: OTP is required.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير رمز التحقق.');
        }

        if (!email || typeof email !== 'string') {
            console.error(`[${functionName}] Error: Email is required.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير البريد الإلكتروني.');
        }

        if (!password || typeof password !== 'string') {
            console.error(`[${functionName}] Error: Password is required.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير كلمة المرور.');
        }

        // جلب بيانات الدعوة
        const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();
        if (!invitationDoc.exists) {
            console.warn(`[${functionName}] Invitation ${invitationId} not found.`);
            throw new functions.https.HttpsError('not-found', 'الدعوة غير موجودة.');
        }

        const invitationData = invitationDoc.data();
        console.log(`[${functionName}] Invitation data fetched:`, invitationData);

        // التحقق من البريد الإلكتروني
        if (invitationData?.email !== email) {
            console.warn(`[${functionName}] Email mismatch. Invitation email: ${invitationData?.email}, Provided email: ${email}`);
            throw new functions.https.HttpsError('permission-denied', 'البريد الإلكتروني غير مطابق للدعوة.');
        }

        // التحقق من عدد المحاولات
        const currentAttempts = invitationData.otpAttempts || 0;
        const maxAttempts = invitationData.maxOtpAttempts || 5;

        if (currentAttempts >= maxAttempts) {
            console.warn(`[${functionName}] Too many OTP attempts for invitation ${invitationId}`);
            throw new functions.https.HttpsError('resource-exhausted', 'تم تجاوز الحد الأقصى لمحاولات إدخال رمز التحقق.');
        }

        // التحقق من OTP
        if (!invitationData?.otp || invitationData.otp !== otp) {
            // زيادة عداد المحاولات الفاشلة
            await db.collection('organizationInvitations').doc(invitationId).update({
                otpAttempts: admin.firestore.FieldValue.increment(1),
                lastFailedAttempt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.warn(`[${functionName}] Invalid OTP for invitation ${invitationId}. Attempts: ${currentAttempts + 1}/${maxAttempts}`);
            throw new functions.https.HttpsError('permission-denied', `رمز التحقق غير صحيح. المحاولات المتبقية: ${maxAttempts - currentAttempts - 1}`);
        }

        // التحقق من انتهاء صلاحية OTP
        if (invitationData.otpExpiryTime && invitationData.otpExpiryTime.toDate() < new Date()) {
            console.warn(`[${functionName}] OTP expired for invitation ${invitationId}`);
            throw new functions.https.HttpsError('deadline-exceeded', 'انتهت صلاحية رمز التحقق.');
        }

        if (invitationData?.status !== 'pending') {
            console.warn(`[${functionName}] Invitation ${invitationId} status is not pending: ${invitationData?.status}`);
            throw new functions.https.HttpsError('failed-precondition', 'لا يمكن قبول دعوة تمت معالجتها بالفعل.');
        }

        // التحقق من وجود الحساب أولاً
        let userRecord: admin.auth.UserRecord;
        let uid: string;

        try {
            // محاولة الحصول على المستخدم الموجود
            userRecord = await admin.auth().getUserByEmail(email);
            uid = userRecord.uid;
            console.log(`[${functionName}] Found existing user account with UID: ${uid}`);
        } catch (userNotFoundError) {
            // إذا لم يوجد المستخدم، إنشاء حساب جديد
            console.log(`[${functionName}] Creating new Firebase Auth account for ${email}`);
            userRecord = await admin.auth().createUser({
                email: email,
                password: password,
                displayName: displayName || email.split('@')[0],
                emailVerified: true // نعتبر البريد محقق لأن المستخدم استخدم OTP
            });
            uid = userRecord.uid;
            console.log(`[${functionName}] Created new user account with UID: ${uid}`);
        }

        console.log(`[${functionName}] Adding user ${uid} to organization ${invitationData.organizationId} as member with role ${invitationData.role}`);
        await db.collection('organizations').doc(invitationData.organizationId).collection('members').doc(uid).set({
            role: invitationData.role,
            email: userRecord.email,
            name: userRecord.displayName || '',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            invitationId: invitationId,
            departmentId: invitationData.departmentId || null
        });

        console.log(`[${functionName}] Updating invitation ${invitationId} status to 'accepted'`);
        await db.collection('organizationInvitations').doc(invitationId).update({
            status: 'accepted',
            userId: uid,
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // إلغاء OTP نهائياً بعد القبول
            otp: admin.firestore.FieldValue.delete(),
            otpExpiryTime: admin.firestore.FieldValue.delete(),
            otpUsed: true
        });

        const currentClaims = userRecord.customClaims || {};
        const newClaims = {
            ...currentClaims,
            role: invitationData.role,
            accountType: 'organization',
            organizationId: invitationData.organizationId,
            departmentId: invitationData.departmentId || null,
            // ضمان تعيين الأدوار المنطقية بشكل صحيح
            isOrgOwner: invitationData.role === 'isOrgOwner',
            isOrgAdmin: invitationData.role === 'isOrgAdmin',
            isOrgSupervisor: invitationData.role === 'isOrgSupervisor',
            isOrgEngineer: invitationData.role === 'isOrgEngineer',
            isOrgTechnician: invitationData.role === 'isOrgTechnician',
            isOrgAssistant: invitationData.role === 'isOrgAssistant',
            isIndependent: false, // لم يعد مستقلاً
        };
        console.log(`[${functionName}] Setting custom claims for user ${uid}:`, newClaims);
        await admin.auth().setCustomUserClaims(uid, newClaims);

        // جلب اسم المؤسسة
        const organizationDoc = await db.collection('organizations').doc(invitationData.organizationId).get();
        const organizationName = organizationDoc.exists ? organizationDoc.data()?.name || 'مؤسسة غير معروفة' : 'مؤسسة غير معروفة';

        console.log(`[${functionName}] Updating user document for ${uid} in 'users' collection`);
        const userDocRef = db.collection('users').doc(uid);

        // إنشاء اسم المستخدم من displayName أو email
        const userName = displayName || userRecord.displayName ||
                        (userRecord.email ? userRecord.email.split('@')[0] : '') ||
                        'مستخدم جديد';

        await userDocRef.set({
            uid: uid,
            name: userName,
            email: userRecord.email || '',
            displayName: userName,
            role: invitationData.role,
            accountType: 'organization',
            organizationId: invitationData.organizationId,
            departmentId: invitationData.departmentId || null,
            organizationName: organizationName, // إضافة اسم المؤسسة
             // ضمان تعيين الأدوار المنطقية بشكل صحيح
            isOrgOwner: invitationData.role === 'isOrgOwner',
            isOrgAdmin: invitationData.role === 'isOrgAdmin',
            isOrgSupervisor: invitationData.role === 'isOrgSupervisor',
            isOrgEngineer: invitationData.role === 'isOrgEngineer',
            isOrgTechnician: invitationData.role === 'isOrgTechnician',
            isOrgAssistant: invitationData.role === 'isOrgAssistant',
            isIndependent: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`[${functionName}] User ${uid} successfully accepted invitation ${invitationId}`);
        return { success: true, organizationId: invitationData.organizationId };
    } catch (error: any) {
        console.error(`[${functionName}] ❌ Top-level error:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to accept organization invitation: ${error.message || 'Unknown error'}`);
    }
}, { requireAuth: false });

interface RejectOrganizationInvitationRequest {
    invitationId: string;
}

export const rejectOrganizationInvitation = createCallableFunction<RejectOrganizationInvitationRequest>(async (request: CallableRequest<RejectOrganizationInvitationRequest>) => {
    const { data, auth } = request;
    const functionName = 'rejectOrganizationInvitation';
    console.log(`[${functionName}] --- Cloud Function triggered ---`);
    console.log(`[${functionName}] Request data:`, data);

    try {
        if (!auth) {
            console.error(`[${functionName}] Error: User not authenticated.`);
            throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول لرفض دعوة الانضمام إلى مؤسسة.');
        }
        const uid = auth.uid;
        console.log(`[${functionName}] Authenticated user UID: ${uid}`);

        const { invitationId } = data;
        if (!invitationId || typeof invitationId !== 'string') {
            console.error(`[${functionName}] Error: Invalid invitationId.`);
            throw new functions.https.HttpsError('invalid-argument', 'يجب توفير معرف دعوة صالح.');
        }

        const invitationDoc = await db.collection('organizationInvitations').doc(invitationId).get();
        if (!invitationDoc.exists) {
            console.warn(`[${functionName}] Invitation ${invitationId} not found.`);
            throw new functions.https.HttpsError('not-found', 'الدعوة غير موجودة.');
        }

        const invitationData = invitationDoc.data();
        console.log(`[${functionName}] Invitation data fetched:`, invitationData);

        if (invitationData?.userId && invitationData.userId !== uid) {
            console.warn(`[${functionName}] Invitation ${invitationId} not for current user ${uid}. Invitation user ID: ${invitationData.userId}`);
            throw new functions.https.HttpsError('permission-denied', 'هذه الدعوة ليست لك.');
        }

        const userRecord = await admin.auth().getUser(uid);
        if (invitationData?.email !== userRecord.email) {
            console.warn(`[${functionName}] Invitation email mismatch. Invitation email: ${invitationData?.email}, User email: ${userRecord.email}`);
            throw new functions.https.HttpsError('permission-denied', 'هذه الدعوة ليست لبريدك الإلكتروني.');
        }

        if (invitationData?.status !== 'pending') {
            console.warn(`[${functionName}] Invitation ${invitationId} status is not pending: ${invitationData?.status}`);
            throw new functions.https.HttpsError('failed-precondition', 'لا يمكن رفض دعوة تمت معالجتها بالفعل.');
        }

        console.log(`[${functionName}] Updating invitation ${invitationId} status to 'rejected'`);
        await db.collection('organizationInvitations').doc(invitationId).update({
            status: 'rejected',
            userId: uid,
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[${functionName}] User ${uid} successfully rejected invitation ${invitationId}`);
        return { success: true };
    } catch (error: any) {
        console.error(`[${functionName}] ❌ Top-level error:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', `Failed to reject organization invitation: ${error.message || 'Unknown error'}`);
    }
});



