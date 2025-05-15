/**
 * وظائف مساعدة لإنشاء دوال Firebase
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';

// تكوين CORS
export const corsHandler = cors({ origin: true });

/**
 * نوع بديل لـ CallableContext من Firebase Functions v1
 * يستخدم في الدوال التي تتوقع CallableContext
 */
export interface LegacyCallableContext {
  auth?: {
    uid: string;
    token: Record<string, any>;
  };
  rawRequest?: any;
}

/**
 * إنشاء دالة Firebase Callable بالصيغة الجديدة (v6+)
 * هذه الدالة تساعد في تحويل الدوال من الصيغة القديمة إلى الصيغة الجديدة
 *
 * @param handler دالة المعالجة
 * @param options خيارات الدالة (اختياري)
 * @returns دالة Firebase Callable
 */
export interface CallableRequest<T> {
  data: T;
  auth?: {
    uid: string;
    token: Record<string, any>;
  };
  rawRequest: any;
}

export function createCallableFunction<T = any, R = any>(
  handler: (request: CallableRequest<T>) => Promise<R> | R,
  options: { region?: string; requireAuth?: boolean } = {}
) {
  const region = options.region || 'us-central1';
  const requireAuth = options.requireAuth !== false; // افتراضياً true إلا إذا تم تحديده صراحةً كـ false

  return functions.region(region).https.onCall(async (data, context) => {
    try {
      // التحقق من المصادقة إذا كانت مطلوبة
      if (requireAuth && !context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'يجب تسجيل الدخول لاستخدام هذه الوظيفة.'
        );
      }

      // تحويل data و context إلى كائن request
      const request: CallableRequest<T> = {
        data: data,
        auth: context.auth ? {
          uid: context.auth.uid,
          token: context.auth.token
        } : undefined,
        rawRequest: context.rawRequest
      };

      // تنفيذ الدالة وإرجاع النتيجة
      return await handler(request);
    } catch (error: any) {
      console.error('Error in callable function:', error);

      // إعادة إرسال أخطاء HttpsError كما هي
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // تحويل الأخطاء الأخرى إلى HttpsError
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'حدث خطأ داخلي غير معروف.'
      );
    }
  });
}

/**
 * إنشاء دالة Firebase HTTP بالصيغة الجديدة (v6+)
 *
 * @param handler دالة المعالجة
 * @param options خيارات الدالة (اختياري)
 * @returns دالة Firebase HTTP
 */
export function createHttpFunction(
  handler: (req: functions.https.Request, res: any, userId?: string) => Promise<void> | void,
  options: { region?: string; requireAuth?: boolean } = {}
) {
  const region = options.region || 'us-central1';
  const requireAuth = options.requireAuth !== false; // افتراضياً true إلا إذا تم تحديده صراحةً كـ false

  return functions.region(region).https.onRequest(async (req, res) => {
    // التعامل مع CORS
    return corsHandler(req, res, async () => {
      try {
        // التحقق من المصادقة إذا كانت مطلوبة
        let userId: string | undefined;

        if (requireAuth) {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).send({ error: 'يجب توفير رمز المصادقة.' });
            return;
          }

          const idToken = authHeader.split('Bearer ')[1];
          try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            userId = decodedToken.uid;
          } catch (error) {
            res.status(401).send({ error: 'رمز المصادقة غير صالح.' });
            return;
          }
        }

        // تنفيذ الدالة
        await handler(req, res, userId);
      } catch (error: any) {
        console.error('Error in HTTP function:', error);
        res.status(500).send({
          error: error.message || 'حدث خطأ داخلي غير معروف.'
        });
      }
    });
  });
}
