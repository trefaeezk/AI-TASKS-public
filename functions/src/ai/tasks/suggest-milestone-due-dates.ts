/**
 * وظيفة Firebase لاقتراح تواريخ استحقاق لنقاط تتبع المهمة
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { generateJSON, validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../utils';
import { createCallableFunction } from '../../shared/function-utils';

// مخطط نقطة التتبع المدخلة
const MilestoneInputSchema = z.object({
  id: z.string().describe('معرف نقطة التتبع.'),
  description: z.string().describe('وصف نقطة التتبع.'),
  weight: z.number().min(0).max(100).describe('وزن نقطة التتبع (نسبة مئوية من 0 إلى 100).'),
});

// مخطط المدخلات
const SuggestMilestoneDueDatesInputSchema = z.object({
  taskDescription: z.string().describe('وصف المهمة الرئيسي (العنوان).'),
  taskDetails: z.string().optional().describe('معلومات تفصيلية اختيارية عن المهمة.'),
  taskStartDate: z.string().optional().describe('تاريخ بدء المهمة بصيغة YYYY-MM-DD.'),
  taskDueDate: z.string().optional().describe('تاريخ استحقاق المهمة بصيغة YYYY-MM-DD.'),
  milestones: z.array(MilestoneInputSchema).describe('قائمة نقاط التتبع مع أوزانها.'),
});

// مخطط نقطة التتبع مع تاريخ الاستحقاق المقترح
const MilestoneWithDueDateSchema = z.object({
  id: z.string().describe('معرف نقطة التتبع.'),
  description: z.string().describe('وصف نقطة التتبع.'),
  weight: z.number().min(0).max(100).describe('وزن نقطة التتبع (نسبة مئوية من 0 إلى 100).'),
  dueDate: z.string().describe('تاريخ الاستحقاق المقترح بصيغة YYYY-MM-DD.'),
  reasoning: z.string().optional().describe('سبب اقتراح هذا التاريخ.'),
});

// مخطط المخرجات
const SuggestMilestoneDueDatesOutputSchema = z.object({
  milestonesWithDueDates: z.array(MilestoneWithDueDateSchema).describe('قائمة نقاط التتبع، كل منها مع تاريخ استحقاق مقترح.'),
});

// نوع المدخلات
export type SuggestMilestoneDueDatesInput = z.infer<typeof SuggestMilestoneDueDatesInputSchema>;

// نوع المخرجات
export type SuggestMilestoneDueDatesOutput = z.infer<typeof SuggestMilestoneDueDatesOutputSchema>;

/**
 * وظيفة Firebase لاقتراح تواريخ استحقاق لنقاط تتبع المهمة
 */
export const suggestMilestoneDueDates = createCallableFunction<SuggestMilestoneDueDatesInput, SuggestMilestoneDueDatesOutput>(async (request) => {
  const functionName = 'suggestMilestoneDueDates';
  logFunctionStart(functionName, request.data);

  try {
    const { taskDescription, taskDetails, taskStartDate, taskDueDate, milestones } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['taskDescription', 'milestones']);

    if (!Array.isArray(milestones) || milestones.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير قائمة غير فارغة من نقاط التتبع.'
      );
    }

    // التحقق من أن مجموع الأوزان يساوي 100
    const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0);
    if (Math.abs(totalWeight - 100) > 1) { // نسمح بهامش خطأ صغير
      throw new functions.https.HttpsError(
        'invalid-argument',
        `مجموع أوزان نقاط التتبع (${totalWeight}%) يجب أن يساوي 100%.`
      );
    }

    // الحصول على التاريخ الحالي بصيغة YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // إنشاء نص الطلب
    const prompt = `
أنت مساعد ذكاء اصطناعي متخصص في إدارة المشاريع وتخطيط المهام. مهمتك هي اقتراح تواريخ استحقاق دقيقة ومنطقية لنقاط التتبع (milestones) بناءً على أوزانها النسبية والإطار الزمني الكلي للمهمة.

**المهمة الرئيسية:**
العنوان/الوصف: ${taskDescription}
${taskDetails ? `التفاصيل الإضافية: ${taskDetails}` : ''}
${taskStartDate ? `تاريخ البدء: ${taskStartDate}` : `تاريخ البدء الافتراضي (اليوم): ${today}`}
${taskDueDate ? `تاريخ الاستحقاق: ${taskDueDate}` : ''}

**نقاط التتبع المطلوب اقتراح تواريخ استحقاق لها:**
${milestones.map((m, i) => `${i + 1}. المعرف: ${m.id}\n   الوصف: ${m.description}\n   الوزن: ${m.weight}%`).join('\n')}

**قواعد صارمة يجب اتباعها:**
1. يجب أن تكون جميع التواريخ المقترحة بين تاريخ بدء المهمة وتاريخ استحقاقها.
2. إذا لم يكن تاريخ البدء متوفراً، استخدم تاريخ اليوم (${today}) كتاريخ بدء افتراضي.
3. إذا لم يكن تاريخ الاستحقاق متوفراً، اقترح تاريخ استحقاق منطقي بناءً على طبيعة المهمة، ثم اقترح تواريخ نقاط التتبع ضمن هذا الإطار الزمني.
4. يجب أن تعكس التواريخ المقترحة الوزن النسبي لكل نقطة تتبع بدقة. مثلاً، إذا كان وزن نقطة التتبع 25%، فيجب أن تكون في الربع الأول من الإطار الزمني الكلي.
5. يجب أن تكون التواريخ مرتبة منطقياً حسب تسلسل العمل، مع مراعاة الاعتماديات المحتملة بين نقاط التتبع.
6. لا يمكن أبداً أن يتجاوز تاريخ أي نقطة تتبع تاريخ استحقاق المهمة الرئيسية.

**خوارزمية حساب التواريخ:**
1. حدد الإطار الزمني الكلي للمهمة (من تاريخ البدء إلى تاريخ الاستحقاق).
2. احسب عدد الأيام الكلي في الإطار الزمني.
3. لكل نقطة تتبع، احسب عدد الأيام المخصصة لها بناءً على وزنها النسبي.
4. حدد تاريخ استحقاق كل نقطة تتبع بإضافة عدد الأيام المخصصة لها (مضروباً في وزنها) إلى تاريخ البدء.
5. تأكد من أن التواريخ متسلسلة منطقياً وتعكس تسلسل العمل الطبيعي.

**المخرجات المطلوبة:**
قائمة من نقاط التتبع مع تواريخ الاستحقاق المقترحة بتنسيق JSON كالتالي:
{
  "milestonesWithDueDates": [
    {
      "id": "معرف نقطة التتبع الأولى",
      "description": "وصف نقطة التتبع الأولى",
      "weight": 30,
      "dueDate": "YYYY-MM-DD",
      "reasoning": "سبب اقتراح هذا التاريخ، مع توضيح كيفية حساب التاريخ بناءً على الوزن والإطار الزمني"
    },
    ...
  ]
}

تأكد من أن التواريخ المقترحة:
- تكون بصيغة YYYY-MM-DD
- تكون جميعها قبل أو في نفس تاريخ استحقاق المهمة الرئيسية (إذا كان متوفراً)
- تكون جميعها بعد أو في نفس تاريخ بدء المهمة
- تعكس بدقة الوزن النسبي لكل نقطة تتبع ضمن الإطار الزمني الكلي
- تكون مرتبة منطقياً حسب تسلسل العمل الطبيعي
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating due dates for ${milestones.length} milestones of task: ${taskDescription}`);
    const result = await generateJSON(prompt, SuggestMilestoneDueDatesOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !Array.isArray(result.milestonesWithDueDates)) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في اقتراح تواريخ استحقاق صالحة.'
      );
    }

    // التحقق من صيغة التواريخ وأنها ضمن الإطار الزمني للمهمة
    const startDateObj = taskStartDate ? new Date(taskStartDate) : new Date(today);
    const dueDateObj = taskDueDate ? new Date(taskDueDate) : null;

    for (const milestone of result.milestonesWithDueDates) {
      // التحقق من صيغة التاريخ
      if (!/^\d{4}-\d{2}-\d{2}$/.test(milestone.dueDate)) {
        console.error("[AI] Invalid date format:", milestone.dueDate);
        throw new functions.https.HttpsError(
          'internal',
          'فشل الذكاء الاصطناعي في اقتراح تواريخ استحقاق بصيغة صحيحة.'
        );
      }

      // التحقق من أن التاريخ بعد تاريخ البدء
      const milestoneDate = new Date(milestone.dueDate);
      if (milestoneDate < startDateObj) {
        console.error(`[AI] Milestone date ${milestone.dueDate} is before task start date ${startDateObj.toISOString().split('T')[0]}`);
        milestone.dueDate = startDateObj.toISOString().split('T')[0];
        milestone.reasoning = `تم تعديل التاريخ ليكون بعد تاريخ بدء المهمة. ${milestone.reasoning || ''}`;
      }

      // التحقق من أن التاريخ قبل تاريخ الاستحقاق (إذا كان متوفراً)
      if (dueDateObj && milestoneDate > dueDateObj) {
        console.error(`[AI] Milestone date ${milestone.dueDate} is after task due date ${dueDateObj.toISOString().split('T')[0]}`);
        milestone.dueDate = dueDateObj.toISOString().split('T')[0];
        milestone.reasoning = `تم تعديل التاريخ ليكون قبل تاريخ استحقاق المهمة. ${milestone.reasoning || ''}`;
      }
    }

    // ترتيب نقاط التتبع حسب التاريخ
    result.milestonesWithDueDates.sort((a, b) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    logFunctionEnd(functionName, result);
    return result;

  } catch (error: any) {
    logFunctionError(functionName, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `فشل في اقتراح تواريخ استحقاق لنقاط التتبع: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
