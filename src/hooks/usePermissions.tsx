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
        console.log("[usePermissions] No user, setting default role and permissions");
        setRole('user');
        setCustomPermissions([]);
        setLoading(false);
        return;
      }

      console.log("[usePermissions] Fetching permissions for user:", user.uid);
      console.log("[usePermissions] User claims:", userClaims);

      setLoading(true);
      setError(null);

      try {
        // استخدام userClaims من AuthContext
        // التحقق من الدور بالترتيب: مالك، مسؤول، ثم الدور المحدد
        const isOwner = !!userClaims?.owner;
        const isAdmin = !!userClaims?.admin;
        const userRole = userClaims?.role as UserRole || (userClaims?.accountType === 'individual' ? 'independent' : 'user');

        console.log("[usePermissions] User role from claims:", userRole);
        console.log("[usePermissions] Is owner:", isOwner);
        console.log("[usePermissions] Is admin:", isAdmin);
        console.log("[usePermissions] Account type:", userClaims?.accountType);

        // تعيين الدور بناءً على claims بالترتيب الصحيح
        let effectiveRole: UserRole;
        if (isOwner) {
          effectiveRole = 'owner';
        } else if (isAdmin) {
          effectiveRole = 'admin';
        } else {
          effectiveRole = userRole;
        }

        console.log("[usePermissions] Setting effective role:", effectiveRole);
        setRole(effectiveRole);

        // جلب الصلاحيات المخصصة من Firestore
        let userDoc;

        // تحديد المجموعة المناسبة بناءً على نوع الحساب
        if (userClaims?.accountType === 'individual') {
          console.log("[usePermissions] Checking individuals collection for user", user.uid);
          userDoc = await getDoc(doc(db, 'individuals', user.uid));

          if (!userDoc.exists()) {
            console.log("[usePermissions] User not found in individuals collection, checking users collection");
            userDoc = await getDoc(doc(db, 'users', user.uid));
          }
        } else {
          console.log("[usePermissions] Checking users collection for user", user.uid);
          userDoc = await getDoc(doc(db, 'users', user.uid));

          if (!userDoc.exists()) {
            console.log("[usePermissions] User not found in users collection, checking individuals collection");
            userDoc = await getDoc(doc(db, 'individuals', user.uid));
          }
        }

        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("[usePermissions] User document found:", userData);

          // إذا كان نوع الحساب هو 'individual' ولم يكن هناك دور محدد، نستخدم 'independent'
          // ولكن فقط إذا لم يكن المستخدم مالكًا أو مسؤولًا
          if ((userClaims?.accountType === 'individual' || !userClaims?.accountType) && !userData.role && !isOwner && !isAdmin) {
            console.log("[usePermissions] Setting role to 'independent' for individual user");
            setRole('independent');
          }

          if (userData.customPermissions && Array.isArray(userData.customPermissions)) {
            console.log("[usePermissions] Custom permissions found:", userData.customPermissions);
            setCustomPermissions(userData.customPermissions);
          } else {
            console.log("[usePermissions] No custom permissions found");
            setCustomPermissions([]);
          }
        } else {
          console.log("[usePermissions] User document not found in any collection");

          // إذا لم يتم العثور على وثيقة المستخدم، نحافظ على الدور المحدد من claims
          // ولا نقوم بتغييره إلى 'independent' تلقائيًا
          console.log("[usePermissions] Keeping role from claims:", effectiveRole);

          // نعين الصلاحيات المخصصة كمصفوفة فارغة
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
    console.log('[usePermissions] getAllPermissions: Getting permissions for role', role);
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    console.log('[usePermissions] getAllPermissions: Default permissions for role', role, '=', defaultPerms);
    console.log('[usePermissions] getAllPermissions: Custom permissions =', customPermissions);

    // دمج الصلاحيات الافتراضية والمخصصة
    if (customPermissions.length === 0) {
      console.log('[usePermissions] getAllPermissions: No custom permissions, returning default permissions');
      return defaultPerms;
    }

    // إزالة التكرار
    const allPermissions = [...new Set([...defaultPerms, ...customPermissions])];
    console.log('[usePermissions] getAllPermissions: All permissions =', allPermissions);
    return allPermissions;
  };

  // التحقق مما إذا كان المستخدم يملك صلاحية معينة
  const hasPermission = (permission: string): boolean => {
    if (!user) {
      console.log('[usePermissions] hasPermission: No user, returning false');
      return false;
    }

    // تحويل النص إلى مفتاح الصلاحية
    const [area, action] = permission.split('.');
    if (!area || !action) {
      console.log('[usePermissions] hasPermission: Invalid permission format', permission);
      return false;
    }

    const allPermissions = getAllPermissions();
    console.log('[usePermissions] hasPermission: Checking permission', permission, 'in', allPermissions);

    const permissionKey = `${area}:${action}` as PermissionKey;
    const hasPermission = allPermissions.includes(permissionKey);
    console.log('[usePermissions] hasPermission:', permission, '=', hasPermission);

    return hasPermission;
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
    checkPermission: hasPermission, // إضافة checkPermission كاسم بديل لـ hasPermission
    checkRole,
    isAuthenticated: !!user
  };
}
