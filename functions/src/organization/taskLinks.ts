/**
 * وظائف Firebase لربط المهام بالنتائج الرئيسية في نظام OKRs
 *
 * هذا الملف يحتوي على وظائف Firebase للتعامل مع ربط المهام بالنتائج الرئيسية
 * في نظام التخطيط السنوي (OKRs) للمؤسسات.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createCallableFunction } from '../shared/function-utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { AuthInfo, CallableRequest, Task, KeyResult, TaskKeyResultLink } from '../shared/types';

// الحصول على مرجع قاعدة البيانات
const db = admin.firestore();

/**
 * ربط مهمة بنتيجة رئيسية
 */
export const linkTaskToKeyResult = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'linkTaskToKeyResult';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لربط مهمة بنتيجة رئيسية.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['taskId', 'keyResultId', 'objectiveId', 'organizationId']);

    const { taskId, keyResultId, objectiveId, impact, notes, organizationId, departmentId } = data;

    // التحقق من صلاحيات المستخدم
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على المستخدم.'
      );
    }

    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية ربط مهمة بنتيجة رئيسية في هذه المؤسسة.'
      );
    }

    // التحقق من وجود المهمة
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على المهمة.'
      );
    }

    const taskData = taskDoc.data();
    if (!taskData || taskData.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'المهمة لا تنتمي إلى هذه المؤسسة.'
      );
    }

    // التحقق من وجود النتيجة الرئيسية
    const keyResultDoc = await db.collection('keyResults').doc(keyResultId).get();
    if (!keyResultDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على النتيجة الرئيسية.'
      );
    }

    const keyResultData = keyResultDoc.data();
    if (!keyResultData || keyResultData.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'النتيجة الرئيسية لا تنتمي إلى هذه المؤسسة.'
      );
    }

    // التحقق من وجود الهدف الاستراتيجي
    const objectiveDoc = await db.collection('objectives').doc(objectiveId).get();
    if (!objectiveDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على الهدف الاستراتيجي.'
      );
    }

    const objectiveData = objectiveDoc.data();
    if (!objectiveData || objectiveData.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'الهدف الاستراتيجي لا ينتمي إلى هذه المؤسسة.'
      );
    }

    // التحقق من عدم وجود ربط مسبق
    const existingLinkQuery = await db.collection('taskKeyResultLinks')
      .where('taskId', '==', taskId)
      .where('keyResultId', '==', keyResultId)
      .limit(1)
      .get();

    if (!existingLinkQuery.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        'المهمة مرتبطة بالفعل بهذه النتيجة الرئيسية.'
      );
    }

    // إنشاء الربط
    const linkData = {
      taskId,
      keyResultId,
      objectiveId,
      impact: impact || 'medium',
      notes: notes || '',
      organizationId,
      departmentId: departmentId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await db.collection('taskKeyResultLinks').add(linkData);

    // تحديث المهمة لتشير إلى أنها مرتبطة بـ OKR
    await db.collection('tasks').doc(taskId).update({
      linkedToOkr: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logFunctionEnd(functionName, { id: docRef.id });
    return { id: docRef.id };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * إلغاء ربط مهمة بنتيجة رئيسية
 */
export const unlinkTaskFromKeyResult = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'unlinkTaskFromKeyResult';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لإلغاء ربط مهمة بنتيجة رئيسية.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['linkId']);

    const { linkId } = data;

    // الحصول على الربط
    const linkDoc = await db.collection('taskKeyResultLinks').doc(linkId).get();
    if (!linkDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على الربط.'
      );
    }

    const linkData = linkDoc.data();
    if (!linkData) {
      throw new functions.https.HttpsError(
        'internal',
        'خطأ في قراءة بيانات الربط.'
      );
    }

    // التحقق من صلاحيات المستخدم
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على المستخدم.'
      );
    }

    const userData = userDoc.data();
    if (!userData || userData.organizationId !== linkData.organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية إلغاء هذا الربط.'
      );
    }

    // حذف الربط
    await db.collection('taskKeyResultLinks').doc(linkId).delete();

    // التحقق مما إذا كانت المهمة مرتبطة بنتائج رئيسية أخرى
    const otherLinksQuery = await db.collection('taskKeyResultLinks')
      .where('taskId', '==', linkData.taskId)
      .limit(1)
      .get();

    // إذا لم تكن هناك روابط أخرى، قم بتحديث المهمة
    if (otherLinksQuery.empty) {
      await db.collection('tasks').doc(linkData.taskId).update({
        linkedToOkr: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    logFunctionEnd(functionName, { success: true });
    return { success: true };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على المهام المرتبطة بنتيجة رئيسية
 */
export const getTasksForKeyResult = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getTasksForKeyResult';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على المهام المرتبطة بنتيجة رئيسية.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['keyResultId']);

    const { keyResultId } = data;

    // الحصول على النتيجة الرئيسية
    const keyResultDoc = await db.collection('keyResults').doc(keyResultId).get();
    if (!keyResultDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على النتيجة الرئيسية.'
      );
    }

    const keyResultData = keyResultDoc.data();
    if (!keyResultData) {
      throw new functions.https.HttpsError(
        'internal',
        'خطأ في قراءة بيانات النتيجة الرئيسية.'
      );
    }

    // التحقق من صلاحيات المستخدم
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على المستخدم.'
      );
    }

    const userData = userDoc.data();
    if (!userData || userData.organizationId !== keyResultData.organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية الوصول إلى المهام المرتبطة بهذه النتيجة الرئيسية.'
      );
    }

    // الحصول على روابط المهام
    const linksSnapshot = await db.collection('taskKeyResultLinks')
      .where('keyResultId', '==', keyResultId)
      .get();

    // إذا لم تكن هناك روابط، أعد قائمة فارغة
    if (linksSnapshot.empty) {
      logFunctionEnd(functionName, { count: 0 });
      return { tasks: [], links: [] };
    }

    // استخراج معرفات المهام وبيانات الروابط
    const taskIds = linksSnapshot.docs.map(doc => doc.data().taskId);
    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // الحصول على بيانات المهام
    const tasks: Array<{id: string; [key: string]: any}> = [];
    for (const taskId of taskIds) {
      const taskDoc = await db.collection('tasks').doc(taskId).get();
      if (taskDoc.exists) {
        tasks.push({
          id: taskDoc.id,
          ...taskDoc.data(),
        });
      }
    }

    logFunctionEnd(functionName, { count: tasks.length });
    return { tasks, links };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على النتائج الرئيسية المرتبطة بمهمة
 */
export const getKeyResultsForTask = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getKeyResultsForTask';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على النتائج الرئيسية المرتبطة بمهمة.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['taskId']);

    const { taskId } = data;

    // الحصول على المهمة
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على المهمة.'
      );
    }

    const taskData = taskDoc.data();
    if (!taskData) {
      throw new functions.https.HttpsError(
        'internal',
        'خطأ في قراءة بيانات المهمة.'
      );
    }

    // التحقق من صلاحيات المستخدم
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على المستخدم.'
      );
    }

    const userData = userDoc.data();
    if (!userData || userData.organizationId !== taskData.organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية الوصول إلى النتائج الرئيسية المرتبطة بهذه المهمة.'
      );
    }

    // الحصول على روابط النتائج الرئيسية
    const linksSnapshot = await db.collection('taskKeyResultLinks')
      .where('taskId', '==', taskId)
      .get();

    // إذا لم تكن هناك روابط، أعد قائمة فارغة
    if (linksSnapshot.empty) {
      logFunctionEnd(functionName, { count: 0 });
      return { keyResults: [], objectives: [], links: [] };
    }

    // استخراج معرفات النتائج الرئيسية والأهداف وبيانات الروابط
    const keyResultIds = linksSnapshot.docs.map(doc => doc.data().keyResultId);
    const objectiveIds = linksSnapshot.docs.map(doc => doc.data().objectiveId);
    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // الحصول على بيانات النتائج الرئيسية
    const keyResults: Array<{id: string; [key: string]: any}> = [];
    for (const keyResultId of keyResultIds) {
      const keyResultDoc = await db.collection('keyResults').doc(keyResultId).get();
      if (keyResultDoc.exists) {
        keyResults.push({
          id: keyResultDoc.id,
          ...keyResultDoc.data(),
        });
      }
    }

    // الحصول على بيانات الأهداف
    const objectives: Array<{id: string; [key: string]: any}> = [];
    const uniqueObjectiveIds = [...new Set(objectiveIds)];
    for (const objectiveId of uniqueObjectiveIds) {
      const objectiveDoc = await db.collection('objectives').doc(objectiveId).get();
      if (objectiveDoc.exists) {
        objectives.push({
          id: objectiveDoc.id,
          ...objectiveDoc.data(),
        });
      }
    }

    logFunctionEnd(functionName, { count: keyResults.length });
    return { keyResults, objectives, links };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});
