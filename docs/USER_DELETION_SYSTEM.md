# نظام حذف المستخدمين الشامل

## 📋 نظرة عامة

تم تصميم نظام حذف المستخدمين ليوفر حذفاً شاملاً وآمناً للمستخدمين مع جميع بياناتهم المرتبطة. يدعم النظام كلاً من المستخدمين الأفراد والتنظيميين مع مراعاة القيود الأمنية والتحذيرات المناسبة.

## 🏗️ هيكل النظام

### 1. دوال Backend (Firebase Functions)

#### `deleteUserCompletely`
- **الموقع**: `functions/src/userDeletion.ts`
- **الوصف**: دالة شاملة لحذف المستخدم وجميع بياناته
- **المعاملات**:
  - `userId`: معرف المستخدم المراد حذفه
  - `forceDelete`: حذف قسري (اختياري)

#### `deleteIndividualUserData`
- **الموقع**: `functions/src/individual/index.ts`
- **الوصف**: حذف بيانات المستخدم الفردي فقط (بدون حذف الحساب)
- **المعاملات**:
  - `userId`: معرف المستخدم

### 2. Frontend Components

#### `useUserDeletion` Hook
- **الموقع**: `src/hooks/useUserDeletion.ts`
- **الوصف**: Hook لإدارة عمليات حذف المستخدمين
- **الوظائف**:
  - `deleteUserCompletely()`: حذف شامل
  - `deleteIndividualUserData()`: حذف البيانات فقط
  - `confirmUserDeletion()`: تأكيد الحذف

#### `DeleteUserDialog` Component
- **الموقع**: `src/components/admin/DeleteUserDialog.tsx`
- **الوصف**: واجهة حوار حذف المستخدم
- **المميزات**:
  - تأكيد بالبريد الإلكتروني
  - خيارات حذف متعددة
  - تحذيرات للأدوار المهمة

## 🗄️ البيانات المحذوفة

### للمستخدمين الأفراد (`individual`)
1. **حساب Firebase Auth** (اختياري)
2. **مجموعة `users`** - البيانات الأساسية
3. **مجموعة `individuals`** - بيانات إضافية
4. **المجموعات الفرعية**:
   - `individuals/{uid}/tasks` (نظام قديم)
   - `individuals/{uid}/reports` (نظام قديم)
5. **المهام الرئيسية** (`tasks` collection)
6. **الاجتماعات** (منشأة أو مشارك فيها)
7. **فئات المهام** المنشأة
8. **الإشعارات**
9. **رموز OTP**

### للمستخدمين التنظيميين (`organization`)
1. **حساب Firebase Auth**
2. **مجموعة `users`** - البيانات الأساسية
3. **عضوية المؤسسة** (`organizations/{orgId}/members/{userId}`)
4. **المهام** (منشأة أو معينة)
5. **الاجتماعات** (منشأة أو مشارك فيها)
6. **الأهداف** (`objectives`)
7. **النتائج الرئيسية** (`keyResults`)
8. **روابط المهام والنتائج** (`taskKeyResultLinks`)
9. **فئات المهام** المنشأة
10. **الإشعارات**
11. **رموز OTP**

## 🔒 القيود الأمنية

### 1. صلاحيات الوصول
- يجب أن يكون المستدعي **مدير نظام** (`isSystemAdmin` أو `isSystemOwner`)
- لا يمكن للمستخدم حذف نفسه
- للمستخدمين الأفراد: يمكن للمستخدم حذف بياناته الخاصة فقط

### 2. قيود الأدوار المهمة
- **مالك المؤسسة** (`isOrgOwner`): يتطلب `forceDelete` أو وجود مدير آخر
- **مالك النظام** (`isSystemOwner`): يتطلب `forceDelete`

### 3. التحقق من التأكيد
- يجب إدخال البريد الإلكتروني للمستخدم للتأكيد
- عرض تحذيرات واضحة قبل الحذف

## 🚀 كيفية الاستخدام

### 1. في الكود (Hook)
```typescript
import { useUserDeletion } from '@/hooks/useUserDeletion';

const { deleteUserCompletely, isDeleting } = useUserDeletion();

// حذف شامل
await deleteUserCompletely(userId, forceDelete);

// حذف البيانات فقط (للأفراد)
await deleteIndividualUserData(userId);
```

### 2. في الواجهة (Component)
```tsx
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog';

<DeleteUserDialog
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  user={selectedUser}
  onUserDeleted={handleUserDeleted}
/>
```

### 3. استدعاء مباشر (Firebase Functions)
```typescript
import { httpsCallable } from 'firebase/functions';

const deleteUserFn = httpsCallable(functions, 'deleteUserCompletely');
const result = await deleteUserFn({
  userId: 'user-id',
  forceDelete: false
});
```

## ⚠️ تحذيرات مهمة

1. **لا يمكن التراجع**: عملية الحذف نهائية ولا يمكن التراجع عنها
2. **تأثير على البيانات المرتبطة**: حذف المستخدم يؤثر على جميع البيانات المرتبطة
3. **الأدوار المهمة**: حذف مالك المؤسسة قد يؤثر على المؤسسة بالكامل
4. **النسخ الاحتياطية**: تأكد من وجود نسخ احتياطية قبل الحذف

## 🔧 التخصيص والتطوير

### إضافة مجموعات جديدة للحذف
1. أضف الاستعلام في `deleteUserCompletely`
2. حدث `DeleteUserResult` interface
3. أضف العداد في `deletedData`

### تخصيص التحذيرات
1. عدّل `DeleteUserDialog` component
2. أضف شروط جديدة في `deleteUserCompletely`
3. حدث رسائل التحذير

## 📊 مراقبة الأداء

- جميع العمليات مسجلة في console
- عرض تقدم العملية للمستخدم
- إحصائيات مفصلة عن البيانات المحذوفة
- معالجة الأخطاء الشاملة

## 🧪 الاختبار

### اختبار الوحدة
```bash
# تشغيل اختبارات Firebase Functions
npm run test:functions

# اختبار مكونات React
npm run test:components
```

### اختبار التكامل
1. إنشاء مستخدم تجريبي
2. إضافة بيانات مرتبطة
3. تنفيذ عملية الحذف
4. التحقق من حذف جميع البيانات

## 📝 سجل التغييرات

### الإصدار 1.0.0
- إنشاء نظام حذف المستخدمين الأساسي
- دعم المستخدمين الأفراد والتنظيميين
- واجهة مستخدم آمنة مع التأكيد
- حذف شامل لجميع البيانات المرتبطة
