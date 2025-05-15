/**
 * خدمات نظام التخطيط السنوي (OKRs)
 * 
 * يوفر هذا الملف وظائف للتعامل مع بيانات نظام التخطيط السنوي (OKRs).
 */

import { db } from '@/config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
  limit,
  startAfter,
  DocumentSnapshot,
  writeBatch,
  increment,
  runTransaction,
} from 'firebase/firestore';
import {
  OkrPeriod,
  Objective,
  KeyResult,
  KeyResultUpdate,
  TaskKeyResultLink,
  OkrProgressReport,
  OkrStats,
} from '@/types/okr';

// ===== فترات OKR =====

/**
 * إنشاء فترة OKR جديدة
 */
export async function createOkrPeriod(
  period: Omit<OkrPeriod, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const periodData = {
    ...period,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, 'okrPeriods'), periodData);
  return docRef.id;
}

/**
 * الحصول على فترة OKR بواسطة المعرف
 */
export async function getOkrPeriodById(periodId: string): Promise<OkrPeriod | null> {
  const docRef = doc(db, 'okrPeriods', periodId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as OkrPeriod;
  }

  return null;
}

/**
 * الحصول على فترات OKR للمؤسسة
 */
export async function getOkrPeriodsByOrganization(
  organizationId: string,
  departmentId?: string
): Promise<OkrPeriod[]> {
  let q = query(
    collection(db, 'okrPeriods'),
    where('organizationId', '==', organizationId),
    orderBy('startDate', 'desc')
  );

  if (departmentId) {
    q = query(
      collection(db, 'okrPeriods'),
      where('organizationId', '==', organizationId),
      where('departmentId', '==', departmentId),
      orderBy('startDate', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OkrPeriod));
}

/**
 * تحديث فترة OKR
 */
export async function updateOkrPeriod(
  periodId: string,
  data: Partial<OkrPeriod>
): Promise<void> {
  const docRef = doc(db, 'okrPeriods', periodId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * حذف فترة OKR
 */
export async function deleteOkrPeriod(periodId: string): Promise<void> {
  const docRef = doc(db, 'okrPeriods', periodId);
  await deleteDoc(docRef);
}

// ===== الأهداف الاستراتيجية =====

/**
 * إنشاء هدف استراتيجي جديد
 */
export async function createObjective(
  objective: Omit<Objective, 'id' | 'progress' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const objectiveData = {
    ...objective,
    progress: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, 'objectives'), objectiveData);
  return docRef.id;
}

/**
 * الحصول على هدف استراتيجي بواسطة المعرف
 */
export async function getObjectiveById(objectiveId: string): Promise<Objective | null> {
  const docRef = doc(db, 'objectives', objectiveId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Objective;
  }

  return null;
}

/**
 * الحصول على الأهداف الاستراتيجية لفترة OKR
 */
export async function getObjectivesByPeriod(
  periodId: string,
  departmentId?: string
): Promise<Objective[]> {
  let q = query(
    collection(db, 'objectives'),
    where('periodId', '==', periodId),
    orderBy('priority', 'desc')
  );

  if (departmentId) {
    q = query(
      collection(db, 'objectives'),
      where('periodId', '==', periodId),
      where('departmentId', '==', departmentId),
      orderBy('priority', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective));
}

/**
 * تحديث هدف استراتيجي
 */
export async function updateObjective(
  objectiveId: string,
  data: Partial<Objective>
): Promise<void> {
  const docRef = doc(db, 'objectives', objectiveId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * حذف هدف استراتيجي
 */
export async function deleteObjective(objectiveId: string): Promise<void> {
  const docRef = doc(db, 'objectives', objectiveId);
  await deleteDoc(docRef);
}

// ===== النتائج الرئيسية =====

/**
 * إنشاء نتيجة رئيسية جديدة
 */
export async function createKeyResult(
  keyResult: Omit<KeyResult, 'id' | 'progress' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const keyResultData = {
    ...keyResult,
    progress: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, 'keyResults'), keyResultData);
  
  // تحديث تقدم الهدف الاستراتيجي
  await updateObjectiveProgress(keyResult.objectiveId);
  
  return docRef.id;
}

/**
 * الحصول على نتيجة رئيسية بواسطة المعرف
 */
export async function getKeyResultById(keyResultId: string): Promise<KeyResult | null> {
  const docRef = doc(db, 'keyResults', keyResultId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as KeyResult;
  }

  return null;
}

/**
 * الحصول على النتائج الرئيسية لهدف استراتيجي
 */
export async function getKeyResultsByObjective(objectiveId: string): Promise<KeyResult[]> {
  const q = query(
    collection(db, 'keyResults'),
    where('objectiveId', '==', objectiveId),
    orderBy('dueDate', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KeyResult));
}

/**
 * تحديث نتيجة رئيسية
 */
export async function updateKeyResult(
  keyResultId: string,
  data: Partial<KeyResult>
): Promise<void> {
  const keyResult = await getKeyResultById(keyResultId);
  if (!keyResult) return;
  
  const docRef = doc(db, 'keyResults', keyResultId);
  
  // إذا تم تحديث القيمة الحالية، قم بإنشاء تحديث
  if (data.currentValue !== undefined && data.currentValue !== keyResult.currentValue) {
    await createKeyResultUpdate({
      keyResultId,
      previousValue: keyResult.currentValue,
      newValue: data.currentValue,
      date: Timestamp.now(),
      userId: data.createdBy || keyResult.createdBy,
      userName: '',
      organizationId: keyResult.organizationId,
      departmentId: keyResult.departmentId,
    });
    
    // حساب التقدم الجديد
    if (data.currentValue !== undefined) {
      const range = keyResult.targetValue - keyResult.startValue;
      const progress = range !== 0 
        ? Math.min(100, Math.max(0, ((data.currentValue - keyResult.startValue) / range) * 100))
        : (data.currentValue >= keyResult.targetValue ? 100 : 0);
      
      data.progress = progress;
    }
  }
  
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
  
  // تحديث تقدم الهدف الاستراتيجي
  await updateObjectiveProgress(keyResult.objectiveId);
}

/**
 * حذف نتيجة رئيسية
 */
export async function deleteKeyResult(keyResultId: string): Promise<void> {
  const keyResult = await getKeyResultById(keyResultId);
  if (!keyResult) return;
  
  const docRef = doc(db, 'keyResults', keyResultId);
  await deleteDoc(docRef);
  
  // تحديث تقدم الهدف الاستراتيجي
  await updateObjectiveProgress(keyResult.objectiveId);
}

/**
 * تحديث تقدم الهدف الاستراتيجي
 */
export async function updateObjectiveProgress(objectiveId: string): Promise<void> {
  const keyResults = await getKeyResultsByObjective(objectiveId);
  
  if (keyResults.length === 0) {
    await updateObjective(objectiveId, { progress: 0 });
    return;
  }
  
  // حساب متوسط تقدم النتائج الرئيسية
  const totalProgress = keyResults.reduce((sum, kr) => sum + kr.progress, 0);
  const averageProgress = totalProgress / keyResults.length;
  
  // تحديث تقدم الهدف الاستراتيجي
  await updateObjective(objectiveId, { progress: averageProgress });
}

// ===== تحديثات النتائج الرئيسية =====

/**
 * إنشاء تحديث للنتيجة الرئيسية
 */
export async function createKeyResultUpdate(
  update: Omit<KeyResultUpdate, 'id' | 'createdAt'>
): Promise<string> {
  const updateData = {
    ...update,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'keyResultUpdates'), updateData);
  return docRef.id;
}

/**
 * الحصول على تحديثات النتيجة الرئيسية
 */
export async function getKeyResultUpdates(keyResultId: string): Promise<KeyResultUpdate[]> {
  const q = query(
    collection(db, 'keyResultUpdates'),
    where('keyResultId', '==', keyResultId),
    orderBy('date', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KeyResultUpdate));
}

// ===== ربط المهام بالنتائج الرئيسية =====

/**
 * ربط مهمة بنتيجة رئيسية
 */
export async function linkTaskToKeyResult(
  link: Omit<TaskKeyResultLink, 'id' | 'createdAt'>,
  userId: string
): Promise<string> {
  const linkData = {
    ...link,
    createdAt: serverTimestamp(),
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, 'taskKeyResultLinks'), linkData);
  return docRef.id;
}

/**
 * الحصول على روابط المهام لنتيجة رئيسية
 */
export async function getTaskLinksForKeyResult(keyResultId: string): Promise<TaskKeyResultLink[]> {
  const q = query(
    collection(db, 'taskKeyResultLinks'),
    where('keyResultId', '==', keyResultId)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskKeyResultLink));
}

/**
 * الحصول على روابط النتائج الرئيسية لمهمة
 */
export async function getKeyResultLinksForTask(taskId: string): Promise<TaskKeyResultLink[]> {
  const q = query(
    collection(db, 'taskKeyResultLinks'),
    where('taskId', '==', taskId)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskKeyResultLink));
}

/**
 * إلغاء ربط مهمة بنتيجة رئيسية
 */
export async function unlinkTaskFromKeyResult(linkId: string): Promise<void> {
  const docRef = doc(db, 'taskKeyResultLinks', linkId);
  await deleteDoc(docRef);
}

// ===== تقارير تقدم OKR =====

/**
 * إنشاء تقرير تقدم OKR
 */
export async function createOkrProgressReport(
  report: Omit<OkrProgressReport, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const reportData = {
    ...report,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, 'okrProgressReports'), reportData);
  return docRef.id;
}

/**
 * الحصول على تقارير تقدم OKR لفترة
 */
export async function getOkrProgressReportsByPeriod(
  periodId: string,
  departmentId?: string
): Promise<OkrProgressReport[]> {
  let q = query(
    collection(db, 'okrProgressReports'),
    where('periodId', '==', periodId),
    orderBy('date', 'desc')
  );

  if (departmentId) {
    q = query(
      collection(db, 'okrProgressReports'),
      where('periodId', '==', periodId),
      where('departmentId', '==', departmentId),
      orderBy('date', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OkrProgressReport));
}

// ===== إحصائيات OKR =====

/**
 * تحديث إحصائيات OKR لفترة
 */
export async function updateOkrStats(periodId: string, departmentId?: string): Promise<void> {
  // الحصول على الأهداف الاستراتيجية للفترة
  const objectives = await getObjectivesByPeriod(periodId, departmentId);
  
  if (objectives.length === 0) return;
  
  const organizationId = objectives[0].organizationId;
  
  // إحصائيات الأهداف
  const totalObjectives = objectives.length;
  const completedObjectives = objectives.filter(obj => obj.status === 'completed').length;
  const atRiskObjectives = objectives.filter(obj => obj.status === 'at_risk').length;
  const behindObjectives = objectives.filter(obj => obj.status === 'behind').length;
  
  // حساب متوسط تقدم الأهداف
  const totalObjectiveProgress = objectives.reduce((sum, obj) => sum + obj.progress, 0);
  const averageObjectiveProgress = totalObjectiveProgress / totalObjectives;
  
  // الحصول على جميع النتائج الرئيسية للأهداف
  let allKeyResults: KeyResult[] = [];
  for (const objective of objectives) {
    const keyResults = await getKeyResultsByObjective(objective.id);
    allKeyResults = [...allKeyResults, ...keyResults];
  }
  
  // إحصائيات النتائج الرئيسية
  const totalKeyResults = allKeyResults.length;
  const completedKeyResults = allKeyResults.filter(kr => kr.status === 'completed').length;
  const atRiskKeyResults = allKeyResults.filter(kr => kr.status === 'at_risk').length;
  const behindKeyResults = allKeyResults.filter(kr => kr.status === 'behind').length;
  
  // حساب متوسط تقدم النتائج الرئيسية
  const totalKeyResultProgress = allKeyResults.reduce((sum, kr) => sum + kr.progress, 0);
  const averageKeyResultProgress = totalKeyResults > 0 ? totalKeyResultProgress / totalKeyResults : 0;
  
  // الحصول على روابط المهام
  let linkedTasksCount = 0;
  let completedLinkedTasksCount = 0;
  
  for (const keyResult of allKeyResults) {
    const taskLinks = await getTaskLinksForKeyResult(keyResult.id);
    linkedTasksCount += taskLinks.length;
    
    // هنا يمكن إضافة منطق لحساب عدد المهام المكتملة
    // لكن هذا يتطلب الوصول إلى بيانات المهام
  }
  
  // إنشاء أو تحديث وثيقة الإحصائيات
  const statsData: OkrStats = {
    periodId,
    totalObjectives,
    completedObjectives,
    atRiskObjectives,
    behindObjectives,
    totalKeyResults,
    completedKeyResults,
    atRiskKeyResults,
    behindKeyResults,
    averageObjectiveProgress,
    averageKeyResultProgress,
    linkedTasksCount,
    completedLinkedTasksCount,
    organizationId,
    departmentId,
    lastUpdated: Timestamp.now(),
  };
  
  // البحث عن وثيقة الإحصائيات الحالية
  let q = query(
    collection(db, 'okrStats'),
    where('periodId', '==', periodId)
  );
  
  if (departmentId) {
    q = query(
      collection(db, 'okrStats'),
      where('periodId', '==', periodId),
      where('departmentId', '==', departmentId)
    );
  } else {
    q = query(
      collection(db, 'okrStats'),
      where('periodId', '==', periodId),
      where('departmentId', '==', null)
    );
  }
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    // إنشاء وثيقة جديدة
    await addDoc(collection(db, 'okrStats'), statsData);
  } else {
    // تحديث الوثيقة الحالية
    const docRef = doc(db, 'okrStats', querySnapshot.docs[0].id);
    await updateDoc(docRef, statsData);
  }
}
