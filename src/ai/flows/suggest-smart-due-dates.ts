'use server';

/**
 * @fileOverview A flow for suggesting smart due dates for tasks based on their description, start date, and duration.
 *
 * - suggestSmartDueDate - A function that suggests a smart due date for a task.
 * - SuggestSmartDueDateInput - The input type for the suggestSmartDueDate function.
 * - SuggestSmartDueDateOutput - The return type for the suggestSmartDueDate function.
 */

import { ai } from '@/ai/ai';
import { z } from 'zod';

// Define Duration Unit type for Zod schema
const DurationUnitSchema = z.enum(['hours', 'days', 'weeks']).optional();
export type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';

// استيراد الوظيفة والأنواع من خدمة الذكاء الاصطناعي الجديدة
import { suggestSmartDueDate as _suggestSmartDueDate, type SuggestSmartDueDateInput as _SuggestSmartDueDateInput, type SuggestSmartDueDateOutput as _SuggestSmartDueDateOutput } from '@/services/ai';

// إعادة تصدير الوظيفة والأنواع
export type SuggestSmartDueDateInput = _SuggestSmartDueDateInput;
export type SuggestSmartDueDateOutput = _SuggestSmartDueDateOutput;
export const suggestSmartDueDate = _suggestSmartDueDate;
