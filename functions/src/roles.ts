/**
 * وظائف Firebase لإدارة الأدوار والصلاحيات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './shared/utils';
import { createCallableFunction, LegacyCallableContext } from './shared/function-utils';

/**
 * التحقق من أن المستخدم مسؤول
 */
export const ensureAdmin = (context: LegacyCallableContext): void => {
    console.log('🔍 ensureAdmin: Starting authorization check');

    if (!context.auth) {
        console.error('❌ ensureAdmin: No auth context provided');
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    console.log('🔍 ensureAdmin: Auth context found, checking token');
    console.log('🔍 ensureAdmin: User ID:', context.auth.uid);
    console.log('🔍 ensureAdmin: Token keys:', Object.keys(context.auth.token || {}));

    // التحقق من الأدوار الموحدة حسب الهيكلة المتفق عليها
    const userRole = context.auth.token.role;
    console.log('🔍 ensureAdmin: User role from token:', userRole);

    // أدوار النظام العامة (المستوى 1-2) - النمط الجديد is* فقط
    const isSystemOwner = userRole === 'isSystemOwner' || context.auth.token.isSystemOwner === true;
    const isSystemAdmin = userRole === 'isSystemAdmin' || context.auth.token.isSystemAdmin === true;

    // أدوار المؤسسات (المستوى 3-8) - النمط الجديد is* فقط
    const isOrgOwner = userRole === 'isOrgOwner' || context.auth.token.isOrgOwner === true;
    const isOrgAdmin = userRole === 'isOrgAdmin';
    const isOrgSupervisor = userRole === 'isOrgSupervisor';
    const isOrgEngineer = userRole === 'isOrgEngineer';
    const isOrgTechnician = userRole === 'isOrgTechnician';
    const isOrgAssistant = userRole === 'isOrgAssistant';

    console.log('🔍 ensureAdmin: Role checks:', {
        isSystemOwner,
        isSystemAdmin,
        isOrgOwner,
        isOrgAdmin,
        isOrgSupervisor,
        isOrgEngineer,
        isOrgTechnician,
        isOrgAssistant
    });

    // التحقق من وجود أي دور إداري
    const hasAdminRole = isSystemOwner || isSystemAdmin || isOrgOwner ||
                         isOrgAdmin || isOrgSupervisor || isOrgEngineer ||
                         isOrgTechnician || isOrgAssistant;

    console.log('🔍 ensureAdmin: Has admin role:', hasAdminRole);

    if (!hasAdminRole) {
        console.error('❌ ensureAdmin: User does not have admin role');
        console.error('❌ ensureAdmin: User token:', JSON.stringify(context.auth.token, null, 2));
        throw new functions.https.HttpsError(
            'permission-denied',
            `ليس لديك صلاحيات إدارية. الدور الحالي: ${userRole || 'غير محدد'}`
        );
    }

    console.log(`✅ ensureAdmin: Authorization Success - User ${context.auth.uid} is an admin with role: ${userRole}`);
};

/**
 * التحقق من أن المستخدم مسؤول (للوظائف HTTP)
 */
export const ensureAdminHttp = async (req: functions.https.Request): Promise<string> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // التحقق من الأدوار الموحدة حسب الهيكلة المتفق عليها
    const userRole = decodedToken.role;

    // النمط الموحد is* فقط (بدون توافق مع القديم)
    const isSystemOwner = decodedToken.isSystemOwner === true;
    const isSystemAdmin = decodedToken.isSystemAdmin === true;
    const isOrgOwner = decodedToken.isOrgOwner === true;
    const isOrgAdmin = decodedToken.isOrgAdmin === true;
    const isOrgSupervisor = decodedToken.isOrgSupervisor === true;
    const isOrgEngineer = decodedToken.isOrgEngineer === true;
    const isOrgTechnician = decodedToken.isOrgTechnician === true;
    const isOrgAssistant = decodedToken.isOrgAssistant === true;

    // التحقق من وجود أي دور إداري
    const hasAdminRole = isSystemOwner || isSystemAdmin || isOrgOwner ||
                         isOrgAdmin || isOrgSupervisor || isOrgEngineer ||
                         isOrgTechnician || isOrgAssistant;

    if (!hasAdminRole) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'يجب أن تكون مسؤولاً للوصول إلى هذه الوظيفة.'
        );
    }

    console.log(`Authorization Success: User ${decodedToken.uid} is an admin.`);
    return decodedToken.uid;
};

/**
 * نوع بيانات طلب تحديث دور المستخدم
 */
interface UpdateUserRoleRequest {
    uid: string;
    role: string;
}

/**
 * تحديث دور المستخدم
 */
export const updateUserRole = createCallableFunction<UpdateUserRoleRequest>(async (request) => {
    const functionName = 'updateUserRole';
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

        ensureAdmin(context);

        const { uid, role } = request.data;
        console.log(`Updating role for user ${uid} to ${role}`);

        // الحصول على معلومات المستخدم الحالية
        const userRecord = await admin.auth().getUser(uid);
        const currentClaims = userRecord.customClaims || {};

        // تحديث Custom Claims (النمط الموحد is* فقط)
        const newClaims = {
            role: role,
            accountType: currentClaims.accountType,
            organizationId: currentClaims.organizationId,
            departmentId: currentClaims.departmentId,
            name: currentClaims.name,
            // النمط الموحد is* فقط (بدون تكرار أو توافق مع الأدوار القديمة)
            isSystemOwner: role === 'isSystemOwner',
            isSystemAdmin: role === 'isSystemAdmin',
            isOrgOwner: role === 'isOrgOwner',
            isOrgAdmin: role === 'isOrgAdmin',
            isOrgSupervisor: role === 'isOrgSupervisor',
            isOrgEngineer: role === 'isOrgEngineer',
            isOrgTechnician: role === 'isOrgTechnician',
            isOrgAssistant: role === 'isOrgAssistant',
            isIndependent: role === 'isIndependent',
            disabled: currentClaims.disabled || false,
            customPermissions: currentClaims.customPermissions || []
        };

        await admin.auth().setCustomUserClaims(uid, newClaims);

        // تحديث Firestore في مجموعة users
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        // حساب الأدوار المنطقية والصلاحيات الجديدة (النمط is* فقط)
        const roleFlags = {
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
        };

        if (userDoc.exists) {
            await userDocRef.update({
                role,
                ...roleFlags,
                // حذف الصلاحيات المخزنة - ستحسب ديناميكياً
                canManageSystem: admin.firestore.FieldValue.delete(),
                canManageUsers: admin.firestore.FieldValue.delete(),
                canManageOrganization: admin.firestore.FieldValue.delete(),
                canManageProjects: admin.firestore.FieldValue.delete(),
                canViewReports: admin.firestore.FieldValue.delete(),
                canCreateTasks: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // إنشاء وثيقة جديدة إذا لم تكن موجودة
            await userDocRef.set({
                role,
                uid,
                email: userRecord.email,
                name: userRecord.displayName || '',
                ...roleFlags,
                customPermissions: [],
                disabled: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        console.log(`Successfully updated role for user ${uid} to ${role}`);
        return { result: 'success' };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        throw new functions.https.HttpsError("internal", error.message || 'Failed to update user role');
    }
});

/**
 * نوع بيانات طلب تحديث صلاحيات المستخدم
 */
interface UpdateUserPermissionsRequest {
    uid: string;
    permissions: string[];
}

/**
 * تحديث صلاحيات المستخدم
 */
export const updateUserPermissions = createCallableFunction<UpdateUserPermissionsRequest>(async (request) => {
    const functionName = 'updateUserPermissions';
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

        ensureAdmin(context);

        const { uid, permissions } = request.data;
        console.log(`Updating permissions for user ${uid}:`, permissions);

        // الحصول على معلومات المستخدم الحالية
        const userRecord = await admin.auth().getUser(uid);
        const currentClaims = userRecord.customClaims || {};

        // تحديث Custom Claims مع الحفاظ على البيانات الأخرى
        const newClaims = {
            ...currentClaims,
            customPermissions: permissions
        };

        await admin.auth().setCustomUserClaims(uid, newClaims);

        // تحديث Firestore في مجموعة users
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            await userDocRef.update({
                customPermissions: permissions,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // إنشاء وثيقة جديدة إذا لم تكن موجودة
            await userDocRef.set({
                customPermissions: permissions,
                uid,
                email: userRecord.email,
                name: userRecord.displayName || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        console.log(`Successfully updated permissions for user ${uid}`);
        return { result: 'success' };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        throw new functions.https.HttpsError("internal", error.message || 'Failed to update user permissions');
    }
});

/**
 * نوع بيانات طلب تفعيل/إلغاء تفعيل المستخدم
 */
interface ToggleUserDisabledRequest {
    uid: string;
    disabled: boolean;
}

/**
 * تفعيل/إلغاء تفعيل المستخدم
 */
export const toggleUserDisabled = createCallableFunction<ToggleUserDisabledRequest>(async (request) => {
    const functionName = 'toggleUserDisabled';
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

        ensureAdmin(context);

        const { uid, disabled } = request.data;
        console.log(`${disabled ? 'Disabling' : 'Enabling'} user ${uid}`);

        // تحديث حالة المستخدم في Firebase Auth
        await admin.auth().updateUser(uid, { disabled });

        // تحديث Firestore في مجموعة users
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            await userDocRef.update({
                disabled,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // تحديث Custom Claims
        const userRecord = await admin.auth().getUser(uid);
        const currentClaims = userRecord.customClaims || {};
        const newClaims = {
            ...currentClaims,
            disabled
        };

        await admin.auth().setCustomUserClaims(uid, newClaims);

        console.log(`Successfully ${disabled ? 'disabled' : 'enabled'} user ${uid}`);
        return { result: 'success' };

    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        throw new functions.https.HttpsError("internal", error.message || `Failed to ${request.data.disabled ? 'disable' : 'enable'} user`);
    }
});

// تم حذف وظائف HTTP - لم تعد مطلوبة
