'use client';

import type { ReactNode } from 'react';
import React, { useState, useEffect } from 'react';
import {
  Home, FileText, Settings, Menu, UserCircle,
  BarChart3, Users, Database, Building, FolderTree, ListTodo,
  Calendar, Wand2, Target
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarSeparator,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { SidebarMenuLink } from '@/components/ui/sidebar-menu-link';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { Button } from '@/components/ui/button';
import { AddTaskSheet } from '@/components/AddTaskSheet';
import { useAuth } from '@/context/AuthContext';

import { NotificationsPopover } from '@/components/notifications/NotificationsPopover';
import Link from 'next/link';

export function OrganizationLayoutContent({ children }: { children: ReactNode }) {
  const { user, userClaims } = useAuth();
  const pathname = usePathname();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // تحديث التاريخ الحالي كل دقيقة
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // إغلاق الشريط الجانبي عند تغيير المسار (للأجهزة المحمولة)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // الحصول على اسم المؤسسة من userClaims
  const organizationName = userClaims?.organizationName || 'المؤسسة';
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;

  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Main Content - Add padding-right to prevent content from going behind sidebar */}
      <div className="flex-1 flex flex-col relative md:pr-64">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-10 bg-background border-b h-14 flex items-center justify-between px-4">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold">نظام المؤسسات</h1>
          </div>

          <div className="flex items-center gap-2">
            {pathname === '/org/tasks' && user && (
              <AddTaskSheet user={user} />
            )}

            {/* Notifications Popover */}
            {user && <NotificationsPopover />}

            {/* Suggestions Button - Modified to show "Under Development" message */}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative group"
                title="الاقتراحات الذكية - سيتم تطويره"
                onClick={(e) => {
                  e.preventDefault();
                  // يمكن إضافة إشعار هنا إذا لزم الأمر
                }}
              >
                <Wand2 className="h-4 w-4" />
                <span className="sr-only">الاقتراحات الذكية</span>
                <span className="absolute top-full right-0 mt-1 w-32 bg-popover text-popover-foreground text-xs p-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center">
                  سيتم تطويره
                </span>
              </Button>
            )}

            {/* Sidebar Trigger for Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setOpenMobile(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Sidebar - Fixed on the right side (hidden on mobile) */}
      <div className={`fixed right-0 top-0 h-full w-64 border-l bg-sidebar text-sidebar-foreground z-20 transition-transform duration-300 ${isMobile ? 'translate-x-full' : ''} md:translate-x-0`}>
        <SidebarHeader className="py-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center">
              <Building className="h-6 w-6 text-primary ml-2" />
              <h2 className="text-lg font-semibold">{organizationName}</h2>
            </div>
            <SidebarTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">فتح/إغلاق الشريط الجانبي</span>
              </Button>
            </SidebarTrigger>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuLink href="/org" active={pathname === '/org'}>
              <Home className="ml-2 h-5 w-5" />
              <span>الرئيسية</span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/tasks" active={pathname === '/org/tasks'}>
              <ListTodo className="ml-2 h-5 w-5" />
              <span>المهام</span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/reports" active={pathname === '/org/reports'}>
              <FileText className="ml-2 h-5 w-5" />
              <span>التقارير</span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/meetings" active={pathname === '/org/meetings'}>
              <Calendar className="ml-2 h-5 w-5" />
              <span>الاجتماعات</span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/kpi" active={pathname === '/org/kpi'}>
              <BarChart3 className="ml-2 h-5 w-5" />
              <span>مؤشرات الأداء</span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/okr" active={pathname?.startsWith('/org/okr') || false}>
              <Target className="ml-2 h-5 w-5" />
              <span>التخطيط السنوي (OKRs)</span>
            </SidebarMenuLink>

            <SidebarSeparator />

            <SidebarMenuLink href="/org/members" active={pathname === '/org/members'}>
              <Users className="ml-2 h-5 w-5" />
              <span>الأعضاء</span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/departments" active={pathname === '/org/departments'}>
              <FolderTree className="ml-2 h-5 w-5" />
              <span>الأقسام</span>
            </SidebarMenuLink>

            {(isOwner || isAdmin) && (
              <SidebarMenuLink href="/org/settings" active={pathname === '/org/settings'}>
                <Settings className="ml-2 h-5 w-5" />
                <span>إعدادات المؤسسة</span>
              </SidebarMenuLink>
            )}

            <SidebarSeparator />

            <SidebarMenuLink href="/org/data" active={pathname === '/org/data'}>
              <Database className="ml-2 h-5 w-5" />
              <span>إدارة البيانات</span>
            </SidebarMenuLink>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-4">
          <div className="flex flex-col space-y-2">
            <div className="text-sm text-muted-foreground">
              {format(currentDate, 'EEEE, d MMMM yyyy')}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UserCircle className="h-5 w-5 ml-2 text-muted-foreground" />
                <span className="text-sm">{user?.displayName || user?.email}</span>
              </div>
              <SignOutButton />
            </div>
          </div>
        </SidebarFooter>
      </div>
    </div>
  );
}
