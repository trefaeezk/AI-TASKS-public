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
import { getUserNotificationSettings, updateUserNotificationSettings } from './notifications';

// توليد اقتراحات ذكية للمستخدم
export async function generateUserSuggestions(
  userId: string,
  userName: string,
  suggestionType: 'task_prioritization' | 'deadline_adjustment' | 'workload_management' | 'daily_summary'
): Promise<string> {
  try {
    // التحقق من إعدادات الإشعارات للمستخدم
    const settings = await getUserNotificationSettings(userId);

    // تسجيل إعدادات الإشعارات للتحقق
    console.log(`[SmartSuggestions] User notification settings:`, settings);

    // تمكين اقتراحات الذكاء الاصطناعي مؤقتًا للتجربة
    if (!settings.enableAiSuggestions) {
      console.log(`[SmartSuggestions] AI suggestions were disabled for user ${userId}, enabling temporarily for testing`);
      // تحديث الإعدادات لتمكين اقتراحات الذكاء الاصطناعي
      try {
        await updateUserNotificationSettings(userId, {
          enableAiSuggestions: true
        });
        console.log(`[SmartSuggestions] Successfully enabled AI suggestions for user ${userId}`);
      } catch (error) {
        console.error(`[SmartSuggestions] Error enabling AI suggestions:`, error);
        // استمر في التنفيذ حتى لو فشل التحديث
      }
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

      // التحقق من وجود البيانات الأساسية
      if (!data.description || !data.status) {
        console.warn(`Task ${doc.id} is missing required fields. Skipping.`);
        return;
      }

      try {
        tasks.push({
          id: doc.id,
          title: data.title || data.description, // استخدام الوصف إذا كان العنوان غير موجود
          description: data.description || '',
          status: data.status,
          priority: data.priority !== undefined ? Number(data.priority) : undefined,
          startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
          dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
          completedDate: data.completedDate ? (data.completedDate as Timestamp).toDate() : undefined,
          durationValue: data.durationValue,
          durationUnit: data.durationUnit,
          categoryId: data.categoryId,
          categoryName: data.categoryName || data.taskCategoryName, // دعم الاسمين المختلفين
          userId: data.userId,
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
        });
      } catch (error) {
        console.error(`Error processing task ${doc.id}:`, error);
      }
    });

    console.log(`[SmartSuggestions] Fetched ${tasks.length} tasks for user ${userId}`);

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

    // تسجيل البيانات قبل إرسالها إلى خدمة الذكاء الاصطناعي
    console.log(`[SmartSuggestions] Preparing AI input for ${suggestionType}:`, {
      tasksCount: tasksForAI.length,
      upcomingTasksCount: upcomingTasksForAI.length,
      overdueTasksCount: overdueTasksForAI.length,
    });

    // توليد الاقتراح باستخدام الذكاء الاصطناعي
    const aiInput = {
      userId,
      userName,
      tasks: tasksForAI,
      upcomingTasks: upcomingTasksForAI,
      overdueTasks: overdueTasksForAI,
      performance,
      suggestionType,
    };

    console.log(`[SmartSuggestions] Sending request to AI service...`);
    const result = await generateSmartSuggestions(aiInput);

    // إنشاء إشعار بالاقتراح
    console.log(`[SmartSuggestions] AI service result:`, result);

    // التحقق من وجود البيانات المطلوبة
    if (!result || !result.suggestion) {
      console.log(`[SmartSuggestions] Creating default suggestion for ${suggestionType} due to missing data`);

      // إنشاء اقتراح افتراضي
      const notificationData: Omit<Notification, 'id' | 'status' | 'createdAt'> = {
        userId,
        type: 'ai_suggestion',
        title: `اقتراح ${getSuggestionTypeTitle(suggestionType)}`,
        message: 'تم إنشاء اقتراح بسيط بناءً على مهامك الحالية.',
        priority: 'normal',
        actionText: 'عرض التفاصيل',
        actionLink: '/suggestions',
        relatedEntityType: 'task',
        metadata: {
          suggestionType,
          actionItems: [
            { description: 'مراجعة المهام الحالية' },
            { description: 'تحديد أولويات المهام' },
            { description: 'التركيز على المهام ذات الأولوية العالية' }
          ],
          createdAt: new Date().toISOString(),
        },
      };

      console.log(`[SmartSuggestions] Creating notification with default data:`, notificationData);
      const notificationId = await createNotification(notificationData);
      console.log(`[SmartSuggestions] Created default suggestion with ID: ${notificationId}`);
      return notificationId;
    }

    // استخدام البيانات من نتيجة الخدمة
    const suggestion = result.suggestion;

    const notificationData: Omit<Notification, 'id' | 'status' | 'createdAt'> = {
      userId,
      type: 'ai_suggestion',
      title: suggestion.title || `اقتراح ${getSuggestionTypeTitle(suggestionType)}`,
      message: suggestion.description || suggestion.content || 'تم إنشاء اقتراح جديد',
      priority: suggestion.priority || 'normal',
      actionText: 'عرض التفاصيل',
      actionLink: '/suggestions',
      relatedEntityType: 'task',
      metadata: {
        suggestionType,
        actionItems: suggestion.actionItems || [],
        createdAt: new Date().toISOString(),
      },
    };

    console.log(`[SmartSuggestions] Creating notification for suggestion:`, notificationData);
    const notificationId = await createNotification(notificationData);

    console.log(`[SmartSuggestions] Generated ${suggestionType} suggestion for user ${userId}, notification ID: ${notificationId}`);

    return notificationId;
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
export async function generateDailySummary(userId: string, userName: string): Promise<string> {
  const notificationId = await generateUserSuggestions(userId, userName, 'daily_summary');
  return notificationId;
}

// توليد اقتراح لترتيب أولويات المهام
export async function generateTaskPrioritization(userId: string, userName: string): Promise<string> {
  const notificationId = await generateUserSuggestions(userId, userName, 'task_prioritization');
  return notificationId;
}

// توليد اقتراح لتعديل المواعيد النهائية
export async function generateDeadlineAdjustment(userId: string, userName: string): Promise<string> {
  const notificationId = await generateUserSuggestions(userId, userName, 'deadline_adjustment');
  return notificationId;
}

// توليد اقتراح لإدارة عبء العمل
export async function generateWorkloadManagement(userId: string, userName: string): Promise<string> {
  const notificationId = await generateUserSuggestions(userId, userName, 'workload_management');
  return notificationId;
}

// الحصول على عنوان نوع الاقتراح
function getSuggestionTypeTitle(type: string): string {
  switch (type) {
    case 'daily_summary':
      return 'الملخص اليومي';
    case 'task_prioritization':
      return 'ترتيب أولويات المهام';
    case 'deadline_adjustment':
      return 'تعديل المواعيد النهائية';
    case 'workload_management':
      return 'إدارة عبء العمل';
    default:
      return 'اقتراح ذكي';
  }
}
