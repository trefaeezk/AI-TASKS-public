# تحديث قواعد Firestore لدعم الصلاحيات المرنة

## المشكلة الأصلية ❌

القواعد السابقة كانت **مقيدة جداً** وتعتمد فقط على الأدوار الثابتة:
- فقط `admin`, `supervisor`, `engineer` يمكنهم إنشاء/تعديل المهام
- لا تدعم الصلاحيات المخصصة التي يحددها الأدمن
- تتجاهل نظام `permissions` المرن في التطبيق

## الحل الجديد ✅

### 1. **قواعد المهام المرنة** 🔧

#### **قبل التحديث**:
```javascript
// مقيد - فقط أدوار محددة
allow create, update: if request.auth != null &&
  (get(...).data.role == 'admin' ||
   get(...).data.role == 'supervisor' ||
   get(...).data.role == 'engineer');
```

#### **بعد التحديث**:
```javascript
// مرن - يدعم الصلاحيات المخصصة + الأدوار + منشئ المهمة
allow create: if request.auth != null &&
  exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
  (get(...).data.permissions.canCreateTasks == true ||
   get(...).data.role in ['admin', 'supervisor', 'engineer']);

allow update: if request.auth != null &&
  exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
  (get(...).data.permissions.canEditTasks == true ||
   get(...).data.role in ['admin', 'supervisor', 'engineer'] ||
   resource.data.createdBy == request.auth.uid);

allow delete: if request.auth != null &&
  exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
  (get(...).data.permissions.canDeleteTasks == true ||
   get(...).data.role == 'admin' ||
   resource.data.createdBy == request.auth.uid);
```

### 2. **قواعد التقارير المرنة** 📊

#### **الميزات الجديدة**:
- دعم `canViewReports`, `canCreateReports`, `canEditReports`, `canDeleteReports`
- منشئ التقرير يمكنه تعديله/حذفه
- الأدوار التقليدية لا تزال مدعومة

### 3. **قواعد المهام الفردية** 👤

#### **إضافة جديدة**:
```javascript
// قواعد للمهام الفردية (خارج المؤسسات)
match /tasks/{taskId} {
  // يمكن للمستخدم قراءة مهامه الخاصة أو المهام المشتركة معه
  allow read: if request.auth != null &&
               (resource.data.userId == request.auth.uid ||
                resource.data.assignedTo == request.auth.uid ||
                resource.data.sharedWith != null && request.auth.uid in resource.data.sharedWith);

  // يمكن للمستخدم إنشاء مهام جديدة
  allow create: if request.auth != null &&
                 request.resource.data.userId == request.auth.uid;

  // يمكن للمستخدم تعديل مهامه الخاصة أو المهام المسندة إليه
  allow update: if request.auth != null &&
                 (resource.data.userId == request.auth.uid ||
                  resource.data.assignedTo == request.auth.uid);

  // يمكن للمستخدم حذف مهامه الخاصة فقط
  allow delete: if request.auth != null &&
                 resource.data.userId == request.auth.uid;
}
```

## الصلاحيات المدعومة الآن 🎯

### **للمهام**:
- ✅ `canViewTasks` - عرض المهام
- ✅ `canCreateTasks` - إنشاء مهام جديدة
- ✅ `canEditTasks` - تعديل المهام
- ✅ `canDeleteTasks` - حذف المهام

### **للتقارير**:
- ✅ `canViewReports` - عرض التقارير
- ✅ `canCreateReports` - إنشاء تقارير جديدة
- ✅ `canEditReports` - تعديل التقارير
- ✅ `canDeleteReports` - حذف التقارير

### **الأدوار التقليدية** (لا تزال مدعومة):
- ✅ `admin` - صلاحيات كاملة
- ✅ `supervisor` - صلاحيات إشرافية
- ✅ `engineer` - صلاحيات هندسية
- ✅ `technician` - صلاحيات فنية
- ✅ `assistant` - صلاحيات مساعد

## منطق الصلاحيات الجديد 🧠

### **أولوية الصلاحيات**:
1. **الصلاحيات المخصصة** (`permissions.canXXX`) - أعلى أولوية
2. **الأدوار التقليدية** (`role`) - أولوية متوسطة
3. **ملكية المحتوى** (`createdBy`) - للمحتوى الشخصي

### **مثال عملي**:
```javascript
// مستخدم بدور "assistant" لكن لديه صلاحية مخصصة
{
  "role": "assistant",           // دور عادي لا يسمح بإنشاء مهام
  "permissions": {
    "canCreateTasks": true,      // صلاحية مخصصة تسمح بإنشاء مهام
    "canEditTasks": false,       // لا يمكن تعديل مهام الآخرين
    "canDeleteTasks": false      // لا يمكن حذف مهام الآخرين
  }
}

// النتيجة: يمكنه إنشاء مهام لكن لا يمكنه تعديل/حذف مهام الآخرين
```

## الفوائد الجديدة 🚀

### ✅ **مرونة كاملة**:
- الأدمن يمكنه منح صلاحيات مخصصة لأي شخص
- لا توجد قيود صارمة على الأدوار
- دعم للصلاحيات الجزئية

### ✅ **أمان محسن**:
- التحقق من العضوية في المؤسسة
- التحقق من الصلاحيات المخصصة
- حماية المحتوى الشخصي

### ✅ **دعم المهام الفردية**:
- قواعد منفصلة للمستخدمين الأفراد
- دعم المهام المشتركة
- حماية البيانات الشخصية

### ✅ **توافق مع النظام الحالي**:
- الأدوار التقليدية لا تزال تعمل
- لا حاجة لتغيير الكود الموجود
- انتقال سلس للنظام الجديد

## أمثلة الاستخدام 💡

### **مثال 1: مساعد بصلاحيات خاصة**
```json
{
  "userId": "user123",
  "role": "assistant",
  "permissions": {
    "canCreateTasks": true,
    "canViewReports": true,
    "canEditTasks": false,
    "canDeleteTasks": false
  }
}
```
**النتيجة**: يمكنه إنشاء مهام وعرض التقارير فقط

### **مثال 2: فني بصلاحيات محدودة**
```json
{
  "userId": "user456",
  "role": "technician",
  "permissions": {
    "canCreateTasks": false,
    "canEditTasks": true,
    "canViewReports": false,
    "canDeleteTasks": false
  }
}
```
**النتيجة**: يمكنه تعديل المهام الموجودة فقط

### **مثال 3: مشرف بصلاحيات كاملة**
```json
{
  "userId": "user789",
  "role": "supervisor",
  "permissions": {
    // الصلاحيات المخصصة اختيارية للمشرفين
    // الدور يعطي صلاحيات افتراضية
  }
}
```
**النتيجة**: صلاحيات كاملة بناءً على الدور

## التطبيق والنشر 🚀

### **خطوات النشر**:
1. **تحديث القواعد**:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **اختبار الصلاحيات**:
   - اختبار المستخدمين بأدوار مختلفة
   - اختبار الصلاحيات المخصصة
   - التأكد من عمل المهام الفردية

3. **مراقبة الأداء**:
   - مراقبة استعلامات Firestore
   - التأكد من عدم وجود أخطاء صلاحيات
   - مراجعة سجلات الأمان

### **التحقق من النجاح**:
- ✅ المستخدمون بصلاحيات مخصصة يمكنهم الوصول للميزات
- ✅ الأدوار التقليدية لا تزال تعمل
- ✅ المهام الفردية محمية ومتاحة للمالكين
- ✅ لا توجد أخطاء في Console

## الخلاصة 🎉

تم تحديث قواعد Firestore لتصبح:

1. **مرنة** - تدعم الصلاحيات المخصصة
2. **آمنة** - تحمي البيانات والخصوصية  
3. **شاملة** - تدعم المؤسسات والأفراد
4. **متوافقة** - تعمل مع النظام الحالي

النتيجة: **نظام صلاحيات مرن وقوي يدعم جميع احتياجات التطبيق!** ✨
