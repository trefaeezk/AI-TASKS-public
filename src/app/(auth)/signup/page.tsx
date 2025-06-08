// src/app/(auth)/signup/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Mail, Lock, UserPlus, Loader2, User, CheckCircle } from 'lucide-react'; // Added User icon

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { AuthFormWrapper } from '@/components/auth/AuthFormWrapper';
import { GoogleIcon } from '@/components/icons/GoogleIcon'; // Assuming you create this icon component
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';

// سيتم تعريف signupSchema داخل المكون للوصول إلى دالة الترجمة t

export default function SignupPage() {
  const { t, direction } = useLanguage();
  const { signUp, signInWithGoogle, loading, error } = useFirebaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [showSuccess, setShowSuccess] = useState(() => {
    // التحقق من localStorage عند التحميل
    if (typeof window !== 'undefined') {
      return localStorage.getItem('signup_success') === 'true';
    }
    return false;
  });
  const [isRedirecting, setIsRedirecting] = useState(false);

  // تعريف مخطط التحقق مع رسائل مترجمة
  const signupSchema = z.object({
    name: z.string().min(1, { message: t('auth.nameRequired') }),
    email: z.string().email({ message: t('auth.invalidEmail') }),
    password: z.string().min(6, { message: t('auth.passwordMinLength', { length: '6' }) }),
    confirmPassword: z.string().min(1, { message: t('auth.confirmPasswordRequired') }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

  type SignupFormValues = z.infer<typeof signupSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  // تنظيف localStorage عند مغادرة الصفحة
  useEffect(() => {
    return () => {
      // تنظيف localStorage عند إلغاء تحميل المكون
      if (!showSuccess) {
        localStorage.removeItem('signup_success');
      }
    };
  }, [showSuccess]);

  const onSubmit = async (data: SignupFormValues) => {
    setFormError(null);
    const success = await signUp(data.email, data.password, data.name);
    if (success) {
      // حفظ حالة النجاح في localStorage
      localStorage.setItem('signup_success', 'true');

      // عرض رسالة نجاح
      setShowSuccess(true);

      // عرض toast للنجاح
      toast({
        title: t('auth.registrationSuccessful'),
        description: t('auth.pleaseSignIn'),
        duration: 8000,
      });

      // انتظار 5 ثوان ثم التوجه لصفحة تسجيل الدخول
      setTimeout(() => {
        setIsRedirecting(true);
        setTimeout(() => {
          // مسح حالة النجاح قبل التوجه
          localStorage.removeItem('signup_success');
          router.push('/login');
        }, 1000);
      }, 5000);
    } else {
      // Error handled by hook's toast
      setFormError(error || t('auth.signupFailed'));
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError(null);
    const success = await signInWithGoogle();
    if (success) {
      router.push('/'); // Redirect to home page
    } else {
      setFormError(error || t('auth.googleSignInFailed'));
    }
  };

  // إذا تم التسجيل بنجاح، عرض رسالة النجاح
  if (showSuccess) {
    return (
      <AuthFormWrapper
        title={t('auth.registrationSuccessful')}
        description=""
        footer={null}
      >
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {t('auth.accountCreatedSuccessfully')}
            </h3>
            <p className="text-muted-foreground">
              {isRedirecting ?
                'جاري التوجيه الآن...' :
                t('auth.redirectingToLogin')
              }
            </p>
          </div>
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>

          {/* عداد تنازلي */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">
              ✅ تم إنشاء حسابك بنجاح!
            </p>
            <p className="text-xs text-green-600 mt-1">
              سيتم توجيهك لصفحة تسجيل الدخول خلال ثوانٍ...
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setIsRedirecting(true);
              // مسح حالة النجاح قبل التوجه
              localStorage.removeItem('signup_success');
              router.push('/login');
            }}
            className="w-full"
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                جاري التوجيه...
              </>
            ) : (
              t('auth.goToLogin')
            )}
          </Button>
        </div>
      </AuthFormWrapper>
    );
  }

  return (
    <AuthFormWrapper
      title={t('auth.register')}
      description={t('auth.registerDescription')}
      footer={
        <>
          {t('auth.alreadyHaveAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('auth.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir={direction}>
         {/* Display general form error */}
        {formError && !error && (
            <p className="text-sm font-medium text-destructive text-center">{formError}</p>
        )}

        <div className="relative">
          <User className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground`} />
          <Input
            id="name"
            type="text"
            placeholder={t('auth.namePlaceholder')}
            {...register('name')}
            className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} bg-input border-input focus:ring-primary`}
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby="name-error"
            required
          />
        </div>
        {errors.name && <p id="name-error" className="text-sm font-medium text-destructive">{errors.name.message}</p>}

        <div className="relative">
          <Mail className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground`} />
          <Input
            id="email"
            type="email"
            placeholder={t('auth.emailPlaceholder')}
            {...register('email')}
            className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} bg-input border-input focus:ring-primary`}
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby="email-error"
            required
          />
        </div>
        {errors.email && <p id="email-error" className="text-sm font-medium text-destructive">{errors.email.message}</p>}

        <div className="relative">
          <Lock className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground`} />
          <Input
            id="password"
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            {...register('password')}
            className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} bg-input border-input focus:ring-primary`}
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby="password-error"
            required
          />
        </div>
         {errors.password && <p id="password-error" className="text-sm font-medium text-destructive">{errors.password.message}</p>}

        <div className="relative">
          <Lock className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground`} />
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t('auth.confirmPasswordPlaceholder')}
            {...register('confirmPassword')}
            className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} bg-input border-input focus:ring-primary`}
            aria-invalid={errors.confirmPassword ? "true" : "false"}
            aria-describedby="confirmPassword-error"
            required
          />
        </div>
         {errors.confirmPassword && <p id="confirmPassword-error" className="text-sm font-medium text-destructive">{errors.confirmPassword.message}</p>}

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          <span>{t('auth.register')}</span>
        </Button>
      </form>

      <div className="relative my-6">
        <Separator className="absolute left-0 top-1/2 w-full -translate-y-1/2" />
        <span className="relative z-10 bg-card px-2 text-xs uppercase text-muted-foreground">
          {t('auth.orContinueWith')}
        </span>
      </div>

      <Button
        variant="outline"
        className="w-full border-input hover:bg-accent hover:text-accent-foreground"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
         {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <GoogleIcon className="h-5 w-5" />}
        <span>{t('auth.signInWithGoogle')}</span>
      </Button>
    </AuthFormWrapper>
  );
}
