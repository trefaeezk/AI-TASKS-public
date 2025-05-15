/**
 * وظائف مساعدة للذكاء الاصطناعي
 * 
 * هذا الملف يحتوي على وظائف مساعدة للتعامل مع Google AI API
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import * as functions from 'firebase-functions';

// تهيئة Google AI API
const API_KEY = process.env.GOOGLE_GENAI_API_KEY;
const MODEL_NAME = 'gemini-2.0-flash';

// التحقق من وجود مفتاح API
if (!API_KEY) {
  console.error('GOOGLE_GENAI_API_KEY environment variable is not set');
}

// إنشاء مثيل Google AI
const genAI = new GoogleGenerativeAI(API_KEY || '');

// إعدادات الأمان الافتراضية
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/**
 * إنشاء نموذج Gemini
 * @returns نموذج Gemini
 */
export function getModel() {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    safetySettings,
  });
}

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
      console.error('Error parsing JSON response:', parseError);
      console.error('Raw response:', text);
      throw new Error('فشل في تحليل استجابة الذكاء الاصطناعي كـ JSON');
    }
  } catch (error) {
    console.error('Error generating content:', error);
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
