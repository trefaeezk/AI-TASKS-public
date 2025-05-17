'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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
  Loader2
} from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
  generateWeeklyReport,
  type GenerateWeeklyReportInput,
  type GenerateWeeklyReportOutput,
  type Task as TaskInput,
  type TaskSummary
} from '@/services/ai';
import { TaskType, TaskFirestoreData } from '@/types/task';
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WeeklyReportCardProps {
  organizationId?: string;
  departmentId?: string;
  userId?: string;
  className?: string;
}

export function WeeklyReportCard({ organizationId, departmentId, userId, className }: WeeklyReportCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [report, setReport] = useState<GenerateWeeklyReportOutput | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'completed' | 'inProgress' | 'upcoming' | 'blocked'>('summary');
  const [error, setError] = useState<string | null>(null);
  const [reportPeriod, setReportPeriod] = useState<{startDate: Date, endDate: Date}>(() => {
    const now = new Date();
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }); // Sunday
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }); // Saturday
    return { startDate: lastWeekStart, endDate: lastWeekEnd };
  });

  // جلب المهام من Firestore
  useEffect(() => {
    const fetchTasks = async () => {
      if (!user) {
        setIsLoadingTasks(false);
        setError('يجب تسجيل الدخول لعرض التقارير.');
        return;
      }

      setIsLoadingTasks(true);
      setError(null);

      try {
        const tasksColRef = collection(db, 'tasks');
        let q;

        // بناء الاستعلام بناءً على المعلمات المقدمة
        if (organizationId) {
          if (departmentId) {
            // مهام قسم محدد في مؤسسة
            q = query(
              tasksColRef,
              where('organizationId', '==', organizationId),
              where('departmentId', '==', departmentId)
            );
          } else if (userId) {
            // مهام مستخدم محدد في مؤسسة
            q = query(
              tasksColRef,
              where('organizationId', '==', organizationId),
              where('assignedToUserId', '==', userId)
            );
          } else {
            // جميع مهام المؤسسة
            q = query(
              tasksColRef,
              where('organizationId', '==', organizationId)
            );
          }
        } else {
          // مهام المستخدم الشخصية
          q = query(
            tasksColRef,
            where('userId', '==', user.uid),
            where('taskContext', '==', 'individual')
          );
        }

        const querySnapshot = await getDocs(q);
        const fetchedTasks: TaskType[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data() as TaskFirestoreData;

          // تحويل البيانات إلى النوع المطلوب
          const task: TaskType = {
            id: doc.id,
            description: data.description || '',
            details: data.details || undefined,
            status: data.status || 'pending',
            startDate: data.startDate ? data.startDate.toDate() : undefined,
            dueDate: data.dueDate ? data.dueDate.toDate() : undefined,
            completedDate: data.updatedAt && data.status === 'completed' ? data.updatedAt.toDate() : undefined,
            durationValue: data.durationValue || undefined,
            durationUnit: data.durationUnit || undefined,
            priority: data.priority || undefined,
            priorityReason: data.priorityReason || undefined,
            taskCategoryName: data.taskCategoryName || undefined,
            milestones: data.milestones ? data.milestones.map(m => ({
              id: m.id,
              description: m.description,
              completed: m.completed,
              weight: m.weight,
              dueDate: m.dueDate ? m.dueDate.toDate() : undefined,
              assignedToUserId: m.assignedToUserId || undefined
            })) : undefined,
            taskContext: data.taskContext || 'individual',
            organizationId: data.organizationId || undefined,
            departmentId: data.departmentId || undefined,
            assignedToUserId: data.assignedToUserId || undefined,
            parentTaskId: data.parentTaskId || undefined,
          };

          // حساب نسبة التقدم من نقاط التتبع
          if (task.milestones && task.milestones.length > 0) {
            const totalWeight = task.milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
            if (totalWeight > 0) {
              const completedWeight = task.milestones.reduce((sum, m) => sum + (m.completed ? (m.weight || 0) : 0), 0);
              task.progress = Math.round((completedWeight / totalWeight) * 100);
            }
          } else if (task.status === 'completed') {
            task.progress = 100;
          } else {
            task.progress = 0;
          }

          fetchedTasks.push(task);
        });

        setTasks(fetchedTasks);
        setIsLoadingTasks(false);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setError('حدث خطأ أثناء جلب المهام. يرجى المحاولة مرة أخرى.');
        setIsLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [user, organizationId, departmentId, userId]);

  // إنشاء التقرير الأسبوعي
  const handleGenerateReport = async () => {
    if (isGeneratingReport || tasks.length === 0) return;

    setIsGeneratingReport(true);
    setError(null);

    try {
      // تحضير المهام للذكاء الاصطناعي
      const tasksForAI: TaskInput[] = tasks
        .filter(task => {
          // تضمين المهام التي تم إنشاؤها أو تحديثها أو إكمالها خلال فترة التقرير
          // أو المهام التي لها تاريخ استحقاق أو بدء خلال فترة التقرير
          const taskDate = task.completedDate || task.dueDate || task.startDate;
          if (!taskDate) return true; // تضمين المهام بدون تواريخ

          return isWithinInterval(taskDate, {
            start: reportPeriod.startDate,
            end: reportPeriod.endDate
          });
        })
        .map(task => ({
          id: task.id,
          description: task.description,
          details: task.details || '',
          status: task.status,
          priority: task.priority,
          startDate: task.startDate,
          dueDate: task.dueDate,
          completedDate: task.completedDate,
          progress: task.progress || 0,
          departmentId: task.departmentId,
          departmentName: task.departmentId ? 'قسم' : undefined, // يمكن استبداله بالاسم الفعلي إذا كان متاحًا
          assignedToUserId: task.assignedToUserId,
          assignedToUserName: task.assignedToUserId ? 'مستخدم' : undefined, // يمكن استبداله بالاسم الفعلي إذا كان متاحًا
        }));

      // استدعاء تدفق الذكاء الاصطناعي
      const result = await generateWeeklyReport({
        tasks: tasksForAI,
        startDate: reportPeriod.startDate,
        endDate: reportPeriod.endDate,
        departmentId,
        departmentName: departmentId ? 'قسم' : undefined, // يمكن استبداله بالاسم الفعلي
        userId,
        userName: userId ? 'مستخدم' : undefined, // يمكن استبداله بالاسم الفعلي
        organizationId,
        organizationName: organizationId ? 'مؤسسة' : undefined, // يمكن استبداله بالاسم الفعلي
      });

      setReport(result);
      toast({
        title: 'تم إنشاء التقرير الأسبوعي',
        description: 'تم إنشاء التقرير الأسبوعي بنجاح.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      setError('حدث خطأ أثناء إنشاء التقرير. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // تنسيق التاريخ
  const formatDate = (date: Date) => {
    return format(date, 'PPP', { locale: ar });
  };

  // تصدير التقرير كملف PDF
  const handleExportPDF = () => {
    toast({
      title: 'تصدير التقرير',
      description: 'سيتم تنفيذ هذه الميزة قريبًا.',
    });
  };

  // طباعة التقرير
  const handlePrint = () => {
    window.print();
  };

  // مشاركة التقرير
  const handleShare = () => {
    toast({
      title: 'مشاركة التقرير',
      description: 'سيتم تنفيذ هذه الميزة قريبًا.',
    });
  };

  if (isLoadingTasks) {
    return (
      <Card className={cn("shadow-md", className)}>
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <FileText className="ml-2 h-5 w-5 text-primary" />
            التقرير الأسبوعي
          </CardTitle>
          <CardDescription>
            تقرير أسبوعي شامل عن المهام والإنجازات
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("shadow-md", className)}>
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <FileText className="ml-2 h-5 w-5 text-primary" />
            التقرير الأسبوعي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-md", className)}>
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <FileText className="ml-2 h-5 w-5 text-primary" />
          التقرير الأسبوعي
        </CardTitle>
        <CardDescription>
          تقرير أسبوعي شامل عن المهام والإنجازات للفترة من {formatDate(reportPeriod.startDate)} إلى {formatDate(reportPeriod.endDate)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!report ? (
          <div className="text-center py-8">
            <Button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport || tasks.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري إنشاء التقرير...
                </>
              ) : (
                <>
                  <FileText className="ml-2 h-4 w-4" />
                  إنشاء التقرير الأسبوعي
                </>
              )}
            </Button>
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                لا توجد مهام متاحة لإنشاء التقرير.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{report.title}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="ml-1 h-4 w-4" />
                  تصدير
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="ml-1 h-4 w-4" />
                  طباعة
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="ml-1 h-4 w-4" />
                  مشاركة
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
              <TabsList className="grid grid-cols-5 mb-4">
                <TabsTrigger value="summary">الملخص</TabsTrigger>
                <TabsTrigger value="completed">
                  المكتملة ({report?.completedTasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="inProgress">
                  قيد التنفيذ ({report?.inProgressTasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="upcoming">
                  القادمة ({report?.upcomingTasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="blocked">
                  المعلقة ({report?.blockedTasks?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="whitespace-pre-line">{report?.summary || ''}</p>
                </div>

                <h3 className="text-lg font-semibold flex items-center mt-4">
                  <BarChart className="ml-2 h-5 w-5 text-primary" />
                  مؤشرات الأداء الرئيسية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{report?.keyMetrics?.completionRate || 0}%</div>
                        <p className="text-sm text-muted-foreground">نسبة إكمال المهام</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{report?.keyMetrics?.onTimeCompletionRate || 0}%</div>
                        <p className="text-sm text-muted-foreground">نسبة الإكمال في الوقت المحدد</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{report?.keyMetrics?.averageProgress || 0}%</div>
                        <p className="text-sm text-muted-foreground">متوسط التقدم</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <h3 className="text-lg font-semibold mt-4">التوصيات</h3>
                <ul className="space-y-2">
                  {report?.recommendations?.map((recommendation, index) => (
                    <li key={index} className="flex items-start">
                      <span className="ml-2 text-primary">•</span>
                      <span>{recommendation}</span>
                    </li>
                  )) || <li>لا توجد توصيات</li>}
                </ul>
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {!report?.completedTasks?.length ? (
                  <p className="text-center text-muted-foreground py-4">
                    لا توجد مهام مكتملة خلال هذه الفترة.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {report.completedTasks.map((task) => (
                      <TaskSummaryCard key={task.id} task={task} type="completed" />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inProgress" className="space-y-4">
                {!report?.inProgressTasks?.length ? (
                  <p className="text-center text-muted-foreground py-4">
                    لا توجد مهام قيد التنفيذ.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {report.inProgressTasks.map((task) => (
                      <TaskSummaryCard key={task.id} task={task} type="inProgress" />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-4">
                {!report?.upcomingTasks?.length ? (
                  <p className="text-center text-muted-foreground py-4">
                    لا توجد مهام قادمة.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {report.upcomingTasks.map((task) => (
                      <TaskSummaryCard key={task.id} task={task} type="upcoming" />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="blocked" className="space-y-4">
                {!report?.blockedTasks?.length ? (
                  <p className="text-center text-muted-foreground py-4">
                    لا توجد مهام معلقة.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {report.blockedTasks.map((task) => (
                      <TaskSummaryCard key={task.id} task={task} type="blocked" />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// مكون لعرض ملخص المهمة
interface TaskSummaryCardProps {
  task: TaskSummary;
  type: 'completed' | 'inProgress' | 'upcoming' | 'blocked';
}

function TaskSummaryCard({ task, type }: TaskSummaryCardProps) {
  const getStatusIcon = () => {
    switch (type) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'inProgress':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'upcoming':
        return <Calendar className="h-5 w-5 text-orange-500" />;
      case 'blocked':
        return <PauseCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (type) {
      case 'completed':
        return 'مكتملة';
      case 'inProgress':
        return 'قيد التنفيذ';
      case 'upcoming':
        return 'قادمة';
      case 'blocked':
        return 'معلقة';
    }
  };

  return (
    <Card className={cn(
      "border-r-4",
      task.highlight && "bg-muted/20",
      type === 'completed' && "border-r-green-500",
      type === 'inProgress' && "border-r-blue-500",
      type === 'upcoming' && "border-r-orange-500",
      type === 'blocked' && "border-r-gray-500"
    )}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center">
              {getStatusIcon()}
              <span className="mr-2">{task.description}</span>
              {task.highlight && (
                <Badge variant="outline" className="mr-2 bg-primary/10 text-primary border-primary">
                  مهم
                </Badge>
              )}
            </h4>
            <div className="flex items-center text-sm text-muted-foreground">
              <Badge variant="outline" className="ml-2">
                {getStatusText()}
              </Badge>
              <div className="flex items-center ml-4">
                <span className="ml-1">التقدم:</span>
                <span className="font-medium">{task.progress}%</span>
              </div>
            </div>
            {task.comment && (
              <p className="text-sm mt-2">{task.comment}</p>
            )}
          </div>
        </div>
        {type !== 'completed' && (
          <Progress value={task.progress} className="h-1.5 mt-2" />
        )}
      </CardContent>
    </Card>
  );
}
