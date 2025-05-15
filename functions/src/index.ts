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
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import cors from "cors";
import { db } from './shared/utils';
import { createCallableFunction, createHttpFunction, LegacyCallableContext } from './shared/function-utils';

// تصدير وظائف الذكاء الاصطناعي
export * from './ai';

// Initialize CORS middleware with options
const corsHandler = cors({ origin: true });

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

// HTTP version with CORS support
export const setAdminRoleHttp = createHttpFunction(async (req, res) => {
    const functionName = 'setAdminRoleHttp';

    // Handle CORS
    corsHandler(req, res, async () => {
        console.log(`--- ${functionName} Cloud Function triggered ---`);
        console.log(`${functionName} called with method:`, req.method);

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        try {
            // Get auth token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized: No token provided' });
                return;
            }

            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // Check admin claim
            if (!decodedToken.admin) {
                res.status(403).json({ error: 'Forbidden: Admin privileges required' });
                return;
            }

            const { uid, isAdmin } = req.body;
            if (!uid || typeof uid !== "string") {
                res.status(400).json({ error: 'A valid user ID (UID) must be provided.' });
                return;
            }
            if (typeof isAdmin !== "boolean") {
                res.status(400).json({ error: 'A valid admin status (boolean) must be provided.' });
                return;
            }

            console.log(`Attempting to set admin=${isAdmin} for user ${uid} by admin ${decodedToken.uid}`);
            await admin.auth().setCustomUserClaims(uid, { admin: isAdmin ? true : null });
            console.log(`Successfully set admin=${isAdmin} for user ${uid}.`);

            res.status(200).json({ result: `Successfully set admin=${isAdmin} for user ${uid}.` });

        } catch (error: any) {
            console.error(`Error in ${functionName}:`, error);
            res.status(500).json({
                error: `Failed to set admin role: ${error.message || 'Unknown internal server error.'}`,
                code: error.code || 'unknown'
            });
        }
    });
});

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

// HTTP version with CORS support
export const setUserDisabledStatusHttp = createHttpFunction(async (req, res) => {
    const functionName = 'setUserDisabledStatusHttp';

    // Handle CORS
    corsHandler(req, res, async () => {
        console.log(`--- ${functionName} Cloud Function triggered ---`);
        console.log(`${functionName} called with method:`, req.method);

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        try {
            // Get auth token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized: No token provided' });
                return;
            }

            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // Check admin claim
            if (!decodedToken.admin) {
                res.status(403).json({ error: 'Forbidden: Admin privileges required' });
                return;
            }

            const { uid, disabled } = req.body;
            if (!uid || typeof uid !== "string") {
                res.status(400).json({ error: 'A valid user ID (UID) must be provided.' });
                return;
            }
            if (typeof disabled !== "boolean") {
                res.status(400).json({ error: 'A valid disabled status (boolean) must be provided.' });
                return;
            }

            console.log(`Attempting to set disabled=${disabled} for user ${uid} by admin ${decodedToken.uid}`);
            await admin.auth().updateUser(uid, { disabled });
            console.log(`Successfully set disabled=${disabled} for user ${uid}.`);

            res.status(200).json({ result: `Successfully set disabled=${disabled} for user ${uid}.` });

        } catch (error: any) {
            console.error(`Error in ${functionName}:`, error);
            res.status(500).json({
                error: `Failed to set disabled status: ${error.message || 'Unknown internal server error.'}`,
                code: error.code || 'unknown'
            });
        }
    });
});

/**
 * نوع بيانات طلب إنشاء مستخدم جديد
 */
interface CreateUserRequest {
    email: string;
    password: string;
    name: string;
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
        if (!name || typeof name !== "string") {
            console.error(`${functionName} error: Invalid name provided.`);
            throw new functions.https.HttpsError("invalid-argument", "A valid name must be provided.");
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

        console.log(`Attempting to create user ${email} by admin ${request.auth?.uid}`);
        const userRecord = await admin.auth().createUser({ email, password, displayName: name });
        console.log(`User ${email} created with UID ${userRecord.uid}.`);

        // تعيين الخصائص حسب الدور والنوع
        const customClaims: Record<string, any> = {
            role,
            accountType
        };

        // إضافة معلومات المؤسسة إذا كان نوع الحساب مؤسسة
        if (accountType === 'organization' && organizationId) {
            customClaims.organizationId = organizationId;
            if (departmentId) {
                customClaims.departmentId = departmentId;
            }
        }

        if (role === 'owner') {
            customClaims.owner = true;
            customClaims.admin = true; // المالك هو مسؤول أيضًا
            console.log(`Setting owner and admin claims for user ${userRecord.uid}.`);
        } else if (role === 'admin') {
            customClaims.admin = true;
            console.log(`Setting admin claim for user ${userRecord.uid}.`);
        } else if (role === 'individual_admin') {
            customClaims.individual_admin = true;
            console.log(`Setting individual_admin claim for user ${userRecord.uid}.`);
        } else {
            console.log(`Setting role claim '${role}' for user ${userRecord.uid}.`);
        }

        console.log(`Setting account type claim '${accountType}' for user ${userRecord.uid}.`);
        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        // Save additional user data in Firestore
        console.log(`Saving user data to Firestore for user ${userRecord.uid}`);

        if (accountType === 'individual') {
            // إذا كان نوع الحساب فردي، نحفظ البيانات في مجموعة individuals
            await db.collection('individuals').doc(userRecord.uid).set({
                name: name,
                email: email,
                role: role,
                accountType: accountType,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // إذا كان نوع الحساب مؤسسة، نحفظ البيانات في مجموعة users
            await db.collection('users').doc(userRecord.uid).set({
                name: name,
                email: email,
                role: role,
                accountType: accountType,
                organizationId: organizationId,
                departmentId: departmentId || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // إضافة المستخدم كعضو في المؤسسة
            if (organizationId) {
                await db.collection('organizations').doc(organizationId).collection('members').doc(userRecord.uid).set({
                    role: role,
                    departmentId: departmentId || null,
                    joinedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
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

// HTTP version with CORS support
export const createUserHttp = createHttpFunction(async (req, res) => {
    const functionName = 'createUserHttp';

    // Handle CORS
    corsHandler(req, res, async () => {
        console.log(`--- ${functionName} Cloud Function triggered ---`);
        console.log(`${functionName} called with method:`, req.method);

        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        // Only allow POST requests
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method Not Allowed' });
            return;
        }

        try {
            // Get auth token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({ error: 'Unauthorized: No token provided' });
                return;
            }

            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // Check admin claim
            if (!decodedToken.admin) {
                res.status(403).json({ error: 'Forbidden: Admin privileges required' });
                return;
            }

            const { email, password, name, role, accountType, organizationId } = req.body;

            // التحقق من نوع الحساب والمؤسسة
            const callerOrganizationId = decodedToken.organizationId;
            const callerAccountType = decodedToken.accountType;

            // إذا كان المستخدم مسؤول مؤسسة، يجب أن يضيف مستخدمين للمؤسسة نفسها فقط
            if (callerAccountType === 'organization' && callerOrganizationId) {
                // لا يمكن لمسؤول المؤسسة إنشاء مستخدم مستقل
                if (accountType === 'individual' || role === 'independent') {
                    res.status(403).json({ error: 'لا يمكن لمسؤول المؤسسة إنشاء مستخدم مستقل' });
                    return;
                }

                // لا يمكن لمسؤول المؤسسة إنشاء مستخدم لمؤسسة أخرى
                if (organizationId && organizationId !== callerOrganizationId) {
                    res.status(403).json({ error: 'لا يمكن لمسؤول المؤسسة إنشاء مستخدم لمؤسسة أخرى' });
                    return;
                }

                // إذا لم يتم تحديد معرف المؤسسة، استخدم معرف مؤسسة المستخدم الحالي
                const effectiveOrgId = organizationId || callerOrganizationId;

                console.log(`Organization admin ${decodedToken.uid} creating user for organization ${effectiveOrgId}`);
            }

            // Basic input validation
            if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                res.status(400).json({ error: 'A valid email must be provided.' });
                return;
            }
            if (!password || typeof password !== "string" || password.length < 6) {
                res.status(400).json({ error: 'A valid password (at least 6 characters) must be provided.' });
                return;
            }
            if (!name || typeof name !== "string") {
                res.status(400).json({ error: 'A valid name must be provided.' });
                return;
            }

            // Validate role - now supporting extended roles
            const validRoles = ['owner', 'admin', 'individual_admin', 'engineer', 'supervisor', 'technician', 'assistant', 'user', 'independent'];
            if (!role || typeof role !== "string" || !validRoles.includes(role)) {
                res.status(400).json({
                    error: `A valid role must be provided. Valid roles are: ${validRoles.join(', ')}`
                });
                return;
            }

            // إذا كان نوع الحساب فردي، نتأكد من أن الدور هو 'independent'
            let effectiveRole = role;
            if (accountType === 'individual' && role !== 'independent' && role !== 'owner' && role !== 'admin' && role !== 'individual_admin') {
                console.log(`${functionName}: Changing role from '${role}' to 'independent' for individual account type`);
                effectiveRole = 'independent';
            }

            // التحقق من أن المستدعي مالك إذا كان يحاول إنشاء مستخدم بدور مالك أو مسؤول
            if ((role === 'owner' || role === 'admin') && !decodedToken.owner) {
                res.status(403).json({ error: 'فقط المالك يمكنه إنشاء مستخدمين بدور مالك أو مسؤول.' });
                return;
            }

            // التحقق من نوع الحساب
            if (!accountType || (accountType !== 'organization' && accountType !== 'individual')) {
                res.status(400).json({ error: 'يجب تحديد نوع الحساب (organization أو individual).' });
                return;
            }

            // إذا كان المستخدم مسؤول مؤسسة، يجب أن يضيف مستخدمين للمؤسسة نفسها فقط
            if (decodedToken.accountType === 'organization' && decodedToken.organizationId) {
                // لا يمكن لمسؤول المؤسسة إنشاء مستخدم مستقل
                if (accountType === 'individual' || role === 'independent') {
                    res.status(403).json({ error: 'لا يمكن لمسؤول المؤسسة إنشاء مستخدم مستقل.' });
                    return;
                }

                // لا يمكن لمسؤول المؤسسة إنشاء مستخدم لمؤسسة أخرى
                if (organizationId && organizationId !== decodedToken.organizationId) {
                    res.status(403).json({ error: 'لا يمكن لمسؤول المؤسسة إنشاء مستخدم لمؤسسة أخرى.' });
                    return;
                }
            }

            // تحديد نوع الحساب والمؤسسة
            let effectiveAccountType = accountType;
            let effectiveOrgId = organizationId;

            // إذا كان المستخدم مسؤول مؤسسة، نضمن أن المستخدم الجديد ينتمي لنفس المؤسسة
            if (decodedToken.accountType === 'organization' && decodedToken.organizationId) {
                effectiveAccountType = 'organization'; // إجبار نوع الحساب ليكون مؤسسة
                effectiveOrgId = decodedToken.organizationId; // استخدام معرف مؤسسة المستخدم الحالي
                console.log(`Forcing organization account type and organization ID ${effectiveOrgId} for new user`);
            }

            console.log(`Attempting to create user ${email} with role ${effectiveRole} by admin ${decodedToken.uid}`);
            console.log(`Account type: ${effectiveAccountType}, Organization ID: ${effectiveOrgId || 'N/A'}`);

            const userRecord = await admin.auth().createUser({ email, password, displayName: name });
            console.log(`User ${email} created with UID ${userRecord.uid}.`);

            // تعيين الخصائص حسب الدور
            const customClaims: Record<string, any> = {
                role: effectiveRole,
                accountType: effectiveAccountType
            };

            // إضافة معرف المؤسسة إذا كان نوع الحساب مؤسسة
            if (effectiveAccountType === 'organization' && effectiveOrgId) {
                customClaims.organizationId = effectiveOrgId;
            }

            if (role === 'owner') {
                customClaims.owner = true;
                customClaims.admin = true; // المالك هو مسؤول أيضًا
                console.log(`Setting owner and admin claims for user ${userRecord.uid}.`);
            } else if (role === 'admin') {
                customClaims.admin = true;
                console.log(`Setting admin claim for user ${userRecord.uid}.`);
            } else if (role === 'individual_admin') {
                customClaims.individual_admin = true;
                console.log(`Setting individual_admin claim for user ${userRecord.uid}.`);
            } else {
                console.log(`Setting role claim '${role}' for user ${userRecord.uid}.`);
            }

            await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

            // Save additional user data in Firestore
            console.log(`Saving user data to Firestore for user ${userRecord.uid}`);

            // إنشاء كائن userData مع الخصائص الأساسية
            const userData: Record<string, any> = {
                name: name,
                email: email,
                role: effectiveRole,
                accountType: effectiveAccountType,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: decodedToken.uid
            };

            // إضافة معلومات المؤسسة إذا كان نوع الحساب مؤسسة
            if (effectiveAccountType === 'organization' && effectiveOrgId) {
                userData.organizationId = effectiveOrgId;
            }

            await db.collection('users').doc(userRecord.uid).set(userData);

            // إذا كان المستخدم ينتمي لمؤسسة، أضفه كعضو في المؤسسة
            if (effectiveAccountType === 'organization' && effectiveOrgId) {
                try {
                    // التحقق من وجود المؤسسة
                    const orgDoc = await db.collection('organizations').doc(effectiveOrgId).get();
                    if (!orgDoc.exists) {
                        console.error(`Organization ${effectiveOrgId} does not exist`);
                        res.status(400).json({ error: `المؤسسة غير موجودة` });
                        return;
                    }

                    // إضافة المستخدم كعضو في المؤسسة
                    await db.collection('organizations').doc(effectiveOrgId).collection('members').doc(userRecord.uid).set({
                        role: effectiveRole,
                        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                        addedBy: decodedToken.uid
                    });

                    console.log(`Added user ${userRecord.uid} as member of organization ${effectiveOrgId}`);

                    // إضافة معلومات المؤسسة إلى وثيقة المستخدم
                    const orgData = orgDoc.data();
                    await db.collection('users').doc(userRecord.uid).update({
                        organizationName: orgData?.name || '',
                        organizationRole: effectiveRole
                    });

                    console.log(`Updated user ${userRecord.uid} with organization info`);
                } catch (error) {
                    console.error(`Error adding user to organization: ${error}`);
                    // نستمر في العملية حتى لو فشلت إضافة المستخدم للمؤسسة
                }
            }

            console.log(`Successfully created user ${email} (UID: ${userRecord.uid}) with role '${effectiveRole}'.`);
            res.status(200).json({ uid: userRecord.uid });

        } catch (error: any) {
            console.error(`Error in ${functionName}:`, error);

            let statusCode = 500;
            let errorMessage = `Failed to create user: ${error.message || 'Unknown internal server error.'}`;

            if (error.code === 'auth/email-already-exists') {
                statusCode = 400;
                errorMessage = 'فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.';
            } else if (error.code === 'auth/invalid-password') {
                statusCode = 400;
                errorMessage = 'فشل إنشاء المستخدم: كلمة المرور غير صالحة (يجب أن تكون 6 أحرف على الأقل).';
            }

            res.status(statusCode).json({
                error: errorMessage,
                code: error.code || 'unknown'
            });
        }
    });
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
export * from './individual';

// Import and export organization functions
// Exportamos todo excepto las funciones que causan conflicto
export {
  createOrganization,
  getOrganization,
  updateOrganization,
  addOrganizationMember,
  removeOrganizationMember,
  getOrganizationMembers,
  getOrganizationMembersHttp,
  requestOrganization,
  approveOrganizationRequest,
  rejectOrganizationRequest,
  inviteUserToOrganization,
  acceptOrganizationInvitation,
  rejectOrganizationInvitation,
  createOkrPeriod,
  getOkrPeriods,
  updateOkrPeriod,
  deleteOkrPeriod,
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

// Import and export authentication functions
export * from './auth';

// Import and export AI functions
export * from './ai';

/**
 * دالة لتعيين المستخدم كمالك بشكل مباشر
 * لا تتطلب أي صلاحيات (مؤقتًا لحل المشكلة)
 */
export const setOwnerDirectHttp = onRequest(async (req, res) => {
    // إعداد CORS
    corsHandler(req, res, async () => {
        console.log("[setOwnerDirectHttp] Function called");

        try {
            // التحقق من المصادقة
            if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
                console.error("[setOwnerDirectHttp] No authorization token provided");
                res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
                return;
            }

            const idToken = req.headers.authorization.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const uid = req.query.uid as string || decodedToken.uid;

            if (!uid) {
                console.error("[setOwnerDirectHttp] No user ID provided");
                res.status(400).json({ error: 'يجب توفير معرف المستخدم.' });
                return;
            }

            // تعيين المستخدم كمالك
            console.log(`[setOwnerDirectHttp] Setting user ${uid} as owner`);

            // الحصول على معلومات المستخدم الحالية
            const userRecord = await admin.auth().getUser(uid);
            const currentClaims = userRecord.customClaims || {};

            // تعيين خاصية owner مع الحفاظ على الخصائص الأخرى
            const newClaims = {
                ...currentClaims,
                owner: true,
                admin: true,
                role: 'owner'
            };

            // تحديث custom claims
            await admin.auth().setCustomUserClaims(uid, newClaims);

            // تحديث وثيقة المستخدم في Firestore
            await db.collection('users').doc(uid).update({
                role: 'owner',
                isOwner: true,
                isAdmin: true,
                updatedAt: new Date()
            });

            res.status(200).json({
                success: true,
                message: 'تم تعيين المستخدم كمالك بنجاح.',
                claims: newClaims
            });

        } catch (error: any) {
            console.error("[setOwnerDirectHttp] Error:", error);
            res.status(500).json({ error: `حدث خطأ أثناء تعيين المستخدم كمالك: ${error.message}` });
        }
    });
});

/**
 * دالة لجلب قائمة المستخدمين من Firebase Authentication
 * تتطلب أن يكون المستدعي مالكًا أو مسؤولًا
 * إذا كان المستدعي مالكًا، يتم عرض جميع المستخدمين
 * إذا كان المستدعي مسؤولًا في مؤسسة، يتم عرض مستخدمي المؤسسة فقط
 */
export const listUsersHttp = onRequest(async (req, res) => {
    // إعداد CORS
    corsHandler(req, res, async () => {
        console.log("[listUsersHttp] Function called");

        try {
            // التحقق من المصادقة
            if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
                console.error("[listUsersHttp] No authorization token provided");
                res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
                return;
            }

            const idToken = req.headers.authorization.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // التحقق من صلاحيات المستخدم
            if (!decodedToken.owner && !decodedToken.admin) {
                console.error(`[listUsersHttp] User ${decodedToken.uid} is not an owner or admin`);
                res.status(403).json({ error: 'يجب أن تكون مالكًا أو مسؤولًا للوصول إلى هذه الوظيفة.' });
                return;
            }

            // جلب قائمة المستخدمين
            const userRecords = await admin.auth().listUsers();
            let filteredUsers: admin.auth.UserRecord[] = [];

            // إذا كان المستخدم مالكًا، يمكنه رؤية جميع المستخدمين
            if (decodedToken.owner) {
                console.log(`[listUsersHttp] User ${decodedToken.uid} is an owner, showing all users`);
                filteredUsers = userRecords.users;
            }
            // إذا كان المستخدم مسؤولًا في مؤسسة، يمكنه رؤية مستخدمي المؤسسة فقط
            else if (decodedToken.admin && decodedToken.organizationId) {
                console.log(`[listUsersHttp] User ${decodedToken.uid} is an admin in organization ${decodedToken.organizationId}, filtering users`);

                // الحصول على قائمة أعضاء المؤسسة
                const membersSnapshot = await db.collection('organizations')
                    .doc(decodedToken.organizationId)
                    .collection('members')
                    .get();

                const memberIds = new Set(membersSnapshot.docs.map(doc => doc.id));

                // فلترة المستخدمين حسب العضوية في المؤسسة
                filteredUsers = userRecords.users.filter(user => {
                    // التحقق من أن المستخدم عضو في المؤسسة
                    const isMember = memberIds.has(user.uid);

                    // التحقق من أن المستخدم ينتمي للمؤسسة في custom claims
                    const userClaims = user.customClaims || {};
                    const isOrgMember = userClaims.organizationId === decodedToken.organizationId;

                    return isMember || isOrgMember;
                });
            }
            // إذا كان المستخدم مسؤولًا عامًا (غير منتمي لمؤسسة)، يمكنه رؤية المستخدمين المستقلين فقط
            else if (decodedToken.admin) {
                console.log(`[listUsersHttp] User ${decodedToken.uid} is a general admin, showing individual users only`);

                // فلترة المستخدمين المستقلين فقط
                filteredUsers = userRecords.users.filter(user => {
                    const userClaims = user.customClaims || {};
                    return userClaims.accountType === 'individual' || !userClaims.accountType;
                });
            }

            // تحويل البيانات إلى تنسيق مناسب
            const users = filteredUsers.map(user => ({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                disabled: user.disabled,
                customClaims: user.customClaims
            }));

            res.status(200).json({ users });

        } catch (error: any) {
            console.error("[listUsersHttp] Error:", error);
            res.status(500).json({ error: `حدث خطأ أثناء جلب قائمة المستخدمين: ${error.message}` });
        }
    });
});

/**
 * دالة لجلب معلومات مستخدم واحد بواسطة معرف المستخدم
 * تتطلب أن يكون المستدعي مالكًا أو مسؤولًا أو عضوًا في نفس المؤسسة
 */
export const getUserHttp = onRequest(async (req, res) => {
    // إعداد CORS
    corsHandler(req, res, async () => {
        console.log("[getUserHttp] Function called");

        try {
            // التحقق من المصادقة
            if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
                console.error("[getUserHttp] No authorization token provided");
                res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
                return;
            }

            const idToken = req.headers.authorization.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // الحصول على معرف المستخدم المطلوب
            const uid = req.query.uid as string;

            if (!uid) {
                console.error("[getUserHttp] No user ID provided");
                res.status(400).json({ error: 'يجب توفير معرف المستخدم.' });
                return;
            }

            console.log(`[getUserHttp] User ${decodedToken.uid} is requesting info for user ${uid}`);

            // التحقق من صلاحيات المستخدم
            // إذا كان المستخدم مالكًا أو مسؤولًا، يمكنه الوصول إلى أي مستخدم
            if (!decodedToken.owner && !decodedToken.admin) {
                // إذا كان المستخدم ليس مالكًا أو مسؤولًا، نتحقق من أنه يطلب معلومات مستخدم في نفس المؤسسة

                // التحقق من أن المستخدم ينتمي لمؤسسة
                if (!decodedToken.organizationId) {
                    console.error(`[getUserHttp] User ${decodedToken.uid} is not in an organization and not an admin/owner`);
                    res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى معلومات هذا المستخدم.' });
                    return;
                }

                // التحقق من أن المستخدم المطلوب ينتمي لنفس المؤسسة
                const memberDoc = await db.collection('organizations')
                    .doc(decodedToken.organizationId)
                    .collection('members')
                    .doc(uid)
                    .get();

                if (!memberDoc.exists) {
                    console.error(`[getUserHttp] User ${uid} is not in the same organization as ${decodedToken.uid}`);
                    res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى معلومات هذا المستخدم.' });
                    return;
                }
            }

            // الحصول على معلومات المستخدم
            const userRecord = await admin.auth().getUser(uid);

            // الحصول على معلومات إضافية من Firestore
            let firestoreData: any = null;
            try {
                const userDoc = await db.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    firestoreData = userDoc.data() || null;
                }
            } catch (err) {
                console.error(`[getUserHttp] Error fetching Firestore data for user ${uid}:`, err);
            }

            // دمج معلومات المستخدم
            const userData = {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                disabled: userRecord.disabled,
                customClaims: userRecord.customClaims,
                firestoreData
            };

            res.status(200).json(userData);
        } catch (error: any) {
            console.error("[getUserHttp] Error:", error);
            res.status(500).json({ error: `حدث خطأ أثناء جلب معلومات المستخدم: ${error.message}` });
        }
    });
});
