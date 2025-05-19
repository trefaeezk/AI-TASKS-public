# دليل نشر التطبيق

## نشر الواجهة الأمامية فقط (Static Export)

هذا الدليل يشرح كيفية نشر الواجهة الأمامية فقط من تطبيق Next.js على Firebase Hosting.

### ملاحظات هامة

عند نشر التطبيق كنسخة ثابتة (Static Export)، ستفقد الوظائف التالية:

- الصفحات الديناميكية (Server-Side Rendering)
- وظائف API Routes
- أي محتوى يتم إنشاؤه ديناميكيًا على الخادم

### خطوات النشر

1. **بناء التطبيق**

```bash
# زيادة حد الذاكرة لتجنب أخطاء "JavaScript heap out of memory"
npm run build:static
```

2. **اختبار النسخة المحلية**

```bash
npm run serve:static
```

3. **نشر التطبيق على Firebase Hosting**

```bash
# تسجيل الدخول إلى Firebase (إذا لم تكن مسجل الدخول بالفعل)
firebase login

# نشر التطبيق
firebase deploy --only hosting
```

### حل مشكلة نفاد الذاكرة

إذا واجهت خطأ "JavaScript heap out of memory" أثناء البناء، يمكنك تجربة الحلول التالية:

1. **زيادة حد الذاكرة**

```bash
# استخدام هذا الأمر بدلاً من npm run build
node --max-old-space-size=8192 node_modules/.bin/next build
```

2. **تقليل حجم التطبيق**

- حذف الوحدات غير المستخدمة
- تقسيم الكود إلى أجزاء أصغر
- استخدام dynamic imports

## نشر التطبيق الكامل (مع الوظائف الديناميكية)

إذا كنت تريد الاحتفاظ بالوظائف الديناميكية، يمكنك استخدام Firebase Hosting مع Cloud Functions:

1. **تعديل ملف firebase.json**

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "function": "nextServer"
      }
    ]
  },
  "functions": {
    "source": ".",
    "runtime": "nodejs16"
  }
}
```

2. **إنشاء Cloud Function لتشغيل Next.js**

راجع الوثائق الرسمية لـ Next.js و Firebase للحصول على تفاصيل كاملة.

## بدائل أخرى للنشر

- **Vercel**: يدعم Next.js بشكل كامل بما في ذلك SSR و API Routes
- **Netlify**: يدعم Next.js بشكل كامل
- **Google Cloud Run**: يمكنك تشغيل Next.js كاملاً في حاويات Docker
