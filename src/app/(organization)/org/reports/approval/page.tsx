'use client';

/**
 * صفحة تقارير المهام المعلقة والموافقات
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  FileText,
  BarChart3,
  Clock,
  Building,
  Download,
  RefreshCw,
  Calendar,
  Filter
} from 'lucide-react';
import Link from 'next/link';

// استيراد المكونات
import { ApprovalStatsCard } from '@/components/reports/ApprovalStatsCard';
import { ApprovalTimelineChart } from '@/components/reports/ApprovalTimelineChart';
import { PendingTasksTable } from '@/components/reports/PendingTasksTable';
import { DepartmentApprovalStats } from '@/components/reports/DepartmentApprovalStats';
import { ApprovalReportExport } from '@/components/reports/ApprovalReportExport';

// استيراد الخدمات
import {
  getApprovalStats,
  getApprovalTimeline,
  getDepartmentApprovalStats,
  getPendingTasksDetails,
  getUserApprovalActivity,
  type ApprovalStats,
  type ApprovalTimelineData,
  type DepartmentApprovalStats as DepartmentStats,
  type PendingTaskDetails,
  type UserApprovalActivity
} from '@/services/approvalReports';

export default function ApprovalReportsPage() {
  const { user, userClaims } = useAuth();
  const { organizationId, isOrganization, isLoading: isLoadingAccountType } = useAccountType();
  const { toast } = useToast();

  // حالات البيانات
  const [approvalStats, setApprovalStats] = useState<ApprovalStats | null>(null);
  const [timelineData, setTimelineData] = useState<ApprovalTimelineData[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTaskDetails[]>([]);
  const [userActivity, setUserActivity] = useState<UserApprovalActivity[]>([]);

  // حالات التحميل
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // إعدادات التصفية
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [timelinePeriod, setTimelinePeriod] = useState<number>(30);
  const [activeTab, setActiveTab] = useState('overview');

  // التحقق من الصلاحيات
  const canViewReports = userClaims?.isOrgOwner || userClaims?.isOrgAdmin || 
                        userClaims?.isOrgSupervisor || userClaims?.isOrgEngineer;

  // جلب البيانات
  const fetchData = async (showRefreshToast = false) => {
    if (!organizationId || !canViewReports) return;

    try {
      setRefreshing(true);

      const departmentId = selectedDepartment !== 'all' ? selectedDepartment : undefined;

      // جلب البيانات بشكل متوازي
      const [
        statsData,
        timelineResult,
        departmentsData,
        pendingData,
        activityData
      ] = await Promise.all([
        getApprovalStats(organizationId, departmentId),
        getApprovalTimeline(organizationId, timelinePeriod),
        getDepartmentApprovalStats(organizationId),
        getPendingTasksDetails(organizationId, departmentId),
        getUserApprovalActivity(organizationId)
      ]);

      setApprovalStats(statsData);
      setTimelineData(timelineResult);
      setDepartmentStats(departmentsData);
      setPendingTasks(pendingData);
      setUserActivity(activityData);

      if (showRefreshToast) {
        toast({
          title: 'تم تحديث البيانات',
          description: 'تم تحديث تقارير الموافقات بنجاح',
        });
      }
    } catch (error) {
      console.error('Error fetching approval reports data:', error);
      toast({
        title: 'خطأ في جلب البيانات',
        description: 'حدث خطأ أثناء جلب بيانات التقارير',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // تحديث البيانات عند تغيير المرشحات
  useEffect(() => {
    fetchData();
  }, [organizationId, selectedDepartment, timelinePeriod, canViewReports]);

  // معالجة النقر على المهمة
  const handleTaskClick = (taskId: string) => {
    // توجيه إلى صفحة المهام مع تمييز المهمة المحددة
    window.open(`/org/tasks?highlight=${taskId}`, '_blank');
  };

  // معالجة النقر على القسم
  const handleDepartmentClick = (departmentId: string) => {
    setSelectedDepartment(departmentId);
    setActiveTab('pending');
  };

  if (isLoadingAccountType) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isOrganization || !canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">غير مصرح بالوصول</h1>
        <p className="text-muted-foreground mb-4">
          ليس لديك صلاحية لعرض تقارير الموافقات
        </p>
        <Button asChild>
          <Link href="/org">العودة للوحة التحكم</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-4 space-y-4 md:space-y-6">
          {/* رأس الصفحة */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center mb-2">
                <Button variant="ghost" size="sm" asChild className="mr-2">
                  <Link href="/org/kpi">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <h1 className="text-xl md:text-2xl font-bold flex items-center">
                  <FileText className="ml-2 h-5 w-5 md:h-6 md:w-6" />
                  تقارير الموافقات
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                تقارير شاملة للمهام المعلقة للموافقة ونشاط الموافقات
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" disabled>
                <Download className="ml-2 h-4 w-4" />
                تصدير
              </Button>
            </div>
          </div>

          {/* أدوات التصفية */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Filter className="ml-2 h-5 w-5" />
                خيارات التصفية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">القسم</label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأقسام</SelectItem>
                      {departmentStats.map((dept) => (
                        <SelectItem key={dept.departmentId} value={dept.departmentId}>
                          {dept.departmentName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">فترة الخط الزمني</label>
                  <Select value={timelinePeriod.toString()} onValueChange={(value) => setTimelinePeriod(Number(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">آخر 7 أيام</SelectItem>
                      <SelectItem value="30">آخر 30 يوم</SelectItem>
                      <SelectItem value="90">آخر 3 أشهر</SelectItem>
                      <SelectItem value="180">آخر 6 أشهر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Badge variant="outline" className="whitespace-nowrap">
                    {selectedDepartment === 'all' ? 'جميع الأقسام' : 
                     departmentStats.find(d => d.departmentId === selectedDepartment)?.departmentName || 'قسم محدد'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* التبويبات الرئيسية */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center">
                <BarChart3 className="ml-2 h-4 w-4" />
                نظرة عامة
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center">
                <Clock className="ml-2 h-4 w-4" />
                المهام المعلقة
              </TabsTrigger>
              <TabsTrigger value="departments" className="flex items-center">
                <Building className="ml-2 h-4 w-4" />
                الأقسام
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center">
                <Calendar className="ml-2 h-4 w-4" />
                الخط الزمني
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center">
                <Download className="ml-2 h-4 w-4" />
                التصدير
              </TabsTrigger>
            </TabsList>

            {/* تبويب النظرة العامة */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ApprovalStatsCard
                  stats={approvalStats}
                  loading={loading}
                  title="إحصائيات الموافقات العامة"
                />
                <ApprovalTimelineChart
                  data={timelineData.slice(-14)} // آخر 14 يوم للنظرة العامة
                  loading={loading}
                  title="الاتجاه الأخير (14 يوم)"
                  showArea={true}
                />
              </div>
            </TabsContent>

            {/* تبويب المهام المعلقة */}
            <TabsContent value="pending">
              <PendingTasksTable
                tasks={pendingTasks}
                loading={loading}
                onTaskClick={handleTaskClick}
              />
            </TabsContent>

            {/* تبويب الأقسام */}
            <TabsContent value="departments">
              <DepartmentApprovalStats
                departments={departmentStats}
                loading={loading}
                onDepartmentClick={handleDepartmentClick}
              />
            </TabsContent>

            {/* تبويب الخط الزمني */}
            <TabsContent value="timeline">
              <ApprovalTimelineChart
                data={timelineData}
                loading={loading}
                title={`الخط الزمني للموافقات (${timelinePeriod} يوم)`}
                showArea={false}
              />
            </TabsContent>

            {/* تبويب التصدير */}
            <TabsContent value="export">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ApprovalStatsCard
                    stats={approvalStats}
                    loading={loading}
                    title="معاينة البيانات للتصدير"
                  />
                </div>
                <div>
                  <ApprovalReportExport
                    approvalStats={approvalStats}
                    timelineData={timelineData}
                    departmentStats={departmentStats}
                    pendingTasks={pendingTasks}
                    organizationName={userClaims?.organizationName || 'المؤسسة'}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
