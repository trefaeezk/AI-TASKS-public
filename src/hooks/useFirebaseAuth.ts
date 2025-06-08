// src/hooks/useFirebaseAuth.ts
'use client';

import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  type AuthError,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, functions } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

export function useFirebaseAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { refreshUserData } = useAuth();

  // وظيفة مساعدة لتحديث token المستخدم
  const refreshUserToken = async (): Promise<boolean> => {
    try {
      // تحديث معلومات المستخدم
      await refreshUserData();
      return true;
    } catch (error) {
      console.error("[useFirebaseAuth] Error refreshing user token:", error);
      return false;
    }
  };

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
      case 'auth/invalid-credential':
         message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'; // Email or password is incorrect.
         break;
      case 'auth/user-not-found':
         message = 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني.'; // User not found with this email.
         break;
      case 'auth/wrong-password':
         message = 'كلمة المرور غير صحيحة.'; // Password is incorrect.
         break;
      case 'auth/popup-closed-by-user':
          message = 'تم إغلاق نافذة تسجيل الدخول بواسطة المستخدم.';
          break;
      case 'auth/cancelled-popup-request':
          message = 'تم إلغاء طلب تسجيل الدخول.';
          break;
      case 'auth/unauthorized-domain':
          message = 'النطاق غير مصرح به. يرجى المحاولة من الموقع الرسمي.';
          break;
      case 'auth/popup-blocked':
          message = 'يرجى السماح للنوافذ المنبثقة في المتصفح.';
          break;
      case 'auth/network-request-failed':
          message = 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
          break;
      case 'auth/too-many-requests':
          message = 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً.';
          break;
      case 'auth/operation-not-allowed':
          message = 'تسجيل الدخول عبر Google غير مفعل. يرجى التواصل مع الدعم.';
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

  const signUp = async (email: string, password: string, name?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // التحقق من وجود البريد الإلكتروني مسبقاً
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0) {
          throw new Error('auth/email-already-in-use');
        }
      } catch (checkError: any) {
        if (checkError.message === 'auth/email-already-in-use') {
          handleAuthError({ code: 'auth/email-already-in-use' });
          return false;
        }
        // إذا كان خطأ آخر في التحقق، نستمر مع التسجيل العادي
        console.warn("[useFirebaseAuth] Email check failed, proceeding with normal signup:", checkError);
      }

      // إنشاء المستخدم باستخدام Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // تحديث اسم المستخدم إذا تم توفيره
      if (name && userCredential.user) {
        try {
          const { updateProfile } = await import('firebase/auth');
          await updateProfile(userCredential.user, {
            displayName: name
          });
          console.log("[useFirebaseAuth] User display name updated to:", name);
        } catch (profileError) {
          console.error("[useFirebaseAuth] Error updating user profile:", profileError);
          // نستمر حتى لو فشل تحديث الاسم
        }
      }

      // تسجيل نجاح إنشاء المستخدم في Firebase Auth
      if (userCredential.user) {
        console.log("[useFirebaseAuth] ✅ User created successfully in Firebase Auth:", userCredential.user.uid);
        console.log("[useFirebaseAuth] 📝 User document will be created automatically by Cloud Function");

        // لا نحاول إنشاء وثيقة Firestore هنا لتجنب مشاكل الصلاحيات
        // سيتم إنشاؤها تلقائياً عبر Cloud Function: createUserDocument

        // انتظار قصير للسماح للـ Cloud Function بالعمل
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // تم إزالة تعيين نوع الحساب هنا لتجنب مشاكل الصلاحيات
      // سيتم تعيينه تلقائياً عبر Cloud Function: createUserDocument
      console.log("[useFirebaseAuth] 📝 Account type and claims will be set automatically by Cloud Function");

      toast({
        title: 'تم إنشاء الحساب بنجاح!', // Account created successfully!
        description: 'تم تسجيلك كمستخدم مستقل.', // You have been registered as an independent user.
      });

      // تحديث token المستخدم لتحميل الصلاحيات الجديدة
      console.log("[useFirebaseAuth] Refreshing user token after signup");

      // إضافة تأخير قبل تحديث الـ token
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (await refreshUserToken()) {
        console.log("[useFirebaseAuth] User token refreshed successfully");
      }

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

    console.log("[useFirebaseAuth] Attempting to sign in with email:", email);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      console.log("[useFirebaseAuth] ✅ Sign in successful");

      // تحديث token المستخدم لضمان تحميل الصلاحيات الصحيحة
      console.log("[useFirebaseAuth] Refreshing user token after signin");
      if (await refreshUserToken()) {
        console.log("[useFirebaseAuth] User token refreshed successfully after signin");
      }

      toast({
        title: 'تم تسجيل الدخول بنجاح!', // Signed in successfully!
      });

      setLoading(false);
      return true;
    } catch (err: any) {
      console.error("[useFirebaseAuth] ❌ Sign in failed:", err);
      console.error("[useFirebaseAuth] Error code:", err.code);
      console.error("[useFirebaseAuth] Error message:", err.message);

      handleAuthError(err);
      return false;
    }
  };

  const logOut = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // إلغاء جميع Firestore listeners قبل تسجيل الخروج
      const { firestoreListenerManager } = await import('@/utils/firestoreListenerManager');
      console.log('[useFirebaseAuth] Cleaning up all Firestore listeners before logout');
      firestoreListenerManager.removeAllListeners();

      // إضافة تأخير قصير للسماح لـ AuthContext بإلغاء listeners
      await new Promise(resolve => setTimeout(resolve, 200));

      await signOut(auth);
      toast({
        title: 'تم تسجيل الخروج.', // Signed out.
      });
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error during logout:', err);
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

      // إذا كان المستخدم جديدًا، نعرض رسالة ترحيب
      if (isNewUser) {
        console.log("[useFirebaseAuth] ✅ New Google user detected, document will be created by Cloud Function");

        // انتظار قصير للسماح للـ Cloud Function بالعمل
        await new Promise(resolve => setTimeout(resolve, 1500));

        toast({
          title: 'تم إنشاء الحساب بنجاح!',
          description: 'تم تسجيلك كمستخدم مستقل باستخدام حساب جوجل.',
        });

        // تحديث token المستخدم لتحميل الصلاحيات الجديدة للمستخدم الجديد
        console.log("[useFirebaseAuth] Refreshing user token after Google signup");

        if (await refreshUserToken()) {
          console.log("[useFirebaseAuth] User token refreshed successfully after Google signup");
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
