# 📚 توثيق نظام المستخدمين والصلاحيات

## 📋 جدول المحتويات
- [نظرة عامة](#نظرة-عامة)
- [هيكلة الأدوار](#هيكلة-الأدوار)
- [أنواع الحسابات](#أنواع-الحسابات)
- [الصلاحيات التفصيلية](#الصلاحيات-التفصيلية)
- [هيكل قاعدة البيانات](#هيكل-قاعدة-البيانات)
- [إدارة المستخدمين](#إدارة-المستخدمين)
- [أمثلة عملية](#أمثلة-عملية)

---

## 🔍 نظرة عامة

نظام إدارة المهام يدعم نوعين رئيسيين من الحسابات:
- **الحسابات الفردية**: للمستخدمين المستقلين
- **الحسابات المؤسسية**: للمؤسسات والشركات

كل نوع حساب له هيكل أدوار وصلاحيات مختلف يناسب احتياجاته.

---

## 🎭 هيكلة الأدوار

### 🌐 أدوار النظام العامة

| الدور | الاسم بالعربية | الوصف | المستوى |
|-------|----------------|--------|----------|
| `system_owner` | مالك النظام | أعلى صلاحية في النظام بالكامل، يدير جميع الأنظمة والمؤسسات | 1 |
| `system_admin` | أدمن النظام العام | صلاحيات واسعة لإدارة النظام والمؤسسات | 2 |
| `independent` | مستخدم مستقل | يدير مهامه وبياناته الشخصية فقط | 11 |

### 🏢 أدوار المؤسسات

| الدور | الاسم بالعربية | الوصف | المستوى |
|-------|----------------|--------|----------|
| `organization_owner` | مالك المؤسسة | صلاحيات كاملة داخل المؤسسة | 3 |
| `org_admin` | أدمن المؤسسة | صلاحيات إدارية واسعة داخل المؤسسة | 4 |
| `org_supervisor` | مشرف | يشرف على الفرق والمهام ويدير العمليات | 5 |
| `org_engineer` | مهندس | يصمم ويخطط المشاريع والحلول التقنية | 6 |
| `org_technician` | فني | ينفذ المهام التقنية والصيانة | 7 |
| `org_assistant` | مساعد فني | يساعد في تنفيذ المهام البسيطة | 8 |

### 📊 ترتيب الأدوار حسب المستوى
```
1. system_owner (أعلى مستوى)
2. system_admin
3. organization_owner
4. org_admin
5. org_supervisor
6. org_engineer
7. org_technician
8. org_assistant
9. independent (أقل مستوى)
```

---

## 👥 أنواع الحسابات

### 🧑‍💼 الحسابات الفردية (Individual)

**الخصائص:**
- نوع الحساب: `individual`
- الدور الافتراضي: `independent`
- لا ينتمي لمؤسسة
- يدير مهامه الشخصية فقط

**البيانات المطلوبة:**
```typescript
{
  accountType: 'individual',
  role: 'independent',
  organizationId: null,
  departmentId: null
}
```

### 🏢 الحسابات المؤسسية (Organization)

**الخصائص:**
- نوع الحساب: `organization`
- الدور الافتراضي: `org_assistant`
- ينتمي لمؤسسة محددة
- قد ينتمي لقسم داخل المؤسسة

**البيانات المطلوبة:**
```typescript
{
  accountType: 'organization',
  role: 'org_admin' | 'org_supervisor' | 'org_engineer' | 'org_technician' | 'org_assistant',
  organizationId: string,
  departmentId?: string
}
```

---

## 🔐 الصلاحيات التفصيلية

### 📝 مجالات الصلاحيات

| المجال | الوصف | الإجراءات المتاحة |
|--------|--------|-------------------|
| `users` | إدارة المستخدمين | view, create, edit, delete, approve, assign |
| `tasks` | إدارة المهام | view, create, edit, delete, approve, assign |
| `reports` | التقارير | view, create, edit, delete, approve, assign |
| `settings` | الإعدادات | view, create, edit, delete, approve, assign |
| `tools` | الأدوات | view, create, edit, delete, approve, assign |
| `dashboard` | لوحة المعلومات | view, create, edit, delete, approve, assign |
| `data` | إدارة البيانات | view, create, edit, delete |

### 🎯 صلاحيات كل دور

#### 🌟 system_owner
```typescript
// جميع الصلاحيات في جميع المجالات
[
  'users:*', 'tasks:*', 'reports:*', 'settings:*', 
  'tools:*', 'dashboard:*', 'data:*'
]
```

#### 🔧 system_admin
```typescript
// صلاحيات واسعة لإدارة النظام
[
  'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
  'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
  'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
  'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
  'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
  'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
  'data:view', 'data:create', 'data:edit', 'data:delete'
]
```

#### 🏢 organization_owner
```typescript
// صلاحيات كاملة داخل المؤسسة
[
  'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
  'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
  'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
  'settings:view', 'settings:create', 'settings:edit', 'settings:delete', 'settings:approve', 'settings:assign',
  'tools:view', 'tools:create', 'tools:edit', 'tools:delete', 'tools:approve', 'tools:assign',
  'dashboard:view', 'dashboard:create', 'dashboard:edit', 'dashboard:delete', 'dashboard:approve', 'dashboard:assign',
  'data:view', 'data:create', 'data:edit', 'data:delete'
]
```

#### 👨‍💼 org_admin
```typescript
// صلاحيات إدارية واسعة داخل المؤسسة
[
  'users:view', 'users:create', 'users:edit', 'users:delete', 'users:approve', 'users:assign',
  'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:approve', 'tasks:assign',
  'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:approve', 'reports:assign',
  'settings:view', 'settings:edit',
  'tools:view', 'tools:create', 'tools:edit',
  'dashboard:view', 'dashboard:create', 'dashboard:edit',
  'data:view', 'data:create', 'data:edit', 'data:delete'
]
```

#### 👨‍🔧 org_engineer
```typescript
// صلاحيات واسعة ولكن أقل من المسؤول
[
  'users:view', 'users:assign',
  'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
  'reports:view', 'reports:create', 'reports:edit', 'reports:approve',
  'settings:view', 'settings:edit',
  'tools:view', 'tools:create', 'tools:edit',
  'dashboard:view', 'dashboard:edit'
]
```

#### 👨‍💼 org_supervisor
```typescript
// يركز على إدارة المهام والتقارير
[
  'users:view',
  'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve', 'tasks:assign',
  'reports:view', 'reports:create', 'reports:edit',
  'settings:view',
  'tools:view', 'tools:edit',
  'dashboard:view'
]
```

#### 🔧 org_technician
```typescript
// يركز على تنفيذ المهام
[
  'tasks:view', 'tasks:edit',
  'reports:view', 'reports:create',
  'tools:view', 'tools:edit',
  'dashboard:view'
]
```

#### 🤝 org_assistant
```typescript
// صلاحيات محدودة
[
  'tasks:view',
  'reports:view', 'reports:create',
  'tools:view',
  'dashboard:view'
]
```

#### 🧑‍💻 independent
```typescript
// صلاحيات كاملة على المحتوى الخاص به فقط
[
  'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete',
  'reports:view',
  'dashboard:view',
  'tools:view', 'tools:create', 'tools:edit',
  'settings:view', 'settings:edit',
  'data:view', 'data:create', 'data:edit', 'data:delete'
]
```

---

## 🗄️ هيكل قاعدة البيانات

### 📊 مجموعة `users`
```typescript
interface User {
  uid: string;                    // معرف المستخدم الفريد
  email: string;                  // البريد الإلكتروني
  name: string;                   // الاسم الكامل
  displayName?: string;           // اسم العرض
  
  // نوع الحساب والدور
  accountType: 'individual' | 'organization';
  role: UserRole;                 // الدور الحالي
  
  // للمؤسسات
  organizationId?: string;        // معرف المؤسسة
  departmentId?: string;          // معرف القسم
  
  // الصلاحيات المخصصة
  customPermissions?: PermissionKey[];
  
  // حالة الحساب
  disabled: boolean;              // مفعل/معطل
  
  // التواريخ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;             // من أنشأ الحساب
}
```

### 🏢 مجموعة `organizations`
```typescript
interface Organization {
  id: string;
  name: string;
  description?: string;
  ownerId: string;               // مالك المؤسسة
  createdBy: string;             // منشئ المؤسسة
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 👥 مجموعة `organizations/{orgId}/members`
```typescript
interface OrganizationMember {
  userId: string;
  role: 'org_admin' | 'org_supervisor' | 'org_engineer' | 'org_technician' | 'org_assistant';
  permissions?: {
    canCreateTasks?: boolean;
    canEditTasks?: boolean;
    canDeleteTasks?: boolean;
    canViewReports?: boolean;
    canCreateReports?: boolean;
  };
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 🏬 مجموعة `organizations/{orgId}/departments`
```typescript
interface Department {
  id: string;
  name: string;
  description?: string;
  headId?: string;               // رئيس القسم
  memberCount: number;           // عدد الأعضاء
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## ⚙️ إدارة المستخدمين

### 🔐 Firebase Authentication Claims
```typescript
interface UserClaims {
  // الدور الحالي
  role?: UserRole;
  
  // الصلاحيات الخاصة
  system_owner?: boolean;       // مالك النظام
  system_admin?: boolean;       // أدمن النظام العام
  organization_owner?: boolean; // مالك المؤسسة
  org_admin?: boolean;          // أدمن المؤسسة
  
  // معلومات الحساب
  accountType?: 'individual' | 'organization';
  organizationId?: string;      // معرف المؤسسة
  organizationName?: string;    // اسم المؤسسة
  departmentId?: string;        // معرف القسم
}
```

### 📝 إنشاء مستخدم جديد
```typescript
// مثال: إنشاء مستخدم مؤسسي
const userData = {
  email: "user@company.com",
  password: "securePassword",
  name: "أحمد محمد",
  role: "org_engineer",
  accountType: "organization",
  organizationId: "org_123",
  departmentId: "dept_456"
};
```

### 🔄 تحديث دور المستخدم
```typescript
// تحديث دور المستخدم
await updateUserRole(userId, "org_admin");

// تحديث الصلاحيات المخصصة
await updateUserPermissions(userId, [
  "tasks:create",
  "reports:view",
  "dashboard:edit"
]);
```

---

## 💡 أمثلة عملية

### 🏢 سيناريو مؤسسة تقنية

**الهيكل التنظيمي:**
```
مؤسسة التقنية المتقدمة
├── مالك المؤسسة (organization_owner)
├── أدمن المؤسسة (org_admin)
├── قسم التطوير
│   ├── مشرف التطوير (org_supervisor)
│   ├── مهندس أول (org_engineer)
│   ├── مهندس (org_engineer)
│   └── فني (org_technician)
└── قسم الدعم الفني
    ├── مشرف الدعم (org_supervisor)
    ├── فني دعم (org_technician)
    └── مساعد فني (org_assistant)
```

**توزيع الصلاحيات:**
- **مالك المؤسسة**: جميع الصلاحيات
- **أدمن المؤسسة**: إدارة المستخدمين والمهام والتقارير
- **مشرف القسم**: إدارة مهام القسم والموافقة عليها
- **المهندس**: إنشاء وتعديل المهام التقنية
- **الفني**: تنفيذ المهام المعينة له
- **المساعد**: عرض المهام والمساعدة في التنفيذ

### 🧑‍💻 سيناريو مستخدم مستقل

**المستخدم المستقل:**
```
أحمد المستقل (independent)
├── مهامه الشخصية
├── تقاريره الخاصة
├── لوحة معلوماته
└── أدواته المساعدة
```

**الصلاحيات:**
- إدارة كاملة لمهامه الشخصية
- عرض تقاريره فقط
- استخدام الأدوات المتاحة
- تصدير واستيراد بياناته

---

## 🔍 ملاحظات مهمة

### ⚠️ قيود الأمان
1. **لا يمكن للمستخدم تعديل دوره بنفسه**
2. **فقط الأدوار الأعلى يمكنها تعديل الأدوار الأقل**
3. **مالك المؤسسة لا يمكن حذفه إلا من قبل مالك النظام**
4. **الصلاحيات المخصصة لا يمكن أن تتجاوز صلاحيات الدور الأساسي**

### 🔄 تدرج الصلاحيات
- كل دور يرث صلاحيات الأدوار الأقل منه
- الأدوار الأعلى يمكنها إدارة الأدوار الأقل
- النظام يتحقق من الصلاحيات على مستويين: Frontend و Backend

### 📊 مراقبة النشاط
- جميع العمليات مسجلة مع معرف المستخدم والوقت
- تتبع تغييرات الأدوار والصلاحيات
- سجل نشاط المستخدمين في المهام والتقارير

---

*آخر تحديث: ديسمبر 2024*
