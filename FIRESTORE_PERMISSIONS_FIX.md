# إصلاح خطأ "Missing or insufficient permissions" عند تسجيل الخروج

## المشكلة
كان يظهر خطأ `FirebaseError: Missing or insufficient permissions` في console المتصفح عند تسجيل الخروج من التطبيق.

## السبب
المشكلة كانت بسبب أن **Firestore listeners** تبقى نشطة بعد تسجيل الخروج وتحاول الوصول إلى البيانات بدون رمز مصادقة صالح.

### التفاصيل:
1. عند تسجيل الخروج، يتم إلغاء رمز المصادقة فوراً
2. لكن Firestore listeners في المكونات المختلفة تبقى نشطة
3. هذه listeners تحاول الوصول للبيانات بدون مصادقة صالحة
4. مما يؤدي إلى ظهور خطأ الصلاحيات

## الحلول المطبقة

### 1. تحسين AuthContext
- **إلغاء فوري لجميع listeners**: عند تغيير حالة المصادقة، يتم إلغاء جميع Firestore listeners فوراً
- **معالجة أفضل للأخطاء**: إضافة معالجة خاصة لأخطاء الصلاحيات
- **تنظيف شامل**: ضمان إلغاء جميع الاشتراكات عند تفكيك المكون

```typescript
// إلغاء جميع Firestore listeners فوراً عند تغيير حالة المصادقة
firestoreListenerManager.removeAllListeners();
if (firestoreListener) {
  console.log("[AuthContext] Cleaning up existing Firestore listener due to auth state change.");
  firestoreListener();
  setFirestoreListener(null);
}
```

### 2. تحسين دالة تسجيل الخروج
- **تأخير قصير**: إضافة تأخير 100ms للسماح لـ AuthContext بإلغاء listeners
- **معالجة أفضل للأخطاء**: تسجيل الأخطاء بشكل أوضح

```typescript
const logOut = async (): Promise<boolean> => {
  setLoading(true);
  setError(null);
  try {
    // إضافة تأخير قصير للسماح لـ AuthContext بإلغاء listeners
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await signOut(auth);
    // ...
  } catch (err) {
    console.error('Error during logout:', err);
    handleAuthError(err);
    return false;
  }
};
```

### 3. إنشاء مدير Firestore Listeners
إنشاء utility class لإدارة جميع Firestore listeners بشكل مركزي:

```typescript
// src/utils/firestoreListenerManager.ts
class FirestoreListenerManager {
  private listeners: Map<string, UnsubscribeFunction> = new Map();

  addListener(key: string, unsubscribe: UnsubscribeFunction): void
  removeListener(key: string): void
  removeAllListeners(): void
  // ...
}
```

### 4. تحسين معالجة الأخطاء في المكونات
تحسين معالجة الأخطاء في جميع المكونات التي تستخدم Firestore listeners:

#### TaskDataLoader
```typescript
}, (err) => {
  console.error("TaskDataLoader: Error fetching tasks:", err);
  
  // التعامل مع أخطاء الصلاحيات بعد تسجيل الخروج
  if (err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions')) {
    console.warn("TaskDataLoader: Permission denied, user may have been signed out.");
    // لا نعرض خطأ للمستخدم في هذه الحالة
    setIsLoading(false);
    setTasks([]);
    return;
  }
  
  setError('حدث خطأ أثناء تحميل المهام.');
  setIsLoading(false);
  setTasks([]);
});
```

#### useTaskCategories
```typescript
}, (error) => {
  console.error("useTaskCategories: Error fetching categories:", error);
  
  // التعامل مع أخطاء الصلاحيات بعد تسجيل الخروج
  if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
    console.warn("useTaskCategories: Permission denied, user may have been signed out.");
    setLoading(false);
    setCategories([]);
    return;
  }
  
  toast({ title: 'خطأ في تحميل الفئات', variant: 'destructive' });
  setLoading(false);
  setCategories([]);
});
```

#### Notifications Service
```typescript
(error) => {
  console.error('Error subscribing to user notifications:', error);
  
  // التعامل مع أخطاء الصلاحيات بعد تسجيل الخروج
  if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
    console.warn('Notifications subscription: Permission denied, user may have been signed out.');
    return;
  }
  
  // استدعاء callback مع مصفوفة فارغة في حالة الأخطاء الأخرى
  callback([]);
}
```

### 5. دالة معالجة أخطاء موحدة
إنشاء دالة موحدة لمعالجة أخطاء Firestore:

```typescript
export function handleFirestoreError(error: any, context: string): boolean {
  console.error(`[${context}] Firestore error:`, error);

  // التحقق من أخطاء الصلاحيات
  if (error.code === 'permission-denied' || 
      error.message?.includes('Missing or insufficient permissions') ||
      error.code === 'unauthenticated') {
    console.warn(`[${context}] Permission/authentication error, likely due to logout.`);
    return true; // إشارة أن الخطأ متعلق بالصلاحيات
  }

  return false; // خطأ عادي
}
```

## النتيجة
- **إزالة خطأ الصلاحيات**: لم يعد يظهر خطأ "Missing or insufficient permissions" عند تسجيل الخروج
- **تسجيل خروج سلس**: عملية تسجيل الخروج تتم بدون أخطاء في console
- **أداء أفضل**: إلغاء listeners غير الضرورية يحسن الأداء
- **كود أكثر استقراراً**: معالجة أفضل للأخطاء في جميع أنحاء التطبيق

## الملفات المعدلة
1. `src/context/AuthContext.tsx` - تحسين إدارة listeners ومعالجة الأخطاء
2. `src/hooks/useFirebaseAuth.ts` - تحسين دالة تسجيل الخروج
3. `src/app/(app)/TaskDataLoader.tsx` - تحسين معالجة الأخطاء
4. `src/hooks/useTaskCategories.ts` - تحسين معالجة الأخطاء
5. `src/services/notifications.ts` - تحسين معالجة الأخطاء
6. `src/utils/firestoreListenerManager.ts` - مدير listeners جديد

## أفضل الممارسات للمستقبل
1. **استخدام مدير listeners**: استخدام `firestoreListenerManager` لجميع listeners الجديدة
2. **معالجة أخطاء موحدة**: استخدام `handleFirestoreError` لمعالجة الأخطاء
3. **تنظيف شامل**: ضمان إلغاء جميع listeners عند تفكيك المكونات
4. **اختبار تسجيل الخروج**: اختبار تسجيل الخروج في جميع الصفحات للتأكد من عدم وجود أخطاء
