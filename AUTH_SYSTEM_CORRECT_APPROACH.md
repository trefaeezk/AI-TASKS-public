# النهج الصحيح لنظام المصادقة

## 🎯 **المبدأ الأساسي**:

### **🔐 Firebase Authentication**:
- **الوظيفة**: المصادقة فقط (تسجيل دخول/خروج، إثبات الهوية)
- **البيانات**: UID، البريد، الاسم، الصورة
- **لا يحتوي على**: الأدوار، الصلاحيات، بيانات التطبيق

### **🔥 Firestore Database**:
- **الوظيفة**: تخزين بيانات التطبيق والمستخدمين
- **البيانات**: الأدوار، الصلاحيات، المؤسسات، المهام
- **الحماية**: Security Rules بناءً على UID

## 🏗️ **هيكل البيانات الجديد**:

### **📁 مجموعة `users`**:
```typescript
interface User {
  uid: string;                    // من Authentication
  name: string;
  email: string;
  accountType: 'individual' | 'organization';
  
  // للأفراد
  role?: 'independent' | 'system_owner' | 'system_admin';
  system_owner?: boolean;
  system_admin?: boolean;
  
  // للمؤسسات
  organizationId?: string;        // معرف المؤسسة
  role?: 'organization_owner' | 'admin' | 'supervisor' | 'engineer' | 'technician' | 'assistant';
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### **📁 مجموعة `organizations`**:
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

### **📁 مجموعة `organizations/{orgId}/members`**:
```typescript
interface OrganizationMember {
  userId: string;
  role: 'admin' | 'supervisor' | 'engineer' | 'technician' | 'assistant';
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

## 🔄 **تدفق المصادقة الجديد**:

### **1. تسجيل الدخول**:
```javascript
// Firebase Authentication
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const user = userCredential.user;
const uid = user.uid;
```

### **2. جلب بيانات المستخدم**:
```javascript
// Firestore Database
const userDoc = await getDoc(doc(db, 'users', uid));
const userData = userDoc.data();
```

### **3. تحديد نوع الحساب**:
```javascript
if (userData.accountType === 'individual') {
  // 🧑 حساب فردي
  return {
    accountType: 'individual',
    role: userData.role || 'independent',
    system_owner: userData.system_owner || false,
    system_admin: userData.system_admin || false
  };
  
} else if (userData.accountType === 'organization') {
  // 🏢 حساب مؤسسة
  
  // جلب بيانات المؤسسة
  const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
  const orgData = orgDoc.data();
  
  // التحقق من الملكية
  const isOwner = orgData.ownerId === uid || orgData.createdBy === uid;
  
  if (isOwner) {
    return {
      accountType: 'organization',
      role: 'organization_owner',
      organizationId: userData.organizationId,
      organizationName: orgData.name,
      organization_owner: true
    };
  } else {
    // التحقق من العضوية
    const memberDoc = await getDoc(doc(db, 'organizations', userData.organizationId, 'members', uid));
    const memberData = memberDoc.data();
    
    return {
      accountType: 'organization',
      role: memberData.role || 'assistant',
      organizationId: userData.organizationId,
      organizationName: orgData.name,
      admin: memberData.role === 'admin'
    };
  }
}
```

## 🛡️ **Security Rules المبسطة**:

### **قواعد المستخدمين**:
```javascript
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  allow read: if request.auth != null && request.auth.token.system_admin == true;
}
```

### **قواعد المؤسسات**:
```javascript
match /organizations/{orgId} {
  allow read: if request.auth != null && (
    // مالك النظام أو أدمن النظام
    request.auth.token.system_owner == true ||
    request.auth.token.system_admin == true ||
    // عضو في المؤسسة (سيتم التحقق من organizationId في Claims)
    request.auth.token.organizationId == orgId
  );
}
```

### **قواعد المهام**:
```javascript
match /tasks/{taskId} {
  allow read: if request.auth != null && (
    // مالك النظام
    request.auth.token.system_owner == true ||
    // مهام فردية - المالك فقط
    (resource.data.organizationId == null && resource.data.userId == request.auth.uid) ||
    // مهام المؤسسة - أعضاء نفس المؤسسة
    (resource.data.organizationId != null && 
     request.auth.token.organizationId == resource.data.organizationId)
  );
}
```

## 🎯 **الأدوار المدعومة**:

### **👤 للأفراد**:
- **`independent`** - مستخدم مستقل
- **`system_admin`** - أدمن النظام
- **`system_owner`** - مالك النظام

### **🏢 للمؤسسات**:
- **`organization_owner`** - مالك المؤسسة
- **`admin`** - أدمن المؤسسة
- **`supervisor`** - مشرف
- **`engineer`** - مهندس
- **`technician`** - فني
- **`assistant`** - مساعد

## 📋 **مثال على السجلات**:

### **حساب فردي**:
```
[AuthContext] 👤 حساب فردي
[AuthContext] ✅ بيانات المستخدم الأساسية: {
  accountType: 'individual',
  role: 'independent',
  system_owner: false,
  system_admin: false
}
```

### **حساب مؤسسة - مالك**:
```
[AuthContext] 🏢 حساب مؤسسة
[AuthContext] 👑 المستخدم مالك المؤسسة
[AuthContext] 📋 البيانات النهائية للمؤسسة:
  - نوع الحساب: organization
  - الدور: organization_owner
  - معرف المؤسسة: org123
  - اسم المؤسسة: شركة ABC
  - مالك المؤسسة: true
  - أدمن المؤسسة: false
  - مالك النظام: false
  - أدمن النظام: false
```

### **حساب مؤسسة - عضو**:
```
[AuthContext] 🏢 حساب مؤسسة
[AuthContext] 👥 المستخدم عضو في المؤسسة، الدور: engineer
[AuthContext] 📋 البيانات النهائية للمؤسسة:
  - نوع الحساب: organization
  - الدور: engineer
  - معرف المؤسسة: org123
  - اسم المؤسسة: شركة ABC
  - مالك المؤسسة: false
  - أدمن المؤسسة: false
  - مالك النظام: false
  - أدمن النظام: false
```

## ✅ **المزايا الجديدة**:

### **🚀 البساطة**:
- نهج واضح ومفهوم
- فصل واضح بين المصادقة والبيانات
- سهولة الصيانة والتطوير

### **🔒 الأمان**:
- Security Rules مبسطة وآمنة
- حماية البيانات الشخصية والمؤسسية
- منع الوصول غير المصرح

### **⚡ الأداء**:
- تقليل عدد الاستعلامات
- تحميل سريع للبيانات
- تحسين تجربة المستخدم

### **🔧 المرونة**:
- دعم الأفراد والمؤسسات
- نظام أدوار مرن
- قابلية التوسع

## 🎉 **النتيجة النهائية**:

**نظام مصادقة صحيح ومعياري يتبع أفضل الممارسات في Firebase!**

- ✅ **Authentication للمصادقة فقط**
- ✅ **Firestore للبيانات والأدوار**
- ✅ **Security Rules مبسطة وآمنة**
- ✅ **دعم كامل للأفراد والمؤسسات**
- ✅ **سجلات مفصلة للتشخيص**

**جاهز للاختبار!** 🚀
