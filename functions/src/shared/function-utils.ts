/**
 * وظائف مساعدة لإنشاء دوال Firebase
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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
export interface CallableRequest<T = any> {
  data: T;
  auth?: {
    uid: string;
    token: Record<string, any>;
  };
  rawRequest: any;
}

export function createCallableFunction<T = any, R = any>(
  handler: (request: CallableRequest<T>) => Promise<R> | R,
  options: { region?: string; requireAuth?: boolean; runWith?: functions.RuntimeOptions } = {}
) {
  const region = options.region || 'us-central1';
  const requireAuth = options.requireAuth !== false; // افتراضياً true إلا إذا تم تحديده صراحةً كـ false
  // Ensure maxInstances is set to 10 by default for callable functions
  const runWithOptions = {
    maxInstances: 10,
    cors: true, // إضافة دعم CORS
    ...options.runWith
  };

  return functions.region(region).runWith(runWithOptions).https.onCall(async (data, context) => {
    try {
      // إضافة headers للـ CORS
      if (context.rawRequest && context.rawRequest.res) {
        const res = context.rawRequest.res;
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
      }

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
 * إنشاء دالة HTTP مع دعم CORS للتطوير
 * تستخدم فقط في بيئة التطوير لحل مشاكل CORS
 */
export function createHttpFunction<T = any, R = any>(
  handler: (request: CallableRequest<T>) => Promise<R> | R,
  options: { region?: string; requireAuth?: boolean; runWith?: functions.RuntimeOptions } = {}
) {
  const region = options.region || 'us-central1';
  const requireAuth = options.requireAuth !== false;
  const runWithOptions = { maxInstances: 10, ...options.runWith };

  return functions.region(region).runWith(runWithOptions).https.onRequest(async (req, res) => {
    // إعداد CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Firebase-Instance-ID-Token');
    res.set('Access-Control-Max-Age', '3600');

    // التعامل مع preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      // التحقق من طريقة الطلب
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      // استخراج البيانات من الطلب
      const data = req.body?.data || req.body;

      // محاولة استخراج معلومات المصادقة من headers
      let auth: any = undefined;
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decodedToken = await admin.auth().verifyIdToken(token);
          auth = {
            uid: decodedToken.uid,
            token: decodedToken
          };
        } catch (error) {
          console.error('Error verifying token:', error);
          if (requireAuth) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }
        }
      }

      // التحقق من المصادقة إذا كانت مطلوبة
      if (requireAuth && !auth) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // إنشاء كائن request
      const request: CallableRequest<T> = {
        data: data,
        auth: auth,
        rawRequest: req
      };

      // تنفيذ الدالة
      const result = await handler(request);

      // إرجاع النتيجة
      res.status(200).json({ data: result });

    } catch (error: any) {
      console.error('Error in HTTP function:', error);

      if (error instanceof functions.https.HttpsError) {
        res.status(400).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
      } else {
        res.status(500).json({
          error: {
            code: 'internal',
            message: error.message || 'Internal server error'
          }
        });
      }
    }
  });
}
