# حل سريع لمشكلة تسجيل الدخول عبر Google

## ✅ تم التحقق من البيانات - كلها صحيحة!

جميع بيانات Firebase في التطبيق صحيحة ومطابقة لمشروع `tasks-intelligence`.

## 🚀 الحل السريع - 3 خطوات فقط

### الخطوة 1: Firebase Console
1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. اختر مشروع `tasks-intelligence`
3. Authentication → Sign-in method → Google → تأكد من التفعيل
4. Authentication → Settings → Authorized domains → أضف:
   ```
   studio--tasks-intelligence.us-central1.hosted.app
   tasks-intelligence.web.app
   tasks-intelligence.firebaseapp.com
   localhost
   127.0.0.1
   ```

### الخطوة 2: Google Cloud Console
1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com)
2. تأكد من اختيار مشروع `tasks-intelligence`
3. APIs & Services → Credentials → OAuth 2.0 Client ID
4. في **Authorized JavaScript origins** أضف:
   ```
   https://studio--tasks-intelligence.us-central1.hosted.app
   https://tasks-intelligence.web.app
   https://tasks-intelligence.firebaseapp.com
   http://localhost:3000
   http://localhost:9003
   ```
5. في **Authorized redirect URIs** أضف:
   ```
   https://studio--tasks-intelligence.us-central1.hosted.app/__/auth/handler
   https://tasks-intelligence.firebaseapp.com/__/auth/handler
   https://tasks-intelligence.web.app/__/auth/handler
   ```

### الخطوة 3: اختبار
1. **محلياً**: استخدم `http://localhost:3000/login`
2. **الإنتاج**: استخدم `https://tasks-intelligence.web.app/login`

## 🔧 تم تحسين الكود

### 1. تحسين Google Provider:
```typescript
// في src/lib/firebase.ts
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
```

### 2. تحسين معالجة الأخطاء:
- أضيف معالجة لخطأ `auth/unauthorized-domain`
- أضيف معالجة لخطأ `auth/popup-blocked`
- أضيف معالجة لخطأ `auth/network-request-failed`
- أضيف معالجة لخطأ `auth/operation-not-allowed`

## 🎯 النتيجة المتوقعة

بعد تطبيق هذه الخطوات:
- ✅ تسجيل الدخول عبر Google يعمل محلياً
- ✅ تسجيل الدخول عبر Google يعمل في الإنتاج
- ✅ رسائل خطأ واضحة ومفيدة
- ✅ تجربة مستخدم محسنة

## 📞 إذا استمرت المشكلة

شارك معي:
1. رسالة الخطأ الكاملة من Console
2. لقطة شاشة من إعدادات Firebase Authentication
3. لقطة شاشة من إعدادات Google Cloud OAuth

**المشكلة الأكثر شيوعاً**: عدم إضافة النطاقات في Google Cloud Console OAuth settings.
