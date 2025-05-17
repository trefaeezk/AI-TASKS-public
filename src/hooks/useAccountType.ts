/**
 * خطاف للتحقق من نوع الحساب (فردي أو مؤسسة)
 *
 * يستخدم هذا الخطاف للتحقق من نوع الحساب الحالي وتوفير معلومات حول ما إذا كان المستخدم
 * ينتمي إلى مؤسسة أو مستخدم فردي.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
 *
 * @returns {UseAccountTypeResult} معلومات حول نوع الحساب
 */
export function useAccountType(): UseAccountTypeResult {
  const { user } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>('loading');
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      console.log('[useAccountType] No user, setting accountType to null');
      setAccountType(null);
      return;
    }

    console.log('[useAccountType] Fetching account type for user:', user.uid);

    const fetchAccountType = async () => {
      try {
        // التحقق من وثيقة المستخدم
        console.log('[useAccountType] Checking users collection for user:', user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
          console.log('[useAccountType] User document not found in users collection');

          // التحقق من وثيقة المستخدم في مجموعة individuals
          console.log('[useAccountType] Checking individuals collection for user:', user.uid);
          const individualDoc = await getDoc(doc(db, 'individuals', user.uid));

          if (individualDoc.exists()) {
            console.log('[useAccountType] User found in individuals collection, setting accountType to individual');
            setAccountType('individual');
          } else {
            console.log('[useAccountType] User not found in any collection, setting accountType to null');
            setAccountType(null);
          }
          return;
        }

        const userData = userDoc.data();
        console.log('[useAccountType] User data:', userData);

        // التحقق من وجود حقل organizationId
        if (userData.organizationId) {
          console.log('[useAccountType] User has organizationId, setting accountType to organization');
          setAccountType('organization');
          setOrganizationId(userData.organizationId);
          setDepartmentId(userData.departmentId);
        } else {
          console.log('[useAccountType] User has no organizationId, setting accountType to individual');
          setAccountType('individual');
        }
      } catch (err) {
        console.error('[useAccountType] Error fetching account type:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setAccountType(null);
      }
    };

    fetchAccountType();
  }, [user]);

  return {
    accountType,
    isIndividual: accountType === 'individual',
    isOrganization: accountType === 'organization',
    isLoading: accountType === 'loading',
    organizationId,
    departmentId,
    error
  };
}

export default useAccountType;
