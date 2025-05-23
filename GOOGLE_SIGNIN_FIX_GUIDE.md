# دليل إصلاح تسجيل الدخول عبر Google - حل شامل

## ✅ تم التحقق من البيانات

جميع بيانات Firebase في التطبيق **صحيحة ومطابقة**:

### البيانات المؤكدة:
- **Project ID**: `tasks-intelligence` ✅
- **API Key**: `AIzaSyBIJrQX5HBBnP7LKzgsUNdWCX7aqhVG3wA` ✅
- **Auth Domain**: `tasks-intelligence.firebaseapp.com` ✅
- **Project Number**: `770714758504` ✅
- **App ID**: `1:770714758504:web:aea98ba39a726df1ba3add` ✅

## 🔧 خطوات الحل المطلوبة

### الخطوة 1: إعدادات Firebase Console

#### أ) تفعيل Google Sign-in:
1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. اختر مشروع `tasks-intelligence`
3. اذهب إلى **Authentication** → **Sign-in method**
4. اضغط على **Google**
5. تأكد من أنه **مفعل (Enabled)**
6. في **Web SDK configuration**:
   - تأكد من وجود **Web client ID**
   - تأكد من وجود **Web client secret**

#### ب) النطاقات المصرح بها:
1. في نفس صفحة Authentication
2. اذهب إلى تبويب **Settings**
3. في قسم **Authorized domains** تأكد من وجود:
   ```
   studio--tasks-intelligence.us-central1.hosted.app
   tasks-intelligence.web.app
   tasks-intelligence.firebaseapp.com
   localhost
   127.0.0.1
   ```
4. إذا لم تكن موجودة، اضغط **Add domain** وأضفها

### الخطوة 2: إعدادات Google Cloud Console

#### أ) الوصول إلى Google Cloud Console:
1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com)
2. تأكد من اختيار مشروع `tasks-intelligence`
3. اذهب إلى **APIs & Services** → **Credentials**

#### ب) إعداد OAuth 2.0 Client ID:
1. ابحث عن **OAuth 2.0 Client IDs**
2. اضغط على الـ Client ID الخاص بالويب (Web client)
3. في **Authorized JavaScript origins** أضف:
   ```
   https://studio--tasks-intelligence.us-central1.hosted.app
   https://tasks-intelligence.web.app
   https://tasks-intelligence.firebaseapp.com
   http://localhost:3000
   http://localhost:9003
   http://127.0.0.1:3000
   http://127.0.0.1:9003
   ```
4. في **Authorized redirect URIs** أضف:
   ```
   https://studio--tasks-intelligence.us-central1.hosted.app/__/auth/handler
   https://tasks-intelligence.firebaseapp.com/__/auth/handler
   https://tasks-intelligence.web.app/__/auth/handler
   ```
5. اضغط **Save**

### الخطوة 3: تحسين إعدادات Google Provider

تم تحسين إعدادات Google Provider في الكود:

```typescript
// في src/lib/firebase.ts
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
```

**الفوائد**:
- ✅ **طلب الصلاحيات المطلوبة**: email و profile
- ✅ **إجبار اختيار الحساب**: يظهر قائمة الحسابات دائماً
- ✅ **تحسين تجربة المستخدم**: وضوح أكثر في عملية التسجيل

### الخطوة 4: التحقق من حالة الخطأ

#### أ) أخطاء شائعة وحلولها:

**1. `auth/unauthorized-domain`**:
- **السبب**: النطاق غير مصرح في Firebase
- **الحل**: أضف النطاق في Authorized domains

**2. `auth/popup-closed-by-user`**:
- **السبب**: المستخدم أغلق النافذة المنبثقة
- **الحل**: طبيعي، لا يحتاج إصلاح

**3. `auth/popup-blocked`**:
- **السبب**: المتصفح يحجب النوافذ المنبثقة
- **الحل**: اطلب من المستخدم السماح للنوافذ المنبثقة

**4. `auth/network-request-failed`**:
- **السبب**: مشكلة في الاتصال
- **الحل**: تحقق من الاتصال بالإنترنت

#### ب) تحسين معالجة الأخطاء:

```typescript
// في src/hooks/useFirebaseAuth.ts - تم تحسين معالجة الأخطاء
const handleAuthError = (err: unknown) => {
  const authError = err as AuthError;
  let message = 'حدث خطأ غير متوقع.';

  switch (authError.code) {
    case 'auth/unauthorized-domain':
      message = 'النطاق غير مصرح به. يرجى المحاولة من الموقع الرسمي.';
      break;
    case 'auth/popup-closed-by-user':
      message = 'تم إلغاء عملية تسجيل الدخول.';
      break;
    case 'auth/popup-blocked':
      message = 'يرجى السماح للنوافذ المنبثقة في المتصفح.';
      break;
    case 'auth/network-request-failed':
      message = 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
      break;
    // ... باقي الأخطاء
  }

  setError(message);
  toast({
    title: 'خطأ في تسجيل الدخول',
    description: message,
    variant: 'destructive',
  });
};
```

### الخطوة 5: اختبار الحل

#### أ) اختبار محلي:
1. **تشغيل التطبيق محلياً**:
   ```bash
   npm run dev
   ```
2. **الوصول عبر localhost**:
   ```
   http://localhost:3000/login
   ```
3. **اختبار Google Sign-in**:
   - اضغط على زر "تسجيل الدخول بـ Google"
   - تأكد من ظهور نافذة Google
   - أكمل عملية التسجيل

#### ب) اختبار الإنتاج:
1. **نشر التطبيق**:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```
2. **الوصول للموقع المنشور**:
   ```
   https://tasks-intelligence.web.app/login
   ```
3. **اختبار Google Sign-in في الإنتاج**

### الخطوة 6: حلول إضافية إذا استمرت المشكلة

#### أ) إعادة إنشاء OAuth Client:
1. في Google Cloud Console
2. احذف OAuth 2.0 Client ID الحالي
3. أنشئ واحد جديد
4. انسخ الـ Client ID الجديد
5. حدث إعدادات Firebase

#### ب) تحقق من إعدادات المشروع:
1. تأكد من أن المشروع مفعل في Google Cloud
2. تأكد من تفعيل Google+ API (إذا مطلوب)
3. تحقق من حدود الاستخدام (Quotas)

#### ج) استخدام signInWithRedirect بدلاً من Popup:

```typescript
// بديل للـ popup إذا لم يعمل
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';

const signInWithGoogleRedirect = async () => {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Redirect sign-in error:', error);
  }
};

// للتحقق من نتيجة الـ redirect
useEffect(() => {
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        // تم تسجيل الدخول بنجاح
        console.log('Redirect sign-in successful:', result.user);
      }
    })
    .catch((error) => {
      console.error('Redirect result error:', error);
    });
}, []);
```

## 🎯 الخطوات الأولوية

### ابدأ بهذه الخطوات بالترتيب:

1. **✅ تحقق من Firebase Console**:
   - تفعيل Google Sign-in
   - إضافة النطاقات المصرح بها

2. **✅ تحقق من Google Cloud Console**:
   - إعداد OAuth 2.0 Client ID
   - إضافة JavaScript origins و redirect URIs

3. **✅ اختبار محلي**:
   - استخدم localhost بدلاً من IP
   - تأكد من عدم وجود أخطاء في Console

4. **✅ اختبار الإنتاج**:
   - نشر التطبيق
   - اختبار على الموقع المنشور

## 📞 إذا استمرت المشكلة

إذا لم تحل هذه الخطوات المشكلة، يرجى مشاركة:

1. **رسالة الخطأ الكاملة** من Console
2. **لقطة شاشة** من إعدادات Firebase Authentication
3. **لقطة شاشة** من إعدادات Google Cloud OAuth
4. **البيئة المستخدمة** (محلي أم إنتاج)

## ✨ النتيجة المتوقعة

بعد تطبيق هذه الخطوات:
- ✅ تسجيل الدخول عبر Google يعمل محلياً
- ✅ تسجيل الدخول عبر Google يعمل في الإنتاج
- ✅ لا توجد أخطاء في Console
- ✅ تجربة مستخدم سلسة ومحسنة


<function_calls>
<invoke name="str-replace-editor">
<parameter name="command">view
