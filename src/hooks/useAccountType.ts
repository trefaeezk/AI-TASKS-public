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
      setAccountType(null);
      return;
    }

    const fetchAccountType = async () => {
      try {
        // التحقق من وثيقة المستخدم
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          setAccountType(null);
          return;
        }

        const userData = userDoc.data();
        
        // التحقق من وجود حقل organizationId
        if (userData.organizationId) {
          setAccountType('organization');
          setOrganizationId(userData.organizationId);
          setDepartmentId(userData.departmentId);
        } else {
          setAccountType('individual');
        }
      } catch (err) {
        console.error('Error fetching account type:', err);
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
