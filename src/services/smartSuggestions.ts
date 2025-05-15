'use client';

import { db } from '@/config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { TaskType } from '@/types/task';
import { Notification } from '@/types/notification';
import { createNotification } from './notifications';
import { generateSmartSuggestions } from '@/services/ai';
import { getUserNotificationSettings } from './notifications';

// توليد اقتراحات ذكية للمستخدم
export async function generateUserSuggestions(
  userId: string,
  userName: string,
  suggestionType: 'task_prioritization' | 'deadline_adjustment' | 'workload_management' | 'daily_summary'
): Promise<void> {
  try {
    // التحقق من إعدادات الإشعارات للمستخدم
    const settings = await getUserNotificationSettings(userId);

    // إذا كانت اقتراحات الذكاء الاصطناعي معطلة، لا تقم بتوليد اقتراحات
    if (!settings.enableAiSuggestions) {
      console.log('AI suggestions are disabled for user:', userId);
      return;
    }

    // جلب المهام الحالية للمستخدم
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', userId),
      orderBy('dueDate', 'asc')
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    const tasks: TaskType[] = [];

    tasksSnapshot.forEach((doc) => {
      const data = doc.data();
      tasks.push({
        id: doc.id,
        title: data.title,
        description: data.description || '',
        status: data.status,
        priority: data.priority,
        startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
        dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
        completedDate: data.completedDate ? (data.completedDate as Timestamp).toDate() : undefined,
        durationValue: data.durationValue,
        durationUnit: data.durationUnit,
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        userId: data.userId,
        createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
      });
    });

    // تصنيف المهام
    const now = new Date();

    const upcomingTasks = tasks.filter(task =>
      task.status === 'pending' &&
      task.dueDate &&
      task.dueDate > now
    );

    const overdueTasks = tasks.filter(task =>
      task.status === 'pending' &&
      task.dueDate &&
      task.dueDate < now
    );

    const completedTasks = tasks.filter(task =>
      task.status === 'completed'
    );

    // حساب مقاييس الأداء
    const performance = calculatePerformanceMetrics(tasks);

    // تحضير بيانات المهام للذكاء الاصطناعي
    const tasksForAI = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : undefined,
      completedDate: task.completedDate ? task.completedDate.toISOString().split('T')[0] : undefined,
    }));

    const upcomingTasksForAI = upcomingTasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : undefined,
    }));

    const overdueTasksForAI = overdueTasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : undefined,
    }));

    // توليد الاقتراح باستخدام الذكاء الاصطناعي
    const result = await generateSmartSuggestions({
      userId,
      userName,
      tasks: tasksForAI,
      upcomingTasks: upcomingTasksForAI,
      overdueTasks: overdueTasksForAI,
      performance,
      suggestionType,
    });

    // إنشاء إشعار بالاقتراح
    const suggestion = result.suggestion;

    const notificationData: Omit<Notification, 'id' | 'status' | 'createdAt'> = {
      userId,
      type: 'ai_suggestion',
      title: suggestion.title,
      message: suggestion.description,
      priority: suggestion.priority,
      actionText: 'عرض التفاصيل',
      actionLink: '/suggestions',
      relatedEntityType: 'task',
      metadata: {
        suggestionType,
        actionItems: suggestion.actionItems,
      },
    };

    await createNotification(notificationData);

    console.log(`Generated ${suggestionType} suggestion for user:`, userId);
  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw error;
  }
}

// حساب مقاييس الأداء للمستخدم
function calculatePerformanceMetrics(tasks: TaskType[]) {
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');

  const now = new Date();
  const overdueTasks = pendingTasks.filter(task =>
    task.dueDate && task.dueDate < now
  );

  // حساب متوسط وقت الإكمال (بالأيام)
  let totalCompletionTime = 0;
  let tasksWithCompletionTime = 0;

  completedTasks.forEach(task => {
    if (task.dueDate && task.completedDate) {
      const dueDate = task.dueDate;
      const completedDate = task.completedDate;
      const timeDiff = completedDate.getTime() - dueDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);

      totalCompletionTime += daysDiff;
      tasksWithCompletionTime++;
    }
  });

  const averageCompletionTime = tasksWithCompletionTime > 0
    ? totalCompletionTime / tasksWithCompletionTime
    : 0;

  // حساب معدل الإكمال في الوقت المحدد
  const onTimeCompletedTasks = completedTasks.filter(task => {
    if (task.dueDate && task.completedDate) {
      return task.completedDate <= task.dueDate;
    }
    return false;
  });

  const completionRate = completedTasks.length > 0
    ? (onTimeCompletedTasks.length / completedTasks.length) * 100
    : 0;

  // حساب معدل المهام المتأخرة
  const overdueRate = pendingTasks.length > 0
    ? (overdueTasks.length / pendingTasks.length) * 100
    : 0;

  // حساب توزيع المهام حسب الحالة
  const taskDistribution: Record<string, number> = {
    completed: completedTasks.length,
    pending: pendingTasks.length,
    overdue: overdueTasks.length,
  };

  return {
    averageCompletionTime,
    completionRate,
    overdueRate,
    taskDistribution,
  };
}

// توليد الملخص اليومي للمستخدم
export async function generateDailySummary(userId: string, userName: string): Promise<void> {
  return generateUserSuggestions(userId, userName, 'daily_summary');
}

// توليد اقتراح لترتيب أولويات المهام
export async function generateTaskPrioritization(userId: string, userName: string): Promise<void> {
  return generateUserSuggestions(userId, userName, 'task_prioritization');
}

// توليد اقتراح لتعديل المواعيد النهائية
export async function generateDeadlineAdjustment(userId: string, userName: string): Promise<void> {
  return generateUserSuggestions(userId, userName, 'deadline_adjustment');
}

// توليد اقتراح لإدارة عبء العمل
export async function generateWorkloadManagement(userId: string, userName: string): Promise<void> {
  return generateUserSuggestions(userId, userName, 'workload_management');
}
