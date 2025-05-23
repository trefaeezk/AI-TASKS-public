# إصلاح قواعد Firestore لدعم أصحاب المؤسسات

## المشكلة المحلولة ✅

كان المستخدم صاحب المؤسسة (`isAdmin: true`) لا يمكنه الوصول لبيانات المؤسسة بسبب:

1. **قواعد Firestore لم تدعم أصحاب المؤسسات**: القواعد كانت تتحقق فقط من العضوية في `members`
2. **عدم جلب بيانات المؤسسة**: الكود لم يكن يجلب وثيقة المؤسسة للتحقق من `ownerId`
3. **قواعد إعدادات الإشعارات مفقودة**: لم تكن هناك قواعد لـ `notificationSettings`

## الحلول المطبقة 🔧

### 1. **تحديث قواعد Firestore** 📋

#### **قبل الإصلاح**:
```javascript
// قواعد المؤسسات - تتحقق فقط من العضوية
allow read: if request.auth != null && (
  exists(/databases/.../organizations/{orgId}/members/{userId}) ||
  request.auth.token.admin == true
);
```

#### **بعد الإصلاح**:
```javascript
// قواعد المؤسسات - تدعم أصحاب المؤسسات
allow read: if request.auth != null && (
  // صاحب المؤسسة
  resource.data.ownerId == request.auth.uid ||
  // عضو في المؤسسة
  exists(/databases/.../organizations/{orgId}/members/{userId}) ||
  // أدمن النظام
  request.auth.token.admin == true
);
```

### 2. **إضافة قواعد إعدادات الإشعارات** 🔔

```javascript
// قواعد إعدادات الإشعارات
match /notificationSettings/{userId} {
  allow read, write: if request.auth != null && (
    request.auth.uid == userId ||
    request.auth.token.admin == true
  );
}
```

### 3. **تحديث قواعد المهام لدعم أصحاب المؤسسات** 📝

#### **قبل**:
```javascript
// مهام المؤسسة - عضوية فقط
(resource.data.organizationId != null && 
 exists(/databases/.../organizations/{orgId}/members/{userId}))
```

#### **بعد**:
```javascript
// مهام المؤسسة - صاحب المؤسسة + العضوية
(resource.data.organizationId != null && (
  // صاحب المؤسسة
  get(/databases/.../organizations/{orgId}).data.ownerId == request.auth.uid ||
  // عضو في المؤسسة
  exists(/databases/.../organizations/{orgId}/members/{userId})
))
```

### 4. **تحديث كود جلب البيانات** 💻

#### **إضافة جلب بيانات المؤسسة**:
```typescript
// جلب بيانات المؤسسة أولاً للتحقق من الصلاحيات
const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
if (!orgDoc.exists()) {
  throw new Error('Organization not found');
}

const orgData = orgDoc.data();
console.log('Organization data:', orgData);
console.log('Current user ID:', user.uid);
console.log('Organization owner ID:', orgData.ownerId);
```

#### **تحسين معالجة الأخطاء**:
```typescript
// معالجة أخطاء الصلاحيات
if (error.code === 'permission-denied') {
  toast({
    title: 'خطأ في الصلاحيات',
    description: 'ليس لديك صلاحية للوصول إلى بيانات هذه المؤسسة.',
    variant: 'destructive',
  });
}
```

## القواعد الجديدة الشاملة 📜

### **هيكل الصلاحيات**:

1. **أصحاب المؤسسات** (`ownerId`):
   - الوصول الكامل لبيانات المؤسسة
   - إنشاء وتعديل وحذف المهام
   - إدارة الأعضاء والأقسام

2. **أعضاء المؤسسة** (`members`):
   - الوصول للبيانات حسب الدور
   - إنشاء وتعديل المهام
   - عرض التقارير

3. **أدمن النظام** (`admin: true`):
   - الوصول الكامل لجميع البيانات
   - إدارة جميع المؤسسات
   - صلاحيات عليا

### **أولوية الصلاحيات**:
```
1. أدمن النظام (أعلى أولوية)
2. صاحب المؤسسة
3. أعضاء المؤسسة
4. منشئ المحتوى (للمهام والتقارير)
```

## الفوائد الجديدة 🚀

### ✅ **دعم كامل لأصحاب المؤسسات**:
- لا حاجة لإنشاء عضوية في `members`
- وصول مباشر عبر `ownerId`
- صلاحيات كاملة تلقائياً

### ✅ **أمان محسن**:
- التحقق من الهوية على مستويات متعددة
- حماية البيانات الحساسة
- منع الوصول غير المصرح

### ✅ **مرونة في الإدارة**:
- دعم الأدوار المختلفة
- صلاحيات مخصصة للأعضاء
- إدارة مرنة للمحتوى

### ✅ **تجربة مستخدم أفضل**:
- رسائل خطأ واضحة
- تحميل سريع للبيانات
- واجهة متجاوبة

## اختبار النظام 🧪

### **خطوات التحقق**:

1. **صاحب المؤسسة**:
   ```bash
   ✅ يمكنه الوصول للوحة التحكم
   ✅ يرى إحصائيات المؤسسة
   ✅ يمكنه إدارة المهام
   ✅ يمكنه عرض التقارير
   ```

2. **عضو المؤسسة**:
   ```bash
   ✅ يمكنه الوصول للبيانات المسموحة
   ✅ يمكنه إنشاء مهام
   ✅ لا يمكنه حذف مهام الآخرين (إلا إذا كان admin)
   ```

3. **مستخدم خارجي**:
   ```bash
   ❌ لا يمكنه الوصول لبيانات المؤسسة
   ❌ رسالة خطأ واضحة
   ```

## المراقبة والتشخيص 🔍

### **سجلات Console**:
```javascript
console.log('Organization data:', orgData);
console.log('Current user ID:', user.uid);
console.log('Organization owner ID:', orgData.ownerId);
```

### **معالجة الأخطاء**:
- تمييز أخطاء الصلاحيات
- رسائل مفيدة للمستخدم
- سجلات مفصلة للمطورين

## النتيجة النهائية 🎉

تم إصلاح جميع مشاكل الصلاحيات:

1. **أصحاب المؤسسات** يمكنهم الوصول لبياناتهم ✅
2. **إعدادات الإشعارات** تعمل بشكل صحيح ✅
3. **قواعد أمان شاملة** ومرنة ✅
4. **تجربة مستخدم محسنة** مع رسائل واضحة ✅

**النظام جاهز للإنتاج مع دعم كامل لجميع أنواع المستخدمين!** 🚀
