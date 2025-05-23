
## لتطبيق الباك اند

# 📚 دليل نظام المصادقة - Tasks Intelligence

## 🎯 **نظرة عامة**

نظام المصادقة يتكون من جزأين:
- **Firebase Authentication**: للمصادقة وإثبات الهوية
- **Firestore Database**: لتخزين الأدوار والصلاحيات

---

## 📁 **الملفات الرئيسية**

### **1. AuthContext**
📍 `src/context/AuthContext.tsx`
- **الوظيفة**: إدارة حالة المصادقة وجلب بيانات المستخدم
- **الدوال المهمة**:
  - `getUserDataFromFirestore()` - جلب بيانات المستخدم من Firestore
  - `refreshUserData()` - تحديث بيانات المستخدم
  - `signOut()` - تسجيل الخروج

### **2. useAuth Hook**
📍 `src/hooks/useAuth.ts`
- **الوظيفة**: Hook للوصول لبيانات المصادقة
- **البيانات المتاحة**:
  - `user` - بيانات Firebase Auth
  - `userClaims` - الأدوار والصلاحيات
  - `loading` - حالة التحميل

### **3. useAccountType Hook**
📍 `src/hooks/useAccountType.ts`
- **الوظيفة**: تحديد نوع الحساب (فردي/مؤسسة)
- **البيانات المتاحة**:
  - `accountType` - نوع الحساب
  - `systemType` - نوع النظام
  - `loading` - حالة التحميل

### **4. Firestore Rules**
📍 `firestore.rules`
- **الوظيفة**: قواعد الأمان لحماية البيانات
- **الأقسام**:
  - قواعد المستخدمين
  - قواعد المؤسسات
  - قواعد المهام والتقارير

---

## 🏗️ **هيكل البيانات**

### **📊 مجموعة `users`**
```typescript
{
  uid: string;                    // معرف المستخدم من Firebase Auth
  name?: string;                  // اسم المستخدم
  email: string;                  // البريد الإلكتروني
  accountType: 'individual' | 'organization';  // نوع الحساب

  // للحسابات الفردية
  role: 'independent' | 'system_admin' | 'system_owner';
  system_owner?: boolean;         // مالك النظام
  system_admin?: boolean;         // أدمن النظام
  isOwner?: boolean;              // مالك التطبيق (legacy)
  isAdmin?: boolean;              // أدمن التطبيق (legacy)
  isIndividualAdmin?: boolean;    // أدمن الأفراد (legacy)
  customPermissions?: string[];   // صلاحيات مخصصة ["tasks:view", "reports:view", "tools:view"]

  // للحسابات المؤسسية
  organizationId?: string;        // معرف المؤسسة
  organizationName?: string;      // اسم المؤسسة
  role?: 'organization_owner' | 'admin' | 'supervisor' | 'engineer' | 'technician' | 'assistant';
  organization_owner?: boolean;   // مالك المؤسسة
  admin?: boolean;                // أدمن المؤسسة

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updated_at?: Timestamp;         // تاريخ التحديث (legacy)
}
```

### **📊 مجموعة `organizations`**
```typescript
{
  id: string;                     // معرف المؤسسة
  name: string;                   // اسم المؤسسة
  description?: string;           // وصف المؤسسة
  ownerId?: string;               // مالك المؤسسة (جديد)
  createdBy: string;              // منشئ المؤسسة (قديم)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### **📊 مجموعة `organizations/{orgId}/members`**
```typescript
{
  userId: string;                 // معرف المستخدم
  role: 'admin' | 'supervisor' | 'engineer' | 'technician' | 'assistant';
  permissions?: {                 // صلاحيات مخصصة
    canCreateTasks?: boolean;
    canEditTasks?: boolean;
    canDeleteTasks?: boolean;
    canViewReports?: boolean;
    canCreateReports?: boolean;
    canEditReports?: boolean;
    canDeleteReports?: boolean;
  };
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 🎭 **الأدوار والصلاحيات**

### **👤 الحسابات الفردية**
| الدور | الوصف | الصلاحيات | الحقول المطلوبة |
|-------|-------|-----------|-----------------|
| `independent` | مستخدم مستقل | مهامه الشخصية فقط | `role: "independent"` |
| `system_admin` | أدمن النظام | إدارة جميع المستخدمين | `role: "system_admin"`, `system_admin: true` |
| `system_owner` | مالك النظام | صلاحيات كاملة | `role: "system_owner"`, `system_owner: true`, `system_admin: true` |

### **🏢 الحسابات المؤسسية**
| الدور | الوصف | الصلاحيات | الحقول المطلوبة |
|-------|-------|-----------|-----------------|
| `organization_owner` | مالك المؤسسة | صلاحيات كاملة في المؤسسة | `role: "organization_owner"`, `organization_owner: true` |
| `admin` | أدمن المؤسسة | إدارة الأعضاء والمهام | `role: "admin"`, `admin: true` |
| `supervisor` | مشرف | إشراف على المهام | `role: "supervisor"` |
| `engineer` | مهندس | إنشاء وتعديل المهام | `role: "engineer"` |
| `technician` | فني | تنفيذ المهام | `role: "technician"` |
| `assistant` | مساعد | مساعدة في المهام | `role: "assistant"` |

### **🔧 الحقول القديمة (Legacy)**
| الحقل | الوصف | الاستخدام |
|-------|-------|-----------|
| `isOwner` | مالك التطبيق | يُستخدم مع `system_owner` |
| `isAdmin` | أدمن التطبيق | يُستخدم مع `system_admin` |
| `isIndividualAdmin` | أدمن الأفراد | نادر الاستخدام |
| `customPermissions` | صلاحيات مخصصة | مصفوفة من الصلاحيات |

### **📋 أمثلة على الصلاحيات المخصصة**
```typescript
customPermissions: [
  "tasks:view",      // عرض المهام
  "tasks:create",    // إنشاء المهام
  "tasks:edit",      // تعديل المهام
  "tasks:delete",    // حذف المهام
  "reports:view",    // عرض التقارير
  "reports:create",  // إنشاء التقارير
  "tools:view",      // عرض الأدوات
  "tools:use",       // استخدام الأدوات
  "users:view",      // عرض المستخدمين
  "users:manage",    // إدارة المستخدمين
  "settings:view",   // عرض الإعدادات
  "settings:edit"    // تعديل الإعدادات
]
```

---

## 🔄 **تدفق المصادقة**

### **1. تسجيل الدخول**
```javascript
// Firebase Authentication
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const user = userCredential.user;
```

### **2. جلب بيانات المستخدم**
```javascript
// من Firestore
const userDoc = await getDoc(doc(db, 'users', user.uid));
const userData = userDoc.data();
```

### **3. تحديد نوع الحساب**
```javascript
if (userData.accountType === 'individual') {
  // حساب فردي
} else if (userData.accountType === 'organization') {
  // حساب مؤسسة - جلب بيانات المؤسسة والعضوية
}
```

---

## 🛡️ **Security Rules**

### **قواعد المستخدمين**
```javascript
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  allow read: if request.auth != null && request.auth.token.system_admin == true;
}
```

### **قواعد المؤسسات**
```javascript
match /organizations/{orgId} {
  allow read: if request.auth != null && (
    request.auth.token.system_owner == true ||
    request.auth.token.system_admin == true ||
    request.auth.token.organizationId == orgId
  );
}
```

### **قواعد المهام**
```javascript
match /tasks/{taskId} {
  allow read: if request.auth != null && (
    request.auth.token.system_owner == true ||
    (resource.data.organizationId == null && resource.data.userId == request.auth.uid) ||
    (resource.data.organizationId != null &&
     request.auth.token.organizationId == resource.data.organizationId)
  );
}
```

---

## � **التوافق مع النظام القديم**

### **📊 مقارنة الحقول القديمة والجديدة**

| النظام القديم | النظام الجديد | الوصف |
|---------------|---------------|--------|
| `isOwner: true` | `system_owner: true` + `role: "system_owner"` | مالك النظام |
| `isAdmin: true` | `system_admin: true` + `role: "system_admin"` | أدمن النظام |
| `role: "independent"` + `isOwner: true` | `role: "system_owner"` | تحويل مالك إلى النظام الجديد |
| `customPermissions: ["tasks:view"]` | نفس الحقل | الصلاحيات المخصصة |

### **🔧 منطق التحقق من الصلاحيات**

```typescript
// التحقق من مالك النظام
const isSystemOwner = userClaims.system_owner ||
                     (userClaims.isOwner && userClaims.role === 'system_owner');

// التحقق من أدمن النظام
const isSystemAdmin = userClaims.system_admin ||
                     (userClaims.isAdmin && userClaims.role === 'system_admin');

// التحقق من مالك المؤسسة
const isOrgOwner = userClaims.organization_owner ||
                  (userClaims.role === 'organization_owner');

// التحقق من الصلاحيات المخصصة
const hasPermission = (permission: string) => {
  return userClaims.customPermissions?.includes(permission) || false;
};
```

### **⚠️ ملاحظات مهمة للتطوير**

1. **استخدم الحقول الجديدة** (`system_owner`, `system_admin`) مع الحقول القديمة (`isOwner`, `isAdmin`) للتوافق
2. **تحقق من `role`** أولاً ثم من الحقول المساعدة
3. **`customPermissions`** تعطي صلاحيات إضافية بغض النظر عن الدور
4. **للمؤسسات** استخدم `organizationId` لتحديد المؤسسة المرتبطة

---

## �🔧 **كيفية تعديل الأدوار والصلاحيات**

### **1. إضافة دور جديد**
```typescript
// في types/auth.ts
type UserRole = 'independent' | 'system_admin' | 'system_owner' |
                'organization_owner' | 'admin' | 'supervisor' |
                'engineer' | 'technician' | 'assistant' | 'NEW_ROLE';
```

### **2. تحديث AuthContext**
```typescript
// في src/context/AuthContext.tsx
// إضافة منطق للدور الجديد في getUserDataFromFirestore()
```

### **3. تحديث Security Rules**
```javascript
// في firestore.rules
// إضافة قواعد للدور الجديد
```

### **4. تحديث واجهة المستخدم**
```typescript
// في المكونات المختلفة
// إضافة فحص للدور الجديد
if (userClaims.role === 'NEW_ROLE') {
  // منطق خاص بالدور الجديد
}
```

---

## 📍 **الملفات المهمة للتعديل**

### **للأدوار والصلاحيات**:
- `src/context/AuthContext.tsx` - منطق جلب البيانات
- `src/types/auth.ts` - تعريف الأنواع
- `firestore.rules` - قواعد الأمان
- `src/hooks/useAuth.ts` - Hook المصادقة

### **للواجهات**:
- `src/components/auth/` - مكونات المصادقة
- `src/app/(auth)/` - صفحات المصادقة
- `src/components/PermissionSidebarItem.tsx` - عناصر الشريط الجانبي

### **للصلاحيات المتقدمة**:
- `src/hooks/usePermissions.tsx` - إدارة الصلاحيات
- `src/types/roles.ts` - تعريف الأدوار والصلاحيات
- `functions/src/shared/permissions.ts` - صلاحيات Cloud Functions

---

## 🚀 **نصائح للتطوير**

### **1. اختبار الأدوار**:
```javascript
// في Console المتصفح
console.log('User Claims:', userClaims);
console.log('Account Type:', userClaims.accountType);
console.log('Role:', userClaims.role);
```

### **2. إضافة سجلات**:
```javascript
console.log("[AuthContext] 🔍 جلب بيانات المستخدم:", currentUser.uid);
```

### **3. التحقق من الصلاحيات**:
```javascript
if (userClaims.system_owner || userClaims.organization_owner) {
  // صلاحيات عالية
}
```

---

## ⚠️ **ملاحظات مهمة**

1. **لا تخزن الصلاحيات في Firebase Auth Custom Claims** - استخدم Firestore
2. **تأكد من تحديث Security Rules** عند إضافة أدوار جديدة
3. **اختبر الصلاحيات** في بيئة التطوير قبل النشر
4. **استخدم TypeScript** لضمان سلامة الأنواع
5. **راقب السجلات** لتشخيص المشاكل

---

## 📞 **للدعم**

عند مواجهة مشاكل:
1. تحقق من السجلات في Console
2. تأكد من صحة بيانات Firestore
3. راجع Security Rules
4. تحقق من صحة الأنواع في TypeScript

**هذا الدليل يحتوي على كل ما تحتاجه لفهم وتعديل نظام المصادقة!** 🎉
