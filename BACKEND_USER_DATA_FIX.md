# إصلاح إنشاء بيانات المستخدم في Firebase Functions

## نظرة عامة
هذا المستند يوضح كيفية إصلاح التضارب في بيانات المستخدم بين Firebase Auth Claims و Firestore لضمان التوافق مع الفرونت إند.

## المشكلة الحالية

### التضارب في أسماء الحقول:
- **Firebase Auth Claims** تحتوي على: `isSystemOwner`, `isSystemAdmin`
- **AdminProtectedRoute** يبحث عن: `system_owner`, `system_admin`
- **AuthContext** يحصل على البيانات من Firestore بشكل مختلف

### مثال على التضارب:
```json
// Claims الحالية
{
  "role": "system_owner",
  "isSystemOwner": true,
  "isSystemAdmin": false
}

// ما يبحث عنه AdminProtectedRoute
{
  "system_owner": true,
  "system_admin": true
}
```

## الحل المطلوب

### 1. توحيد أسماء الحقول في Firebase Auth Claims

#### الملف: `functions/src/auth/auth.ts`
#### الدالة: `setUserRole`

```typescript
// الكود الحالي (يحتاج تعديل):
const newClaims = {
  ...currentClaims,
  role,
  
  // الأدوار الجديدة
  system_owner: role === 'system_owner',
  system_admin: role === 'system_admin',
  organization_owner: role === 'organization_owner',
  admin: role === 'admin',
  
  // التوافق مع النظام القديم
  owner: role === 'owner' || role === 'system_owner',
  individual_admin: role === 'individual_admin' || role === 'system_admin'
};

// المطلوب تعديله إلى:
const newClaims = {
  ...currentClaims,
  role,
  
  // الأدوار الجديدة (النسخة الموحدة)
  system_owner: role === 'system_owner',
  system_admin: role === 'system_admin',
  organization_owner: role === 'organization_owner',
  admin: role === 'admin',
  
  // إضافة النسخة البديلة للتوافق مع الفرونت إند
  isSystemOwner: role === 'system_owner',
  isSystemAdmin: role === 'system_admin',
  isOrganizationOwner: role === 'organization_owner',
  
  // التوافق مع النظام القديم
  owner: role === 'owner' || role === 'system_owner',
  individual_admin: role === 'individual_admin' || role === 'system_admin'
};
```

### 2. تطبيق التوحيد في دالة إنشاء المستخدم

#### الملف: `functions/src/auth/auth.ts`
#### الدالة: `createUserWithRole`

```typescript
// تعديل claims في دالة createUserWithRole:
const claims: Record<string, any> = {
  role: role || 'assistant',
  
  // الأدوار الجديدة (النسخة الموحدة)
  system_owner: role === 'system_owner',
  system_admin: role === 'system_admin',
  organization_owner: role === 'organization_owner',
  admin: role === 'admin',
  
  // إضافة النسخة البديلة للتوافق مع الفرونت إند
  isSystemOwner: role === 'system_owner',
  isSystemAdmin: role === 'system_admin',
  isOrganizationOwner: role === 'organization_owner',
  
  // التوافق مع النظام القديم
  owner: role === 'owner' || role === 'system_owner',
  individual_admin: role === 'individual_admin' || role === 'system_admin'
};

// إضافة نوع الحساب
if (organizationId) {
  claims.accountType = 'organization';
  claims.organizationId = organizationId;
} else {
  claims.accountType = 'individual';
}
```

### 3. دالة تحديث Claims الموجودة

#### إضافة دالة جديدة في `functions/src/index.ts`:

```typescript
/**
 * دالة لتحديث جميع المستخدمين الموجودين لإضافة الحقول المفقودة
 */
export const updateExistingUsersClaims = functions.https.onCall(async (data, context) => {
  // التحقق من أن المستدعي system_owner
  if (!context.auth || context.auth.token.system_owner !== true) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only system owners can update user claims'
    );
  }

  try {
    console.log('Starting to update existing users claims...');
    
    // جلب جميع المستخدمين
    const listUsersResult = await admin.auth().listUsers();
    const updatePromises = [];
    let updatedCount = 0;

    for (const userRecord of listUsersResult.users) {
      const currentClaims = userRecord.customClaims || {};
      
      // التحقق من وجود الحقول المطلوبة
      const needsUpdate = !currentClaims.hasOwnProperty('isSystemOwner') || 
                         !currentClaims.hasOwnProperty('isSystemAdmin') ||
                         !currentClaims.hasOwnProperty('isOrganizationOwner');
      
      if (needsUpdate) {
        // إنشاء claims محدثة مع الحقول الموحدة
        const updatedClaims = {
          ...currentClaims,
          // إضافة النسخة البديلة إذا لم تكن موجودة
          isSystemOwner: currentClaims.system_owner || false,
          isSystemAdmin: currentClaims.system_admin || false,
          isOrganizationOwner: currentClaims.organization_owner || false,
        };

        updatePromises.push(
          admin.auth().setCustomUserClaims(userRecord.uid, updatedClaims)
            .then(() => {
              console.log(`Updated claims for user: ${userRecord.uid}`);
              updatedCount++;
            })
            .catch(error => {
              console.error(`Failed to update claims for user ${userRecord.uid}:`, error);
            })
        );
      }
    }

    await Promise.all(updatePromises);
    
    console.log(`Successfully updated claims for ${updatedCount} users`);
    
    return { 
      success: true, 
      message: `Updated claims for ${updatedCount} out of ${listUsersResult.users.length} users`,
      totalUsers: listUsersResult.users.length,
      updatedUsers: updatedCount
    };
  } catch (error) {
    console.error('Error updating user claims:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to update user claims: ' + error.message
    );
  }
});
```

### 4. تحديث بيانات Firestore

#### تعديل دالة إنشاء/تحديث المستخدم في Firestore:

```typescript
// في دالة إنشاء/تحديث المستخدم في Firestore
const firestoreUserData = {
  role: role,
  accountType: organizationId ? 'organization' : 'individual',
  
  // إضافة الحقول المطابقة لـ Claims
  system_owner: role === 'system_owner',
  system_admin: role === 'system_admin',
  isSystemOwner: role === 'system_owner',
  isSystemAdmin: role === 'system_admin',
  
  // معلومات إضافية
  email: userRecord.email || '',
  name: userRecord.displayName || '',
  organizationId: organizationId || null,
  disabled: false,
  
  // الطوابع الزمنية
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
};

// حفظ البيانات في Firestore
if (organizationId) {
  // للمؤسسات: حفظ في organizations/{orgId}/members/{uid}
  await admin.firestore()
    .collection('organizations')
    .doc(organizationId)
    .collection('members')
    .doc(userRecord.uid)
    .set(firestoreUserData);
} else {
  // للأفراد: حفظ في users/{uid}
  await admin.firestore()
    .collection('users')
    .doc(userRecord.uid)
    .set(firestoreUserData);
}
```
