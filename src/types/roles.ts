/**
 * تعريف الأدوار والصلاحيات في النظام
 */

// الأدوار المتاحة في النظام
export type UserRole =
  | 'owner'           // مالك النظام (أعلى صلاحية)
  | 'admin'           // مسؤول النظام
  | 'individual_admin' // مسؤول نظام الأفراد
  | 'engineer'        // مهندس
  | 'supervisor'      // مشرف
  | 'technician'      // فني
  | 'assistant'       // مساعد فني
  | 'user'            // مستخدم عادي
  | 'independent';    // مستخدم مستقل (فردي)

// تعريف مجموعات الصلاحيات
export type PermissionArea =
  | 'users'      // إدارة المستخدمين
  | 'tasks'      // إدارة المهام
  | 'reports'    // التقارير
  | 'settings'   // الإعدادات
  | 'tools'      // الأدوات
  | 'dashboard'  // لوحة المعلومات
  | 'data';      // إدارة البيانات (تصدير/استيراد)

// تعريف أنواع الصلاحيات
export type PermissionAction =
  | 'view'       // عرض
  | 'create'     // إنشاء
  | 'edit'       // تعديل
  | 'delete'     // حذف
  | 'approve'    // موافقة/اعتماد
  | 'assign';    // تعيين/إسناد

// تعريف الصلاحية الكاملة
export type Permission = {
  area: PermissionArea;
  action: PermissionAction;
};

// تعريف مفتاح الصلاحية (للتخزين والبحث)
export type PermissionKey = `${PermissionArea}:${PermissionAction}`;

// تحويل كائن الصلاحية إلى مفتاح
export const permissionToKey = (permission: Permission): PermissionKey =>
  `${permission.area}:${permission.action}`;

// تحويل المفتاح إلى كائن الصلاحية
export const keyToPermission = (key: PermissionKey): Permission => {
  const [area, action] = key.split(':') as [PermissionArea, PermissionAction];
  return { area, action };
};

// تعريف مجموعة الصلاحيات للدور
export type RolePermissions = {
  role: UserRole;
  permissions: PermissionKey[];
  description?: string;
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
    'data:view', 'data:create', 'data:edit', 'data:delete' // صلاحيات إدارة البيانات (تصدير/استيراد)
  ],

  // المسؤول لديه جميع الصلاحيات ما عدا إدارة المالكين وطلبات المؤسسات
  admin: [
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
    'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
    'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
    'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
    'data:view', 'data:create', 'data:edit', 'data:delete' // صلاحيات إدارة البيانات (تصدير/استيراد)
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
    // إدارة البيانات - تصدير واستيراد البيانات الخاصة به
    'data:view', 'data:create', 'data:edit', 'data:delete'
  ],

  // المستخدم المستقل (الفردي) لديه صلاحيات محددة على المحتوى الخاص به فقط
  independent: [
    // المهام - صلاحيات كاملة على المهام الخاصة به فقط
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete',

    // تحليلات المهام (مؤشرات الأداء) - عرض فقط للمهام الخاصة به
    'reports:view',

    // لوحة المعلومات - عرض فقط للمهام الخاصة به
    'dashboard:view',

    // الأدوات - عرض واستخدام الأدوات
    'tools:view', 'tools:create', 'tools:edit',

    // الإعدادات العددية - عرض وتعديل الإعدادات العددية فقط
    'settings:view', 'settings:edit',

    // استيراد وتصدير المهام - للمهام الخاصة به فقط
    'data:view', 'data:create', 'data:edit', 'data:delete'

    // ملاحظة: لا توجد صلاحيات لإدارة المستخدمين (users) أو الموافقة/التعيين
    // ولا صلاحيات لإنشاء تقارير أو تعديلها، فقط عرضها
  ]
};

// وصف الأدوار
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'مالك النظام - لديه جميع الصلاحيات بما فيها إدارة المسؤولين وطلبات المؤسسات',
  admin: 'مسؤول النظام - لديه جميع الصلاحيات ما عدا إدارة المالكين وطلبات المؤسسات',
  individual_admin: 'مسؤول نظام الأفراد - لديه صلاحيات إدارة حسابات الأفراد فقط',
  engineer: 'مهندس - يقوم بتصميم وتخطيط المهام والمشاريع',
  supervisor: 'مشرف - يقوم بالإشراف على تنفيذ المهام',
  technician: 'فني - يقوم بتنفيذ المهام الفنية',
  assistant: 'مساعد فني - يساعد في تنفيذ المهام البسيطة',
  user: 'مستخدم عادي - صلاحيات محدودة للعرض فقط',
  independent: 'مستخدم مستقل - لديه صلاحيات كاملة على المحتوى الخاص به فقط'
};

// ترتيب الأدوار حسب المستوى (للعرض والمقارنة)
export const ROLE_HIERARCHY: UserRole[] = [
  'owner',
  'admin',
  'individual_admin',
  'engineer',
  'supervisor',
  'technician',
  'assistant',
  'user',
  'independent'
];

// التحقق مما إذا كان الدور أعلى من أو يساوي دور آخر
export const isRoleAtLeast = (userRole: UserRole, requiredRole: UserRole): boolean => {
  const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return userRoleIndex <= requiredRoleIndex;
};

// التحقق مما إذا كان المستخدم يملك صلاحية معينة
export const hasPermission = (
  userPermissions: PermissionKey[],
  requiredPermission: Permission | PermissionKey
): boolean => {
  const permissionKey = typeof requiredPermission === 'string'
    ? requiredPermission
    : permissionToKey(requiredPermission);

  return userPermissions.includes(permissionKey);
};
