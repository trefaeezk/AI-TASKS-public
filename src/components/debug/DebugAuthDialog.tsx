'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Lock, ShieldAlert, RefreshCw, KeyRound, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DebugAuthDialogProps {
  isOpen: boolean;
  onAuthenticated: () => void;
}

export function DebugAuthDialog({ isOpen, onAuthenticated }: DebugAuthDialogProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isGeneratingOTP, setIsGeneratingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);
  const [otpExpiryTime, setOtpExpiryTime] = useState<string | null>(null);
  const { toast } = useToast();

  // إنشاء رمز OTP جديد
  const handleGenerateOTP = async () => {
    setIsGeneratingOTP(true);
    setError(false);

    try {
      // استخدام Firebase Functions مباشرة
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctions } = await import('firebase/functions');
      const firebaseConfig = await import('@/config/firebase');
      const app = firebaseConfig.app as any;

      // تهيئة Firebase Functions
      const functions = getFunctions(app);

      console.log('Calling generateAndSendOTP function...');
      console.log('Firebase Functions instance:', functions);
      const generateAndSendOTP = httpsCallable(functions, 'generateAndSendOTP');
      console.log('Function reference created, calling function...');
      const result = await generateAndSendOTP({});
      console.log('Function call result:', result);

      // @ts-ignore
      const data = result.data;

      if ((data as any).success) {
        // إذا تم إرسال البريد الإلكتروني بنجاح، لا نعرض الرمز في الواجهة
        if ((data as any).emailSent) {
          setGeneratedOTP(null);
          setOtpExpiryTime((data as any).expiryTime);

          toast({
            title: 'تم إرسال رمز التحقق',
            description: (data as any).message,
          });
        } else {
          // إذا فشل إرسال البريد الإلكتروني، نعرض الرمز في الواجهة مؤقتًا
          // هذا للتطوير فقط، يجب إزالته في الإنتاج
          setGeneratedOTP('******'); // لا نعرض الرمز الفعلي
          setOtpExpiryTime((data as any).expiryTime);

          toast({
            title: 'تم إنشاء رمز التحقق',
            description: 'تم إنشاء رمز التحقق ولكن فشل إرساله عبر البريد الإلكتروني. يرجى التحقق من بريدك الإلكتروني أو الاتصال بمسؤول النظام.',
            variant: 'destructive',
          });
        }
      } else {
        setError(true);
        setErrorMessage((data as any).error || 'فشل إنشاء رمز التحقق');

        toast({
          title: 'خطأ',
          description: (data as any).error || 'فشل إنشاء رمز التحقق',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error generating OTP:', error);
      setError(true);
      setErrorMessage(error.message || 'حدث خطأ أثناء إنشاء رمز التحقق');

      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء رمز التحقق',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingOTP(false);
    }
  };

  // التحقق من رمز OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp) {
      setError(true);
      setErrorMessage('يرجى إدخال رمز التحقق');
      return;
    }

    setIsVerifyingOTP(true);
    setError(false);

    try {
      // استخدام Firebase Functions مباشرة
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctions } = await import('firebase/functions');
      const firebaseConfig = await import('@/config/firebase');
      const app = firebaseConfig.app as any;

      // تهيئة Firebase Functions
      const functions = getFunctions(app);

      console.log('Calling verifyOTP function with code:', otp);
      const verifyOTPFn = httpsCallable(functions, 'verifyOTP');
      const result = await verifyOTPFn({ otp });

      // @ts-ignore
      const data = result.data;

      if ((data as any).success) {
        // تخزين وقت انتهاء الصلاحية في التخزين المحلي
        localStorage.setItem('debugAuthExpiry', (data as any).sessionExpiryTime.toString());

        // إغلاق مربع الحوار وإعلام الصفحة الأم
        onAuthenticated();
        setError(false);
        setOtp('');
        setGeneratedOTP(null);

        toast({
          title: 'تم المصادقة بنجاح',
          description: 'تم منح الوصول إلى صفحة التشخيص لمدة 30 دقيقة',
        });
      } else {
        setError(true);
        setErrorMessage((data as any).error || 'رمز التحقق غير صحيح');
        setAttempts(attempts + 1);

        if (attempts >= 3) {
          toast({
            title: 'تحذير أمني',
            description: 'تم تسجيل محاولات متعددة للوصول غير المصرح به',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'خطأ',
            description: (data as any).error || 'رمز التحقق غير صحيح',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setError(true);
      setErrorMessage(error.message || 'حدث خطأ أثناء التحقق من رمز التحقق');

      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء التحقق من رمز التحقق',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  // تنسيق وقت انتهاء الصلاحية
  const formatExpiryTime = (isoString: string) => {
    if (!isoString) return '';

    const expiryDate = new Date(isoString);
    return expiryDate.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ShieldAlert className="ml-2 h-5 w-5 text-warning" />
            التحقق من الهوية
          </DialogTitle>
          <DialogDescription>
            هذه الصفحة محمية. يرجى إنشاء رمز تحقق وإدخاله للوصول إلى صفحة التشخيص.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="generate">إنشاء رمز التحقق</TabsTrigger>
            <TabsTrigger value="verify">إدخال رمز التحقق</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                انقر على الزر أدناه لإنشاء رمز تحقق جديد وإرساله إلى بريدك الإلكتروني. سيكون الرمز صالحًا لمدة 30 دقيقة.
              </p>
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>ملاحظة</AlertTitle>
                <AlertDescription className="text-xs">
                  سيتم إرسال رمز التحقق إلى بريدك الإلكتروني المسجل في النظام. يرجى التحقق من صندوق الوارد الخاص بك وأيضًا مجلد البريد غير المرغوب فيه (Spam).
                </AlertDescription>
              </Alert>
              <Alert className="mt-2" variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>تنبيه</AlertTitle>
                <AlertDescription className="text-xs">
                  قد يستغرق وصول البريد الإلكتروني بضع دقائق. إذا لم يصل البريد، يمكنك المحاولة مرة أخرى أو التواصل مع مسؤول النظام.
                </AlertDescription>
              </Alert>

              {generatedOTP && (
                <Alert variant="default">
                  <KeyRound className="h-4 w-4" />
                  <AlertTitle>تم إرسال رمز التحقق</AlertTitle>
                  <AlertDescription>
                    <p className="text-sm">تم إرسال رمز التحقق إلى بريدك الإلكتروني.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      الرمز صالح حتى الساعة {formatExpiryTime(otpExpiryTime || '')}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleGenerateOTP}
                  className="w-full"
                  disabled={isGeneratingOTP}
                >
                  {isGeneratingOTP ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري إنشاء الرمز...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="ml-2 h-4 w-4" />
                      إنشاء رمز تحقق جديد
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="verify" className="space-y-4">
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>خطأ في التحقق</AlertTitle>
                  <AlertDescription>
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="otp">رمز التحقق</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="pl-10 text-center font-mono text-lg"
                    placeholder="أدخل رمز التحقق"
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  أدخل رمز التحقق المكون من 6 أرقام الذي تم إرساله إلى بريدك الإلكتروني
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isVerifyingOTP}>
                  {isVerifyingOTP ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    'تأكيد'
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
