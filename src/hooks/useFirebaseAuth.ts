// src/hooks/useFirebaseAuth.ts
'use client';

import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  type AuthError,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, functions } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export function useFirebaseAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAuthError = (err: unknown) => {
    const authError = err as AuthError;
    let message = 'An unexpected error occurred.';
    // Customize error messages based on Firebase error codes
    switch (authError.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        message = ' البريد الإلكتروني أو كلمة المرور غير صحيحة.'; // Incorrect email or password.
        break;
      case 'auth/email-already-in-use':
        message = 'هذا البريد الإلكتروني مستخدم بالفعل.'; // Email already in use.
        break;
      case 'auth/weak-password':
        message = 'كلمة المرور يجب أن تكون على الأقل 6 أحرف.'; // Password should be at least 6 characters.
        break;
      case 'auth/invalid-email':
         message = 'البريد الإلكتروني غير صالح.'; // Invalid email.
         break;
      case 'auth/popup-closed-by-user':
          message = 'تم إغلاق نافذة تسجيل الدخول بواسطة المستخدم.'; // Popup closed by user.
          break;
      case 'auth/cancelled-popup-request':
          message = 'تم إلغاء طلب تسجيل الدخول.'; // Cancelled popup request.
           break;
      default:
        message = authError.message || message;
    }
     console.error("Firebase Auth Error:", authError);
     setError(message); // Set state for potential UI display
     toast({
        title: 'خطأ في المصادقة', // Authentication Error
        description: message,
        variant: 'destructive',
      });
     setLoading(false); // Ensure loading is reset
  };

  const signUp = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // إنشاء المستخدم باستخدام Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // تعيين نوع الحساب كمستقل (individual) والدور كمستخدم مستقل (independent)
      try {
        const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
        await updateAccountTypeFunc({
          accountType: 'individual'
        });

        console.log("[useFirebaseAuth] User account type set to individual");
      } catch (updateError) {
        console.error("[useFirebaseAuth] Error setting account type:", updateError);
        // نستمر حتى لو فشل تعيين نوع الحساب، سيتم التعامل معه لاحقًا في AuthContext
      }

      toast({
        title: 'تم إنشاء الحساب بنجاح!', // Account created successfully!
        description: 'تم تسجيلك كمستخدم مستقل.', // You have been registered as an independent user.
      });

      setLoading(false);
      return true;
    } catch (err) {
      handleAuthError(err);
      return false;
    }
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
       toast({
            title: 'تم تسجيل الدخول بنجاح!', // Signed in successfully!
        });
      setLoading(false);
      return true;
    } catch (err) {
      handleAuthError(err);
      return false;
    }
  };

  const logOut = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await signOut(auth);
       toast({
            title: 'تم تسجيل الخروج.', // Signed out.
        });
      setLoading(false);
      return true;
    } catch (err) {
      handleAuthError(err);
      return false;
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'تم إرسال رابط إعادة تعيين كلمة المرور', // Password reset link sent
        description: 'تحقق من بريدك الإلكتروني.', // Check your email.
      });
      setLoading(false);
      return true;
    } catch (err) {
       handleAuthError(err);
       // Specific error for user not found during password reset
       if ((err as AuthError).code === 'auth/user-not-found') {
          setError('لم يتم العثور على مستخدم بهذا البريد الإلكتروني.'); // User not found with this email.
       }
      return false;
    }
  };

  const signInWithGoogle = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // تسجيل الدخول باستخدام Google
      const result = await signInWithPopup(auth, googleProvider);

      // التحقق مما إذا كان المستخدم جديدًا
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;

      // إذا كان المستخدم جديدًا، نقوم بتعيين نوع الحساب كمستقل
      if (isNewUser) {
        try {
          const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
          await updateAccountTypeFunc({
            accountType: 'individual'
          });

          console.log("[useFirebaseAuth] New Google user account type set to individual");

          toast({
            title: 'تم إنشاء الحساب بنجاح!',
            description: 'تم تسجيلك كمستخدم مستقل باستخدام حساب جوجل.',
          });
        } catch (updateError) {
          console.error("[useFirebaseAuth] Error setting account type for Google user:", updateError);
          // نستمر حتى لو فشل تعيين نوع الحساب، سيتم التعامل معه لاحقًا في AuthContext
        }
      } else {
        toast({
          title: 'تم تسجيل الدخول بنجاح باستخدام جوجل!', // Signed in successfully with Google!
        });
      }

      setLoading(false);
      return true;
    } catch (err) {
      handleAuthError(err);
      return false;
    }
  };

  return {
    loading,
    error, // Expose error state
    signUp,
    signIn,
    logOut,
    resetPassword,
    signInWithGoogle,
  };
}
