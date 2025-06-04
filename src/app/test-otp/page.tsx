'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export default function TestOTPPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testOTP = async () => {
    if (!email) {
      setError('يرجى إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const testSendOTP = httpsCallable(functions, 'testSendOTP');
      const response = await testSendOTP({ email });
      const data = response.data as { success: boolean; message: string };
      
      if (data.success) {
        setResult(`✅ ${data.message}`);
      } else {
        setError(`❌ ${data.message}`);
      }
    } catch (error: any) {
      console.error('Error testing OTP:', error);
      setError(`خطأ: ${error.message || 'فشل في إرسال OTP'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">اختبار إرسال OTP</h1>
        
        <div className="space-y-4">
          <Input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          
          <Button
            onClick={testOTP}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال OTP تجريبي'}
          </Button>
          
          {result && (
            <Alert>
              <AlertDescription className="text-green-600">
                {result}
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="text-sm text-gray-600 text-center">
            سيتم إرسال OTP تجريبي: 123456
          </div>
        </div>
      </div>
    </div>
  );
}
