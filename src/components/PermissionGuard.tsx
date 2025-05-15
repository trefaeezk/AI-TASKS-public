'use client';

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionAction, PermissionArea, UserRole } from '@/types/roles';
import { Skeleton } from './ui/skeleton';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface PermissionGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  area?: PermissionArea;
  action?: PermissionAction;
  requiredRole?: UserRole;
  showLoading?: boolean;
  showError?: boolean;
}

/**
 * مكون لحماية المحتوى بناءً على الصلاحيات
 */
export function PermissionGuard({
  children,
  fallback,
  area,
  action,
  requiredRole,
  showLoading = true,
  showError = true
}: PermissionGuardProps) {
  const { checkPermission, checkRole, loading, error, isAuthenticated } = usePermissions();

  // التحقق من تسجيل الدخول
  if (!isAuthenticated) {
    return fallback || null;
  }

  // عرض حالة التحميل
  if (loading && showLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  // عرض الخطأ
  if (error && showError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>خطأ في التحقق من الصلاحيات</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // التحقق من الصلاحيات
  let hasAccess = true;

  // التحقق من الدور إذا كان مطلوبًا
  if (requiredRole) {
    hasAccess = hasAccess && checkRole(requiredRole);
  }

  // التحقق من الصلاحية إذا كانت مطلوبة
  if (area && action) {
    hasAccess = hasAccess && checkPermission(area, action);
  }

  // عرض المحتوى أو البديل
  if (hasAccess) {
    return <>{children}</>;
  }

  // عرض رسالة عدم الصلاحية إذا لم يكن هناك بديل
  if (!fallback && showError) {
    return (
      <Alert variant="destructive" className="my-2">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>غير مصرح</AlertTitle>
        <AlertDescription>ليس لديك الصلاحيات اللازمة للوصول إلى هذا المحتوى.</AlertDescription>
      </Alert>
    );
  }

  return <>{fallback}</> || null;
}

/**
 * مكون لحماية المحتوى بناءً على الدور
 */
export function RoleGuard({
  children,
  fallback,
  role,
  showLoading = true,
  showError = true
}: Omit<PermissionGuardProps, 'area' | 'action' | 'requiredRole'> & { role: UserRole }) {
  return (
    <PermissionGuard
      requiredRole={role}
      fallback={fallback}
      showLoading={showLoading}
      showError={showError}
    >
      {children}
    </PermissionGuard>
  );
}

/**
 * مكون لحماية المحتوى بناءً على صلاحية محددة
 */
export function ActionGuard({
  children,
  fallback,
  area,
  action,
  showLoading = true,
  showError = true
}: Omit<PermissionGuardProps, 'requiredRole'> & { area: PermissionArea; action: PermissionAction }) {
  return (
    <PermissionGuard
      area={area}
      action={action}
      fallback={fallback}
      showLoading={showLoading}
      showError={showError}
    >
      {children}
    </PermissionGuard>
  );
}
