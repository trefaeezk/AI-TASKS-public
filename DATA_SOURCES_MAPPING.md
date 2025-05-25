# 🗂️ خريطة مصادر البيانات - Authentication vs Firestore

## 🎯 نظرة عامة

هذا الملف يوضح بالتفصيل مصدر كل parameter في النظام الجديد، وما إذا كان يأتي من Firebase Authentication أم Firestore.

---

## 🔐 Firebase Authentication (Custom Claims)

### 📍 **المصدر:** `request.auth.token` في Firestore Rules
### 📍 **المصدر:** `context.auth.token` في Cloud Functions
### 📍 **المصدر:** `user.getIdTokenResult().claims` في Frontend

```typescript
interface AuthenticationClaims {
  // ===== البيانات الأساسية من Firebase Auth =====
  uid: string;                    // 🔐 Firebase Auth - معرف المستخدم الفريد
  email: string;                  // 🔐 Firebase Auth - البريد الإلكتروني
  email_verified: boolean;        // 🔐 Firebase Auth - تأكيد البريد الإلكتروني

  // ===== Custom Claims (يتم تعيينها بواسطة Cloud Functions) =====
  role: UserRole;                 // 🔐 Custom Claim - الدور الأساسي
  accountType: string;            // 🔐 Custom Claim - نوع الحساب

  // الأدوار المنطقية
  isSystemOwner: boolean;         // 🔐 Custom Claim - مالك النظام
  isSystemAdmin: boolean;         // 🔐 Custom Claim - أدمن النظام
  isOrganizationOwner: boolean;   // 🔐 Custom Claim - مالك المؤسسة
  isAdmin: boolean;               // 🔐 Custom Claim - أدمن عام
  isOwner: boolean;               // 🔐 Custom Claim - مالك عام
  isIndividualAdmin: boolean;     // 🔐 Custom Claim - أدمن فردي

  // معلومات المؤسسة
  organizationId?: string;        // 🔐 Custom Claim - معرف المؤسسة
  departmentId?: string;          // 🔐 Custom Claim - معرف القسم

  // الصلاحيات المخصصة
  customPermissions?: string[];   // 🔐 Custom Claim - الصلاحيات المخصصة

  // معلومات إضافية
  disabled: boolean;              // 🔐 Custom Claim - حالة التفعيل
  createdBy?: string;             // 🔐 Custom Claim - من أنشأ الحساب
}
```

---

## 🗄️ Firestore Database

### 📍 **المصدر:** `users/{userId}` collection
### 📍 **الاستخدام:** تخزين البيانات التفصيلية والتاريخ

```typescript
interface FirestoreUserDocument {
  // ===== البيانات الأساسية =====
  uid: string;                    // 🗄️ Firestore - نسخة من Firebase Auth UID
  email: string;                  // 🗄️ Firestore - نسخة من Firebase Auth Email
  name: string;                   // 🗄️ Firestore - الاسم الكامل (لا يوجد في Auth)
  displayName: string;            // 🗄️ Firestore - اسم العرض (نسخة من Auth)

  // ===== نوع الحساب والأدوار =====
  accountType: string;            // 🗄️ Firestore - نوع الحساب (نسخة من Custom Claims)
  role: UserRole;                 // 🗄️ Firestore - الدور الأساسي (نسخة من Custom Claims)

  // الأدوار المنطقية (نسخ من Custom Claims)
  isSystemOwner: boolean;         // 🗄️ Firestore - مالك النظام
  isSystemAdmin: boolean;         // 🗄️ Firestore - أدمن النظام
  isOrganizationOwner: boolean;   // 🗄️ Firestore - مالك المؤسسة
  isAdmin: boolean;               // 🗄️ Firestore - أدمن عام
  isOwner: boolean;               // 🗄️ Firestore - مالك عام
  isIndividualAdmin: boolean;     // 🗄️ Firestore - أدمن فردي

  // ===== معلومات المؤسسة =====
  organizationId?: string;        // 🗄️ Firestore - معرف المؤسسة (نسخة من Custom Claims)
  departmentId?: string;          // 🗄️ Firestore - معرف القسم (نسخة من Custom Claims)

  // ===== الصلاحيات المخصصة =====
  customPermissions?: string[];   // 🗄️ Firestore - الصلاحيات المخصصة (نسخة من Custom Claims)

  // ===== حالة الحساب =====
  disabled: boolean;              // 🗄️ Firestore - حالة التفعيل (نسخة من Custom Claims)

  // ===== التواريخ والتتبع (فقط في Firestore) =====
  createdAt: Timestamp;           // 🗄️ Firestore فقط - تاريخ الإنشاء
  updatedAt: Timestamp;           // 🗄️ Firestore فقط - تاريخ آخر تحديث
  createdBy?: string;             // 🗄️ Firestore - من أنشأ الحساب (نسخة من Custom Claims)

  // ===== بيانات إضافية (فقط في Firestore) =====
  profilePicture?: string;        // 🗄️ Firestore فقط - صورة الملف الشخصي
  phoneNumber?: string;           // 🗄️ Firestore فقط - رقم الهاتف
  address?: string;               // 🗄️ Firestore فقط - العنوان
  bio?: string;                   // 🗄️ Firestore فقط - نبذة شخصية
}
```

---

## 🔄 تدفق البيانات والتزامن

### 1. **عند إنشاء مستخدم جديد**

```typescript
// الخطوة 1: إنشاء في Firebase Auth
const userRecord = await admin.auth().createUser({
  email: userData.email,           // 🔐 يُحفظ في Firebase Auth
  password: userData.password,     // 🔐 يُحفظ في Firebase Auth (مشفر)
  displayName: userData.name,      // 🔐 يُحفظ في Firebase Auth
});

// الخطوة 2: إنشاء وثيقة في Firestore
await admin.firestore().collection('users').doc(userRecord.uid).set({
  uid: userRecord.uid,             // 🗄️ نسخة من Firebase Auth
  email: userData.email,           // 🗄️ نسخة من Firebase Auth
  name: userData.name,             // 🗄️ فقط في Firestore
  displayName: userData.name,      // 🗄️ نسخة من Firebase Auth
  accountType: userData.accountType, // 🗄️ فقط في Firestore (أولاً)
  role: userData.role,             // 🗄️ فقط في Firestore (أولاً)
  // ... باقي البيانات
});

// الخطوة 3: تعيين Custom Claims
await admin.auth().setCustomUserClaims(userRecord.uid, {
  role: userData.role,             // 🔐 نسخة من Firestore
  accountType: userData.accountType, // 🔐 نسخة من Firestore
  isSystemOwner: userData.role === 'system_owner', // 🔐 محسوبة من الدور
  // ... باقي Claims
});
```

### 2. **عند تحديث دور المستخدم**

```typescript
// الخطوة 1: تحديث في Firestore أولاً
await admin.firestore().collection('users').doc(userId).update({
  role: newRole,                   // 🗄️ المصدر الأساسي
  isSystemOwner: newRole === 'system_owner', // 🗄️ محسوبة من الدور
  updatedAt: admin.firestore.FieldValue.serverTimestamp(), // 🗄️ فقط في Firestore
});

// الخطوة 2: تحديث Custom Claims
await admin.auth().setCustomUserClaims(userId, {
  role: newRole,                   // 🔐 نسخة من Firestore
  isSystemOwner: newRole === 'system_owner', // 🔐 نسخة من Firestore
});
```

---

## 🔍 كيفية الوصول للبيانات في كل سياق

### 1. **في Firestore Security Rules**

```javascript
// الوصول لـ Custom Claims
function getUserRole() {
  return request.auth.token.role;           // 🔐 من Custom Claims
}

function isSystemOwner() {
  return request.auth.token.isSystemOwner == true; // 🔐 من Custom Claims
}

function getUserOrganization() {
  return request.auth.token.organizationId; // 🔐 من Custom Claims
}

// الوصول لبيانات Firestore
function getUserData() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; // 🗄️ من Firestore
}
```

### 2. **في Cloud Functions**

```typescript
export const someFunction = functions.https.onCall(async (data, context) => {
  // الوصول لـ Custom Claims
  const userRole = context.auth.token.role;              // 🔐 من Custom Claims
  const isOwner = context.auth.token.isSystemOwner;      // 🔐 من Custom Claims
  const orgId = context.auth.token.organizationId;       // 🔐 من Custom Claims

  // الوصول لبيانات Firestore
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(context.auth.uid)
    .get();

  const userData = userDoc.data();
  const userName = userData.name;                         // 🗄️ من Firestore
  const createdAt = userData.createdAt;                   // 🗄️ من Firestore
  const profilePic = userData.profilePicture;            // 🗄️ من Firestore
});
```

### 3. **في Frontend (React/TypeScript)**

```typescript
// الوصول لـ Custom Claims
const user = useAuthContext();
const token = await user.getIdTokenResult();
const userRole = token.claims.role;                      // 🔐 من Custom Claims
const isOwner = token.claims.isSystemOwner;              // 🔐 من Custom Claims

// الوصول لبيانات Firestore
const userDoc = await db.collection('users').doc(user.uid).get();
const userData = userDoc.data();
const userName = userData.name;                          // 🗄️ من Firestore
const profilePic = userData.profilePicture;             // 🗄️ من Firestore
```

---

## ⚡ متى نستخدم كل مصدر؟

### 🔐 **استخدم Custom Claims عندما:**
- **التحقق من الصلاحيات** في Firestore Rules
- **التحقق السريع** في Cloud Functions
- **قرارات الأمان** الفورية
- **البيانات التي تحتاج وصول سريع**

### 🗄️ **استخدم Firestore عندما:**
- **عرض البيانات** في الواجهة
- **البيانات التفصيلية** مثل الاسم والصورة
- **التواريخ والتتبع**
- **البيانات القابلة للتغيير** بكثرة

---

## 🔄 استراتيجية التزامن

### **القاعدة الذهبية:**
1. **Firestore هو المصدر الأساسي** للبيانات
2. **Custom Claims هي نسخة مُحسنة** للأداء والأمان
3. **عند التحديث:** Firestore أولاً، ثم Custom Claims
4. **عند القراءة:** Custom Claims للأمان، Firestore للعرض

---

## 📊 جدول مقارنة مصادر البيانات

| Parameter | Firebase Auth | Custom Claims | Firestore | الاستخدام الأمثل |
|-----------|---------------|---------------|-----------|------------------|
| `uid` | ✅ المصدر الأساسي | ❌ | 🔄 نسخة | التحقق من الهوية |
| `email` | ✅ المصدر الأساسي | ❌ | 🔄 نسخة | تسجيل الدخول |
| `name` | ❌ | ❌ | ✅ المصدر الوحيد | عرض الاسم |
| `displayName` | ✅ المصدر الأساسي | ❌ | 🔄 نسخة | عرض سريع |
| `role` | ❌ | ✅ للأمان | ✅ المصدر الأساسي | قرارات الصلاحيات |
| `accountType` | ❌ | ✅ للأمان | ✅ المصدر الأساسي | تصنيف المستخدمين (فردي/مؤسسة) |
| `isSystemOwner` | ❌ | ✅ للأمان | 🔄 نسخة | قرارات الأمان |
| `organizationId` | ❌ | ✅ للأمان | ✅ المصدر الأساسي | ربط بالمؤسسة |
| `customPermissions` | ❌ | ✅ للأمان | ✅ المصدر الأساسي | صلاحيات مخصصة |
| `createdAt` | ❌ | ❌ | ✅ المصدر الوحيد | التتبع والتاريخ |
| `profilePicture` | ❌ | ❌ | ✅ المصدر الوحيد | عرض الصورة |

---

## 🎯 أمثلة عملية مفصلة

### **مثال 1: التحقق من صلاحية إنشاء مهمة**

```typescript
// في Firestore Rules
match /tasks/{taskId} {
  allow create: if request.auth != null && (
    // 🔐 استخدام Custom Claims للتحقق السريع
    request.auth.token.isSystemOwner == true ||
    request.auth.token.customPermissions != null &&
    'tasks:create' in request.auth.token.customPermissions ||

    // للمهام الفردية
    (request.resource.data.organizationId == null &&
     request.resource.data.userId == request.auth.uid) ||

    // للمهام التنظيمية
    (request.resource.data.organizationId != null &&
     request.auth.token.organizationId == request.resource.data.organizationId)
  );
}
```

### **مثال 2: عرض معلومات المستخدم في الواجهة**

```typescript
// في React Component
const UserProfile = () => {
  const { user } = useAuth();
  const [userDetails, setUserDetails] = useState(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      // 🔐 الحصول على Custom Claims للصلاحيات
      const token = await user.getIdTokenResult();
      const claims = token.claims;

      // 🗄️ الحصول على البيانات التفصيلية من Firestore
      const userDoc = await db.collection('users').doc(user.uid).get();
      const firestoreData = userDoc.data();

      setUserDetails({
        // من Custom Claims (للأمان والسرعة)
        role: claims.role,                    // 🔐
        isAdmin: claims.isSystemAdmin,        // 🔐
        organizationId: claims.organizationId, // 🔐

        // من Firestore (للعرض)
        name: firestoreData.name,             // 🗄️
        profilePicture: firestoreData.profilePicture, // 🗄️
        createdAt: firestoreData.createdAt,   // 🗄️
        phoneNumber: firestoreData.phoneNumber, // 🗄️
      });
    };

    fetchUserDetails();
  }, [user]);

  return (
    <div>
      <h1>{userDetails?.name}</h1>  {/* 🗄️ من Firestore */}
      <p>Role: {userDetails?.role}</p>  {/* 🔐 من Custom Claims */}
      {userDetails?.isAdmin && <AdminPanel />}  {/* 🔐 من Custom Claims */}
    </div>
  );
};
```

### **مثال 3: Cloud Function لتحديث الصلاحيات**

```typescript
export const updateUserPermissions = functions.https.onCall(async (data, context) => {
  const { userId, newPermissions } = data;

  // 🔐 التحقق من صلاحيات المستدعي باستخدام Custom Claims
  if (!context.auth.token.isSystemOwner && !context.auth.token.isSystemAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
  }

  // 🗄️ الخطوة 1: تحديث Firestore (المصدر الأساسي)
  await admin.firestore().collection('users').doc(userId).update({
    customPermissions: newPermissions,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🗄️ الحصول على البيانات المحدثة من Firestore
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const userData = userDoc.data();

  // 🔐 الخطوة 2: تحديث Custom Claims (نسخة للأمان)
  await admin.auth().setCustomUserClaims(userId, {
    ...userData, // جميع البيانات من Firestore
    customPermissions: newPermissions, // الصلاحيات الجديدة
  });

  return { success: true };
});
```

---

## ✅ **تحديث: العناصر المضافة حديثاً**

### **🆕 العناصر التي تم إصلاحها:**

#### **1. `uid` - معرف المستخدم:**
```typescript
// ✅ الآن موجود في جميع دوال إنشاء المستخدمين
const userData = {
  uid: userRecord.uid,  // 🗄️ من Firebase Auth -> Firestore
  // ... باقي البيانات
};
```

#### **2. `createdBy` - من أنشأ المستخدم:**
```typescript
// ✅ الآن موجود في جميع دوال إنشاء المستخدمين
const userData = {
  createdBy: context.auth.uid,  // 🗄️ معرف من أنشأ المستخدم
  // ... باقي البيانات
};
```

#### **3. `customPermissions` - الصلاحيات المخصصة:**
```typescript
// ✅ الآن موجود في جميع دوال إنشاء المستخدمين
const userData = {
  customPermissions: [],  // 🗄️ مصفوفة فارغة افتراضياً
  // ... باقي البيانات
};
```

---

## 🚨 أخطاء شائعة يجب تجنبها

### ❌ **خطأ 1: الاعتماد على Custom Claims للبيانات المتغيرة**
```typescript
// خطأ - لا تفعل هذا
const userName = context.auth.token.name; // ❌ name ليس في Custom Claims

// صحيح - افعل هذا
const userDoc = await admin.firestore().collection('users').doc(userId).get();
const userName = userDoc.data().name; // ✅ من Firestore
```

### ❌ **خطأ 2: استخدام Firestore للتحقق من الصلاحيات في Rules**
```javascript
// خطأ - بطيء ومكلف
allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;

// صحيح - سريع وفعال
allow read: if request.auth.token.isAdmin == true;
```

### ❌ **خطأ 3: عدم تزامن البيانات**
```typescript
// خطأ - تحديث Custom Claims فقط
await admin.auth().setCustomUserClaims(userId, { role: newRole }); // ❌

// صحيح - تحديث Firestore أولاً ثم Custom Claims
await admin.firestore().collection('users').doc(userId).update({ role: newRole });
await admin.auth().setCustomUserClaims(userId, { role: newRole }); // ✅
```

---

## 📋 قائمة مراجعة للفريق الخلفي

### ✅ **عند كتابة Cloud Functions:**
- [ ] استخدم `context.auth.token` للتحقق من الصلاحيات
- [ ] استخدم Firestore للحصول على البيانات التفصيلية
- [ ] حدث Firestore أولاً، ثم Custom Claims
- [ ] تأكد من تزامن البيانات بين المصدرين

### ✅ **عند كتابة Firestore Rules:**
- [ ] استخدم `request.auth.token` للتحقق من الصلاحيات
- [ ] تجنب استخدام `get()` للبيانات الموجودة في Custom Claims
- [ ] استخدم `get()` فقط للبيانات غير الموجودة في Custom Claims

### ✅ **عند تصميم APIs:**
- [ ] وضح مصدر كل parameter في التوثيق
- [ ] حدد متى يتم استخدام Custom Claims vs Firestore
- [ ] تأكد من استراتيجية التزامن الواضحة

---

## 🎯 الخلاصة النهائية

### **🔐 Custom Claims = الأمان والسرعة**
- صلاحيات فورية في Firestore Rules
- تحقق سريع في Cloud Functions
- بيانات محدودة ومُحسنة

### **🗄️ Firestore = البيانات الكاملة والمرونة**
- مصدر الحقيقة الأساسي
- بيانات تفصيلية وقابلة للتوسع
- تتبع التواريخ والتغييرات

### **🔄 التزامن = الاتساق والموثوقية**
- Firestore أولاً، Custom Claims ثانياً
- تحديث متزامن لضمان الاتساق
- استراتيجية واضحة للتعامل مع الأخطاء

**الآن الفريق الخلفي يعرف بالضبط من أين يأتي كل parameter!** 🎯
