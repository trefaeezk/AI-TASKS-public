/**
 * وظائف Firebase لنظام التخطيط السنوي (OKRs)
 *
 * هذا الملف يحتوي على وظائف Firebase للتعامل مع نظام التخطيط السنوي (OKRs)
 * في نظام المؤسسات.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createCallableFunction } from '../shared/function-utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { AuthInfo, CallableRequest } from '../shared/types';

// الحصول على مرجع قاعدة البيانات
const db = admin.firestore();

// ===== فترات OKR =====

/**
 * إنشاء فترة OKR جديدة
 */
export const createOkrPeriod = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'createOkrPeriod';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لإنشاء فترة OKR.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['name', 'startDate', 'endDate', 'organizationId']);

    const { name, startDate, endDate, organizationId, departmentId, status } = data;

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
        'ليس لديك صلاحية إنشاء فترة OKR لهذه المؤسسة.'
      );
    }

    // التحقق من وجود المؤسسة
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على المؤسسة.'
      );
    }

    // التحقق من وجود القسم إذا تم تحديده
    if (departmentId) {
      const deptDoc = await db.collection('organizations').doc(organizationId).collection('departments').doc(departmentId).get();
      if (!deptDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'لم يتم العثور على القسم.'
        );
      }
      // لا حاجة للتحقق من organizationId لأننا نجلب من مسار المؤسسة مباشرة
    }

    // إنشاء فترة OKR جديدة
    const periodData = {
      name,
      startDate: admin.firestore.Timestamp.fromDate(new Date(startDate)),
      endDate: admin.firestore.Timestamp.fromDate(new Date(endDate)),
      status: status || 'active',
      organizationId,
      departmentId: departmentId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await db.collection('okrPeriods').add(periodData);

    logFunctionEnd(functionName, { id: docRef.id });
    return { id: docRef.id };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على فترات OKR للمؤسسة
 */
export const getOkrPeriods = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getOkrPeriods';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على فترات OKR.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['organizationId']);

    const { organizationId, departmentId } = data;

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
        'ليس لديك صلاحية الوصول إلى فترات OKR لهذه المؤسسة.'
      );
    }

    // إنشاء الاستعلام
    let query = db.collection('okrPeriods')
      .where('organizationId', '==', organizationId)
      .orderBy('startDate', 'desc');

    if (departmentId) {
      query = db.collection('okrPeriods')
        .where('organizationId', '==', organizationId)
        .where('departmentId', '==', departmentId)
        .orderBy('startDate', 'desc');
    }

    // تنفيذ الاستعلام
    const snapshot = await query.get();

    // تحويل النتائج
    const periods = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    logFunctionEnd(functionName, { count: periods.length });
    return { periods };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * تحديث فترة OKR
 */
export const updateOkrPeriod = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'updateOkrPeriod';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لتحديث فترة OKR.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['periodId']);

    const { periodId, name, startDate, endDate, status } = data;

    // الحصول على فترة OKR
    const periodDoc = await db.collection('okrPeriods').doc(periodId).get();
    if (!periodDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على فترة OKR.'
      );
    }

    const periodData = periodDoc.data();
    if (!periodData) {
      throw new functions.https.HttpsError(
        'internal',
        'خطأ في قراءة بيانات فترة OKR.'
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
    if (!userData || userData.organizationId !== periodData.organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية تحديث فترة OKR لهذه المؤسسة.'
      );
    }

    // إنشاء بيانات التحديث
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = admin.firestore.Timestamp.fromDate(new Date(startDate));
    if (endDate !== undefined) updateData.endDate = admin.firestore.Timestamp.fromDate(new Date(endDate));
    if (status !== undefined) updateData.status = status;

    // تحديث فترة OKR
    await db.collection('okrPeriods').doc(periodId).update(updateData);

    logFunctionEnd(functionName, { success: true });
    return { success: true };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * حذف فترة OKR
 */
export const deleteOkrPeriod = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'deleteOkrPeriod';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لحذف فترة OKR.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['periodId']);

    const { periodId } = data;

    // الحصول على فترة OKR
    const periodDoc = await db.collection('okrPeriods').doc(periodId).get();
    if (!periodDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على فترة OKR.'
      );
    }

    const periodData = periodDoc.data();
    if (!periodData) {
      throw new functions.https.HttpsError(
        'internal',
        'خطأ في قراءة بيانات فترة OKR.'
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
    if (!userData || userData.organizationId !== periodData.organizationId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'ليس لديك صلاحية حذف فترة OKR لهذه المؤسسة.'
      );
    }

    // التحقق من وجود أهداف مرتبطة بالفترة
    const objectivesSnapshot = await db.collection('objectives')
      .where('periodId', '==', periodId)
      .limit(1)
      .get();

    if (!objectivesSnapshot.empty) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'لا يمكن حذف فترة OKR تحتوي على أهداف. قم بحذف الأهداف أولاً.'
      );
    }

    // حذف فترة OKR
    await db.collection('okrPeriods').doc(periodId).delete();

    logFunctionEnd(functionName, { success: true });
    return { success: true };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

// ===== الأهداف الاستراتيجية =====

/**
 * إنشاء هدف استراتيجي جديد
 */
export const createObjective = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'createObjective';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لإنشاء هدف استراتيجي.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['title', 'periodId', 'organizationId', 'ownerId', 'ownerName']);

    const {
      title,
      description,
      periodId,
      organizationId,
      departmentId,
      ownerId,
      ownerName,
      priority
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
        'ليس لديك صلاحية إنشاء هدف استراتيجي لهذه المؤسسة.'
      );
    }

    // التحقق من وجود فترة OKR
    const periodDoc = await db.collection('okrPeriods').doc(periodId).get();
    if (!periodDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على فترة OKR.'
      );
    }

    const periodData = periodDoc.data();
    if (!periodData || periodData.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'فترة OKR لا تنتمي إلى هذه المؤسسة.'
      );
    }

    // التحقق من وجود القسم إذا تم تحديده
    if (departmentId) {
      const deptDoc = await db.collection('organizations').doc(organizationId).collection('departments').doc(departmentId).get();
      if (!deptDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'لم يتم العثور على القسم.'
        );
      }
      // لا حاجة للتحقق من organizationId لأننا نجلب من مسار المؤسسة مباشرة
    }

    // إنشاء هدف استراتيجي جديد
    const objectiveData = {
      title,
      description: description || '',
      periodId,
      organizationId,
      departmentId: departmentId || null,
      ownerId,
      ownerName,
      progress: 0,
      status: 'active',
      priority: priority || 'medium',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await db.collection('objectives').add(objectiveData);

    logFunctionEnd(functionName, { id: docRef.id });
    return { id: docRef.id };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});
