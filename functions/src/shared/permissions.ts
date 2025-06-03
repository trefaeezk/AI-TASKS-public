/**
 * وظائف مشتركة للتعامل مع الصلاحيات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './utils';

// استيراد أنواع الصلاحيات من ملف types/user.ts - النظام الجديد
export type UserRole =
  // أدوار النظام العامة
  | 'system_owner'    // مالك النظام (أعلى صلاحية)
  | 'system_admin'    // أدمن النظام العام
  | 'independent'     // مستخدم مستقل (فردي)

  // أدوار المؤسسات
  | 'org_owner' // مالك المؤسسة
  | 'org_admin'       // أدمن المؤسسة
  | 'org_supervisor'  // مشرف
  | 'org_engineer'    // مهندس
  | 'org_technician'  // فني
  | 'org_assistant';  // مساعد فني

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
  system_owner: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // أدمن النظام العام - صلاحيات واسعة لإدارة النظام
  system_admin: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // مالك المؤسسة - صلاحيات كاملة داخل المؤسسة
  org_owner: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // أدمن المؤسسة - صلاحيات إدارية واسعة داخل المؤسسة
  org_admin: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:edit',
    'tools:view', 'tools:create', 'tools:edit',
    'dashboard:view', 'dashboard:create', 'dashboard:edit',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // المهندس لديه صلاحيات واسعة ولكن أقل من المسؤول
  org_engineer: [
    'users:view', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:approve',
    'settings:view', 'settings:edit',
    'tools:view', 'tools:create', 'tools:edit',
    'dashboard:view', 'dashboard:edit'
  ],

  // المشرف يركز على إدارة المهام والتقارير
  org_supervisor: [
    'users:view',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit',
    'settings:view',
    'tools:view', 'tools:edit',
    'dashboard:view'
  ],

  // الفني يركز على تنفيذ المهام
  org_technician: [
    'tasks:view', 'tasks:edit',
    'reports:view', 'reports:create',
    'tools:view', 'tools:edit',
    'dashboard:view'
  ],

  // مساعد الفني لديه صلاحيات محدودة
  org_assistant: [
    'tasks:view',
    'reports:view', 'reports:create',
    'tools:view',
    'dashboard:view'
  ],

  // المستخدم المستقل (الفردي) لديه صلاحيات كاملة على المحتوى الخاص به فقط
  independent: [
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
    const userRole = customClaims.role as UserRole || 'independent';

    // الحصول على الصلاحيات الافتراضية للدور
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    // التحقق من الأدوار عالية المستوى في النظام الجديد

    // مالك النظام - أعلى صلاحية
    if (customClaims.isSystemOwner === true || userRole === 'system_owner') {
      return true;
    }

    // أدمن النظام العام - صلاحيات واسعة
    if (customClaims.isSystemAdmin === true || userRole === 'system_admin') {
      return true;
    }

    // مالك المؤسسة - صلاحيات كاملة داخل المؤسسة
    if (customClaims.isOrgOwner === true || userRole === 'org_owner') {
      return true;
    }

    // أدمن المؤسسة - صلاحيات إدارية واسعة داخل المؤسسة
    if (customClaims.isOrgAdmin === true || userRole === 'org_admin') {
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
    if (userRole === 'independent') {
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
    const userRole = customClaims.role as UserRole || 'independent';

    // الحصول على الصلاحيات الافتراضية للدور
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    // التحقق من الأدوار عالية المستوى في النظام الجديد

    // مالك النظام - جميع الصلاحيات
    if (customClaims.isSystemOwner === true || userRole === 'system_owner') {
      return Object.values(DEFAULT_ROLE_PERMISSIONS).flat();
    }

    // أدمن النظام العام - صلاحيات واسعة
    if (customClaims.isSystemAdmin === true || userRole === 'system_admin') {
      return DEFAULT_ROLE_PERMISSIONS.system_admin;
    }

    // مالك المؤسسة - صلاحيات كاملة داخل المؤسسة
    if (customClaims.isOrgOwner === true || userRole === 'org_owner') {
      return DEFAULT_ROLE_PERMISSIONS.org_owner;
    }

    // أدمن المؤسسة - صلاحيات إدارية واسعة داخل المؤسسة
    if (customClaims.isOrgAdmin === true || userRole === 'org_admin') {
      return DEFAULT_ROLE_PERMISSIONS.org_admin;
    }

    // الحصول على الصلاحيات المخصصة للمستخدم من Firestore
    let customPermissions: PermissionKey[] = [];

    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      customPermissions = userData?.customPermissions || [];
    }

    // إذا كان المستخدم فرديًا، أضف الصلاحيات من مجموعة individuals
    if (userRole === 'independent') {
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
 * حساب الصلاحيات الأساسية ديناميكياً من الدور (بدون تخزين)
 */
export function calculateDynamicPermissions(role: string) {
    return {
        canManageSystem: role === 'system_owner',
        canManageUsers: ['system_owner', 'system_admin'].includes(role),
        canManageOrganization: ['system_owner', 'system_admin', 'org_owner'].includes(role),
        canManageProjects: ['system_owner', 'system_admin', 'org_owner', 'org_admin'].includes(role),
        canViewReports: ['system_owner', 'system_admin', 'org_owner', 'org_admin', 'org_supervisor', 'org_engineer'].includes(role),
        canCreateTasks: !['org_assistant'].includes(role)
    };
}
