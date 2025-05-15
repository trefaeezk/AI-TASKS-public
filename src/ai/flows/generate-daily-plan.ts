'use server';

/**
 * @fileOverview AI flow to generate a suggested daily plan based on tasks, identify overdue tasks, and provide observations.
 *
 * - generateDailyPlan - Function to generate the daily plan.
 * - GenerateDailyPlanInputTask - Input task type.
 * - GenerateDailyPlanOutput - Output type including plan, warnings, and observations.
 * - PlannedTask - Type for tasks included in the daily plan with reasoning.
 * - OverdueTaskWarning - Type for overdue task warnings with reasoning.
 */

import { ai } from '@/ai/ai';
import { z } from '@/ai/z';
import { format } from 'date-fns';
import type { TaskStatus, PriorityLevel, DurationUnit } from '@/types/task';

// استيراد الوظيفة والأنواع من خدمة الذكاء الاصطناعي الجديدة
import { generateDailyPlan as _generateDailyPlan, Task } from '@/services/ai';

// إعادة تصدير الوظيفة
export const generateDailyPlan = _generateDailyPlan;

// تعريف الأنواع للتوافق مع الكود القديم
export interface GenerateDailyPlanInputTask {
  taskId: string;
  description: string;
  details?: string;
  startDate?: Date;
  dueDate?: Date;
  priority?: number;
  status: string;
}

export type GenerateDailyPlanInput = GenerateDailyPlanInputTask[];

export interface PlannedTask {
  taskId: string;
  reasoning: string;
}

export interface OverdueTaskWarning {
  taskId: string;
  reason: string;
}

export interface GenerateDailyPlanOutput {
  dailyPlan: PlannedTask[];
  overdueWarnings: OverdueTaskWarning[];
  observations: string[];
}
