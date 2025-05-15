// src/app/(auth)/reset-password/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Mail, Send, Loader2 } from 'lucide-react'; // Changed icon to Send

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { AuthFormWrapper } from '@/components/auth/AuthFormWrapper';

const resetPasswordSchema = z.object({
  email: z.string().email({ message: 'البريد الإلكتروني غير صالح' }),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { resetPassword, loading, error } = useFirebaseAuth();
  const router = useRouter();
   const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });
   const [formError, setFormError] = useState<string | null>(null);
   const [emailSent, setEmailSent] = useState(false); // State to track if email was sent

  const onSubmit = async (data: ResetPasswordFormValues) => {
     setFormError(null);
     setEmailSent(false); // Reset email sent status
    const success = await resetPassword(data.email);
    if (success) {
      setEmailSent(true); // Indicate email was sent
    } else {
      // Error is handled by the hook's toast
       setFormError(error || 'فشل إرسال رابط إعادة تعيين كلمة المرور.'); // Failed to send password reset link.
    }
  };

  return (
    <AuthFormWrapper
      title="إعادة تعيين كلمة المرور"
      description="أدخل بريدك الإلكتروني لتلقي رابط إعادة تعيين كلمة المرور."
      footer={
        <>
          تذكرت كلمة المرور؟{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      {emailSent ? (
           <div className="text-center space-y-4">
               <p className="text-foreground">تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد الخاص بك (وقد يكون في مجلد الرسائل غير المرغوب فيها).</p>
               <Button onClick={() => router.push('/login')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    العودة إلى تسجيل الدخول
               </Button>
           </div>
      ) : (
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


            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
            <span>إرسال رابط إعادة التعيين</span>
            </Button>
        </form>
      )}
    </AuthFormWrapper>
  );
}
