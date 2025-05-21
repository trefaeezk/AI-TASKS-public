'use client'; // Required for context and hooks

import type { ReactNode } from 'react';
import React, { useState, useEffect } from 'react';
import {
  Home, FileText, Settings, LogOut, PlusCircle, ListTodo, ListChecks,
  Edit3, ListPlus, TestTubeDiagonal, Menu, Shield, UserCircle,
  BarChart3, Filter, Users, Wrench, Database, Layers, Building,
  Bell, Wand2, Target, Bug, BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { PermissionSidebarItem } from '@/components/PermissionSidebarItem';
import { AccountTypeGuard } from '@/components/auth/AccountTypeGuard';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Translate } from '@/components/Translate';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar, // Import useSidebar hook here
} from '@/components/ui/sidebar';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddTaskSheet } from '@/components/AddTaskSheet'; // Import the AddTaskSheet component
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { useTaskPageContext, type TaskCategory } from '@/context/TaskPageContext'; // Import context for tabs
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Import Tabs components
import { useAccountType } from '@/hooks/useAccountType'; // Import useAccountType
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading state
import { Badge } from '@/components/ui/badge'; // Import Badge
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Import Popover
import { DateRangePicker } from '@/components/DateRangePicker'; // Import DateRangePicker
import { CategoryFilter } from '@/components/CategoryFilter'; // Import CategoryFilter
import { usePermissions } from '@/hooks/usePermissions'; // Import usePermissions
import { Label } from '@/components/ui/label'; // Import Label
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select
import { NotificationsPopover } from '@/components/notifications/NotificationsPopover'; // Import NotificationsPopover
import { OkrTaskFilter } from '@/components/okr/OkrTaskFilter';


// --- Task Tabs Header Component (Moved from page.tsx, only visible on '/') ---
function TaskTabsHeader() {
    const pathname = usePathname();
    let taskPageContext: ReturnType<typeof useTaskPageContext> | null = null;
    try {
        // Try to get the context, will throw if not in provider
        taskPageContext = useTaskPageContext();
    } catch (e) {
        // Context not available (e.g., in admin layout), ignore.
        // console.log("TaskTabsHeader: TaskPageContext not available."); // Reduced logging
    }

    // Only show tabs on the main task page ('/') AND if context exists
    if (pathname !== '/' || !taskPageContext) {
        return null;
    }

    const { categorizedTasks, selectedCategory, setSelectedCategory, categoryInfo, categoryOrder } = taskPageContext;

    return (
         <div className="overflow-x-auto whitespace-nowrap px-4 pb-2 md:px-6">
            <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as TaskCategory)}>
                <TabsList className="inline-flex h-auto flex-wrap justify-start gap-x-1 gap-y-1 p-1 bg-transparent border-none shadow-none">
                    {categoryOrder.map(categoryKey => {
                        const info = categoryInfo[categoryKey];
                        const count = categorizedTasks[categoryKey]?.length ?? 0;
                        // Ensure info exists before accessing its properties
                        if (!info) return null;
                        const IconComponent = info.icon;
                        return (
                            <TabsTrigger
                                key={categoryKey}
                                value={categoryKey}
                                className={cn(
                                    "flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm h-auto min-h-[2rem]", // Adjusted padding and height
                                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                                    "hover:bg-accent/80 hover:text-accent-foreground", // Gentler hover
                                    count === 0 && "opacity-60", // Dim if empty, but keep clickable
                                    !categorizedTasks[categoryKey] && "opacity-50 cursor-not-allowed" // Ensure disabled style if category has no tasks
                                )}
                                // Disable if the category itself is undefined/null OR has no tasks
                                disabled={!categorizedTasks[categoryKey] /* || categorizedTasks[categoryKey]?.length === 0 */}
                            >
                               {IconComponent ? <IconComponent className="ml-1.5 h-3.5 w-3.5 flex-shrink-0" /> : null} {/* Use IconComponent safely */}
                               <span>{info.title}</span> {/* Use info.title safely */}
                                <span className="ml-1.5 text-xs opacity-80">({count})</span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </Tabs>
        </div>
    );
}

// --- Filter Popover Component ---
function FilterPopover() {
    const { user } = useAuth();
    const pathname = usePathname();
    const { t } = useLanguage(); // استخدام سياق اللغة للترجمة
    let taskPageContext: ReturnType<typeof useTaskPageContext> | null = null;

    try {
        // Try to get the context, will throw if not in provider
        taskPageContext = useTaskPageContext();
    } catch (e) {
        // Context not available (e.g., in admin layout), ignore.
    }

    // Return null if user is not logged in
    if (!user) return null;

    // Determine filter type based on current page
    const isTasksPage = pathname === '/';
    const isKpiPage = pathname === '/kpi';
    const isReportsPage = pathname.startsWith('/reports');
    const isDataManagementPage = pathname.startsWith('/data');
    const isSettingsPage = pathname.startsWith('/settings');

    // Determine filter activation state for the home page
    let isFilterActive = false;
    if (isTasksPage && taskPageContext) {
        const { categoryFilter, dateFilter, okrFilter } = taskPageContext;
        isFilterActive = !!categoryFilter || !!dateFilter.startDate || !!dateFilter.endDate || !!okrFilter;
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 relative",
                        isFilterActive && "text-primary hover:text-primary" // Highlight if filters are active
                    )}
                    aria-label={t('common.applyFilters')}
                >
                    <Filter className="h-4 w-4" />
                    {/* Warning indicator */}
                    {isFilterActive && (
                        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-4">
                    <h4 className="font-medium leading-none">{t('common.filters')}</h4>

                    {/* Task page filters */}
                    {isTasksPage && taskPageContext && (
                        <>
                            <CategoryFilter
                                userId={user.uid}
                                selectedCategory={taskPageContext.categoryFilter}
                                onSelectCategory={taskPageContext.setCategoryFilter}
                            />
                            <DateRangePicker
                                dateRange={taskPageContext.dateFilter}
                                setDateRange={taskPageContext.setDateFilter}
                            />
                            {/* OKR filter */}
                            <OkrTaskFilter
                                value={taskPageContext.okrFilter}
                                onChange={taskPageContext.setOkrFilter}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    taskPageContext.setCategoryFilter(null);
                                    // Reset filter to default value (one month back and one month forward)
                                    const now = new Date();
                                    const thirtyDaysAgo = new Date();
                                    const thirtyDaysLater = new Date();
                                    thirtyDaysAgo.setDate(now.getDate() - 30);
                                    thirtyDaysLater.setDate(now.getDate() + 30);
                                    taskPageContext.setDateFilter({ startDate: thirtyDaysAgo, endDate: thirtyDaysLater });
                                    taskPageContext.setOkrFilter(false);
                                }}
                                disabled={!isFilterActive} // Disable if no filters are active
                            >
                                {t('common.resetFilters')}
                            </Button>
                        </>
                    )}

                    {/* KPI page filters */}
                    {isKpiPage && (
                        <div className="space-y-2">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="kpi-date-range" className="text-xs font-medium">{t('reports.reportPeriod')}</Label>
                                <Select defaultValue="month">
                                    <SelectTrigger id="kpi-date-range" className="h-9 text-xs">
                                        <SelectValue placeholder={t('reports.selectPeriod')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="week">{t('general.week')}</SelectItem>
                                        <SelectItem value="month">{t('general.month')}</SelectItem>
                                        <SelectItem value="quarter">{t('reports.quarter')}</SelectItem>
                                        <SelectItem value="year">{t('general.year')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="kpi-type" className="text-xs font-medium">{t('reports.kpiType')}</Label>
                                <Select defaultValue="all">
                                    <SelectTrigger id="kpi-type" className="h-9 text-xs">
                                        <SelectValue placeholder={t('reports.selectKpiType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('reports.allKpis')}</SelectItem>
                                        <SelectItem value="completion">{t('reports.completionRate')}</SelectItem>
                                        <SelectItem value="priority">{t('reports.byPriority')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Reports page filters */}
                    {isReportsPage && (
                        <div className="space-y-2">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="report-type" className="text-xs font-medium">{t('reports.reportType')}</Label>
                                <Select defaultValue="summary">
                                    <SelectTrigger id="report-type" className="h-9 text-xs">
                                        <SelectValue placeholder={t('reports.selectReportType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="summary">{t('reports.reportSummary')}</SelectItem>
                                        <SelectItem value="detailed">{t('reports.reportDetails')}</SelectItem>
                                        <SelectItem value="performance">{t('reports.performance')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DateRangePicker
                                dateRange={{ startDate: null, endDate: null }}
                                setDateRange={() => {}}
                            />
                        </div>
                    )}

                    {/* Data management page filters */}
                    {isDataManagementPage && (
                        <div className="space-y-2">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="data-type" className="text-xs font-medium">{t('dataManagement.dataType')}</Label>
                                <Select defaultValue="tasks">
                                    <SelectTrigger id="data-type" className="h-9 text-xs">
                                        <SelectValue placeholder={t('dataManagement.selectDataType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tasks">{t('tasks.tasks')}</SelectItem>
                                        <SelectItem value="categories">{t('general.categories')}</SelectItem>
                                        <SelectItem value="settings">{t('common.settings')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* فلاتر صفحة الإعدادات */}
                    {isSettingsPage && (
                        <div className="space-y-2">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="settings-section" className="text-xs font-medium">{t('settings.section')}</Label>
                                <Select defaultValue="general">
                                    <SelectTrigger id="settings-section" className="h-9 text-xs">
                                        <SelectValue placeholder={t('settings.selectSection')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">{t('general.general')}</SelectItem>
                                        <SelectItem value="appearance">{t('settings.appearance')}</SelectItem>
                                        <SelectItem value="notifications">{t('settings.notifications')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* رسالة إذا لم تكن هناك فلاتر متاحة للصفحة الحالية */}
                    {!isTasksPage && !isKpiPage && !isReportsPage && !isDataManagementPage && !isSettingsPage && (
                        <p className="text-sm text-muted-foreground">{t('common.noFiltersAvailable')}</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}


export function AppLayoutContent({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth(); // Get user for AddTaskSheet
    const { isMobile, setOpenMobile } = useSidebar();
    const { role, loading: loadingPermissions } = usePermissions(); // استخدام hook الصلاحيات
    const { accountType, isLoading: loadingAccountType } = useAccountType(); // استخدام hook نوع الحساب
    const { t, direction } = useLanguage(); // استخدام سياق اللغة

    // التحقق مما إذا كان المستخدم مسؤولاً
    const isAdmin = role === 'admin';


    // Helper function to check if a link is active
    const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

    // Function to close sidebar on mobile link click
    const handleLinkClick = () => {
      if (isMobile) {
        setOpenMobile(false);
      }
    };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar side="right" collapsible="icon"> {/* Sidebar on the right for RTL */}
            <SidebarHeader className="p-2 flex items-center justify-between">
                <div className="flex justify-between items-center w-full">
                  <h2 className="text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden">
                    <Translate text="general.appName" defaultValue="إدارة المهام" />
                  </h2>
                  <LanguageSwitcher variant="default" size="sm" className="group-data-[collapsible=icon]:hidden" />
                </div>
                {/* Add a visually hidden title for accessibility in mobile view */}
                <span className="sr-only"><Translate text="general.menu" defaultValue="القائمة الرئيسية" /></span>
            </SidebarHeader>

            <SidebarContent className="flex-1 overflow-y-auto p-2">
            <SidebarMenu>
                {/* عناصر القائمة الرئيسية */}
                <PermissionSidebarItem
                  href="/"
                  icon={ListTodo}
                  label="المهام"
                  tooltip="إدارة المهام ولوحة التحكم الرئيسية"
                />



                <PermissionSidebarItem
                  href="/reports"
                  icon={ListChecks}
                  label="الخطة اليومية"
                  tooltip="خطة اليوم المقترحة"
                  requiredPermission={{ area: 'reports', action: 'view' }}
                />

                <PermissionSidebarItem
                  href="/reports/weekly"
                  icon={FileText}
                  label="التقارير الأسبوعية"
                  tooltip="التقارير الأسبوعية للمهام"
                  requiredPermission={{ area: 'reports', action: 'view' }}
                />

                <PermissionSidebarItem
                  href="/kpi"
                  icon={BarChart3}
                  label="مؤشرات الأداء"
                  tooltip="مؤشرات الأداء (KPI)"
                  requiredPermission={{ area: 'reports', action: 'view' }}
                />

                <AccountTypeGuard requiredType="individual">
                  <PermissionSidebarItem
                    href="/tools"
                    icon={Wrench}
                    label="الأدوات"
                    tooltip="أدوات النظام"
                    requiredPermission={{ area: 'tools', action: 'view' }}
                  />
                </AccountTypeGuard>

                <AccountTypeGuard requiredType="individual">
                  <PermissionSidebarItem
                    href="/suggestions"
                    icon={Wand2}
                    label="الاقتراحات الذكية"
                    tooltip="اقتراحات ذكية لتحسين إدارة المهام"
                    requiredPermission={{ area: 'tools', action: 'view' }}
                  />
                </AccountTypeGuard>


                {/* عناصر قائمة الإدارة */}
                <div className="h-px bg-border my-2" />

                <PermissionSidebarItem
                  href="/admin"
                  icon={Shield}
                  label="لوحة الإدارة"
                  tooltip="لوحة تحكم المسؤول"
                  requiredRole="admin"
                />

                <PermissionSidebarItem
                  href="/admin/users"
                  icon={Users}
                  label="المستخدمين"
                  tooltip="إدارة المستخدمين"
                  requiredPermission={{ area: 'users', action: 'view' }}
                />

                {/* إدارة البيانات للمسؤول */}
                {(role === 'admin' || role === 'owner') && (
                  <PermissionSidebarItem
                    href="/admin/data-management"
                    icon={Database}
                    label="إدارة البيانات"
                    tooltip="تصدير واستيراد بيانات النظام"
                    requiredPermission={{ area: 'data', action: 'view' }}
                  />
                )}

                {/* استيراد/تصدير للمستخدم المستقل */}
                {role === 'independent' && (
                  <PermissionSidebarItem
                    href="/data"
                    icon={Database}
                    label="استيراد/تصدير"
                    tooltip="استيراد وتصدير مهامك الخاصة"
                    requiredPermission={{ area: 'data', action: 'view' }}
                  />
                )}

                {/* رابط إدارة طلبات المؤسسات - يظهر فقط للمالك */}
                <AccountTypeGuard requiredType="individual">
                  <PermissionSidebarItem
                    href="/admin/organization-requests"
                    icon={Building}
                    label="طلبات المؤسسات"
                    tooltip="إدارة طلبات إنشاء المؤسسات"
                    requiredRole="owner"
                  />
                </AccountTypeGuard>

                <PermissionSidebarItem
                  href="/settings"
                  icon={Settings}
                  label="الإعدادات"
                  tooltip="إعدادات النظام"
                  requiredPermission={{ area: 'settings', action: 'view' }}
                />

                <PermissionSidebarItem
                  href="/documentation"
                  icon={BookOpen}
                  label="الوثائق"
                  tooltip="وثائق النظام"
                  requiredPermission={{ area: 'settings', action: 'view' }}
                />

                {/* رابط صفحة التشخيص - يظهر فقط للمالك */}
                <PermissionSidebarItem
                  href="/debug"
                  icon={Bug}
                  label="التشخيص"
                  tooltip="صفحة التشخيص وإصلاح المشاكل"
                  requiredRole="owner"
                />
            </SidebarMenu>
            </SidebarContent>

            <SidebarSeparator />

            <SidebarFooter className="p-2 space-y-2">
             {/* User Info Section */}
             <div className="flex flex-col items-start space-y-1 group-data-[collapsible=icon]:hidden px-2">
                {user ? (
                  <>
                    <div className="flex items-center text-xs text-muted-foreground">
                        <UserCircle className="h-4 w-4 ml-1.5"/>
                        <span className="truncate max-w-[150px]" title={user.email || 'User'}>
                            {user.email || 'المستخدم الحالي'}
                        </span>
                    </div>
                    <Badge
                      variant={role === 'admin' ? "default" : role === 'user' ? "secondary" : "outline"}
                      className="text-[10px] px-1.5 py-0 h-auto self-start"
                    >
                      {loadingPermissions ? 'جار التحميل...' : (() => {
                        switch(role) {
                          case 'admin': return 'مسؤول';
                          case 'engineer': return 'مهندس';
                          case 'supervisor': return 'مشرف';
                          case 'technician': return 'فني';
                          case 'assistant': return 'مساعد فني';
                          case 'user': return 'مستخدم';
                          case 'independent': return 'مستخدم مستقل';
                          default: return role;
                        }
                      })()}
                    </Badge>
                  </>
                ) : (
                  <Skeleton className="h-8 w-full bg-muted" />
                )}
              </div>

             {/* Sign Out Button */}
            <SidebarMenuItem>
                    <SignOutButton />
            </SidebarMenuItem>
            </SidebarFooter>
        </Sidebar>

        {/* Main Content Area */}
        <SidebarInset className="flex-1 flex flex-col relative">
            {/* Header for the main content area */}
             <header className="sticky top-0 z-10 flex h-auto min-h-[3.5rem] flex-col border-b bg-background/80 backdrop-blur-sm sm:h-auto">
                 {/* Top part of header: Trigger, Filter, Add Task */}
                <div className="flex items-center justify-between gap-2 px-4 py-1 md:py-1.5 md:px-6">
                    {/* Right side: Sidebar Trigger for Mobile */}
                    <div className="flex items-center gap-2">
                        {/* Add Task Button */}
                        {user && <AddTaskSheet user={user} />}

                        {/* Filter Button/Popover - Show on all pages */}
                        <FilterPopover />

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
                    </div>

                    {/* Left side: App Title (visible on mobile) and Menu Button */}
                    <div className="flex items-center gap-2">
                        {/* Sidebar Trigger for Mobile - Moved to right side */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden h-8 w-8" // Only show on mobile
                            onClick={() => setOpenMobile(true)} // Use setOpenMobile from useSidebar
                            aria-label="فتح القائمة"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        {/* App Title - Only show on mobile */}
                        <h2 className="text-sm font-semibold text-primary md:hidden">إدارة المهام</h2>
                    </div>
                </div>
                 {/* Bottom part of header: Task Tabs (only on '/' and if context is available) */}
                 {pathname === '/' && <TaskTabsHeader />}
            </header>
                {/* Page content rendered here */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                {children}
            </main>
        </SidebarInset>
    </div>
  );
}
