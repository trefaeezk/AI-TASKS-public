/**
 * وظائف Firebase للنتائج الرئيسية (Key Results) في نظام OKRs
 *
 * هذا الملف يحتوي على وظائف Firebase للتعامل مع النتائج الرئيسية وتحديثاتها
 * في نظام التخطيط السنوي (OKRs) للمؤسسات.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createCallableFunction } from '../shared/function-utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { CallableRequest } from '../shared/types';

// الحصول على مرجع قاعدة البيانات
const db = admin.firestore();

/**
 * إنشاء نتيجة رئيسية جديدة
 */
export const createKeyResult = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'createKeyResult';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لإنشاء نتيجة رئيسية.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, [
      'objectiveId',
      'title',
      'type',
      'startValue',
      'targetValue',
      'currentValue',
      'dueDate',
      'ownerId',
      'ownerName',
      'organizationId'
    ]);

    const {
      objectiveId,
      title,
      description,
      type,
      startValue,
      targetValue,
      currentValue,
      unit,
      dueDate,
      ownerId,
      ownerName,
      organizationId,
      departmentId
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
        'ليس لديك صلاحية إنشاء نتيجة رئيسية لهذه المؤسسة.'
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

    // حساب التقدم الأولي
    const range = targetValue - startValue;
    const progress = range !== 0
      ? Math.min(100, Math.max(0, ((currentValue - startValue) / range) * 100))
      : (currentValue >= targetValue ? 100 : 0);

    // إنشاء نتيجة رئيسية جديدة
    const keyResultData = {
      objectiveId,
      title,
      description: description || '',
      type,
      startValue: Number(startValue),
      targetValue: Number(targetValue),
      currentValue: Number(currentValue),
      unit: unit || '',
      progress,
      status: 'active',
      dueDate: admin.firestore.Timestamp.fromDate(new Date(dueDate)),
      ownerId,
      ownerName,
      organizationId,
      departmentId: departmentId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await db.collection('keyResults').add(keyResultData);

    // إنشاء تحديث أولي للنتيجة الرئيسية
    const updateData = {
      keyResultId: docRef.id,
      previousValue: startValue,
      newValue: currentValue,
      notes: 'القيمة الأولية',
      date: admin.firestore.FieldValue.serverTimestamp(),
      userId,
      userName: userData.displayName || userData.email || '',
      organizationId,
      departmentId: departmentId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('keyResultUpdates').add(updateData);

    // تحديث تقدم الهدف الاستراتيجي
    await updateObjectiveProgress(objectiveId);

    logFunctionEnd(functionName, { id: docRef.id });
    return { id: docRef.id };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على النتائج الرئيسية لهدف استراتيجي
 */
export const getKeyResultsByObjective = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getKeyResultsByObjective';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على النتائج الرئيسية.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['objectiveId']);

    const { objectiveId } = data;

    // الحصول على الهدف الاستراتيجي
    const objectiveDoc = await db.collection('objectives').doc(objectiveId).get();
    if (!objectiveDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على الهدف الاستراتيجي.'
      );
    }

    const objectiveData = objectiveDoc.data();
    if (!objectiveData) {
      throw new functions.https.HttpsError(
        'internal',
        'خطأ في قراءة بيانات الهدف الاستراتيجي.'
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
    if (!userData || userData.organizationId !== objectiveData.organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية الوصول إلى النتائج الرئيسية لهذا الهدف.'
      );
    }

    // الحصول على النتائج الرئيسية
    const snapshot = await db.collection('keyResults')
      .where('objectiveId', '==', objectiveId)
      .orderBy('dueDate', 'asc')
      .get();

    // تحويل النتائج
    const keyResults = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logFunctionEnd(functionName, { count: keyResults.length });
    return { keyResults };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * تحديث نتيجة رئيسية
 */
export const updateKeyResult = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'updateKeyResult';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لتحديث نتيجة رئيسية.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['keyResultId']);

    const {
      keyResultId,
      title,
      description,
      currentValue,
      targetValue,
      dueDate,
      status,
      notes
    } = data;

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
        'ليس لديك صلاحية تحديث هذه النتيجة الرئيسية.'
      );
    }

    // إنشاء بيانات التحديث
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (targetValue !== undefined) updateData.targetValue = Number(targetValue);
    if (dueDate !== undefined) updateData.dueDate = admin.firestore.Timestamp.fromDate(new Date(dueDate));
    if (status !== undefined) updateData.status = status;

    // إذا تم تحديث القيمة الحالية
    if (currentValue !== undefined && currentValue !== keyResultData.currentValue) {
      updateData.currentValue = Number(currentValue);

      // حساب التقدم الجديد
      const range = (targetValue !== undefined ? targetValue : keyResultData.targetValue) - keyResultData.startValue;
      const progress = range !== 0
        ? Math.min(100, Math.max(0, ((updateData.currentValue - keyResultData.startValue) / range) * 100))
        : (updateData.currentValue >= (targetValue !== undefined ? targetValue : keyResultData.targetValue) ? 100 : 0);

      updateData.progress = progress;

      // إنشاء تحديث للنتيجة الرئيسية
      const keyResultUpdateData = {
        keyResultId,
        previousValue: keyResultData.currentValue,
        newValue: updateData.currentValue,
        notes: notes || '',
        date: admin.firestore.FieldValue.serverTimestamp(),
        userId,
        userName: userData.displayName || userData.email || '',
        organizationId: keyResultData.organizationId,
        departmentId: keyResultData.departmentId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('keyResultUpdates').add(keyResultUpdateData);
    }

    // تحديث النتيجة الرئيسية
    await db.collection('keyResults').doc(keyResultId).update(updateData);

    // تحديث تقدم الهدف الاستراتيجي
    await updateObjectiveProgress(keyResultData.objectiveId);

    logFunctionEnd(functionName, { success: true });
    return { success: true };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * حذف نتيجة رئيسية
 */
export const deleteKeyResult = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'deleteKeyResult';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لحذف نتيجة رئيسية.'
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
        'ليس لديك صلاحية حذف هذه النتيجة الرئيسية.'
      );
    }

    // حذف تحديثات النتيجة الرئيسية
    const updatesSnapshot = await db.collection('keyResultUpdates')
      .where('keyResultId', '==', keyResultId)
      .get();

    const batch = db.batch();
    updatesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // حذف روابط المهام
    const linksSnapshot = await db.collection('taskKeyResultLinks')
      .where('keyResultId', '==', keyResultId)
      .get();

    linksSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // حذف النتيجة الرئيسية
    batch.delete(db.collection('keyResults').doc(keyResultId));

    // تنفيذ الحذف
    await batch.commit();

    // تحديث تقدم الهدف الاستراتيجي
    await updateObjectiveProgress(keyResultData.objectiveId);

    logFunctionEnd(functionName, { success: true });
    return { success: true };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على تحديثات النتيجة الرئيسية
 */
export const getKeyResultUpdates = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getKeyResultUpdates';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على تحديثات النتيجة الرئيسية.'
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
        'ليس لديك صلاحية الوصول إلى تحديثات هذه النتيجة الرئيسية.'
      );
    }

    // الحصول على التحديثات
    const snapshot = await db.collection('keyResultUpdates')
      .where('keyResultId', '==', keyResultId)
      .orderBy('date', 'desc')
      .get();

    // تحويل النتائج
    const updates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logFunctionEnd(functionName, { count: updates.length });
    return { updates };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * تحديث تقدم الهدف الاستراتيجي
 */
async function updateObjectiveProgress(objectiveId: string): Promise<void> {
  try {
    // الحصول على النتائج الرئيسية للهدف
    const snapshot = await db.collection('keyResults')
      .where('objectiveId', '==', objectiveId)
      .get();

    if (snapshot.empty) {
      // إذا لم تكن هناك نتائج رئيسية، فإن التقدم يكون 0
      await db.collection('objectives').doc(objectiveId).update({
        progress: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // حساب متوسط تقدم النتائج الرئيسية
    let totalProgress = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      totalProgress += data.progress || 0;
    });

    const averageProgress = totalProgress / snapshot.size;

    // تحديث تقدم الهدف الاستراتيجي
    await db.collection('objectives').doc(objectiveId).update({
      progress: averageProgress,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating objective progress:', error);
    throw error;
  }
}
