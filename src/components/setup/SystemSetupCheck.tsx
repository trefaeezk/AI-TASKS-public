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
        // التحقق من وجود إعدادات النظام في Firestore
        const settingsDoc = await getDoc(doc(db, 'system', 'settings'));

        if (settingsDoc.exists()) {
          // النظام تم إعداده بالفعل
          setIsSetup(true);
        } else {
          // النظام لم يتم إعداده بعد
          setIsSetup(false);

          // إذا كان المستخدم مسجل الدخول، توجيهه إلى صفحة الإعداد
          if (user) {
            router.push('/setup');
          }
        }
      } catch (error) {
        console.error('Error checking system setup:', error);
        // في حالة حدوث خطأ، نفترض أن النظام لم يتم إعداده
        setIsSetup(false);

        // إذا كان المستخدم مسجل الدخول، توجيهه إلى صفحة الإعداد
        if (user) {
          router.push('/setup');
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
