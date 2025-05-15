/**
 * ملف توافق مع Firebase Functions v1
 * يوفر هذا الملف دوالًا مساعدة لتحويل الكود من الصيغة القديمة إلى الصيغة الجديدة
 */

import * as functions from 'firebase-functions';
import { LegacyCallableContext } from './function-utils';

/**
 * محاكاة لـ functions.region().https.onCall من Firebase Functions v1
 *
 * @param region المنطقة
 * @returns كائن يحتوي على دالة https.onCall
 */
export function regionCompat(region: string) {
  return {
    https: {
      onCall: <T, R>(handler: (data: T, context: LegacyCallableContext) => Promise<R> | R) => {
        return functions.region(region).https.onCall((data, context) => {
          return handler(data, context);
        });
      },
      onRequest: (handler: (req: functions.https.Request, res: any) => void) => {
        return functions.region(region).https.onRequest(handler);
      }
    }
  };
}

/**
 * تطبيق التوافق مع Firebase Functions v1
 */
export const compatFunctions = {
  region: regionCompat
};

/**
 * استخدم هذه الدالة بدلاً من functions.region().https.onCall
 *
 * مثال:
 * ```
 * // بدلاً من
 * export const myFunction = functions.region("us-central1").https.onCall(async (data, context) => {
 *   // ...
 * });
 *
 * // استخدم
 * export const myFunction = v1Functions.region("us-central1").https.onCall(async (data, context) => {
 *   // ...
 * });
 * ```
 */
export const v1Functions = compatFunctions;
