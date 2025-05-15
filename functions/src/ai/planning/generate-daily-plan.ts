/**
 * وظيفة Firebase لإنشاء خطة يومية للمهام
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { format } from 'date-fns';
import { generateJSON, validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../utils';
import { createCallableFunction } from '../../shared/function-utils';
import { BaseTaskSchema } from '../types';

// مخطط المهمة المخططة
const PlannedTaskSchema = z.object({
  id: z.string().describe('معرف المهمة.'),
  title: z.string().describe('عنوان المهمة.'),
  priority: z.number().min(1).max(4).optional().describe('أولوية المهمة (1: حرجة، 2: عالية، 3: متوسطة، 4: منخفضة).'),
  dueDate: z.string().optional().describe('تاريخ استحقاق المهمة بصيغة YYYY-MM-DD.'),
  reasoning: z.string().describe('سبب إدراج المهمة في الخطة اليومية.'),
});

// مخطط تحذير المهام المتأخرة
const OverdueTaskWarningSchema = z.object({
  id: z.string().describe('معرف المهمة.'),
  title: z.string().describe('عنوان المهمة.'),
  dueDate: z.string().describe('تاريخ استحقاق المهمة بصيغة YYYY-MM-DD.'),
  reasoning: z.string().describe('سبب اعتبار المهمة متأخرة.'),
});

// مخطط المخرجات
const GenerateDailyPlanOutputSchema = z.object({
  dailyPlan: z.array(PlannedTaskSchema).describe('قائمة مرتبة حسب الأولوية للمهام المقترحة للعمل عليها اليوم.'),
  overdueWarnings: z.array(OverdueTaskWarningSchema).describe('قائمة المهام المتأخرة التي تتطلب اهتمامًا فوريًا.'),
  observations: z.array(z.string()).describe('ملاحظات عامة حول قائمة المهام أو الخطة.'),
});

// نوع المدخلات
export type GenerateDailyPlanInput = z.infer<typeof BaseTaskSchema>[];

// نوع المخرجات
export type GenerateDailyPlanOutput = z.infer<typeof GenerateDailyPlanOutputSchema>;

/**
 * وظيفة Firebase لإنشاء خطة يومية للمهام
 */
export const generateDailyPlan = createCallableFunction<{ tasks: GenerateDailyPlanInput }, GenerateDailyPlanOutput>(async (request) => {
  const functionName = 'generateDailyPlan';
  logFunctionStart(functionName);

  try {
    const { tasks } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['tasks']);

    if (!Array.isArray(tasks)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير قائمة من المهام.'
      );
    }

    // الحصول على التاريخ الحالي
    const currentDate = format(new Date(), 'yyyy-MM-dd');

    // تصفية المهام النشطة (pending و hold) فقط
    const activeTasksForPrompt = tasks.filter(task => task.status === 'pending' || task.status === 'hold');

    // إنشاء نص الطلب
    const prompt = `
أنت خبير في تخطيط المهام بالذكاء الاصطناعي وتفهم اللغة العربية. مهمتك هي تحليل قائمة المهام المعطاة (فقط المهام ذات الحالة 'pending' أو 'hold') واقتراح خطة عمل لليوم الحالي (${currentDate}).

**قائمة المهام:**
${JSON.stringify(activeTasksForPrompt, null, 2)}

**أهدافك الرئيسية:**
1. **تحديد المهام الفائتة:** حدد أي مهام لها تاريخ استحقاق قبل التاريخ الحالي (${currentDate}) وحالتها 'pending'. قم بإدراجها في قسم \`overdueWarnings\` مع سبب موجز باللغة العربية يؤكد على تأخرها.
2. **اقتراح خطة يومية:** قم بإنشاء قائمة مرتبة حسب الأولوية للمهام التي يجب التركيز عليها اليوم في قسم \`dailyPlan\`. ضع في اعتبارك **فقط المهام ذات الحالة 'pending'**:
   * المهام التي تاريخ استحقاقها اليوم (${currentDate}).
   * المهام التي تاريخ بدئها اليوم (${currentDate}).
   * المهام ذات الأولوية العالية (الأولوية 1 أو 2) التي تقترب مواعيد استحقاقها أو بدئها.
   * المهام العاجلة أو الهامة بناءً على الوصف والتفاصيل.
   * المهام التي يجب أن تبدأ اليوم لإكمالها في الوقت المحدد بناءً على مدتها وتاريخ استحقاقها.
   * **إذا لم تكن هناك مهام 'pending' مستحقة أو تبدأ اليوم،** اقترح المهمة (أو المهام القليلة) القادمة الأقرب بناءً على تاريخ البدء أو الاستحقاق من بين المهام ذات الحالة 'pending'.
   * **لا تدرج** المهام التي حالتها 'hold' في قسم \`dailyPlan\`.
   * لكل مهمة مقترحة في الخطة، قدم سببًا موجزًا باللغة العربية لتضمينها (مثل "تستحق اليوم"، "أولوية عالية وتبدأ قريبًا"، "المهمة القادمة الأقرب").
3. **تقديم ملاحظات:** في قسم \`observations\`, قدم 1-3 ملاحظات عامة باللغة العربية حول قائمة المهام أو الخطة. يمكن أن يشمل ذلك:
   * الإشارة إلى وجود عدد كبير من المهام ذات الأولوية العالية أو المهام المتأخرة.
   * **إذا لم تكن هناك مهام 'pending' مستحقة اليوم،** أضف ملاحظة مثل "لا توجد مهام مستحقة اليوم. الخطة تقترح المهام القادمة الأقرب."
   * اقتراح تقسيم المهام الكبيرة.

**المخرجات المطلوبة:**
قم بإنشاء مخرجات بتنسيق JSON كالتالي:
{
  "dailyPlan": [
    {
      "id": "معرف المهمة",
      "title": "عنوان المهمة",
      "priority": 1,
      "dueDate": "YYYY-MM-DD",
      "reasoning": "سبب إدراج المهمة في الخطة اليومية"
    },
    ...
  ],
  "overdueWarnings": [
    {
      "id": "معرف المهمة",
      "title": "عنوان المهمة",
      "dueDate": "YYYY-MM-DD",
      "reasoning": "سبب اعتبار المهمة متأخرة"
    },
    ...
  ],
  "observations": [
    "ملاحظة عامة حول قائمة المهام أو الخطة",
    ...
  ]
}
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating daily plan for ${activeTasksForPrompt.length} active tasks on ${currentDate}`);
    const result = await generateJSON(prompt, GenerateDailyPlanOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !Array.isArray(result.dailyPlan) || !Array.isArray(result.overdueWarnings) || !Array.isArray(result.observations)) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في إنشاء خطة يومية صالحة.'
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
      `فشل في إنشاء خطة يومية: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
