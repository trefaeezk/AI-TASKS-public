# توثيق قواعد Firestore المحدثة

## نظرة عامة

تم تحديث قواعد Firestore لدعم نظام الأفراد بشكل كامل، حيث يمكن لكل فرد تعديل إعداداته الخاصة به حسب المنطق المطلوب.

## هيكل القواعد

### 1. قواعد المستخدمين الفرديين
```javascript
match /individuals/{userId}/{document=**} {
  // يمكن للمستخدم قراءة وكتابة بياناته الخاصة فقط
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**الوصف**: تسمح للمستخدمين الفرديين بإدارة جميع بياناتهم الشخصية في مجموعة `individuals`.

### 2. قواعد المؤسسات
```javascript
match /organizations/{orgId} {
  // قراءة معلومات المؤسسة للأعضاء فقط
  allow read: if request.auth != null && 
               exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
  
  // تعديل معلومات المؤسسة للمديرين فقط
  allow write: if request.auth != null && 
                get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'admin';
}
```

**الوصف**: تحكم في الوصول لبيانات المؤسسات بناءً على العضوية والأدوار.

### 3. قواعد المستخدمين العامة
```javascript
match /users/{userId} {
  // يمكن للمستخدم قراءة معلوماته الخاصة
  allow read: if request.auth != null && request.auth.uid == userId;
  
  // يمكن للمديرين قراءة معلومات جميع المستخدمين
  allow read: if request.auth != null && request.auth.token.admin == true;
  
  // يمكن للمستخدم تعديل معلوماته الخاصة
  allow update: if request.auth != null && request.auth.uid == userId;
  
  // يمكن للمديرين تعديل معلومات جميع المستخدمين
  allow write: if request.auth != null && request.auth.token.admin == true;
}
```

**الوصف**: تسمح للمستخدمين بإدارة معلوماتهم الشخصية مع إعطاء صلاحيات إضافية للمديرين.

### 4. قواعد إعدادات النظام
```javascript
match /system/{document=**} {
  // يمكن لأي شخص قراءة إعدادات النظام الأساسية (للتحقق من الإعداد)
  allow read: if true;
  
  // يمكن للمديرين فقط تعديل إعدادات النظام العامة
  allow write: if request.auth != null && request.auth.token.admin == true;
}
```

**الوصف**: تسمح بقراءة إعدادات النظام العامة لجميع المستخدمين (لحل مشكلة SystemSetupCheck) مع حصر التعديل بالمديرين.

### 5. قواعد إعدادات المستخدمين الفرديين ⭐
```javascript
match /userSettings/{userId} {
  // يمكن للمستخدم قراءة إعداداته الخاصة فقط
  allow read: if request.auth != null && request.auth.uid == userId;
  
  // يمكن للمستخدم تعديل إعداداته الخاصة فقط
  allow write: if request.auth != null && request.auth.uid == userId;
  
  // يمكن للمديرين قراءة وتعديل إعدادات جميع المستخدمين (للدعم الفني)
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

**الوصف**: **هذا هو الجزء الأساسي** - يسمح لكل مستخدم فردي بتعديل إعداداته الشخصية (اللغة، الإشعارات، إلخ).

### 6. قواعد إعدادات الإشعارات
```javascript
match /notificationSettings/{userId} {
  // يمكن للمستخدم قراءة إعدادات الإشعارات الخاصة به فقط
  allow read: if request.auth != null && request.auth.uid == userId;
  
  // يمكن للمستخدم تعديل إعدادات الإشعارات الخاصة به فقط
  allow write: if request.auth != null && request.auth.uid == userId;
  
  // يمكن للمديرين قراءة وتعديل إعدادات الإشعارات لجميع المستخدمين (للدعم الفني)
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

**الوصف**: تسمح للمستخدمين بإدارة إعدادات الإشعارات الخاصة بهم.

### 7. قواعد الإشعارات
```javascript
match /notifications/{notificationId} {
  // يمكن للمستخدم قراءة الإشعارات المرسلة إليه فقط
  allow read: if request.auth != null && 
               (resource.data.userId == request.auth.uid || 
                resource.data.recipientId == request.auth.uid);
  
  // يمكن للمستخدم تحديث حالة الإشعارات الخاصة به (مثل تحديد كمقروءة)
  allow update: if request.auth != null && 
                 (resource.data.userId == request.auth.uid || 
                  resource.data.recipientId == request.auth.uid);
  
  // يمكن للنظام إنشاء إشعارات (عبر Cloud Functions)
  allow create: if request.auth != null;
  
  // يمكن للمديرين إدارة جميع الإشعارات
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

**الوصف**: تحكم في الوصول للإشعارات بناءً على المستلم.

## المنطق المطبق لنظام الأفراد

### ✅ ما يمكن للمستخدم الفردي فعله:

1. **إدارة بياناته الشخصية**: في مجموعة `/individuals/{userId}`
2. **تعديل إعداداته**: في مجموعة `/userSettings/{userId}`
3. **إدارة إعدادات الإشعارات**: في مجموعة `/notificationSettings/{userId}`
4. **قراءة إشعاراته**: في مجموعة `/notifications`
5. **تحديث معلوماته الأساسية**: في مجموعة `/users/{userId}`
6. **قراءة إعدادات النظام العامة**: في مجموعة `/system`

### ❌ ما لا يمكن للمستخدم الفردي فعله:

1. **الوصول لبيانات مستخدمين آخرين**
2. **تعديل إعدادات النظام العامة**
3. **الوصول لبيانات المؤسسات** (إلا إذا كان عضواً)

## الأمان

### مستويات الحماية:

1. **حماية على مستوى المستخدم**: `request.auth.uid == userId`
2. **حماية على مستوى المديرين**: `request.auth.token.admin == true`
3. **حماية على مستوى المؤسسة**: التحقق من العضوية والأدوار

### نقاط الأمان المهمة:

- ✅ كل مستخدم يمكنه الوصول لبياناته فقط
- ✅ المديرين لديهم صلاحيات إضافية للدعم الفني
- ✅ إعدادات النظام محمية من التعديل غير المصرح
- ✅ بيانات المؤسسات محمية بناءً على العضوية

## استخدام القواعد في التطبيق

### مثال: حفظ إعدادات اللغة للمستخدم الفردي
```typescript
// في LanguageContext.tsx
const userSettingsRef = doc(db, 'userSettings', user.uid);
await setDoc(userSettingsRef, {
  language: 'ar',
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### مثال: حفظ إعدادات الإشعارات
```typescript
// في notifications service
const settingsRef = doc(db, 'notificationSettings', userId);
await updateDoc(settingsRef, {
  email: true,
  push: false,
  updatedAt: serverTimestamp()
});
```

## نشر القواعد

لنشر القواعد المحدثة:

```bash
firebase deploy --only firestore:rules
```

## اختبار القواعد

يمكن اختبار القواعد باستخدام:

```bash
firebase emulators:start --only firestore
```

ثم استخدام Firebase Rules Playground في Firebase Console.

## الخلاصة

القواعد المحدثة تدعم بالكامل:
- ✅ **نظام الأفراد**: كل فرد يعدل إعداداته الخاصة
- ✅ **نظام المؤسسات**: إدارة بناءً على الأدوار والعضوية
- ✅ **الأمان**: حماية شاملة للبيانات
- ✅ **المرونة**: دعم للحالات المختلفة

هذا يضمن أن كل مستخدم فردي يمكنه إدارة إعداداته الشخصية (اللغة، الإشعارات، إلخ) بدون التأثير على المستخدمين الآخرين أو إعدادات النظام العامة.
