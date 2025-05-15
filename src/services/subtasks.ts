'use client';

import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { TaskFirestoreData, MilestoneFirestoreData, TaskContext } from '@/types/task';
import { v4 as uuidv4 } from 'uuid';

/**
 * إنشاء مهام فرعية للأقسام بناءً على مهمة أم
 * @param parentTaskId معرف المهمة الأم
 * @param departmentIds معرفات الأقسام المراد إنشاء مهام فرعية لها
 * @returns وعد يحتوي على معرفات المهام الفرعية التي تم إنشاؤها
 */
export async function createDepartmentSubtasks(
  parentTaskId: string,
  departmentIds: string[]
): Promise<string[]> {
  try {
    // التحقق من وجود معرفات الأقسام
    if (!departmentIds.length) {
      throw new Error('لم يتم تحديد أقسام لإنشاء مهام فرعية لها');
    }

    // الحصول على بيانات المهمة الأم
    const parentTaskRef = doc(db, 'tasks', parentTaskId);
    const parentTaskSnapshot = await getDoc(parentTaskRef);

    if (!parentTaskSnapshot.exists()) {
      throw new Error('المهمة الأم غير موجودة');
    }

    const parentTaskData = parentTaskSnapshot.data() as TaskFirestoreData;

    // التحقق من أن المهمة الأم هي مهمة مؤسسة
    if (parentTaskData.taskContext !== 'organization') {
      throw new Error('يمكن إنشاء مهام فرعية للأقسام فقط من مهام المؤسسة');
    }

    // التحقق من وجود الأقسام المحددة في المؤسسة
    const organizationId = parentTaskData.organizationId;
    if (!organizationId) {
      throw new Error('المهمة الأم لا تنتمي إلى مؤسسة');
    }

    // التحقق من وجود الأقسام المحددة
    const validDepartmentIds: string[] = [];
    for (const departmentId of departmentIds) {
      const departmentRef = doc(db, 'organizations', organizationId, 'departments', departmentId);
      const departmentSnapshot = await getDoc(departmentRef);
      if (departmentSnapshot.exists()) {
        validDepartmentIds.push(departmentId);
      }
    }

    if (!validDepartmentIds.length) {
      throw new Error('لم يتم العثور على أقسام صالحة');
    }

    // إنشاء مهام فرعية للأقسام
    const createdSubtaskIds: string[] = [];
    const batch = writeBatch(db);

    for (const departmentId of validDepartmentIds) {
      // إنشاء نسخة من نقاط التتبع للمهمة الفرعية
      const subtaskMilestones: MilestoneFirestoreData[] | null = 
        parentTaskData.milestones 
          ? parentTaskData.milestones.map(milestone => ({
              id: uuidv4(),
              description: milestone.description,
              completed: false, // تعيين الحالة إلى غير مكتملة للمهمة الفرعية
              weight: milestone.weight,
              dueDate: milestone.dueDate // نسخ تاريخ الاستحقاق من المهمة الأم
            }))
          : null;

      // إنشاء بيانات المهمة الفرعية
      const subtaskData: TaskFirestoreData = {
        description: parentTaskData.description,
        userId: parentTaskData.userId, // استخدام نفس المستخدم الذي أنشأ المهمة الأم
        status: 'pending',
        details: parentTaskData.details,
        startDate: parentTaskData.startDate,
        dueDate: parentTaskData.dueDate,
        durationValue: parentTaskData.durationValue,
        durationUnit: parentTaskData.durationUnit,
        priority: parentTaskData.priority,
        priorityReason: parentTaskData.priorityReason,
        taskCategoryName: parentTaskData.taskCategoryName,
        milestones: subtaskMilestones,
        
        // حقول سياق المهمة
        taskContext: 'department' as TaskContext,
        organizationId: organizationId,
        departmentId: departmentId,
        assignedToUserId: null,
        parentTaskId: parentTaskId, // ربط المهمة الفرعية بالمهمة الأم
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // إضافة المهمة الفرعية إلى قاعدة البيانات
      const subtaskRef = await addDoc(collection(db, 'tasks'), subtaskData);
      createdSubtaskIds.push(subtaskRef.id);
    }

    return createdSubtaskIds;
  } catch (error) {
    console.error('Error creating department subtasks:', error);
    throw error;
  }
}

/**
 * الحصول على المهام الفرعية لمهمة أم
 * @param parentTaskId معرف المهمة الأم
 * @returns وعد يحتوي على بيانات المهام الفرعية
 */
export async function getSubtasks(parentTaskId: string): Promise<TaskFirestoreData[]> {
  try {
    const subtasksQuery = query(
      collection(db, 'tasks'),
      where('parentTaskId', '==', parentTaskId)
    );
    
    const subtasksSnapshot = await getDocs(subtasksQuery);
    const subtasks: TaskFirestoreData[] = [];
    
    subtasksSnapshot.forEach(doc => {
      subtasks.push(doc.data() as TaskFirestoreData);
    });
    
    return subtasks;
  } catch (error) {
    console.error('Error getting subtasks:', error);
    throw error;
  }
}

/**
 * التحقق مما إذا كانت المهمة لديها مهام فرعية
 * @param taskId معرف المهمة
 * @returns وعد يحتوي على قيمة منطقية تشير إلى وجود مهام فرعية
 */
export async function hasSubtasks(taskId: string): Promise<boolean> {
  try {
    const subtasksQuery = query(
      collection(db, 'tasks'),
      where('parentTaskId', '==', taskId),
      // استخدام limit(1) لتحسين الأداء، نحن نحتاج فقط لمعرفة ما إذا كانت هناك مهمة فرعية واحدة على الأقل
      // limit(1)
    );
    
    const subtasksSnapshot = await getDocs(subtasksQuery);
    return !subtasksSnapshot.empty;
  } catch (error) {
    console.error('Error checking for subtasks:', error);
    throw error;
  }
}
