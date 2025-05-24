'use client';

/**
 * Re-export of the useAuth hook from AuthContext
 * This file exists to provide a consistent import path for the useAuth hook
 */

import { useAuth as useAuthFromContext } from '../context/AuthContext';
import { usePermissions } from './usePermissions';
import { PermissionKey } from '../types/roles';

/**
 * Hook to access authentication state and user permissions
 * Combines useAuth from context with permissions for convenience
 */
export function useAuth() {
  const auth = useAuthFromContext();
  const { permissions, loading: permissionsLoading } = usePermissions();

  // تحديد الدور بناءً على النظام الجديد
  let role;
  const claims = auth.userClaims;

  // الأدوار الجديدة لها أولوية
  if (claims?.system_owner === true || claims?.role === 'system_owner') {
    role = 'system_owner';
  } else if (claims?.system_admin === true || claims?.role === 'system_admin') {
    role = 'system_admin';
  } else if (claims?.organization_owner === true || claims?.role === 'organization_owner') {
    role = 'organization_owner';
  } else if (claims?.admin === true || claims?.role === 'admin') {
    role = 'admin';
  } else if (claims?.role === 'supervisor') {
    role = 'supervisor';
  } else if (claims?.role === 'engineer') {
    role = 'engineer';
  } else if (claims?.role === 'technician') {
    role = 'technician';
  } else if (claims?.role === 'assistant') {
    role = 'assistant';
  } else if (claims?.role === 'independent') {
    role = 'independent';
  }
  // التوافق مع النظام القديم
  else if (claims?.owner) {
    role = 'system_owner'; // تحويل owner قديم إلى system_owner
  } else if (claims?.individual_admin) {
    role = 'system_admin'; // تحويل individual_admin إلى system_admin
  } else {
    // القيمة الافتراضية
    role = claims?.accountType === 'individual' ? 'independent' : 'assistant';
  }

  return {
    ...auth,
    role,
    userPermissions: permissions as PermissionKey[],
    loading: auth.loading || permissionsLoading,
    // إضافة وظيفة لإعادة تحميل معلومات المستخدم
    refreshUserData: auth.refreshUserData
  };
}

// Also export the original hook for components that only need basic auth
export { useAuth as useAuthBasic } from '../context/AuthContext';
