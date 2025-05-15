/**
 * ملف تكوين الذكاء الاصطناعي
 *
 * يحتوي على إعدادات وتكوينات الذكاء الاصطناعي المستخدمة في التطبيق
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import * as functions from 'firebase-functions';

// الحصول على مفتاح API من متغيرات البيئة
const API_KEY = process.env.GOOGLE_GENAI_API_KEY;

// التحقق من وجود مفتاح API
if (!API_KEY) {
  console.error('[AI Config] GOOGLE_GENAI_API_KEY environment variable is not set');
}

// إعدادات النموذج
export const MODEL_CONFIG = {
  name: 'gemini-1.5-pro',
  temperature: 0.2,
  topP: 0.8,
  topK: 40,
};

// إعدادات الأمان
export const SAFETY_SETTINGS = [
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

// إنشاء مثيل Google AI
export const genAI = new GoogleGenerativeAI(API_KEY || '');

// الحصول على نموذج Gemini
export function getModel() {
  return genAI.getGenerativeModel({
    model: MODEL_CONFIG.name,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: MODEL_CONFIG.temperature,
      topP: MODEL_CONFIG.topP,
      topK: MODEL_CONFIG.topK,
    },
  });
}
