# 🔧 أمثلة عملية للفريق الخلفي

## 📋 نماذج Cloud Functions

### 1. **دالة إنشاء المستخدم المحدثة**

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const createUser = functions.https.onCall(async (data, context) => {
  try {
    // التحقق من المصادقة
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // التحقق من الصلاحيات
    const callerClaims = context.auth.token;
    if (!callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    const { email, password, name, accountType, role, organizationId, departmentId } = data;

    // التحقق من صحة البيانات
    if (!email || !password || !name || !accountType || !role) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // إنشاء المستخدم في Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      disabled: false,
    });

    // تحديد الأدوار بناءً على الدور المطلوب
    const userRoles = {
      isSystemOwner: role === 'system_owner',
      isSystemAdmin: role === 'system_admin',
      isOrganizationOwner: role === 'organization_owner',
      isAdmin: ['system_admin', 'organization_admin', 'individual_admin'].includes(role),
      isOwner: ['system_owner', 'organization_owner'].includes(role),
      isIndividualAdmin: role === 'individual_admin',
    };

    // إنشاء وثيقة المستخدم في Firestore
    const userData = {
      uid: userRecord.uid,
      email,
      name,
      displayName: name,
      accountType,
      role,
      ...userRoles,
      organizationId: organizationId || null,
      departmentId: departmentId || null,
      disabled: false,
      customPermissions: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid,
    };

    await admin.firestore().collection('users').doc(userRecord.uid).set(userData);

    // تعيين Custom Claims
    const customClaims = {
      role,
      accountType,
      ...userRoles,
      organizationId: organizationId || null,
      departmentId: departmentId || null,
      disabled: false,
      createdBy: context.auth.uid,
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

    console.log(`User created successfully: ${userRecord.uid}`);

    return {
      success: true,
      userId: userRecord.uid,
      message: 'User created successfully',
    };

  } catch (error) {
    console.error('Error creating user:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to create user');
  }
});
```

### 2. **دالة تحديث دور المستخدم**

```typescript
// functions/src/roles.ts
export const updateUserRole = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, newRole } = data;
    const callerClaims = context.auth.token;

    // التحقق من الصلاحيات
    if (!callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    // منع تغيير دور مالك النظام إلا من مالك آخر
    if (newRole === 'system_owner' && !callerClaims.isSystemOwner) {
      throw new functions.https.HttpsError('permission-denied', 'Only system owners can create other system owners');
    }

    // الحصول على بيانات المستخدم الحالية
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    // تحديد الأدوار الجديدة
    const newRoles = {
      isSystemOwner: newRole === 'system_owner',
      isSystemAdmin: newRole === 'system_admin',
      isOrganizationOwner: newRole === 'organization_owner',
      isAdmin: ['system_admin', 'organization_admin', 'individual_admin'].includes(newRole),
      isOwner: ['system_owner', 'organization_owner'].includes(newRole),
      isIndividualAdmin: newRole === 'individual_admin',
    };

    // تحديث البيانات في Firestore
    await admin.firestore().collection('users').doc(userId).update({
      role: newRole,
      ...newRoles,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // تحديث Custom Claims
    const updatedClaims = {
      ...userData,
      role: newRole,
      ...newRoles,
    };

    await admin.auth().setCustomUserClaims(userId, updatedClaims);

    console.log(`User role updated: ${userId} -> ${newRole}`);

    return {
      success: true,
      message: 'User role updated successfully',
    };

  } catch (error) {
    console.error('Error updating user role:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to update user role');
  }
});
```

### 3. **دالة تحديث الصلاحيات المخصصة**

```typescript
// functions/src/roles.ts
export const updateUserPermissions = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, permissions } = data;
    const callerClaims = context.auth.token;

    // التحقق من الصلاحيات
    if (!callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    // التحقق من صحة الصلاحيات
    const validPermissions = [
      'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:view',
      'reports:create', 'reports:edit', 'reports:delete', 'reports:view',
      'settings:view', 'settings:edit',
      'users:create', 'users:edit', 'users:delete', 'users:view'
    ];

    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      throw new functions.https.HttpsError('invalid-argument', `Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // الحصول على بيانات المستخدم
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    // تحديث الصلاحيات في Firestore
    await admin.firestore().collection('users').doc(userId).update({
      customPermissions: permissions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // تحديث Custom Claims
    const updatedClaims = {
      ...userData,
      customPermissions: permissions,
    };

    await admin.auth().setCustomUserClaims(userId, updatedClaims);

    console.log(`User permissions updated: ${userId}`);

    return {
      success: true,
      message: 'User permissions updated successfully',
    };

  } catch (error) {
    console.error('Error updating user permissions:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to update user permissions');
  }
});
```

### 4. **دالة تحديث نوع الحساب**

```typescript
// functions/src/auth.ts
export const updateAccountType = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, newAccountType, organizationId, departmentId } = data;
    const callerClaims = context.auth.token;

    // التحقق من الصلاحيات
    if (!callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    // التحقق من صحة نوع الحساب
    if (!['individual', 'organization'].includes(newAccountType)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid account type');
    }

    // للحسابات التنظيمية، organizationId مطلوب
    if (newAccountType === 'organization' && !organizationId) {
      throw new functions.https.HttpsError('invalid-argument', 'Organization ID required for organization accounts');
    }

    // الحصول على بيانات المستخدم الحالية
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    // تحديد البيانات الجديدة حسب نوع الحساب
    const updateData: any = {
      accountType: newAccountType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (newAccountType === 'organization') {
      updateData.organizationId = organizationId;
      updateData.departmentId = departmentId || null;
      // إعادة تعيين الدور إذا لزم الأمر
      if (userData.role === 'individual_admin') {
        updateData.role = 'member';
        updateData.isIndividualAdmin = false;
      }
    } else {
      // للحسابات الفردية
      updateData.organizationId = null;
      updateData.departmentId = null;
      // إعادة تعيين الأدوار التنظيمية
      updateData.isOrganizationOwner = false;
      if (['organization_admin', 'organization_owner'].includes(userData.role)) {
        updateData.role = 'user';
      }
    }

    // تحديث البيانات في Firestore
    await admin.firestore().collection('users').doc(userId).update(updateData);

    // الحصول على البيانات المحدثة
    const updatedUserDoc = await admin.firestore().collection('users').doc(userId).get();
    const updatedUserData = updatedUserDoc.data();

    // تحديث Custom Claims
    const updatedClaims = {
      ...updatedUserData,
      accountType: newAccountType,
      organizationId: newAccountType === 'organization' ? organizationId : null,
      departmentId: newAccountType === 'organization' ? (departmentId || null) : null,
    };

    await admin.auth().setCustomUserClaims(userId, updatedClaims);

    console.log(`Account type updated: ${userId} -> ${newAccountType}`);

    return {
      success: true,
      message: 'Account type updated successfully',
      newAccountType,
    };

  } catch (error) {
    console.error('Error updating account type:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to update account type');
  }
});
```

### 5. **دالة تحديث معرف القسم**

```typescript
// functions/src/departments.ts
export const updateUserDepartment = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { userId, departmentId, organizationId } = data;
    const callerClaims = context.auth.token;

    // التحقق من الصلاحيات
    if (!callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      // التحقق من أن المستدعي أدمن في نفس المؤسسة
      if (!callerClaims.isOrganizationOwner && !callerClaims.isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
      }

      // التحقق من أن المستدعي في نفس المؤسسة
      if (callerClaims.organizationId !== organizationId) {
        throw new functions.https.HttpsError('permission-denied', 'Can only manage users in your organization');
      }
    }

    // التحقق من وجود المستخدم
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    // التحقق من أن المستخدم في نفس المؤسسة
    if (userData.organizationId !== organizationId) {
      throw new functions.https.HttpsError('invalid-argument', 'User is not in the specified organization');
    }

    // التحقق من وجود القسم (إذا تم تحديده)
    if (departmentId) {
      const deptDoc = await admin.firestore()
        .collection('organizations')
        .doc(organizationId)
        .collection('departments')
        .doc(departmentId)
        .get();

      if (!deptDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Department not found');
      }
    }

    // تحديث معرف القسم في Firestore
    await admin.firestore().collection('users').doc(userId).update({
      departmentId: departmentId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // تحديث Custom Claims
    const updatedClaims = {
      ...userData,
      departmentId: departmentId || null,
    };

    await admin.auth().setCustomUserClaims(userId, updatedClaims);

    console.log(`User department updated: ${userId} -> ${departmentId || 'null'}`);

    return {
      success: true,
      message: 'User department updated successfully',
      departmentId: departmentId || null,
    };

  } catch (error) {
    console.error('Error updating user department:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to update user department');
  }
});
```

### 6. **دالة إنشاء/إضافة مستخدم للمؤسسة**

```typescript
// functions/src/organization/members.ts
export const addOrCreateMemberToOrganization = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { email, role, departmentId, organizationId, password, name } = data;
    const callerClaims = context.auth.token;

    // التحقق من الصلاحيات
    if (!callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      // التحقق من أن المستدعي مالك أو أدمن في المؤسسة
      if (!callerClaims.isOrganizationOwner && !callerClaims.isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
      }

      // التحقق من أن المستدعي في نفس المؤسسة
      if (callerClaims.organizationId !== organizationId) {
        throw new functions.https.HttpsError('permission-denied', 'Can only manage users in your organization');
      }
    }

    // التحقق من وجود المؤسسة
    const orgDoc = await admin.firestore().collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Organization not found');
    }

    let userRecord;
    let isNewUser = false;

    // محاولة العثور على المستخدم الموجود
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`Found existing user: ${userRecord.uid}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // المستخدم غير موجود، إنشاء مستخدم جديد
        if (!password || !name) {
          throw new functions.https.HttpsError('invalid-argument', 'Password and name are required for new users');
        }

        userRecord = await admin.auth().createUser({
          email,
          password,
          displayName: name,
          disabled: false,
        });

        isNewUser = true;
        console.log(`Created new user: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // إنشاء/تحديث وثيقة المستخدم في Firestore
    const userData = {
      uid: userRecord.uid,                     // ✅ معرف المستخدم
      name: name || userRecord.displayName || userRecord.email?.split('@')[0] || 'مستخدم',
      email: userRecord.email,
      displayName: name || userRecord.displayName || userRecord.email?.split('@')[0] || 'مستخدم',
      accountType: 'organization',
      role: role,
      organizationId: organizationId,
      departmentId: departmentId || null,      // ✅ معرف القسم
      disabled: false,
      customPermissions: [],                   // ✅ الصلاحيات المخصصة

      // الأدوار الجديدة
      isSystemOwner: false,
      isSystemAdmin: false,
      isOrganizationOwner: role === 'organization_owner',
      isAdmin: ['admin', 'organization_admin'].includes(role),
      isOwner: role === 'organization_owner',
      isIndividualAdmin: false,

      // التواريخ
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: isNewUser ? context.auth.uid : undefined, // ✅ من أنشأ المستخدم
    };

    // إضافة createdAt فقط للمستخدمين الجدد
    if (isNewUser) {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await admin.firestore().collection('users').doc(userRecord.uid).set(userData, { merge: !isNewUser });

    // إضافة المستخدم كعضو في المؤسسة
    await admin.firestore()
      .collection('organizations')
      .doc(organizationId)
      .collection('members')
      .doc(userRecord.uid)
      .set({
        role: role,
        departmentId: departmentId || null,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        addedBy: context.auth.uid,
      });

    // تحديث Custom Claims
    const customClaims = {
      role: role,
      accountType: 'organization',
      organizationId: organizationId,
      departmentId: departmentId || null,
      isSystemOwner: false,
      isSystemAdmin: false,
      isOrganizationOwner: role === 'organization_owner',
      isAdmin: ['admin', 'organization_admin'].includes(role),
      isOwner: role === 'organization_owner',
      isIndividualAdmin: false,
      customPermissions: [],
      disabled: false,
      createdBy: isNewUser ? context.auth.uid : undefined,
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

    console.log(`Successfully ${isNewUser ? 'created and added' : 'added'} user ${email} to organization ${organizationId}`);

    return {
      success: true,
      userId: userRecord.uid,
      isNewUser: isNewUser,
      message: isNewUser ? 'User created and added to organization successfully' : 'User added to organization successfully',
    };

  } catch (error) {
    console.error('Error adding/creating user to organization:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to add user to organization');
  }
});
```

### 7. **دالة قائمة المستخدمين**

```typescript
// functions/src/index.ts
export const listUsers = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const callerClaims = context.auth.token;
    const { accountType, organizationId, role, limit = 50, offset = 0 } = data;

    // التحقق من الصلاحيات
    if (!callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      // المستخدمون العاديون يمكنهم رؤية أعضاء مؤسستهم فقط
      if (!callerClaims.organizationId) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
      }
    }

    let query = admin.firestore().collection('users');

    // تطبيق الفلاتر
    if (accountType) {
      query = query.where('accountType', '==', accountType);
    }

    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    } else if (callerClaims.organizationId && !callerClaims.isSystemOwner && !callerClaims.isSystemAdmin) {
      // المستخدمون العاديون يرون مؤسستهم فقط
      query = query.where('organizationId', '==', callerClaims.organizationId);
    }

    if (role) {
      query = query.where('role', '==', role);
    }

    // تطبيق الترقيم
    query = query.orderBy('createdAt', 'desc').limit(limit + 1).offset(offset);

    const snapshot = await query.get();
    const users = [];
    let hasMore = false;

    snapshot.docs.forEach((doc, index) => {
      if (index < limit) {
        const userData = doc.data();
        // إزالة البيانات الحساسة
        delete userData.customPermissions;
        users.push({
          id: doc.id,
          ...userData,
        });
      } else {
        hasMore = true;
      }
    });

    return {
      users,
      total: users.length,
      hasMore,
    };

  } catch (error) {
    console.error('Error listing users:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError('internal', 'Failed to list users');
  }
});
```

---

## 🔒 أمثلة قواعد Firestore

### **قواعد المستخدمين المحدثة**

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // دوال مساعدة
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserId() {
      return request.auth.uid;
    }

    function getUserToken() {
      return request.auth.token;
    }

    function isSystemOwner() {
      return isAuthenticated() && getUserToken().isSystemOwner == true;
    }

    function isSystemAdmin() {
      return isAuthenticated() && getUserToken().isSystemAdmin == true;
    }

    function hasSystemAccess() {
      return isSystemOwner() || isSystemAdmin();
    }

    // قواعد المستخدمين
    match /users/{userId} {
      // قراءة البيانات الشخصية
      allow read: if isAuthenticated() && getUserId() == userId;

      // قراءة عامة للبيانات الأساسية
      allow read: if isAuthenticated();

      // كتابة البيانات الشخصية مع قيود
      allow write: if isAuthenticated() && getUserId() == userId && (
        !('isSystemOwner' in request.resource.data) &&
        !('isSystemAdmin' in request.resource.data) &&
        !('role' in request.resource.data)
      );

      // صلاحيات النظام العليا
      allow read, write: if hasSystemAccess();

      // إنشاء مستخدم جديد
      allow create: if hasSystemAccess();
    }

    // قواعد المهام
    match /tasks/{taskId} {
      allow read, write: if isAuthenticated() && (
        hasSystemAccess() ||
        resource.data.userId == getUserId() ||
        resource.data.createdBy == getUserId()
      );
    }
  }
}
```

---

## 📊 أمثلة استعلامات قاعدة البيانات

### **استعلامات المستخدمين**

```typescript
// الحصول على جميع المستخدمين (للأدمن فقط)
const getAllUsers = async () => {
  const snapshot = await admin.firestore()
    .collection('users')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// الحصول على مستخدمي مؤسسة معينة
const getOrganizationUsers = async (organizationId: string) => {
  const snapshot = await admin.firestore()
    .collection('users')
    .where('organizationId', '==', organizationId)
    .where('accountType', '==', 'organization')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// الحصول على المستخدمين الفرديين
const getIndividualUsers = async () => {
  const snapshot = await admin.firestore()
    .collection('users')
    .where('accountType', '==', 'individual')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// الحصول على المستخدمين حسب نوع الحساب والدور
const getUsersByAccountTypeAndRole = async (accountType: 'individual' | 'organization', role?: string) => {
  let query = admin.firestore()
    .collection('users')
    .where('accountType', '==', accountType);

  if (role) {
    query = query.where('role', '==', role);
  }

  const snapshot = await query.get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// إحصائيات المستخدمين حسب نوع الحساب
const getUserStatsByAccountType = async () => {
  const [individualSnapshot, organizationSnapshot] = await Promise.all([
    admin.firestore().collection('users').where('accountType', '==', 'individual').get(),
    admin.firestore().collection('users').where('accountType', '==', 'organization').get(),
  ]);

  return {
    individual: individualSnapshot.size,
    organization: organizationSnapshot.size,
    total: individualSnapshot.size + organizationSnapshot.size,
  };
};

// البحث عن مستخدم بالبريد الإلكتروني
const getUserByEmail = async (email: string) => {
  const snapshot = await admin.firestore()
    .collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  };
};
```

---

## 🧪 أمثلة اختبار

### **اختبار إنشاء المستخدمين**

```typescript
// test/users.test.ts
import { createUser } from '../src/index';

describe('User Creation', () => {
  test('should create individual user', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      accountType: 'individual',
      role: 'user'
    };

    const result = await createUser(userData, mockContext);

    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
  });

  test('should create organization user', async () => {
    const userData = {
      email: 'org@example.com',
      password: 'password123',
      name: 'Org User',
      accountType: 'organization',
      role: 'member',
      organizationId: 'org123'
    };

    const result = await createUser(userData, mockContext);

    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
  });

  test('should update account type from individual to organization', async () => {
    const updateData = {
      userId: 'user123',
      newAccountType: 'organization',
      organizationId: 'org456',
      departmentId: 'dept789'
    };

    const result = await updateAccountType(updateData, mockContext);

    expect(result.success).toBe(true);
    expect(result.newAccountType).toBe('organization');
  });

  test('should update account type from organization to individual', async () => {
    const updateData = {
      userId: 'user123',
      newAccountType: 'individual'
    };

    const result = await updateAccountType(updateData, mockContext);

    expect(result.success).toBe(true);
    expect(result.newAccountType).toBe('individual');
  });

  test('should filter users by account type', async () => {
    const individualUsers = await getUsersByAccountTypeAndRole('individual');
    const organizationUsers = await getUsersByAccountTypeAndRole('organization');

    expect(Array.isArray(individualUsers)).toBe(true);
    expect(Array.isArray(organizationUsers)).toBe(true);

    // التحقق من أن جميع المستخدمين لديهم نوع الحساب الصحيح
    individualUsers.forEach(user => {
      expect(user.accountType).toBe('individual');
    });

    organizationUsers.forEach(user => {
      expect(user.accountType).toBe('organization');
    });
  });
});
```

---

## 📋 قائمة التحقق النهائية

### ✅ Cloud Functions
- [ ] تحديث `createUser`
- [ ] تحديث `updateUserRole`
- [ ] تحديث `updateUserPermissions`
- [ ] إضافة `listUsers`
- [ ] حذف دوال Migration

### ✅ قاعدة البيانات
- [ ] حذف مجموعات: `individuals`, `admins`, `owners`
- [ ] تحديث فهارس `users`
- [ ] تحديث قواعد Firestore

### ✅ المصادقة
- [ ] تحديث Custom Claims
- [ ] إزالة المراجع القديمة
- [ ] اختبار الصلاحيات

**جميع الأمثلة جاهزة للتطبيق المباشر!**
