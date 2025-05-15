'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface OrganizationGuardProps {
  children: ReactNode;
}

export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const { user, userClaims, loading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // إذا لم يكن المستخدم مسجل الدخول، توجيهه إلى صفحة تسجيل الدخول
        router.push('/login');
      } else if (userClaims) {
        // التحقق من أن المستخدم ينتمي لمؤسسة
        if (userClaims.accountType !== 'organization' || !userClaims.organizationId) {
          console.log('User is not part of an organization, redirecting to individual app');
          router.push('/');
        } else {
          setIsChecking(false);
        }
      } else {
        setIsChecking(false);
      }
    }
  }, [user, userClaims, loading, router]);

  if (loading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-2 text-lg">جاري التحميل...</span>
      </div>
    );
  }

  return <>{children}</>;
}
