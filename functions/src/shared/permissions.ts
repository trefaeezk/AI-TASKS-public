/**
 * وظائف مشتركة للتعامل مع الصلاحيات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './utils';

// استيراد أنواع الصلاحيات من ملف types/user.ts - النظام الجديد (النمط is* فقط)
export type UserRole =
  // أدوار النظام العامة
  | 'isSystemOwner'    // مالك النظام (أعلى صلاحية)
  | 'isSystemAdmin'    // أدمن النظام العام
  | 'isIndependent'    // مستخدم مستقل (فردي)

  // أدوار المؤسسات
  | 'isOrgOwner'       // مالك المؤسسة
  | 'isOrgAdmin'       // أدمن المؤسسة
  | 'isOrgSupervisor'  // مشرف
  | 'isOrgEngineer'    // مهندس
  | 'isOrgTechnician'  // فني
  | 'isOrgAssistant';  // مساعد فني

export type PermissionArea =
  | 'users'      // إدارة المستخدمين
  | 'tasks'      // إدارة المهام
  | 'reports'    // التقارير
  | 'settings'   // الإعدادات
  | 'tools'      // الأدوات
  | 'dashboard'  // لوحة المعلومات
  | 'data';      // إدارة البيانات (تصدير/استيراد)

export type PermissionAction =
  | 'view'       // عرض
  | 'create'     // إنشاء
  | 'edit'       // تعديل
  | 'delete'     // حذف
  | 'approve'    // موافقة/اعتماد
  | 'assign';    // تعيين/إسناد

export type Permission = {
  area: PermissionArea;
  action: PermissionAction;
};

export type PermissionKey = `${PermissionArea}:${PermissionAction}`;

// تحويل كائن الصلاحية إلى مفتاح
export const permissionToKey = (permission: Permission): PermissionKey =>
  `${permission.area}:${permission.action}`;

// تحويل المفتاح إلى كائن الصلاحية
export const keyToPermission = (key: PermissionKey): Permission => {
  const [area, action] = key.split(':') as [PermissionArea, PermissionAction];
  return { area, action };
};

// الصلاحيات الافتراضية لكل دور - النظام الجديد
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  // مالك النظام - أعلى صلاحية في النظام بالكامل
  isSystemOwner: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // أدمن النظام العام - صلاحيات واسعة لإدارة النظام
  isSystemAdmin: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // مالك المؤسسة - صلاحيات كاملة داخل المؤسسة
  isOrgOwner: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // أدمن المؤسسة - صلاحيات إدارية واسعة داخل المؤسسة
  isOrgAdmin: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:edit',
    'tools:view', 'tools:create', 'tools:edit',
    'dashboard:view', 'dashboard:create', 'dashboard:edit',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // المهندس لديه صلاحيات واسعة تتناسب مع منصبه العالي في الهيكل التنظيمي
  isOrgEngineer: [
    // إدارة المستخدمين - صلاحيات واسعة
    'users:view', 'users:create', 'users:edit', 'users:assign',

    // إدارة المهام - صلاحيات كاملة
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',

    // إدارة التقارير - صلاحيات كاملة
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve',

    // إدارة الإعدادات - صلاحيات واسعة
    'settings:view', 'settings:create', 'settings:edit',

    // إدارة الأدوات - صلاحيات كاملة
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete',

    // إدارة لوحة المعلومات - صلاحيات كاملة
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete',

    // إدارة البيانات - صلاحيات كاملة للاستيراد والتصدير
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // المشرف يركز على إدارة المهام والتقارير
  isOrgSupervisor: [
    'users:view',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit',
    'settings:view',
    'tools:view', 'tools:edit',
    'dashboard:view'
  ],

  // الفني يركز على تنفيذ المهام
  isOrgTechnician: [
    'tasks:view', 'tasks:edit',
    'reports:view', 'reports:create',
    'tools:view', 'tools:edit',
    'dashboard:view'
  ],

  // مساعد الفني لديه صلاحيات محدودة
  isOrgAssistant: [
    'tasks:view',
    'reports:view', 'reports:create',
    'tools:view',
    'dashboard:view'
  ],

  // المستخدم المستقل (الفردي) لديه صلاحيات كاملة على المحتوى الخاص به فقط
  isIndependent: [
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete',
    'tools:view', 'tools:create', 'tools:edit',
    'dashboard:view', 'dashboard:edit',
    'settings:view', 'settings:edit',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ]
};

// التحقق مما إذا كان المستخدم يملك صلاحية معينة
export const hasPermission = async (
  userId: string,
  requiredPermission: Permission | PermissionKey
): Promise<boolean> => {
  try {
    // تحويل الصلاحية المطلوبة إلى مفتاح
    const permissionKey = typeof requiredPermission === 'string'
      ? requiredPermission
      : permissionToKey(requiredPermission);

    // الحصول على معلومات المستخدم من Firebase Auth
    const userRecord = await admin.auth().getUser(userId);
    const customClaims = userRecord.customClaims || {};
    const userRole = customClaims.role as UserRole || 'isIndependent';

    // الحصول على الصلاحيات الافتراضية للدور
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    // التحقق من الأدوار عالية المستوى في النظام الجديد

    // مالك النظام - أعلى صلاحية
    if (customClaims.isSystemOwner === true || userRole === 'isSystemOwner') {
      return true;
    }

    // أدمن النظام العام - صلاحيات واسعة
    if (customClaims.isSystemAdmin === true || userRole === 'isSystemAdmin') {
      return true;
    }

    // مالك المؤسسة - صلاحيات كاملة داخل المؤسسة
    if (customClaims.isOrgOwner === true || userRole === 'isOrgOwner') {
      return true;
    }

    // أدمن المؤسسة - صلاحيات إدارية واسعة داخل المؤسسة
    if (customClaims.isOrgAdmin === true || userRole === 'isOrgAdmin') {
      return true;
    }

    // التحقق من الصلاحيات الافتراضية للدور
    if (defaultPermissions.includes(permissionKey)) {
      return true;
    }

    // الحصول على الصلاحيات المخصصة للمستخدم من Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const customPermissions = userData?.customPermissions || [];

      // التحقق من الصلاحيات المخصصة
      if (customPermissions.includes(permissionKey)) {
        return true;
      }
    }

    // إذا كان المستخدم فرديًا، تحقق من مجموعة individuals
    if (userRole === 'isIndependent') {
      const individualDoc = await db.collection('individuals').doc(userId).get();
      if (individualDoc.exists) {
        const individualData = individualDoc.data();
        const customPermissions = individualData?.customPermissions || [];

        // التحقق من الصلاحيات المخصصة
        if (customPermissions.includes(permissionKey)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking permission for user ${userId}:`, error);
    return false;
  }
};

// الحصول على جميع صلاحيات المستخدم (الافتراضية والمخصصة)
export const getUserPermissions = async (userId: string): Promise<PermissionKey[]> => {
  try {
    // الحصول على معلومات المستخدم من Firebase Auth
    const userRecord = await admin.auth().getUser(userId);
    const customClaims = userRecord.customClaims || {};
    const userRole = customClaims.role as UserRole || 'isIndependent';

    // الحصول على الصلاحيات الافتراضية للدور
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    // التحقق من الأدوار عالية المستوى في النظام الجديد

    // مالك النظام - جميع الصلاحيات
    if (customClaims.isSystemOwner === true || userRole === 'isSystemOwner') {
      return Object.values(DEFAULT_ROLE_PERMISSIONS).flat();
    }

    // أدمن النظام العام - صلاحيات واسعة
    if (customClaims.isSystemAdmin === true || userRole === 'isSystemAdmin') {
      return DEFAULT_ROLE_PERMISSIONS.isSystemAdmin;
    }

    // مالك المؤسسة - صلاحيات كاملة داخل المؤسسة
    if (customClaims.isOrgOwner === true || userRole === 'isOrgOwner') {
      return DEFAULT_ROLE_PERMISSIONS.isOrgOwner;
    }

    // أدمن المؤسسة - صلاحيات إدارية واسعة داخل المؤسسة
    if (customClaims.isOrgAdmin === true || userRole === 'isOrgAdmin') {
      return DEFAULT_ROLE_PERMISSIONS.isOrgAdmin;
    }

    // الحصول على الصلاحيات المخصصة للمستخدم من Firestore
    let customPermissions: PermissionKey[] = [];

    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      customPermissions = userData?.customPermissions || [];
    }

    // إذا كان المستخدم فرديًا، أضف الصلاحيات من مجموعة individuals
    if (userRole === 'isIndependent') {
      const individualDoc = await db.collection('individuals').doc(userId).get();
      if (individualDoc.exists) {
        const individualData = individualDoc.data();
        const individualPermissions = individualData?.customPermissions || [];
        customPermissions = [...customPermissions, ...individualPermissions];
      }
    }

    // دمج الصلاحيات الافتراضية والمخصصة وإزالة التكرار
    return [...new Set([...defaultPermissions, ...customPermissions])];
  } catch (error) {
    console.error(`Error getting permissions for user ${userId}:`, error);
    return [];
  }
};

/**
 * حساب الصلاحيات الأساسية ديناميكياً من الدور (بدون تخزين) - النمط الجديد is* فقط
 */
export function calculateDynamicPermissions(role: string) {
    return {
        canManageSystem: role === 'isSystemOwner',
        canManageUsers: ['isSystemOwner', 'isSystemAdmin'].includes(role),
        canManageOrganization: ['isSystemOwner', 'isSystemAdmin', 'isOrgOwner'].includes(role),
        canManageProjects: ['isSystemOwner', 'isSystemAdmin', 'isOrgOwner', 'isOrgAdmin'].includes(role),
        canViewReports: ['isSystemOwner', 'isSystemAdmin', 'isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer'].includes(role),
        canCreateTasks: !['isOrgAssistant'].includes(role)
    };
}

/**
 * التحقق من أن المستخدم مدير نظام
 * يرمي خطأ إذا لم يكن لديه صلاحيات مدير النظام
 */
export const ensureSystemAdmin = async (context: any): Promise<void> => {
    // التحقق من المصادقة
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول لاستخدام هذه الوظيفة.'
        );
    }

    const userId = context.auth.uid;
    const token = context.auth.token || {};

    // التحقق من الأدوار المسموحة لمدراء النظام
    const isSystemOwner = token.isSystemOwner === true || token.role === 'isSystemOwner';
    const isSystemAdmin = token.isSystemAdmin === true || token.role === 'isSystemAdmin';

    if (!isSystemOwner && !isSystemAdmin) {
        console.error(`[ensureSystemAdmin] User ${userId} attempted to access system admin function without proper permissions`);
        console.error(`[ensureSystemAdmin] User role: ${token.role}`);
        console.error(`[ensureSystemAdmin] User claims:`, token);

        throw new functions.https.HttpsError(
            'permission-denied',
            'ليس لديك صلاحيات مدير النظام المطلوبة لهذه العملية.'
        );
    }

    console.log(`[ensureSystemAdmin] ✅ User ${userId} has system admin permissions (${token.role})`);
};

/**
 * التحقق من أن المستخدم مدير مؤسسة
 * يرمي خطأ إذا لم يكن لديه صلاحيات مدير المؤسسة
 */
export const ensureOrgAdmin = async (context: any, organizationId?: string): Promise<void> => {
    // التحقق من المصادقة
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول لاستخدام هذه الوظيفة.'
        );
    }

    const userId = context.auth.uid;
    const token = context.auth.token || {};

    // مدراء النظام لديهم صلاحيات على جميع المؤسسات
    const isSystemOwner = token.isSystemOwner === true || token.role === 'isSystemOwner';
    const isSystemAdmin = token.isSystemAdmin === true || token.role === 'isSystemAdmin';

    if (isSystemOwner || isSystemAdmin) {
        console.log(`[ensureOrgAdmin] ✅ User ${userId} has system admin permissions`);
        return;
    }

    // التحقق من أدوار المؤسسة
    const isOrgOwner = token.isOrgOwner === true || token.role === 'isOrgOwner';
    const isOrgAdmin = token.isOrgAdmin === true || token.role === 'isOrgAdmin';

    if (!isOrgOwner && !isOrgAdmin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'ليس لديك صلاحيات مدير المؤسسة المطلوبة لهذه العملية.'
        );
    }

    // إذا تم تحديد معرف المؤسسة، تحقق من أن المستخدم ينتمي لنفس المؤسسة
    if (organizationId && token.organizationId !== organizationId) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'ليس لديك صلاحية على هذه المؤسسة.'
        );
    }

    console.log(`[ensureOrgAdmin] ✅ User ${userId} has organization admin permissions`);
};
