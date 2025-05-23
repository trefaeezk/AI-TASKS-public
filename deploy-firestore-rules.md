# نشر قواعد Firestore المحدثة

## التغييرات المطلوبة

تم تحديث قواعد Firestore لحل مشكلة خطأ "Missing or insufficient permissions" ولدعم نظام الأفراد بشكل كامل.

### التغييرات الرئيسية:

#### 1. إعدادات النظام:
```javascript
// قواعد لإعدادات النظام
match /system/{document=**} {
  // يمكن لأي شخص قراءة إعدادات النظام الأساسية (للتحقق من الإعداد)
  allow read: if true;

  // يمكن للمديرين فقط تعديل إعدادات النظام العامة
  allow write: if request.auth != null && request.auth.token.admin == true;
}
```

#### 2. إعدادات المستخدمين الفرديين:
```javascript
// قواعد لإعدادات المستخدمين الفرديين
match /userSettings/{userId} {
  // يمكن للمستخدم قراءة إعداداته الخاصة فقط
  allow read: if request.auth != null && request.auth.uid == userId;

  // يمكن للمستخدم تعديل إعداداته الخاصة فقط
  allow write: if request.auth != null && request.auth.uid == userId;

  // يمكن للمديرين قراءة وتعديل إعدادات جميع المستخدمين (للدعم الفني)
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

#### 3. إعدادات الإشعارات:
```javascript
// قواعد لإعدادات الإشعارات
match /notificationSettings/{userId} {
  // يمكن للمستخدم قراءة إعدادات الإشعارات الخاصة به فقط
  allow read: if request.auth != null && request.auth.uid == userId;

  // يمكن للمستخدم تعديل إعدادات الإشعارات الخاصة به فقط
  allow write: if request.auth != null && request.auth.uid == userId;

  // يمكن للمديرين قراءة وتعديل إعدادات الإشعارات لجميع المستخدمين
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

#### 4. الإشعارات:
```javascript
// قواعد للإشعارات
match /notifications/{notificationId} {
  // يمكن للمستخدم قراءة الإشعارات المرسلة إليه فقط
  allow read: if request.auth != null &&
               (resource.data.userId == request.auth.uid ||
                resource.data.recipientId == request.auth.uid);

  // يمكن للمستخدم تحديث حالة الإشعارات الخاصة به
  allow update: if request.auth != null &&
                 (resource.data.userId == request.auth.uid ||
                  resource.data.recipientId == request.auth.uid);

  // يمكن للنظام إنشاء إشعارات
  allow create: if request.auth != null;

  // يمكن للمديرين إدارة جميع الإشعارات
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}
```

## خطوات النشر:

### 1. نشر قواعد Firestore:
```bash
firebase deploy --only firestore:rules
```

### 2. التحقق من نشر القواعد:
- افتح Firebase Console
- انتقل إلى Firestore Database
- انقر على "Rules"
- تأكد من أن القواعد المحدثة ظاهرة

### 3. اختبار التطبيق:
- افتح التطبيق في المتصفح
- تأكد من عدم ظهور خطأ "Missing or insufficient permissions" في console
- تأكد من أن `SystemSetupCheck` يعمل بشكل صحيح

## المنطق المطبق لنظام الأفراد:

### ✅ ما يمكن للمستخدم الفردي فعله:
1. **تعديل إعداداته الشخصية**: اللغة، الإشعارات، إلخ في `/userSettings/{userId}`
2. **إدارة إعدادات الإشعارات**: في `/notificationSettings/{userId}`
3. **قراءة إشعاراته الخاصة**: في `/notifications`
4. **تحديث معلوماته الأساسية**: في `/users/{userId}`
5. **إدارة بياناته الفردية**: في `/individuals/{userId}`

### ❌ ما لا يمكن للمستخدم الفردي فعله:
1. **الوصول لإعدادات مستخدمين آخرين**
2. **تعديل إعدادات النظام العامة**
3. **الوصول لبيانات المؤسسات** (إلا إذا كان عضواً)

## الأمان:

هذه التغييرات آمنة لأن:
1. **إعدادات النظام**: فقط القراءة مسموحة للجميع، الكتابة محصورة بالمديرين
2. **إعدادات المستخدمين**: كل مستخدم يمكنه الوصول لإعداداته فقط
3. **الإشعارات**: كل مستخدم يمكنه قراءة إشعاراته فقط
4. **المديرين**: لديهم صلاحيات إضافية للدعم الفني

## البديل (إذا كنت تفضل عدم السماح بالقراءة العامة):

يمكنك استخدام Cloud Function للتحقق من إعداد النظام بدلاً من الوصول المباشر إلى Firestore:

```javascript
// في Cloud Functions
export const checkSystemSetup = functions.https.onCall(async (data, context) => {
  try {
    const settingsDoc = await admin.firestore().collection('system').doc('settings').get();
    return { exists: settingsDoc.exists };
  } catch (error) {
    console.error('Error checking system setup:', error);
    return { exists: false };
  }
});
```

ولكن الحل الحالي أبسط وأكثر كفاءة.
