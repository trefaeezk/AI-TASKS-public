/**
 * مكون التحقق من إعداد النظام - يتحقق مما إذا كان النظام قد تم إعداده
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { handleFirestoreError } from '@/utils/firestoreListenerManager';

interface SystemSetupCheckProps {
  children: React.ReactNode;
}

export default function SystemSetupCheck({ children }: SystemSetupCheckProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    // التحقق من إعداد النظام فقط بعد تحميل معلومات المستخدم
    if (authLoading) return;

    const checkSystemSetup = async () => {
      try {
        // إذا لم يكن هناك مستخدم مسجل الدخول، نفترض أن النظام تم إعداده
        // لتجنب محاولة الوصول إلى Firestore بدون مصادقة
        if (!user) {
          console.log('[SystemSetupCheck] No authenticated user, assuming system is setup');
          setIsSetup(true);
          setLoading(false);
          return;
        }

        // التحقق من وجود إعدادات النظام في Firestore
        const settingsDoc = await getDoc(doc(db, 'system', 'settings'));

        if (settingsDoc.exists()) {
          // النظام تم إعداده بالفعل
          console.log('[SystemSetupCheck] System is already setup');
          setIsSetup(true);
        } else {
          // النظام لم يتم إعداده بعد
          console.log('[SystemSetupCheck] System needs setup, redirecting to /setup');
          setIsSetup(false);
          router.push('/setup');
        }
      } catch (error) {
        const isPermissionError = handleFirestoreError(error, 'SystemSetupCheck');

        if (isPermissionError) {
          // إذا كان خطأ صلاحيات، نفترض أن النظام تم إعداده لتجنب حلقة لانهائية
          console.warn('[SystemSetupCheck] Permission error, assuming system is setup');
          setIsSetup(true);
        } else {
          // في حالة حدوث خطأ آخر، نفترض أن النظام لم يتم إعداده
          console.warn('[SystemSetupCheck] Other error, assuming system needs setup');
          setIsSetup(false);

          // إذا كان المستخدم مسجل الدخول، توجيهه إلى صفحة الإعداد
          if (user) {
            router.push('/setup');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    checkSystemSetup();
  }, [user, authLoading, router]);

  // إذا كان التحقق جاريًا، عرض مؤشر التحميل
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <span className="text-lg font-medium">جاري التحقق من إعداد النظام...</span>
        <p className="text-sm text-muted-foreground mt-2">
          هذه العملية قد تستغرق بضع ثوانٍ، يرجى الانتظار
        </p>
      </div>
    );
  }

  // إذا لم يتم إعداد النظام ولم يكن المستخدم مسجل الدخول، عرض صفحة تسجيل الدخول
  if (!isSetup && !user) {
    // سيتم التعامل مع هذه الحالة في صفحة تسجيل الدخول
    return children;
  }

  // إذا تم إعداد النظام أو تم توجيه المستخدم إلى صفحة الإعداد، عرض المحتوى
  return children;
}
