/**
 * وظائف مساعدة للتسجيل والتتبع
 */

import * as functions from 'firebase-functions';

/**
 * تسجيل بداية تنفيذ وظيفة
 * @param functionName اسم الوظيفة
 * @param data البيانات المرسلة للوظيفة (اختياري)
 */
export const logFunctionStart = (functionName: string, data?: any): void => {
  console.log(`[${functionName}] بدء التنفيذ`, data ? { data } : '');
};

/**
 * تسجيل نهاية تنفيذ وظيفة
 * @param functionName اسم الوظيفة
 * @param result نتيجة تنفيذ الوظيفة (اختياري)
 */
export const logFunctionEnd = (functionName: string, result?: any): void => {
  console.log(`[${functionName}] انتهاء التنفيذ`, result ? { result } : '');
};

/**
 * تسجيل خطأ في تنفيذ وظيفة
 * @param functionName اسم الوظيفة
 * @param error الخطأ الذي حدث
 */
export const logFunctionError = (functionName: string, error: any): void => {
  console.error(`[${functionName}] خطأ في التنفيذ:`, error instanceof Error ? error.message : error);
};

/**
 * التحقق من وجود الحقول المطلوبة في البيانات
 * @param data البيانات المرسلة
 * @param requiredFields الحقول المطلوبة
 */
export const validateInput = (data: any, requiredFields: string[]): void => {
  if (!data) {
    throw new functions.https.HttpsError('invalid-argument', 'البيانات المرسلة غير صالحة.');
  }

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `الحقل "${field}" مطلوب.`
      );
    }
  }
};
