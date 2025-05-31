# 🔒 الطريقة الآمنة لإدارة المستخدمين

## نظرة عامة

تم تطوير نظام آمن لإدارة المستخدمين يعتمد على Firebase Functions فقط، مما يضمن:

- **الأمان**: جميع العمليات تتم عبر Firebase Functions المحمية
- **التحقق من الصلاحيات**: التحقق من صلاحيات المستخدم قبل كل عملية
- **معالجة الأخطاء**: معالجة شاملة للأخطاء مع رسائل واضحة
- **تحديث البيانات**: تحديث متزامن لجميع مصادر البيانات (Auth, Custom Claims, Firestore)

## 🏗️ البنية

### 1. Firebase Functions (Backend)

#### `createUser`
- **الوصف**: إنشاء مستخدم جديد بطريقة آمنة
- **المتطلبات**: صلاحيات admin
- **المدخلات**: email, password, name, role, accountType, organizationId?, departmentId?
- **المخرجات**: { uid?, error? }

#### `updateUserRole`
- **الوصف**: تحديث دور المستخدم
- **المتطلبات**: صلاحيات admin
- **المدخلات**: { uid, role }
- **المخرجات**: { result?, error? }

#### `updateUserPermissions`
- **الوصف**: تحديث صلاحيات المستخدم المخصصة
- **المتطلبات**: صلاحيات admin
- **المدخلات**: { uid, permissions[] }
- **المخرجات**: { result?, error? }

#### `toggleUserDisabled`
- **الوصف**: تفعيل/إلغاء تفعيل المستخدم
- **المتطلبات**: صلاحيات admin
- **المدخلات**: { uid, disabled }
- **المخرجات**: { result?, error? }

### 2. Frontend Hook

#### `useSecureUserManagement`
Hook مخصص يوفر واجهة آمنة للتفاعل مع Firebase Functions:

```typescript
const {
  createUser,
  updateUserRole,
  updateUserPermissions,
  toggleUserDisabled,
  isLoading
} = useSecureUserManagement();
```

## 🔧 الاستخدام

### إنشاء مستخدم جديد

```typescript
const handleCreateUser = async (userData: CreateUserInput) => {
  const result = await createUser(userData);
  
  if (result.success) {
    // تم إنشاء المستخدم بنجاح
    console.log('User created with UID:', result.uid);
  } else {
    // حدث خطأ
    console.error('Error:', result.error);
  }
};
```

### تحديث دور المستخدم

```typescript
const handleUpdateRole = async (userId: string, newRole: string) => {
  const result = await updateUserRole(userId, newRole);
  
  if (result.success) {
    // تم تحديث الدور بنجاح
  }
};
```

### تحديث الصلاحيات

```typescript
const handleUpdatePermissions = async (userId: string, permissions: string[]) => {
  const result = await updateUserPermissions(userId, permissions);
  
  if (result.success) {
    // تم تحديث الصلاحيات بنجاح
  }
};
```

### تفعيل/إلغاء تفعيل المستخدم

```typescript
const handleToggleDisabled = async (userId: string, disabled: boolean) => {
  const result = await toggleUserDisabled(userId, disabled);
  
  if (result.success) {
    // تم تحديث حالة التفعيل بنجاح
  }
};
```

## 🛡️ الأمان

### التحقق من الصلاحيات

جميع Firebase Functions تتحقق من:
1. **المصادقة**: المستخدم مسجل دخول
2. **الصلاحيات**: المستخدم له صلاحيات admin
3. **البيانات**: صحة البيانات المرسلة

### الأدوار المدعومة

- `system_owner`: مالك النظام (أعلى صلاحية)
- `system_admin`: مدير النظام
- `org_owner`: مالك المؤسسة
- `org_admin`: مدير المؤسسة
- `org_supervisor`: مشرف المؤسسة
- `org_engineer`: مهندس المؤسسة
- `org_technician`: فني المؤسسة
- `org_assistant`: مساعد المؤسسة
- `independent`: مستخدم مستقل

## 🔄 تحديث البيانات

عند إنشاء أو تحديث مستخدم، يتم تحديث:

1. **Firebase Auth**: البيانات الأساسية (email, displayName, disabled)
2. **Custom Claims**: الأدوار والصلاحيات
3. **Firestore**: جميع بيانات المستخدم التفصيلية

## ⚠️ معالجة الأخطاء

### أخطاء شائعة

- `already-exists`: البريد الإلكتروني مستخدم بالفعل
- `permission-denied`: ليس لديك صلاحية لهذه العملية
- `invalid-argument`: بيانات غير صحيحة
- `unauthenticated`: يجب تسجيل الدخول
- `internal`: خطأ داخلي في الخادم

### رسائل المستخدم

يتم عرض رسائل واضحة للمستخدم باللغة العربية لكل نوع خطأ.

## 📝 أفضل الممارسات

1. **استخدم Hook دائماً**: لا تستدعي Firebase Functions مباشرة
2. **تحقق من النتائج**: تحقق من `result.success` قبل المتابعة
3. **معالجة Loading**: استخدم `isLoading` لعرض حالة التحميل
4. **تحديث البيانات**: أعد تحميل البيانات بعد العمليات الناجحة

## 🚫 ما تم إزالته

- **API Routes غير الآمنة**: تم حذف `/api/admin/create-user`
- **استدعاءات مباشرة**: لا يتم استدعاء Firebase Auth مباشرة من Frontend
- **window.location.reload()**: تم استبدالها بتحديث البيانات المحلية

## 🔮 المستقبل

- إضافة المزيد من العمليات الآمنة
- تحسين معالجة الأخطاء
- إضافة تسجيل العمليات (Audit Log)
- دعم العمليات المجمعة (Batch Operations)
