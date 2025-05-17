/**
 * خدمات الذكاء الاصطناعي
 *
 * هذا الملف يحتوي على دوال لاستدعاء وظائف الذكاء الاصطناعي في Firebase Functions
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

// أنواع البيانات المستخدمة في وظائف الذكاء الاصطناعي
export interface Milestone {
  id: string;
  description: string;
  completed?: boolean;
  weight?: number;
  dueDate?: string;
}

export interface Task {
  id: string;
  description: string;
  details?: string;
  priority?: string | number;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  completedDate?: Date;
  progress?: number;
  departmentId?: string;
  departmentName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
}

export interface UserPerformance {
  completedTasksCount: number;
  overdueTasksCount: number;
  onTimeCompletionRate: number;
  averageTaskDuration?: number;
}

// أنواع البيانات لوظيفة اقتراح نقاط التتبع
export interface SuggestMilestonesInput {
  taskDescription: string;
  taskDetails?: string;
}

export interface SuggestMilestonesOutput {
  suggestedMilestones: string[];
}

// أنواع البيانات لوظيفة اقتراح أوزان نقاط التتبع
export interface SuggestMilestoneWeightsInput {
  taskDescription: string;
  taskDetails?: string;
  milestones: { id: string; description: string }[];
}

export interface SuggestMilestoneWeightsOutput {
  weightedMilestones: { id: string; description: string; weight: number }[];
}

// أنواع البيانات لوظيفة اقتراح تواريخ استحقاق نقاط التتبع
export interface SuggestMilestoneDueDatesInput {
  taskDescription: string;
  taskDetails?: string;
  taskStartDate?: string;
  taskDueDate?: string;
  milestones: { id: string; description: string; weight: number }[];
}

export interface SuggestMilestoneDueDatesOutput {
  milestonesWithDueDates: { id: string; description: string; weight: number; dueDate: string; reasoning?: string }[];
}

// أنواع البيانات لوظيفة اقتراح تاريخ استحقاق ذكي
export interface SuggestSmartDueDateInput {
  taskDescription: string;
  taskDetails?: string;
  startDate?: string;
  duration?: number;
  durationUnit?: 'minutes' | 'hours' | 'days' | 'weeks';
  priority?: number;
  userWorkload?: number;
}

export interface SuggestSmartDueDateOutput {
  suggestedDueDate: string;
  reasoning: string;
}

// أنواع البيانات لوظيفة إنشاء خطة يومية
export interface GenerateDailyPlanOutput {
  dailyPlan: {
    id: string;
    title: string;
    priority?: number;
    dueDate?: string;
    reasoning: string;
  }[];
  overdueWarnings: {
    id: string;
    title: string;
    dueDate: string;
    reasoning: string;
  }[];
  observations: string[];
}

// أنواع البيانات لوظيفة إنشاء تقرير أسبوعي
export interface GenerateWeeklyReportInput {
  tasks: Task[];
  startDate?: Date;
  endDate?: Date;
  departmentId?: string;
  departmentName?: string;
  userId?: string;
  userName?: string;
  organizationId?: string;
  organizationName?: string;
}

export interface TaskSummary {
  id: string;
  description?: string;
  title?: string; // بعض الخدمات الخلفية تستخدم title بدلاً من description
  status: string;
  progress: number;
  highlight?: boolean;
  comment?: string;
  notes?: string; // بعض الخدمات الخلفية تستخدم notes بدلاً من comment
  priority?: number | string; // يمكن أن يكون رقم أو نص (high, medium, low)
  dueDate?: string;
  completedDate?: string;
}

export interface GenerateWeeklyReportOutput {
  title?: string;
  period: {
    startDate: string;
    endDate: string;
  } | string; // Allow string for backward compatibility
  summary?: string;
  stats?: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  keyMetrics?: {
    completionRate: number;
    onTimeCompletionRate: number;
    averageProgress: number;
  };
  completedTasks: TaskSummary[];
  overdueTasks?: TaskSummary[];
  upcomingTasks: TaskSummary[];
  inProgressTasks?: TaskSummary[];
  blockedTasks?: TaskSummary[];
  observations?: string[];
  recommendations?: string[];
}

// أنواع البيانات لوظيفة إنشاء اقتراحات ذكية
export type SuggestionType = 'task_prioritization' | 'deadline_adjustment' | 'workload_management' | 'daily_summary';

export interface GenerateSmartSuggestionsInput {
  userId: string;
  userName: string;
  tasks: Task[];
  upcomingTasks: Task[];
  overdueTasks: Task[];
  performance: UserPerformance;
  suggestionType: SuggestionType;
}

export interface GenerateSmartSuggestionsOutput {
  title: string;
  content: string;
  actionItems?: string[];
  relatedTaskIds?: string[];
}

// أنواع البيانات لوظيفة إنشاء جدول أعمال الاجتماع اليومي
export interface GenerateDailyMeetingAgendaInput {
  departmentName: string;
  date: string;
  tasks: Task[];
  previousMeetingNotes?: string;
  teamMembers?: string[];
  duration?: number;
  focusAreas?: string[];
}

export interface GenerateDailyMeetingAgendaOutput {
  meetingTitle: string;
  date: string;
  duration: number;
  agenda: {
    id?: string;
    title: string;
    description: string;
    duration: number;
    priority: number;
    relatedTaskIds?: string[];
    type: 'update' | 'discussion' | 'decision' | 'action_item' | 'other';
  }[];
  objectives: string[];
  notes?: string;
}

/**
 * اقتراح نقاط تتبع لمهمة معينة
 * @param input بيانات المدخلات
 * @returns نقاط التتبع المقترحة
 */
export async function suggestMilestones(input: SuggestMilestonesInput): Promise<SuggestMilestonesOutput> {
  try {
    const suggestMilestonesFn = httpsCallable<SuggestMilestonesInput, SuggestMilestonesOutput>(
      functions,
      'suggestMilestones'
    );

    const result = await suggestMilestonesFn(input);
    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in suggestMilestones:', error);
    throw new Error('فشل في اقتراح نقاط التتبع. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * اقتراح أوزان لنقاط تتبع المهمة
 * @param input بيانات المدخلات
 * @returns نقاط التتبع مع الأوزان المقترحة
 */
export async function suggestMilestoneWeights(input: SuggestMilestoneWeightsInput): Promise<SuggestMilestoneWeightsOutput> {
  try {
    const suggestMilestoneWeightsFn = httpsCallable<SuggestMilestoneWeightsInput, SuggestMilestoneWeightsOutput>(
      functions,
      'suggestMilestoneWeights'
    );

    const result = await suggestMilestoneWeightsFn(input);
    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in suggestMilestoneWeights:', error);
    throw new Error('فشل في اقتراح أوزان نقاط التتبع. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * اقتراح تواريخ استحقاق لنقاط تتبع المهمة
 * @param input بيانات المدخلات
 * @returns نقاط التتبع مع تواريخ الاستحقاق المقترحة
 */
export async function suggestMilestoneDueDates(input: SuggestMilestoneDueDatesInput): Promise<SuggestMilestoneDueDatesOutput> {
  try {
    const suggestMilestoneDueDatesFn = httpsCallable<SuggestMilestoneDueDatesInput, SuggestMilestoneDueDatesOutput>(
      functions,
      'suggestMilestoneDueDates'
    );

    const result = await suggestMilestoneDueDatesFn(input);
    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in suggestMilestoneDueDates:', error);
    throw new Error('فشل في اقتراح تواريخ استحقاق لنقاط التتبع. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * اقتراح تاريخ استحقاق ذكي للمهمة
 * @param input بيانات المدخلات
 * @returns تاريخ الاستحقاق المقترح وسبب اقتراحه
 */
export async function suggestSmartDueDate(input: SuggestSmartDueDateInput): Promise<SuggestSmartDueDateOutput> {
  try {
    const suggestSmartDueDateFn = httpsCallable<SuggestSmartDueDateInput, SuggestSmartDueDateOutput>(
      functions,
      'suggestSmartDueDate'
    );

    const result = await suggestSmartDueDateFn(input);
    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in suggestSmartDueDate:', error);
    throw new Error('فشل في اقتراح تاريخ استحقاق ذكي. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * إنشاء خطة يومية للمهام
 * @param tasks قائمة المهام
 * @returns الخطة اليومية المقترحة
 */
export async function generateDailyPlan(tasks: Task[]): Promise<GenerateDailyPlanOutput> {
  try {
    const generateDailyPlanFn = httpsCallable<{ tasks: Task[] }, GenerateDailyPlanOutput>(
      functions,
      'generateDailyPlan'
    );

    const result = await generateDailyPlanFn({ tasks });
    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in generateDailyPlan:', error);
    throw new Error('فشل في إنشاء خطة يومية. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * إنشاء تقرير أسبوعي للمهام
 * @param input بيانات المدخلات
 * @returns التقرير الأسبوعي المقترح
 */
export async function generateWeeklyReport(input: GenerateWeeklyReportInput): Promise<GenerateWeeklyReportOutput> {
  try {
    // تحويل التواريخ إلى سلاسل نصية
    const formattedInput = {
      tasks: input.tasks,
      startDate: input.startDate ? input.startDate.toISOString().split('T')[0] : undefined,
      endDate: input.endDate ? input.endDate.toISOString().split('T')[0] : undefined,
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      userId: input.userId,
      userName: input.userName,
      organizationId: input.organizationId,
      organizationName: input.organizationName
    };

    const generateWeeklyReportFn = httpsCallable<typeof formattedInput, GenerateWeeklyReportOutput>(
      functions,
      'generateWeeklyReport'
    );

    const result = await generateWeeklyReportFn(formattedInput);
    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in generateWeeklyReport:', error);
    throw new Error('فشل في إنشاء تقرير أسبوعي. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * إنشاء اقتراحات ذكية للمستخدم
 * @param input بيانات المدخلات
 * @returns الاقتراح الذكي المقترح
 */
export async function generateSmartSuggestions(input: GenerateSmartSuggestionsInput): Promise<GenerateSmartSuggestionsOutput> {
  try {
    console.log('[AI Service] Generating smart suggestions with input:', {
      userId: input.userId,
      userName: input.userName,
      suggestionType: input.suggestionType,
      tasksCount: input.tasks.length,
      upcomingTasksCount: input.upcomingTasks.length,
      overdueTasksCount: input.overdueTasks.length,
      performance: input.performance
    });

    // تسجيل المهام للتحقق
    if (input.tasks.length > 0) {
      console.log('[AI Service] First task in input:', input.tasks[0]);
    } else {
      console.log('[AI Service] No tasks provided in input!');
      // إذا لم تكن هناك مهام، نقوم بإنشاء اقتراح بسيط
      return {
        suggestion: {
          title: `اقتراح ${input.suggestionType}`,
          description: 'لا توجد مهام كافية لإنشاء اقتراح مفصل. يرجى إضافة المزيد من المهام.',
          content: 'لا توجد مهام كافية لإنشاء اقتراح مفصل. يرجى إضافة المزيد من المهام.',
          priority: 'normal',
          actionItems: []
        }
      };
    }

    const generateSmartSuggestionsFn = httpsCallable<GenerateSmartSuggestionsInput, GenerateSmartSuggestionsOutput>(
      functions,
      'generateSmartSuggestions'
    );

    console.log('[AI Service] Calling Firebase function generateSmartSuggestions...');
    const result = await generateSmartSuggestionsFn(input);
    console.log('[AI Service] Firebase function result:', result.data);

    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in generateSmartSuggestions:', error);

    // إنشاء اقتراح بسيط في حالة الخطأ
    return {
      suggestion: {
        title: `اقتراح ${input.suggestionType} (تم إنشاؤه محليًا)`,
        description: 'حدث خطأ أثناء توليد الاقتراح. هذا اقتراح بسيط تم إنشاؤه محليًا.',
        content: 'حدث خطأ أثناء توليد الاقتراح. يرجى المحاولة مرة أخرى لاحقًا.',
        priority: 'normal',
        actionItems: [
          { description: 'التحقق من اتصال الإنترنت' },
          { description: 'التحقق من وجود مهام كافية' },
          { description: 'المحاولة مرة أخرى لاحقًا' }
        ]
      }
    };
  }
}

/**
 * إنشاء جدول أعمال الاجتماع اليومي
 * @param input بيانات المدخلات
 * @returns جدول أعمال الاجتماع اليومي المقترح
 */
export async function generateDailyMeetingAgenda(input: GenerateDailyMeetingAgendaInput): Promise<GenerateDailyMeetingAgendaOutput> {
  try {
    const generateDailyMeetingAgendaFn = httpsCallable<GenerateDailyMeetingAgendaInput, GenerateDailyMeetingAgendaOutput>(
      functions,
      'generateDailyMeetingAgenda'
    );

    const result = await generateDailyMeetingAgendaFn(input);
    return result.data;
  } catch (error) {
    console.error('[AI Service] Error in generateDailyMeetingAgenda:', error);
    throw new Error('فشل في إنشاء جدول أعمال الاجتماع اليومي. يرجى المحاولة مرة أخرى.');
  }
}
