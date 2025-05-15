/**
 * وظيفة Firebase لإنشاء جدول أعمال الاجتماع اليومي
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { generateJSON, validateInput, logFunctionStart, logFunctionEnd, logFunctionError } from '../utils';
import { createCallableFunction } from '../../shared/function-utils';
import { BaseTaskSchema } from '../types';

// مخطط بند جدول الأعمال
const AgendaItemSchema = z.object({
  id: z.string().optional().describe('معرف بند جدول الأعمال.'),
  title: z.string().describe('عنوان بند جدول الأعمال.'),
  description: z.string().describe('وصف بند جدول الأعمال.'),
  duration: z.number().describe('المدة المقترحة بالدقائق.'),
  priority: z.number().min(1).max(3).describe('أولوية البند (1: عالية، 2: متوسطة، 3: منخفضة).'),
  relatedTaskIds: z.array(z.string()).optional().describe('معرفات المهام ذات الصلة.'),
  type: z.enum(['update', 'discussion', 'decision', 'action_item', 'other']).describe('نوع البند.'),
});

// مخطط المدخلات
const GenerateDailyMeetingAgendaInputSchema = z.object({
  departmentName: z.string().describe('اسم القسم أو الفريق.'),
  date: z.string().describe('تاريخ الاجتماع بصيغة YYYY-MM-DD.'),
  tasks: z.array(BaseTaskSchema).describe('قائمة المهام الحالية.'),
  previousMeetingNotes: z.string().optional().describe('ملاحظات الاجتماع السابق.'),
  teamMembers: z.array(z.string()).optional().describe('أسماء أعضاء الفريق.'),
  duration: z.number().default(30).describe('المدة الإجمالية المخططة للاجتماع بالدقائق.'),
  focusAreas: z.array(z.string()).optional().describe('مجالات التركيز للاجتماع.'),
});

// مخطط المخرجات
const GenerateDailyMeetingAgendaOutputSchema = z.object({
  meetingTitle: z.string().describe('عنوان الاجتماع.'),
  date: z.string().describe('تاريخ الاجتماع.'),
  duration: z.number().describe('المدة الإجمالية المخططة للاجتماع بالدقائق.'),
  agenda: z.array(AgendaItemSchema).describe('بنود جدول الأعمال.'),
  objectives: z.array(z.string()).describe('أهداف الاجتماع.'),
  notes: z.string().optional().describe('ملاحظات إضافية.'),
});

// نوع المدخلات
export type GenerateDailyMeetingAgendaInput = z.infer<typeof GenerateDailyMeetingAgendaInputSchema>;

// نوع المخرجات
export type GenerateDailyMeetingAgendaOutput = z.infer<typeof GenerateDailyMeetingAgendaOutputSchema>;

/**
 * وظيفة Firebase لإنشاء جدول أعمال الاجتماع اليومي
 */
export const generateDailyMeetingAgenda = createCallableFunction<GenerateDailyMeetingAgendaInput, GenerateDailyMeetingAgendaOutput>(async (request) => {
  const functionName = 'generateDailyMeetingAgenda';
  logFunctionStart(functionName);

  try {
    const { departmentName, date, tasks, previousMeetingNotes, teamMembers, duration, focusAreas } = request.data;

    // التحقق من صحة المدخلات
    validateInput(request.data, ['departmentName', 'date', 'tasks']);

    if (!Array.isArray(tasks)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'يجب توفير قائمة من المهام.'
      );
    }

    // إنشاء نص الطلب
    const prompt = `
أنت مساعد ذكي متخصص في إدارة الاجتماعات وتنظيم جداول الأعمال. مهمتك هي إنشاء جدول أعمال لاجتماع يومي لـ ${departmentName} بتاريخ ${date}.

**معلومات الاجتماع:**
- اسم القسم/الفريق: ${departmentName}
- تاريخ الاجتماع: ${date}
- المدة المخططة: ${duration} دقيقة
${teamMembers && teamMembers.length > 0 ? `- أعضاء الفريق: ${teamMembers.join(', ')}` : ''}
${focusAreas && focusAreas.length > 0 ? `- مجالات التركيز: ${focusAreas.join(', ')}` : ''}

**المهام الحالية:**
${JSON.stringify(tasks, null, 2)}

${previousMeetingNotes ? `**ملاحظات الاجتماع السابق:**
${previousMeetingNotes}` : ''}

**المطلوب:**
قم بإنشاء جدول أعمال للاجتماع اليومي يتضمن:

1. **عنوان الاجتماع** مناسب ومحدد.

2. **أهداف الاجتماع** (3-5 أهداف) تحدد ما يجب تحقيقه خلال الاجتماع.

3. **بنود جدول الأعمال** مع مراعاة:
   - تخصيص وقت مناسب لكل بند (بالدقائق) بحيث لا يتجاوز المجموع المدة الإجمالية للاجتماع (${duration} دقيقة).
   - ترتيب البنود حسب الأولوية.
   - تضمين متابعة المهام من الاجتماع السابق (إذا كانت متوفرة).
   - التركيز على المهام العاجلة والمتأخرة.
   - تخصيص وقت للمناقشة والقرارات.
   - تحديد نوع كل بند (تحديث، مناقشة، قرار، إجراء، أخرى).
   - ربط البنود بالمهام ذات الصلة عند الاقتضاء.

4. **ملاحظات إضافية** (اختياري) قد تكون مفيدة للمشاركين.

**المخرجات المطلوبة:**
قم بإنشاء مخرجات بتنسيق JSON كالتالي:
{
  "meetingTitle": "عنوان الاجتماع",
  "date": "${date}",
  "duration": ${duration},
  "objectives": [
    "هدف الاجتماع 1",
    "هدف الاجتماع 2",
    "هدف الاجتماع 3"
  ],
  "agenda": [
    {
      "title": "عنوان البند",
      "description": "وصف البند",
      "duration": 10,
      "priority": 1,
      "relatedTaskIds": ["معرف المهمة 1", "معرف المهمة 2"],
      "type": "update"
    },
    ...
  ],
  "notes": "ملاحظات إضافية"
}

ملاحظات مهمة:
- استخدم لغة واضحة ومهنية باللغة العربية.
- تأكد من أن مجموع مدة بنود جدول الأعمال لا يتجاوز المدة الإجمالية للاجتماع (${duration} دقيقة).
- ركز على البنود التي تحقق أقصى قيمة في الوقت المتاح.
- أنواع البنود المتاحة هي: update (تحديث)، discussion (مناقشة)، decision (قرار)، action_item (إجراء)، other (أخرى).
- مستويات الأولوية هي: 1 (عالية)، 2 (متوسطة)، 3 (منخفضة).
`;

    // استدعاء الذكاء الاصطناعي
    console.log(`[AI] Generating daily meeting agenda for ${departmentName} on ${date}`);
    const result = await generateJSON(prompt, GenerateDailyMeetingAgendaOutputSchema);

    // التحقق من صحة المخرجات
    if (!result || !result.meetingTitle || !Array.isArray(result.agenda) || !Array.isArray(result.objectives)) {
      console.error("[AI] Invalid response format:", result);
      throw new functions.https.HttpsError(
        'internal',
        'فشل الذكاء الاصطناعي في إنشاء جدول أعمال صالح.'
      );
    }

    // إضافة معرفات لبنود جدول الأعمال إذا كانت غير موجودة
    const agendaWithIds = result.agenda.map((item: { id?: string; [key: string]: any }) => ({
      ...item,
      id: item.id || uuidv4(),
    }));

    // إعادة النتيجة مع بنود جدول الأعمال المحدثة
    const finalResult = {
      ...result,
      agenda: agendaWithIds,
    };

    logFunctionEnd(functionName, finalResult);
    return finalResult;

  } catch (error: any) {
    logFunctionError(functionName, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `فشل في إنشاء جدول أعمال الاجتماع اليومي: ${error.message || 'خطأ داخلي غير معروف.'}`
    );
  }
});
