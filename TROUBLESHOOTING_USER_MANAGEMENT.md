# دليل حل مشاكل إدارة المستخدمين

## المشكلة الحالية
عدم عمل إنشاء وتعديل المستخدمين في صفحة إدارة المستخدمين، مع عدم استدعاء Firebase Functions.

## الحلول المطبقة

### 1. تحسين إعدادات Firebase Functions
- ✅ تحسين ملف `src/lib/firebase.ts` لمعالجة البيئات المختلفة
- ✅ إضافة معالجة أفضل للأخطاء في `useSecureUserManagement.ts`
- ✅ إضافة تسجيل مفصل للأخطاء والعمليات

### 2. أدوات التشخيص
- ✅ إنشاء صفحة تشخيص شاملة: `/admin/diagnostics`
- ✅ مكون `FirebaseFunctionsDiagnostic` لاختبار الاتصال
- ✅ مكون `FunctionsStatus` لمراقبة حالة الدوال
- ✅ مكون `CreateUserTest` لاختبار إنشاء المستخدمين

### 3. تحسينات الواجهة
- ✅ إضافة زر "تشخيص المشاكل" في صفحة إدارة المستخدمين
- ✅ تحسين رسائل الأخطاء وإضافة تفاصيل أكثر
- ✅ إضافة مؤشرات تحميل وحالة أفضل

## كيفية استخدام أدوات التشخيص

### 1. الوصول لصفحة التشخيص
```
/admin/diagnostics
```

### 2. اختبار الاتصال
1. انقر على "بدء التشخيص" في مكون Firebase Functions Diagnostic
2. راجع النتائج لفهم المشكلة
3. استخدم "اختبار إنشاء مستخدم" لاختبار العملية كاملة

### 3. مراقبة حالة الدوال
- مكون "حالة Firebase Functions" يعرض حالة الدوال في الوقت الفعلي
- يتم تحديث الحالة كل 30 ثانية تلقائياً

## الأخطاء الشائعة وحلولها

### 1. CORS Error
**المشكلة:** `Access to fetch at 'https://us-central1-tasks-intelligence.cloudfunctions.net/createUser' from origin 'http://localhost:9003' has been blocked by CORS policy`

**الحل:**
```bash
# تأكد من نشر Functions
cd functions
npm run build
firebase deploy --only functions
```

### 2. functions/unauthenticated
**المشكلة:** المستخدم غير مصادق عليه

**الحل:**
- تأكد من تسجيل الدخول
- تحقق من صحة Firebase Auth token

### 3. functions/permission-denied
**المشكلة:** المستخدم ليس لديه صلاحيات admin

**الحل:**
```javascript
// تحقق من custom claims
const user = auth.currentUser;
const token = await user.getIdTokenResult();
console.log('Custom claims:', token.claims);
```

### 4. functions/internal
**المشكلة:** خطأ داخلي في الخادم

**الحل:**
- تحقق من Firebase Functions logs في Console
- راجع كود الدالة للأخطاء

## خطوات التحقق المنهجية

### 1. التحقق من البيئة
```javascript
console.log('Environment:', process.env.NODE_ENV);
console.log('Functions available:', !!functions);
console.log('User authenticated:', !!user);
```

### 2. التحقق من Firebase Console
1. اذهب إلى Firebase Console
2. تحقق من Functions tab
3. تأكد من وجود الدوال المطلوبة:
   - `createUser`
   - `updateUserRole`
   - `updateUserPermissions`
   - `toggleUserDisabled`

### 3. التحقق من Network
1. افتح Developer Tools
2. اذهب إلى Network tab
3. حاول إنشاء مستخدم
4. راجع الطلبات والاستجابات

### 4. التحقق من Console Logs
```javascript
// في المتصفح
console.log('Firebase config:', firebaseConfig);
console.log('Functions instance:', functions);
console.log('Auth user:', auth.currentUser);
```

## الملفات المحدثة

### Frontend
- `src/lib/firebase.ts` - تحسين إعدادات Functions
- `src/hooks/useSecureUserManagement.ts` - معالجة أفضل للأخطاء
- `src/app/(admin)/admin/users/page.tsx` - إضافة زر التشخيص
- `src/app/(admin)/admin/diagnostics/page.tsx` - صفحة التشخيص الجديدة

### Components
- `src/components/debug/FirebaseFunctionsDiagnostic.tsx`
- `src/components/debug/FunctionsStatus.tsx`
- `src/components/debug/CreateUserTest.tsx`

### Backend (Firebase Functions)
- `functions/src/index.ts` - الدوال الأساسية
- `functions/src/roles.ts` - دوال إدارة الأدوار
- `functions/src/shared/function-utils.ts` - أدوات مساعدة

## الخطوات التالية

### إذا استمرت المشكلة:

1. **تحقق من نشر Functions:**
   ```bash
   cd functions
   firebase deploy --only functions
   ```

2. **تحقق من Firebase Console Logs:**
   - اذهب إلى Functions > Logs
   - ابحث عن أخطاء في الدوال

3. **اختبر الدوال مباشرة:**
   ```bash
   # استخدم Firebase CLI لاختبار الدوال
   firebase functions:shell
   ```

4. **تحقق من إعدادات المشروع:**
   - تأكد من صحة Project ID
   - تحقق من إعدادات IAM

## معلومات الاتصال للدعم

إذا استمرت المشكلة بعد تطبيق هذه الحلول، يرجى:
1. تشغيل أدوات التشخيص وحفظ النتائج
2. تحقق من Firebase Console Logs
3. جمع معلومات الأخطاء من Developer Tools
4. توثيق الخطوات المتبعة

## ملاحظات مهمة

- تأكد من أن Firebase Functions منشورة في المنطقة الصحيحة (us-central1)
- تحقق من أن المستخدم لديه صلاحيات admin في custom claims
- راجع Firebase Console للتأكد من عدم وجود مشاكل في الفوترة أو الحدود
- تأكد من أن جميع التبعيات محدثة ومتوافقة
