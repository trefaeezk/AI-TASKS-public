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
// import { onRequest } from "firebase-functions/v2/https"; // No se usa después de eliminar las funciones HTTP duplicadas
import * as admin from "firebase-admin";
// import cors from "cors"; // No se usa después de eliminar las funciones HTTP
import { db } from './shared/utils';
import { createCallableFunction, LegacyCallableContext } from './shared/function-utils';

// تصدير وظائف الذكاء الاصطناعي
export * from './ai';

// تصدير وظائف المصادقة
export * from './auth';

// تصدير وظائف البريد الإلكتروني والتشخيص
export * from './email';

/**
 * Checks if the calling user is an authenticated admin.
 * Throws HttpsError if not authorized.
 * @param {LegacyCallableContext} context - The function context.
 */
const ensureAdmin = (context: LegacyCallableContext) => {
    // 1. Check if the user is authenticated
    if (!context.auth) {
        console.error("Authorization Error: Request must be made by an authenticated user.");
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }
    // 2. Check if the calling user has the 'admin' custom claim set to true
    if (context.auth.token.admin !== true) {
        console.error(`Authorization Error: User ${context.auth.uid} is not an admin (admin claim not true). Claims:`, context.auth.token);
        throw new functions.https.HttpsError(
            "permission-denied",
            "Must be an administrative user with the 'admin' claim set to true to perform this action."
        );
    }
    console.log(`Authorization Success: User ${context.auth.uid} is an admin.`);
};

/**
 * نوع بيانات طلب تعيين دور المسؤول
 */
interface SetAdminRoleRequest {
    uid: string;
    isAdmin: boolean;
}

/**
 * نوع بيانات طلب تعيين دور المالك
 */
interface SetOwnerRoleRequest {
    uid: string;
    isOwner: boolean;
}

/**
 * Sets a custom claim on a user account to designate them as an admin.
 * Requires the caller to be an admin.
 *
 * @param {SetAdminRoleRequest} data The data passed to the function.
 * @returns {Promise<{result?: string, error?: string}>} Result or error message.
 */
// Callable function version (updated for v6)
/**
 * دالة مساعدة للتحقق من أن المستخدم مالك
 */
const ensureOwner = (context: LegacyCallableContext) => {
    if (!context.auth) {
        console.error('Authorization Failed: No auth context provided.');
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    // التحقق من وجود خاصية owner
    if (!context.auth.token.owner) {
        console.error(`Authorization Failed: User ${context.auth.uid} is not an owner.`);
        throw new functions.https.HttpsError(
            'permission-denied',
            'يجب أن تكون مالكًا للوصول إلى هذه الوظيفة.'
        );
    }
    console.log(`Authorization Success: User ${context.auth.uid} is an owner.`);
};

/**
 * تعيين دور المالك لمستخدم
 * يتطلب أن يكون المستدعي مالكًا
 */
export const setOwnerRole = createCallableFunction<SetOwnerRoleRequest>(async (request) => {
    const functionName = 'setOwnerRole';
    console.log(`--- ${functionName} Cloud Function triggered ---`);
    console.log(`${functionName} called with data:`, request.data);

    try {
        // تحويل request إلى LegacyCallableContext
        const context: LegacyCallableContext = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token
            } : undefined,
            rawRequest: request.rawRequest
        };
        ensureOwner(context); // التحقق من أن المستدعي مالك

        const { uid, isOwner } = request.data;
        if (!uid || typeof uid !== "string") {
            console.error(`${functionName} error: Invalid UID provided.`);
            throw new functions.https.HttpsError("invalid-argument", "يجب توفير معرف مستخدم صالح.");
        }
        if (typeof isOwner !== 'boolean') {
            console.error(`${functionName} error: Invalid isOwner status provided.`);
            throw new functions.https.HttpsError("invalid-argument", "يجب توفير حالة مالك صالحة (صحيح/خطأ).");
        }

        console.log(`Attempting to set owner=${isOwner} for user ${uid} by owner ${request.auth?.uid}`);

        // الحصول على معلومات المستخدم الحالية
        const userRecord = await admin.auth().getUser(uid);
        const currentClaims = userRecord.customClaims || {};

        // تعيين خاصية owner مع الحفاظ على الخصائص الأخرى
        const newClaims: Record<string, any> = {
            ...currentClaims
        };

        if (isOwner) {
            newClaims.owner = true;
            newClaims.admin = true; // إذا كان المستخدم مالكًا، نجعله مسؤولًا أيضًا
        } else {
            // إزالة خاصية owner إذا كانت موجودة
            if ('owner' in newClaims) {
                delete newClaims.owner;
            }
        }

        await admin.auth().setCustomUserClaims(uid, newClaims);

        console.log(`Successfully set owner=${isOwner} for user ${uid}.`);
        return { result: `تم تعيين دور المالك=${isOwner} للمستخدم ${uid} بنجاح.` };
    } catch (error: any) {
        console.error(`Error in ${functionName} for user ${request.data.uid}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error; // Re-throw HttpsErrors directly
        }
        // Log the specific internal error before throwing a generic one
        console.error(`Detailed error in ${functionName}:`, error.message, error.stack);
        throw new functions.https.HttpsError(
            "internal",
            `فشل تعيين دور المالك: ${error.message || 'خطأ داخلي غير معروف.'}`
        );
    }
});

export const setAdminRole = createCallableFunction<SetAdminRoleRequest>(async (request) => {
    const functionName = 'setAdminRole';
    console.log(`--- ${functionName} Cloud Function triggered ---`);
    console.log(`${functionName} called with data:`, request.data);

    try {
        // تحويل request إلى LegacyCallableContext
        const context: LegacyCallableContext = {
            auth: request.auth ? {
                uid: request.auth.uid,
                token: request.auth.token
            } : undefined,
            rawRequest: request.rawRequest
        };

        // التحقق من أن المستدعي مالك أو مسؤول
        // فقط المالك يمكنه تعيين مسؤولين جدد
        if (context.auth?.token.owner) {
            console.log(`Authorization Success: User ${context.auth.uid} is an owner.`);
        } else {
            ensureAdmin(context); // Verify caller is admin

            // التحقق من أن المسؤول لا يحاول تعيين مستخدم آخر كمسؤول
            if (request.data.isAdmin) {
                console.error(`Authorization Failed: User ${context.auth?.uid} is not an owner and cannot set admin roles.`);
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'فقط المالك يمكنه تعيين مسؤولين جدد.'
                );
            }
        }

        const { uid, isAdmin } = request.data;
        if (!uid || typeof uid !== "string") {
            console.error(`${functionName} error: Invalid UID provided.`);
            throw new functions.https.HttpsError("invalid-argument", "A valid user ID (UID) must be provided.");
        }
        if (typeof isAdmin !== 'boolean') {
            console.error(`${functionName} error: Invalid isAdmin status provided.`);
            throw new functions.https.HttpsError("invalid-argument", "A valid admin status (boolean) must be provided.");
        }

        console.log(`Attempting to set admin=${isAdmin} for user ${uid} by admin ${request.auth?.uid}`);

        // الحصول على معلومات المستخدم الحالية
        const userRecord = await admin.auth().getUser(uid);
        const currentClaims = userRecord.customClaims || {};

        // تعيين خاصية admin مع الحفاظ على الخصائص الأخرى
        const newClaims: Record<string, any> = {
            ...currentClaims
        };

        if (isAdmin) {
            newClaims.admin = true;
        } else {
            // إزالة خاصية admin إذا كانت موجودة
            if ('admin' in newClaims) {
                delete newClaims.admin;
            }
        }

        await admin.auth().setCustomUserClaims(uid, newClaims);

        console.log(`Successfully set admin=${isAdmin} for user ${uid}.`);
        return { result: `Successfully set admin=${isAdmin} for user ${uid}.` };

    } catch (error: any) {
        console.error(`Error in ${functionName} for user ${request.data.uid}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error; // Re-throw HttpsErrors directly
        }
        // Log the specific internal error before throwing a generic one
        console.error(`Detailed error in ${functionName}:`, error.message, error.stack);
        throw new functions.https.HttpsError(
            "internal",
            `Failed to set admin role: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

// HTTP version with CORS support - تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
// export const setAdminRoleHttp = createHttpFunction(...);

/**
 * نوع بيانات طلب تعيين حالة تعطيل المستخدم
 */
interface SetUserDisabledStatusRequest {
    uid: string;
    disabled: boolean;
}

/**
 * Sets the disabled status of a user account.
 * Requires the caller to be an admin.
 *
 * @param {SetUserDisabledStatusRequest} data The data passed to the function.
 * @returns {Promise<{result?: string, error?: string}>} Result or error message.
 */
// Callable function version (updated for v6)
export const setUserDisabledStatus = createCallableFunction<SetUserDisabledStatusRequest>(async (request) => {
    const functionName = 'setUserDisabledStatus';
    console.log(`--- ${functionName} Cloud Function triggered ---`);
    console.log(`${functionName} called with data:`, request.data);

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

        const { uid, disabled } = request.data;
        if (!uid || typeof uid !== "string") {
            console.error(`${functionName} error: Invalid UID provided.`);
            throw new functions.https.HttpsError("invalid-argument", "A valid user ID (UID) must be provided.");
        }
        if (typeof disabled !== "boolean") {
            console.error(`${functionName} error: Invalid disabled status provided.`);
            throw new functions.https.HttpsError("invalid-argument", "A valid disabled status (boolean) must be provided.");
        }

        console.log(`Attempting to set disabled=${disabled} for user ${uid} by admin ${request.auth?.uid}`);
        await admin.auth().updateUser(uid, { disabled });
        console.log(`Successfully set disabled=${disabled} for user ${uid}.`);
        return { result: `Successfully set disabled=${disabled} for user ${uid}.` };

    } catch (error: any) {
        console.error(`Error in ${functionName} for user ${request.data.uid}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error(`Detailed error in ${functionName}:`, error.message, error.stack);
        throw new functions.https.HttpsError(
            "internal",
            `Failed to set disabled status: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

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
    console.log(`--- ${functionName} Cloud Function triggered ---`);
    console.log(`${functionName} called with data:`, request.data);

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

        const { email, password, name, role, accountType, organizationId, departmentId } = request.data;
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
        const validRoles = ['owner', 'admin', 'individual_admin', 'engineer', 'supervisor', 'technician', 'assistant', 'user', 'independent'];
        if (!validRoles.includes(role)) { // Validate role input
            console.error(`${functionName} error: Invalid role provided. Must be one of: ${validRoles.join(', ')}.`);
            throw new functions.https.HttpsError("invalid-argument", `A valid role must be provided. Valid roles are: ${validRoles.join(', ')}`);
        }

        // إذا كان نوع الحساب فردي، نتأكد من أن الدور هو 'independent'
        if (accountType === 'individual' && role !== 'independent' && role !== 'owner' && role !== 'admin' && role !== 'individual_admin') {
            console.log(`${functionName}: Changing role from '${role}' to 'independent' for individual account type`);
            request.data.role = 'independent';
        }

        // التحقق من أن المستدعي مالك إذا كان يحاول إنشاء مستخدم بدور مالك أو مسؤول
        if ((role === 'owner' || role === 'admin') && !context.auth?.token.owner) {
            console.error(`${functionName} error: Only owners can create owner or admin users.`);
            throw new functions.https.HttpsError("permission-denied", "فقط المالك يمكنه إنشاء مستخدمين بدور مالك أو مسؤول.");
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

        // التحقق من وجود البريد الإلكتروني مسبقاً
        try {
            const existingUser = await admin.auth().getUserByEmail(email);
            if (existingUser) {
                console.error(`${functionName} error: Email ${email} already exists with UID ${existingUser.uid}`);
                throw new functions.https.HttpsError("already-exists", "فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.");
            }
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // البريد الإلكتروني غير موجود، يمكن المتابعة
                console.log(`${functionName}: Email ${email} is available for new user creation`);
            } else if (error instanceof functions.https.HttpsError) {
                // إعادة رمي الخطأ إذا كان من النوع المطلوب
                throw error;
            } else {
                // خطأ آخر في التحقق، نسجله ونتابع
                console.warn(`${functionName}: Error checking email existence, proceeding with creation:`, error);
            }
        }

        console.log(`Attempting to create user ${email} by admin ${request.auth?.uid}`);
        const userName = name || (email ? email.split('@')[0] : '') || 'مستخدم';
        const userRecord = await admin.auth().createUser({ email, password, displayName: userName });
        console.log(`User ${email} created with UID ${userRecord.uid}.`);

        // تعيين الخصائص حسب الدور والنوع
        const customClaims: Record<string, any> = {
            role,
            accountType,

            // الأدوار الجديدة
            system_owner: role === 'system_owner',
            system_admin: role === 'system_admin',
            organization_owner: role === 'organization_owner',
            admin: role === 'admin',
            owner: role === 'owner',
            individual_admin: role === 'individual_admin'
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
            system_owner: customClaims.system_owner,
            system_admin: customClaims.system_admin,
            organization_owner: customClaims.organization_owner,
            admin: customClaims.admin
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

            // الأدوار الجديدة
            isSystemOwner: role === 'system_owner',
            isSystemAdmin: role === 'system_admin',
            isOrganizationOwner: role === 'organization_owner',
            isAdmin: role === 'admin',
            isOwner: role === 'owner',
            isIndividualAdmin: role === 'individual_admin'
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

// HTTP version with CORS support - تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
// export const createUserHttp = createHttpFunction(async (req, res) => {
//     // Function body removed to reduce resource usage
// });


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
                role: customClaims.role || firestoreData?.role || 'user',
                customPermissions: firestoreData?.customPermissions,
                isAdmin: !!customClaims.admin,
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
// تصدير كل الوظائف من ملف individual باستثناء importIndividualData
import {
  getIndividualUserData,
  updateIndividualUserData,
  exportIndividualData
  // importIndividualData تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
  // createIndividualUser تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
} from './individual';

export {
  getIndividualUserData,
  updateIndividualUserData,
  exportIndividualData
};

// Import and export organization functions
// Exportamos todo excepto las funciones que causan conflicto
export {
  createOrganization,
  getOrganization,
  updateOrganization,
  addOrganizationMember,
  removeOrganizationMember,
  getOrganizationMembers,
  // getOrganizationMembersHttp, // تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
  requestOrganization,
  approveOrganizationRequest,
  rejectOrganizationRequest,
  inviteUserToOrganization,
  acceptOrganizationInvitation,
  rejectOrganizationInvitation,
  createOkrPeriod,
  getOkrPeriods,
  updateOkrPeriod,
  // deleteOkrPeriod, // تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
  createObjective,
  createKeyResult,
  getKeyResultsByObjective,
  updateKeyResult,
  deleteKeyResult,
  getKeyResultUpdates,
  linkTaskToKeyResult,
  unlinkTaskFromKeyResult,
  getTasksForKeyResult,
  getKeyResultsForTask,
  getUnlinkedKeyResults,
  getUnlinkedTasks,
  createTaskForKeyResult,
  getOkrStats,
  exportOkrReport,
  exportOkrToExcel
} from './organization';

// وظائف المصادقة والذكاء الاصطناعي تم تصديرها بالفعل في بداية الملف

/**
 * دالة لتعيين المستخدم كمالك بشكل مباشر
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
 */
// export const setOwnerDirectHttp = onRequest(...);

/**
 * دالة لجلب قائمة المستخدمين من Firebase Authentication
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
 */
// export const listUsersHttp = onRequest(...);

/**
 * دالة لجلب معلومات مستخدم واحد بواسطة معرف المستخدم
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
 */
// export const getUserHttp = onRequest(...);
