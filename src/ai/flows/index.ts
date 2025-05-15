/**
 * ملف انتقالي لإعادة تصدير وظائف الذكاء الاصطناعي من خدمة src/services/ai.ts
 * 
 * هذا الملف يسمح للمكونات الحالية بالاستمرار في العمل دون تغيير، بينما نستخدم الوظائف الجديدة في الخادم الخلفي.
 * 
 * ملاحظة: هذا ملف مؤقت وسيتم إزالته بعد تحديث جميع المكونات لاستخدام خدمة src/services/ai.ts مباشرة.
 */

// استيراد جميع الوظائف من خدمة الذكاء الاصطناعي الجديدة
import * as aiService from '@/services/ai';

// إعادة تصدير جميع الأنواع والوظائف
export type {
  SuggestMilestonesInput,
  SuggestMilestonesOutput,
  SuggestMilestoneWeightsInput,
  SuggestMilestoneWeightsOutput,
  SuggestMilestoneDueDatesInput,
  SuggestMilestoneDueDatesOutput,
  SuggestSmartDueDateInput,
  SuggestSmartDueDateOutput,
  GenerateDailyPlanOutput,
  GenerateWeeklyReportInput,
  GenerateWeeklyReportOutput,
  GenerateSmartSuggestionsInput,
  GenerateSmartSuggestionsOutput,
  GenerateDailyMeetingAgendaInput,
  GenerateDailyMeetingAgendaOutput,
} from '@/services/ai';

// إعادة تصدير جميع الوظائف
export const {
  suggestMilestones,
  suggestMilestoneWeights,
  suggestMilestoneDueDates,
  suggestSmartDueDate,
  generateDailyPlan,
  generateWeeklyReport,
  generateSmartSuggestions,
  generateDailyMeetingAgenda,
} = aiService;
