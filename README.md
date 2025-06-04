
# نظام إدارة المهام الذكي (Tasks Intelligence)

## 🎯 وصف المشروع

نظام إدارة مهام متقدم يهدف إلى مساعدة المستخدمين الأفراد والمؤسسات على تنظيم وأتمتة مهامهم اليومية بفعالية، مع الاستفادة من قدرات الذكاء الاصطناعي لتقديم اقتراحات ذكية، وتخطيط يومي وأسبوعي، وإدارة الاجتماعات.

## 🚀 التقنيات المستخدمة

*   **Next.js**: إطار عمل React للواجهة الأمامية مع دعم Server-Side Rendering و Static Site Generation.
*   **React**: مكتبة JavaScript لبناء واجهات المستخدم.
*   **TypeScript**: لغة برمجة تضيف أنواعًا ثابتة إلى JavaScript لتحسين جودة الكود وقابليته للصيانة.
*   **Tailwind CSS**: إطار عمل CSS لإنشاء واجهات مستخدم حديثة وسريعة الاستجابة.
*   **ShadCN UI**: مجموعة من مكونات واجهة المستخدم الجميلة والقابلة للتخصيص مبنية على Tailwind CSS و Radix UI.
*   **Firebase**: منصة تطوير تطبيقات شاملة تشمل:
    *   **Firebase Authentication**: لإدارة مصادقة المستخدمين.
    *   **Firestore**: قاعدة بيانات NoSQL لتخزين بيانات التطبيق.
    *   **Firebase Functions**: لتنفيذ منطق الخادم (backend logic) بدون الحاجة لإدارة خوادم.
    *   **Firebase Hosting**: لاستضافة تطبيق الويب.
*   **Lucide React**: مكتبة أيقونات خفيفة وجميلة.
*   **Zod**: مكتبة للتحقق من صحة البيانات (Data validation).
*   **React Hook Form**: لإدارة نماذج الإدخال والتحقق من صحتها.
*   **date-fns**: مكتبة لمعالجة التواريخ.
*   **i18next & react-i18next**: لدعم تعدد اللغات (العربية والإنجليزية).
*   **Genkit/Google Generative AI (في Firebase Functions)**: لتنفيذ وظائف الذكاء الاصطناعي.

## 📁 هيكل المجلدات الرئيسي

```
.
├── functions/                  # كود Firebase Functions (الخادم)
│   ├── src/
│   │   ├── ai/                 # وظائف الذكاء الاصطناعي (تخطيط، اقتراحات، الخ)
│   │   ├── auth/               # وظائف المصادقة وتحديث التوكن
│   │   ├── email/              # وظائف إرسال البريد الإلكتروني (Resend, SMTP, SendGrid)
│   │   ├── individual/         # وظائف خاصة بالمستخدمين الأفراد
│   │   ├── organization/       # وظائف خاصة بالمؤسسات (إدارة، أعضاء، أقسام، OKRs)
│   │   ├── shared/             # أدوات ووظائف مساعدة مشتركة
│   │   └── index.ts            # نقطة الدخول الرئيسية لوظائف Firebase
│   └── package.json            # تبعيات Firebase Functions
├── public/                     # الملفات الثابتة (صور، خطوط، الخ)
├── src/
│   ├── app/                    # مجلد Next.js App Router
│   │   ├── (admin)/            # مسارات وصفحات لوحة تحكم المسؤول
│   │   ├── (app)/              # مسارات وصفحات التطبيق الرئيسية للمستخدم المسجل
│   │   ├── (auth)/             # مسارات وصفحات المصادقة (تسجيل دخول، إنشاء حساب)
│   │   ├── (organization)/     # مسارات وصفحات المؤسسة
│   │   ├── api/                # مسارات API (إذا وجدت)
│   │   ├── layout.tsx          # التخطيط الرئيسي للتطبيق
│   │   └── globals.css         # أنماط CSS العامة وتهيئة Tailwind
│   ├── components/             # مكونات React المستخدمة في التطبيق
│   │   ├── admin/              # مكونات خاصة بلوحة تحكم المسؤول
│   │   ├── auth/               # مكونات خاصة بالمصادقة
│   │   ├── data/               # مكونات خاصة بإدارة البيانات
│   │   ├── debug/              # مكونات خاصة بالتشخيص
│   │   ├── documentation/      # مكونات خاصة بصفحة الوثائق
│   │   ├── meetings/           # مكونات خاصة بالاجتماعات
│   │   ├── notifications/      # مكونات خاصة بالإشعارات
│   │   ├── okr/                # مكونات خاصة بنظام OKR
│   │   ├── organization/       # مكونات خاصة بالمؤسسات
│   │   ├── settings/           # مكونات خاصة بالإعدادات
│   │   └── ui/                 # مكونات ShadCN UI الأساسية
│   ├── config/                 # ملفات التكوين (Firebase, Firebase Admin)
│   ├── context/                # سياقات React (Auth, Language, Theme, TaskPage)
│   ├── hooks/                  # خطافات React مخصصة (useAuth, usePermissions, الخ)
│   ├── lib/                    # مكتبات وأدوات مساعدة (Firebase, utils)
│   ├── locales/                # ملفات الترجمة (ar, en)
│   ├── services/               # خدمات للتفاعل مع الواجهة الخلفية (AI, meetings, notifications, okr, subtasks)
│   └── types/                  # تعريفات TypeScript (task, user, roles, system, notification, meeting, okr)
├── firebase.json               # تكوين مشروع Firebase (Hosting, Functions, Emulators)
├── firestore.rules             # قواعد أمان Firestore
├── firestore.indexes.json      # فهارس Firestore
├── next.config.js              # تكوين Next.js
├── package.json                # تبعيات المشروع والسكريبتات
├── README.md                   # هذا الملف (التوثيق)
└── tsconfig.json               # تكوين TypeScript
```

## 🚀 كيفية البدء

### المتطلبات الأساسية (Prerequisites)

*   Node.js (الإصدار 20 أو أحدث موصى به)
*   npm أو yarn أو pnpm
*   Firebase CLI (لتشغيل المحاكيات ونشر المشروع)
*   حساب Firebase مع مشروع تم إنشاؤه.

### التثبيت (Installation)

1.  **استنسخ المستودع (Clone the repository):**
    ```bash
    git clone <repository_url>
    cd <project_folder>
    ```
2.  **ثبت تبعيات الواجهة الأمامية:**
    ```bash
    npm install
    # أو
    yarn install
    # أو
    pnpm install
    ```
3.  **ثبت تبعيات Firebase Functions:**
    ```bash
    cd functions
    npm install
    # أو
    yarn install
    # أو
    pnpm install
    cd ..
    ```
4.  **إعداد Firebase:**
    *   تأكد من تسجيل الدخول إلى Firebase CLI: `firebase login`
    *   اربط مشروعك المحلي بمشروع Firebase الخاص بك: `firebase use --add` واختر مشروعك.
    *   **تكوين متغيرات البيئة:**
        *   في ملف `firebaseConfig.js` (في جذر المشروع)، تأكد من أن قيم تكوين Firebase صحيحة وتطابق مشروعك.
        *   في ملف `.env` (في جذر المشروع) وملف `functions/.env`، قد تحتاج إلى إضافة متغيرات بيئة خاصة مثل مفاتيح API للخدمات الخارجية (مثل Resend أو Google Generative AI). مثال:
            ```
            # في .env (لـ Next.js)
            NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
            # ... باقي متغيرات Firebase العامة

            # في functions/.env (لوظائف Firebase)
            GOOGLE_GENAI_API_KEY=AIza...
            RESEND_API_KEY=re_...
            SMTP_USER=your_email@example.com
            SMTP_PASS=your_app_password
            ```
        *   **مهم:** تأكد من أن متغيرات البيئة للوظائف (مثل `GOOGLE_GENAI_API_KEY` و `RESEND_API_KEY`) تم تعيينها أيضًا في بيئة Firebase Functions عند النشر باستخدام:
            ```bash
            firebase functions:config:set google.genai_api_key="YOUR_ACTUAL_KEY" resend.apikey="YOUR_RESEND_KEY" # وهكذا
            ```

### تشغيل التطبيق (Running the App)

1.  **تشغيل محاكيات Firebase (اختياري ولكن موصى به للتطوير):**
    ```bash
    firebase emulators:start --only auth,firestore,functions
    ```
    *   يمكنك الوصول إلى واجهة مستخدم المحاكيات على `http://localhost:4000`.

2.  **تشغيل تطبيق Next.js (الواجهة الأمامية):**
    ```bash
    npm run dev
    # أو
    yarn dev
    # أو
    pnpm dev
    ```
    *   عادة ما يعمل التطبيق على العنوان المحدد في متغير البيئة `NEXT_PUBLIC_APP_BASE_URL` (افتراضياً `http://192.168.1.104:9003`).

### بناء ونشر التطبيق (Building and Deploying)

1.  **بناء وظائف Firebase:**
    ```bash
    cd functions
    npm run build
    cd ..
    ```
2.  **بناء تطبيق Next.js:**
    ```bash
    npm run build
    # أو
    yarn build
    # أو
    pnpm build
    ```
3.  **نشر المشروع بالكامل إلى Firebase:**
    ```bash
    firebase deploy
    ```
    *   لنشر أجزاء معينة فقط:
        *   `firebase deploy --only hosting` (لـ Next.js app)
        *   `firebase deploy --only functions`
        *   `firebase deploy --only firestore:rules`
        *   `firebase deploy --only firestore:indexes`

## ✨ الميزات الرئيسية

*   **إدارة المهام الشاملة:** إنشاء، تعديل، حذف، وتتبع حالة المهام.
*   **تنظيم المهام:** فئات، أولويات، تواريخ استحقاق، مهام فرعية (نقاط تتبع).
*   **دعم المستخدمين الأفراد والمؤسسات:** نظام مرن يناسب احتياجات مختلفة.
*   **إدارة المؤسسات:** إنشاء مؤسسات، إضافة أعضاء، تحديد أدوار، إنشاء أقسام.
*   **نظام التخطيط السنوي (OKRs):** تحديد الأهداف والنتائج الرئيسية وتتبع التقدم.
*   **إدارة الاجتماعات:** إنشاء اجتماعات، توليد جداول أعمال يومية بالذكاء الاصطناعي.
*   **اقتراحات ذكية:** الحصول على اقتراحات لتحسين الإنتاجية وإدارة الوقت.
*   **تقارير وتحليلات:** عرض تقارير يومية وأسبوعية ومؤشرات أداء.
*   **إشعارات:** نظام إشعارات لتنبيه المستخدمين بالأحداث الهامة.
*   **تعدد اللغات:** دعم اللغتين العربية والإنجليزية.
*   **تخصيص المظهر:** دعم الوضع الفاتح والداكن.
*   **مصادقة آمنة:** باستخدام Firebase Authentication مع دعم تسجيل الدخول عبر جوجل.
*   **إدارة الصلاحيات:** نظام أدوار وصلاحيات مرن.
*   **أدوات تشخيص:** للمسؤولين لتشخيص وحل المشاكل.
*   **إدارة البيانات:** تصدير واستيراد بيانات المستخدمين والمؤسسات.

## 🔑 نظام المصادقة والأدوار

يستخدم التطبيق Firebase Authentication للمصادقة. يتم تحديد الأدوار والصلاحيات بناءً على Custom Claims في Firebase Auth وبيانات المستخدم المخزنة في Firestore.

**الأدوار الرئيسية (النمط الجديد `is*`):**

*   **`isSystemOwner`**: مالك النظام (أعلى صلاحية).
*   **`isSystemAdmin`**: مسؤول النظام العام.
*   **`isIndependent`**: مستخدم فردي (لا ينتمي لمؤسسة).
*   **`isOrgOwner`**: مالك المؤسسة (صلاحيات كاملة داخل مؤسسته).
*   **`isOrgAdmin`**: مسؤول المؤسسة.
*   **`isOrgSupervisor`**: مشرف في المؤسسة.
*   **`isOrgEngineer`**: مهندس في المؤسسة.
*   **`isOrgTechnician`**: فني في المؤسسة.
*   **`isOrgAssistant`**: مساعد في المؤسسة.

يتم تحديد نوع الحساب (`individual` أو `organization`) تلقائيًا عند تسجيل الدخول أو تحديث بيانات المستخدم.

## ☁️ وظائف Firebase Functions

يتم استخدام Firebase Functions لتنفيذ منطق الخادم، وتشمل:

*   **إدارة المستخدمين:** إنشاء مستخدمين، تحديث أدوارهم وصلاحياتهم، تفعيل/تعطيل الحسابات.
*   **إدارة المؤسسات:** إنشاء مؤسسات، إدارة الأعضاء والأقسام، معالجة طلبات الإنشاء والدعوات.
*   **وظائف الذكاء الاصطناعي:**
    *   اقتراح نقاط تتبع للمهام.
    *   اقتراح أوزان لنقاط التتبع.
    *   اقتراح تواريخ استحقاق لنقاط التتبع.
    *   اقتراح تاريخ استحقاق ذكي للمهمة.
    *   إنشاء خطة يومية للمهام.
    *   إنشاء تقرير أسبوعي للمهام.
    *   إنشاء اقتراحات ذكية عامة للمستخدم.
    *   إنشاء جدول أعمال اجتماع يومي.
*   **إرسال البريد الإلكتروني:** لإرسال رموز التحقق، دعوات، إشعارات.
*   **إدارة نظام OKR:** إنشاء وتحديث الأهداف والنتائج الرئيسية وربطها بالمهام.
*   **إدارة الاجتماعات:** إنشاء وتحديث الاجتماعات وجداول الأعمال.
*   **وظائف مساعدة:** للتحقق من الصلاحيات، تحديث الـ Custom Claims، إلخ.

## 🤝 المساهمة (Contribution)

إذا كان هذا المشروع مفتوح المصدر، يمكنك إضافة إرشادات للمساهمة هنا.

## 📜 الترخيص (License)

حدد نوع الترخيص الذي يتبعه مشروعك (مثلاً، MIT, Apache 2.0, إلخ). إذا لم يكن هناك ترخيص، اذكر ذلك.

---

*هذا التوثيق تم إنشاؤه بناءً على الملفات المتاحة في المشروع.*
