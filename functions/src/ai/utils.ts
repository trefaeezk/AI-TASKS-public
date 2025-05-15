/**
 * وظائف مساعدة للذكاء الاصطناعي
 * 
 * يحتوي على وظائف مساعدة للتعامل مع نماذج الذكاء الاصطناعي
 */

import * as functions from 'firebase-functions';
import { getModel } from './config';

/**
 * إرسال طلب إلى نموذج Gemini وتحويل الاستجابة إلى JSON
 * @param prompt نص الطلب
 * @param outputSchema مخطط الإخراج المتوقع (للتوثيق فقط)
 * @returns استجابة JSON
 */
export async function generateJSON(prompt: string, outputSchema: any): Promise<any> {
  try {
    const model = getModel();
    
    // إضافة تعليمات لإرجاع JSON
    const fullPrompt = `${prompt}\n\nيرجى الرد بتنسيق JSON فقط، بدون أي نص إضافي أو شرح. تأكد من أن الاستجابة تتوافق مع المخطط المطلوب.`;
    
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();
    
    // محاولة تحليل النص كـ JSON
    try {
      // إزالة أي علامات تنسيق markdown إذا وجدت
      const jsonText = text.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[AI Utils] Error parsing JSON response:', parseError);
      console.error('[AI Utils] Raw response:', text);
      throw new Error('فشل في تحليل استجابة الذكاء الاصطناعي كـ JSON');
    }
  } catch (error) {
    console.error('[AI Utils] Error generating content:', error);
    throw new functions.https.HttpsError(
      'internal',
      `فشل في توليد المحتوى: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`
    );
  }
}

/**
 * التحقق من صحة المدخلات
 * @param data البيانات المدخلة
 * @param requiredFields الحقول المطلوبة
 */
export function validateInput(data: any, requiredFields: string[]): void {
  for (const field of requiredFields) {
    if (data[field] === undefined) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `الحقل المطلوب "${field}" غير موجود`
      );
    }
  }
}

/**
 * تنسيق التاريخ إلى صيغة YYYY-MM-DD
 * @param date التاريخ
 * @returns التاريخ بصيغة YYYY-MM-DD
 */
export function formatDate(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString().split('T')[0];
}

/**
 * تسجيل بداية تنفيذ وظيفة
 * @param functionName اسم الوظيفة
 * @param data البيانات المدخلة (اختياري)
 */
export function logFunctionStart(functionName: string, data?: any): void {
  console.log(`[AI] --- ${functionName} Cloud Function triggered ---`);
  if (data) {
    console.log(`[AI] ${functionName} input:`, JSON.stringify(data, null, 2));
  }
}

/**
 * تسجيل نهاية تنفيذ وظيفة
 * @param functionName اسم الوظيفة
 * @param result نتيجة التنفيذ (اختياري)
 */
export function logFunctionEnd(functionName: string, result?: any): void {
  console.log(`[AI] ${functionName} completed successfully`);
  if (result) {
    console.log(`[AI] ${functionName} result:`, JSON.stringify(result, null, 2));
  }
}

/**
 * تسجيل خطأ في تنفيذ وظيفة
 * @param functionName اسم الوظيفة
 * @param error الخطأ
 */
export function logFunctionError(functionName: string, error: any): void {
  console.error(`[AI] Error in ${functionName}:`, error);
  if (error.stack) {
    console.error(`[AI] ${functionName} error stack:`, error.stack);
  }
}
