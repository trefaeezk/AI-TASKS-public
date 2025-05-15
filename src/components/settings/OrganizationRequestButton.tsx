'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Building, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export default function OrganizationRequestButton() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, userClaims } = useAuth();
  const [loading, setLoading] = useState(false);

  // التحقق من نوع الحساب
  const isIndividualAccount = userClaims?.accountType === 'individual';

  // التوجه إلى صفحة المؤسسات
  const handleClick = () => {
    setLoading(true);
    
    try {
      router.push('/organizations');
    } catch (error) {
      console.error('Error navigating to organizations page:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء الانتقال إلى صفحة المؤسسات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // عدم عرض الزر إذا لم يكن المستخدم مسجل الدخول أو ليس لديه حساب فردي
  if (!user || !isIndividualAccount) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs opacity-70 hover:opacity-100"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="ml-1 h-3 w-3 animate-spin" />
      ) : (
        <Building className="ml-1 h-3 w-3" />
      )}
      طلب إنشاء مؤسسة
    </Button>
  );
}
