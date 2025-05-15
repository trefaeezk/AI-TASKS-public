// src/app/(auth)/signup/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Mail, Lock, UserPlus, Loader2 } from 'lucide-react'; // Changed icon to UserPlus

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { AuthFormWrapper } from '@/components/auth/AuthFormWrapper';
import { GoogleIcon } from '@/components/icons/GoogleIcon'; // Assuming you create this icon component

const signupSchema = z.object({
  email: z.string().email({ message: 'البريد الإلكتروني غير صالح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون على الأقل 6 أحرف' }),
  confirmPassword: z.string().min(6, { message: 'تأكيد كلمة المرور مطلوب' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين', // Passwords do not match
  path: ['confirmPassword'], // Set the error on the confirmPassword field
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signUp, signInWithGoogle, loading, error } = useFirebaseAuth();
  const router = useRouter();
   const { register, handleSubmit, formState: { errors } } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });
   const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (data: SignupFormValues) => {
     setFormError(null);
    const success = await signUp(data.email, data.password);
    if (success) {
      router.push('/'); // Redirect to home page after successful signup
    } else {
      // Error handled by hook's toast
       setFormError(error || 'فشل إنشاء الحساب. قد يكون البريد الإلكتروني مستخدمًا بالفعل.'); // Signup failed. Email might already be in use.
    }
  };

   const handleGoogleSignIn = async () => {
     setFormError(null);
    const success = await signInWithGoogle();
    if (success) {
      router.push('/'); // Redirect to home page
    } else {
       setFormError(error || 'فشل تسجيل الدخول باستخدام جوجل.'); // Failed to sign in with Google.
    }
  };

  return (
    <AuthFormWrapper
      title="إنشاء حساب جديد"
      description="انضم إلينا لإدارة مهامك بذكاء."
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
         {/* Display general form error */}
        {formError && !error && (
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

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type="password"
            placeholder="تأكيد كلمة المرور"
            {...register('confirmPassword')}
            className="pl-10 bg-input border-input focus:ring-primary"
             aria-invalid={errors.confirmPassword ? "true" : "false"}
             aria-describedby="confirmPassword-error"
             required
          />
        </div>
         {errors.confirmPassword && <p id="confirmPassword-error" className="text-sm font-medium text-destructive">{errors.confirmPassword.message}</p>}


        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          <span>إنشاء حساب</span>
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
         {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <GoogleIcon className="h-5 w-5" />}
        <span>التسجيل باستخدام جوجل</span>
      </Button>
    </AuthFormWrapper>
  );
}
