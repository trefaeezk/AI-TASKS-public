/**
 * وظائف Firebase للحصول على إحصائيات OKR
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createCallableFunction } from '../shared/function-utils';
import { validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../shared/logging-utils';
import { AuthInfo, CallableRequest, Objective as ObjectiveType, KeyResult as KeyResultType } from '../shared/types';

// الحصول على مرجع قاعدة البيانات
const db = admin.firestore();

/**
 * الحصول على إحصائيات OKR
 */
export const getOkrStats = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'getOkrStats';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول للحصول على إحصائيات OKR.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['periodId', 'organizationId']);

    const { periodId, departmentId, organizationId } = data;

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

    // التحقق من وجود الفترة
    const periodDoc = await db.collection('okrPeriods').doc(periodId).get();
    if (!periodDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على الفترة.'
      );
    }

    // إنشاء استعلام الأهداف
    let objectivesQuery = db.collection('objectives')
      .where('periodId', '==', periodId)
      .where('organizationId', '==', organizationId);

    // إضافة فلتر القسم إذا تم تحديده
    if (departmentId) {
      objectivesQuery = objectivesQuery.where('departmentId', '==', departmentId);
    }

    // الحصول على الأهداف
    const objectivesSnapshot = await objectivesQuery.get();
    const objectives = objectivesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // الحصول على معرفات الأهداف
    const objectiveIds = objectives.map(obj => obj.id);

    // إنشاء استعلام النتائج الرئيسية
    let keyResultsQuery = db.collection('keyResults')
      .where('objectiveId', 'in', objectiveIds.length > 0 ? objectiveIds : ['no-objectives']);

    // الحصول على النتائج الرئيسية
    const keyResultsSnapshot = await keyResultsQuery.get();
    const keyResults = keyResultsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // الحصول على الأقسام
    const departmentsSnapshot = await db.collection('departments')
      .where('organizationId', '==', organizationId)
      .get();

    const departments = departmentsSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data().name;
      return acc;
    }, {});

    // Asegurar que los objetos tienen el tipo correcto
    const typedObjectives = objectives as ObjectiveType[];
    const typedKeyResults = keyResults as KeyResultType[];

    // حساب الإحصائيات
    const stats: {
      totalObjectives: number;
      completedObjectives: number;
      atRiskObjectives: number;
      behindObjectives: number;
      totalKeyResults: number;
      completedKeyResults: number;
      atRiskKeyResults: number;
      behindKeyResults: number;
      averageProgress: number;
      departmentStats: Record<string, any>;
    } = {
      totalObjectives: typedObjectives.length,
      completedObjectives: typedObjectives.filter(obj => obj.status === 'completed').length,
      atRiskObjectives: typedObjectives.filter(obj => obj.status === 'at_risk').length,
      behindObjectives: typedObjectives.filter(obj => obj.status === 'behind').length,
      totalKeyResults: typedKeyResults.length,
      completedKeyResults: typedKeyResults.filter(kr => kr.status === 'completed').length,
      atRiskKeyResults: typedKeyResults.filter(kr => kr.status === 'at_risk').length,
      behindKeyResults: typedKeyResults.filter(kr => kr.status === 'behind').length,
      averageProgress: typedObjectives.length > 0
        ? typedObjectives.reduce((sum, obj) => sum + (obj.progress || 0), 0) / typedObjectives.length
        : 0,
      departmentStats: {}
    };

    // حساب إحصائيات الأقسام
    const departmentObjectives: Record<string, { objectives: ObjectiveType[]; name: string }> = typedObjectives.reduce((acc, obj) => {
      if (obj.departmentId) {
        if (!acc[obj.departmentId]) {
          acc[obj.departmentId] = {
            objectives: [],
            name: departments[obj.departmentId] || 'قسم غير معروف'
          };
        }
        acc[obj.departmentId].objectives.push(obj);
      }
      return acc;
    }, {} as Record<string, { objectives: ObjectiveType[]; name: string }>);

    // حساب إحصائيات كل قسم
    Object.keys(departmentObjectives).forEach(deptId => {
      const deptObjs = departmentObjectives[deptId].objectives;
      stats.departmentStats[deptId] = {
        name: departmentObjectives[deptId].name,
        progress: deptObjs.length > 0
          ? deptObjs.reduce((sum, obj) => sum + (obj.progress || 0), 0) / deptObjs.length
          : 0,
        totalObjectives: deptObjs.length,
        completedObjectives: deptObjs.filter(obj => obj.status === 'completed').length
      };
    });

    // إضافة معلومات الأقسام إلى الأهداف
    const objectivesWithDepartments = typedObjectives.map(obj => {
      if (obj.departmentId) {
        return {
          ...obj,
          departmentName: departments[obj.departmentId] || 'قسم غير معروف'
        };
      }
      return obj;
    });

    logFunctionEnd(functionName, { stats });
    return {
      stats,
      objectives: objectivesWithDepartments,
      keyResults
    };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * الحصول على فترات OKR
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

    const { organizationId } = data;

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

    // الحصول على فترات OKR
    const periodsSnapshot = await db.collection('okrPeriods')
      .where('organizationId', '==', organizationId)
      .orderBy('startDate', 'desc')
      .get();

    const periods = periodsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logFunctionEnd(functionName, { count: periods.length });
    return { periods };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * تصدير تقرير OKR بتنسيق PDF
 */
export const exportOkrReport = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'exportOkrReport';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لتصدير تقرير OKR.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['periodId', 'organizationId']);

    const { periodId, departmentId, organizationId } = data;

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

    // TODO: تنفيذ وظيفة تصدير التقرير بتنسيق PDF

    logFunctionEnd(functionName, { success: true });
    return { success: true, url: 'https://example.com/report.pdf' };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});

/**
 * تصدير بيانات OKR بتنسيق Excel
 */
export const exportOkrToExcel = createCallableFunction(async (request: CallableRequest) => {
  const { data, auth } = request;
  const functionName = 'exportOkrToExcel';
  logFunctionStart(functionName, data);

  try {
    // التحقق من تسجيل الدخول
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'يجب تسجيل الدخول لتصدير بيانات OKR.'
      );
    }

    const userId = auth.uid;

    // التحقق من البيانات المطلوبة
    validateInput(data, ['periodId', 'organizationId']);

    const { periodId, departmentId, organizationId } = data;

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

    // الحصول على بيانات OKR مباشرة بدون استدعاء الدالة
    const { stats, objectives, keyResults } = await (async () => {
      // استعلام الأهداف
      let objectivesQuery = db.collection('objectives')
        .where('periodId', '==', periodId)
        .where('organizationId', '==', organizationId);

      if (departmentId) {
        objectivesQuery = objectivesQuery.where('departmentId', '==', departmentId);
      }

      const objectivesSnapshot = await objectivesQuery.get();
      const objectives = objectivesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // استعلام النتائج الرئيسية
      const objectiveIds = objectives.map(obj => obj.id);
      let keyResultsQuery = db.collection('keyResults')
        .where('objectiveId', 'in', objectiveIds.length > 0 ? objectiveIds : ['no-objectives']);

      const keyResultsSnapshot = await keyResultsQuery.get();
      const keyResults = keyResultsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // حساب الإحصائيات
      const typedObjectives = objectives as ObjectiveType[];
      const typedKeyResults = keyResults as KeyResultType[];

      const stats = {
        totalObjectives: typedObjectives.length,
        completedObjectives: typedObjectives.filter(obj => obj.status === 'completed').length,
        atRiskObjectives: typedObjectives.filter(obj => obj.status === 'at_risk').length,
        behindObjectives: typedObjectives.filter(obj => obj.status === 'behind').length,
        totalKeyResults: typedKeyResults.length,
        completedKeyResults: typedKeyResults.filter(kr => kr.status === 'completed').length,
        atRiskKeyResults: typedKeyResults.filter(kr => kr.status === 'at_risk').length,
        behindKeyResults: typedKeyResults.filter(kr => kr.status === 'behind').length,
        averageProgress: typedObjectives.length > 0
          ? typedObjectives.reduce((sum, obj) => sum + (obj.progress || 0), 0) / typedObjectives.length
          : 0,
        departmentStats: {}
      };

      return { stats, objectives, keyResults };
    })();

    // TODO: تنفيذ وظيفة تصدير البيانات بتنسيق Excel
    // هنا يمكن استخدام مكتبة مثل ExcelJS لإنشاء ملف Excel
    // ثم رفعه إلى Cloud Storage وإرجاع رابط التنزيل

    logFunctionEnd(functionName, { success: true });
    return { success: true, url: 'https://example.com/okr_data.xlsx' };
  } catch (error) {
    logFunctionError(functionName, error);
    throw error;
  }
});
