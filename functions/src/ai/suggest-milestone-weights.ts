/**
 * وظيفة Firebase لاقتراح أوزان لنقاط تتبع (milestones) المهمة
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { generateJSON, validateInput } from './ai-utils';
import { createCallableFunction } from '../shared/function-utils';

// مخطط نقطة التتبع المدخلة
const MilestoneInputSchema = z.object({
  id: z.string().describe('معرف نقطة التتبع.'),
  description: z.string().describe('وصف نقطة التتبع.'),
});

// مخطط المدخلات
const SuggestMilestoneWeightsInputSchema = z.object({
  taskDescription: z.string().describe('وصف المهمة الرئيسي (العنوان).'),
  taskDetails: z.string().optional().describe('معلومات تفصيلية اختيارية عن المهمة.'),
  milestones: z.array(MilestoneInputSchema).describe('قائمة نقاط التتبع التي يجب اقتراح أوزان لها.'),
});

// مخطط نقطة التتبع مع الوزن المقترح
const MilestoneWithWeightSuggestionSchema = z.object({
  id: z.string().describe('معرف نقطة التتبع.'),
  description: z.string().describe('وصف نقطة التتبع.'),
  weight: z.number().min(1).max(100).describe('الوزن المقترح لنقطة التتبع (نسبة مئوية من 1 إلى 100).'),
});

// مخطط المخرجات
const SuggestMilestoneWeightsOutputSchema = z.object({
  weightedMilestones: z.array(MilestoneWithWeightSuggestionSchema).describe('قائمة نقاط التتبع، كل منها مع وزن مقترح. يجب أن يكون مجموع الأوزان 100.'),
});

// نوع المدخلات
type SuggestMilestoneWeightsInput = z.infer<typeof SuggestMilestoneWeightsInputSchema>;

// نوع المخرجات
type SuggestMilestoneWeightsOutput = z.infer<typeof SuggestMilestoneWeightsOutputSchema>;

/**
 * وظيفة Firebase لاقتراح أوزان لنقاط تتبع المهمة
 */
export const suggestMilestoneWeights = createCallableFunction<SuggestMilestoneWeightsInput, SuggestMilestoneWeightsOutput>(async (request) => {
  const functionName = 'suggestMilestoneWeights';
  console.log(`[AI] --- ${functionName} Cloud Function triggered ---`);

  try {
    const { taskDescription, taskDetails, milestones } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['taskDescription', 'milestones']);

    if (!Array.isArray(milestones) || milestones.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير قائمة غير فارغة من نقاط التتبع.'
      );
    }

    // إنشاء نص الطلب
    const prompt = `
أنت مساعد ذكاء اصطناعي متخصص في إدارة المشاريع وتخطيط المهام. مهمتك هي تحليل وصف المهمة الرئيسية وتفاصيلها، وقائمة نقاط التتبع (milestones) الخاصة بها، واقتراح وزن مئوي (percentage weight) لكل نقطة تتبع.

**المهمة الرئيسية:**
العنوان/الوصف: ${taskDescription}
${taskDetails ? `التفاصيل الإضافية: ${taskDetails}` : ''}

**نقاط التتبع المطلوب اقتراح أوزان لها:**
${milestones.map((m, i) => `${i + 1}. المعرف: ${m.id}\n   الوصف: ${m.description}`).join('\n')}

**المطلوب:**
اقترح وزناً مئوياً لكل نقطة تتبع بحيث:
1. يعكس الوزن أهمية ومقدار الجهد المطلوب لإكمال نقطة التتبع
2. يكون مجموع الأوزان لجميع نقاط التتبع يساوي 100%
3. تكون الأوزان أرقاماً صحيحة (بدون كسور)

**المخرجات المطلوبة:**
قائمة من نقاط التتبع مع الأوزان المقترحة بتنسيق JSON كالتالي:
{
  "weightedMilestones": [
    {
      "id": "معرف نقطة التتبع الأولى",
      "description": "وصف نقطة التتبع الأولى",
      "weight": 30
    },
    {
      "id": "معرف نقطة التتبع الثانية",
      "description": "وصف نقطة التتبع الثانية",
      "weight": 40
    },
    ...
  ]
}

تأكد من أن مجموع الأوزان يساوي 100 بالضبط.
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating weights for ${milestones.length} milestones of task: ${taskDescription}`);
    const result = await generateJSON(prompt, SuggestMilestoneWeightsOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !Array.isArray(result.weightedMilestones)) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في اقتراح أوزان صالحة.'
      );
    }

    // التحقق من أن مجموع الأوزان يساوي 100
    const totalWeight = result.weightedMilestones.reduce((sum, m) => sum + m.weight, 0);
    if (Math.abs(totalWeight - 100) > 1) { // نسمح بهامش خطأ صغير
      console.warn(`[AI] Total weight (${totalWeight}) is not 100, adjusting...`);
      
      // تعديل الأوزان لتصل إلى 100
      const adjustmentFactor = 100 / totalWeight;
      let adjustedTotal = 0;
      
      for (let i = 0; i < result.weightedMilestones.length; i++) {
        if (i === result.weightedMilestones.length - 1) {
          // آخر عنصر يأخذ ما تبقى للوصول إلى 100 بالضبط
          result.weightedMilestones[i].weight = 100 - adjustedTotal;
        } else {
          // تعديل الوزن وتقريبه إلى أقرب عدد صحيح
          result.weightedMilestones[i].weight = Math.round(result.weightedMilestones[i].weight * adjustmentFactor);
          adjustedTotal += result.weightedMilestones[i].weight;
        }
      }
    }

    console.log(`[AI] Successfully generated weights for ${result.weightedMilestones.length} milestones`);
    return result;

  } catch (error: any) {
    console.error(`[AI] Error in ${functionName}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `فشل في اقتراح أوزان نقاط التتبع: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
