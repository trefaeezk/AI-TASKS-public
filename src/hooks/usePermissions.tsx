
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
  const [role, setRole] = useState<UserRole>('user'); // Default role
  const [customPermissions, setCustomPermissions] = useState<PermissionKey[]>([]);
  const [internalLoading, setInternalLoading] = useState(true); // Internal loading state for this hook
  const [error, setError] = useState<string | null>(null);

  const determinePermissions = useCallback(async () => {
    if (!user) {
      console.log("[usePermissions] No user, setting default role and permissions, internalLoading false.");
      setRole('user'); // Or a 'guest' role if you have one
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
      if (userClaims.owner) {
        effectiveRole = 'owner';
      } else if (userClaims.admin) {
        effectiveRole = 'admin';
      } else {
        effectiveRole = userClaims.role as UserRole || (userClaims.accountType === 'individual' ? 'independent' : 'user');
      }
      console.log("[usePermissions] Effective role from claims:", effectiveRole);
      setRole(effectiveRole);

      // Fetch custom permissions from Firestore
      let userDocPath: string | null = null;
      if (userClaims.accountType === 'organization' && userClaims.organizationId) {
        // For organization members, permissions might be on the main user doc or member doc.
        // Assuming for now they are on the main 'users' doc if they exist.
        // If specific member permissions are needed, this logic needs adjustment.
        userDocPath = `users/${user.uid}`; // Or `organizations/${userClaims.organizationId}/members/${user.uid}` if perms are there
      } else if (userClaims.accountType === 'individual') {
        userDocPath = `individuals/${user.uid}`;
      } else {
         // Fallback for users not clearly individual or org (e.g., during initial setup or if claims are sparse)
         userDocPath = `users/${user.uid}`;
      }
      
      if (userDocPath) {
        console.log("[usePermissions] Fetching custom permissions from path:", userDocPath);
        const userDoc = await getDoc(doc(db, userDocPath));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("[usePermissions] User document data from Firestore:", userData);
          if (userData.customPermissions && Array.isArray(userData.customPermissions)) {
            setCustomPermissions(userData.customPermissions);
            console.log("[usePermissions] Custom permissions set:", userData.customPermissions);
          } else {
            setCustomPermissions([]);
            console.log("[usePermissions] No custom permissions in Firestore doc.");
          }
           // If Firestore role differs from claims role (and not owner/admin), refresh claims
           if (userData.role && effectiveRole !== 'owner' && effectiveRole !== 'admin' && userData.role !== effectiveRole) {
            console.warn(`[usePermissions] Role mismatch: Claims ('${effectiveRole}') vs Firestore ('${userData.role}'). Consider refreshing claims.`);
            // Potentially call refreshUserData() here, but be cautious of loops
            // For now, we trust the claims as the primary source after initial determination.
          }
        } else {
          setCustomPermissions([]);
          console.log("[usePermissions] User document not found at path:", userDocPath, "No custom permissions loaded.");
        }
      } else {
          setCustomPermissions([]);
          console.log("[usePermissions] No valid userDocPath, no custom permissions loaded.");
      }

    } catch (err: any) {
      console.error('[usePermissions] Error in determinePermissions:', err);
      setError(err.message || 'Error fetching user permissions');
      setRole('user'); // Fallback role
      setCustomPermissions([]);
    } finally {
      console.log("[usePermissions] Finished determinePermissions, setting internalLoading to false.");
      setInternalLoading(false);
    }
  }, [user, userClaims]); // Removed refreshUserData from dependencies to prevent loops

  useEffect(() => {
    console.log("[usePermissions] useEffect triggered. authContextLoading:", authContextLoading);
    if (!authContextLoading) { // Only run if AuthContext is not loading
      determinePermissions();
    } else {
       // If authContext is loading, ensure usePermissions also reflects loading
       if(!internalLoading) setInternalLoading(true);
    }
  }, [authContextLoading, determinePermissions]);


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
    //   console.log('[usePermissions] getAllPermissions: No custom permissions, returning default permissions');
      return defaultPerms;
    }
    const allPermissions = [...new Set([...defaultPerms, ...customPermissions])];
    // console.log('[usePermissions] getAllPermissions: All permissions =', allPermissions);
    return allPermissions;
  }, [role, customPermissions, authContextLoading, internalLoading]);

  const hasPermission = useCallback((permissionString: string): boolean => {
    if (authContextLoading || internalLoading || !user) {
    //   console.log('[usePermissions] hasPermission: Loading or no user, returning false for', permissionString);
      return false;
    }
    const currentAllPermissions = getAllPermissions();
    const [area, action] = permissionString.split('.') as [PermissionArea, PermissionAction];
    if (!area || !action) {
    //   console.log('[usePermissions] hasPermission: Invalid permission string format', permissionString);
      return false;
    }
    const key = permissionToKey({ area, action });
    const result = currentAllPermissions.includes(key);
    // console.log(`[usePermissions] hasPermission: Checking '${key}' in [${currentAllPermissions.join(', ')}] -> ${result}`);
    return result;
  }, [user, getAllPermissions, authContextLoading, internalLoading]);

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
