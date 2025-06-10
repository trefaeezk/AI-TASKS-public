import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { TaskStatus } from '@/types/task';

/**
 * تحديث حالة المهمة الرئيسية بناءً على حالة المهام الفرعية
 * @param parentTaskId معرف المهمة الرئيسية
 */
export async function updateParentTaskStatus(parentTaskId: string): Promise<void> {
  try {
    // جلب المهمة الرئيسية
    const parentTaskRef = doc(db, 'tasks', parentTaskId);
    const parentTaskDoc = await getDoc(parentTaskRef);

    if (!parentTaskDoc.exists()) {
      console.warn(`Parent task ${parentTaskId} not found`);
      return;
    }

    const parentTaskData = parentTaskDoc.data();

    // جلب جميع المهام الفرعية
    const subtasksQuery = query(
      collection(db, 'tasks'),
      where('parentTaskId', '==', parentTaskId)
    );

    const subtasksSnapshot = await getDocs(subtasksQuery);
    const subtasks = subtasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (subtasks.length === 0) {
      // لا توجد مهام فرعية، لا حاجة للتحديث
      return;
    }

    // حساب الحالة الجديدة للمهمة الرئيسية
    const completedSubtasks = subtasks.filter(task => task.status === 'completed');
    const inProgressSubtasks = subtasks.filter(task => task.status === 'in-progress');
    const pendingSubtasks = subtasks.filter(task => task.status === 'pending');
    const holdSubtasks = subtasks.filter(task => task.status === 'hold');
    const cancelledSubtasks = subtasks.filter(task => task.status === 'cancelled');

    let newParentStatus: TaskStatus = parentTaskData.status;

    // منطق محدث لتحديث حالة المهمة الرئيسية
    if (completedSubtasks.length === subtasks.length) {
      // جميع المهام الفرعية مكتملة
      newParentStatus = 'completed';
    } else if (cancelledSubtasks.length === subtasks.length) {
      // جميع المهام ملغية
      newParentStatus = 'cancelled';
    } else if (inProgressSubtasks.length > 0) {
      // إذا كان هناك مهام قيد التنفيذ، المهمة الرئيسية قيد التنفيذ
      newParentStatus = 'in-progress';
    } else if (completedSubtasks.length > 0 && (parentTaskData.status === 'hold' || parentTaskData.status === 'pending')) {
      // إذا كانت بعض المهام مكتملة والمهمة الرئيسية متوقفة أو معلقة، حولها لقيد التنفيذ
      newParentStatus = 'in-progress';
    } else if (pendingSubtasks.length > 0 && parentTaskData.status === 'hold') {
      // إذا كان هناك مهام معلقة والمهمة الرئيسية متوقفة، حولها لمعلقة
      newParentStatus = 'pending';
    } else if ((pendingSubtasks.length > 0 || inProgressSubtasks.length > 0) && parentTaskData.status === 'cancelled') {
      // إذا كان هناك مهام نشطة والمهمة الرئيسية ملغية، أعد تشغيلها
      newParentStatus = 'pending';
    }

    // تحديث إضافي بناءً على نقاط التتبع للمهمة الأم نفسها
    if (parentTaskData.milestones && parentTaskData.milestones.length > 0) {
      const newStatusFromMilestones = calculateTaskStatusFromMilestones(
        parentTaskData.milestones,
        newParentStatus
      );

      // إذا كانت جميع نقاط التتبع مكتملة، اكمل المهمة الأم
      if (newStatusFromMilestones === 'completed' && newParentStatus !== 'completed') {
        newParentStatus = 'completed';
        console.log(`Parent task ${parentTaskId} completed due to all milestones being completed`);
      }
    }
    // في جميع الحالات الأخرى، نحافظ على الحالة الحالية

    // تحديث المهمة الرئيسية إذا تغيرت الحالة
    if (newParentStatus !== parentTaskData.status) {
      await updateDoc(parentTaskRef, {
        status: newParentStatus,
        updatedAt: Timestamp.now()
      });

      console.log(`Parent task ${parentTaskId} status updated from ${parentTaskData.status} to ${newParentStatus}`);

      // إذا كانت هذه المهمة أيضاً فرعية، حدث المهمة الرئيسية لها
      if (parentTaskData.parentTaskId) {
        await updateParentTaskStatus(parentTaskData.parentTaskId);
      }
    }
  } catch (error) {
    console.error('Error updating parent task status:', error);
    throw error;
  }
}

/**
 * تحديث جميع المهام الفرعية عند تحديث المهمة الرئيسية
 * @param parentTaskId معرف المهمة الرئيسية
 * @param newParentStatus الحالة الجديدة للمهمة الرئيسية
 */
export async function updateSubtasksFromParent(
  parentTaskId: string, 
  newParentStatus: TaskStatus
): Promise<void> {
  try {
    // جلب جميع المهام الفرعية
    const subtasksQuery = query(
      collection(db, 'tasks'),
      where('parentTaskId', '==', parentTaskId)
    );
    
    const subtasksSnapshot = await getDocs(subtasksQuery);
    
    // تحديث المهام الفرعية بناءً على حالة المهمة الرئيسية
    const updatePromises = subtasksSnapshot.docs.map(async (subtaskDoc) => {
      const subtaskData = subtaskDoc.data();
      let newSubtaskStatus: TaskStatus = subtaskData.status;
      
      console.log(`[SUBTASK UPDATE] Processing subtask ${subtaskDoc.id}: parent status ${newParentStatus}, subtask status ${subtaskData.status}`);

      if (newParentStatus === 'completed') {
        // إذا اكتملت المهمة الرئيسية، اكمل جميع المهام الفرعية
        newSubtaskStatus = 'completed';
        console.log(`[SUBTASK UPDATE] Completing subtask ${subtaskDoc.id} because parent completed`);
      } else if (newParentStatus === 'cancelled') {
        // إذا تم إلغاء المهمة الرئيسية، ألغ جميع المهام الفرعية
        newSubtaskStatus = 'cancelled';
        console.log(`[SUBTASK UPDATE] Cancelling subtask ${subtaskDoc.id} because parent cancelled`);
      } else if (newParentStatus === 'pending') {
        // إذا تم إعادة فتح المهمة الرئيسية، أعد فتح المهام الفرعية المكتملة أو الملغية أو المعلقة
        if (subtaskData.status === 'completed' || subtaskData.status === 'cancelled' || subtaskData.status === 'hold') {
          newSubtaskStatus = 'pending';
          console.log(`[SUBTASK UPDATE] Reopening subtask ${subtaskDoc.id} from ${subtaskData.status} to pending because parent reopened`);
        }
      } else if (newParentStatus === 'in-progress') {
        // إذا تم تفعيل المهمة الرئيسية، أعد تفعيل المهام الفرعية المعلقة أو الملغية
        if (subtaskData.status === 'hold' || subtaskData.status === 'cancelled') {
          newSubtaskStatus = 'pending';
          console.log(`[SUBTASK UPDATE] Activating subtask ${subtaskDoc.id} from ${subtaskData.status} to pending because parent in progress`);
        }
      } else if (newParentStatus === 'hold') {
        // إذا تم تعليق المهمة الرئيسية، علق المهام الفرعية النشطة
        if (subtaskData.status === 'pending' || subtaskData.status === 'in-progress') {
          newSubtaskStatus = 'hold';
          console.log(`[SUBTASK UPDATE] Holding subtask ${subtaskDoc.id} from ${subtaskData.status} to hold because parent on hold`);
        }
      }
      // إزالة المنطق الذي يحول المهام الفرعية إلى 'hold' تلقائياً
      
      // تحديث المهمة الفرعية إذا تغيرت الحالة
      if (newSubtaskStatus !== subtaskData.status) {
        const updateData: any = {
          status: newSubtaskStatus,
          updatedAt: Timestamp.now()
        };

        // إذا تم إعادة فتح المهمة، أعد تعيين نقاط التتبع المكتملة
        if (newSubtaskStatus === 'pending' && (subtaskData.status === 'completed' || subtaskData.status === 'cancelled')) {
          if (subtaskData.milestones && subtaskData.milestones.length > 0) {
            const resetMilestones = subtaskData.milestones.map((milestone: any) => ({
              ...milestone,
              completed: false
            }));
            updateData.milestones = resetMilestones;
            console.log(`[SUBTASK UPDATE] Resetting milestones for subtask ${subtaskDoc.id}`);
          }
        }

        await updateDoc(doc(db, 'tasks', subtaskDoc.id), updateData);

        console.log(`Subtask ${subtaskDoc.id} status updated from ${subtaskData.status} to ${newSubtaskStatus}`);
      }
    });
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error updating subtasks from parent:', error);
    throw error;
  }
}

/**
 * تحديث نقاط التتبع في المهمة الرئيسية بناءً على المهام الفرعية
 * @param parentTaskId معرف المهمة الرئيسية
 */
export async function updateParentMilestones(parentTaskId: string): Promise<void> {
  try {
    console.log(`[PARENT MILESTONES] Starting update for parent task ${parentTaskId}`);

    // جلب المهمة الرئيسية
    const parentTaskRef = doc(db, 'tasks', parentTaskId);
    const parentTaskDoc = await getDoc(parentTaskRef);

    if (!parentTaskDoc.exists()) {
      console.log(`[PARENT MILESTONES] Parent task ${parentTaskId} does not exist`);
      return;
    }

    const parentTaskData = parentTaskDoc.data();
    const parentMilestones = parentTaskData.milestones || [];

    console.log(`[PARENT MILESTONES] Parent task ${parentTaskId} has ${parentMilestones.length} milestones`);

    if (parentMilestones.length === 0) {
      console.log(`[PARENT MILESTONES] No milestones in parent task ${parentTaskId}, skipping update`);
      return;
    }

    // جلب جميع المهام الفرعية
    const subtasksQuery = query(
      collection(db, 'tasks'),
      where('parentTaskId', '==', parentTaskId)
    );

    const subtasksSnapshot = await getDocs(subtasksQuery);
    const subtasks = subtasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`[PARENT MILESTONES] Found ${subtasks.length} subtasks for parent ${parentTaskId}`);

    if (subtasks.length === 0) {
      console.log(`[PARENT MILESTONES] No subtasks found for parent ${parentTaskId}`);
      return;
    }

    // حساب تقدم نقاط التتبع بناءً على المهام الفرعية
    const updatedMilestones = parentMilestones.map((milestone: any) => {
      // حساب نسبة إكمال هذه النقطة في المهام الفرعية
      const subtaskMilestones = subtasks.flatMap(subtask =>
        (subtask.milestones || []).filter((m: any) => m.description === milestone.description)
      );

      console.log(`[PARENT MILESTONES] Milestone "${milestone.description}": found ${subtaskMilestones.length} matching subtask milestones`);

      if (subtaskMilestones.length === 0) {
        console.log(`[PARENT MILESTONES] No matching subtask milestones for "${milestone.description}", keeping original state`);
        return milestone;
      }

      const completedCount = subtaskMilestones.filter((m: any) => m.completed).length;
      const totalCount = subtaskMilestones.length;
      const isCompleted = completedCount === totalCount;

      console.log(`[PARENT MILESTONES] Milestone "${milestone.description}": ${completedCount}/${totalCount} completed, setting to ${isCompleted}`);

      return {
        ...milestone,
        completed: isCompleted
      };
    });

    // تحديث نقاط التتبع فقط، بدون تغيير حالة المهمة
    // حالة المهمة ستحدث من خلال updateParentTaskStatus
    const updateData: any = {
      milestones: updatedMilestones,
      updatedAt: Timestamp.now()
    };

    await updateDoc(parentTaskRef, updateData);

    console.log(`[PARENT MILESTONES] Successfully updated parent task ${parentTaskId} milestones:`, updatedMilestones);

    // إذا كانت هذه المهمة أيضاً فرعية، حدث نقاط التتبع للمهمة الرئيسية لها
    if (parentTaskData.parentTaskId) {
      console.log(`[PARENT MILESTONES] Parent task ${parentTaskId} has grandparent ${parentTaskData.parentTaskId}, updating recursively`);
      await updateParentMilestones(parentTaskData.parentTaskId);
    }
  } catch (error) {
    console.error('Error updating parent milestones:', error);
    throw error;
  }
}

/**
 * إعادة تعيين نقاط التتبع عند إعادة فتح المهمة
 * @param taskId معرف المهمة
 */
export async function resetMilestonesOnReopen(taskId: string): Promise<void> {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);

    if (!taskDoc.exists()) {
      return;
    }

    const taskData = taskDoc.data();
    if (taskData.milestones && taskData.milestones.length > 0) {
      const resetMilestones = taskData.milestones.map((milestone: any) => ({
        ...milestone,
        completed: false
      }));

      await updateDoc(taskRef, {
        milestones: resetMilestones,
        updatedAt: Timestamp.now()
      });

      console.log(`Milestones reset for reopened task ${taskId}`);
    }
  } catch (error) {
    console.error('Error resetting milestones on reopen:', error);
    throw error;
  }
}

/**
 * تحديث شامل للمهمة الأم بناءً على المهام الفرعية ونقاط التتبع
 * @param parentTaskId معرف المهمة الأم
 */
export async function updateParentTaskComprehensive(parentTaskId: string): Promise<void> {
  try {
    console.log(`[COMPREHENSIVE UPDATE] Starting comprehensive update for parent task ${parentTaskId}`);

    // تحديث نقاط التتبع أولاً
    console.log(`[COMPREHENSIVE UPDATE] Step 1: Updating milestones for parent task ${parentTaskId}`);
    await updateParentMilestones(parentTaskId);

    // ثم تحديث الحالة بناءً على المهام الفرعية ونقاط التتبع
    console.log(`[COMPREHENSIVE UPDATE] Step 2: Updating status for parent task ${parentTaskId}`);
    await updateParentTaskStatus(parentTaskId);

    console.log(`[COMPREHENSIVE UPDATE] Comprehensive update completed for parent task ${parentTaskId}`);
  } catch (error) {
    console.error(`[COMPREHENSIVE UPDATE] Error in comprehensive parent task update for ${parentTaskId}:`, error);
    throw error;
  }
}

/**
 * تحديث حالة المهمة بناءً على نقاط التتبع الخاصة بها
 * @param taskId معرف المهمة
 * @param milestones نقاط التتبع المحدثة
 * @param currentStatus الحالة الحالية للمهمة
 * @returns الحالة الجديدة للمهمة
 */
export function calculateTaskStatusFromMilestones(
  milestones: any[],
  currentStatus: TaskStatus
): TaskStatus {
  if (!milestones || milestones.length === 0) {
    return currentStatus;
  }

  const allMilestonesCompleted = milestones.every(m => m.completed);
  const anyMilestoneCompleted = milestones.some(m => m.completed);

  // منطق محدث لتحديد حالة المهمة بناءً على نقاط التتبع
  if (allMilestonesCompleted && currentStatus !== 'completed' && currentStatus !== 'cancelled') {
    return 'completed';
  } else if (anyMilestoneCompleted && (currentStatus === 'hold' || currentStatus === 'pending')) {
    return 'in-progress';
  }

  // في جميع الحالات الأخرى، نحافظ على الحالة الحالية
  return currentStatus;
}
