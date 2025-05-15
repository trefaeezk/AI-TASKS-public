'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PermissionAction,
  PermissionArea,
  PermissionKey,
  UserRole,
  hasPermission as checkPermission,
  isRoleAtLeast,
  permissionToKey
} from '@/types/roles';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Hook لإدارة صلاحيات المستخدم
 */
export function usePermissions() {
  const { user, userClaims } = useAuth();
  const [role, setRole] = useState<UserRole>('user');
  const [customPermissions, setCustomPermissions] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // جلب دور المستخدم وصلاحياته المخصصة
  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!user) {
        setRole('user');
        setCustomPermissions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // استخدام userClaims من AuthContext
        // إذا كان نوع الحساب هو 'individual'، نستخدم 'independent' كقيمة افتراضية
        const userRole = userClaims?.role as UserRole || (userClaims?.accountType === 'individual' ? 'independent' : 'user');
        const isAdmin = !!userClaims?.admin;

        // تعيين الدور بناءً على claims
        const effectiveRole = isAdmin ? 'admin' : userRole;
        setRole(effectiveRole);

        console.log("[usePermissions] Setting role from claims:", effectiveRole, "accountType:", userClaims?.accountType);

        // جلب الصلاحيات المخصصة من Firestore
        let userDoc;

        // تحديد المجموعة المناسبة بناءً على نوع الحساب
        if (userClaims?.accountType === 'individual') {
          console.log("[usePermissions] Checking individuals collection for user", user.uid);
          userDoc = await getDoc(doc(db, 'individuals', user.uid));
        } else {
          console.log("[usePermissions] Checking users collection for user", user.uid);
          userDoc = await getDoc(doc(db, 'users', user.uid));
        }

        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("[usePermissions] User document found:", userData);

          // إذا كان نوع الحساب هو 'individual' ولم يكن هناك دور محدد، نستخدم 'independent'
          if (userClaims?.accountType === 'individual' && !userData.role) {
            console.log("[usePermissions] Setting role to 'independent' for individual user");
            setRole('independent');
          }

          if (userData.customPermissions && Array.isArray(userData.customPermissions)) {
            setCustomPermissions(userData.customPermissions);
            console.log("[usePermissions] Custom permissions loaded:", userData.customPermissions);
          } else {
            setCustomPermissions([]);
          }
        } else {
          console.log("[usePermissions] User document not found");
          setCustomPermissions([]);
        }
      } catch (err: any) {
        console.error('[usePermissions] Error fetching user permissions:', err);
        setError(err.message || 'حدث خطأ أثناء جلب صلاحيات المستخدم');
      } finally {
        setLoading(false);
      }
    };

    fetchUserPermissions();
  }, [user, userClaims]);

  // الحصول على جميع صلاحيات المستخدم (الافتراضية + المخصصة)
  const getAllPermissions = (): PermissionKey[] => {
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];

    // دمج الصلاحيات الافتراضية والمخصصة
    if (customPermissions.length === 0) {
      return defaultPerms;
    }

    // إزالة التكرار
    return [...new Set([...defaultPerms, ...customPermissions])];
  };

  // التحقق مما إذا كان المستخدم يملك صلاحية معينة
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // تحويل النص إلى مفتاح الصلاحية
    const [area, action] = permission.split('.');
    if (!area || !action) return false;
    
    const allPermissions = getAllPermissions();
    
    return checkPermission(allPermissions, { 
      area: area as PermissionArea, 
      action: action as PermissionAction 
    });
  };

  // التحقق مما إذا كان المستخدم يملك دورًا معينًا أو أعلى
  const checkRole = (requiredRole: UserRole): boolean => {
    if (!user) return false;
    return isRoleAtLeast(role, requiredRole);
  };

  return {
    role,
    permissions: getAllPermissions(),
    customPermissions,
    loading,
    error,
    hasPermission,
    checkRole,
    isAuthenticated: !!user
  };
}
