'use client';

import React from 'react';
import { FirebaseFunctionsDiagnostic } from '@/components/debug/FirebaseFunctionsDiagnostic';
import { FunctionsStatus } from '@/components/debug/FunctionsStatus';
import { CreateUserTest } from '@/components/debug/CreateUserTest';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function DiagnosticsPage() {
  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          🔧 صفحة التشخيص
        </h1>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          هذه الصفحة تساعد في تشخيص مشاكل Firebase Functions وإدارة المستخدمين.
          استخدم هذه الأدوات لفهم سبب عدم عمل إنشاء أو تعديل المستخدمين.
        </AlertDescription>
      </Alert>

      <FunctionsStatus />

      <CreateUserTest />

      <FirebaseFunctionsDiagnostic />

      <Card>
        <CardHeader>
          <CardTitle>معلومات إضافية للتشخيص</CardTitle>
          <CardDescription>
            معلومات مفيدة لحل المشاكل
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">الأخطاء الشائعة وحلولها:</h4>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>
                <strong>CORS Error:</strong> تأكد من أن Firebase Functions منشورة بشكل صحيح
              </li>
              <li>
                <strong>functions/unauthenticated:</strong> تأكد من تسجيل الدخول قبل استدعاء الدوال
              </li>
              <li>
                <strong>functions/permission-denied:</strong> تأكد من أن المستخدم لديه صلاحيات admin
              </li>
              <li>
                <strong>functions/internal:</strong> خطأ في الخادم، تحقق من logs في Firebase Console
              </li>
              <li>
                <strong>functions/unavailable:</strong> الخدمة غير متاحة، حاول مرة أخرى لاحقاً
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">خطوات التحقق:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>تأكد من أن Firebase Functions منشورة: <code>firebase deploy --only functions</code></li>
              <li>تحقق من Firebase Console للتأكد من وجود الدوال</li>
              <li>تأكد من أن المستخدم مسجل دخول ولديه صلاحيات admin</li>
              <li>تحقق من Network tab في Developer Tools للأخطاء</li>
              <li>تحقق من Firebase Functions logs في Console</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2">معلومات البيئة:</h4>
            <div className="bg-muted p-3 rounded text-sm font-mono">
              <div>Environment: {process.env.NODE_ENV}</div>
              <div>Hostname: {typeof window !== 'undefined' ? window.location.hostname : 'SSR'}</div>
              <div>Protocol: {typeof window !== 'undefined' ? window.location.protocol : 'SSR'}</div>
              <div>Port: {typeof window !== 'undefined' ? window.location.port : 'SSR'}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
