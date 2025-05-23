'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import {
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionAction, PermissionArea, UserRole } from '@/types/roles';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionSidebarItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  requiredRole?: UserRole;
  requiredPermission?: {
    area: PermissionArea;
    action: PermissionAction;
  };
}

/**
 * مكون عنصر القائمة الجانبية مع التحقق من الصلاحيات
 */
export function PermissionSidebarItem({
  href,
  icon: Icon,
  label,
  tooltip,
  requiredRole,
  requiredPermission
}: PermissionSidebarItemProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { checkRole, hasPermission, loading } = usePermissions();

  // التحقق مما إذا كان الرابط نشطًا
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

  // إغلاق القائمة الجانبية على الأجهزة المحمولة عند النقر
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // عرض حالة التحميل
  if (loading) {
    return (
      <SidebarMenuItem>
        <Skeleton className="h-8 w-full rounded-md bg-muted" />
      </SidebarMenuItem>
    );
  }

  // التحقق من الصلاحيات
  let hasAccess = true;

  // التحقق من الدور إذا كان مطلوبًا
  if (requiredRole) {
    const hasRole = checkRole(requiredRole);
    console.log(`[PermissionSidebarItem] ${label}: Required role ${requiredRole}, has role: ${hasRole}`);
    hasAccess = hasAccess && hasRole;
  }

  // التحقق من الصلاحية إذا كانت مطلوبة
  if (requiredPermission) {
    const permissionString = `${requiredPermission.area}.${requiredPermission.action}`;
    const hasPermissionResult = hasPermission(permissionString);
    console.log(`[PermissionSidebarItem] ${label}: Required permission ${permissionString}, has permission: ${hasPermissionResult}`);
    hasAccess = hasAccess && hasPermissionResult;
  }

  console.log(`[PermissionSidebarItem] ${label}: Final access decision: ${hasAccess}`);

  // عدم عرض العنصر إذا لم يكن لدى المستخدم الصلاحيات المطلوبة
  if (!hasAccess) {
    return null;
  }

  // عرض عنصر القائمة
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={tooltip || label}
      >
        <Link href={href} onClick={handleLinkClick}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
