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
  // No usamos useTaskPageContext directamente aquí

  // تحديث التاريخ الحالي كل دقيقة
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // الحصول على اسم المؤسسة من userClaims
  const organizationName = userClaims?.organizationName || 'المؤسسة';
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-background border-b h-14 flex items-center justify-between px-4">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold">نظام المؤسسات</h1>
          </div>

          <div className="flex items-center gap-2">
            {pathname === '/org/tasks' && user && (
              <AddTaskSheet user={user} />
            )}

            {/* Notifications Popover */}
            {user && <NotificationsPopover />}

            {/* Suggestions Link */}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                asChild
                title="الاقتراحات الذكية"
              >
                <Link href="/suggestions">
                  <Wand2 className="h-4 w-4" />
                  <span className="sr-only">الاقتراحات الذكية</span>
                </Link>
              </Button>
            )}

            {/* Sidebar Trigger for Mobile */}
            <SidebarTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SidebarTrigger>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Sidebar - Moved to the right side */}
      <Sidebar side="right" className="border-r">
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

            <SidebarMenuLink href="/org/okr" active={pathname.startsWith('/org/okr')}>
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
      </Sidebar>


    </div>
  );
}
