/**
 * وظائف ترحيل المؤسسات إلى نظام الأدوار الجديد
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './shared/utils';
import { createCallableFunction } from './shared/function-utils';

// تعريف الأدوار الجديدة
type NewUserRole =
  | 'system_owner'
  | 'system_admin'
  | 'independent'
  | 'organization_owner'
  | 'admin'
  | 'supervisor'
  | 'engineer'
  | 'technician'
  | 'assistant';

// تعريف الأدوار القديمة
type OldUserRole = 'owner' | 'admin' | 'user' | 'individual_admin';

/**
 * تحويل الأدوار القديمة إلى الأدوار الجديدة
 */
function convertOldRoleToNew(oldRole: string, isOwner?: boolean, isAdmin?: boolean, accountType?: string): NewUserRole {
  // إذا كان مالك النظام
  if (isOwner && accountType !== 'organization') {
    return 'system_owner';
  }

  // إذا كان أدمن النظام
  if (isAdmin && accountType !== 'organization') {
    return 'system_admin';
  }

  // إذا كان مالك مؤسسة
  if (isOwner && accountType === 'organization') {
    return 'organization_owner';
  }

  // إذا كان أدمن مؤسسة
  if (isAdmin && accountType === 'organization') {
    return 'admin';
  }

  // تحويل الأدوار القديمة
  switch (oldRole) {
    case 'owner':
      return 'system_owner';
    case 'admin':
      return accountType === 'organization' ? 'admin' : 'system_admin';
    case 'individual_admin':
      return 'system_admin';
    case 'user':
      return accountType === 'organization' ? 'assistant' : 'independent';
    default:
      return accountType === 'organization' ? 'assistant' : 'independent';
  }
}

/**
 * دالة مساعدة لترحيل مؤسسة واحدة
 */
async function migrateOrganizationInternal(organizationId: string, authUid: string) {
  const functionName = 'migrateOrganizationInternal';
  console.log(`[${functionName}] Starting migration for organization: ${organizationId}`);

  // الحصول على معلومات المؤسسة
  const orgDoc = await db.collection('organizations').doc(organizationId).get();
  if (!orgDoc.exists) {
    throw new Error('المؤسسة غير موجودة');
  }

  const orgData = orgDoc.data()!;
  console.log(`[${functionName}] Found organization: ${orgData.name}`);

  // الحصول على جميع أعضاء المؤسسة
  const membersSnapshot = await db.collection('organizations').doc(organizationId).collection('members').get();
  const migratedMembers: any[] = [];

  for (const memberDoc of membersSnapshot.docs) {
    const memberData = memberDoc.data();
    const userId = memberDoc.id;

    try {
      // الحصول على معلومات المستخدم من Firebase Auth
      const userRecord = await admin.auth().getUser(userId);
      const currentClaims = userRecord.customClaims || {};

      // تحديد الدور الجديد
      const oldRole = currentClaims.role || memberData.role || 'user';
      const isOwner = currentClaims.owner === true || memberData.isOwner === true || orgData.ownerId === userId;
      const isAdmin = currentClaims.admin === true || memberData.isAdmin === true || memberData.role === 'admin';

      const newRole = convertOldRoleToNew(oldRole, isOwner, isAdmin, 'organization');

      console.log(`[${functionName}] Migrating user ${userId}: ${oldRole} -> ${newRole}`);

      // تحديث Custom Claims
      const newClaims: Record<string, any> = {
        ...currentClaims,
        role: newRole,
        accountType: 'organization',
        organizationId: organizationId
      };

      // إضافة الخصائص الجديدة حسب الدور
      if (newRole === 'organization_owner') {
        newClaims.organization_owner = true;
      } else if (newRole === 'admin') {
        newClaims.admin = true;
      }

      // إزالة الخصائص القديمة
      delete newClaims.owner;
      delete newClaims.individual_admin;

      // تنظيف الخصائص غير المحددة
      Object.keys(newClaims).forEach(key => {
        if (newClaims[key] === undefined) {
          delete newClaims[key];
        }
      });

      await admin.auth().setCustomUserClaims(userId, newClaims);

      // تحديث وثيقة المستخدم في Firestore
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      const userData = {
        role: newRole,
        accountType: 'organization',
        organizationId: organizationId,
        email: userRecord.email || '',
        name: userRecord.displayName || memberData.name || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (userDoc.exists) {
        await userDocRef.update(userData);
      } else {
        await userDocRef.set({
          ...userData,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // تحديث وثيقة العضو في المؤسسة
      await db.collection('organizations').doc(organizationId).collection('members').doc(userId).update({
        role: newRole,
        isOwner: newRole === 'organization_owner',
        isAdmin: newRole === 'admin' || newRole === 'organization_owner',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      migratedMembers.push({
        userId,
        oldRole,
        newRole,
        email: userRecord.email
      });

    } catch (error) {
      console.error(`[${functionName}] Error migrating user ${userId}:`, error);
      // نستمر مع باقي المستخدمين حتى لو فشل أحدهم
    }
  }

  // تحديث وثيقة المؤسسة لتشير إلى أنها تم ترحيلها
  await db.collection('organizations').doc(organizationId).update({
    migratedToNewRoleSystem: true,
    migrationDate: admin.firestore.FieldValue.serverTimestamp(),
    migratedBy: authUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`[${functionName}] Successfully migrated ${migratedMembers.length} members`);

  return {
    success: true,
    organizationId,
    migratedMembers,
    totalMigrated: migratedMembers.length
  };
}

/**
 * ترحيل مؤسسة واحدة إلى النظام الجديد
 */
export const migrateOrganizationToNewRoleSystem = createCallableFunction<{ organizationId: string }>(async (request) => {
  try {
    // التحقق من الصلاحيات - يجب أن يكون المستخدم مالك النظام
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }

    const userRecord = await admin.auth().getUser(request.auth.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.system_owner && !customClaims.owner && customClaims.role !== 'system_owner') {
      throw new functions.https.HttpsError('permission-denied', 'يجب أن تكون مالك النظام لتنفيذ هذه العملية');
    }

    const { organizationId } = request.data;

    // استدعاء الدالة المساعدة
    const result = await migrateOrganizationInternal(organizationId, request.auth.uid);

    return result;

  } catch (error: any) {
    console.error('migrateOrganizationToNewRoleSystem Error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', `خطأ في ترحيل المؤسسة: ${error.message}`);
  }
});

/**
 * ترحيل جميع المؤسسات إلى النظام الجديد
 */
export const migrateAllOrganizationsToNewRoleSystem = createCallableFunction<{}>(async (request) => {
  const functionName = 'migrateAllOrganizationsToNewRoleSystem';
  console.log(`[${functionName}] Starting migration for all organizations`);

  try {
    // التحقق من الصلاحيات - يجب أن يكون المستخدم مالك النظام
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }

    const userRecord = await admin.auth().getUser(request.auth.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.system_owner && !customClaims.owner && customClaims.role !== 'system_owner') {
      throw new functions.https.HttpsError('permission-denied', 'يجب أن تكون مالك النظام لتنفيذ هذه العملية');
    }

    // الحصول على جميع المؤسسات
    const organizationsSnapshot = await db.collection('organizations').get();
    const results: any[] = [];

    for (const orgDoc of organizationsSnapshot.docs) {
      const orgData = orgDoc.data();

      // تخطي المؤسسات التي تم ترحيلها بالفعل
      if (orgData.migratedToNewRoleSystem) {
        console.log(`[${functionName}] Skipping already migrated organization: ${orgDoc.id}`);
        continue;
      }

      try {
        // استدعاء الدالة المساعدة مباشرة
        const migrationResult = await migrateOrganizationInternal(orgDoc.id, request.auth.uid);

        results.push({
          organizationId: orgDoc.id,
          organizationName: orgData.name,
          success: true,
          migratedMembers: migrationResult.totalMigrated || 0
        });

      } catch (error: any) {
        console.error(`[${functionName}] Error migrating organization ${orgDoc.id}:`, error);
        results.push({
          organizationId: orgDoc.id,
          organizationName: orgData.name,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`[${functionName}] Migration completed. Results:`, results);

    return {
      success: true,
      totalOrganizations: organizationsSnapshot.size,
      results
    };

  } catch (error: any) {
    console.error(`[${functionName}] Error:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', `خطأ في ترحيل المؤسسات: ${error.message}`);
  }
});

/**
 * التحقق من حالة الترحيل للمؤسسات
 */
export const checkMigrationStatus = createCallableFunction<{}>(async (request) => {
  const functionName = 'checkMigrationStatus';

  try {
    // التحقق من الصلاحيات
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }

    const userRecord = await admin.auth().getUser(request.auth.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.system_owner && !customClaims.owner && customClaims.role !== 'system_owner') {
      throw new functions.https.HttpsError('permission-denied', 'يجب أن تكون مالك النظام لعرض هذه المعلومات');
    }

    // الحصول على جميع المؤسسات
    const organizationsSnapshot = await db.collection('organizations').get();
    const organizations: any[] = [];

    for (const orgDoc of organizationsSnapshot.docs) {
      const orgData = orgDoc.data();

      // عد الأعضاء
      const membersSnapshot = await db.collection('organizations').doc(orgDoc.id).collection('members').get();

      organizations.push({
        id: orgDoc.id,
        name: orgData.name,
        migrated: orgData.migratedToNewRoleSystem === true,
        migrationDate: orgData.migrationDate,
        migratedBy: orgData.migratedBy,
        membersCount: membersSnapshot.size,
        ownerId: orgData.ownerId
      });
    }

    const migratedCount = organizations.filter(org => org.migrated).length;
    const notMigratedCount = organizations.filter(org => !org.migrated).length;

    return {
      success: true,
      totalOrganizations: organizations.length,
      migratedCount,
      notMigratedCount,
      organizations
    };

  } catch (error: any) {
    console.error(`[${functionName}] Error:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', `خطأ في التحقق من حالة الترحيل: ${error.message}`);
  }
});
