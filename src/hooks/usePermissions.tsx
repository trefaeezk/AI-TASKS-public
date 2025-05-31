
'use client';

import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { useAuth as useAuthFromContext } from '@/context/AuthContext'; // Renamed to avoid conflict
import {
  DEFAULT_ROLE_PERMISSIONS,
  PermissionKey,
  UserRole,
  isRoleAtLeast,
  permissionToKey // Assuming keyToPermission is not actively used here
} from '@/types/roles';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Hook لإدارة صلاحيات المستخدم
 */
export function usePermissions() {
  const { user, userClaims, loading: authContextLoading, refreshUserData } = useAuthFromContext(); // Use renamed import
  const [role, setRole] = useState<UserRole>('assistant'); // Default role for new system
  const [customPermissions, setCustomPermissions] = useState<PermissionKey[]>([]);
  const [internalLoading, setInternalLoading] = useState(true); // Internal loading state for this hook
  const [error, setError] = useState<string | null>(null);

  const determinePermissions = useCallback(async () => {
    if (!user) {
      console.log("[usePermissions] No user, setting default role and permissions, internalLoading false.");
      setRole('assistant'); // Default role for new system
      setCustomPermissions([]);
      setInternalLoading(false);
      return;
    }

    if (!userClaims) {
        console.log("[usePermissions] No userClaims yet, internalLoading true. Waiting for AuthContext.");
        // AuthContext might still be determining claims
        if(!internalLoading) setInternalLoading(true);
        return;
    }


    console.log("[usePermissions] Starting determinePermissions for user:", user.uid, "Claims:", userClaims);
    if(!internalLoading) setInternalLoading(true);
    setError(null);

    try {
      let effectiveRole: UserRole;

      // تحديد الدور بناءً على النظام الجديد
      if (userClaims.system_owner) {
        effectiveRole = 'system_owner';
      } else if (userClaims.system_admin) {
        effectiveRole = 'system_admin';
      } else if (userClaims.organization_owner) {
        effectiveRole = 'organization_owner';
      } else if (userClaims.org_admin) {
        effectiveRole = 'org_admin';
      } else if (userClaims.role) {
        effectiveRole = userClaims.role as UserRole;
      } else {
        // الدور الافتراضي بناءً على نوع الحساب
        effectiveRole = userClaims.accountType === 'individual' ? 'independent' : 'org_assistant';
      }

      console.log("[usePermissions] Effective role from claims:", effectiveRole);
      setRole(effectiveRole);

      // الحصول على الصلاحيات المخصصة من userClaims أولاً
      let finalCustomPermissions: PermissionKey[] = userClaims.customPermissions || [];

      // إذا لم تكن موجودة في claims، جلبها من Firestore
      if (finalCustomPermissions.length === 0) {
        // جميع المستخدمين الآن في مجموعة users الموحدة
        const userDocPath = `users/${user.uid}`;

        if (userDocPath) {
        console.log("[usePermissions] Fetching custom permissions from path:", userDocPath);
        const userDoc = await getDoc(doc(db, userDocPath));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("[usePermissions] User document data from Firestore:", userData);
          if (userData.customPermissions && Array.isArray(userData.customPermissions)) {
            finalCustomPermissions = userData.customPermissions;
            console.log("[usePermissions] Custom permissions loaded from Firestore:", finalCustomPermissions);
          } else {
            finalCustomPermissions = [];
            console.log("[usePermissions] No custom permissions in Firestore doc.");
          }
           // التحقق من تطابق الأدوار مع النظام الجديد
           if (userData.role && userData.role !== effectiveRole) {
            // تحقق من الأدوار عالية المستوى التي لا يجب تغييرها
            const highLevelRoles = ['system_owner', 'system_admin', 'organization_owner'];
            if (!highLevelRoles.includes(effectiveRole)) {
              console.warn(`[usePermissions] Role mismatch: Claims ('${effectiveRole}') vs Firestore ('${userData.role}'). Consider refreshing claims.`);
              // يمكن استدعاء refreshUserData() هنا، لكن احذر من الحلقات اللانهائية
              // حالياً، نثق في claims كمصدر أساسي بعد التحديد الأولي
            }
          }
        } else {
          finalCustomPermissions = [];
          console.log("[usePermissions] User document not found at path:", userDocPath, "No custom permissions loaded.");
        }
        } else {
          finalCustomPermissions = [];
          console.log("[usePermissions] No valid userDocPath, no custom permissions loaded.");
        }
      } else {
        console.log("[usePermissions] Custom permissions loaded from Claims:", finalCustomPermissions);
      }

      console.log("[usePermissions] Final custom permissions:", finalCustomPermissions);
      setCustomPermissions(finalCustomPermissions);

    } catch (err: any) {
      console.error('[usePermissions] Error in determinePermissions:', err);
      setError(err.message || 'Error fetching user permissions');
      setRole('org_assistant'); // Fallback role for new system
      setCustomPermissions([]);
    } finally {
      console.log("[usePermissions] Finished determinePermissions, setting internalLoading to false.");
      setInternalLoading(false);
    }
  }, [user?.uid, userClaims?.role, userClaims?.customPermissions?.length]); // Specific dependencies to prevent loops

  useEffect(() => {
    console.log("[usePermissions] useEffect triggered. authContextLoading:", authContextLoading);
    if (!authContextLoading && user && userClaims) { // Only run if AuthContext is not loading and we have data
      determinePermissions();
    } else {
       // If authContext is loading, ensure usePermissions also reflects loading
       if(!internalLoading) setInternalLoading(true);
    }
  }, [authContextLoading, user?.uid, userClaims?.role]); // Remove determinePermissions from dependencies


  const getAllPermissions = useCallback((): PermissionKey[] => {
    if (authContextLoading || internalLoading) {
        // console.log('[usePermissions] getAllPermissions: Still loading, returning empty array.');
        return []; // Return empty or default permissions if still loading to prevent premature access
    }
    // console.log('[usePermissions] getAllPermissions: Getting permissions for role', role);
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    // console.log('[usePermissions] getAllPermissions: Default permissions for role', role, '=', defaultPerms);
    // console.log('[usePermissions] getAllPermissions: Custom permissions =', customPermissions);

    if (customPermissions.length === 0) {
      // console.log('[usePermissions] getAllPermissions: No custom permissions, returning default permissions');
      return defaultPerms;
    }
    const allPermissions = [...new Set([...defaultPerms, ...customPermissions])];
    // console.log('[usePermissions] getAllPermissions: All permissions =', allPermissions);
    return allPermissions;
  }, [role, customPermissions, authContextLoading, internalLoading]);

  const hasPermission = useCallback((permissionString: string): boolean => {
    if (authContextLoading || internalLoading || !user) {
      // console.log('[usePermissions] hasPermission: Loading or no user, returning false for', permissionString);
      return false;
    }

    // التحقق من الأدوار عالية المستوى أولاً
    if (role === 'system_owner' || role === 'system_admin') {
      // console.log(`[usePermissions] hasPermission: User has high-level role '${role}', granting access to '${permissionString}'`);
      return true;
    }

    const currentAllPermissions = getAllPermissions();
    const [area, action] = permissionString.split('.') as [PermissionArea, PermissionAction];
    if (!area || !action) {
      console.log('[usePermissions] hasPermission: Invalid permission string format', permissionString);
      return false;
    }
    const key = permissionToKey({ area, action });
    const result = currentAllPermissions.includes(key);
    // console.log(`[usePermissions] hasPermission: Checking '${key}' in [${currentAllPermissions.join(', ')}] -> ${result} (role: ${role})`);
    return result;
  }, [user, getAllPermissions, authContextLoading, internalLoading, role]);

  const checkRole = useCallback((requiredRole: UserRole): boolean => {
    if (authContextLoading || internalLoading || !user) return false;
    return isRoleAtLeast(role, requiredRole);
  }, [user, role, authContextLoading, internalLoading]);

  return {
    role,
    permissions: getAllPermissions(), // Call the function to get current permissions
    customPermissions,
    loading: authContextLoading || internalLoading, // Combined loading state
    error,
    hasPermission,
    checkPermission: hasPermission,
    checkRole,
    isAuthenticated: !!user
  };
}
