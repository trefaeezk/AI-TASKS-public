'use server';

/**
 * @fileOverview A flow for suggesting milestones (sub-tasks) for a given task based on its description and details.
 *
 * - suggestMilestones - Function to suggest milestones for a task.
 * - SuggestMilestonesInput - Input type for the suggestMilestones function.
 * - SuggestMilestonesOutput - Return type for the suggestMilestones function.
 */

import { ai } from '@/ai/ai';
import { z } from '@/ai/z';

// استيراد الوظيفة والأنواع من خدمة الذكاء الاصطناعي الجديدة
import { suggestMilestones as _suggestMilestones, type SuggestMilestonesInput as _SuggestMilestonesInput, type SuggestMilestonesOutput as _SuggestMilestonesOutput } from '@/services/ai';

// إعادة تصدير الوظيفة والأنواع
export type SuggestMilestonesInput = _SuggestMilestonesInput;
export type SuggestMilestonesOutput = _SuggestMilestonesOutput;
export const suggestMilestones = _suggestMilestones;
