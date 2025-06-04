'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthFormWrapper } from '@/components/auth/AuthFormWrapper';
import { Loader2, CheckCircle, Building, User, Mail, Lock, Shield, XCircle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// مخططات التحقق
const otpSchema = z.object({
  otp: z.string().length(6, 'رمز التحقق يجب أن يكون 6 أرقام'),
});

const registrationSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
  displayName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

type OTPFormValues = z.infer<typeof otpSchema>;
type RegistrationFormValues = z.infer<typeof registrationSchema>;

interface InvitationInfo {
  invitation: {
    id: string;
    email: string;
    role: string;
    status: 'pending' | 'accepted' | 'rejected';
    invitedByName: string;
    createdAt: any;
    departmentId: string | null;
  };
  organization: {
    id: string;
    name: string;
    description: string | null;
    type: string | null;
    website: string | null;
  };
  department: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams();
  const invitationId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'otp' | 'registration' | 'completed'>('otp');

  // ترجمة الأدوار
  const roleTranslations: { [key: string]: string } = {
    'isOrgOwner': 'مالك المؤسسة',
    'isOrgAdmin': 'مدير المؤسسة',
    'isOrgSupervisor': 'مشرف',
    'isOrgEngineer': 'مهندس',
    'isOrgTechnician': 'فني',
    'isOrgAssistant': 'مساعد'
  };

  // نماذج React Hook Form
  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
  });

  const registrationForm = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
  });

  // التحقق من OTP وجلب بيانات الدعوة
  const onOTPSubmit = async (data: OTPFormValues) => {
    setLoading(true);
    setError(null);

    try {
      const getInvitationInfo = httpsCallable(functions, 'getInvitationInfo');
      const result = await getInvitationInfo({
        invitationId,
        otp: data.otp
      });

      const responseData = result.data as { success: boolean } & InvitationInfo;

      if (responseData.success) {
        setInvitationInfo(responseData);
        // تعيين البريد الإلكتروني في نموذج التسجيل
        registrationForm.setValue('email', responseData.invitation.email);
        setStep('registration');
      } else {
        setError('فشل في جلب بيانات الدعوة');
      }

    } catch (error: any) {
      console.error('Error verifying OTP and fetching invitation info:', error);

      if (error.code === 'functions/not-found') {
        setError('الدعوة غير موجودة أو انتهت صلاحيتها');
      } else if (error.code === 'functions/failed-precondition') {
        setError(error.message || 'يجب إدخال رمز التحقق المرسل إلى بريدك الإلكتروني');
      } else if (error.code === 'functions/permission-denied') {
        setError('رمز التحقق غير صحيح');
      } else if (error.code === 'functions/deadline-exceeded') {
        setError('انتهت صلاحية رمز التحقق');
      } else {
        setError('حدث خطأ أثناء التحقق من رمز التحقق');
      }
    } finally {
      setLoading(false);
    }
  };

  // إنشاء الحساب وقبول الدعوة
  const onRegistrationSubmit = async (data: RegistrationFormValues) => {
    if (!invitationInfo) return;

    setProcessing(true);
    setError(null);

    try {
      const acceptOrganizationInvitation = httpsCallable(functions, 'acceptOrganizationInvitation');
      await acceptOrganizationInvitation({
        invitationId,
        otp: otpForm.getValues('otp'),
        email: data.email,
        password: data.password,
        displayName: data.displayName || undefined
      });

      setStep('completed');

      // إعادة توجيه إلى صفحة تسجيل الدخول بعد 3 ثوان
      setTimeout(() => {
        router.push('/login?message=account-created');
      }, 3000);

    } catch (error: any) {
      console.error('Error creating account and accepting invitation:', error);

      if (error.code === 'functions/permission-denied') {
        setError('رمز التحقق غير صحيح أو انتهت صلاحيته');
      } else if (error.code === 'auth/email-already-in-use') {
        setError('هذا البريد الإلكتروني مستخدم بالفعل');
      } else if (error.code === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة جداً');
      } else {
        setError(error.message || 'حدث خطأ أثناء إنشاء الحساب');
      }
    } finally {
      setProcessing(false);
    }
  };

  // عرض خطوة إدخال OTP
  if (step === 'otp') {
    return (
      <AuthFormWrapper
        title="رمز التحقق"
        description="أدخل رمز التحقق المرسل إلى بريدك الإلكتروني"
      >
        <form onSubmit={otpForm.handleSubmit(onOTPSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="relative">
            <Shield className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="123456"
              {...otpForm.register('otp')}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                otpForm.setValue('otp', value);
              }}
              className="pr-10 text-center text-lg tracking-widest"
              maxLength={6}
              aria-invalid={otpForm.formState.errors.otp ? "true" : "false"}
            />
          </div>
          {otpForm.formState.errors.otp && (
            <p className="text-sm font-medium text-destructive">
              {otpForm.formState.errors.otp.message}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              'تحقق من الرمز'
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            لم تستلم الرمز؟ تحقق من مجلد الرسائل غير المرغوب فيها
          </div>

          {/* رابط العودة في حالة الخطأ */}
          {error && (
            <Button
              type="button"
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              العودة للصفحة الرئيسية
            </Button>
          )}
        </form>
      </AuthFormWrapper>
    );
  }

  // عرض صفحة إنشاء الحساب
  if (step === 'registration' && invitationInfo) {
    return (
      <AuthFormWrapper
        title="إنشاء حساب جديد"
        description={`أكمل إنشاء حسابك للانضمام إلى ${invitationInfo.organization.name}`}
      >
        <form onSubmit={registrationForm.handleSubmit(onRegistrationSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* معلومات المؤسسة */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
              <Building className="h-5 w-5 ml-2" />
              تفاصيل المؤسسة
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">اسم المؤسسة:</span>
                <span className="font-medium text-blue-700">{invitationInfo.organization.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">الدور المطلوب:</span>
                <Badge variant="secondary">
                  {roleTranslations[invitationInfo.invitation.role] || invitationInfo.invitation.role}
                </Badge>
              </div>
              {invitationInfo.department && (
                <div className="flex justify-between">
                  <span className="text-gray-600">القسم:</span>
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    {invitationInfo.department.name}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* حقول النموذج */}
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder="البريد الإلكتروني"
              {...registrationForm.register('email')}
              className="pr-10 bg-gray-50"
              readOnly
            />
          </div>
          {registrationForm.formState.errors.email && (
            <p className="text-sm font-medium text-destructive">
              {registrationForm.formState.errors.email.message}
            </p>
          )}

          <div className="relative">
            <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="الاسم الكامل (اختياري)"
              {...registrationForm.register('displayName')}
              className="pr-10"
            />
          </div>

          <div className="relative">
            <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="كلمة المرور"
              {...registrationForm.register('password')}
              className="pr-10"
            />
          </div>
          {registrationForm.formState.errors.password && (
            <p className="text-sm font-medium text-destructive">
              {registrationForm.formState.errors.password.message}
            </p>
          )}

          <div className="relative">
            <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="تأكيد كلمة المرور"
              {...registrationForm.register('confirmPassword')}
              className="pr-10"
            />
          </div>
          {registrationForm.formState.errors.confirmPassword && (
            <p className="text-sm font-medium text-destructive">
              {registrationForm.formState.errors.confirmPassword.message}
            </p>
          )}

          <Button
            type="submit"
            disabled={processing}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <CheckCircle className="h-4 w-4 ml-2" />
            )}
            إنشاء الحساب وقبول الدعوة
          </Button>
        </form>
      </AuthFormWrapper>
    );
  }

  // عرض صفحة اكتمال العملية
  if (step === 'completed') {
    return (
      <AuthFormWrapper
        title="تم إنشاء الحساب بنجاح!"
        description="تم قبول الدعوة وإنشاء حسابك بنجاح"
      >
        <div className="text-center space-y-4">
          <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-green-800">
              مرحباً بك في <strong>{invitationInfo?.organization.name}</strong>
            </p>
            <p className="text-sm text-green-600 mt-2">
              سيتم توجيهك لصفحة تسجيل الدخول خلال ثوان...
            </p>
          </div>

          <Button
            onClick={() => router.push('/login')}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            الذهاب لتسجيل الدخول الآن
          </Button>
        </div>
      </AuthFormWrapper>
    );
  }

  // حالة افتراضية (لا يجب الوصول إليها)
  return (
    <AuthFormWrapper
      title="جاري التحميل..."
      description="يرجى الانتظار"
    >
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      </div>
    </AuthFormWrapper>
  );
}
