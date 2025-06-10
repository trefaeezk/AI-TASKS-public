'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building,
  Users,
  FolderTree,
  ListTodo,
  BarChart3,
  Settings,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Activity,
  FileText,
  Target
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Translate } from '@/components/Translate';

interface DashboardStats {
  members: {
    total: number;
    byRole: {
      owners: number;
      admins: number;
      supervisors: number;
      engineers: number;
      technicians: number;
      assistants: number;
    };
  };
  departments: {
    total: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    hold: number;
    completionRate: number;
  };
  meetings: {
    total: number;
    thisWeek: number;
    upcoming: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'task_completed' | 'task_overdue' | 'member_joined' | 'department_created' | 'meeting_scheduled';
  title: string;
  description: string;
  timestamp: Date;
  status?: string;
  priority?: 'low' | 'medium' | 'high';
  count?: number;
  department?: string;
}

export default function OrganizationDashboard() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    members: {
      total: 0,
      byRole: {
        owners: 0,
        admins: 0,
        supervisors: 0,
        engineers: 0,
        technicians: 0,
        assistants: 0,
      }
    },
    departments: {
      total: 0,
    },
    tasks: {
      total: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      hold: 0,
      completionRate: 0,
    },
    meetings: {
      total: 0,
      thisWeek: 0,
      upcoming: 0,
    }
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  const organizationId = userClaims?.organizationId;
  const organizationName = userClaims?.organizationName || 'المؤسسة';

  // تحديد الصلاحيات
  const isSystemOwner = userClaims?.isSystemOwner === true;
  const isSystemAdmin = userClaims?.isSystemAdmin === true;
  const isOrgOwner = userClaims?.isOrgOwner === true;
  const isOrgAdmin = userClaims?.isOrgAdmin === true;

  // فقط الأدوار العليا يمكنها الوصول للوحة الإدارة
  const canAccessDashboard = isSystemOwner || isSystemAdmin || isOrgOwner || isOrgAdmin;

  // تحديد المستخدمين ذوي الأدوار المنخفضة الذين لا ينتمون لقسم
  const isLowRoleWithoutDepartment = !userClaims?.departmentId &&
    (userClaims?.isOrgAssistant || userClaims?.isOrgTechnician || userClaims?.isOrgEngineer || userClaims?.isOrgSupervisor);

  // تم نقل منطق التوجيه إلى AuthContext لتجنب التوجيه المتكرر

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user || !organizationId) {
        setLoading(false);
        return;
      }

      // فحص الصلاحيات - فقط الأدوار العليا يمكنها الوصول
      if (!canAccessDashboard) {
        setLoading(false);
        return;
      }

      try {
        // جلب بيانات المؤسسة أولاً للتحقق من الصلاحيات
        const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
        if (!orgDoc.exists()) {
          throw new Error('Organization not found');
        }

        // جلب الأعضاء مع تفاصيل الأدوار
        const membersQuery = query(
          collection(db, 'organizations', organizationId, 'members')
        );
        const membersSnapshot = await getDocs(membersQuery);

        // تحليل الأدوار
        const roleStats = {
          owners: 0,
          admins: 0,
          supervisors: 0,
          engineers: 0,
          technicians: 0,
          assistants: 0,
        };

        membersSnapshot.docs.forEach(doc => {
          const member = doc.data();

          if (member.isOrgOwner) roleStats.owners++;
          else if (member.isOrgAdmin) roleStats.admins++;
          else if (member.isOrgSupervisor) roleStats.supervisors++;
          else if (member.isOrgEngineer) roleStats.engineers++;
          else if (member.isOrgTechnician) roleStats.technicians++;
          else if (member.isOrgAssistant) roleStats.assistants++;
        });

        // جلب الأقسام
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const departmentsSnapshot = await getDocs(departmentsQuery);

        // جلب إحصائيات المهام المحسنة
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('organizationId', '==', organizationId)
        );
        const tasksSnapshot = await getDocs(tasksQuery);

        const taskStats = {
          total: tasksSnapshot.size,
          completed: 0,
          inProgress: 0,
          overdue: 0,
          hold: 0,
        };

        const now = new Date();
        tasksSnapshot.docs.forEach(doc => {
          const task = doc.data();
          switch (task.status) {
            case 'completed':
              taskStats.completed++;
              break;
            case 'in_progress':
              taskStats.inProgress++;
              break;
            case 'hold':
              taskStats.hold++;
              break;
          }

          // فحص المهام المتأخرة
          if (task.status !== 'completed' && task.dueDate && task.dueDate.toDate() < now) {
            taskStats.overdue++;
          }
        });

        const completionRate = taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0;

        // جلب النشاط الأخير - تحسين للسياق المؤسسي
        const activityData: RecentActivity[] = [];

        // 1. المهام المكتملة حديثاً
        try {
          const completedTasksQuery = query(
            collection(db, 'tasks'),
            where('organizationId', '==', organizationId),
            where('status', '==', 'completed'),
            orderBy('updatedAt', 'desc'),
            limit(3)
          );
          const completedTasksSnapshot = await getDocs(completedTasksQuery);

          completedTasksSnapshot.docs.forEach(doc => {
            const task = doc.data();
            activityData.push({
              id: `completed_${doc.id}`,
              type: 'task_completed',
              title: `تم إكمال: ${task.title}`,
              description: `بواسطة ${task.assigneeName || 'غير محدد'} في ${task.departmentName || 'قسم غير محدد'}`,
              timestamp: task.updatedAt?.toDate() || new Date(),
              department: task.departmentName
            });
          });
        } catch (error) {
          console.log('Error fetching completed tasks:', error);
        }

        // 2. المهام المتأخرة
        try {
          const now = new Date();
          const overdueTasksQuery = query(
            collection(db, 'tasks'),
            where('organizationId', '==', organizationId),
            where('status', 'in', ['hold', 'in_progress']),
            where('dueDate', '<', now),
            limit(5)
          );
          const overdueTasksSnapshot = await getDocs(overdueTasksQuery);

          if (overdueTasksSnapshot.docs.length > 0) {
            activityData.push({
              id: 'overdue_tasks',
              type: 'task_overdue',
              title: `${overdueTasksSnapshot.docs.length} مهام متأخرة`,
              description: 'تحتاج إلى متابعة عاجلة',
              timestamp: now,
              count: overdueTasksSnapshot.docs.length
            });
          }
        } catch (error) {
          console.log('Error fetching overdue tasks:', error);
        }

        // 3. الأعضاء الجدد (آخر 7 أيام)
        try {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);

          const newMembersQuery = query(
            collection(db, 'organizationMembers'),
            where('organizationId', '==', organizationId),
            where('joinedAt', '>=', weekAgo),
            orderBy('joinedAt', 'desc'),
            limit(3)
          );
          const newMembersSnapshot = await getDocs(newMembersQuery);

          newMembersSnapshot.docs.forEach(doc => {
            const member = doc.data();
            activityData.push({
              id: `member_${doc.id}`,
              type: 'member_joined',
              title: `عضو جديد: ${member.displayName || member.email}`,
              description: `انضم إلى ${member.departmentName || 'المؤسسة'}`,
              timestamp: member.joinedAt?.toDate() || new Date(),
              department: member.departmentName
            });
          });
        } catch (error) {
          console.log('Error fetching new members:', error);
        }

        // ترتيب النشاطات حسب التاريخ
        activityData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setStats({
          members: {
            total: membersSnapshot.size,
            byRole: roleStats
          },
          departments: {
            total: departmentsSnapshot.size,
          },
          tasks: {
            ...taskStats,
            completionRate
          },
          meetings: {
            total: 0, // سيتم تحديثه لاحقاً
            thisWeek: 0,
            upcoming: 0
          }
        });

        setRecentActivity(activityData);
      } catch (error: any) {
        console.error('Error fetching organization data:', error);

        // معالجة أخطاء الصلاحيات
        if (error?.code === 'permission-denied') {
          toast({
            title: 'خطأ في الصلاحيات',
            description: 'ليس لديك صلاحية للوصول إلى بيانات هذه المؤسسة.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'خطأ في جلب بيانات المؤسسة',
            description: 'حدث خطأ أثناء محاولة جلب بيانات المؤسسة.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [user, organizationId, toast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  // فحص الصلاحيات - منع الوصول لغير الأدوار العليا
  if (!canAccessDashboard) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-red-600">
            غير مصرح لك بالوصول
          </h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            لوحة الإدارة متاحة فقط لمالكي المؤسسة والإداريين.
            {isLowRoleWithoutDepartment ?
              'سيتم توجيهك إلى صفحة المهام حيث يمكنك إدارة مهامك الشخصية.' :
              'يمكنك الوصول إلى المهام والأقسام المخصصة لك.'
            }
          </p>
          <div className="flex space-x-2 space-x-reverse">
            <Button asChild>
              <Link href="/org/tasks">
                <ListTodo className="ml-2 h-4 w-4" />
                المهام
              </Link>
            </Button>
            {!isLowRoleWithoutDepartment && (
              <Button asChild variant="outline">
                <Link href="/org/departments">
                  <FolderTree className="ml-2 h-4 w-4" />
                  الأقسام
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // مكونات الإحصائيات
  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    color = "blue",
    href
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    trend?: { value: number; isPositive: boolean };
    color?: "blue" | "green" | "purple" | "orange" | "red";
    href?: string;
  }) => {
    const colorClasses = {
      blue: "text-blue-500 bg-blue-50 border-blue-200",
      green: "text-green-500 bg-green-50 border-green-200",
      purple: "text-purple-500 bg-purple-50 border-purple-200",
      orange: "text-orange-500 bg-orange-50 border-orange-200",
      red: "text-red-500 bg-red-50 border-red-200"
    };

    const cardElement = (
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="flex items-baseline space-x-2 space-x-reverse">
                <p className="text-2xl font-bold">{value}</p>
                {trend && (
                  <span className={`text-xs flex items-center ${
                    trend.isPositive ? 'text-green-500' : 'text-red-500'
                  }`}>
                    <TrendingUp className={`h-3 w-3 ml-1 ${!trend.isPositive ? 'rotate-180' : ''}`} />
                    {Math.abs(trend.value)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    );

    return href ? (
      <Link href={href} className="block">
        {cardElement}
      </Link>
    ) : cardElement;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center">
                <Building className="ml-3 h-6 w-6 md:h-8 md:w-8 text-primary" />
                <Translate text="dashboard.title" defaultValue={`لوحة تحكم ${organizationName}`} />
              </h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                <Translate text="dashboard.subtitle" defaultValue="نظرة عامة على أداء المؤسسة" />
              </p>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              {(isOrgOwner || isOrgAdmin) && (
                <Button asChild size="sm" className="w-full sm:w-auto">
                  <Link href="/org/settings">
                    <Settings className="ml-2 h-4 w-4" />
                    <Translate text="dashboard.settings" defaultValue="الإعدادات" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="إجمالي الأعضاء"
          value={stats.members.total}
          subtitle="عضو في المؤسسة"
          icon={Users}
          color="blue"
          href="/org/members"
        />

        <StatCard
          title="الأقسام"
          value={stats.departments.total}
          subtitle="قسم في المؤسسة"
          icon={FolderTree}
          color="green"
          href="/org/departments"
        />

        <StatCard
          title="المهام"
          value={stats.tasks.total}
          subtitle={`معدل الإنجاز ${Math.round(stats.tasks.completionRate)}%`}
          icon={ListTodo}
          color="purple"
          href="/org/tasks"
          trend={{
            value: stats.tasks.completionRate,
            isPositive: stats.tasks.completionRate >= 70
          }}
        />

        <StatCard
          title="المهام المتأخرة"
          value={stats.tasks.overdue}
          subtitle={`من أصل ${stats.tasks.total - stats.tasks.completed} مهمة نشطة`}
          icon={AlertCircle}
          color={stats.tasks.overdue > 0 ? "red" : "green"}
        />
      </div>

          {/* المحتوى التفصيلي */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
              <TabsTrigger value="overview" className="text-xs md:text-sm">نظرة عامة</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs md:text-sm">المهام</TabsTrigger>
              <TabsTrigger value="members" className="text-xs md:text-sm">الأعضاء</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs md:text-sm">التحليلات</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* النشاط الأخير */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="ml-2 h-5 w-5" />
                  النشاط المؤسسي
                </CardTitle>
                <CardDescription>المهام المكتملة، التحديثات المهمة، والأعضاء الجدد</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا يوجد نشاط مؤسسي حديث</p>
                    <p className="text-sm mt-2">ابدأ بإضافة مهام أو دعوة أعضاء جدد</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.slice(0, 6).map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3 space-x-reverse">
                        <div className={`p-2 rounded-full ${
                          activity.type === 'task_completed' ? 'bg-green-100 text-green-600' :
                          activity.type === 'task_overdue' ? 'bg-red-100 text-red-600' :
                          activity.type === 'member_joined' ? 'bg-purple-100 text-purple-600' :
                          activity.type === 'department_created' ? 'bg-orange-100 text-orange-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {activity.type === 'task_completed' && <CheckCircle className="h-4 w-4" />}
                          {activity.type === 'task_overdue' && <AlertCircle className="h-4 w-4" />}
                          {activity.type === 'member_joined' && <Users className="h-4 w-4" />}
                          {activity.type === 'department_created' && <FolderTree className="h-4 w-4" />}
                          {activity.type === 'meeting_scheduled' && <Calendar className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{activity.title}</p>
                            <div className="flex items-center space-x-2 space-x-reverse">
                              {activity.status && (
                                <Badge variant={
                                  activity.status === 'completed' ? 'default' :
                                  activity.status === 'overdue' ? 'destructive' :
                                  'secondary'
                                } className="text-xs">
                                  {activity.status === 'completed' ? 'مكتملة' :
                                   activity.status === 'in_progress' ? 'قيد التنفيذ' :
                                   activity.status === 'hold' ? 'معلقة' :
                                   activity.status === 'overdue' ? 'متأخرة' : activity.status}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {activity.timestamp.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {activity.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* إجراءات سريعة */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Plus className="ml-2 h-5 w-5" />
                  إجراءات سريعة
                </CardTitle>
                <CardDescription>الإجراءات الأكثر استخداماً</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full justify-start">
                  <Link href="/org/tasks">
                    <ListTodo className="ml-2 h-4 w-4" />
                    إنشاء مهمة جديدة
                  </Link>
                </Button>

                {(isOrgOwner || isOrgAdmin) && (
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/org/members">
                      <Users className="ml-2 h-4 w-4" />
                      دعوة عضو جديد
                    </Link>
                  </Button>
                )}

                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href="/org/meetings">
                    <Calendar className="ml-2 h-4 w-4" />
                    جدولة اجتماع
                  </Link>
                </Button>

                {(isOrgOwner || isOrgAdmin) && (
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link href="/org/departments">
                      <FolderTree className="ml-2 h-4 w-4" />
                      إنشاء قسم جديد
                    </Link>
                  </Button>
                )}

                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link href="/org/reports">
                    <FileText className="ml-2 h-4 w-4" />
                    الخطة اليومية
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link href="/org/kpi">
                    <BarChart3 className="ml-2 h-4 w-4" />
                    مؤشرات الأداء والتقارير
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link href="/org/okr">
                    <Target className="ml-2 h-4 w-4" />
                    OKR
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

            <TabsContent value="tasks" className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">المهام المكتملة</p>
                    <p className="text-2xl font-bold text-green-600">{stats.tasks.completed}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <Progress value={stats.tasks.completionRate} className="mt-3" />
                <p className="text-xs text-muted-foreground mt-2">
                  {Math.round(stats.tasks.completionRate)}% من إجمالي المهام
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">قيد التنفيذ</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.tasks.inProgress}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">معلقة</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.tasks.hold}</p>
                  </div>
                  <ListTodo className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">متأخرة</p>
                    <p className="text-2xl font-bold text-red-600">{stats.tasks.overdue}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>المهام الأخيرة</CardTitle>
              <CardDescription>آخر المهام المضافة والمحدثة</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.filter(a => a.type === 'task_completed' || a.type === 'task_overdue').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد مهام حديثة</p>
                  <Button asChild className="mt-4">
                    <Link href="/org/tasks">
                      <Plus className="ml-2 h-4 w-4" />
                      إنشاء مهمة جديدة
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.filter(a => a.type === 'task_completed' || a.type === 'task_overdue').slice(0, 8).map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <div className={`p-2 rounded-full ${
                          task.priority === 'high' ? 'bg-red-100 text-red-600' :
                          task.priority === 'medium' ? 'bg-orange-100 text-orange-600' :
                          'bg-green-100 text-green-600'
                        }`}>
                          <ListTodo className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-medium">{task.title}</h4>
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Badge variant={
                          task.status === 'completed' ? 'default' :
                          task.status === 'overdue' ? 'destructive' :
                          'secondary'
                        }>
                          {task.status === 'completed' ? 'مكتملة' :
                           task.status === 'in_progress' ? 'قيد التنفيذ' :
                           task.status === 'hold' ? 'معلقة' :
                           task.status === 'overdue' ? 'متأخرة' : task.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {task.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

            <TabsContent value="members" className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">توزيع الأدوار</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">مالكو المؤسسة</span>
                  <Badge variant="default">{stats.members.byRole.owners}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">إداريو المؤسسة</span>
                  <Badge variant="secondary">{stats.members.byRole.admins}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">المشرفون</span>
                  <Badge variant="outline">{stats.members.byRole.supervisors}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">المهندسون</span>
                  <Badge variant="outline">{stats.members.byRole.engineers}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">الفنيون</span>
                  <Badge variant="outline">{stats.members.byRole.technicians}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">المساعدون</span>
                  <Badge variant="outline">{stats.members.byRole.assistants}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">إدارة الأعضاء</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{stats.members.total}</div>
                    <p className="text-sm text-muted-foreground">إجمالي الأعضاء</p>
                  </div>
                  <div className="pt-4 border-t">
                    <Button asChild className="w-full">
                      <Link href="/org/members">
                        <Users className="ml-2 h-4 w-4" />
                        إدارة الأعضاء
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">إدارة الأقسام</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{stats.departments.total}</div>
                    <p className="text-sm text-muted-foreground">إجمالي الأقسام</p>
                  </div>
                  <div className="pt-4 border-t">
                    <Button asChild className="w-full">
                      <Link href="/org/departments">
                        <FolderTree className="ml-2 h-4 w-4" />
                        إدارة الأقسام
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

            <TabsContent value="analytics" className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>أداء المهام</CardTitle>
                <CardDescription>إحصائيات تفصيلية عن المهام</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>معدل الإنجاز</span>
                    <span className="font-bold">{Math.round(stats.tasks.completionRate)}%</span>
                  </div>
                  <Progress value={stats.tasks.completionRate} />

                  <div className="grid grid-cols-2 gap-3 md:gap-4 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.tasks.completed}</div>
                      <p className="text-xs text-muted-foreground">مكتملة</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{stats.tasks.overdue}</div>
                      <p className="text-xs text-muted-foreground">متأخرة</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>إحصائيات المؤسسة</CardTitle>
                <CardDescription>الأرقام الأساسية للمؤسسة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>إجمالي الأعضاء</span>
                    <span className="font-bold">{stats.members.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>إجمالي الأقسام</span>
                    <span className="font-bold">{stats.departments.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>إجمالي المهام</span>
                    <span className="font-bold">{stats.tasks.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>المهام المكتملة</span>
                    <span className="font-bold text-green-600">{stats.tasks.completed}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>ملخص الأداء</CardTitle>
              <CardDescription>المؤشرات الرئيسية للمؤسسة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {stats.members.total}
                  </div>
                  <p className="text-sm font-medium">إجمالي الأعضاء</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    عضو في المؤسسة
                  </p>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {Math.round(stats.tasks.completionRate)}%
                  </div>
                  <p className="text-sm font-medium">معدل إنجاز المهام</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.tasks.completed} من أصل {stats.tasks.total} مهمة
                  </p>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {stats.tasks.overdue}
                  </div>
                  <p className="text-sm font-medium">المهام المتأخرة</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    مهمة تحتاج متابعة
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>
      </div>
    </div>
  );
}
