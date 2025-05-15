/**
 * وظيفة Firebase لاقتراح نقاط تتبع (milestones) لمهمة معينة
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { generateJSON, validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../utils';
import { createCallableFunction } from '../../shared/function-utils';

// مخطط المدخلات
const SuggestMilestonesInputSchema = z.object({
  taskDescription: z.string().describe('وصف المهمة الرئيسي (العنوان).'),
  taskDetails: z.string().optional().describe('معلومات تفصيلية اختيارية عن المهمة.'),
});

// مخطط المخرجات
const SuggestMilestonesOutputSchema = z.object({
  suggestedMilestones: z.array(z.string()).describe('قائمة نقاط التتبع المقترحة بناءً على وصف المهمة وتفاصيلها. يهدف إلى 3-5 خطوات قابلة للتنفيذ بترتيب منطقي.')
});

// نوع المدخلات
export type SuggestMilestonesInput = z.infer<typeof SuggestMilestonesInputSchema>;

// نوع المخرجات
export type SuggestMilestonesOutput = z.infer<typeof SuggestMilestonesOutputSchema>;

/**
 * وظيفة Firebase لاقتراح نقاط تتبع لمهمة معينة
 */
export const suggestMilestones = createCallableFunction<SuggestMilestonesInput, SuggestMilestonesOutput>(async (request) => {
  const functionName = 'suggestMilestones';
  logFunctionStart(functionName, request.data);

  try {
    const { taskDescription, taskDetails } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['taskDescription']);

    // إنشاء نص الطلب
    const prompt = `
أنت مساعد ذكاء اصطناعي متخصص في إدارة المشاريع وتخطيط المهام. مهمتك هي تحليل وصف المهمة وتفاصيلها، واقتراح نقاط تتبع (milestones) منطقية ومفيدة.

**المهمة:**
العنوان/الوصف: ${taskDescription}
${taskDetails ? `التفاصيل الإضافية: ${taskDetails}` : ''}

**المطلوب:**
اقترح 3-5 نقاط تتبع (milestones) منطقية ومفيدة لهذه المهمة. يجب أن تكون:
1. مرتبة بشكل منطقي حسب تسلسل العمل
2. محددة وقابلة للقياس
3. تغطي المراحل الرئيسية لإكمال المهمة
4. مكتوبة بعبارات واضحة وموجزة باللغة العربية

**المخرجات المطلوبة:**
قائمة من نقاط التتبع المقترحة بتنسيق JSON كالتالي:
{
  "suggestedMilestones": [
    "وصف نقطة التتبع الأولى",
    "وصف نقطة التتبع الثانية",
    "وصف نقطة التتبع الثالثة",
    ...
  ]
}
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating milestones for task: ${taskDescription}`);
    const result = await generateJSON(prompt, SuggestMilestonesOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !Array.isArray(result.suggestedMilestones)) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في إنشاء نقاط تتبع صالحة.'
      );
    }

    logFunctionEnd(functionName, result);
    return result;

  } catch (error: any) {
    logFunctionError(functionName, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `فشل في اقتراح نقاط التتبع: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
