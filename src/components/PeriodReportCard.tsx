'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FileText,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  PauseCircle,
  BarChart,
  Download,
  Printer,
  Share2,
  Loader2,
  ListChecks,
  TrendingUp,
  Building,
  CalendarDays,
  CalendarRange
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WeeklyReportCharts } from '@/components/charts/WeeklyReportCharts';
import { WeeklyTrendAnalysis } from '@/components/charts/WeeklyTrendAnalysis';
import { DepartmentAnalysis } from '@/components/charts/DepartmentAnalysis';
import { AdvancedExport } from '@/components/export/AdvancedExport';
import { 
  getPeriodStats, 
  getPeriodComparison, 
  getEnhancedDepartmentPerformance,
  type ReportPeriodType,
  type PeriodStats 
} from '@/services/organizationReports';
import {
  generateWeeklyReport,
  type GenerateWeeklyReportInput,
  type GenerateWeeklyReportOutput,
  type Task as TaskInput,
  type TaskSummary
} from '@/services/ai';

interface PeriodReportCardProps {
  organizationId?: string;
  departmentId?: string;
  userId?: string;
  className?: string;
  defaultPeriodType?: ReportPeriodType;
  reportPeriod?: {
    startDate: Date;
    endDate: Date;
  };
}

export function PeriodReportCard({ 
  organizationId, 
  departmentId, 
  userId, 
  className,
  defaultPeriodType = 'weekly',
  reportPeriod: propReportPeriod 
}: PeriodReportCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // الحالات الأساسية
  const [periodType, setPeriodType] = useState<ReportPeriodType>(defaultPeriodType);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [report, setReport] = useState<GenerateWeeklyReportOutput | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'charts' | 'trends' | 'departments' | 'export'>('summary');
  const [error, setError] = useState<string | null>(null);
  
  // بيانات التحليلات المتقدمة
  const [periodComparison, setPeriodComparison] = useState<any>(null);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const reportElementRef = useRef<HTMLDivElement>(null);

  // حساب فترة التقرير
  const reportPeriod = React.useMemo(() => {
    if (propReportPeriod) return propReportPeriod;

    let start: Date;
    let end: Date;

    switch (periodType) {
      case 'weekly':
        start = startOfWeek(selectedDate, { weekStartsOn: 6 }); // السبت
        end = endOfWeek(selectedDate, { weekStartsOn: 6 });
        break;
      case 'monthly':
        start = startOfMonth(selectedDate);
        end = endOfMonth(selectedDate);
        break;
      case 'yearly':
        start = startOfYear(selectedDate);
        end = endOfYear(selectedDate);
        break;
      default:
        start = startOfWeek(selectedDate, { weekStartsOn: 6 });
        end = endOfWeek(selectedDate, { weekStartsOn: 6 });
    }

    return { startDate: start, endDate: end };
  }, [selectedDate, periodType, propReportPeriod]);

  // تحديث البيانات عند تغيير الفترة
  useEffect(() => {
    const fetchPeriodData = async () => {
      if (!organizationId) return;

      setIsLoadingStats(true);
      setError(null);

      try {
        // جلب إحصائيات الفترة
        const stats = await getPeriodStats(organizationId, selectedDate, periodType);
        setPeriodStats(stats);

        // جلب مقارنة الفترات
        const comparison = await getPeriodComparison(organizationId, selectedDate, periodType);
        setPeriodComparison(comparison);

        // جلب بيانات الأقسام (للأسبوع فقط حالياً)
        if (periodType === 'weekly') {
          const departments = await getEnhancedDepartmentPerformance(organizationId, selectedDate);
          setDepartmentData(departments);
        } else {
          setDepartmentData([]);
        }

      } catch (error) {
        console.error('Error fetching period data:', error);
        setError('حدث خطأ أثناء جلب بيانات التقرير');
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchPeriodData();
  }, [organizationId, selectedDate, periodType]);

  // دالة تنسيق التاريخ
  const formatDate = (date: Date): string => {
    return format(date, 'dd/MM/yyyy', { locale: ar });
  };

  // دالة الحصول على عنوان الفترة
  const getPeriodTitle = (): string => {
    switch (periodType) {
      case 'weekly':
        return `التقرير الأسبوعي - ${formatDate(reportPeriod.startDate)} إلى ${formatDate(reportPeriod.endDate)}`;
      case 'monthly':
        return `التقرير الشهري - ${format(selectedDate, 'MMMM yyyy', { locale: ar })}`;
      case 'yearly':
        return `التقرير السنوي - ${format(selectedDate, 'yyyy', { locale: ar })}`;
      default:
        return 'التقرير';
    }
  };

  // دالة الحصول على أيقونة الفترة
  const getPeriodIcon = () => {
    switch (periodType) {
      case 'weekly':
        return <CalendarDays className="h-5 w-5" />;
      case 'monthly':
        return <Calendar className="h-5 w-5" />;
      case 'yearly':
        return <CalendarRange className="h-5 w-5" />;
      default:
        return <Calendar className="h-5 w-5" />;
    }
  };

  // دالة إنشاء التقرير بالذكاء الاصطناعي
  const handleGenerateReport = async () => {
    if (!periodStats || isGeneratingReport) return;

    setIsGeneratingReport(true);
    setError(null);

    try {
      // تحضير البيانات للذكاء الاصطناعي
      const tasksForAI: TaskInput[] = []; // يمكن تطويرها لاحقاً

      const result = await generateWeeklyReport({
        tasks: tasksForAI,
        startDate: reportPeriod.startDate,
        endDate: reportPeriod.endDate,
        departmentId,
        userId,
        organizationId,
      });

      setReport(result);
      
      toast({
        title: "تم إنشاء التقرير بنجاح",
        description: `تم إنشاء ${getPeriodTitle()} بنجاح`,
      });

    } catch (error) {
      console.error('Error generating report:', error);
      setError('حدث خطأ أثناء إنشاء التقرير');
      toast({
        title: "خطأ في إنشاء التقرير",
        description: "حدث خطأ أثناء إنشاء التقرير. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>تسجيل الدخول مطلوب</AlertTitle>
        <AlertDescription>
          يجب تسجيل الدخول لعرض التقارير.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn("shadow-md", className)} ref={reportElementRef}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getPeriodIcon()}
            <div>
              <CardTitle className="text-xl">{getPeriodTitle()}</CardTitle>
              <CardDescription>
                تقرير شامل للأداء والإنتاجية
              </CardDescription>
            </div>
          </div>
          
          {/* اختيار نوع الفترة */}
          <div className="flex items-center space-x-2">
            <Select value={periodType} onValueChange={(value: ReportPeriodType) => setPeriodType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">أسبوعي</SelectItem>
                <SelectItem value="monthly">شهري</SelectItem>
                <SelectItem value="yearly">سنوي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoadingStats ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : periodStats ? (
          <>
            {/* مؤشرات الأداء السريعة */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {periodStats.tasksCompleted}
                    </div>
                    <p className="text-sm text-muted-foreground">مهام مكتملة</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {periodStats.tasksTotal}
                    </div>
                    <p className="text-sm text-muted-foreground">إجمالي المهام</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {periodStats.hoursWorked}
                    </div>
                    <p className="text-sm text-muted-foreground">ساعات العمل</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {periodStats.tasksTotal > 0 ? Math.round((periodStats.tasksCompleted / periodStats.tasksTotal) * 100) : 0}%
                    </div>
                    <p className="text-sm text-muted-foreground">نسبة الإكمال</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* التبويبات */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
              <TabsList className="grid grid-cols-5 mb-4">
                <TabsTrigger value="summary">الملخص</TabsTrigger>
                <TabsTrigger value="charts">
                  <BarChart className="ml-1 h-4 w-4" />
                  الرسوم البيانية
                </TabsTrigger>
                <TabsTrigger value="trends">
                  <TrendingUp className="ml-1 h-4 w-4" />
                  الاتجاهات
                </TabsTrigger>
                {periodType === 'weekly' && (
                  <TabsTrigger value="departments">
                    <Building className="ml-1 h-4 w-4" />
                    الأقسام
                  </TabsTrigger>
                )}
                <TabsTrigger value="export">
                  <Download className="ml-1 h-4 w-4" />
                  تصدير
                </TabsTrigger>
              </TabsList>

              {/* محتوى التبويبات */}
              <TabsContent value="summary" className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">ملخص {periodType === 'weekly' ? 'الأسبوع' : periodType === 'monthly' ? 'الشهر' : 'السنة'}</h3>
                  <p className="text-right leading-7">
                    خلال الفترة من {formatDate(reportPeriod.startDate)} إلى {formatDate(reportPeriod.endDate)}، 
                    تم إكمال {periodStats.tasksCompleted} مهام من أصل {periodStats.tasksTotal} مهام، 
                    بنسبة إكمال {periodStats.tasksTotal > 0 ? Math.round((periodStats.tasksCompleted / periodStats.tasksTotal) * 100) : 0}%.
                    تم العمل لمدة {periodStats.hoursWorked} ساعة من أصل {periodStats.hoursPlanned} ساعة مخططة.
                  </p>
                </div>

                <div className="text-center">
                  <Button 
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isGeneratingReport ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جاري إنشاء التقرير المفصل...
                      </>
                    ) : (
                      <>
                        <FileText className="ml-2 h-4 w-4" />
                        إنشاء تقرير مفصل بالذكاء الاصطناعي
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="charts" className="space-y-4">
                {report ? (
                  <WeeklyReportCharts
                    completedTasks={report.completedTasks}
                    inProgressTasks={report.inProgressTasks}
                    upcomingTasks={report.upcomingTasks}
                    blockedTasks={report.blockedTasks}
                    overdueTasks={report.overdueTasks}
                    keyMetrics={report.keyMetrics}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">يرجى إنشاء التقرير المفصل أولاً لعرض الرسوم البيانية</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                {periodComparison ? (
                  <WeeklyTrendAnalysis comparison={{
                    currentWeek: {
                      completionRate: periodComparison.current.tasksTotal > 0 ? 
                        (periodComparison.current.tasksCompleted / periodComparison.current.tasksTotal) * 100 : 0,
                      onTimeRate: 85, // يمكن تحسينها
                      efficiency: periodComparison.current.hoursPlanned > 0 ? 
                        (periodComparison.current.hoursWorked / periodComparison.current.hoursPlanned) * 100 : 0,
                      tasksCompleted: periodComparison.current.tasksCompleted,
                      totalTasks: periodComparison.current.tasksTotal
                    },
                    previousWeek: {
                      completionRate: periodComparison.previous.tasksTotal > 0 ? 
                        (periodComparison.previous.tasksCompleted / periodComparison.previous.tasksTotal) * 100 : 0,
                      onTimeRate: 85,
                      efficiency: periodComparison.previous.hoursPlanned > 0 ? 
                        (periodComparison.previous.hoursWorked / periodComparison.previous.hoursPlanned) * 100 : 0,
                      tasksCompleted: periodComparison.previous.tasksCompleted,
                      totalTasks: periodComparison.previous.tasksTotal
                    }
                  }} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">جاري تحميل بيانات المقارنة...</p>
                  </div>
                )}
              </TabsContent>

              {periodType === 'weekly' && (
                <TabsContent value="departments" className="space-y-4">
                  {departmentData.length > 0 ? (
                    <DepartmentAnalysis departments={departmentData} />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">لا توجد بيانات أقسام متاحة</p>
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="export" className="space-y-4">
                <AdvancedExport
                  data={{
                    title: getPeriodTitle(),
                    summary: `ملخص ${periodType === 'weekly' ? 'الأسبوع' : periodType === 'monthly' ? 'الشهر' : 'السنة'}`,
                    completedTasks: report?.completedTasks || [],
                    inProgressTasks: report?.inProgressTasks || [],
                    upcomingTasks: report?.upcomingTasks || [],
                    blockedTasks: report?.blockedTasks || [],
                    keyMetrics: report?.keyMetrics || {
                      completionRate: periodStats.tasksTotal > 0 ? 
                        (periodStats.tasksCompleted / periodStats.tasksTotal) * 100 : 0,
                      onTimeCompletionRate: 85,
                      averageProgress: 75
                    },
                    recommendations: report?.recommendations || [],
                    departmentData: departmentData
                  }}
                  reportElement={reportElementRef}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">لا توجد بيانات متاحة للفترة المحددة</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
