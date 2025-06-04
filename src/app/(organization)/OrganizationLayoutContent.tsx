
'use client';

import type { ReactNode } from 'react';
import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  Home, FileText, Settings, Menu, UserCircle,
  BarChart3, Users, Database, Building, FolderTree, ListTodo,
  Calendar, Wand2, Target
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale'; // Ensure 'ar' is imported

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
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Translate } from '@/components/Translate';

import { NotificationsPopover } from '@/components/notifications/NotificationsPopover';
import { useTaskPageContext, type TaskCategory, categoryInfo, categoryOrder } from '@/context/TaskPageContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/components/DateRangePicker';
import { CategoryFilter } from '@/components/CategoryFilter';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OkrTaskFilter } from '@/components/okr/OkrTaskFilter';
import { cn } from '@/lib/utils';
import { Filter, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
// import Link from 'next/link'; // غير مستخدم حالياً

// Task Type Filter Context
type TaskTypeFilter = 'organization' | 'department' | 'individual';

interface TaskTypeFilterContextType {
  taskTypeFilter: TaskTypeFilter;
  setTaskTypeFilter: (filter: TaskTypeFilter) => void;
}

const TaskTypeFilterContext = createContext<TaskTypeFilterContextType | null>(null);

export const useTaskTypeFilter = () => {
  const context = useContext(TaskTypeFilterContext);
  if (!context) {
    // Return default values if context is not available
    return {
      taskTypeFilter: 'individual' as TaskTypeFilter,
      setTaskTypeFilter: () => {}
    };
  }
  return context;
};

// --- Task Tabs Header Component ---
function TaskTabsHeader() {
    const pathname = usePathname();
    let taskPageContext: ReturnType<typeof useTaskPageContext> | null = null;
    const { t } = useLanguage();
    try {
        taskPageContext = useTaskPageContext();
    } catch (e) {
        // Context not available
    }

    if ((pathname !== '/' && pathname !== '/org/tasks') || !taskPageContext) {
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
function FilterPopover({ isActive, userId, organizationId }: { isActive: boolean; userId: string; organizationId?: string }) {
    const pathname = usePathname();
    const { t } = useLanguage();
    let taskPageContext: ReturnType<typeof useTaskPageContext> | null = null;

    try {
        taskPageContext = useTaskPageContext();
    } catch (e) {
        // Context not available
    }

    const isTasksPage = pathname === '/org/tasks';

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-8 w-8 relative",
                        isActive && "text-primary hover:text-primary"
                    )}
                    aria-label={t('common.applyFilters')}
                >
                    <Filter className="h-4 w-4" />
                    {isActive && (
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
                                userId={userId}
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
                                disabled={!isActive}
                            >
                                {t('common.resetFilters')}
                            </Button>
                        </>
                    )}

                    {!isTasksPage && (
                        <p className="text-sm text-muted-foreground">{t('common.noFiltersAvailable')}</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function OrganizationLayoutContent({ children }: { children: ReactNode }) {
  const { user, userClaims } = useAuth();
  const { t, direction, language } = useLanguage();
  const pathname = usePathname();

  // تحديد ما إذا كانت اللغة عربية
  const isRTL = language === 'ar' || direction === 'rtl';
  const [currentDate, setCurrentDate] = useState(new Date());

  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  // Get task page context for filters and tabs
  const taskPageContext = useTaskPageContext();

  // Check if we're on tasks page
  const isTasksPage = pathname === '/org/tasks';

  // Task type filter state - default based on user role
  const getDefaultTaskType = () => {
    if (userClaims?.isOrgOwner || userClaims?.isOrgAdmin) {
      return 'organization'; // الإدارة العليا تبدأ بمهام المؤسسة
    } else if (userClaims?.isOrgSupervisor) {
      return 'department'; // المشرفين يبدؤون بمهام القسم
    } else {
      return 'individual'; // باقي الأدوار تبدأ بالمهام الفردية
    }
  };

  const [taskTypeFilter, setTaskTypeFilter] = useState<'organization' | 'department' | 'individual'>(getDefaultTaskType());

  // Check if filters are active
  let isFilterActive = false;
  if (isTasksPage && taskPageContext) {
    const { categoryFilter, dateFilter, okrFilter } = taskPageContext;
    isFilterActive = !!categoryFilter || !!dateFilter.startDate || !!dateFilter.endDate || !!okrFilter;
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const organizationName = userClaims?.organizationName || t('organization.organization');
  const isOwner = userClaims?.isOrgOwner === true;
  const isAdmin = userClaims?.isOrgAdmin === true;

  return (
    <TaskTypeFilterContext.Provider value={{ taskTypeFilter, setTaskTypeFilter }}>
      <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar
        side="right" // For RTL
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
            {/* Desktop collapse trigger */}
            <SidebarTrigger asChild className="hidden md:flex">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only"><Translate text="sidebar.toggleSidebar" /></span>
              </Button>
            </SidebarTrigger>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuLink href="/org" active={pathname === '/org'}>
              <Home className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.dashboard" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/tasks" active={pathname === '/org/tasks'}>
              <ListTodo className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.tasks" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/reports" active={pathname?.startsWith('/org/reports') || false}>
              <FileText className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.reports" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/meetings" active={pathname?.startsWith('/org/meetings') || false}>
              <Calendar className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.meetings" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/kpi" active={pathname === '/org/kpi'}>
              <BarChart3 className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.kpi" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/okr" active={pathname?.startsWith('/org/okr') || false}>
              <Target className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.okr" /></span>
            </SidebarMenuLink>

            <SidebarSeparator />

            <SidebarMenuLink href="/org/members" active={pathname === '/org/members'}>
              <Users className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.members" /></span>
            </SidebarMenuLink>

            <SidebarMenuLink href="/org/departments" active={pathname?.startsWith('/org/departments') || false}>
              <FolderTree className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.departments" /></span>
            </SidebarMenuLink>

            {(isOwner || isAdmin) && (
              <SidebarMenuLink href="/org/settings" active={pathname?.startsWith('/org/settings') || false}>
                <Settings className="ml-2 h-5 w-5" />
                <span><Translate text="sidebar.organizationSettings" /></span>
              </SidebarMenuLink>
            )}

            <SidebarSeparator />

            <SidebarMenuLink href="/org/data" active={pathname === '/org/data'}>
              <Database className="ml-2 h-5 w-5" />
              <span><Translate text="sidebar.organizationDataManagement" /></span>
            </SidebarMenuLink>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t mt-auto">
          <div className="flex flex-col justify-center space-y-2 group-data-[collapsible=icon]:hidden">
            {/* الاسم والأيقونة */}
            <div className="flex items-center">
              <UserCircle className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate" title={user?.displayName || user?.email}>
                  {user?.displayName || user?.email?.split('@')[0] || 'مستخدم'}
                </span>
                {user?.displayName && user?.email && (
                  <span className="text-[10px] text-muted-foreground truncate" title={user.email}>
                    {user.email}
                  </span>
                )}
              </div>
            </div>

            {/* الدور */}
            <div className="flex">
              <Badge
                variant={
                  userClaims?.isOrgOwner || userClaims?.isOrgAdmin ? "default" :
                  userClaims?.isOrgSupervisor ? "secondary" : "outline"
                }
                className="text-[10px] px-1.5 py-0.5 h-auto"
              >
                {userClaims?.isOrgOwner && <Translate text="roles.isOrgOwner" defaultValue="مالك المؤسسة" />}
                {userClaims?.isOrgAdmin && <Translate text="roles.isOrgAdmin" defaultValue="أدمن المؤسسة" />}
                {userClaims?.isOrgSupervisor && <Translate text="roles.isOrgSupervisor" defaultValue="مشرف" />}
                {userClaims?.isOrgEngineer && <Translate text="roles.isOrgEngineer" defaultValue="مهندس" />}
                {userClaims?.isOrgTechnician && <Translate text="roles.isOrgTechnician" defaultValue="فني" />}
                {userClaims?.isOrgAssistant && <Translate text="roles.isOrgAssistant" defaultValue="مساعد فني" />}
                {!userClaims?.isOrgOwner && !userClaims?.isOrgAdmin && !userClaims?.isOrgSupervisor &&
                 !userClaims?.isOrgEngineer && !userClaims?.isOrgTechnician && !userClaims?.isOrgAssistant && (
                  <Translate text="roles.member" defaultValue="عضو" />
                )}
              </Badge>
            </div>

            {/* زر تسجيل الخروج */}
            <div className="flex">
              <SignOutButton />
            </div>

            {/* التاريخ */}
            <div className="text-[10px] text-muted-foreground text-center border-t pt-1">
              {format(currentDate, 'EEEE، d MMMM yyyy', { locale: ar })}
            </div>
          </div>

          {/* عرض مبسط عند طي الشريط الجانبي */}
          <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:space-y-2 hidden">
            <UserCircle className="h-6 w-6 text-primary" />
            <SignOutButton />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex-1 flex flex-col relative">
        <header className="sticky top-0 z-10 bg-background border-b min-h-[3.5rem] flex items-center justify-between px-4 py-2 flex-wrap">
          <div className="flex items-center flex-wrap">
            {/* Mobile menu button in header */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-2"
              onClick={() => setOpenMobile(true)}
              aria-label={t('sidebar.toggleSidebar')}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold hidden md:block"><Translate text="organization.organization" /></h2>
            <h2 className="text-lg font-semibold md:hidden">{organizationName}</h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <LanguageSwitcher variant="default" size="sm" />
            {isTasksPage && taskPageContext && (
              <>
                {/* Task Type Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                    >
                      {taskTypeFilter === 'organization' && <Translate text="tasks.organizationTasks" defaultValue="مهام المؤسسة" />}
                      {taskTypeFilter === 'department' && <Translate text="tasks.departmentTasks" defaultValue="مهام القسم" />}
                      {taskTypeFilter === 'individual' && <Translate text="tasks.individualTasks" defaultValue="مهام فردية" />}
                      <ChevronDown className="mr-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {/* مهام المؤسسة - للإدارة العليا فقط */}
                    {(userClaims?.isOrgOwner || userClaims?.isOrgAdmin) && (
                      <DropdownMenuItem
                        onClick={() => setTaskTypeFilter('organization')}
                        className={taskTypeFilter === 'organization' ? 'bg-accent' : ''}
                      >
                        <Translate text="tasks.organizationTasks" defaultValue="مهام المؤسسة" />
                      </DropdownMenuItem>
                    )}

                    {/* مهام القسم - للمشرفين والإدارة */}
                    {(userClaims?.isOrgOwner || userClaims?.isOrgAdmin || userClaims?.isOrgSupervisor) && (
                      <DropdownMenuItem
                        onClick={() => setTaskTypeFilter('department')}
                        className={taskTypeFilter === 'department' ? 'bg-accent' : ''}
                      >
                        <Translate text="tasks.departmentTasks" defaultValue="مهام القسم" />
                      </DropdownMenuItem>
                    )}

                    {/* المهام الفردية - للجميع */}
                    <DropdownMenuItem
                      onClick={() => setTaskTypeFilter('individual')}
                      className={taskTypeFilter === 'individual' ? 'bg-accent' : ''}
                    >
                      <Translate text="tasks.individualTasks" defaultValue="مهام فردية" />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <FilterPopover
                  isActive={isFilterActive}
                  userId={user?.uid || ''}
                  organizationId={userClaims?.organizationId}
                />
              </>
            )}
            {pathname === '/org/tasks' && user && (
              <AddTaskSheet user={user} />
            )}
            {user && <NotificationsPopover />}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative group"
                title={t('suggestions.smartSuggestions')}
                onClick={(e) => e.preventDefault()}
                disabled
              >
                <Wand2 className="h-4 w-4 opacity-50" />
                <span className="sr-only"><Translate text="suggestions.smartSuggestions" /></span>
                <span className="absolute top-full right-0 mt-1 w-32 bg-popover text-popover-foreground text-xs p-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center">
                  <Translate text="tools.underDevelopment" />
                </span>
              </Button>
            )}
          </div>
        </header>

        {/* Task Tabs Header for tasks page */}
        {isTasksPage && taskPageContext && <TaskTabsHeader />}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
      </div>
    </TaskTypeFilterContext.Provider>
  );
}
