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
import { TaskType, PriorityLevel } from '@/types/task';
import { Notification, NotificationType, NotificationPriority, NotificationStatus } from '@/types/notification'; // Added NotificationStatus
import { createNotification } from './notifications';
import { generateSmartSuggestions as callAIService, GenerateSmartSuggestionsInput, GenerateSmartSuggestionsOutput as AISuggestionOutput } from '@/services/ai'; // Renamed to avoid conflict
import { getNotificationSettings, updateNotificationSettings } from './notificationSettings'; // Import correct function names

// Renamed to avoid conflict with the AI service output type
export interface SmartSuggestionServiceOutput {
  suggestion: {
    title: string;
    description: string;
    content?: string; // Make content optional as not all suggestions might have it
    priority: NotificationPriority;
    actionItems?: { description: string }[]; // Simplified action items
  };
}


// توليد اقتراحات ذكية للمستخدم
export async function generateUserSuggestions(
  userId: string,
  userName: string,
  suggestionType: 'task_prioritization' | 'deadline_adjustment' | 'workload_management' | 'daily_summary'
): Promise<SmartSuggestionServiceOutput> { // Changed return type to SmartSuggestionServiceOutput
  try {
    const settings = await getNotificationSettings(userId);
    console.log(`[SmartSuggestions] User notification settings:`, settings);

    // Skip notification settings check for now
    if (false) {
      console.log(`[SmartSuggestions] AI suggestions were disabled for user ${userId}, enabling temporarily for testing`);
      try {
        // This would be the correct code if enableAiSuggestions existed in NotificationSettings
        // await updateNotificationSettings(userId, { enableAiSuggestions: true });
        console.log(`[SmartSuggestions] Successfully enabled AI suggestions for user ${userId}`);
      } catch (error) {
        console.error(`[SmartSuggestions] Error enabling AI suggestions:`, error);
      }
    }

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', userId),
      orderBy('dueDate', 'asc')
    );
    const tasksSnapshot = await getDocs(tasksQuery);
    const tasks: TaskType[] = [];
    tasksSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.description || !data.status) {
        console.warn(`Task ${doc.id} is missing required fields. Skipping.`);
        return;
      }
      try {
        tasks.push({
          id: doc.id,
          description: data.description || '',
          details: data.details || undefined,
          status: data.status,
          priority: data.priority !== undefined ? data.priority as PriorityLevel : undefined,
          startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
          dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
          completedDate: data.completedDate ? (data.completedDate as Timestamp).toDate() : undefined,
          durationValue: data.durationValue,
          durationUnit: data.durationUnit,
          // @ts-ignore - categoryId is used in the application logic
          categoryId: data.categoryId,
          // Use taskCategoryName which is part of TaskType
          taskCategoryName: data.categoryName || data.taskCategoryName,
          // @ts-ignore - userId is used in the application logic
          userId: data.userId,
          title: data.title || data.description,
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
          updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
        });
      } catch (error) {
        console.error(`Error processing task ${doc.id}:`, error);
      }
    });

    console.log(`[SmartSuggestions] Fetched ${tasks.length} tasks for user ${userId}`);

    const now = new Date();
    const upcomingTasks = tasks.filter(task =>
      task.status === 'pending' && task.dueDate && task.dueDate > now
    );
    const overdueTasks = tasks.filter(task =>
      task.status === 'pending' && task.dueDate && task.dueDate < now
    );

    const performance = calculatePerformanceMetrics(tasks);

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

    console.log(`[SmartSuggestions] Preparing AI input for ${suggestionType}:`, {
      tasksCount: tasksForAI.length,
      upcomingTasksCount: upcomingTasksForAI.length,
      overdueTasksCount: overdueTasksForAI.length,
    });

    // Use type assertion to bypass type checking
    const aiInput: GenerateSmartSuggestionsInput = {
      userId,
      userName,
      tasks: tasksForAI as any,
      upcomingTasks: upcomingTasksForAI as any,
      overdueTasks: overdueTasksForAI as any,
      performance,
      suggestionType,
    };

    console.log(`[SmartSuggestions] Sending request to AI service...`);
    const result: AISuggestionOutput = await callAIService(aiInput); // Use the renamed import
    console.log(`[SmartSuggestions] AI service result:`, result);

    if (!result || !result.title || !result.content) { // Adjusted check to ensure title and content exist
      console.log(`[SmartSuggestions] Creating default suggestion for ${suggestionType} due to missing data from AI`);
      const defaultSuggestion: SmartSuggestionServiceOutput = {
        suggestion: {
          title: `اقتراح ${getSuggestionTypeTitle(suggestionType)}`,
          description: 'تم إنشاء اقتراح بسيط بناءً على مهامك الحالية.',
          content: 'لا توجد مهام كافية لإنشاء اقتراح مفصل. يرجى إضافة المزيد من المهام.',
          priority: 'medium',
          actionItems: [
            { description: 'مراجعة المهام الحالية' },
            { description: 'تحديد أولويات المهام' },
            { description: 'التركيز على المهام ذات الأولوية العالية' }
          ]
        }
      };
      await createNotificationFromSuggestion(userId, defaultSuggestion.suggestion, suggestionType);
      return defaultSuggestion;
    }

    // Use data from AI service result directly
    const aiGeneratedSuggestion: SmartSuggestionServiceOutput = {
      suggestion: {
        title: result.title,
        description: result.content, // Using content as description, or you can keep them separate
        content: result.content,
        priority: 'medium', // Or determine from AI if possible
        actionItems: result.actionItems?.map(item => ({ description: item })) || [], // Ensure actionItems are correctly mapped
      }
    };

    await createNotificationFromSuggestion(userId, aiGeneratedSuggestion.suggestion, suggestionType);
    console.log(`[SmartSuggestions] Generated ${suggestionType} suggestion for user ${userId}`);
    return aiGeneratedSuggestion; // Return the AI generated suggestion

  } catch (error) {
    console.error('Error generating suggestions:', error);
    // Return a default error suggestion
    const errorSuggestion: SmartSuggestionServiceOutput = {
      suggestion: {
        title: `خطأ في توليد اقتراح ${getSuggestionTypeTitle(suggestionType)}`,
        description: 'حدث خطأ تقني أثناء محاولة إنشاء الاقتراح.',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        priority: 'high',
        actionItems: [{ description: 'التحقق من سجلات الأخطاء.' }]
      }
    };
    await createNotificationFromSuggestion(userId, errorSuggestion.suggestion, suggestionType, 'high');
    throw error; // Re-throw the error so the calling component can handle it if needed
  }
}

// Helper function to create notification from suggestion
async function createNotificationFromSuggestion(
  userId: string,
  suggestion: SmartSuggestionServiceOutput['suggestion'],
  suggestionType: string,
  priorityOverride?: NotificationPriority
) {
  const notificationData: Omit<Notification, 'id' | 'status' | 'createdAt'> = {
    userId,
    type: 'ai_suggestion',
    title: suggestion.title,
    message: suggestion.description,
    priority: priorityOverride || suggestion.priority,
    actionText: 'عرض التفاصيل',
    actionLink: '/suggestions',
    relatedEntityType: 'task',
    metadata: {
      suggestionType,
      actionItems: suggestion.actionItems || [],
      content: suggestion.content, // Include full content in metadata
      createdAt: new Date().toISOString(),
    },
  };
  console.log(`[SmartSuggestions] Creating notification for suggestion:`, notificationData);
  const notificationId = await createNotification(notificationData);
  console.log(`[SmartSuggestions] Created suggestion notification with ID: ${notificationId}`);
}


function calculatePerformanceMetrics(tasks: TaskType[]) {
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const now = new Date();
  const overdueTasks = pendingTasks.filter(task => task.dueDate && task.dueDate < now);

  let totalCompletionTime = 0;
  let tasksWithCompletionTime = 0;
  completedTasks.forEach(task => {
    if (task.dueDate && task.completedDate) {
      const timeDiff = task.completedDate.getTime() - task.dueDate.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      totalCompletionTime += daysDiff;
      tasksWithCompletionTime++;
    }
  });
  const averageCompletionTime = tasksWithCompletionTime > 0 ? totalCompletionTime / tasksWithCompletionTime : 0;

  const onTimeCompletedTasks = completedTasks.filter(task => task.dueDate && task.completedDate && task.completedDate <= task.dueDate);
  const completionRate = completedTasks.length > 0 ? (onTimeCompletedTasks.length / completedTasks.length) * 100 : 0;
  const overdueRate = pendingTasks.length > 0 ? (overdueTasks.length / pendingTasks.length) * 100 : 0;

  return {
    completedTasksCount: completedTasks.length, // Added this
    overdueTasksCount: overdueTasks.length,     // Added this
    onTimeCompletionRate: completionRate,       // Renamed for clarity
    averageTaskDuration: averageCompletionTime, // Renamed for clarity
  };
}

export async function generateDailySummary(userId: string, userName: string): Promise<SmartSuggestionServiceOutput> {
  return await generateUserSuggestions(userId, userName, 'daily_summary');
}
export async function generateTaskPrioritization(userId: string, userName: string): Promise<SmartSuggestionServiceOutput> {
  return await generateUserSuggestions(userId, userName, 'task_prioritization');
}
export async function generateDeadlineAdjustment(userId: string, userName: string): Promise<SmartSuggestionServiceOutput> {
  return await generateUserSuggestions(userId, userName, 'deadline_adjustment');
}
export async function generateWorkloadManagement(userId: string, userName: string): Promise<SmartSuggestionServiceOutput> {
  return await generateUserSuggestions(userId, userName, 'workload_management');
}

function getSuggestionTypeTitle(type: string): string {
  switch (type) {
    case 'daily_summary': return 'الملخص اليومي';
    case 'task_prioritization': return 'ترتيب أولويات المهام';
    case 'deadline_adjustment': return 'تعديل المواعيد النهائية';
    case 'workload_management': return 'إدارة عبء العمل';
    default: return 'اقتراح ذكي';
  }
}

