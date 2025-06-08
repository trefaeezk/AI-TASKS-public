/**
 * تعريف الأدوار والصلاحيات في النظام
 */

// الأدوار المتاحة في النظام (النمط الجديد is* فقط)
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

// الصلاحيات الافتراضية لكل دور (النمط الجديد is* فقط)
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

  // المهندس لديه صلاحيات واسعة ولكن أقل من المسؤول
  isOrgEngineer: [
    'users:view', 'users:assign',
    'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
    'reports:view', 'reports:create', 'reports:edit', 'reports:approve',
    'settings:view', 'settings:edit',
    'tools:view', 'tools:create', 'tools:edit',
    'dashboard:view', 'dashboard:edit'
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

  // المستخدم المستقل (الفردي) لديه صلاحيات محددة على المحتوى الخاص به فقط
  isIndependent: [
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

// مفاتيح ترجمة وصف الأدوار (النمط الجديد is* فقط)
export const ROLE_DESCRIPTION_KEYS: Record<UserRole, string> = {
  // أدوار النظام العامة
  isSystemOwner: 'roleDescriptions.isSystemOwner',
  isSystemAdmin: 'roleDescriptions.isSystemAdmin',
  isIndependent: 'roleDescriptions.isIndependent',

  // أدوار المؤسسات
  isOrgOwner: 'roleDescriptions.isOrgOwner',
  isOrgAdmin: 'roleDescriptions.isOrgAdmin',
  isOrgSupervisor: 'roleDescriptions.isOrgSupervisor',
  isOrgEngineer: 'roleDescriptions.isOrgEngineer',
  isOrgTechnician: 'roleDescriptions.isOrgTechnician',
  isOrgAssistant: 'roleDescriptions.isOrgAssistant'
};

// ترتيب الأدوار حسب المستوى (للعرض والمقارنة) - النمط الجديد is* فقط
export const ROLE_HIERARCHY: UserRole[] = [
  // أدوار النظام العامة (أعلى مستوى)
  'isSystemOwner',
  'isSystemAdmin',

  // أدوار المؤسسات (حسب المستوى - الهيكل الشرق أوسطي)
  'isOrgOwner',
  'isOrgAdmin',
  'isOrgEngineer',      // المهندس أعلى من المشرف
  'isOrgSupervisor',    // المشرف
  'isOrgTechnician',
  'isOrgAssistant',

  // المستخدمين المستقلين
  'isIndependent'
];

// التحقق مما إذا كان الدور أعلى من أو يساوي دور آخر
export const isRoleAtLeast = (userRole: UserRole, requiredRole: UserRole): boolean => {
  const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);

  // إذا لم يتم العثور على أحد الأدوار، إرجاع false
  if (userRoleIndex === -1 || requiredRoleIndex === -1) {
    return false;
  }

  // المؤشر الأقل يعني دور أعلى (system_owner = 0, independent = 10)
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
