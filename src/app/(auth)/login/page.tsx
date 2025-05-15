// src/app/(auth)/login/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Use App Router's router
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { AuthFormWrapper } from '@/components/auth/AuthFormWrapper';
import { GoogleIcon } from '@/components/icons/GoogleIcon'; // Assuming you create this icon component

const loginSchema = z.object({
  email: z.string().email({ message: 'البريد الإلكتروني غير صالح' }), // Invalid email
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون على الأقل 6 أحرف' }), // Password must be at least 6 characters
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { signIn, signInWithGoogle, loading, error } = useFirebaseAuth();
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });
   const [formError, setFormError] = useState<string | null>(null);


  const onSubmit = async (data: LoginFormValues) => {
     setFormError(null); // Clear previous form errors
    const success = await signIn(data.email, data.password);
    if (success) {
      router.push('/'); // Redirect to home page on successful login
    } else {
       // Error is handled by the hook's toast, but we can set a state if needed
       setFormError(error || 'فشل تسجيل الدخول. يرجى التحقق من بيانات الاعتماد الخاصة بك.'); // Login failed. Please check your credentials.
    }
  };

  const handleGoogleSignIn = async () => {
     setFormError(null);
    const success = await signInWithGoogle();
    if (success) {
      router.push('/'); // Redirect to home page
    } else {
       // Error handled by hook's toast
       setFormError(error || 'فشل تسجيل الدخول باستخدام جوجل.'); // Failed to sign in with Google.
    }
  };

  return (
    <AuthFormWrapper
      title="تسجيل الدخول"
      description="مرحبًا بعودتك! قم بتسجيل الدخول للوصول إلى مهامك."
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            أنشئ حسابًا
          </Link>
          <br />
          <Link href="/reset-password" className="font-medium text-primary hover:underline">
            هل نسيت كلمة المرور؟
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Display general form error */}
        {formError && !error && /* Show only if hook error isn't already displayed by toast */ (
            <p className="text-sm font-medium text-destructive text-center">{formError}</p>
        )}

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="البريد الإلكتروني"
            {...register('email')}
            className="pl-10 bg-input border-input focus:ring-primary"
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby="email-error"
            required
          />
        </div>
        {errors.email && <p id="email-error" className="text-sm font-medium text-destructive">{errors.email.message}</p>}

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="كلمة المرور"
            {...register('password')}
            className="pl-10 bg-input border-input focus:ring-primary"
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby="password-error"
            required
          />
        </div>
        {errors.password && <p id="password-error" className="text-sm font-medium text-destructive">{errors.password.message}</p>}

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          <span>تسجيل الدخول</span>
        </Button>
      </form>

      <div className="relative my-6">
        <Separator className="absolute left-0 top-1/2 w-full -translate-y-1/2" />
        <span className="relative z-10 bg-card px-2 text-xs uppercase text-muted-foreground">
          أو استمر بواسطة
        </span>
      </div>

      <Button
        variant="outline"
        className="w-full border-input hover:bg-accent hover:text-accent-foreground"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
         {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <GoogleIcon className="h-5 w-5"/>}
        <span>تسجيل الدخول باستخدام جوجل</span>
      </Button>
    </AuthFormWrapper>
  );
}
