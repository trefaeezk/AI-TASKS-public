
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
import { ar } from 'date-fns/locale'; // Added import for Arabic locale

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarSeparator,
  SidebarInset,
  useSidebar, // Import useSidebar hook
} from '@/components/ui/sidebar';
import { SidebarMenuLink } from '@/components/ui/sidebar-menu-link';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { Button } from '@/components/ui/button';
import { AddTaskSheet } from '@/components/AddTaskSheet';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Translate } from '@/components/Translate';

import { NotificationsPopover } from '@/components/notifications/NotificationsPopover';
import Link from 'next/link';

export function OrganizationLayoutContent({ children }: { children: ReactNode }) {
  const { user, userClaims } = useAuth();
  const { t, direction } = useLanguage();
  const pathname = usePathname();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get sidebar state and setters from the useSidebar hook
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  // تحديث التاريخ الحالي كل دقيقة
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // إغلاق الشريط الجانبي عند تغيير المسار (للأجهزة المحمولة)
  useEffect(() => {
    if (isMobile && openMobile) { // Close only if mobile and sidebar is open
      setOpenMobile(false);
    }
  }, [pathname, isMobile, openMobile, setOpenMobile]);

  // الحصول على اسم المؤسسة من userClaims
  const organizationName = userClaims?.organizationName || t('organization.organization');
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar component - relies on context for mobile state */}
      <Sidebar
        side="right"
        collapsible="icon"
      >
        <SidebarHeader className="py-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center">
              <Building className="h-6 w-6 text-primary ml-2" />
              <h2 className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
                {organizationName}
              </h2>
            </div>
            {/* This trigger is for desktop icon collapse, not mobile sheet opening */}
            <SidebarTrigger asChild className="hidden md:flex">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only"><Translate text="general.menu" defaultValue="فتح/إغلاق الشريط الجانبي" /></span>
              </Button>
            </SidebarTrigger>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuLink href="/org" active={pathname === '/org'}>
              <Home className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.dashboard" defaultValue="الرئيسية" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/tasks" active={pathname === '/org/tasks'}>
              <ListTodo className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.tasks" defaultValue="المهام" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/reports" active={pathname.startsWith('/org/reports')}>
              <FileText className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.reports" defaultValue="التقارير" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/meetings" active={pathname.startsWith('/org/meetings')}>
              <Calendar className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.meetings" defaultValue="الاجتماعات" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/kpi" active={pathname === '/org/kpi'}>
              <BarChart3 className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.kpi" defaultValue="مؤشرات الأداء" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/okr" active={pathname?.startsWith('/org/okr') || false}>
              <Target className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.okr" defaultValue="التخطيط السنوي (OKRs)" /></span>
            </SidebarMenuLink>

            <SidebarSeparator />

            <SidebarMenuLink href="/org/members" active={pathname === '/org/members'}>
              <Users className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.members" defaultValue="الأعضاء" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/departments" active={pathname.startsWith('/org/departments')}>
              <FolderTree className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.departments" defaultValue="الأقسام" /></span>
            </SidebarMenuLink>

            {(isOwner || isAdmin) && (
              <SidebarMenuLink href="/org/settings" active={pathname.startsWith('/org/settings')}>
                <Settings className="ml-2 h-5 w-5" />
                <span><Translate text="sidebar.organizationSettings" defaultValue="إعدادات المؤسسة" /></span>
              </SidebarMenuLink>
            )}

            <SidebarSeparator />

            <SidebarMenuLink href="/org/data" active={pathname === '/org/data'}>
              <Database className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.dataManagement" defaultValue="إدارة البيانات" /></span>
            </SidebarMenuLink>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-4">
          <div className="flex flex-col space-y-2 group-data-[collapsible=icon]:hidden">
            <div className="text-sm text-muted-foreground">
              {format(currentDate, 'EEEE, d MMMM yyyy', { locale: ar })}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UserCircle className="h-5 w-5 ml-2 text-muted-foreground" />
                <span className="text-sm truncate max-w-[120px]">{user?.displayName || user?.email}</span>
              </div>
              <SignOutButton />
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>


      {/* Main Content Area */}
      <SidebarInset className="flex-1 flex flex-col relative"> {/* SidebarInset handles padding */}
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-10 bg-background border-b h-14 flex items-center justify-between px-4">
          <div className="flex items-center">
             {/* Mobile Sidebar Trigger - This button opens the Sheet */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 mr-2" // Show only on mobile, add margin
              onClick={() => setOpenMobile(true)} // Correctly use setOpenMobile from useSidebar
              aria-label={t('sidebar.toggleSidebar')}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold hidden md:block"><Translate text="organization.organization" /></h1>
            <h2 className="text-lg font-semibold md:hidden">{organizationName}</h2>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="default" size="sm" />
            {pathname === '/org/tasks' && user && (
              <AddTaskSheet user={user} />
            )}
            {user && <NotificationsPopover />}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative group"
                title={t('sidebar.smartSuggestionsTooltip')}
                onClick={(e) => e.preventDefault()} // Keep as non-functional for now
              >
                <Wand2 className="h-4 w-4" />
                <span className="sr-only"><Translate text="sidebar.smartSuggestions" /></span>
                <span className="absolute top-full right-0 mt-1 w-32 bg-popover text-popover-foreground text-xs p-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center">
                  <Translate text="tools.underDevelopment" />
                </span>
              </Button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
