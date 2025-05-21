# حالة الترجمة في المشروع

هذا الملف يوثق حالة الترجمة في المشروع، ويتضمن قائمة بالصفحات والمكونات التي تمت ترجمتها والتي لا تزال بحاجة إلى ترجمة.

## نظام الترجمة المستخدم

يستخدم المشروع نظام ترجمة مخصص يعتمد على:
- ملفات ترجمة في مجلد `src/locales` (ar.ts و en.ts)
- مكون `<Translate>` لعرض النصوص المترجمة
- سياق اللغة `LanguageContext` لإدارة اللغة الحالية

## الصفحات التي تمت ترجمتها

| المسار | الحالة | ملاحظات |
|--------|--------|---------|
| src/app/layout.tsx | ✅ | الصفحة الرئيسية |
| src/app/(app)/settings/page.tsx | ✅ | صفحة الإعدادات |
| src/app/(auth)/login/page.tsx | ✅ | صفحة تسجيل الدخول |
| src/app/(auth)/register/page.tsx | ✅ | صفحة التسجيل |
| src/app/(app)/tasks/page.tsx | ✅ | صفحة المهام |
| src/app/(app)/daily-plan/page.tsx | ✅ | صفحة الخطة اليومية |
| src/app/(app)/reports/page.tsx | ✅ | صفحة التقارير |
| src/components/layout/Sidebar.tsx | ✅ | الشريط الجانبي |
| src/components/layout/UserNav.tsx | ✅ | قائمة المستخدم |

## الصفحات التي تحتاج إلى ترجمة

| المسار | الأولوية | ملاحظات |
|--------|----------|---------|
| src/app/(admin)/admin/page.tsx | متوسطة | صفحة المسؤول (للمسؤولين فقط) |
| src/app/(organization)/org/page.tsx | عالية | صفحة المؤسسة الرئيسية |
| src/app/(organization)/org/members/page.tsx | عالية | صفحة إدارة الأعضاء |
| src/app/(organization)/org/departments/page.tsx | متوسطة | صفحة إدارة الأقسام |
| src/app/(organization)/org/okr/page.tsx | منخفضة | صفحة الأهداف والنتائج الرئيسية |
| src/app/(app)/ai-tools/page.tsx | متوسطة | صفحة أدوات الذكاء الاصطناعي |
| src/app/(app)/debug/page.tsx | منخفضة | صفحة التصحيح (للمالك فقط) |

## المكونات التي تمت ترجمتها

| المسار | الحالة | ملاحظات |
|--------|--------|---------|
| src/components/tasks/TaskCard.tsx | ✅ | بطاقة المهمة |
| src/components/tasks/TaskForm.tsx | ✅ | نموذج إنشاء/تعديل المهمة |
| src/components/settings/LanguageSettings.tsx | ✅ | إعدادات اللغة |
| src/components/settings/ThemeSettings.tsx | ✅ | إعدادات السمة |
| src/components/auth/LoginForm.tsx | ✅ | نموذج تسجيل الدخول |
| src/components/auth/RegisterForm.tsx | ✅ | نموذج التسجيل |

## المكونات التي تحتاج إلى ترجمة

| المسار | الأولوية | ملاحظات |
|--------|----------|---------|
| src/components/organizations/OrganizationForm.tsx | عالية | نموذج إنشاء/تعديل المؤسسة |
| src/components/organizations/MembersList.tsx | عالية | قائمة أعضاء المؤسسة |
| src/components/ai-tools/PromptLibrary.tsx | متوسطة | مكتبة البرومبتات |
| src/components/reports/WeeklyReport.tsx | متوسطة | التقرير الأسبوعي |
| src/components/debug/EmailTest.tsx | منخفضة | اختبار البريد الإلكتروني |

## ملاحظات عامة

- يجب استخدام مكون `<Translate>` لجميع النصوص الثابتة في الواجهة
- يجب إضافة جميع النصوص الجديدة إلى ملفات الترجمة قبل استخدامها
- يجب تحديث هذا الملف بعد ترجمة أي صفحة أو مكون جديد

## الخطوات القادمة

1. ترجمة صفحات نظام المؤسسات ذات الأولوية العالية
2. ترجمة المكونات المشتركة المتبقية
3. مراجعة وتحسين الترجمات الحالية
4. إضافة دعم للغات إضافية في المستقبل
