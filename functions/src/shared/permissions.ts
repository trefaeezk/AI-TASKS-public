/**
 * وظائف مشتركة للتعامل مع الصلاحيات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './utils';

// استيراد أنواع الصلاحيات من ملف types/user.ts
export type UserRole =
  | 'owner'       // مالك النظام (أعلى صلاحية)
  | 'admin'       // مسؤول النظام
  | 'individual_admin' // مسؤول نظام الأفراد
  | 'engineer'    // مهندس
  | 'supervisor'  // مشرف
  | 'technician'  // فني
  | 'assistant'   // مساعد فني
  | 'user'        // مستخدم عادي
  | 'independent';// مستخدم مستقل (فردي)

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

// الصلاحيات الافتراضية لكل دور
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  // المالك لديه جميع الصلاحيات بما فيها إدارة المسؤولين وطلبات المؤسسات
  owner: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // المسؤول لديه جميع الصلاحيات ما عدا إدارة المالكين وطلبات المؤسسات
  admin: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // مسؤول نظام الأفراد لديه صلاحيات إدارة حسابات الأفراد فقط
  individual_admin: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:edit',
    'tools:view', 'tools:create', 'tools:edit',
    'dashboard:view', 'dashboard:create', 'dashboard:edit',
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // المهندس لديه صلاحيات واسعة ولكن أقل من المسؤول
  engineer: [
    'users:view', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:approve',
    'settings:view', 'settings:edit',
    'tools:view', 'tools:create', 'tools:edit',
    'dashboard:view', 'dashboard:edit'
  ],

  // المشرف يركز على إدارة المهام والتقارير
  supervisor: [
    'users:view',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit',
    'settings:view',
    'tools:view', 'tools:edit',
    'dashboard:view'
  ],

  // الفني يركز على تنفيذ المهام
  technician: [
    'tasks:view', 'tasks:edit',
    'reports:view', 'reports:create',
    'tools:view', 'tools:edit',
    'dashboard:view'
  ],

  // مساعد الفني لديه صلاحيات محدودة
  assistant: [
    'tasks:view',
    'reports:view', 'reports:create',
    'tools:view',
    'dashboard:view'
  ],

  // المستخدم العادي لديه صلاحيات العرض فقط
  user: [
    'tasks:view',
    'dashboard:view',
    'data:view', 'data:create', 'data:edit', 'data:delete'
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
    const userRole = customClaims.role as UserRole || 'user';

    // الحصول على الصلاحيات الافتراضية للدور
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    // إذا كان المستخدم مالكًا، فلديه جميع الصلاحيات
    if (customClaims.owner === true) {
      return true;
    }

    // إذا كان المستخدم مسؤولاً، فلديه جميع الصلاحيات ما عدا إدارة المالكين وطلبات المؤسسات
    if (customClaims.admin === true) {
      // التحقق من أن الصلاحية المطلوبة ليست خاصة بالمالك فقط
      const ownerOnlyPermissions = [
        'users:create', 'users:edit', 'users:delete', 'users:approve' // للمستخدمين ذوي دور المالك أو المسؤول
      ];

      if (ownerOnlyPermissions.includes(permissionKey)) {
        // التحقق من أن المستخدم المستهدف ليس مالكًا أو مسؤولًا
        // هذا التحقق سيتم في الدوال المحددة التي تتطلب هذه الصلاحيات
        return false;
      }

      return true;
    }

    // إذا كان المستخدم مسؤول نظام الأفراد، فلديه صلاحيات على حسابات الأفراد فقط
    if (customClaims.individual_admin === true) {
      // التحقق من أن الصلاحية المطلوبة متعلقة بإدارة الأفراد
      if (permissionKey.startsWith('users:')) {
        // سيتم التحقق من نوع الحساب في الدوال المحددة
        return true;
      }
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
    const userRole = customClaims.role as UserRole || 'user';

    // الحصول على الصلاحيات الافتراضية للدور
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    // إذا كان المستخدم مالكًا، فلديه جميع الصلاحيات
    if (customClaims.owner === true) {
      return Object.values(DEFAULT_ROLE_PERMISSIONS).flat();
    }

    // إذا كان المستخدم مسؤولاً، فلديه جميع الصلاحيات ما عدا إدارة المالكين وطلبات المؤسسات
    if (customClaims.admin === true) {
      const allPermissions = Object.values(DEFAULT_ROLE_PERMISSIONS).flat();
      const ownerOnlyPermissions = [
        'users:create', 'users:edit', 'users:delete', 'users:approve' // للمستخدمين ذوي دور المالك أو المسؤول
      ];

      return allPermissions.filter(permission => !ownerOnlyPermissions.includes(permission));
    }

    // إذا كان المستخدم مسؤول نظام الأفراد، فلديه صلاحيات على حسابات الأفراد فقط
    if (customClaims.individual_admin === true) {
      return DEFAULT_ROLE_PERMISSIONS.individual_admin;
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
