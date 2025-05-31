/**
 * وظائف Firebase لإدارة حسابات المؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from '../shared/utils';
import { createCallableFunction } from '../shared/function-utils';
import { CallableRequest } from '../shared/types';

/**
 * نوع بيانات طلب التحقق من نوع الحساب
 */
interface VerifyAccountTypeRequest {
  // لا توجد بيانات مطلوبة
}

/**
 * التحقق من نوع الحساب (فردي أو مؤسسة)
 */
export const verifyAccountType = createCallableFunction<VerifyAccountTypeRequest>(async (request: CallableRequest<VerifyAccountTypeRequest>) => {
  const { auth } = request;
  const functionName = 'verifyAccountType';
  console.log(`--- ${functionName} Cloud Function triggered ---`);

  try {
    // التحقق من وجود مستخدم مسجل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للتحقق من نوع الحساب.'
      );
    }

    const uid = auth.uid;

    // الحصول على معلومات المستخدم
    const userRecord = await admin.auth().getUser(uid);
    const customClaims = userRecord.customClaims || {};

    // التحقق من نوع الحساب
    const accountType = customClaims.accountType || 'individual';
    const organizationId = customClaims.organizationId || null;

    // إذا كان نوع الحساب مؤسسة، نتحقق من وجود المؤسسة
    let organizationData: any = null;
    if (accountType === 'organization' && organizationId) {
      const orgDoc = await db.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists) {
        const orgData = orgDoc.data();
        if (orgData) {
          organizationData = {
            id: organizationId,
            name: orgData.name || '',
            description: orgData.description || ''
          };
        }
      }
    }

    return {
      accountType,
      organizationId,
      organization: organizationData,
      role: customClaims.role || 'user',
      isAdmin: customClaims.admin || false,
      isOwner: customClaims.owner || false
    };
  } catch (error: any) {
    console.error(`Error in ${functionName}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `Failed to verify account type: ${error.message || 'Unknown error'}`
    );
  }
});

/**
 * نوع بيانات طلب تحديث نوع الحساب
 */
interface UpdateAccountTypeRequest {
  accountType: 'individual' | 'organization';
  organizationId?: string;
}

/**
 * تحديث نوع الحساب (فردي أو مؤسسة)
 */
export const updateAccountType = createCallableFunction<UpdateAccountTypeRequest>(async (request: CallableRequest<UpdateAccountTypeRequest>) => {
  const { data, auth } = request;
  const functionName = 'updateAccountType';
  console.log(`--- ${functionName} Cloud Function triggered ---`);

  try {
    // التحقق من وجود مستخدم مسجل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لتحديث نوع الحساب.'
      );
    }

    const uid = auth.uid;
    const { accountType, organizationId } = data;

    // التحقق من صحة المدخلات
    if (!accountType || (accountType !== 'individual' && accountType !== 'organization')) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير نوع حساب صالح (individual أو organization).'
      );
    }

    if (accountType === 'organization' && !organizationId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير معرف المؤسسة عند تحديث نوع الحساب إلى مؤسسة.'
      );
    }

    // الحصول على معلومات المستخدم
    const userRecord = await admin.auth().getUser(uid);
    const customClaims = userRecord.customClaims || {};

    // تحديث custom claims
    let newClaims: Record<string, any> = {
      ...customClaims,
      accountType
    };

    if (accountType === 'organization') {
      // التحقق من وجود المؤسسة
      const orgDoc = await db.collection('organizations').doc(organizationId!).get();
      if (!orgDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'المؤسسة غير موجودة.'
        );
      }

      // التحقق من أن المستخدم عضو في المؤسسة
      const memberDoc = await db.collection('organizations').doc(organizationId!).collection('members').doc(uid).get();
      if (!memberDoc.exists) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'أنت لست عضوًا في هذه المؤسسة.'
        );
      }

      const memberData = memberDoc.data();
      const role = memberData?.role || 'org_assistant';

      newClaims = {
        ...newClaims,
        organizationId,
        role,
        org_owner: role === 'org_owner',
        org_admin: role === 'org_admin',
        org_supervisor: role === 'org_supervisor',
        org_engineer: role === 'org_engineer',
        org_technician: role === 'org_technician',
        org_assistant: role === 'org_assistant'
      };
    } else {
      // إذا كان نوع الحساب فردي، نزيل معلومات المؤسسة
      delete newClaims.organizationId;
      delete newClaims.role;
      delete newClaims.admin;
      delete newClaims.owner;
    }

    // تحديث custom claims
    await admin.auth().setCustomUserClaims(uid, newClaims);

    return {
      success: true,
      accountType,
      organizationId: accountType === 'organization' ? organizationId : null
    };
  } catch (error: any) {
    console.error(`Error in ${functionName}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `Failed to update account type: ${error.message || 'Unknown error'}`
    );
  }
});
