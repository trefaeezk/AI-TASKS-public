/**
 * دوال حذف المستخدمين بشكل شامل
 * تدعم حذف المستخدمين الأفراد والتنظيميين مع جميع بياناتهم المرتبطة
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './shared/utils';
import { ensureSystemAdmin } from './shared/permissions';
import { createCallableFunction } from './shared/function-utils';

/**
 * واجهة طلب حذف المستخدم
 */
interface DeleteUserRequest {
  userId: string;
  forceDelete?: boolean; // حذف قسري حتى لو كان المستخدم مالك مؤسسة
}

/**
 * واجهة نتيجة عملية الحذف
 */
interface DeleteUserResult {
  success: boolean;
  deletedData: {
    userAccount: boolean;
    userData: boolean;
    individualData: boolean;
    organizationMemberships: number;
    tasks: number;
    meetings: number;
    objectives: number;
    keyResults: number;
    reports: number;
  };
  warnings?: string[];
  error?: string;
}

/**
 * دالة حذف المستخدم بشكل شامل
 * تحذف المستخدم من Firebase Auth وجميع بياناته من Firestore
 */
export const deleteUserCompletely = createCallableFunction<DeleteUserRequest>(async (request) => {
    const functionName = 'deleteUserCompletely';
    console.log(`🚀 --- ${functionName} Cloud Function triggered ---`);
    console.log(`🚀 ${functionName} called with data:`, request.data);

    try {
      // التحقق من المصادقة والصلاحيات
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'يجب تسجيل الدخول لاستخدام هذه الوظيفة.'
        );
      }

      // تحويل request إلى context للتوافق مع ensureSystemAdmin
      const context = {
        auth: request.auth,
        rawRequest: request.rawRequest
      };

      // التحقق من صلاحيات النظام
      await ensureSystemAdmin(context);

      const { userId, forceDelete = false } = request.data;

      if (!userId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'معرف المستخدم مطلوب.'
        );
        }

      // منع المستخدم من حذف نفسه
      if (request.auth.uid === userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'لا يمكنك حذف حسابك الخاص.'
        );
      }

      console.log(`[${functionName}] بدء عملية حذف المستخدم: ${userId}`);

      // التحقق من وجود المستخدم في Firebase Auth
      let userRecord: admin.auth.UserRecord | undefined;
      try {
        userRecord = await admin.auth().getUser(userId);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.log(`[${functionName}] المستخدم غير موجود في Firebase Auth، سيتم حذف البيانات من Firestore فقط`);
        } else {
          throw new functions.https.HttpsError(
            'internal',
            `خطأ في الوصول لبيانات المستخدم: ${error.message}`
          );
        }
      }

      // الحصول على بيانات المستخدم من Firestore
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;

      // التحقق من نوع الحساب
      const accountType = userData?.accountType || 'individual';
      const organizationId = userData?.organizationId;

      console.log(`[${functionName}] نوع الحساب: ${accountType}`);

      // التحقق من القيود قبل الحذف
      const warnings: string[] = [];
      
      if (accountType === 'organization' && organizationId && !forceDelete) {
        // التحقق من أن المستخدم ليس مالك المؤسسة الوحيد
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        if (orgDoc.exists) {
          const orgData = orgDoc.data();
          if (orgData?.ownerId === userId) {
            // البحث عن مالكين ومدراء آخرين
            const ownersSnapshot = await db.collection('organizations')
              .doc(organizationId)
              .collection('members')
              .where('role', '==', 'isOrgOwner')
              .get();

            const adminsSnapshot = await db.collection('organizations')
              .doc(organizationId)
              .collection('members')
              .where('role', '==', 'isOrgAdmin')
              .get();

            // عدد المالكين الآخرين (غير المستخدم الحالي)
            const otherOwners = ownersSnapshot.docs.filter(doc => doc.id !== userId).length;
            const totalAdmins = adminsSnapshot.size;

            if (otherOwners === 0 && totalAdmins === 0) {
              throw new functions.https.HttpsError(
                'failed-precondition',
                'لا يمكن حذف مالك المؤسسة الوحيد. قم بتعيين مالك أو مدير آخر أولاً أو استخدم forceDelete.'
              );
            }
          }
        }
      }

      // بدء عملية الحذف
      const deletedData = {
        userAccount: false,
        userData: false,
        individualData: false,
        organizationMemberships: 0,
        tasks: 0,
        meetings: 0,
        objectives: 0,
        keyResults: 0,
        reports: 0
      };

      // 1. حذف المهام المرتبطة بالمستخدم
      console.log(`[${functionName}] حذف المهام...`);
      const tasksQuery = await db.collection('tasks')
        .where('userId', '==', userId)
        .get();
      
      const assignedTasksQuery = await db.collection('tasks')
        .where('assignedToUserId', '==', userId)
        .get();

      const createdTasksQuery = await db.collection('tasks')
        .where('createdBy', '==', userId)
        .get();

      // دمج جميع المهام وحذفها
      const allTaskIds = new Set<string>();
      tasksQuery.docs.forEach(doc => allTaskIds.add(doc.id));
      assignedTasksQuery.docs.forEach(doc => allTaskIds.add(doc.id));
      createdTasksQuery.docs.forEach(doc => allTaskIds.add(doc.id));

      if (allTaskIds.size > 0) {
        const batch = db.batch();
        allTaskIds.forEach(taskId => {
          batch.delete(db.collection('tasks').doc(taskId));
        });
        await batch.commit();
        deletedData.tasks = allTaskIds.size;
        console.log(`[${functionName}] تم حذف ${allTaskIds.size} مهمة`);
      }

      // 2. حذف الاجتماعات المرتبطة بالمستخدم
      console.log(`[${functionName}] حذف الاجتماعات...`);
      const meetingsQuery = await db.collection('meetings')
        .where('createdBy', '==', userId)
        .get();

      if (meetingsQuery.size > 0) {
        const batch = db.batch();
        meetingsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        deletedData.meetings = meetingsQuery.size;
        console.log(`[${functionName}] تم حذف ${meetingsQuery.size} اجتماع`);
      }

      // إزالة المستخدم من الاجتماعات كمشارك
      const allMeetingsQuery = await db.collection('meetings').get();
      let updatedMeetingsCount = 0;

      if (allMeetingsQuery.size > 0) {
        const batch = db.batch();
        allMeetingsQuery.docs.forEach(doc => {
          const data = doc.data();
          if (data.participants && Array.isArray(data.participants)) {
            const originalCount = data.participants.length;
            const updatedParticipants = data.participants.filter((p: any) => p.userId !== userId);

            if (updatedParticipants.length < originalCount) {
              batch.update(doc.ref, {
                participants: updatedParticipants,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              updatedMeetingsCount++;
            }
          }
        });

        if (updatedMeetingsCount > 0) {
          await batch.commit();
          console.log(`[${functionName}] تم إزالة المستخدم من ${updatedMeetingsCount} اجتماع كمشارك`);
        }
      }

      // 3. حذف الأهداف والنتائج الرئيسية
      console.log(`[${functionName}] حذف الأهداف والنتائج الرئيسية...`);

      // حذف الأهداف
      const objectivesQuery = await db.collection('objectives')
        .where('createdBy', '==', userId)
        .get();

      const assignedObjectivesQuery = await db.collection('objectives')
        .where('assignedTo', '==', userId)
        .get();

      // دمج الأهداف المنشأة والمعينة
      const allObjectiveIds = new Set<string>();
      objectivesQuery.docs.forEach(doc => allObjectiveIds.add(doc.id));
      assignedObjectivesQuery.docs.forEach(doc => allObjectiveIds.add(doc.id));

      if (allObjectiveIds.size > 0) {
        const batch = db.batch();
        allObjectiveIds.forEach(objectiveId => {
          batch.delete(db.collection('objectives').doc(objectiveId));
        });
        await batch.commit();
        deletedData.objectives = allObjectiveIds.size;
        console.log(`[${functionName}] تم حذف ${allObjectiveIds.size} هدف`);
      }

      // حذف النتائج الرئيسية
      const keyResultsQuery = await db.collection('keyResults')
        .where('createdBy', '==', userId)
        .get();

      const assignedKeyResultsQuery = await db.collection('keyResults')
        .where('assignedTo', '==', userId)
        .get();

      // دمج النتائج المنشأة والمعينة
      const allKeyResultIds = new Set<string>();
      keyResultsQuery.docs.forEach(doc => allKeyResultIds.add(doc.id));
      assignedKeyResultsQuery.docs.forEach(doc => allKeyResultIds.add(doc.id));

      if (allKeyResultIds.size > 0) {
        const batch = db.batch();
        allKeyResultIds.forEach(keyResultId => {
          batch.delete(db.collection('keyResults').doc(keyResultId));
        });
        await batch.commit();
        deletedData.keyResults = allKeyResultIds.size;
        console.log(`[${functionName}] تم حذف ${allKeyResultIds.size} نتيجة رئيسية`);
      }

      // حذف روابط المهام والنتائج الرئيسية
      const taskKeyResultLinksQuery = await db.collection('taskKeyResultLinks')
        .where('createdBy', '==', userId)
        .get();

      if (taskKeyResultLinksQuery.size > 0) {
        const batch = db.batch();
        taskKeyResultLinksQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[${functionName}] تم حذف ${taskKeyResultLinksQuery.size} رابط مهمة-نتيجة رئيسية`);
      }

      // 4. حذف البيانات الإضافية
      console.log(`[${functionName}] حذف البيانات الإضافية...`);

      // حذف فئات المهام المنشأة من قبل المستخدم
      const taskCategoriesQuery = await db.collection('taskCategories')
        .where('createdBy', '==', userId)
        .get();

      if (taskCategoriesQuery.size > 0) {
        const batch = db.batch();
        taskCategoriesQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[${functionName}] تم حذف ${taskCategoriesQuery.size} فئة مهام`);
      }

      // حذف الإشعارات المرتبطة بالمستخدم
      const notificationsQuery = await db.collection('notifications')
        .where('userId', '==', userId)
        .get();

      if (notificationsQuery.size > 0) {
        const batch = db.batch();
        notificationsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[${functionName}] تم حذف ${notificationsQuery.size} إشعار`);
      }

      // حذف رموز OTP المرتبطة بالمستخدم
      const otpQuery = await db.collection('debugOTP')
        .where('userId', '==', userId)
        .get();

      if (otpQuery.size > 0) {
        const batch = db.batch();
        otpQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[${functionName}] تم حذف ${otpQuery.size} رمز OTP`);
      }

      // 5. حذف البيانات حسب نوع الحساب
      if (accountType === 'individual') {
        await deleteIndividualUserDataInternal(userId, deletedData);
      } else {
        await deleteOrganizationUserData(userId, organizationId!, deletedData);
      }

      // 6. حذف بيانات المستخدم الأساسية من مجموعة users
      if (userDoc.exists) {
        await db.collection('users').doc(userId).delete();
        deletedData.userData = true;
        console.log(`[${functionName}] تم حذف بيانات المستخدم من مجموعة users`);
      }

      // 7. حذف المستخدم من Firebase Auth
      if (userRecord) {
        await admin.auth().deleteUser(userId);
        deletedData.userAccount = true;
        console.log(`[${functionName}] تم حذف حساب المستخدم من Firebase Auth`);
      }

      console.log(`[${functionName}] ✅ تم حذف المستخدم ${userId} بنجاح`);

      return {
        success: true,
        deletedData,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error: any) {
      console.error(`[${functionName}] خطأ في حذف المستخدم:`, error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        `فشل في حذف المستخدم: ${error.message}`
      );
    }
  });

/**
 * حذف بيانات المستخدم الفردي (دالة محلية)
 */
async function deleteIndividualUserDataInternal(userId: string, deletedData: any): Promise<void> {
  console.log(`حذف بيانات المستخدم الفردي: ${userId}`);

  // حذف وثيقة المستخدم من مجموعة individuals
  const individualDoc = await db.collection('individuals').doc(userId).get();
  if (individualDoc.exists) {
    await db.collection('individuals').doc(userId).delete();
    deletedData.individualData = true;
    console.log(`تم حذف بيانات المستخدم من مجموعة individuals`);
  }

  // حذف المهام الفرعية (النظام القديم)
  const tasksSnapshot = await db.collection('individuals').doc(userId).collection('tasks').get();
  if (tasksSnapshot.size > 0) {
    const batch = db.batch();
    tasksSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`تم حذف ${tasksSnapshot.size} مهمة فرعية`);
  }

  // حذف التقارير الفرعية (النظام القديم)
  const reportsSnapshot = await db.collection('individuals').doc(userId).collection('reports').get();
  if (reportsSnapshot.size > 0) {
    const batch = db.batch();
    reportsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    deletedData.reports = reportsSnapshot.size;
    console.log(`تم حذف ${reportsSnapshot.size} تقرير فرعي`);
  }
}

/**
 * حذف بيانات المستخدم التنظيمي
 */
async function deleteOrganizationUserData(userId: string, organizationId: string, deletedData: any): Promise<void> {
  console.log(`حذف بيانات المستخدم التنظيمي: ${userId} من المؤسسة: ${organizationId}`);

  // حذف عضوية المستخدم من المؤسسة
  const memberDoc = await db.collection('organizations').doc(organizationId).collection('members').doc(userId).get();
  if (memberDoc.exists) {
    await db.collection('organizations').doc(organizationId).collection('members').doc(userId).delete();
    deletedData.organizationMemberships = 1;
    console.log(`تم حذف عضوية المستخدم من المؤسسة`);
  }

  // البحث عن عضويات في مؤسسات أخرى وحذفها
  const allOrgsSnapshot = await db.collection('organizations').get();
  let additionalMemberships = 0;

  for (const orgDoc of allOrgsSnapshot.docs) {
    if (orgDoc.id !== organizationId) {
      const memberInOtherOrg = await orgDoc.ref.collection('members').doc(userId).get();
      if (memberInOtherOrg.exists) {
        await memberInOtherOrg.ref.delete();
        additionalMemberships++;
      }
    }
  }

  if (additionalMemberships > 0) {
    deletedData.organizationMemberships += additionalMemberships;
    console.log(`تم حذف ${additionalMemberships} عضوية إضافية من مؤسسات أخرى`);
  }
}
