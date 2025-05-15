/**
 * وظيفة Firebase لاقتراح تاريخ استحقاق ذكي للمهمة
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { generateJSON, validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../utils';
import { createCallableFunction } from '../../shared/function-utils';

// مخطط المدخلات
const SuggestSmartDueDateInputSchema = z.object({
  taskDescription: z.string().describe('وصف المهمة الرئيسي (العنوان).'),
  taskDetails: z.string().optional().describe('معلومات تفصيلية اختيارية عن المهمة.'),
  startDate: z.string().optional().describe('تاريخ بدء المهمة بصيغة YYYY-MM-DD.'),
  duration: z.number().optional().describe('مدة المهمة.'),
  durationUnit: z.enum(['minutes', 'hours', 'days', 'weeks']).optional().describe('وحدة مدة المهمة.'),
  priority: z.number().min(1).max(4).optional().describe('أولوية المهمة (1: حرجة، 2: عالية، 3: متوسطة، 4: منخفضة).'),
  userWorkload: z.number().min(0).max(100).optional().describe('نسبة انشغال المستخدم الحالية (0-100).'),
});

// مخطط المخرجات
const SuggestSmartDueDateOutputSchema = z.object({
  suggestedDueDate: z.string().describe('تاريخ الاستحقاق المقترح بصيغة YYYY-MM-DD.'),
  reasoning: z.string().describe('سبب اقتراح هذا التاريخ.'),
});

// نوع المدخلات
export type SuggestSmartDueDateInput = z.infer<typeof SuggestSmartDueDateInputSchema>;

// نوع المخرجات
export type SuggestSmartDueDateOutput = z.infer<typeof SuggestSmartDueDateOutputSchema>;

/**
 * وظيفة Firebase لاقتراح تاريخ استحقاق ذكي للمهمة
 */
export const suggestSmartDueDate = createCallableFunction<SuggestSmartDueDateInput, SuggestSmartDueDateOutput>(async (request) => {
  const functionName = 'suggestSmartDueDate';
  logFunctionStart(functionName, request.data);

  try {
    const { taskDescription, taskDetails, startDate, duration, durationUnit, priority, userWorkload } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['taskDescription']);

    // الحصول على التاريخ الحالي
    const currentDate = new Date().toISOString().split('T')[0];

    // إنشاء نص الطلب
    const prompt = `
أنت مساعد ذكاء اصطناعي متخصص في إدارة المهام وتخطيط الوقت. مهمتك هي اقتراح تاريخ استحقاق منطقي ومناسب للمهمة بناءً على المعلومات المتوفرة.

**المهمة:**
العنوان/الوصف: ${taskDescription}
${taskDetails ? `التفاصيل الإضافية: ${taskDetails}` : ''}
${startDate ? `تاريخ البدء: ${startDate}` : `تاريخ اليوم: ${currentDate}`}
${duration !== undefined ? `المدة المتوقعة: ${duration} ${durationUnit || 'أيام'}` : ''}
${priority !== undefined ? `الأولوية: ${priority} (1: حرجة، 2: عالية، 3: متوسطة، 4: منخفضة)` : ''}
${userWorkload !== undefined ? `نسبة انشغال المستخدم الحالية: ${userWorkload}%` : ''}

**المطلوب:**
اقترح تاريخ استحقاق منطقي ومناسب لهذه المهمة مع مراعاة:
1. طبيعة المهمة ووصفها
2. تاريخ البدء (إذا كان متوفرًا) أو تاريخ اليوم
3. المدة المتوقعة (إذا كانت متوفرة)
4. أولوية المهمة (إذا كانت متوفرة)
5. نسبة انشغال المستخدم (إذا كانت متوفرة)

**المخرجات المطلوبة:**
تاريخ الاستحقاق المقترح وسبب اقتراحه بتنسيق JSON كالتالي:
{
  "suggestedDueDate": "YYYY-MM-DD",
  "reasoning": "سبب اقتراح هذا التاريخ"
}

تأكد من أن التاريخ المقترح:
- يكون بصيغة YYYY-MM-DD
- يكون بعد تاريخ البدء (إذا كان متوفرًا) أو بعد تاريخ اليوم
- يكون منطقيًا ومناسبًا لطبيعة المهمة
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Suggesting smart due date for task: ${taskDescription}`);
    const result = await generateJSON(prompt, SuggestSmartDueDateOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !result.suggestedDueDate || !result.reasoning) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في اقتراح تاريخ استحقاق صالح.'
      );
    }

    // التحقق من صيغة التاريخ
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.suggestedDueDate)) {
      console.error("[AI] Invalid date format:", result.suggestedDueDate);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في اقتراح تاريخ استحقاق بصيغة صحيحة.'
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
      `فشل في اقتراح تاريخ استحقاق ذكي: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
