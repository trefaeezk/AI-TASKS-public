
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
import { ar } from 'date-fns/locale'; // Ensured import for Arabic locale
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
  useSidebar,
} from '@/components/ui/sidebar';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AddTaskSheet } from '@/components/AddTaskSheet';
import { useAuth } from '@/context/AuthContext';
import { useTaskPageContext, type TaskCategory, categoryInfo, categoryOrder } from '@/context/TaskPageContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountType } from '@/hooks/useAccountType';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/components/DateRangePicker';
import { CategoryFilter } from '@/components/CategoryFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationsPopover } from '@/components/notifications/NotificationsPopover';
import { OkrTaskFilter } from '@/components/okr/OkrTaskFilter';


// --- Task Tabs Header Component (Moved from page.tsx, only visible on '/') ---
function TaskTabsHeader() {
    const pathname = usePathname();
    let taskPageContext: ReturnType<typeof useTaskPageContext> | null = null;
    const { t } = useLanguage();
    try {
        taskPageContext = useTaskPageContext();
    } catch (e) {
        // Context not available
    }

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
                        if (!info) return null;
                        const IconComponent = info.icon;
                        return (
                            <TabsTrigger
                                key={categoryKey}
                                value={categoryKey}
                                className={cn(
                                    "flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm h-auto min-h-[2rem]",
                                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md",
                                    "hover:bg-accent/80 hover:text-accent-foreground",
                                    count === 0 && "opacity-60",
                                    !categorizedTasks[categoryKey] && "opacity-50 cursor-not-allowed"
                                )}
                                disabled={!categorizedTasks[categoryKey]}
                            >
                               {IconComponent ? <IconComponent className="ml-1.5 h-3.5 w-3.5 flex-shrink-0" /> : null}
                               <span><Translate text={`tasks.category.${categoryKey}`} defaultValue={info.title} /></span>
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
    const { t } = useLanguage();
    let taskPageContext: ReturnType<typeof useTaskPageContext> | null = null;

    try {
        taskPageContext = useTaskPageContext();
    } catch (e) {
        // Context not available
    }

    if (!user) return null;

    const isTasksPage = pathname === '/';
    const isKpiPage = pathname === '/kpi';
    const isReportsPage = pathname.startsWith('/reports');
    const isDataManagementPage = pathname.startsWith('/data') || pathname.startsWith('/admin/data-management');
    const isSettingsPage = pathname.startsWith('/settings');

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
                        isFilterActive && "text-primary hover:text-primary"
                    )}
                    aria-label={t('common.applyFilters')}
                >
                    <Filter className="h-4 w-4" />
                    {isFilterActive && (
                        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-4">
                    <h4 className="font-medium leading-none">{t('common.filters')}</h4>

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
                            <OkrTaskFilter
                                value={taskPageContext.okrFilter}
                                onChange={taskPageContext.setOkrFilter}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    taskPageContext.setCategoryFilter(null);
                                    const now = new Date();
                                    const thirtyDaysAgo = new Date();
                                    const thirtyDaysLater = new Date();
                                    thirtyDaysAgo.setDate(now.getDate() - 30);
                                    thirtyDaysLater.setDate(now.getDate() + 30);
                                    taskPageContext.setDateFilter({ startDate: thirtyDaysAgo, endDate: thirtyDaysLater });
                                    taskPageContext.setOkrFilter(false);
                                }}
                                disabled={!isFilterActive}
                            >
                                {t('common.resetFilters')}
                            </Button>
                        </>
                    )}

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
                                        <SelectItem value="settings">{t('settings.settings')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

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
    const { user } = useAuth();
    const { isMobile, setOpenMobile } = useSidebar();
    const { role, loading: loadingPermissions } = usePermissions();
    const { accountType, isLoading: loadingAccountType } = useAccountType();
    const { t, direction } = useLanguage();
    let taskPageContextForAppLayout: ReturnType<typeof useTaskPageContext> | null = null;

    try {
        taskPageContextForAppLayout = useTaskPageContext();
    } catch (e) {
        // Context not available.
    }

    const isAdmin = role === 'admin';

    const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

    const handleLinkClick = () => {
      if (isMobile) {
        setOpenMobile(false);
      }
    };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar side="right" collapsible="icon">
            <SidebarHeader className="p-2">
                <div className="flex items-center w-full">
                  <h2 className="text-base font-semibold text-primary group-data-[collapsible=icon]:hidden truncate flex-1">
                    <Translate text="general.appName" />
                  </h2>
                </div>
                <span className="sr-only"><Translate text="general.menu" /></span>
            </SidebarHeader>

            <SidebarContent className="flex-1 overflow-y-auto p-2">
            <SidebarMenu>
                <PermissionSidebarItem
                  href="/"
                  icon={ListTodo}
                  label={t('sidebar.tasks')}
                  tooltip={t('sidebar.tasksTooltip')}
                />
                <PermissionSidebarItem
                  href="/reports"
                  icon={ListChecks}
                  label={t('sidebar.dailyPlan')}
                  tooltip={t('sidebar.dailyPlanTooltip')}
                  requiredPermission={{ area: 'reports', action: 'view' }}
                />
                <PermissionSidebarItem
                  href="/reports/weekly"
                  icon={FileText}
                  label={t('sidebar.weeklyReports')}
                  tooltip={t('sidebar.weeklyReportsTooltip')}
                  requiredPermission={{ area: 'reports', action: 'view' }}
                />
                <PermissionSidebarItem
                  href="/kpi"
                  icon={BarChart3}
                  label={t('sidebar.kpi')}
                  tooltip={t('sidebar.kpiTooltip')}
                  requiredPermission={{ area: 'reports', action: 'view' }}
                />
                <AccountTypeGuard requiredType="individual">
                  <PermissionSidebarItem
                    href="/tools"
                    icon={Wrench}
                    label={t('sidebar.tools')}
                    tooltip={t('sidebar.toolsTooltip')}
                    requiredPermission={{ area: 'tools', action: 'view' }}
                  />
                </AccountTypeGuard>
                <AccountTypeGuard requiredType="individual">
                  <PermissionSidebarItem
                    href="/suggestions"
                    icon={Wand2}
                    label={t('sidebar.smartSuggestions')}
                    tooltip={t('sidebar.smartSuggestionsTooltip')}
                    requiredPermission={{ area: 'tools', action: 'view' }}
                  />
                </AccountTypeGuard>

                <div className="h-px bg-border my-2" />

                <PermissionSidebarItem
                  href="/admin"
                  icon={Shield}
                  label={t('sidebar.adminPanel')}
                  tooltip={t('sidebar.adminPanelTooltip')}
                  requiredRole="admin"
                />
                <PermissionSidebarItem
                  href="/admin/users"
                  icon={Users}
                  label={t('sidebar.users')}
                  tooltip={t('sidebar.usersTooltip')}
                  requiredPermission={{ area: 'users', action: 'view' }}
                />
                {(role === 'admin' || role === 'system_owner' || role === 'system_admin' || role === 'organization_owner') && (
                  <PermissionSidebarItem
                    href="/admin/data-management"
                    icon={Database}
                    label={t('sidebar.dataManagement')}
                    tooltip={t('sidebar.dataManagementTooltip')}
                    requiredPermission={{ area: 'data', action: 'view' }}
                  />
                )}
                {role === 'independent' && (
                  <PermissionSidebarItem
                    href="/data"
                    icon={Database}
                    label={t('sidebar.importExport')}
                    tooltip={t('sidebar.importExportTooltip')}
                    requiredPermission={{ area: 'data', action: 'view' }}
                  />
                )}
                <AccountTypeGuard requiredType="individual">
                  <PermissionSidebarItem
                    href="/admin/organization-requests"
                    icon={Building}
                    label={t('sidebar.organizationRequests')}
                    tooltip={t('sidebar.organizationRequestsTooltip')}
                    requiredRole="system_owner"
                  />
                </AccountTypeGuard>
                <PermissionSidebarItem
                  href="/settings"
                  icon={Settings}
                  label={t('sidebar.settings')}
                  tooltip={t('sidebar.settingsTooltip')}
                  requiredPermission={{ area: 'settings', action: 'view' }}
                />
                <PermissionSidebarItem
                  href="/documentation"
                  icon={BookOpen}
                  label={t('sidebar.documentation')}
                  tooltip={t('sidebar.documentationTooltip')}
                  requiredPermission={{ area: 'settings', action: 'view' }}
                />
                <PermissionSidebarItem
                  href="/debug"
                  icon={Bug}
                  label={t('sidebar.diagnostics')}
                  tooltip={t('sidebar.diagnosticsTooltip')}
                  requiredRole="system_owner"
                />
            </SidebarMenu>
            </SidebarContent>

            <SidebarSeparator />

            <SidebarFooter className="p-2 space-y-2">
             <div className="flex flex-col items-start space-y-1 group-data-[collapsible=icon]:hidden px-2">
                {user ? (
                  <>
                    <div className="flex items-center text-xs text-muted-foreground">
                        <UserCircle className="h-4 w-4 ml-1.5"/>
                        <span className="truncate max-w-[150px]" title={user.email || t('sidebar.currentUserDefault')}>
                            {user.email || t('sidebar.currentUserDefault')}
                        </span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <Badge
                        variant={role === 'admin' || role === 'system_owner' || role === 'organization_owner' ? "default" : role === 'assistant' ? "secondary" : "outline"}
                        className="text-[10px] px-1.5 py-0 h-auto"
                      >
                        {loadingPermissions ? t('sidebar.userRoleLoading') : t(`roles.${role}`, role) }
                      </Badge>
                      <LanguageSwitcher variant="default" size="sm" />
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-8 w-full bg-muted" />
                )}
              </div>
            <SidebarMenuItem>
                    <SignOutButton tooltip={t('sidebar.signOutTooltip')} />
            </SidebarMenuItem>
            </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col relative">
             <header className="sticky top-0 z-10 flex h-auto min-h-[3.5rem] flex-col border-b bg-background/80 backdrop-blur-sm sm:h-auto">
                <div className="flex items-center justify-between gap-2 px-4 py-1 md:py-1.5 md:px-6">
                    <div className="flex items-center gap-2">
                        {user && <AddTaskSheet user={user} />}
                        <FilterPopover />
                        {user && <NotificationsPopover />}
                        {user && (
                          <Link href="/suggestions">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 relative group"
                              title={t('suggestions.smartSuggestions')}
                            >
                              <Wand2 className="h-4 w-4" />
                              <span className="sr-only"><Translate text="suggestions.smartSuggestions" /></span>
                              {/* Tooltip للاقتراحات الذكية */}
                              <span className="absolute top-full right-0 mt-1 w-max bg-popover text-popover-foreground text-xs p-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center">
                                <Translate text="suggestions.smartSuggestions" />
                              </span>
                            </Button>
                          </Link>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden h-8 w-8"
                            onClick={() => setOpenMobile(true)}
                            aria-label={t('sidebar.toggleSidebar')}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                         <h2 className="text-sm font-semibold text-primary md:hidden"><Translate text="general.appName" /></h2>
                    </div>
                </div>
                 {pathname === '/' && taskPageContextForAppLayout && <TaskTabsHeader />}
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                {children}
            </main>
        </SidebarInset>
    </div>
  );
}
