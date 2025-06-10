/**
 * نقطة الدخول الرئيسية لدوال Firebase
 *
 * تم تنظيم الدوال في مجلدات منفصلة:
 * - shared: للدوال والوظائف المشتركة
 * - organization: للدوال الخاصة بالمؤسسات
 * - individual: للدوال الخاصة بالمستخدمين الفرديين
 * - ai: للدوال الخاصة بالذكاء الاصطناعي
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { db } from './shared/utils';
import { createCallableFunction, createHttpFunction, LegacyCallableContext } from './shared/function-utils';

// تصدير وظائف الذكاء الاصطناعي
export * from './ai';

// تصدير وظائف المصادقة
export * from './auth';

// تصدير وظائف البريد الإلكتروني والتشخيص
export * from './email';

// تصدير وظائف حذف المستخدمين
export * from './userDeletion';

// تصدير وظائف المستخدمين الفرديين
export * from './individual';

// تصدير وظائف المؤسسات (تصدير محدد لتجنب التضارب)
export {
  // وظائف المؤسسات الأساسية
  createOrganization,
  getOrganization,
  updateOrganization,
  removeOrganizationMember,
  updateOrganizationMember,
  getOrganizationMembers,

  // وظائف طلبات المؤسسات
  requestOrganization,
  approveOrganizationRequest,
  rejectOrganizationRequest,

  // وظائف دعوات المؤسسات
  inviteUserToOrganization,
  acceptOrganizationInvitation,
  rejectOrganizationInvitation,
  getInvitationInfo,

  // وظائف إدارة الحسابات
  verifyAccountType,
  updateAccountType,

  // وظائف OKR
  createOkrPeriod,
  updateOkrPeriod,
  getOkrPeriods,
  createObjective,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
  getKeyResultsByObjective,
  getKeyResultUpdates,

  // وظائف ربط المهام
  linkTaskToKeyResult,
  unlinkTaskFromKeyResult,
  getTasksForKeyResult,
  getKeyResultsForTask,
  getUnlinkedKeyResults,
  getUnlinkedTasks,
  createTaskForKeyResult,

  // وظائف إحصائيات OKR
  getOkrStats,
  exportOkrReport,
  exportOkrToExcel
} from './organization';

// تصدير وظائف موافقة المهام
export * from './tasks/approval';

// تم حذف دالة fixUserPermissions - لم تعد مطلوبة

/**
 * Checks if the calling user is an authenticated admin.
 * Throws HttpsError if not authorized.
 * @param {LegacyCallableContext} context - The function context.
 */
const ensureAdmin = (context: LegacyCallableContext) => {
    // 1. Check if the user is authenticated
    if (!context.auth) {
        console.error("❌ Authorization Error: Request must be made by an authenticated user.");
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    console.log(`🔍 Checking admin permissions for user ${context.auth.uid}`);
    console.log(`🔍 User token:`, JSON.stringify(context.auth.token, null, 2));

    // 2. التحقق الشامل من جميع أنواع الصلاحيات الإدارية
    const token = context.auth.token || {};

    // النمط الموحد is* فقط (بدون تكرار)
    const isSystemOwner = token.isSystemOwner === true;
    const isSystemAdmin = token.isSystemAdmin === true;
    const isOrgOwner = token.isOrgOwner === true;
    const isOrgAdmin = token.isOrgAdmin === true;

    // التحقق من الدور النصي
    const role = token.role;
    const adminRoles = ['isSystemOwner', 'isSystemAdmin', 'isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer', 'isOrgTechnician', 'isOrgAssistant'];
    const isAdminByRole = role && adminRoles.includes(role);

    console.log(`🔍 Admin check results (النمط الجديد is* فقط):`);
    console.log(`  - isSystemOwner: ${isSystemOwner}`);
    console.log(`  - isSystemAdmin: ${isSystemAdmin}`);
    console.log(`  - isOrgOwner: ${isOrgOwner}`);
    console.log(`  - isOrgAdmin: ${isOrgAdmin}`);
    console.log(`  - role: ${role}`);
    console.log(`  - isAdminByRole: ${isAdminByRole}`);

    // التحقق من وجود أي صلاحية إدارية (النمط الجديد is* فقط)
    const hasAdminPermission = isSystemOwner || isSystemAdmin || isOrgOwner || isOrgAdmin || isAdminByRole;

    if (!hasAdminPermission) {
        console.error(`❌ Authorization Error: User ${context.auth.uid} is not an admin.`);
        console.error(`❌ Available claims:`, Object.keys(token));
        console.error(`❌ Token values:`, token);
        throw new functions.https.HttpsError(
            "permission-denied",
            `ليس لديك صلاحيات إدارية. الأدوار المطلوبة: system_owner, system_admin, org_owner, org_admin, أو isIndependent. دورك الحالي: ${role || 'غير محدد'}`
        );
    }

    console.log(`✅ Authorization Success: User ${context.auth.uid} is an admin with role: ${role}`);
};

// تم حذف setOwnerRole و setAdminRole - لم تعد مطلوبة

// تم حذف setAdminRole - لن نحتاجها مع النظام الجديد

// HTTP version with CORS support - تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
// export const setAdminRoleHttp = createHttpFunction(...);

// تم حذف setUserDisabledStatus - لم تعد مطلوبة

// HTTP version with CORS support - تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
// export const setUserDisabledStatusHttp = createHttpFunction(...);

/**
 * نوع بيانات طلب إنشاء مستخدم جديد
 */
interface CreateUserRequest {
    email: string;
    password: string;
    name?: string; // الاسم اختياري الآن
    role: string;
    accountType?: string;
    organizationId?: string;
    departmentId?: string;
}

/**
 * Creates a new user account with the specified email, password, name, and role.
 * Requires the caller to be an admin.
 *
 * @returns {Promise<{uid?: string, error?: string}>} Result or error message.
 */
export const createUser = createCallableFunction<CreateUserRequest>(async (request) => {
    const functionName = 'createUser';
    console.log(`🚀 --- ${functionName} Cloud Function triggered ---`);
    console.log(`🚀 ${functionName} called with data:`, request.data);
    console.log(`🚀 ${functionName} auth context:`, request.auth ? 'Present' : 'Missing');
    if (request.auth) {
        console.log(`🚀 ${functionName} user ID:`, request.auth.uid);
        console.log(`🚀 ${functionName} token keys:`, Object.keys(request.auth.token || {}));
    }

    try {
        // تحويل request إلى LegacyCallableContext
        const context: LegacyCallableContext = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token
            } : undefined,
            rawRequest: request.rawRequest
        };
        ensureAdmin(context); // Verify caller is admin

        let { email, password, name, role, accountType, organizationId, departmentId } = request.data;
        // Basic input validation
        if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            console.error(`${functionName} error: Invalid email provided.`);
            throw new functions.https.HttpsError("invalid-argument", "A valid email must be provided.");
        }
        if (!password || typeof password !== "string" || password.length < 6) {
            console.error(`${functionName} error: Invalid password provided (must be at least 6 characters).`);
            throw new functions.https.HttpsError("invalid-argument", "A valid password (at least 6 characters) must be provided.");
        }
        // الاسم اختياري - إذا لم يتم توفيره، سنستخدم جزء من البريد الإلكتروني
        if (name && typeof name !== "string") {
            console.error(`${functionName} error: Invalid name provided.`);
            throw new functions.https.HttpsError("invalid-argument", "Name must be a valid string if provided.");
        }
        const validRoles = ['isSystemOwner', 'isSystemAdmin', 'isOrgOwner', 'isOrgAdmin', 'isOrgEngineer', 'isOrgSupervisor', 'isOrgTechnician', 'isOrgAssistant', 'isIndependent'];
        if (!validRoles.includes(role)) { // Validate role input
            console.error(`${functionName} error: Invalid role provided. Must be one of: ${validRoles.join(', ')}.`);
            throw new functions.https.HttpsError("invalid-argument", `A valid role must be provided. Valid roles are: ${validRoles.join(', ')}`);
        }

        // إذا كان نوع الحساب فردي، نتأكد من أن الدور هو 'isIndependent'
        if (accountType === 'individual' && role !== 'isIndependent' && role !== 'isSystemOwner' && role !== 'isSystemAdmin' && role !== 'isIndependent') {
            console.log(`${functionName}: Changing role from '${role}' to 'isIndependent' for individual account type`);
            role = 'isIndependent';  // تحديث المتغير المحلي أيضاً
            request.data.role = 'isIndependent';
        }

        // التحقق من أن المستدعي مالك النظام إذا كان يحاول إنشاء مستخدم بدور مالك أو مسؤول
        console.log(`${functionName} DEBUG: Checking system owner permissions`);
        console.log(`${functionName} DEBUG: role = ${role}`);
        console.log(`${functionName} DEBUG: context.auth?.token.isSystemOwner = ${context.auth?.token.isSystemOwner}`);
        console.log(`${functionName} DEBUG: context.auth?.token.role = ${context.auth?.token.role}`);
        console.log(`${functionName} DEBUG: Full token:`, JSON.stringify(context.auth?.token, null, 2));

        if ((role === 'isSystemOwner' || role === 'isSystemAdmin') && !context.auth?.token.isSystemOwner) {
            console.error(`${functionName} error: Only system owners can create system owner or admin users.`);
            console.error(`${functionName} error: Current user token:`, JSON.stringify(context.auth?.token, null, 2));
            throw new functions.https.HttpsError("permission-denied", "فقط مالك النظام يمكنه إنشاء مستخدمين بدور مالك أو مسؤول النظام.");
        }

        // Validate account type
        const validAccountTypes = ['individual', 'organization'];
        if (!accountType || !validAccountTypes.includes(accountType)) {
            console.error(`${functionName} error: Invalid account type provided. Must be one of: ${validAccountTypes.join(', ')}.`);
            throw new functions.https.HttpsError("invalid-argument", `A valid account type must be provided. Valid types are: ${validAccountTypes.join(', ')}`);
        }

        // Validate organization ID for organization accounts
        if (accountType === 'organization' && !organizationId) {
            console.error(`${functionName} error: Organization ID is required for organization accounts.`);
            throw new functions.https.HttpsError("invalid-argument", "Organization ID is required for organization accounts.");
        }

        // التحقق من وجود البريد الإلكتروني مسبقاً - إصلاح المنطق
        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            // إذا وصلنا هنا، فالمستخدم موجود بالفعل
            console.error(`${functionName} error: Email ${email} already exists with UID ${existingUser.uid}`);
            throw new functions.https.HttpsError("already-exists", "فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.");
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // البريد الإلكتروني غير موجود، يمكن المتابعة
                console.log(`${functionName}: Email ${email} is available for new user creation`);
            } else if (error instanceof functions.https.HttpsError) {
                // إعادة رمي الخطأ إذا كان من النوع المطلوب (مثل already-exists)
                throw error;
            } else {
                // خطأ آخر في التحقق، نرمي خطأ عام
                console.error(`${functionName}: Unexpected error checking email existence:`, error);
                throw new functions.https.HttpsError("internal", "خطأ في التحقق من البريد الإلكتروني");
            }
        }

        console.log(`Attempting to create user ${email} by admin ${request.auth?.uid}`);
        const userName = name || (email ? email.split('@')[0] : '') || 'مستخدم';
        const userRecord = await admin.auth().createUser({ email, password, displayName: userName });
        console.log(`User ${email} created with UID ${userRecord.uid}.`);

        // تعيين الخصائص حسب الدور والنوع (النظام الموحد)
        const customClaims: Record<string, any> = {
            role,
            accountType,
            isSystemOwner: role === 'isSystemOwner',
            isSystemAdmin: role === 'isSystemAdmin',
            isOrgOwner: role === 'isOrgOwner',
            isOrgAdmin: role === 'isOrgAdmin',
            isOrgSupervisor: role === 'isOrgSupervisor',
            isOrgEngineer: role === 'isOrgEngineer',
            isOrgTechnician: role === 'isOrgTechnician',
            isOrgAssistant: role === 'isOrgAssistant',
            isIndependent: role === 'isIndependent'
        };

        // إضافة معلومات المؤسسة إذا كان نوع الحساب مؤسسة
        if (accountType === 'organization' && organizationId) {
            customClaims.organizationId = organizationId;
            if (departmentId) {
                customClaims.departmentId = departmentId;
            }
        }

        // تسجيل العملية
        console.log(`Setting custom claims for user ${userRecord.uid}:`, {
            role,
            accountType,
            isSystemOwner: customClaims.isSystemOwner,
            isSystemAdmin: customClaims.isSystemAdmin,
            isOrgOwner: customClaims.isOrgOwner,
            isOrgAdmin: customClaims.isOrgAdmin,
            isOrgSupervisor: customClaims.isOrgSupervisor,
            isOrgEngineer: customClaims.isOrgEngineer,
            isOrgTechnician: customClaims.isOrgTechnician,
            isOrgAssistant: customClaims.isOrgAssistant,
            isIndependent: customClaims.isIndependent
        });

        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        // Save additional user data in Firestore
        console.log(`Saving user data to Firestore for user ${userRecord.uid}`);

        // إنشاء البيانات الأساسية للمستخدم (استخدام userName المحسوب مسبقاً)
        const completeUserData = {
            uid: userRecord.uid,                     // ✅ إضافة uid
            name: userName,
            email: email,
            displayName: userName,
            role: role,
            accountType: accountType,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth?.uid,
            disabled: false,
            customPermissions: [],                   // ✅ إضافة customPermissions

            // الأدوار (النظام الموحد)
            isSystemOwner: role === 'isSystemOwner',
            isSystemAdmin: role === 'isSystemAdmin',
            isOrgOwner: role === 'isOrgOwner',
            isOrgAdmin: role === 'isOrgAdmin',
            isOrgSupervisor: role === 'isOrgSupervisor',
            isOrgEngineer: role === 'isOrgEngineer',
            isOrgTechnician: role === 'isOrgTechnician',
            isOrgAssistant: role === 'isOrgAssistant',
            isIndependent: role === 'isIndependent'
        };

        if (accountType === 'individual') {
            // للحسابات الفردية: حفظ في مجموعة users فقط
            await db.collection('users').doc(userRecord.uid).set(completeUserData);
            console.log(`Created individual user in users collection`);
        } else {
            // للحسابات التنظيمية: حفظ في مجموعة users مع معلومات المؤسسة
            const orgUserData = {
                ...completeUserData,
                organizationId: organizationId,
                departmentId: departmentId || null
            };

            await db.collection('users').doc(userRecord.uid).set(orgUserData);

            // إضافة المستخدم كعضو في المؤسسة
            if (organizationId) {
                await db.collection('organizations').doc(organizationId).collection('members').doc(userRecord.uid).set({
                    role: role,
                    departmentId: departmentId || null,
                    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    addedBy: request.auth?.uid
                });

                console.log(`Added user to organization ${organizationId} as member`);
            }

            console.log(`Created organization user in users collection`);
        }

        console.log(`Successfully created user ${email} (UID: ${userRecord.uid}) with role '${role}'.`);
        return { uid: userRecord.uid };

    } catch (error: any) {
        console.error(`Error creating user ${request.data.email}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error; // Re-throw HttpsErrors directly
        }
        let clientErrorMessage = `Failed to create user: ${error.message || 'Unknown internal server error.'}`;
        if (error.code === 'auth/email-already-exists') {
            clientErrorMessage = 'فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.';
        } else if (error.code === 'auth/invalid-password') {
            clientErrorMessage = 'فشل إنشاء المستخدم: كلمة المرور غير صالحة (يجب أن تكون 6 أحرف على الأقل).';
        }
        console.error(`Detailed error in ${functionName}:`, error.message, error.stack);
        // Throw internal error with a potentially more specific message
        throw new functions.https.HttpsError("internal", clientErrorMessage);
    }
});

// دالة HTTP للتطوير - لحل مشاكل CORS (مبسطة)
export const createUserHttp = createHttpFunction<CreateUserRequest>(async (request) => {
    const functionName = 'createUserHttp';
    console.log(`🚀 --- ${functionName} HTTP Function triggered ---`);
    console.log(`🚀 ${functionName} called with data:`, request.data);
    console.log(`🚀 ${functionName} auth context:`, request.auth ? 'Present' : 'Missing');
    if (request.auth) {
        console.log(`🚀 ${functionName} user ID:`, request.auth.uid);
        console.log(`🚀 ${functionName} token keys:`, Object.keys(request.auth.token || {}));
    }

    try {
        // تحويل request إلى LegacyCallableContext
        const context: LegacyCallableContext = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token
            } : undefined,
            rawRequest: request.rawRequest
        };
        ensureAdmin(context); // Verify caller is admin

        let { email, password, name, role, accountType, organizationId, departmentId } = request.data;

        // Basic input validation
        if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            console.error(`${functionName} error: Invalid email provided.`);
            throw new functions.https.HttpsError("invalid-argument", "A valid email must be provided.");
        }
        if (!password || typeof password !== "string" || password.length < 6) {
            console.error(`${functionName} error: Invalid password provided (must be at least 6 characters).`);
            throw new functions.https.HttpsError("invalid-argument", "A valid password (at least 6 characters) must be provided.");
        }

        const validRoles = ['isSystemOwner', 'isSystemAdmin', 'isOrgOwner', 'isOrgAdmin', 'isOrgEngineer', 'isOrgSupervisor', 'isOrgTechnician', 'isOrgAssistant', 'isIndependent'];
        if (!validRoles.includes(role)) {
            console.error(`${functionName} error: Invalid role provided. Must be one of: ${validRoles.join(', ')}.`);
            throw new functions.https.HttpsError("invalid-argument", `A valid role must be provided. Valid roles are: ${validRoles.join(', ')}`);
        }

        // إذا كان نوع الحساب فردي، نتأكد من أن الدور هو 'isIndependent'
        if (accountType === 'individual' && role !== 'isIndependent' && role !== 'isSystemOwner' && role !== 'isSystemAdmin') {
            console.log(`${functionName}: Changing role from '${role}' to 'isIndependent' for individual account type`);
            role = 'isIndependent';
            request.data.role = 'isIndependent';
        }

        // Validate account type
        const validAccountTypes = ['individual', 'organization'];
        if (!accountType || !validAccountTypes.includes(accountType)) {
            console.error(`${functionName} error: Invalid account type provided. Must be one of: ${validAccountTypes.join(', ')}.`);
            throw new functions.https.HttpsError("invalid-argument", `A valid account type must be provided. Valid types are: ${validAccountTypes.join(', ')}`);
        }

        // التحقق من وجود البريد الإلكتروني مسبقاً
        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            console.error(`${functionName} error: Email ${email} already exists with UID ${existingUser.uid}`);
            throw new functions.https.HttpsError("already-exists", "فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.");
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                console.log(`${functionName}: Email ${email} is available for new user creation`);
            } else if (error instanceof functions.https.HttpsError) {
                throw error;
            } else {
                console.error(`${functionName}: Unexpected error checking email existence:`, error);
                throw new functions.https.HttpsError("internal", "خطأ في التحقق من البريد الإلكتروني");
            }
        }

        console.log(`Attempting to create user ${email} by admin ${request.auth?.uid}`);
        const userName = name || (email ? email.split('@')[0] : '') || 'مستخدم';
        const userRecord = await admin.auth().createUser({ email, password, displayName: userName });
        console.log(`User ${email} created with UID ${userRecord.uid}.`);

        // تعيين الخصائص حسب الدور والنوع (النمط الموحد is* فقط)
        const customClaims: Record<string, any> = {
            role,
            accountType,
            name: userName,
            // النمط الموحد is* فقط (بدون تكرار)
            isSystemOwner: role === 'isSystemOwner',
            isSystemAdmin: role === 'isSystemAdmin',
            isOrgOwner: role === 'isOrgOwner',
            isOrgAdmin: role === 'isOrgAdmin',
            isOrgSupervisor: role === 'isOrgSupervisor',
            isOrgEngineer: role === 'isOrgEngineer',
            isOrgTechnician: role === 'isOrgTechnician',
            isOrgAssistant: role === 'isOrgAssistant',
            isIndependent: role === 'isIndependent',
            disabled: false
        };

        // لا صلاحيات افتراضية - المدير يخصصها حسب الحاجة
        customClaims.customPermissions = [];

        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        // system_owner و system_admin يمكن أن يكونوا individual أو organization
        // لا نغير accountType المحدد من المستخدم

        // Save user data in Firestore (نظيف بدون تكرار)
        const completeUserData = {
            uid: userRecord.uid,
            name: userName,
            email: email,
            role: role,
            accountType: accountType,
            organizationId: organizationId || null,
            departmentId: departmentId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth?.uid,
            disabled: false,
            customPermissions: [], // فارغة - المدير يخصصها
            // الأدوار المنطقية فقط (بدون تكرار الصلاحيات)
            isSystemOwner: role === 'isSystemOwner',
            isSystemAdmin: role === 'isSystemAdmin',
            isOrgOwner: role === 'isOrgOwner',
            isOrgAdmin: role === 'isOrgAdmin',
            isOrgSupervisor: role === 'isOrgSupervisor',
            isOrgEngineer: role === 'isOrgEngineer',
            isOrgTechnician: role === 'isOrgTechnician',
            isOrgAssistant: role === 'isOrgAssistant',
            isIndependent: role === 'isIndependent',
            isOrgMember: ['isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer', 'isOrgTechnician', 'isOrgAssistant'].includes(role)
            // تم حذف can* permissions - يتم حسابها ديناميكياً من الدور
        };

        await db.collection('users').doc(userRecord.uid).set(completeUserData);
        console.log(`Successfully created user ${email} (UID: ${userRecord.uid}) with role '${role}'.`);

        return { uid: userRecord.uid };

    } catch (error: any) {
        console.error(`Error creating user ${request.data.email}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        let clientErrorMessage = `Failed to create user: ${error.message || 'Unknown internal server error.'}`;
        if (error.code === 'auth/email-already-exists') {
            clientErrorMessage = 'فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.';
        } else if (error.code === 'auth/invalid-password') {
            clientErrorMessage = 'فشل إنشاء المستخدم: كلمة المرور غير صالحة (يجب أن تكون 6 أحرف على الأقل).';
        }
        console.error(`Detailed error in ${functionName}:`, error.message, error.stack);
        throw new functions.https.HttpsError("internal", clientErrorMessage);
    }
});

/**
 * نوع بيانات طلب قائمة مستخدمي Firebase
 */
interface ListFirebaseUsersRequest {
    maxResults?: number;
    pageToken?: string;
}

/**
 * Lists Firebase Authentication users.
 * Requires admin privileges.
 *
 * @returns {Promise<{users?: any[], error?: string}>} List of users or error message.
 */
export const listFirebaseUsers = createCallableFunction<ListFirebaseUsersRequest>(async (request) => {
    const functionName = 'listFirebaseUsers';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // تحويل request إلى LegacyCallableContext
        const context: LegacyCallableContext = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token
            } : undefined,
            rawRequest: request.rawRequest
        };
        ensureAdmin(context); // Verify caller is admin

        console.log(`Listing users by admin ${request.auth?.uid}`);
        const listUsersResult = await admin.auth().listUsers(1000); // Adjust maxResults as needed
        const users = listUsersResult.users;
        console.log(`Successfully listed ${users.length} users.`);

        // Get additional user data from Firestore
        const userDataPromises = users.map(async (user) => {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                return userDoc.exists ? userDoc.data() : null;
            } catch (err) {
                console.error(`Error fetching Firestore data for user ${user.uid}:`, err);
                return null;
            }
        });

        const userDataResults = await Promise.all(userDataPromises);

        // Return enhanced user data to the client
        const clientSafeUsers = users.map((user, index) => {
            const firestoreData = userDataResults[index];
            const customClaims = user.customClaims || {};

            return {
                uid: user.uid,
                email: user.email,
                name: user.displayName || (firestoreData?.name as string | undefined),
                role: customClaims.role || firestoreData?.role || 'isIndependent',
                customPermissions: firestoreData?.customPermissions,
                canManageSystem: !!customClaims.isSystemOwner,
                canManageUsers: !!(customClaims.isSystemOwner || customClaims.isSystemAdmin),
                canManageOrganization: !!(customClaims.isSystemOwner || customClaims.isSystemAdmin || customClaims.isOrgOwner),
                disabled: user.disabled,
                createdAt: firestoreData?.createdAt,
                lastLogin: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : null
            };
        });

        return { users: clientSafeUsers };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error; // Re-throw known auth errors
        }
        // Log the specific internal error before throwing a generic one
        console.error(`Detailed error in ${functionName}:`, error.message, error.stack);
        throw new functions.https.HttpsError(
            "internal",
            `Failed to list users: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

// Import and export roles functions
export * from './roles';

// Import and export system functions
export * from './system';

// Import and export individual user functions
import {
  getIndividualUserData,
  updateIndividualUserData,
  exportIndividualData
} from './individual';

export {
  getIndividualUserData,
  updateIndividualUserData,
  exportIndividualData
};

// تم نقل تصدير وظائف المؤسسات إلى بداية الملف لتجنب التكرار

// وظائف المصادقة والذكاء الاصطناعي تم تصديرها بالفعل في بداية الملف

// تم حذف جميع النسخ HTTP - نستخدم Callable Functions فقط