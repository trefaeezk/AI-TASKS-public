'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/hooks/use-auth';

interface TestStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: any;
}

export function CreateUserTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testPassword, setTestPassword] = useState('testpass123');
  const { user } = useAuth();

  const updateStep = (stepName: string, status: TestStep['status'], message?: string, details?: any) => {
    setSteps(prev => prev.map(step =>
      step.name === stepName
        ? { ...step, status, message, details }
        : step
    ));
  };

  const runCreateUserTest = async () => {
    if (!user) {
      alert('يجب تسجيل الدخول أولاً');
      return;
    }

    setIsRunning(true);

    const initialSteps: TestStep[] = [
      { name: 'التحقق من Functions', status: 'pending' },
      { name: 'التحقق من المصادقة', status: 'pending' },
      { name: 'إعداد بيانات الاختبار', status: 'pending' },
      { name: 'فحص إعدادات الدالة', status: 'pending' },
      { name: 'استدعاء createUser', status: 'pending' },
      { name: 'تحليل النتيجة', status: 'pending' },
      { name: 'عرض التفاصيل', status: 'pending' }
    ];

    setSteps(initialSteps);

    try {
      // Step 1: Check Functions
      updateStep('التحقق من Functions', 'running');
      if (!functions) {
        updateStep('التحقق من Functions', 'error', 'Firebase Functions غير متاح');
        return;
      }
      updateStep('التحقق من Functions', 'success', 'Firebase Functions متاح');

      // Step 2: Check Authentication
      updateStep('التحقق من المصادقة', 'running');
      if (!user) {
        updateStep('التحقق من المصادقة', 'error', 'المستخدم غير مسجل دخول');
        return;
      }
      updateStep('التحقق من المصادقة', 'success', `مسجل دخول: ${user.email}`);

      // Step 3: Prepare test data
      updateStep('إعداد بيانات الاختبار', 'running');
      const testData = {
        email: testEmail,
        password: testPassword,
        name: 'Test User',
        role: 'org_assistant',
        accountType: 'individual'
      };
      updateStep('إعداد بيانات الاختبار', 'success', 'تم إعداد البيانات', testData);

      // Step 4: Call createUser function using Smart Service
      updateStep('استدعاء createUser', 'running');

      console.log('🧪 Testing createUserHttp directly:', testData);

      try {
        // استخدام createUserHttp مباشرة
        const createUserFn = httpsCallable(functions, 'createUserHttp');

        updateStep('فحص إعدادات الدالة', 'success', 'استخدام createUserHttp مباشرة');

        // استدعاء الدالة
        const result = await createUserFn(testData);

        console.log('🧪 createUserHttp result:', result);

        updateStep('استدعاء createUserHttp', 'success', 'تم استدعاء الدالة بنجاح', {
          data: result.data
        });

        // Step 5: Analyze result
        updateStep('تحليل النتيجة', 'running');

        if ((result.data as any)?.error) {
          updateStep('تحليل النتيجة', 'error', `خطأ من الدالة: ${(result.data as any).error}`, result.data);
        } else if ((result.data as any)?.uid) {
          updateStep('تحليل النتيجة', 'success', `✅ تم إنشاء المستخدم بنجاح: ${(result.data as any).uid}`, result.data);

          // إضافة خطوة إضافية لعرض التفاصيل
          updateStep('عرض التفاصيل', 'success', `المستخدم: ${testData.email}, الدور: ${testData.role}, النوع: ${testData.accountType}`, {
            uid: (result.data as any).uid,
            email: testData.email,
            role: testData.role,
            accountType: testData.accountType
          });
        } else {
          updateStep('تحليل النتيجة', 'error', 'نتيجة غير متوقعة من الدالة', result.data);
        }

      } catch (error: any) {
        console.error('🧪 createUserHttp error:', error);
        updateStep('استدعاء createUserHttp', 'error', `فشل استدعاء الدالة: ${error.message}`, {
          error: error.message,
          code: error.code,
          details: error
        });

        updateStep('تحليل النتيجة', 'error', 'فشل في إنشاء المستخدم', error);
      }

    } catch (error: any) {
      console.error('🚨 Error in createUser test:', error);

      const currentStep = steps.find(s => s.status === 'running')?.name || 'استدعاء createUser';

      let errorMessage = error.message || 'خطأ غير معروف';
      if (error.code) {
        errorMessage = `${error.code}: ${errorMessage}`;
      }

      updateStep(currentStep, 'error', errorMessage, {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (step: TestStep) => {
    switch (step.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>اختبار إنشاء مستخدم</CardTitle>
        <CardDescription>
          اختبار مفصل لعملية إنشاء مستخدم جديد
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="testEmail">البريد الإلكتروني للاختبار</Label>
            <Input
              id="testEmail"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              disabled={isRunning}
            />
          </div>
          <div>
            <Label htmlFor="testPassword">كلمة المرور للاختبار</Label>
            <Input
              id="testPassword"
              type="password"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              placeholder="كلمة مرور قوية"
              disabled={isRunning}
            />
          </div>
        </div>

        <Button
          onClick={runCreateUserTest}
          disabled={isRunning || !user}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري الاختبار...
            </>
          ) : (
            <>
              <Play className="ml-2 h-4 w-4" />
              بدء اختبار إنشاء المستخدم
            </>
          )}
        </Button>

        {!user && (
          <Alert>
            <AlertDescription>
              يجب تسجيل الدخول أولاً لتشغيل هذا الاختبار
            </AlertDescription>
          </Alert>
        )}

        {steps.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">خطوات الاختبار:</h4>
            {steps.map((step, index) => (
              <div key={index} className="flex items-start space-x-3 space-x-reverse p-3 border rounded-lg">
                {getStepIcon(step)}
                <div className="flex-1">
                  <div className="font-medium">{step.name}</div>
                  {step.message && (
                    <div className={`text-sm mt-1 ${
                      step.status === 'error' ? 'text-red-600' :
                      step.status === 'success' ? 'text-green-600' :
                      'text-gray-600'
                    }`}>
                      {step.message}
                    </div>
                  )}
                  {step.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        عرض التفاصيل
                      </summary>
                      <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
