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
  const { role, permissions, loading: permissionsLoading } = usePermissions();

  return {
    ...auth,
    role,
    userPermissions: permissions as PermissionKey[],
    loading: auth.loading || permissionsLoading
  };
}

// Also export the original hook for components that only need basic auth
export { useAuth as useAuthBasic } from '../context/AuthContext';
