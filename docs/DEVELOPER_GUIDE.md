# دليل المطور

## نظرة عامة على الهيكل

يتكون نظام إدارة المهام من جزأين رئيسيين:

1. **الواجهة الأمامية (Frontend)**: تطبيق Next.js يستخدم React وTypeScript وTailwind CSS.
2. **الخلفية (Backend)**: خدمات Firebase (Authentication, Firestore, Cloud Functions, Hosting).

## هيكل المشروع

```
AI-TASKS/
├── docs/                    # وثائق المشروع
├── functions/               # وظائف Firebase Cloud Functions
│   ├── src/                 # كود المصدر لوظائف Firebase
│   │   ├── auth.ts          # وظائف المصادقة
│   │   ├── index.ts         # نقطة الدخول الرئيسية
│   │   ├── individual/      # وظائف خاصة بالمستخدمين الفرديين
│   │   ├── organization/    # وظائف خاصة بالمؤسسات
│   │   ├── roles.ts         # وظائف إدارة الأدوار
│   │   ├── shared/          # وظائف مشتركة
│   │   └── system.ts        # وظائف إعدادات النظام
│   ├── package.json         # تبعيات وظائف Firebase
│   └── tsconfig.json        # إعدادات TypeScript لوظائف Firebase
├── public/                  # ملفات عامة
├── src/                     # كود المصدر للتطبيق
│   ├── app/                 # مكونات الصفحات (Next.js App Router)
│   │   ├── (admin)/         # صفحات لوحة التحكم الإدارية
│   │   ├── (app)/           # صفحات التطبيق الرئيسية
│   │   ├── (auth)/          # صفحات المصادقة
│   │   └── api/             # واجهات برمجة التطبيق (API)
│   ├── components/          # مكونات React المشتركة
│   │   ├── auth/            # مكونات المصادقة
│   │   ├── layout/          # مكونات التخطيط
│   │   ├── organizations/   # مكونات المؤسسات
│   │   ├── settings/        # مكونات الإعدادات
│   │   ├── tasks/           # مكونات المهام
│   │   └── ui/              # مكونات واجهة المستخدم العامة
│   ├── context/             # سياقات React
│   ├── hooks/               # خطافات React المخصصة
│   ├── lib/                 # مكتبات ووظائف مساعدة
│   │   ├── firebase.ts      # تكوين Firebase
│   │   └── utils.ts         # وظائف مساعدة
│   ├── styles/              # أنماط CSS
│   └── types/               # تعريفات TypeScript
├── .env.local               # متغيرات البيئة المحلية
├── .firebaserc              # إعدادات مشروع Firebase
├── firebase.json            # تكوين Firebase
├── next.config.js           # إعدادات Next.js
├── package.json             # تبعيات المشروع
├── tailwind.config.js       # إعدادات Tailwind CSS
└── tsconfig.json            # إعدادات TypeScript
```

## مشاريع Firebase

يستخدم النظام مشروعين منفصلين من Firebase:

1. **مشروع الأفراد**: `dashboard-1f425`
   - معرف المشروع: `dashboard-1f425`
   - رقم المشروع: `1047723506656`
   - مفتاح API: `AIzaSyBLCO1G0eoIJ62kxydQ-GaiiVZYeuY7_Ac`
   - معرف التطبيق: `1:1047723506656:web:15b63247bc58b2ad820985`

2. **مشروع المؤسسات**: `Tasks Intelligence`
   - معرف المشروع: `tasks-intelligence`
   - رقم المشروع: `770714758504`
   - مفتاح API: `AIzaSyBIJrQX5HBBnP7LKzgsUNdWCX7aqhVG3wA`
   - معرف التطبيق: `1:770714758504:web:aea98ba39a726df1ba3add`

## إعداد بيئة التطوير

### المتطلبات الأساسية

- Node.js (الإصدار 18 أو أحدث)
- npm أو yarn
- حساب Firebase
- Firebase CLI

### خطوات الإعداد

1. استنساخ المستودع:
   ```
   git clone https://github.com/trefaeezk/AI-TASKS.git
   cd AI-TASKS
   ```

2. تثبيت التبعيات:
   ```
   npm install
   cd functions
   npm install
   cd ..
   ```

3. إعداد ملف `.env.local`:
   ```
   # مشروع الأفراد
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBLCO1G0eoIJ62kxydQ-GaiiVZYeuY7_Ac
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dashboard-1f425.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=dashboard-1f425
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=dashboard-1f425.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1047723506656
   NEXT_PUBLIC_FIREBASE_APP_ID=1:1047723506656:web:15b63247bc58b2ad820985

   # مشروع المؤسسات
   NEXT_PUBLIC_ORG_FIREBASE_API_KEY=AIzaSyBIJrQX5HBBnP7LKzgsUNdWCX7aqhVG3wA
   NEXT_PUBLIC_ORG_FIREBASE_AUTH_DOMAIN=tasks-intelligence.firebaseapp.com
   NEXT_PUBLIC_ORG_FIREBASE_PROJECT_ID=tasks-intelligence
   NEXT_PUBLIC_ORG_FIREBASE_STORAGE_BUCKET=tasks-intelligence.appspot.com
   NEXT_PUBLIC_ORG_FIREBASE_MESSAGING_SENDER_ID=770714758504
   NEXT_PUBLIC_ORG_FIREBASE_APP_ID=1:770714758504:web:aea98ba39a726df1ba3add
   ```

4. تسجيل الدخول إلى Firebase:
   ```
   firebase login
   ```

5. اختيار مشروع Firebase:
   ```
   firebase use dashboard-1f425
   ```

6. تشغيل التطبيق محليًا:
   ```
   npm run dev
   ```

## تطوير وظائف Firebase Cloud Functions

### هيكل وظائف Firebase

وظائف Firebase منظمة في مجلدات حسب الوظيفة:

- `auth.ts`: وظائف المصادقة وإدارة المستخدمين.
- `individual/`: وظائف خاصة بالمستخدمين الفرديين.
- `organization/`: وظائف خاصة بالمؤسسات.
- `roles.ts`: وظائف إدارة الأدوار والصلاحيات.
- `shared/`: وظائف ووظائف مساعدة مشتركة.
- `system.ts`: وظائف إعدادات النظام.

### تطوير وظائف جديدة

1. أضف الوظيفة الجديدة في الملف المناسب:

   ```typescript
   export const myNewFunction = functions.region("us-central1").https.onCall(async (data, context) => {
       const functionName = 'myNewFunction';
       console.log(`--- ${functionName} Cloud Function triggered ---`);

       try {
           // التحقق من المصادقة
           if (!context.auth) {
               throw new functions.https.HttpsError(
                   'unauthenticated',
                   'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
               );
           }

           // منطق الوظيفة
           // ...

           return { success: true };
       } catch (error: any) {
           console.error(`Error in ${functionName}:`, error);
           if (error instanceof functions.https.HttpsError) {
               throw error;
           }
           throw new functions.https.HttpsError(
               'internal',
               `Failed: ${error.message || 'Unknown error'}`
           );
       }
   });
   ```

2. صدّر الوظيفة في `index.ts`:

   ```typescript
   export * from './myModule';
   ```

3. اختبار الوظيفة محليًا:

   ```
   cd functions
   npm run build
   firebase emulators:start
   ```

4. نشر الوظائف:

   ```
   firebase deploy --only functions
   ```

## نظام إدارة المؤسسات

### هيكل البيانات

#### مجموعات Firestore

- `organizations`: معلومات المؤسسات
  - `{organizationId}/members`: أعضاء المؤسسة
  - `{organizationId}/departments`: أقسام المؤسسة
  - `{organizationId}/projects`: مشاريع المؤسسة
  - `{organizationId}/tasks`: مهام المؤسسة

- `organizationRequests`: طلبات إنشاء المؤسسات
- `organizationInvitations`: دعوات الانضمام للمؤسسات

### وظائف إدارة المؤسسات

- `requestOrganization`: إرسال طلب لإنشاء مؤسسة جديدة.
- `approveOrganizationRequest`: الموافقة على طلب إنشاء مؤسسة.
- `rejectOrganizationRequest`: رفض طلب إنشاء مؤسسة.
- `inviteUserToOrganization`: دعوة مستخدم للانضمام إلى مؤسسة.
- `acceptOrganizationInvitation`: قبول دعوة للانضمام إلى مؤسسة.
- `rejectOrganizationInvitation`: رفض دعوة للانضمام إلى مؤسسة.

### التحقق من صلاحيات المؤسسة

تم تنفيذ دوال للتحقق من صلاحيات المستخدم في المؤسسة:

- `canInviteToOrganization`: التحقق مما إذا كان المستخدم يملك صلاحيات دعوة أعضاء جدد.
- `hasOrganizationRole`: التحقق مما إذا كان المستخدم يملك دورًا معينًا أو أعلى.
- `ensureCanInviteToOrganization`: التحقق من صلاحيات دعوة الأعضاء في وظائف Firebase.

## نصائح للتطوير

1. **استخدام TypeScript**: تأكد من تعريف الأنواع بشكل صحيح لتحسين جودة الكود.
2. **التعامل مع الأخطاء**: قم دائمًا بتضمين بلوكات try/catch في وظائف Firebase.
3. **التسجيل**: استخدم `console.log` و `console.error` لتسجيل المعلومات المهمة.
4. **الأمان**: تحقق دائمًا من مصادقة المستخدم وصلاحياته قبل تنفيذ العمليات.
5. **التحقق من المدخلات**: تحقق دائمًا من صحة المدخلات قبل استخدامها.

## الموارد

- [وثائق Next.js](https://nextjs.org/docs)
- [وثائق Firebase](https://firebase.google.com/docs)
- [وثائق React](https://reactjs.org/docs)
- [وثائق TypeScript](https://www.typescriptlang.org/docs)
- [وثائق Tailwind CSS](https://tailwindcss.com/docs)
