/**
 * وظيفة إنشاء مهمة جديدة مرتبطة بنتيجة رئيسية
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createCallableFunction } from '../shared/function-utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { v4 as uuidv4 } from 'uuid';
import { CallableRequest } from '../shared/types';

// الحصول على مرجع قاعدة البيانات
const db = admin.firestore();

/**
 * إنشاء مهمة جديدة مرتبطة بنتيجة رئيسية
 */
export const createTaskForKeyResult = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'createTaskForKeyResult';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لإنشاء مهمة جديدة.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, [
      'taskId',
      'title',
      'keyResultId',
      'objectiveId',
      'impact',
      'organizationId'
    ]);

    const {
      taskId,
      title,
      description,
      dueDate,
      priority,
      assignedToUserId,
      departmentId,
      categoryId,
      keyResultId,
      objectiveId,
      impact,
      notes,
      organizationId
    } = data;

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

    // التحقق من أن النتيجة الرئيسية والهدف تنتميان لنفس المؤسسة
    const keyResultData = keyResultDoc.data();
    const objectiveData = objectiveDoc.data();

    if (!keyResultData || !objectiveData) {
      throw new functions.https.HttpsError(
        'internal',
        'خطأ في قراءة بيانات النتيجة الرئيسية أو الهدف.'
      );
    }

    if (keyResultData.organizationId !== organizationId ||
        objectiveData.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'النتيجة الرئيسية والهدف يجب أن تنتمي لنفس المؤسسة.'
      );
    }

    // الحصول على اسم المستخدم المعين إليه المهمة إذا كان موجودًا
    let assigneeName = null;
    if (assignedToUserId) {
      const assigneeDoc = await db.collection('users').doc(assignedToUserId).get();
      if (assigneeDoc.exists) {
        const assigneeData = assigneeDoc.data();
        if (assigneeData) {
          assigneeName = assigneeData.displayName || assigneeData.email;
        }
      }
    }

    // الحصول على اسم القسم إذا كان موجودًا
    let departmentName = null;
    if (departmentId) {
      const departmentDoc = await db.collection('departments').doc(departmentId).get();
      if (departmentDoc.exists) {
        const departmentData = departmentDoc.data();
        if (departmentData) {
          departmentName = departmentData.name;
        }
      }
    }

    // الحصول على اسم الفئة إذا كانت موجودة
    let categoryName = null;
    if (categoryId) {
      const categoryDoc = await db.collection('taskCategories').doc(categoryId).get();
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        if (categoryData) {
          categoryName = categoryData.name;
        }
      }
    }

    // إنشاء المهمة
    const taskData = {
      id: taskId,
      description: title,
      details: description || '',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
      dueDate: dueDate || null,
      priority: priority || 'medium',
      assignedToUserId: assignedToUserId || null,
      assigneeName: assigneeName,
      departmentId: departmentId || null,
      departmentName: departmentName,
      taskCategoryId: categoryId || null,
      taskCategoryName: categoryName,
      organizationId,
      linkedToOkr: true,
      order: Date.now(), // استخدام الوقت الحالي كترتيب افتراضي
    };

    // إنشاء المهمة في قاعدة البيانات
    await db.collection('tasks').doc(taskId).set(taskData);

    // إنشاء الربط بين المهمة والنتيجة الرئيسية
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

    logFunctionEnd(functionName, { success: true });
    return { success: true };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});
