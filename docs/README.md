# 📚 دليل التوثيق الشامل - نظام إدارة المهام

## 🎯 نظرة عامة

مرحباً بك في التوثيق الشامل لنظام إدارة المهام. هذا النظام يوفر حلول متكاملة لإدارة المستخدمين والمؤسسات والمهام مع نظام صلاحيات متقدم.

---

## 📋 فهرس التوثيق

### 🔐 نظام المستخدمين والصلاحيات
- **[📚 توثيق نظام المستخدمين](./USER_SYSTEM_DOCUMENTATION.md)**
  - هيكلة الأدوار والصلاحيات
  - أنواع الحسابات (فردية ومؤسسية)
  - الصلاحيات التفصيلية لكل دور
  - هيكل قاعدة البيانات
  - أمثلة عملية

- **[🔐 دليل الصلاحيات والأمان](./USER_PERMISSIONS_GUIDE.md)**
  - نظام الصلاحيات المتقدم
  - التحقق من الصلاحيات (Frontend & Backend)
  - الصلاحيات المخصصة
  - أمان النظام وقواعد الحماية
  - أمثلة برمجية وأكواد جاهزة

### 🏢 إدارة المؤسسات
- **[🏢 دليل إدارة المؤسسات](./ORGANIZATION_MANAGEMENT.md)**
  - إنشاء وإدارة المؤسسات
  - إدارة الأعضاء والأدوار
  - الأقسام والهيكل التنظيمي
  - سير العمل والعمليات
  - أمثلة عملية لشركات مختلفة

### 🔌 التكامل والـ APIs
- **[🔌 مرجع API](./API_REFERENCE.md)**
  - جميع APIs المتاحة
  - المصادقة والتفويض
  - أمثلة التكامل بلغات مختلفة
  - معالجة الأخطاء
  - أكواد جاهزة للاستخدام

---

## 🚀 البدء السريع

### 1. **فهم النظام**
ابدأ بقراءة [توثيق نظام المستخدمين](./USER_SYSTEM_DOCUMENTATION.md) لفهم الهيكل العام والأدوار المختلفة.

### 2. **إعداد المؤسسة**
اتبع دليل [إدارة المؤسسات](./ORGANIZATION_MANAGEMENT.md) لإنشاء مؤسستك وتنظيم الفرق.

### 3. **التكامل التقني**
استخدم [مرجع API](./API_REFERENCE.md) لتطوير التطبيقات والتكامل مع النظام.

### 4. **إدارة الصلاحيات**
راجع [دليل الصلاحيات](./USER_PERMISSIONS_GUIDE.md) لضبط الأمان والتحكم في الوصول.

---

## 🎭 الأدوار والصلاحيات - ملخص سريع

### 🌐 أدوار النظام العامة
| الدور | الوصف | الاستخدام |
|-------|--------|-----------|
| `system_owner` | مالك النظام | إدارة النظام بالكامل |
| `system_admin` | أدمن النظام | إدارة المؤسسات والمستخدمين |
| `independent` | مستخدم مستقل | إدارة المهام الشخصية |

### 🏢 أدوار المؤسسات
| الدور | الوصف | الصلاحيات الرئيسية |
|-------|--------|-------------------|
| `organization_owner` | مالك المؤسسة | جميع الصلاحيات داخل المؤسسة |
| `org_admin` | أدمن المؤسسة | إدارة الأعضاء والمهام والتقارير |
| `org_supervisor` | مشرف | إدارة المهام والموافقة عليها |
| `org_engineer` | مهندس | إنشاء وتطوير المشاريع |
| `org_technician` | فني | تنفيذ المهام التقنية |
| `org_assistant` | مساعد فني | المساعدة في المهام البسيطة |

---

## 🔧 أمثلة سريعة

### 👤 إنشاء مستخدم جديد
```typescript
const userData = {
  email: "user@company.com",
  password: "securePassword",
  name: "أحمد محمد",
  role: "org_engineer",
  accountType: "organization",
  organizationId: "org_123"
};

const newUser = await createUser(userData);
```

### 🏢 إنشاء مؤسسة
```typescript
const orgData = {
  name: "شركة التقنية المتقدمة",
  description: "شركة متخصصة في تطوير البرمجيات",
  settings: {
    allowPublicJoin: false,
    requireApproval: true,
    maxMembers: 100
  }
};

const organization = await createOrganization(orgData);
```

### ✅ التحقق من الصلاحيات
```typescript
// Frontend
const { hasPermission } = usePermissions();
const canCreateTasks = hasPermission('tasks:create');

// Backend
const hasAccess = await hasPermission(userId, 'tasks:create');
```

---

## 🛠️ الإعداد والتطوير

### 📦 المتطلبات
- Node.js 18+
- Firebase Project
- TypeScript
- React 18+

### 🔧 التثبيت
```bash
# تثبيت المتطلبات
npm install

# إعداد Firebase
firebase init

# تشغيل المشروع
npm run dev
```

### 🌍 متغيرات البيئة
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## 🔍 استكشاف الأخطاء الشائعة

### ❌ مشاكل المصادقة
```typescript
// تحقق من صحة Token
const token = await user.getIdToken(true); // force refresh

// تحقق من Claims
const idTokenResult = await user.getIdTokenResult();
console.log('Claims:', idTokenResult.claims);
```

### 🔐 مشاكل الصلاحيات
```typescript
// تحقق من الصلاحيات الحالية
const permissions = await getUserPermissions(userId);
console.log('User permissions:', permissions);

// تحقق من الدور
const userRecord = await admin.auth().getUser(userId);
console.log('User role:', userRecord.customClaims?.role);
```

### 🏢 مشاكل المؤسسات
```typescript
// تحقق من عضوية المؤسسة
const member = await getOrganizationMember(orgId, userId);
console.log('Member data:', member);

// تحقق من وجود المؤسسة
const org = await getOrganization(orgId);
console.log('Organization:', org);
```

---

## 📊 مراقبة الأداء

### 📈 مؤشرات مهمة
- **عدد المستخدمين النشطين**
- **عدد المؤسسات المسجلة**
- **معدل استخدام الصلاحيات**
- **أوقات الاستجابة للـ APIs**

### 🔍 أدوات المراقبة
```typescript
// تسجيل العمليات المهمة
console.log('[AUDIT]', {
  action: 'user_created',
  userId: newUser.uid,
  createdBy: currentUser.uid,
  timestamp: new Date().toISOString()
});

// مراقبة الأداء
const startTime = Date.now();
await performOperation();
const duration = Date.now() - startTime;
console.log(`Operation took ${duration}ms`);
```

---

## 🤝 المساهمة والدعم

### 📝 إرشادات المساهمة
1. **اقرأ التوثيق** بعناية قبل البدء
2. **اتبع معايير الكود** المحددة في المشروع
3. **اكتب اختبارات** للميزات الجديدة
4. **حدث التوثيق** عند إضافة ميزات جديدة

### 🐛 الإبلاغ عن الأخطاء
- استخدم نموذج الإبلاغ المحدد
- قدم خطوات إعادة الإنتاج
- أرفق لقطات الشاشة إن أمكن
- حدد البيئة والإصدار

### 💬 الحصول على المساعدة
- راجع التوثيق أولاً
- ابحث في الأسئلة الشائعة
- تواصل مع فريق الدعم

---

## 📅 خارطة الطريق

### 🎯 الميزات القادمة
- [ ] نظام الإشعارات المتقدم
- [ ] تقارير تفصيلية وتحليلات
- [ ] تكامل مع أنظمة خارجية
- [ ] تطبيق الموبايل
- [ ] نظام المهام المتقدم

### 🔄 التحديثات الأخيرة
- ✅ نظام الأدوار الجديد (`org_*`)
- ✅ إزالة النظام القديم
- ✅ تحسين الأمان والصلاحيات
- ✅ توثيق شامل

---

## 📞 معلومات الاتصال

### 👥 فريق التطوير
- **المطور الرئيسي**: [اسم المطور]
- **مدير المشروع**: [اسم المدير]
- **فريق الدعم**: support@company.com

### 🌐 الروابط المهمة
- **الموقع الرسمي**: https://yourapp.com
- **مستودع الكود**: https://github.com/yourorg/yourapp
- **التوثيق التقني**: https://docs.yourapp.com
- **حالة النظام**: https://status.yourapp.com

---

## 📄 الترخيص

هذا المشروع مرخص تحت [نوع الترخيص]. راجع ملف `LICENSE` للمزيد من التفاصيل.

---

## 🙏 شكر وتقدير

نشكر جميع المساهمين والمطورين الذين ساعدوا في تطوير هذا النظام:
- فريق Firebase لتوفير البنية التحتية
- مجتمع React لأدوات التطوير
- جميع المختبرين والمستخدمين الأوائل

---

*آخر تحديث: ديسمبر 2024*

**نصيحة**: ابدأ بقراءة [توثيق نظام المستخدمين](./USER_SYSTEM_DOCUMENTATION.md) للحصول على فهم شامل للنظام! 🚀
