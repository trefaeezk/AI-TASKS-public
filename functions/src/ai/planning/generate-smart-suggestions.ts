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
  language?: string; // إضافة معلمة اللغة (ar أو en)
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
    const { userId, userName, tasks, upcomingTasks, overdueTasks, performance, suggestionType, language = 'ar' } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['userId', 'userName', 'tasks', 'suggestionType']);

    if (!Array.isArray(tasks)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        language === 'en' ? 'A list of tasks must be provided.' : 'يجب توفير قائمة من المهام.'
      );
    }

    if (!SuggestionTypeEnum.safeParse(suggestionType).success) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        language === 'en' ? 'Invalid suggestion type.' : 'نوع الاقتراح غير صالح.'
      );
    }

    // إنشاء نص الطلب بناءً على اللغة المحددة
    let prompt = '';

    // الجزء الأول من الطلب - المقدمة
    if (language === 'en') {
      prompt = `
You are an AI assistant specialized in task management and productivity improvement. Your task is to provide smart suggestions for ${userName} based on their performance and current tasks.

**User Information:**
User ID: ${userId}
User Name: ${userName}

**User Performance:**
${JSON.stringify(performance, null, 2)}

**Current Tasks:**
${JSON.stringify(tasks, null, 2)}

**Upcoming Tasks:**
${JSON.stringify(upcomingTasks, null, 2)}

**Overdue Tasks:**
${JSON.stringify(overdueTasks, null, 2)}

**Requested Suggestion Type: ${suggestionType}**`;
    } else {
      prompt = `
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

**نوع الاقتراح المطلوب: ${suggestionType}**`;
    }

    // الجزء الثاني من الطلب - تعليمات خاصة بنوع الاقتراح
    if (language === 'en') {
      if (suggestionType === 'task_prioritization') {
        prompt += `

Create a suggestion for task prioritization based on:
- Deadlines
- Importance and priority
- Dependencies between tasks
- Current workload

Suggest a logical order for tasks and provide convincing reasons for this order.`;
      } else if (suggestionType === 'deadline_adjustment') {
        prompt += `

Create a suggestion for adjusting task deadlines based on:
- Realism of current deadlines
- Overall workload
- Previous completion patterns
- Competing priorities

Identify tasks that may need deadline extensions and suggest more realistic new deadlines.`;
      } else if (suggestionType === 'workload_management') {
        prompt += `

Create a suggestion for better workload management based on:
- Current task distribution
- Overlapping deadlines
- Priority levels
- Productivity patterns

Suggest strategies for more balanced work distribution and avoiding burnout.`;
      } else if (suggestionType === 'daily_summary') {
        prompt += `

Create a daily summary that includes:
- Overview of recently completed tasks
- Tasks due today
- Overdue tasks that need attention
- Suggested action plan for the day

Provide a concise and useful summary that helps the user plan their day.`;
      }

      // إضافة تعليمات المخرجات باللغة الإنجليزية
      prompt += `

**Required Output:**
Create output in JSON format as follows:
{
  "title": "Suggestion title",
  "content": "Detailed suggestion content",
  "actionItems": [
    "Suggested action 1",
    "Suggested action 2",
    "Suggested action 3"
  ],
  "relatedTaskIds": [
    "Task ID 1",
    "Task ID 2"
  ]
}

Important notes:
- Use clear and professional language in English
- Provide practical and actionable suggestions
- Focus on improving productivity and reducing stress
- Be as specific as possible with reference to actual tasks when appropriate`;
    } else {
      // تعليمات باللغة العربية
      if (suggestionType === 'task_prioritization') {
        prompt += `

قم بإنشاء اقتراح لإعادة ترتيب أولويات المهام بناءً على:
- المواعيد النهائية
- الأهمية والأولوية
- الاعتماديات بين المهام
- عبء العمل الحالي

اقترح ترتيباً منطقياً للمهام وقدم أسباباً مقنعة لهذا الترتيب.`;
      } else if (suggestionType === 'deadline_adjustment') {
        prompt += `

قم بإنشاء اقتراح لتعديل المواعيد النهائية للمهام بناءً على:
- واقعية المواعيد الحالية
- عبء العمل الإجمالي
- أنماط الإكمال السابقة
- الأولويات المتنافسة

حدد المهام التي قد تحتاج إلى تمديد مواعيدها النهائية واقترح مواعيد جديدة أكثر واقعية.`;
      } else if (suggestionType === 'workload_management') {
        prompt += `

قم بإنشاء اقتراح لإدارة عبء العمل بشكل أفضل بناءً على:
- توزيع المهام الحالي
- المواعيد النهائية المتداخلة
- مستويات الأولوية
- أنماط الإنتاجية

اقترح استراتيجيات لتوزيع العمل بشكل أكثر توازناً وتجنب الإرهاق.`;
      } else if (suggestionType === 'daily_summary') {
        prompt += `

قم بإنشاء ملخص يومي يتضمن:
- نظرة عامة على المهام المكتملة مؤخراً
- المهام المستحقة اليوم
- المهام المتأخرة التي تحتاج اهتماماً
- اقتراح خطة عمل لليوم

قدم ملخصاً موجزاً ومفيداً يساعد المستخدم على التخطيط ليومه.`;
      }

      // إضافة تعليمات المخرجات باللغة العربية
      prompt += `

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
- كن محدداً قدر الإمكان مع الإشارة إلى المهام الفعلية عند الاقتضاء`;
    }

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating ${suggestionType} suggestion for user ${userName}`);
    const result = await generateJSON(prompt, GenerateSmartSuggestionsOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !result.title || !result.content) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        language === 'en'
          ? 'AI failed to create a valid smart suggestion.'
          : 'فشل الذكاء الاصطناعي في إنشاء اقتراح ذكي صالح.'
      );
    }

    logFunctionEnd(functionName, result);
    return result;

  } catch (error: any) {
    logFunctionError(functionName, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    // استخدام متغير اللغة من request.data أو الافتراضي 'ar'
    const lang = request.data.language || 'ar';
    const errorMessage = lang === 'en'
      ? `Failed to create smart suggestion: ${error.message || 'Unknown internal error.'}`
      : `فشل في إنشاء اقتراح ذكي: ${error.message || 'خطأ داخلي غير معروف.'}`;
    throw new functions.https.HttpsError('internal', errorMessage);
  }
});
