# دوال Firebase للمؤسسات والمستخدمين الفرديين

هذا المشروع يحتوي على دوال Firebase للمؤسسات والمستخدمين الفرديين، مع الحفاظ على الخصوصية وفصل البيانات.

## هيكل المشروع

```
functions-organization/
├── src/
│   ├── index.ts                # نقطة الدخول الرئيسية
│   ├── roles.ts                # دوال إدارة الأدوار
│   ├── roles-http.ts           # دوال إدارة الأدوار (HTTP)
│   ├── system.ts               # دوال إدارة النظام
│   ├── utils.ts                # ملف مساعد قديم (للتوافق)
│   ├── individual/             # دوال المستخدمين الفرديين
│   │   ├── index.ts            # دوال المستخدمين الفرديين
│   │   └── utils.ts            # وظائف مساعدة للمستخدمين الفرديين
│   ├── organization/           # دوال المؤسسات
│   │   ├── index.ts            # دوال المؤسسات
│   │   └── utils.ts            # وظائف مساعدة للمؤسسات
│   └── shared/                 # دوال ووظائف مشتركة
│       ├── permissions.ts      # وظائف إدارة الصلاحيات
│       └── utils.ts            # وظائف مساعدة مشتركة
├── lib/                        # ملفات JavaScript المجمعة
├── package.json                # تبعيات المشروع
├── firebase.json               # تكوين Firebase
└── .firebaserc                 # تكوين مشروع Firebase
```

## هيكل قاعدة البيانات

```
firestore/
├── individuals/                # مجموعة المستخدمين الفرديين
│   └── {userId}/               # وثيقة المستخدم الفردي
│       ├── tasks/              # مهام المستخدم الفردي
│       └── reports/            # تقارير المستخدم الفردي
├── organizations/              # مجموعة المؤسسات
│   └── {orgId}/                # وثيقة المؤسسة
│       ├── members/            # أعضاء المؤسسة
│       │   └── {userId}/       # معلومات العضو في المؤسسة
│       ├── tasks/              # مهام المؤسسة
│       └── reports/            # تقارير المؤسسة
└── users/                      # معلومات المستخدمين المشتركة
    └── {userId}/               # معلومات المستخدم
```

## الأدوار والصلاحيات

### الأدوار المدعومة

- **admin**: مدير النظام (أعلى صلاحية)
- **engineer**: مهندس
- **supervisor**: مشرف
- **technician**: فني
- **assistant**: مساعد فني
- **user**: مستخدم عادي
- **independent**: مستخدم مستقل (فردي)

### مجالات الصلاحيات

- **users**: إدارة المستخدمين
- **tasks**: إدارة المهام
- **reports**: التقارير
- **settings**: الإعدادات
- **tools**: الأدوات
- **dashboard**: لوحة المعلومات
- **data**: إدارة البيانات (تصدير/استيراد)

### أنواع الصلاحيات

- **view**: عرض
- **create**: إنشاء
- **edit**: تعديل
- **delete**: حذف
- **approve**: موافقة/اعتماد
- **assign**: تعيين/إسناد

## الدوال المتاحة

### دوال المستخدمين الفرديين

- **createIndividualUser**: إنشاء مستخدم فردي جديد
- **getIndividualUserData**: الحصول على بيانات المستخدم الفردي
- **updateIndividualUserData**: تحديث بيانات المستخدم الفردي
- **exportIndividualData**: تصدير بيانات المستخدم الفردي
- **importIndividualData**: استيراد بيانات المستخدم الفردي

### دوال المؤسسات

- **createOrganization**: إنشاء مؤسسة جديدة
- **getOrganization**: الحصول على معلومات المؤسسة
- **updateOrganization**: تحديث معلومات المؤسسة
- **addOrganizationMember**: إضافة عضو إلى المؤسسة
- **removeOrganizationMember**: إزالة عضو من المؤسسة
- **getOrganizationMembers**: الحصول على أعضاء المؤسسة

### دوال إدارة الأدوار

- **updateUserRole**: تحديث دور المستخدم
- **updateUserPermissions**: تحديث صلاحيات المستخدم

### دوال إدارة النظام

- **getSystemSettings**: الحصول على إعدادات النظام
- **setupSystem**: إعداد النظام

## الخصوصية وفصل البيانات

تم تصميم النظام لضمان الخصوصية وفصل البيانات بين المستخدمين الفرديين والمؤسسات:

1. **المستخدمون الفرديون**:
   - يمكنهم الوصول إلى بياناتهم الخاصة فقط
   - يتم تخزين بياناتهم في مجموعة `individuals`
   - لديهم دور `independent`

2. **المؤسسات**:
   - يمكن لأعضاء المؤسسة الوصول إلى بيانات المؤسسة فقط
   - يتم تخزين بيانات المؤسسة في مجموعة `organizations`
   - يمكن للمديرين فقط إدارة المؤسسة وأعضائها

3. **قواعد الأمان**:
   - تم تنفيذ قواعد أمان Firestore لضمان الفصل بين البيانات
   - يتم التحقق من الصلاحيات في كل دالة

## كيفية النشر

```bash
# تثبيت التبعيات
npm install

# بناء المشروع
npm run build

# نشر الدوال
firebase deploy --only functions
```

## ملاحظات هامة

1. **الصلاحيات المخصصة**: يمكن تخصيص صلاحيات أي مستخدم بغض النظر عن دوره الأساسي.
2. **تصدير واستيراد البيانات**: يمكن للمستخدمين الفرديين تصدير واستيراد بياناتهم.
3. **الفصل بين البيانات**: لا يمكن لمديري المؤسسات الوصول إلى بيانات المستخدمين الفرديين.

## تحسينات الأداء (تم التحديث)

تم إجراء تحسينات على وظائف Firebase لتقليل استهلاك الموارد وحل مشكلة "تجاوز الحصة" (Quota Exceeded).

### التغييرات الرئيسية:

1. **تعطيل الوظائف HTTP المكررة**:
   - تم تعطيل `setAdminRoleHttp`، `setUserDisabledStatusHttp`، `createUserHttp`، `setOwnerDirectHttp`، `listUsersHttp`، `getUserHttp`
   - يجب استخدام الوظائف البديلة (Callable Functions) بدلاً منها

2. **تحسين وظائف OTP**:
   - تم تبسيط وظائف `generateAndSendOTP` و `verifyOTP` لتكون أكثر كفاءة

### تغييرات مطلوبة في الفرونت إند:

يجب تعديل الفرونت إند لاستخدام الوظائف البديلة (Callable Functions) بدلاً من الوظائف HTTP المباشرة:

#### 1. تعديل صفحة المسؤول (admin/page.tsx):

```javascript
// بدلاً من:
const functionUrl = 'https://us-central1-tasks-intelligence.cloudfunctions.net/setAdminRoleHttp';
const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
        uid: userId,
        isAdmin: !currentIsAdmin
    })
});

// استخدم:
const setAdminRoleFn = httpsCallable<{ uid: string; isAdmin: boolean }, { result?: string; error?: string }>(functionsInstance, 'setAdminRole');
const result = await setAdminRoleFn({ uid: userId, isAdmin: !currentIsAdmin });
```

#### 2. تعديل وظيفة تعطيل المستخدم:

```javascript
// بدلاً من:
const functionUrl = 'https://us-central1-tasks-intelligence.cloudfunctions.net/setUserDisabledStatusHttp';
const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
        uid: userId,
        disabled: !currentIsDisabled
    })
});

// استخدم:
const setUserDisabledStatusFn = httpsCallable<{ uid: string; disabled: boolean }, { result?: string; error?: string }>(functionsInstance, 'setUserDisabledStatus');
const result = await setUserDisabledStatusFn({ uid: userId, disabled: !currentIsDisabled });
```

#### 3. تعديل وظيفة إنشاء مستخدم:

```javascript
// بدلاً من:
const functionUrl = 'https://us-central1-tasks-intelligence.cloudfunctions.net/createUserHttp';
const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(userData)
});

// استخدم:
const createUserFn = httpsCallable<CreateUserInput, { uid?: string; error?: string }>(functionsInstance, 'createUser');
const result = await createUserFn(userData);
```

#### 4. تعديل وظيفة جلب قائمة المستخدمين:

```javascript
// بدلاً من:
const response = await fetch('https://us-central1-tasks-intelligence.cloudfunctions.net/listUsersHttp', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${idToken}`
    }
});

// استخدم:
const listFirebaseUsersFn = httpsCallable<{ maxResults?: number; pageToken?: string }, { users: any[] }>(functionsInstance, 'listFirebaseUsers');
const result = await listFirebaseUsersFn({});
```

### ملاحظات إضافية:

1. **تأكد من استيراد الوظائف اللازمة**:
   ```javascript
   import { httpsCallable } from 'firebase/functions';
   ```

2. **تأكد من تهيئة functionsInstance**:
   ```javascript
   const functionsInstance = getFunctions();
   ```

3. **تعامل مع الأخطاء بشكل صحيح**:
   ```javascript
   try {
       const result = await functionCall(params);
       // معالجة النتيجة
   } catch (error) {
       // معالجة الخطأ
   }
   ```
