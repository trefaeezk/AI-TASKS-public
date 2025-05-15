/**
 * مكون للتحقق من نوع الحساب وعرض المحتوى المناسب فقط
 * 
 * يستخدم هذا المكون للتحقق من نوع الحساب (فردي أو مؤسسة) وعرض المحتوى المناسب فقط.
 * يمكن استخدامه لإخفاء الميزات المخصصة للمؤسسات عن المستخدمين الفرديين.
 */

import React from 'react';
import { useAccountType } from '@/hooks/useAccountType';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountTypeGuardProps {
  /**
   * المحتوى الذي سيتم عرضه إذا كان نوع الحساب مطابقًا
   */
  children: React.ReactNode;
  
  /**
   * نوع الحساب المطلوب لعرض المحتوى
   */
  requiredType: 'individual' | 'organization' | 'any';
  
  /**
   * محتوى بديل يتم عرضه إذا لم يكن نوع الحساب مطابقًا
   */
  fallback?: React.ReactNode;
  
  /**
   * ما إذا كان يجب عرض مؤشر تحميل أثناء التحقق من نوع الحساب
   */
  showLoading?: boolean;
}

/**
 * مكون للتحقق من نوع الحساب وعرض المحتوى المناسب فقط
 */
export function AccountTypeGuard({
  children,
  requiredType,
  fallback = null,
  showLoading = true
}: AccountTypeGuardProps) {
  const { accountType, isLoading } = useAccountType();
  
  // إذا كان التحميل قيد التقدم وتم تمكين عرض مؤشر التحميل
  if (isLoading && showLoading) {
    return (
      <div className="w-full space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }
  
  // إذا كان نوع الحساب مطابقًا للنوع المطلوب أو كان النوع المطلوب هو "أي"
  if (
    requiredType === 'any' ||
    (requiredType === 'individual' && accountType === 'individual') ||
    (requiredType === 'organization' && accountType === 'organization')
  ) {
    return <>{children}</>;
  }
  
  // إذا لم يكن نوع الحساب مطابقًا، عرض المحتوى البديل
  return <>{fallback}</>;
}

export default AccountTypeGuard;
