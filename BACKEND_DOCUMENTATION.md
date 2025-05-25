# 📋 توثيق النظام الجديد - للفريق الخلفي

## 🎯 نظرة عامة

تم تطوير نظام مصادقة وإدارة مستخدمين جديد موحد يحل محل النظام القديم المعقد. هذا التوثيق يوضح جميع التغييرات والتحديثات المطلوبة.

---

## 🔄 التغييرات الرئيسية

### ❌ النظام القديم (تم إلغاؤه)
```
- مجموعات متعددة: individuals, admins, owners
- أدوار متضاربة ومعقدة
- نظام migration معقد
- تكرار في البيانات
```

### ✅ النظام الجديد (الحالي)
```
- مجموعة واحدة موحدة: users
- أدوار واضحة ومحددة
- لا توجد migration
- بيانات متسقة وموحدة
```

---

## 🗄️ هيكل قاعدة البيانات الجديد

### 📁 مجموعة `users` الموحدة
```typescript
interface User {
  // البيانات الأساسية
  uid: string;                    // معرف Firebase Auth
  email: string;                  // البريد الإلكتروني
  name: string;                   // الاسم الكامل
  displayName: string;            // اسم العرض

  // نوع الحساب
  accountType: 'individual' | 'organization';

  // الأدوار الجديدة الموحدة
  role: UserRole;                 // الدور الأساسي
  isSystemOwner: boolean;         // مالك النظام
  isSystemAdmin: boolean;         // أدمن النظام
  isOrganizationOwner: boolean;   // مالك المؤسسة
  isAdmin: boolean;               // أدمن عام
  isOwner: boolean;               // مالك عام
  isIndividualAdmin: boolean;     // أدمن فردي

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

### 🎭 أنواع الأدوار
```typescript
type UserRole =
  | 'system_owner'        // مالك النظام
  | 'system_admin'        // أدمن النظام
  | 'organization_owner'  // مالك المؤسسة
  | 'organization_admin'  // أدمن المؤسسة
  | 'individual_admin'    // أدمن فردي
  | 'member'              // عضو عادي
  | 'user';               // مستخدم عادي
```

### 🔑 الصلاحيات المخصصة
```typescript
type PermissionKey =
  | 'tasks:create'
  | 'tasks:edit'
  | 'tasks:delete'
  | 'tasks:view'
  | 'reports:create'
  | 'reports:edit'
  | 'reports:delete'
  | 'reports:view'
  | 'settings:view'
  | 'settings:edit'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'users:view';
```

---

## 🔐 نظام المصادقة

### 📍 أماكن المصادقة في التطبيق

#### 1. **Frontend Authentication**
```typescript
// المسار: src/context/AuthContext.tsx
- تسجيل الدخول/الخروج
- إدارة حالة المستخدم
- تحديث Custom Claims
- إنشاء وثائق المستخدمين في Firestore

// المسار: src/hooks/useFirebaseAuth.ts
- دوال المصادقة الأساسية
- signUp, signIn, signOut
- إدارة الأخطاء
```

#### 2. **Cloud Functions Authentication**
```typescript
// المسار: functions/src/auth.ts
- updateAccountType: تحديث نوع الحساب
- addTokenRefreshTimestamp: تحديث الـ tokens

// المسار: functions/src/roles.ts
- updateUserRole: تحديث أدوار المستخدمين
- updateUserPermissions: تحديث الصلاحيات المخصصة
```

#### 3. **Firestore Security Rules**
```typescript
// المسار: firestore.rules
- قواعد الأمان للوصول للبيانات
- التحقق من الأدوار والصلاحيات
- حماية العمليات الحساسة
```

### 🎫 Custom Claims الجديدة
```typescript
interface CustomClaims {
  // الأدوار الأساسية
  role: UserRole;
  accountType: 'individual' | 'organization';

  // الأدوار المنطقية
  isSystemOwner: boolean;
  isSystemAdmin: boolean;
  isOrganizationOwner: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isIndividualAdmin: boolean;

  // معلومات المؤسسة
  organizationId?: string;
  departmentId?: string;

  // الصلاحيات المخصصة
  customPermissions?: PermissionKey[];

  // معلومات إضافية
  disabled: boolean;
  createdBy?: string;
}
```

---

## 🔧 Cloud Functions المطلوبة

### 1. **إنشاء المستخدمين**
```typescript
// functions/src/index.ts - createUser
export const createUser = functions.https.onCall(async (data, context) => {
  // التحقق من الصلاحيات
  // إنشاء حساب Firebase Auth
  // إنشاء وثيقة في مجموعة users
  // تعيين Custom Claims
});
```

### 2. **تحديث الأدوار**
```typescript
// functions/src/roles.ts - updateUserRole
export const updateUserRole = functions.https.onCall(async (data, context) => {
  // التحقق من صلاحيات المستدعي
  // تحديث الدور في Firestore
  // تحديث Custom Claims
});
```

### 3. **تحديث الصلاحيات**
```typescript
// functions/src/roles.ts - updateUserPermissions
export const updateUserPermissions = functions.https.onCall(async (data, context) => {
  // التحقق من الصلاحيات
  // تحديث الصلاحيات المخصصة
  // تحديث Custom Claims
});
```

### 4. **تحديث نوع الحساب**
```typescript
// functions/src/auth.ts - updateAccountType
export const updateAccountType = functions.https.onCall(async (data, context) => {
  // تحديث نوع الحساب
  // تحديث Custom Claims
  // إعادة تعيين الأدوار حسب النوع الجديد
});
```

---

## 📊 عمليات قاعدة البيانات

### ✅ العمليات المطلوبة

#### 1. **إنشاء مستخدم جديد**
```typescript
// إنشاء في Firebase Auth
const userRecord = await admin.auth().createUser({
  email: userData.email,
  password: userData.password,
  displayName: userData.name,
});

// إنشاء وثيقة في Firestore
await admin.firestore().collection('users').doc(userRecord.uid).set({
  uid: userRecord.uid,
  email: userData.email,
  name: userData.name,
  displayName: userData.name,
  accountType: userData.accountType,
  role: userData.role,
  // ... باقي البيانات
});

// تعيين Custom Claims
await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);
```

#### 2. **تحديث دور المستخدم**
```typescript
// تحديث في Firestore
await admin.firestore().collection('users').doc(userId).update({
  role: newRole,
  isSystemOwner: newRole === 'system_owner',
  isSystemAdmin: newRole === 'system_admin',
  // ... باقي الأدوار
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

// تحديث Custom Claims
await admin.auth().setCustomUserClaims(userId, updatedClaims);
```

#### 3. **حذف المستخدم**
```typescript
// حذف من Firebase Auth
await admin.auth().deleteUser(userId);

// حذف من Firestore
await admin.firestore().collection('users').doc(userId).delete();
```

### ❌ العمليات المحذوفة (لا تستخدم)
```typescript
// لا تستخدم هذه المجموعات بعد الآن:
- individuals/*
- admins/*
- owners/*

// لا تستخدم هذه الحقول:
- migratedToNewRoleSystem
- oldRole
- migrationTimestamp
```

---

## 🔒 قواعد الأمان (Firestore Rules)

### 📍 الملف: `firestore.rules`

#### 1. **قواعد المستخدمين**
```javascript
match /users/{userId} {
  // قراءة البيانات الشخصية
  allow read: if request.auth.uid == userId;

  // قراءة عامة للبيانات الأساسية
  allow read: if request.auth != null;

  // كتابة مع قيود على الأدوار الحساسة
  allow write: if request.auth.uid == userId &&
    !('isSystemOwner' in request.resource.data) &&
    !('isSystemAdmin' in request.resource.data);

  // صلاحيات النظام العليا
  allow read, write: if hasSystemAccess();
}
```

#### 2. **دوال التحقق من الصلاحيات**
```javascript
function isSystemOwner() {
  return request.auth.token.isSystemOwner == true;
}

function isSystemAdmin() {
  return request.auth.token.isSystemAdmin == true;
}

function hasSystemAccess() {
  return isSystemOwner() || isSystemAdmin();
}

function isOrganizationOwner(orgId) {
  return request.auth.token.isOrganizationOwner == true &&
         request.auth.token.organizationId == orgId;
}
```

---

## 🚀 APIs المطلوبة

### 1. **HTTP Cloud Functions**

#### **إنشاء مستخدم**
```typescript
POST /createUser
Headers: Authorization: Bearer <token>
Body: {
  email: string;
  password: string;
  name: string;
  accountType: 'individual' | 'organization';
  role: UserRole;
  organizationId?: string;
  departmentId?: string;
}
Response: {
  success: boolean;
  userId: string;
  message: string;
}
```

#### **تحديث دور المستخدم**
```typescript
POST /updateUserRole
Headers: Authorization: Bearer <token>
Body: {
  userId: string;
  newRole: UserRole;
}
Response: {
  success: boolean;
  message: string;
}
```

#### **تحديث الصلاحيات المخصصة**
```typescript
POST /updateUserPermissions
Headers: Authorization: Bearer <token>
Body: {
  userId: string;
  permissions: PermissionKey[];
}
Response: {
  success: boolean;
  message: string;
}
```

#### **قائمة المستخدمين**
```typescript
GET /listUsers
Headers: Authorization: Bearer <token>
Query: {
  accountType?: 'individual' | 'organization';
  organizationId?: string;
  role?: UserRole;
  limit?: number;
  offset?: number;
}
Response: {
  users: User[];
  total: number;
  hasMore: boolean;
}
```

### 2. **Callable Cloud Functions**

#### **تحديث نوع الحساب**
```typescript
firebase.functions().httpsCallable('updateAccountType')({
  userId: string;
  newAccountType: 'individual' | 'organization';
  organizationId?: string;
})
```

---

## 🔄 عملية الترحيل (Migration)

### ⚠️ هام: تم إلغاء نظام الترحيل

```typescript
// ❌ لا تستخدم - تم حذف نظام Migration
- migrateUser()
- migrateAllUsers()
- checkMigrationStatus()

// ✅ استخدم بدلاً من ذلك
- إنشاء مستخدمين جدد مباشرة في مجموعة users
- حذف البيانات القديمة من المجموعات المحذوفة
- استخدام النظام الجديد فقط
```

---

## 🧪 اختبار النظام

### 1. **اختبارات المطلوبة**

#### **اختبار إنشاء المستخدمين**
```typescript
// اختبار إنشاء مستخدم فردي
const individualUser = await createUser({
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  accountType: 'individual',
  role: 'user'
});

// اختبار إنشاء مستخدم مؤسسة
const orgUser = await createUser({
  email: 'org@example.com',
  password: 'password123',
  name: 'Org User',
  accountType: 'organization',
  role: 'member',
  organizationId: 'org123'
});
```

#### **اختبار الأدوار والصلاحيات**
```typescript
// اختبار تحديث الدور
await updateUserRole(userId, 'system_admin');

// اختبار الصلاحيات المخصصة
await updateUserPermissions(userId, ['tasks:create', 'tasks:edit']);

// اختبار Custom Claims
const token = await admin.auth().getUser(userId);
expect(token.customClaims.isSystemAdmin).toBe(true);
```

### 2. **حالات الاختبار**

#### **سيناريوهات النجاح**
- إنشاء مستخدم فردي ✅
- إنشاء مستخدم مؤسسة ✅
- تحديث الأدوار ✅
- تحديث الصلاحيات ✅
- تسجيل الدخول ✅

#### **سيناريوهات الفشل**
- إنشاء مستخدم ببريد مكرر ❌
- تحديث دور بدون صلاحية ❌
- الوصول لبيانات محظورة ❌

---

## 📋 قائمة المراجعة للفريق الخلفي

### ✅ المطلوب تنفيذه

#### **1. Cloud Functions**
- [ ] تحديث دالة `createUser`
- [ ] تحديث دالة `updateUserRole`
- [ ] تحديث دالة `updateUserPermissions`
- [ ] إضافة دالة `listUsers`
- [ ] حذف دوال Migration القديمة

#### **2. قاعدة البيانات**
- [ ] حذف المجموعات القديمة: `individuals`, `admins`, `owners`
- [ ] تنظيف الفهارس القديمة
- [ ] تحديث قواعد Firestore
- [ ] إضافة فهارس جديدة لمجموعة `users`

#### **3. المصادقة**
- [ ] تحديث Custom Claims
- [ ] إزالة المراجع للحقول القديمة
- [ ] تحديث دوال التحقق من الصلاحيات

#### **4. الاختبار**
- [ ] اختبار إنشاء المستخدمين
- [ ] اختبار تحديث الأدوار
- [ ] اختبار الصلاحيات
- [ ] اختبار قواعد الأمان

---

## 📞 جهات الاتصال

### 🔧 للدعم التقني
- **Frontend Team**: تحديث واجهات المستخدم
- **Backend Team**: تنفيذ Cloud Functions وقواعد البيانات
- **DevOps Team**: نشر التحديثات والمراقبة

### 📊 للمراجعة
- **Security Team**: مراجعة قواعد الأمان
- **QA Team**: اختبار النظام الجديد
- **Product Team**: التأكد من متطلبات العمل

---

## 🎯 الخلاصة

النظام الجديد يوفر:
- **بساطة في الإدارة** - مجموعة واحدة موحدة
- **أمان محسن** - قواعد واضحة ومحددة
- **مرونة في الأدوار** - دعم أدوار متعددة ومخصصة
- **سهولة الصيانة** - لا توجد تعقيدات Migration
- **أداء أفضل** - استعلامات أقل وبيانات متسقة

**جميع التغييرات متوافقة مع النظام الحالي ولا تتطلب تعديلات جذرية.**
