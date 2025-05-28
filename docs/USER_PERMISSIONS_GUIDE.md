# 🔐 دليل الصلاحيات والأمان

## 📋 جدول المحتويات
- [نظام الصلاحيات](#نظام-الصلاحيات)
- [التحقق من الصلاحيات](#التحقق-من-الصلاحيات)
- [الصلاحيات المخصصة](#الصلاحيات-المخصصة)
- [أمان النظام](#أمان-النظام)
- [أمثلة برمجية](#أمثلة-برمجية)

---

## 🎯 نظام الصلاحيات

### 📝 هيكل الصلاحيات
```typescript
type PermissionKey = `${PermissionArea}:${PermissionAction}`;

type PermissionArea = 
  | 'users'      // إدارة المستخدمين
  | 'tasks'      // إدارة المهام
  | 'reports'    // التقارير
  | 'settings'   // الإعدادات
  | 'tools'      // الأدوات
  | 'dashboard'  // لوحة المعلومات
  | 'data';      // إدارة البيانات

type PermissionAction = 
  | 'view'       // عرض
  | 'create'     // إنشاء
  | 'edit'       // تعديل
  | 'delete'     // حذف
  | 'approve'    // موافقة
  | 'assign';    // تعيين
```

### 🔍 أمثلة على الصلاحيات
```typescript
// أمثلة على مفاتيح الصلاحيات
'users:view'        // عرض المستخدمين
'tasks:create'      // إنشاء مهام
'reports:edit'      // تعديل التقارير
'settings:delete'   // حذف الإعدادات
'dashboard:approve' // الموافقة على لوحة المعلومات
'data:assign'       // تعيين البيانات
```

---

## ✅ التحقق من الصلاحيات

### 🖥️ Frontend (React)
```typescript
import { usePermissions } from '@/hooks/usePermissions';

function TaskManagement() {
  const { hasPermission, checkRole } = usePermissions();

  // التحقق من صلاحية محددة
  const canCreateTasks = hasPermission('tasks.create');
  const canEditTasks = hasPermission('tasks.edit');
  
  // التحقق من الدور
  const isAdmin = checkRole('org_admin');
  const isSupervisor = checkRole('org_supervisor');

  return (
    <div>
      {canCreateTasks && (
        <Button onClick={createTask}>إنشاء مهمة</Button>
      )}
      
      {canEditTasks && (
        <Button onClick={editTask}>تعديل المهمة</Button>
      )}
      
      {isAdmin && (
        <AdminPanel />
      )}
    </div>
  );
}
```

### 🔧 Backend (Cloud Functions)
```typescript
import { hasPermission, getUserPermissions } from '@/shared/permissions';

export const createTask = functions.https.onCall(async (data, context) => {
  // التحقق من المصادقة
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  }

  const userId = context.auth.uid;
  
  // التحقق من الصلاحية
  const canCreate = await hasPermission(userId, 'tasks:create');
  if (!canCreate) {
    throw new functions.https.HttpsError('permission-denied', 'ليس لديك صلاحية إنشاء المهام');
  }

  // تنفيذ العملية
  // ...
});
```

---

## 🎨 الصلاحيات المخصصة

### 📊 إضافة صلاحيات مخصصة
```typescript
// إضافة صلاحيات مخصصة لمستخدم
const customPermissions = [
  'reports:create',
  'dashboard:edit',
  'tools:approve'
];

await updateUserPermissions(userId, customPermissions);
```

### 🔄 دمج الصلاحيات
```typescript
// النظام يدمج الصلاحيات الافتراضية مع المخصصة
function getAllUserPermissions(role: UserRole, customPermissions: PermissionKey[]) {
  const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return [...new Set([...defaultPermissions, ...customPermissions])];
}
```

---

## 🛡️ أمان النظام

### 🔐 مستويات الأمان

#### 1. **Frontend Security**
```typescript
// إخفاء العناصر بناءً على الصلاحيات
{hasPermission('users.delete') && (
  <DeleteButton />
)}

// تعطيل الأزرار
<Button 
  disabled={!hasPermission('tasks.edit')}
  onClick={editTask}
>
  تعديل
</Button>
```

#### 2. **Backend Security**
```typescript
// التحقق من الصلاحيات في كل API call
async function ensurePermission(userId: string, permission: PermissionKey) {
  const hasAccess = await hasPermission(userId, permission);
  if (!hasAccess) {
    throw new functions.https.HttpsError('permission-denied', 'غير مصرح');
  }
}
```

#### 3. **Database Security Rules**
```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // المستخدمون يمكنهم قراءة بياناتهم فقط
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // المهام - بناءً على المؤسسة
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && 
        (resource.data.organizationId == request.auth.token.organizationId ||
         resource.data.createdBy == request.auth.uid);
    }
  }
}
```

### ⚠️ قواعد الأمان المهمة

1. **عدم الثقة في Frontend**
   - جميع التحققات في Frontend للتجربة فقط
   - التحقق الحقيقي يجب أن يكون في Backend

2. **التحقق المزدوج**
   - التحقق من الصلاحيات في كل طلب API
   - التحقق من ملكية البيانات

3. **تسجيل العمليات**
   - تسجيل جميع العمليات الحساسة
   - مراقبة محاولات الوصول غير المصرح

---

## 💻 أمثلة برمجية

### 🔧 Hook مخصص للصلاحيات
```typescript
// hooks/useTaskPermissions.ts
export function useTaskPermissions(task: Task) {
  const { hasPermission, role, user } = usePermissions();
  
  const canView = hasPermission('tasks.view');
  const canEdit = hasPermission('tasks.edit') && 
    (task.createdBy === user?.uid || role === 'org_admin');
  const canDelete = hasPermission('tasks.delete') && 
    (task.createdBy === user?.uid || role === 'org_admin');
  const canAssign = hasPermission('tasks.assign');
  
  return {
    canView,
    canEdit,
    canDelete,
    canAssign
  };
}
```

### 🎯 مكون محمي بالصلاحيات
```typescript
// components/ProtectedComponent.tsx
interface ProtectedComponentProps {
  permission: string;
  role?: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedComponent({ 
  permission, 
  role, 
  children, 
  fallback 
}: ProtectedComponentProps) {
  const { hasPermission, checkRole } = usePermissions();
  
  const hasAccess = hasPermission(permission) && 
    (role ? checkRole(role) : true);
  
  if (!hasAccess) {
    return fallback || <div>غير مصرح لك بالوصول</div>;
  }
  
  return <>{children}</>;
}

// الاستخدام
<ProtectedComponent permission="users.create" role="org_admin">
  <CreateUserButton />
</ProtectedComponent>
```

### 🔄 Middleware للصلاحيات
```typescript
// middleware/permissions.ts
export function withPermission(permission: PermissionKey) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const context = args[1]; // Cloud Functions context
      
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'غير مصادق');
      }
      
      const hasAccess = await hasPermission(context.auth.uid, permission);
      if (!hasAccess) {
        throw new functions.https.HttpsError('permission-denied', 'غير مصرح');
      }
      
      return method.apply(this, args);
    };
  };
}

// الاستخدام
class TaskService {
  @withPermission('tasks:create')
  async createTask(data: any, context: any) {
    // منطق إنشاء المهمة
  }
  
  @withPermission('tasks:delete')
  async deleteTask(data: any, context: any) {
    // منطق حذف المهمة
  }
}
```

### 📊 تقرير الصلاحيات
```typescript
// utils/permissionReport.ts
export async function generatePermissionReport(userId: string) {
  const userPermissions = await getUserPermissions(userId);
  const userRecord = await admin.auth().getUser(userId);
  const userClaims = userRecord.customClaims || {};
  
  return {
    userId,
    email: userRecord.email,
    role: userClaims.role,
    accountType: userClaims.accountType,
    organizationId: userClaims.organizationId,
    permissions: {
      default: DEFAULT_ROLE_PERMISSIONS[userClaims.role] || [],
      custom: userPermissions.filter(p => 
        !DEFAULT_ROLE_PERMISSIONS[userClaims.role]?.includes(p)
      ),
      total: userPermissions
    },
    permissionCount: userPermissions.length,
    lastUpdated: new Date().toISOString()
  };
}
```

---

## 🔍 استكشاف الأخطاء

### ❌ مشاكل شائعة

1. **صلاحية مرفوضة رغم وجود الدور**
   ```typescript
   // تحقق من تحديث Claims
   await admin.auth().setCustomUserClaims(userId, newClaims);
   
   // تحقق من تطابق الصلاحيات
   console.log('User permissions:', await getUserPermissions(userId));
   ```

2. **عدم ظهور العناصر في Frontend**
   ```typescript
   // تحقق من تحميل الصلاحيات
   const { loading, permissions } = usePermissions();
   
   if (loading) return <Loading />;
   
   console.log('Current permissions:', permissions);
   ```

3. **خطأ في Backend**
   ```typescript
   // إضافة تسجيل مفصل
   console.log('Checking permission:', permission);
   console.log('User role:', userRole);
   console.log('User permissions:', userPermissions);
   ```

### 🛠️ أدوات التشخيص
```typescript
// utils/debugPermissions.ts
export function debugUserPermissions(userId: string) {
  return {
    async checkAll() {
      const user = await admin.auth().getUser(userId);
      const permissions = await getUserPermissions(userId);
      
      console.log('=== User Debug Info ===');
      console.log('UID:', userId);
      console.log('Email:', user.email);
      console.log('Claims:', user.customClaims);
      console.log('Permissions:', permissions);
      console.log('=====================');
      
      return {
        user: user.toJSON(),
        permissions,
        claims: user.customClaims
      };
    }
  };
}
```

---

*آخر تحديث: ديسمبر 2024*
