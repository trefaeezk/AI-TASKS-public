/**
 * وظيفة Firebase لإنشاء تقرير أسبوعي للمهام
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { format } from 'date-fns';
import { generateJSON, validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../utils';
import { createCallableFunction } from '../../shared/function-utils';
import { BaseTaskSchema } from '../types';

// مخطط إحصائيات المهام
const TaskStatsSchema = z.object({
  totalTasks: z.number().describe('إجمالي عدد المهام.'),
  completedTasks: z.number().describe('عدد المهام المكتملة.'),
  pendingTasks: z.number().describe('عدد المهام قيد الانتظار.'),
  overdueTasks: z.number().describe('عدد المهام المتأخرة.'),
  completionRate: z.number().describe('معدل إكمال المهام (نسبة مئوية).'),
});

// مخطط ملخص المهمة
const TaskSummarySchema = z.object({
  id: z.string().describe('معرف المهمة.'),
  title: z.string().describe('عنوان المهمة.'),
  status: z.string().describe('حالة المهمة.'),
  dueDate: z.string().optional().describe('تاريخ استحقاق المهمة.'),
  completedDate: z.string().optional().describe('تاريخ إكمال المهمة.'),
  priority: z.number().optional().describe('أولوية المهمة.'),
  progress: z.number().optional().describe('نسبة التقدم في المهمة.'),
  notes: z.string().optional().describe('ملاحظات حول المهمة.'),
});

// مخطط المخرجات
const GenerateWeeklyReportOutputSchema = z.object({
  period: z.object({
    startDate: z.string().describe('تاريخ بداية الفترة.'),
    endDate: z.string().describe('تاريخ نهاية الفترة.'),
  }).describe('الفترة الزمنية للتقرير.'),
  stats: TaskStatsSchema.describe('إحصائيات المهام خلال الفترة.'),
  completedTasks: z.array(TaskSummarySchema).describe('المهام المكتملة خلال الفترة.'),
  overdueTasks: z.array(TaskSummarySchema).describe('المهام المتأخرة.'),
  upcomingTasks: z.array(TaskSummarySchema).describe('المهام القادمة.'),
  observations: z.array(z.string()).describe('ملاحظات وتوصيات.'),
  summary: z.string().describe('ملخص عام للتقرير.'),
});

// نوع المدخلات
export interface GenerateWeeklyReportInput {
  tasks: z.infer<typeof BaseTaskSchema>[];
  startDate?: Date;
  endDate?: Date;
  userName?: string;
}

// نوع المخرجات
export type GenerateWeeklyReportOutput = z.infer<typeof GenerateWeeklyReportOutputSchema>;

/**
 * وظيفة Firebase لإنشاء تقرير أسبوعي للمهام
 */
export const generateWeeklyReport = createCallableFunction<{ 
  tasks: z.infer<typeof BaseTaskSchema>[],
  startDate?: string,
  endDate?: string,
  userName?: string
}, GenerateWeeklyReportOutput>(async (request) => {
  const functionName = 'generateWeeklyReport';
  logFunctionStart(functionName);

  try {
    const { tasks, startDate, endDate, userName } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['tasks']);

    if (!Array.isArray(tasks)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير قائمة من المهام.'
      );
    }

    // تحديد فترة التقرير
    const now = new Date();
    const reportEndDate = endDate ? new Date(endDate) : now;
    
    // إذا لم يتم تحديد تاريخ البداية، استخدم تاريخ قبل أسبوع من تاريخ النهاية
    let reportStartDate;
    if (startDate) {
      reportStartDate = new Date(startDate);
    } else {
      reportStartDate = new Date(reportEndDate);
      reportStartDate.setDate(reportStartDate.getDate() - 7);
    }

    // تنسيق التواريخ
    const formattedStartDate = format(reportStartDate, 'yyyy-MM-dd');
    const formattedEndDate = format(reportEndDate, 'yyyy-MM-dd');

    // إنشاء نص الطلب
    const prompt = `
أنت مساعد ذكاء اصطناعي متخصص في تحليل البيانات وإعداد التقارير. مهمتك هي إنشاء تقرير أسبوعي شامل باللغة العربية بناءً على بيانات المهام المقدمة.

**الفترة الزمنية للتقرير:**
تاريخ البداية: ${formattedStartDate}
تاريخ النهاية: ${formattedEndDate}
${userName ? `اسم المستخدم: ${userName}` : ''}

**قائمة المهام:**
${JSON.stringify(tasks, null, 2)}

**المطلوب:**
قم بإنشاء تقرير أسبوعي يتضمن:

1. **إحصائيات المهام** خلال الفترة:
   - إجمالي عدد المهام
   - عدد المهام المكتملة
   - عدد المهام قيد الانتظار
   - عدد المهام المتأخرة
   - معدل إكمال المهام (نسبة مئوية)

2. **المهام المكتملة** خلال الفترة (المهام التي تم إكمالها بين تاريخ البداية وتاريخ النهاية)

3. **المهام المتأخرة** (المهام التي تاريخ استحقاقها قبل تاريخ النهاية ولم يتم إكمالها)

4. **المهام القادمة** (المهام التي تاريخ استحقاقها بعد تاريخ النهاية)

5. **ملاحظات وتوصيات** (3-5 ملاحظات) بناءً على تحليل البيانات، مثل:
   - الإشارة إلى وجود عدد كبير من المهام المتأخرة
   - اقتراح تحسينات في إدارة الوقت
   - تسليط الضوء على الإنجازات
   - اقتراح إعادة ترتيب أولويات المهام

6. **ملخص عام** للتقرير (فقرة واحدة)

**المخرجات المطلوبة:**
قم بإنشاء مخرجات بتنسيق JSON كالتالي:
{
  "period": {
    "startDate": "${formattedStartDate}",
    "endDate": "${formattedEndDate}"
  },
  "stats": {
    "totalTasks": 10,
    "completedTasks": 5,
    "pendingTasks": 3,
    "overdueTasks": 2,
    "completionRate": 50
  },
  "completedTasks": [
    {
      "id": "معرف المهمة",
      "title": "عنوان المهمة",
      "status": "completed",
      "completedDate": "YYYY-MM-DD",
      "priority": 2,
      "notes": "ملاحظات حول المهمة"
    },
    ...
  ],
  "overdueTasks": [
    {
      "id": "معرف المهمة",
      "title": "عنوان المهمة",
      "status": "pending",
      "dueDate": "YYYY-MM-DD",
      "priority": 1,
      "progress": 50,
      "notes": "ملاحظات حول المهمة"
    },
    ...
  ],
  "upcomingTasks": [
    {
      "id": "معرف المهمة",
      "title": "عنوان المهمة",
      "status": "pending",
      "dueDate": "YYYY-MM-DD",
      "priority": 3,
      "notes": "ملاحظات حول المهمة"
    },
    ...
  ],
  "observations": [
    "ملاحظة أو توصية 1",
    "ملاحظة أو توصية 2",
    "ملاحظة أو توصية 3"
  ],
  "summary": "ملخص عام للتقرير في فقرة واحدة."
}
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating weekly report for period: ${formattedStartDate} to ${formattedEndDate}`);
    const result = await generateJSON(prompt, GenerateWeeklyReportOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !result.period || !result.stats || !Array.isArray(result.completedTasks) || 
        !Array.isArray(result.overdueTasks) || !Array.isArray(result.upcomingTasks) || 
        !Array.isArray(result.observations) || !result.summary) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في إنشاء تقرير أسبوعي صالح.'
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
      `فشل في إنشاء تقرير أسبوعي: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
