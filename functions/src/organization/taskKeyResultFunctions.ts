/**
 * وظائف Firebase للتعامل مع ربط المهام بالنتائج الرئيسية
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createCallableFunction } from '../shared/function-utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { AuthInfo, CallableRequest, Task, KeyResult, TaskKeyResultLink } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

// الحصول على مرجع قاعدة البيانات
const db = admin.firestore();

/**
 * الحصول على النتائج الرئيسية غير المرتبطة بمهمة محددة
 */
export const getUnlinkedKeyResults = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getUnlinkedKeyResults';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على النتائج الرئيسية غير المرتبطة.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['taskId', 'organizationId']);

    const { taskId, organizationId } = data;

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
        'ليس لديك صلاحية الوصول إلى هذه المؤسسة.'
      );
    }

    // الحصول على النتائج الرئيسية المرتبطة بالمهمة
    const linkedKeyResultsQuery = await db.collection('taskKeyResultLinks')
      .where('taskId', '==', taskId)
      .get();

    const linkedKeyResultIds = linkedKeyResultsQuery.docs.map(doc => doc.data().keyResultId);

    // الحصول على جميع النتائج الرئيسية النشطة في المؤسسة
    const keyResultsQuery = await db.collection('keyResults')
      .where('organizationId', '==', organizationId)
      .where('status', 'in', ['active', 'at_risk', 'behind'])
      .get();

    // الحصول على الأهداف الاستراتيجية
    const objectivesQuery = await db.collection('objectives')
      .where('organizationId', '==', organizationId)
      .get();

    const objectives = objectivesQuery.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data().title;
      return acc;
    }, {} as Record<string, string>);

    // تصفية النتائج الرئيسية غير المرتبطة
    const unlinkedKeyResults = keyResultsQuery.docs
      .filter(doc => !linkedKeyResultIds.includes(doc.id))
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          objectiveId: data.objectiveId,
          objectiveTitle: objectives[data.objectiveId] || 'هدف غير معروف',
          periodId: data.periodId,
          progress: data.progress,
          status: data.status,
        };
      });

    logFunctionEnd(functionName, { count: unlinkedKeyResults.length });
    return { keyResults: unlinkedKeyResults };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على المهام غير المرتبطة بنتيجة رئيسية محددة
 */
export const getUnlinkedTasks = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getUnlinkedTasks';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على المهام غير المرتبطة.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['keyResultId', 'organizationId']);

    const { keyResultId, organizationId } = data;

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
        'ليس لديك صلاحية الوصول إلى هذه المؤسسة.'
      );
    }

    // الحصول على المهام المرتبطة بالنتيجة الرئيسية
    const linkedTasksQuery = await db.collection('taskKeyResultLinks')
      .where('keyResultId', '==', keyResultId)
      .get();

    const linkedTaskIds = linkedTasksQuery.docs.map(doc => doc.data().taskId);

    // الحصول على جميع المهام النشطة في المؤسسة
    const tasksQuery = await db.collection('tasks')
      .where('organizationId', '==', organizationId)
      .where('status', 'in', ['active', 'in progress', 'pending'])
      .get();

    // تصفية المهام غير المرتبطة
    const unlinkedTasks = tasksQuery.docs
      .filter(doc => !linkedTaskIds.includes(doc.id))
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.description,
          status: data.status,
          dueDate: data.dueDate,
          assignedTo: data.assignedToUserId,
          assigneeName: data.assigneeName,
        };
      });

    logFunctionEnd(functionName, { count: unlinkedTasks.length });
    return { tasks: unlinkedTasks };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * إضافة شارة للمهام المرتبطة بنتائج رئيسية
 */
export const addOkrBadgeToTasks = functions.firestore
  .document('taskKeyResultLinks/{linkId}')
  .onCreate(async (snapshot, context) => {
    const linkData = snapshot.data();
    const taskId = linkData.taskId;

    try {
      // تحديث المهمة لإضافة علامة أنها مرتبطة بـ OKR
      await db.collection('tasks').doc(taskId).update({
        linkedToOkr: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Added OKR badge to task ${taskId}`);
      return { success: true };
    } catch (error) {
      console.error(`Error adding OKR badge to task ${taskId}:`, error);
      throw error;
    }
  });

/**
 * إزالة شارة من المهام غير المرتبطة بنتائج رئيسية
 */
export const removeOkrBadgeFromTasks = functions.firestore
  .document('taskKeyResultLinks/{linkId}')
  .onDelete(async (snapshot, context) => {
    const linkData = snapshot.data();
    const taskId = linkData.taskId;

    try {
      // التحقق مما إذا كانت المهمة مرتبطة بنتائج رئيسية أخرى
      const otherLinksQuery = await db.collection('taskKeyResultLinks')
        .where('taskId', '==', taskId)
        .limit(1)
        .get();

      // إذا لم تكن هناك روابط أخرى، قم بإزالة العلامة
      if (otherLinksQuery.empty) {
        await db.collection('tasks').doc(taskId).update({
          linkedToOkr: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Removed OKR badge from task ${taskId}`);
      } else {
        console.log(`Task ${taskId} still has other OKR links, badge not removed`);
      }

      return { success: true };
    } catch (error) {
      console.error(`Error removing OKR badge from task ${taskId}:`, error);
      throw error;
    }
  });

/**
 * الحصول على المهام المرتبطة بنتيجة رئيسية محددة
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
        'يجب تسجيل الدخول للحصول على المهام المرتبطة.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['keyResultId']);

    const { keyResultId } = data;

    // الحصول على روابط النتيجة الرئيسية بالمهام
    const linksQuery = await db.collection('taskKeyResultLinks')
      .where('keyResultId', '==', keyResultId)
      .get();

    const links = linksQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // إذا لم تكن هناك روابط، أرجع قائمة فارغة
    if (links.length === 0) {
      logFunctionEnd(functionName, { count: 0 });
      return { tasks: [] };
    }

    // الحصول على معرفات المهام
    const taskIds = links.map(link => (link as any).taskId);

    // الحصول على المهام
    const tasksPromises = taskIds.map(id => db.collection('tasks').doc(id).get());
    const tasksSnapshots = await Promise.all(tasksPromises);

    const tasks = tasksSnapshots
      .filter(doc => doc.exists)
      .map(doc => {
        const docData = doc.data();
        if (!docData) return { id: doc.id };

        return {
          id: doc.id,
          title: docData.description,
          status: docData.status,
          dueDate: docData.dueDate,
          assignedTo: docData.assignedToUserId,
          assigneeName: docData.assigneeName,
        };
      });

    logFunctionEnd(functionName, { count: tasks.length });
    return { tasks };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على النتائج الرئيسية المرتبطة بمهمة محددة
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
        'يجب تسجيل الدخول للحصول على النتائج الرئيسية المرتبطة.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['taskId']);

    const { taskId } = data;

    // الحصول على روابط المهمة بالنتائج الرئيسية
    const linksQuery = await db.collection('taskKeyResultLinks')
      .where('taskId', '==', taskId)
      .get();

    const links = linksQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // إذا لم تكن هناك روابط، أرجع قائمة فارغة
    if (links.length === 0) {
      logFunctionEnd(functionName, { count: 0 });
      return { keyResults: [], objectives: [], links: [] };
    }

    // الحصول على معرفات النتائج الرئيسية
    const keyResultIds = links.map(link => (link as any).keyResultId);

    // الحصول على النتائج الرئيسية
    const keyResultsPromises = keyResultIds.map(id => db.collection('keyResults').doc(id).get());
    const keyResultsSnapshots = await Promise.all(keyResultsPromises);

    const keyResults = keyResultsSnapshots
      .filter(doc => doc.exists)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    // الحصول على معرفات الأهداف
    const objectiveIds = [...new Set(keyResults.map(kr => (kr as any).objectiveId))];

    // الحصول على الأهداف
    const objectivesPromises = objectiveIds.map(id => db.collection('objectives').doc(id).get());
    const objectivesSnapshots = await Promise.all(objectivesPromises);

    const objectives = objectivesSnapshots
      .filter(doc => doc.exists)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    logFunctionEnd(functionName, { count: keyResults.length });
    return { keyResults, objectives, links };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

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
    validateInput(data, ['taskId', 'keyResultId', 'objectiveId', 'impact', 'organizationId']);

    const { taskId, keyResultId, objectiveId, impact, notes, organizationId } = data;

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
        'ليس لديك صلاحية الوصول إلى هذه المؤسسة.'
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

    // التحقق من وجود النتيجة الرئيسية
    const keyResultDoc = await db.collection('keyResults').doc(keyResultId).get();
    if (!keyResultDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على النتيجة الرئيسية.'
      );
    }

    // التحقق من وجود الهدف
    const objectiveDoc = await db.collection('objectives').doc(objectiveId).get();
    if (!objectiveDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على الهدف.'
      );
    }

    // التحقق من أن المهمة والنتيجة الرئيسية تنتميان لنفس المؤسسة
    const taskData = taskDoc.data();
    const keyResultData = keyResultDoc.data();
    const objectiveData = objectiveDoc.data();

    if (!taskData || !keyResultData || !objectiveData) {
      throw new functions.https.HttpsError(
        'not-found',
        'بيانات المهمة أو النتيجة الرئيسية أو الهدف غير موجودة.'
      );
    }

    if (taskData.organizationId !== organizationId ||
        keyResultData.organizationId !== organizationId ||
        objectiveData.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'المهمة والنتيجة الرئيسية والهدف يجب أن تنتمي لنفس المؤسسة.'
      );
    }

    // التحقق من عدم وجود ربط سابق
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
    const linkId = uuidv4();
    const linkData = {
      id: linkId,
      taskId,
      keyResultId,
      objectiveId,
      impact,
      notes: notes || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
      organizationId,
    };

    await db.collection('taskKeyResultLinks').doc(linkId).set(linkData);

    // تحديث المهمة لإضافة علامة أنها مرتبطة بـ OKR
    await db.collection('tasks').doc(taskId).update({
      linkedToOkr: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logFunctionEnd(functionName, { id: linkId });
    return { id: linkId };
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
        'not-found',
        'بيانات الربط غير موجودة.'
      );
    }
    const taskId = linkData.taskId;
    const organizationId = linkData.organizationId;

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
        'ليس لديك صلاحية الوصول إلى هذه المؤسسة.'
      );
    }

    // حذف الربط
    await db.collection('taskKeyResultLinks').doc(linkId).delete();

    // التحقق مما إذا كانت المهمة مرتبطة بنتائج رئيسية أخرى
    const otherLinksQuery = await db.collection('taskKeyResultLinks')
      .where('taskId', '==', taskId)
      .limit(1)
      .get();

    // إذا لم تكن هناك روابط أخرى، قم بإزالة العلامة
    if (otherLinksQuery.empty) {
      await db.collection('tasks').doc(taskId).update({
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
