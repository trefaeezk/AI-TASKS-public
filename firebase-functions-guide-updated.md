# دليل نشر دوال Firebase المحدث

## مقدمة

هذا المشروع يحتوي على مجموعتين من دوال Firebase:
1. **دوال الأفراد (functions-individual)**: تستخدم مشروع Firebase للأفراد (dashboard-1f425)
2. **دوال المؤسسات (functions-organization)**: تستخدم مشروع Firebase للمؤسسات (tasks-intelligence)

تم تعديل أسماء المشاريع في ملفات package.json وملفات firebase.json لتجنب التعارض.

## هيكل المشروع المحدث

```
AI-TASKS-main/
├── functions-individual/     # مجلد مشروع الأفراد
│   ├── src/                  # ملفات المصدر TypeScript
│   ├── lib/                  # ملفات JavaScript المجمعة
│   ├── package.json          # تبعيات المشروع (name: "functions-individual")
│   ├── firebase.json         # تكوين Firebase للأفراد (source: ".")
│   └── .firebaserc           # تكوين مشروع Firebase للأفراد (dashboard-1f425)
│
└── functions-organization/   # مجلد مشروع المؤسسات
    ├── src/                  # ملفات المصدر TypeScript
    ├── lib/                  # ملفات JavaScript المجمعة
    ├── package.json          # تبعيات المشروع (name: "functions-organization")
    ├── firebase.json         # تكوين Firebase للمؤسسات (source: ".")
    └── .firebaserc           # تكوين مشروع Firebase للمؤسسات (tasks-intelligence)
```

## طريقة نشر دوال Firebase

### النشر من مجلدات المشاريع الفرعية

هذه الطريقة تستخدم ملفات firebase.json المنفصلة:

#### نشر دوال مشروع الأفراد (dashboard-1f425)

```bash
# الخطوة 1: الانتقال إلى مجلد مشروع الأفراد
cd functions-individual

# الخطوة 2: التأكد من استخدام مشروع الأفراد
firebase use individual
# أو
firebase use dashboard-1f425

# الخطوة 3: تثبيت التبعيات (إذا لم تكن مثبتة بالفعل)
npm install

# الخطوة 4: بناء المشروع
npm run build

# الخطوة 5: نشر دوال مشروع الأفراد
firebase deploy --only functions
# أو
npm run deploy
```

#### نشر دوال مشروع المؤسسات (tasks-intelligence)

```bash
# الخطوة 1: الانتقال إلى مجلد مشروع المؤسسات
cd functions-organization

# الخطوة 2: التأكد من استخدام مشروع المؤسسات
firebase use organization
# أو
firebase use tasks-intelligence

# الخطوة 3: تثبيت التبعيات (إذا لم تكن مثبتة بالفعل)
npm install

# الخطوة 4: بناء المشروع
npm run build

# الخطوة 5: نشر دوال مشروع المؤسسات
firebase deploy --only functions
# أو
npm run deploy
```

### ملاحظة هامة: تجنب النشر من المجلد الرئيسي

لا ينصح بنشر الدوال من المجلد الرئيسي لأن ذلك قد يؤدي إلى نشر دوال كلا المشروعين معًا إلى نفس مشروع Firebase، مما يسبب تعارضات وأخطاء.

**الطريقة الصحيحة والآمنة هي النشر من مجلد كل مشروع على حدة كما هو موضح أعلاه.**

## إنشاء alias لمشاريع Firebase

لتسهيل التبديل بين المشاريع، يمكنك إنشاء alias:

```bash
# إنشاء alias لمشروع الأفراد
cd functions-individual
firebase use --add
# اختر "dashboard-1f425" ثم اكتب "individual" كـ alias

# إنشاء alias لمشروع المؤسسات
cd functions-organization
firebase use --add
# اختر "tasks-intelligence" ثم اكتب "organization" كـ alias
```

## أوامر مفيدة أخرى

### مراقبة سجلات الدوال

```bash
# تأكد من أنك في المجلد الصحيح
firebase functions:log
# أو
npm run logs
```

### تشغيل محاكي Firebase محلياً

```bash
# تأكد من أنك في المجلد الصحيح
firebase emulators:start --only functions
# أو
npm run serve
```

### التحقق من المشروع الحالي

```bash
firebase use
```

## معلومات مشاريع Firebase

### مشروع الأفراد (Individual)
- **اسم المشروع**: dashboard
- **معرف المشروع**: dashboard-1f425
- **رقم المشروع**: 1047723506656
- **مفتاح API**: AIzaSyBLCO1G0eoIJ62kxydQ-GaiiVZYeuM7_Ac
- **معرف التطبيق**: 1:1047723506656:web:15b63247bc58b2ad820985

### مشروع المؤسسات (Organization)
- **اسم المشروع**: Tasks Intelligence
- **معرف المشروع**: tasks-intelligence
- **رقم المشروع**: 770714758504
- **مفتاح API**: AIzaSyBIJrQX5HBBnP7LKzgsUNdWCX7aqhVG3wA
- **معرف التطبيق**: 1:770714758504:web:aea98ba39a726df1ba3add

## حل مشاكل شائعة

### خطأ "functions directory was not found"

إذا ظهر خطأ:
```
Error: could not deploy functions because the "functions" directory was not found.
```

الحل:
1. تأكد من وجود ملف firebase.json في المجلد الذي تنفذ منه الأمر.
2. تأكد من أن ملف firebase.json يشير إلى المسار الصحيح للدوال:
   ```json
   {
     "functions": [
       {
         "source": ".",
         "codebase": "individual",
         "ignore": [
           "node_modules",
           ".git",
           "firebase-debug.log",
           "firebase-debug.*.log"
         ],
         "runtime": "nodejs18"
       }
     ]
   }
   ```

### خطأ "not authorized"

إذا ظهر خطأ يتعلق بعدم وجود صلاحيات:
1. تأكد من أنك مسجل الدخول:
   ```bash
   firebase login
   ```
2. تأكد من أنك تستخدم المشروع الصحيح:
   ```bash
   firebase use
   ```

## ملاحظات هامة

1. **تأكد دائماً من استخدام المشروع الصحيح**: استخدم الأمر `firebase use` للتحقق من المشروع الحالي.

2. **لا تخلط بين المشروعين**: كل مجموعة من الدوال يجب أن تستخدم مشروع Firebase الخاص بها.

3. **تجنب النشر المزدوج**: تأكد من تحديد المشروع الصحيح قبل النشر، ولا تنشر الدوال من المجلد الرئيسي أبدًا.

4. **تحديث الكود**: عند إجراء تغييرات على الكود، تأكد من إعادة بناء المشروع قبل النشر باستخدام `npm run build`.

5. **تحديث أدوات Firebase**: للحصول على أحدث الميزات، قم بتحديث أدوات Firebase:
   ```bash
   npm install -g firebase-tools
   ```
