/**
 * أنواع البيانات المشتركة لوظائف الذكاء الاصطناعي
 */

import { z } from 'zod';

/**
 * أنواع أولوية المهمة
 */
export enum PriorityLevel {
  Critical = 1,
  High = 2,
  Medium = 3,
  Low = 4,
}

/**
 * أنواع حالة المهمة
 */
export enum TaskStatus {
  Pending = 'pending',
  Hold = 'hold',
  InProgress = 'in-progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

/**
 * أنواع وحدة المدة
 */
export enum DurationUnit {
  Minutes = 'minutes',
  Hours = 'hours',
  Days = 'days',
  Weeks = 'weeks',
}

/**
 * مخطط المهمة الأساسي
 */
export const BaseTaskSchema = z.object({
  id: z.string().describe('معرف المهمة.'),
  title: z.string().describe('عنوان المهمة.'),
  description: z.string().optional().describe('وصف المهمة.'),
  priority: z.number().min(1).max(4).optional().describe('أولوية المهمة (1: حرجة، 2: عالية، 3: متوسطة، 4: منخفضة).'),
  status: z.enum(['hold', 'in-progress', 'completed', 'cancelled']).describe('حالة المهمة.'),
  startDate: z.string().optional().describe('تاريخ بدء المهمة بصيغة YYYY-MM-DD.'),
  dueDate: z.string().optional().describe('تاريخ استحقاق المهمة بصيغة YYYY-MM-DD.'),
  completedDate: z.string().optional().describe('تاريخ إكمال المهمة بصيغة YYYY-MM-DD.'),
  duration: z.number().optional().describe('مدة المهمة.'),
  durationUnit: z.enum(['minutes', 'hours', 'days', 'weeks']).optional().describe('وحدة مدة المهمة.'),
  category: z.string().optional().describe('فئة المهمة.'),
  tags: z.array(z.string()).optional().describe('وسوم المهمة.'),
});

/**
 * مخطط نقطة التتبع الأساسي
 */
export const BaseMilestoneSchema = z.object({
  id: z.string().describe('معرف نقطة التتبع.'),
  description: z.string().describe('وصف نقطة التتبع.'),
  completed: z.boolean().optional().describe('ما إذا كانت نقطة التتبع مكتملة.'),
  weight: z.number().min(0).max(100).optional().describe('وزن نقطة التتبع (نسبة مئوية).'),
  dueDate: z.string().optional().describe('تاريخ استحقاق نقطة التتبع بصيغة YYYY-MM-DD.'),
});

/**
 * مخطط أداء المستخدم
 */
export const UserPerformanceSchema = z.object({
  completedTasksCount: z.number().describe('عدد المهام المكتملة.'),
  overdueTasksCount: z.number().describe('عدد المهام المتأخرة.'),
  onTimeCompletionRate: z.number().describe('معدل إكمال المهام في الوقت المحدد.'),
  averageTaskDuration: z.number().optional().describe('متوسط مدة إكمال المهام.'),
});
