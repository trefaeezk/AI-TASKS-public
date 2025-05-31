/**
 * خطاف للتحقق من نوع الحساب (فردي أو مؤسسة)
 *
 * يستخدم هذا الخطاف للتحقق من نوع الحساب الحالي وتوفير معلومات حول ما إذا كان المستخدم
 * ينتمي إلى مؤسسة أو مستخدم فردي.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export type AccountType = 'individual' | 'organization' | 'loading' | null;

export interface UseAccountTypeResult {
  accountType: AccountType;
  isIndividual: boolean;
  isOrganization: boolean;
  isLoading: boolean;
  organizationId?: string;
  departmentId?: string;
  error?: Error;
}

/**
 * خطاف للتحقق من نوع الحساب (فردي أو مؤسسة)
 * يستخدم Custom Claims بدلاً من Firestore للحصول على استجابة أسرع
 *
 * @returns {UseAccountTypeResult} معلومات حول نوع الحساب
 */
export function useAccountType(): UseAccountTypeResult {
  const { user, userClaims, loading: authLoading } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>('loading');
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (authLoading) {
      console.log('[useAccountType] Auth still loading, waiting...');
      setAccountType('loading');
      return;
    }

    if (!user) {
      console.log('[useAccountType] No user, setting accountType to null');
      setAccountType(null);
      setOrganizationId(undefined);
      setDepartmentId(undefined);
      setError(undefined);
      return;
    }

    console.log('[useAccountType] Checking account type from userClaims:', userClaims);

    // استخدام Custom Claims للحصول على نوع الحساب بسرعة
    if (userClaims) {
      console.log('[useAccountType] Using userClaims for account type:', userClaims.accountType);

      const claimsAccountType = userClaims.accountType || 'individual';
      setAccountType(claimsAccountType);
      setOrganizationId(userClaims.organizationId);
      setDepartmentId(userClaims.departmentId);
      setError(undefined);
    } else {
      // إذا لم تكن Custom Claims متوفرة بعد، نحاول تحديث البيانات
      console.log('[useAccountType] No userClaims available, trying to refresh...');

      // إعطاء وقت قصير للـ Auth Context لتحديث البيانات
      const timeout = setTimeout(() => {
        if (!userClaims) {
          console.log('[useAccountType] Still no userClaims after timeout, defaulting to individual');
          setAccountType('individual');
          setError(undefined);
        }
      }, 3000); // 3 ثوانٍ timeout

      return () => clearTimeout(timeout);
    }
  }, [user, userClaims, authLoading]);

  return {
    accountType,
    isIndividual: accountType === 'individual',
    isOrganization: accountType === 'organization',
    isLoading: authLoading || accountType === null, // إصلاح منطق التحميل
    organizationId,
    departmentId,
    error
  };
}

export default useAccountType;
