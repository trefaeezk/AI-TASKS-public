/**
 * وظيفة Firebase لإنشاء اقتراحات ذكية للمستخدم
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { generateJSON, validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../utils';
import { createCallableFunction } from '../../shared/function-utils';
import { BaseTaskSchema, UserPerformanceSchema } from '../types';

// أنواع الاقتراحات
const SuggestionTypeEnum = z.enum([
  'task_prioritization',  // إعادة ترتيب أولويات المهام
  'deadline_adjustment',  // تعديل المواعيد النهائية
  'workload_management',  // إدارة عبء العمل
  'daily_summary'         // ملخص يومي
]);

// مخطط المخرجات
const GenerateSmartSuggestionsOutputSchema = z.object({
  title: z.string().describe('عنوان الاقتراح.'),
  content: z.string().describe('محتوى الاقتراح.'),
  actionItems: z.array(z.string()).optional().describe('إجراءات مقترحة للتنفيذ.'),
  relatedTaskIds: z.array(z.string()).optional().describe('معرفات المهام ذات الصلة بالاقتراح.'),
});

// نوع المدخلات
export interface GenerateSmartSuggestionsInput {
  userId: string;
  userName: string;
  tasks: z.infer<typeof BaseTaskSchema>[];
  upcomingTasks: z.infer<typeof BaseTaskSchema>[];
  overdueTasks: z.infer<typeof BaseTaskSchema>[];
  performance: z.infer<typeof UserPerformanceSchema>;
  suggestionType: z.infer<typeof SuggestionTypeEnum>;
}

// نوع المخرجات
export type GenerateSmartSuggestionsOutput = z.infer<typeof GenerateSmartSuggestionsOutputSchema>;

/**
 * وظيفة Firebase لإنشاء اقتراحات ذكية للمستخدم
 */
export const generateSmartSuggestions = createCallableFunction<GenerateSmartSuggestionsInput, GenerateSmartSuggestionsOutput>(async (request) => {
  const functionName = 'generateSmartSuggestions';
  logFunctionStart(functionName);

  try {
    const { userId, userName, tasks, upcomingTasks, overdueTasks, performance, suggestionType } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['userId', 'userName', 'tasks', 'suggestionType']);

    if (!Array.isArray(tasks)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير قائمة من المهام.'
      );
    }

    if (!SuggestionTypeEnum.safeParse(suggestionType).success) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'نوع الاقتراح غير صالح.'
      );
    }

    // إنشاء نص الطلب
    const prompt = `
أنت مساعد ذكي متخصص في إدارة المهام وتحسين الإنتاجية. مهمتك هي تقديم اقتراحات ذكية لـ ${userName} بناءً على أدائه ومهامه الحالية.

**معلومات المستخدم:**
معرف المستخدم: ${userId}
اسم المستخدم: ${userName}

**أداء المستخدم:**
${JSON.stringify(performance, null, 2)}

**المهام الحالية:**
${JSON.stringify(tasks, null, 2)}

**المهام القادمة:**
${JSON.stringify(upcomingTasks, null, 2)}

**المهام المتأخرة:**
${JSON.stringify(overdueTasks, null, 2)}

**نوع الاقتراح المطلوب: ${suggestionType}**

${suggestionType === 'task_prioritization' ? `
قم بإنشاء اقتراح لإعادة ترتيب أولويات المهام بناءً على:
- المواعيد النهائية
- الأهمية والأولوية
- الاعتماديات بين المهام
- عبء العمل الحالي

اقترح ترتيباً منطقياً للمهام وقدم أسباباً مقنعة لهذا الترتيب.
` : ''}

${suggestionType === 'deadline_adjustment' ? `
قم بإنشاء اقتراح لتعديل المواعيد النهائية للمهام بناءً على:
- واقعية المواعيد الحالية
- عبء العمل الإجمالي
- أنماط الإكمال السابقة
- الأولويات المتنافسة

حدد المهام التي قد تحتاج إلى تمديد مواعيدها النهائية واقترح مواعيد جديدة أكثر واقعية.
` : ''}

${suggestionType === 'workload_management' ? `
قم بإنشاء اقتراح لإدارة عبء العمل بشكل أفضل بناءً على:
- توزيع المهام الحالي
- المواعيد النهائية المتداخلة
- مستويات الأولوية
- أنماط الإنتاجية

اقترح استراتيجيات لتوزيع العمل بشكل أكثر توازناً وتجنب الإرهاق.
` : ''}

${suggestionType === 'daily_summary' ? `
قم بإنشاء ملخص يومي يتضمن:
- نظرة عامة على المهام المكتملة مؤخراً
- المهام المستحقة اليوم
- المهام المتأخرة التي تحتاج اهتماماً
- اقتراح خطة عمل لليوم

قدم ملخصاً موجزاً ومفيداً يساعد المستخدم على التخطيط ليومه.
` : ''}

**المخرجات المطلوبة:**
قم بإنشاء مخرجات بتنسيق JSON كالتالي:
{
  "title": "عنوان الاقتراح",
  "content": "محتوى الاقتراح بالتفصيل",
  "actionItems": [
    "إجراء مقترح 1",
    "إجراء مقترح 2",
    "إجراء مقترح 3"
  ],
  "relatedTaskIds": [
    "معرف المهمة 1",
    "معرف المهمة 2"
  ]
}

ملاحظات مهمة:
- استخدم لغة واضحة ومهنية باللغة العربية
- قدم اقتراحات عملية وقابلة للتنفيذ
- ركز على تحسين الإنتاجية وتقليل التوتر
- كن محدداً قدر الإمكان مع الإشارة إلى المهام الفعلية عند الاقتضاء
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating ${suggestionType} suggestion for user ${userName}`);
    const result = await generateJSON(prompt, GenerateSmartSuggestionsOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !result.title || !result.content) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في إنشاء اقتراح ذكي صالح.'
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
      `فشل في إنشاء اقتراح ذكي: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
