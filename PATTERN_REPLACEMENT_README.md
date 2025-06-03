# 🔄 سكريبت استبدال الأنماط القديمة بالجديدة

هذه مجموعة من السكريبتات لاستبدال النمط القديم (`system_owner`, `org_owner`, إلخ) بالنمط الجديد (`isSystemOwner`, `isOrgOwner`, إلخ) في جميع ملفات المشروع.

## 📁 الملفات المتوفرة

### 1. `check_patterns.py`
- **الوظيفة**: فحص المشروع للبحث عن الأنماط القديمة
- **الهدف**: معرفة ما يحتاج للتغيير قبل التطبيق
- **المخرجات**: تقرير مفصل بالملفات والأسطر التي تحتوي على أنماط قديمة

### 2. `replace_old_patterns.py`
- **الوظيفة**: استبدال جميع الأنماط القديمة بالجديدة
- **الهدف**: تطبيق التغييرات فعلياً على الملفات
- **المخرجات**: ملخص بعدد الملفات المعدلة والتغييرات المطبقة

### 3. `run_replacement.bat`
- **الوظيفة**: تشغيل العملية كاملة بخطوات تفاعلية
- **الهدف**: سهولة الاستخدام على Windows
- **المميزات**: فحص أولاً ثم طلب تأكيد قبل التطبيق

## 🚀 طريقة الاستخدام

### الطريقة السريعة (Windows):
```bash
# تشغيل السكريبت التفاعلي
run_replacement.bat
```

### الطريقة اليدوية:

#### 1. فحص الأنماط القديمة أولاً:
```bash
python check_patterns.py
```

#### 2. مراجعة التقرير المُنشأ:
- سيتم إنشاء ملف `old_patterns_report.txt` يحتوي على تفاصيل جميع الأنماط القديمة

#### 3. تطبيق الاستبدال:
```bash
python replace_old_patterns.py
```

## 📋 الأنماط المدعومة للاستبدال

### الأدوار الأساسية:
| النمط القديم | النمط الجديد |
|-------------|-------------|
| `system_owner: true` | `isSystemOwner: true` |
| `system_admin: true` | `isSystemAdmin: true` |
| `org_owner: true` | `isOrgOwner: true` |
| `org_admin: true` | `isOrgAdmin: true` |
| `org_supervisor: true` | `isOrgSupervisor: true` |
| `org_engineer: true` | `isOrgEngineer: true` |
| `org_technician: true` | `isOrgTechnician: true` |
| `org_assistant: true` | `isOrgAssistant: true` |
| `independent: true` | `isIndependent: true` |

### الأدوار الديناميكية:
| النمط القديم | النمط الجديد |
|-------------|-------------|
| `system_owner: role === 'system_owner'` | `isSystemOwner: role === 'system_owner'` |
| `org_owner: role === 'org_owner'` | `isOrgOwner: role === 'org_owner'` |

### الوصول للخصائص:
| النمط القديم | النمط الجديد |
|-------------|-------------|
| `.system_owner` | `.isSystemOwner` |
| `.org_owner` | `.isOrgOwner` |
| `userClaims?.system_owner` | `userClaims?.isSystemOwner` |
| `userData.system_owner` | `userData.isSystemOwner` |

## 📂 أنواع الملفات المدعومة

- `.ts` - TypeScript
- `.tsx` - TypeScript React
- `.js` - JavaScript  
- `.jsx` - JavaScript React
- `.py` - Python

## 🚫 المجلدات المستثناة

- `node_modules`
- `.git`
- `dist`
- `build`
- `__pycache__`
- `.next`
- `coverage`
- `.vscode`
- `.idea`

## ⚠️ تحذيرات مهمة

### قبل التشغيل:
1. **عمل backup للمشروع** - السكريبت يعدل الملفات مباشرة
2. **إغلاق جميع المحررات** - لتجنب تضارب الملفات
3. **التأكد من عدم وجود تغييرات غير محفوظة** في Git

### بعد التشغيل:
1. **اختبار التطبيق** للتأكد من عمل جميع التغييرات
2. **مراجعة التغييرات** في Git قبل الـ commit
3. **تشغيل الاختبارات** إن وجدت

## 🔧 استكشاف الأخطاء

### إذا فشل السكريبت:
```bash
# تحقق من وجود Python
python --version

# تحقق من الصلاحيات
# تأكد من أن الملفات غير محمية ضد الكتابة
```

### إذا لم يجد أنماط:
- تأكد من أن المشروع يحتوي فعلاً على أنماط قديمة
- تحقق من أن الملفات في المجلدات الصحيحة

## 📊 مثال على المخرجات

```
🔄 بدء عملية استبدال النمط القديم بالجديد...
============================================================
📁 مسار المشروع: C:\Users\Taha\Desktop\Admin\AI-tasks-1
✅ تم تعديل: functions/src/index.ts (15 تغيير)
✅ تم تعديل: functions/src/roles.ts (8 تغيير)
✅ تم تعديل: src/context/AuthContext.tsx (12 تغيير)
============================================================
📊 ملخص العملية:
   📁 إجمالي الملفات المعالجة: 127
   ✏️  الملفات المعدلة: 3
   🔄 إجمالي التغييرات: 35

🎉 تم الانتهاء من عملية الاستبدال بنجاح!
💡 تأكد من اختبار التطبيق للتأكد من عمل جميع التغييرات بشكل صحيح.
```

## 🎯 الخطوات التالية بعد الاستبدال

1. **نشر Firebase Functions**:
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```

2. **نشر قواعد Firestore**:
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **اختبار التطبيق**:
   - تسجيل الدخول
   - التحقق من الصلاحيات
   - اختبار جميع الوظائف

---

**ملاحظة**: هذا السكريبت مصمم خصيصاً لهذا المشروع ونمط الأدوار المستخدم فيه.
