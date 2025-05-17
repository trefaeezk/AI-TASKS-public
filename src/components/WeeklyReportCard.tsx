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
  Loader2,
  ListChecks
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
import { format, startOfWeek, endOfWeek, subWeeks, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TaskCardTemp } from '@/components/TaskCardTemp';

interface WeeklyReportCardProps {
  organizationId?: string;
  departmentId?: string;
  userId?: string;
  className?: string;
  reportPeriod?: {
    startDate: Date;
    endDate: Date;
  };
}

export function WeeklyReportCard({ organizationId, departmentId, userId, className, reportPeriod: propReportPeriod }: WeeklyReportCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [report, setReport] = useState<GenerateWeeklyReportOutput | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'completed' | 'inProgress' | 'upcoming' | 'blocked' | 'analysis' | 'planning' | 'today' | 'overdue' | 'scheduled'>('summary');
  const [error, setError] = useState<string | null>(null);
  // متغير لتتبع ما إذا تم توليد التقرير بالفعل
  const [reportGenerated, setReportGenerated] = useState(false);

  // دالة لحساب نسبة إكمال المهام في حالة عدم توفرها من الخدمة
  const calculateCompletionRate = (report: GenerateWeeklyReportOutput | null): number => {
    if (!report) return 0;

    const totalTasks = (report.completedTasks?.length || 0) +
                       (report.inProgressTasks?.length || 0) +
                       (report.upcomingTasks?.length || 0) +
                       (report.blockedTasks?.length || 0);

    if (totalTasks === 0) return 0;

    return Math.round((report.completedTasks?.length || 0) / totalTasks * 100);
  };

  // دالة لحساب نسبة الإكمال في الوقت المحدد
  const calculateOnTimeCompletionRate = (tasks: TaskType[]): number => {
    // تصفية المهام المكتملة فقط
    const completedTasks = tasks.filter(task => task.status === 'completed' && task.completedDate);

    if (completedTasks.length === 0) return 0;

    // حساب عدد المهام المكتملة في الوقت المحدد
    const onTimeTasks = completedTasks.filter(task => {
      // إذا لم يكن هناك تاريخ استحقاق، نعتبرها مكتملة في الوقت المحدد
      if (!task.dueDate) return true;

      // مقارنة تاريخ الإكمال بتاريخ الاستحقاق
      return task.completedDate && task.completedDate <= task.dueDate;
    });

    // إذا لم تكن هناك مهام مكتملة، نعيد 0 لتجنب قسمة على صفر
    if (completedTasks.length === 0) return 0;

    // إذا كانت هناك مهمة واحدة على الأقل، نعيد نسبة مئوية
    // نضمن أن تكون النتيجة على الأقل 1 إذا كانت هناك مهمة واحدة مكتملة في الوقت المحدد
    return Math.max(1, Math.round((onTimeTasks.length / completedTasks.length) * 100));
  };

  // دالة لحساب متوسط التقدم في حالة عدم توفره من الخدمة
  const calculateAverageProgress = (report: GenerateWeeklyReportOutput | null): number => {
    if (!report) return 0;

    let totalProgress = 0;
    let taskCount = 0;

    // جمع التقدم من جميع المهام
    if (report.completedTasks) {
      report.completedTasks.forEach(task => {
        // المهام المكتملة دائمًا تكون بنسبة 100%
        totalProgress += 100;
        taskCount++;
      });
    }

    if (report.inProgressTasks) {
      report.inProgressTasks.forEach(task => {
        totalProgress += task.progress || 50; // إذا لم يكن هناك تقدم محدد، نفترض 50%
        taskCount++;
      });
    }

    if (report.upcomingTasks) {
      report.upcomingTasks.forEach(task => {
        totalProgress += task.progress || 0; // المهام القادمة عادة تكون بنسبة 0%
        taskCount++;
      });
    }

    if (report.blockedTasks) {
      report.blockedTasks.forEach(task => {
        totalProgress += task.progress || 0; // المهام المعلقة عادة تكون بنسبة 0%
        taskCount++;
      });
    }

    if (taskCount === 0) return 0;

    // نضمن أن تكون النتيجة على الأقل 1 إذا كانت هناك مهمة واحدة
    return Math.max(1, Math.round(totalProgress / taskCount));
  };

  // دالة لإنشاء توصيات افتراضية بناءً على بيانات التقرير
  const generateDefaultRecommendations = (report: GenerateWeeklyReportOutput, tasks: TaskInput[]): string[] => {
    const recommendations: string[] = [];

    // حساب نسبة الإكمال
    const completionRate = calculateCompletionRate(report);

    // حساب نسبة الإكمال في الوقت المحدد
    const onTimeCompletionRate = calculateOnTimeCompletionRate(tasks as any);

    // إضافة توصيات بناءً على نسبة الإكمال
    if (completionRate < 50) {
      recommendations.push('مراجعة سير العمل ومعالجة أسباب التأخير في إكمال المهام.');
    }

    // إضافة توصيات بناءً على نسبة الإكمال في الوقت المحدد
    if (onTimeCompletionRate < 70) {
      recommendations.push('تحسين إدارة الوقت والالتزام بالمواعيد النهائية للمهام.');
    }

    // إضافة توصيات بناءً على المهام المعلقة
    if (report.blockedTasks && report.blockedTasks.length > 0) {
      recommendations.push('التركيز على حل المشاكل التي تعيق المهام المعلقة.');
    }

    // إضافة توصيات بناءً على المهام القادمة
    if (report.upcomingTasks && report.upcomingTasks.length > 0) {
      recommendations.push('التخطيط المسبق للمهام القادمة لضمان إكمالها في الوقت المحدد.');
    }

    // إضافة توصية إيجابية إذا كان الأداء جيدًا
    if (completionRate >= 70 && onTimeCompletionRate >= 70 && (!report.blockedTasks || report.blockedTasks.length === 0)) {
      recommendations.push('الاستمرار في الأداء الجيد والحفاظ على مستوى الإنتاجية الحالي.');
    }

    // إذا لم يتم إضافة أي توصيات، إضافة توصية افتراضية
    if (recommendations.length === 0) {
      recommendations.push('مراجعة خطة العمل وتحديد أولويات المهام لتحسين الإنتاجية.');
    }

    return recommendations;
  };
  const [reportPeriod, setReportPeriod] = useState<{startDate: Date, endDate: Date}>(() => {
    // استخدام فترة التقرير المُمررة إذا كانت متوفرة، وإلا استخدام الأسبوع الحالي كافتراضي
    if (propReportPeriod) {
      return propReportPeriod;
    }

    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
    return { startDate: currentWeekStart, endDate: currentWeekEnd };
  });

  // تحديث فترة التقرير عند تغيير الفترة المُمررة
  useEffect(() => {
    if (propReportPeriod) {
      setReportPeriod(propReportPeriod);
      // إعادة تعيين التقرير عند تغيير الفترة
      setReport(null);
    }
  }, [propReportPeriod]);

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
  const handleGenerateReport = async (isAutoGenerate = false) => {
    // إذا كان التوليد تلقائيًا وتم توليد التقرير بالفعل، نتخطى العملية
    if (isAutoGenerate && reportGenerated) {
      console.log("تخطي التوليد التلقائي: تم توليد التقرير بالفعل.");
      return;
    }

    if (isGeneratingReport || tasks.length === 0) return;

    setIsGeneratingReport(true);
    setError(null);

    try {
      // تحضير المهام للذكاء الاصطناعي
      const tasksForAI: TaskInput[] = tasks
        .filter(task => {
          // تضمين المهام المكتملة خلال فترة التقرير
          if (task.status === 'completed' && task.completedDate) {
            return isWithinInterval(task.completedDate, {
              start: reportPeriod.startDate,
              end: reportPeriod.endDate
            });
          }

          // تضمين جميع المهام قيد التنفيذ بغض النظر عن تاريخ البدء
          if (task.status === 'in-progress' as any) {
            return true;
          }

          // تضمين المهام القادمة التي لها تاريخ استحقاق خلال أو بعد فترة التقرير
          if (task.status === 'pending' && task.dueDate) {
            return (
              isAfter(task.dueDate, reportPeriod.startDate) ||
              isWithinInterval(task.dueDate, {
                start: reportPeriod.startDate,
                end: reportPeriod.endDate
              })
            );
          }

          // تضمين المهام المعلقة بغض النظر عن التاريخ
          if (task.status === 'blocked' as any || task.status === 'hold') {
            return true;
          }

          // تضمين المهام بدون تواريخ
          if (!task.completedDate && !task.dueDate && !task.startDate) {
            return true;
          }

          // تضمين المهام التي لها تاريخ استحقاق أو بدء خلال فترة التقرير
          return (
            (task.dueDate && isWithinInterval(task.dueDate, {
              start: reportPeriod.startDate,
              end: reportPeriod.endDate
            })) ||
            (task.startDate && isWithinInterval(task.startDate, {
              start: reportPeriod.startDate,
              end: reportPeriod.endDate
            }))
          );
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

      // معالجة إضافية للتقرير بعد استلامه من الخدمة
      // تحديد المهام المعلقة والمهام قيد التنفيذ من قائمة المهام الأصلية
      const blockedTasks = tasks.filter(task => task.status === 'blocked' as any || task.status === 'hold');
      const inProgressTasks = tasks.filter(task => task.status === 'in-progress' as any);

      // استخدام المهام المتأخرة من الخدمة الخلفية أو إنشاؤها من المهام الأصلية
      const overdueTasks = result.overdueTasks || tasks.filter(task =>
        (task.status === 'pending' || task.status === 'in-progress' as any) &&
        task.dueDate &&
        task.dueDate < new Date()
      ).map(task => ({
        id: task.id,
        title: task.title || task.description,
        description: task.description,
        status: task.status,
        progress: task.progress || 0,
        priority: task.priority,
        dueDate: task.dueDate ? format(task.dueDate, 'yyyy-MM-dd') : undefined,
        comment: task.details || '',
        notes: task.details || ''
      }));

      const processedReport = {
        ...result,
        // التأكد من وجود جميع المصفوفات المطلوبة
        completedTasks: result.completedTasks || [],
        // استخدام المهام المتأخرة المعالجة
        overdueTasks: overdueTasks,
        upcomingTasks: result.upcomingTasks || [],
        // إضافة المهام قيد التنفيذ من المهام الأصلية إذا لم تكن موجودة في النتيجة
        inProgressTasks: result.inProgressTasks || inProgressTasks.map(task => ({
          id: task.id,
          title: task.title || task.description,
          description: task.description,
          status: task.status,
          progress: task.progress || 50,
          priority: task.priority,
          dueDate: task.dueDate ? format(task.dueDate, 'yyyy-MM-dd') : undefined,
          comment: task.details || '',
          notes: task.details || ''
        })),
        // إضافة المهام المعلقة من المهام الأصلية
        blockedTasks: blockedTasks.map(task => ({
          id: task.id,
          title: task.title || task.description,
          description: task.description,
          status: task.status,
          progress: task.progress || 0,
          priority: task.priority,
          dueDate: task.dueDate ? format(task.dueDate, 'yyyy-MM-dd') : undefined,
          comment: task.details || '',
          notes: task.details || ''
        })),
        // التأكد من وجود مؤشرات الأداء
        keyMetrics: {
          // استخدام معدل الإكمال من stats إذا كان متوفرًا
          completionRate: result.stats?.completionRate !== undefined
            ? Math.max(1, Math.round(result.stats.completionRate))
            : result.keyMetrics?.completionRate !== undefined
              ? Math.max(1, Math.round(result.keyMetrics.completionRate))
              : Math.max(1, calculateCompletionRate(result)),
          onTimeCompletionRate: result.keyMetrics?.onTimeCompletionRate !== undefined
            ? Math.max(1, Math.round(result.keyMetrics.onTimeCompletionRate))
            : Math.max(1, calculateOnTimeCompletionRate(tasks)), // استخدام الدالة الجديدة مع المهام الأصلية
          averageProgress: result.keyMetrics?.averageProgress !== undefined
            ? Math.max(1, Math.round(result.keyMetrics.averageProgress))
            : Math.max(1, calculateAverageProgress(result))
        },
        // تنسيق الملخص إذا كان موجودًا
        summary: result.summary
          ? result.summary.replace(/\s+/g, ' ').trim() // إزالة المسافات الزائدة
          : undefined,
        // التأكد من وجود التوصيات - استخدام الملاحظات من الخدمة الخلفية إذا كانت متوفرة
        recommendations: result.recommendations && result.recommendations.length > 0
          ? result.recommendations
          : result.observations && result.observations.length > 0
            ? result.observations
            : generateDefaultRecommendations(result, tasksForAI), // إنشاء توصيات افتراضية
        // تحديث فترة التقرير لتتوافق مع الفترة المحددة
        period: `${formatDate(reportPeriod.startDate)} إلى ${formatDate(reportPeriod.endDate)}`
      };

      setReport(processedReport);
      setReportGenerated(true); // تعيين علامة أنه تم توليد التقرير

      // إظهار رسالة نجاح فقط إذا كان التوليد يدويًا (وليس تلقائيًا)
      if (!isAutoGenerate) {
        toast({
          title: 'تم إنشاء التقرير الأسبوعي',
          description: 'تم إنشاء التقرير الأسبوعي بنجاح.',
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setError('حدث خطأ أثناء إنشاء التقرير. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // توليد التقرير تلقائيًا بعد تحميل المهام
  useEffect(() => {
    // إذا انتهى تحميل المهام ولم يتم توليد التقرير بعد
    if (!isLoadingTasks && !isGeneratingReport && !reportGenerated && tasks.length > 0) {
      console.log("توليد التقرير الأسبوعي تلقائيًا...");
      // توليد التقرير فورًا بدون تأخير
      handleGenerateReport(true); // تمرير علامة تشير إلى أن التوليد تلقائي
    } else if (!isLoadingTasks && !reportGenerated && tasks.length === 0) {
      // إذا لم تكن هناك مهام، تعيين رسالة خطأ
      setError('لا توجد مهام لإنشاء تقرير أسبوعي.');
      setReportGenerated(true); // تعيين العلامة لتجنب محاولات التوليد المتكررة
    }
  }, [isLoadingTasks, tasks, isGeneratingReport, reportGenerated]);

  // تنسيق التاريخ بشكل موحد (dd-MM-yyyy)
  const formatDate = (date: Date) => {
    // استخدام تنسيق موحد للتاريخ في جميع أنحاء التطبيق
    return format(date, 'dd-MM-yyyy', { locale: ar });
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
        <CardContent className="space-y-4 pt-6">
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
        <CardContent className="pt-6">
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
      <CardContent className="space-y-6 pt-6">
        {!report ? (
          <div className="text-center py-8">
            <Button
              onClick={() => handleGenerateReport(false)}
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
              <h2 className="text-xl font-bold">
                {report.title || `التقرير الأسبوعي للفترة من ${formatDate(reportPeriod.startDate)} إلى ${formatDate(reportPeriod.endDate)}`}
              </h2>
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
              <TabsList className="grid grid-cols-7 mb-4">
                <TabsTrigger value="summary">الملخص</TabsTrigger>
                <TabsTrigger value="analysis">
                  <BarChart className="ml-1 h-4 w-4" />
                  التحليل
                </TabsTrigger>
                <TabsTrigger value="planning">
                  <ListChecks className="ml-1 h-4 w-4" />
                  التخطيط
                </TabsTrigger>
                <TabsTrigger value="completed">
                  مكتملة ({report?.completedTasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="inProgress">
                  قيد الانتظار ({report?.inProgressTasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="upcoming">
                  قادمة ({report?.upcomingTasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="overdue">
                  فائتة ({report?.overdueTasks?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analysis" className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">تحليل الأداء الأسبوعي</h3>
                  <p className="text-right leading-7 mb-4">
                    يقدم هذا التحليل نظرة متعمقة على أدائك خلال الأسبوع، مع تسليط الضوء على الاتجاهات والأنماط التي يمكن أن تساعدك في تحسين إنتاجيتك.
                  </p>
                </div>

                {/* تحليل توزيع المهام حسب الحالة */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">توزيع المهام حسب الحالة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {/* المهام المكتملة */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">المكتملة</span>
                            <span className="font-medium">{report?.completedTasks?.length || 0} ({Math.round(((report?.completedTasks?.length || 0) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)}%)</span>
                          </div>
                          <Progress value={Math.round(((report?.completedTasks?.length || 0) / (
                            (report?.completedTasks?.length || 0) +
                            (report?.inProgressTasks?.length || 0) +
                            (report?.upcomingTasks?.length || 0) +
                            (report?.blockedTasks?.length || 0)
                          ) * 100) || 0)} className="h-2 bg-muted" />
                        </div>
                        {/* المهام قيد التنفيذ */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">قيد التنفيذ</span>
                            <span className="font-medium">{report?.inProgressTasks?.length || 0} ({Math.round(((report?.inProgressTasks?.length || 0) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)}%)</span>
                          </div>
                          <Progress value={Math.round(((report?.inProgressTasks?.length || 0) / (
                            (report?.completedTasks?.length || 0) +
                            (report?.inProgressTasks?.length || 0) +
                            (report?.upcomingTasks?.length || 0) +
                            (report?.blockedTasks?.length || 0)
                          ) * 100) || 0)} className="h-2 bg-blue-100" />
                        </div>
                        {/* المهام القادمة */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">القادمة</span>
                            <span className="font-medium">{report?.upcomingTasks?.length || 0} ({Math.round(((report?.upcomingTasks?.length || 0) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)}%)</span>
                          </div>
                          <Progress value={Math.round(((report?.upcomingTasks?.length || 0) / (
                            (report?.completedTasks?.length || 0) +
                            (report?.inProgressTasks?.length || 0) +
                            (report?.upcomingTasks?.length || 0) +
                            (report?.blockedTasks?.length || 0)
                          ) * 100) || 0)} className="h-2 bg-orange-100" />
                        </div>
                        {/* المهام المعلقة */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">المعلقة</span>
                            <span className="font-medium">{report?.blockedTasks?.length || 0} ({Math.round(((report?.blockedTasks?.length || 0) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)}%)</span>
                          </div>
                          <Progress value={Math.round(((report?.blockedTasks?.length || 0) / (
                            (report?.completedTasks?.length || 0) +
                            (report?.inProgressTasks?.length || 0) +
                            (report?.upcomingTasks?.length || 0) +
                            (report?.blockedTasks?.length || 0)
                          ) * 100) || 0)} className="h-2 bg-gray-100" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* تحليل توزيع المهام حسب الأولوية */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">توزيع المهام حسب الأولوية</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {/* أولوية عالية */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">أولوية عالية</span>
                            <span className="font-medium">{
                              (report?.completedTasks?.filter(t => t.priority === 'high').length || 0) +
                              (report?.inProgressTasks?.filter(t => t.priority === 'high').length || 0) +
                              (report?.upcomingTasks?.filter(t => t.priority === 'high').length || 0) +
                              (report?.blockedTasks?.filter(t => t.priority === 'high').length || 0)
                            }</span>
                          </div>
                          <Progress value={Math.round((
                            ((report?.completedTasks?.filter(t => t.priority === 'high').length || 0) +
                            (report?.inProgressTasks?.filter(t => t.priority === 'high').length || 0) +
                            (report?.upcomingTasks?.filter(t => t.priority === 'high').length || 0) +
                            (report?.blockedTasks?.filter(t => t.priority === 'high').length || 0)) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)} className="h-2 bg-red-100" />
                        </div>
                        {/* أولوية متوسطة */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">أولوية متوسطة</span>
                            <span className="font-medium">{
                              (report?.completedTasks?.filter(t => t.priority === 'medium').length || 0) +
                              (report?.inProgressTasks?.filter(t => t.priority === 'medium').length || 0) +
                              (report?.upcomingTasks?.filter(t => t.priority === 'medium').length || 0) +
                              (report?.blockedTasks?.filter(t => t.priority === 'medium').length || 0)
                            }</span>
                          </div>
                          <Progress value={Math.round((
                            ((report?.completedTasks?.filter(t => t.priority === 'medium').length || 0) +
                            (report?.inProgressTasks?.filter(t => t.priority === 'medium').length || 0) +
                            (report?.upcomingTasks?.filter(t => t.priority === 'medium').length || 0) +
                            (report?.blockedTasks?.filter(t => t.priority === 'medium').length || 0)) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)} className="h-2 bg-yellow-100" />
                        </div>
                        {/* أولوية منخفضة */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">أولوية منخفضة</span>
                            <span className="font-medium">{
                              (report?.completedTasks?.filter(t => t.priority === 'low').length || 0) +
                              (report?.inProgressTasks?.filter(t => t.priority === 'low').length || 0) +
                              (report?.upcomingTasks?.filter(t => t.priority === 'low').length || 0) +
                              (report?.blockedTasks?.filter(t => t.priority === 'low').length || 0)
                            }</span>
                          </div>
                          <Progress value={Math.round((
                            ((report?.completedTasks?.filter(t => t.priority === 'low').length || 0) +
                            (report?.inProgressTasks?.filter(t => t.priority === 'low').length || 0) +
                            (report?.upcomingTasks?.filter(t => t.priority === 'low').length || 0) +
                            (report?.blockedTasks?.filter(t => t.priority === 'low').length || 0)) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)} className="h-2 bg-green-100" />
                        </div>
                        {/* بدون أولوية */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">بدون أولوية</span>
                            <span className="font-medium">{
                              (report?.completedTasks?.filter(t => !t.priority).length || 0) +
                              (report?.inProgressTasks?.filter(t => !t.priority).length || 0) +
                              (report?.upcomingTasks?.filter(t => !t.priority).length || 0) +
                              (report?.blockedTasks?.filter(t => !t.priority).length || 0)
                            }</span>
                          </div>
                          <Progress value={Math.round((
                            ((report?.completedTasks?.filter(t => !t.priority).length || 0) +
                            (report?.inProgressTasks?.filter(t => !t.priority).length || 0) +
                            (report?.upcomingTasks?.filter(t => !t.priority).length || 0) +
                            (report?.blockedTasks?.filter(t => !t.priority).length || 0)) / (
                              (report?.completedTasks?.length || 0) +
                              (report?.inProgressTasks?.length || 0) +
                              (report?.upcomingTasks?.length || 0) +
                              (report?.blockedTasks?.length || 0)
                            ) * 100) || 0)} className="h-2 bg-gray-100" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* تحليل الاتجاهات والأنماط */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>تحليل الاتجاهات والأنماط</CardTitle>
                    <CardDescription>
                      تحليل لأنماط العمل والإنتاجية خلال الأسبوع
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* نقاط القوة */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center">
                          <span className="inline-block w-3 h-3 rounded-full bg-green-500 ml-2"></span>
                          نقاط القوة
                        </h4>
                        <ul className="space-y-1 text-sm pr-5">
                          {report?.completedTasks?.length ? (
                            <li className="list-disc">
                              أكملت {report.completedTasks.length} مهام خلال هذا الأسبوع، مما يدل على مستوى جيد من الإنتاجية.
                            </li>
                          ) : null}
                          {report?.keyMetrics?.onTimeCompletionRate && report.keyMetrics.onTimeCompletionRate > 70 ? (
                            <li className="list-disc">
                              معدل الإكمال في الوقت المحدد ({report.keyMetrics.onTimeCompletionRate}%) مرتفع، مما يدل على إدارة جيدة للوقت.
                            </li>
                          ) : null}
                          {report?.inProgressTasks?.length ? (
                            <li className="list-disc">
                              لديك {report.inProgressTasks.length} مهام قيد التنفيذ، مما يدل على استمرارية العمل.
                            </li>
                          ) : null}
                          {!report?.blockedTasks?.length ? (
                            <li className="list-disc">
                              لا توجد مهام معلقة، مما يدل على قدرتك على تجاوز العقبات بفعالية.
                            </li>
                          ) : null}
                        </ul>
                      </div>

                      {/* مجالات التحسين */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center">
                          <span className="inline-block w-3 h-3 rounded-full bg-amber-500 ml-2"></span>
                          مجالات التحسين
                        </h4>
                        <ul className="space-y-1 text-sm pr-5">
                          {report?.keyMetrics?.completionRate && report.keyMetrics.completionRate < 50 ? (
                            <li className="list-disc">
                              معدل إكمال المهام ({report.keyMetrics.completionRate}%) منخفض، يمكن تحسينه من خلال تقسيم المهام الكبيرة إلى مهام أصغر.
                            </li>
                          ) : null}
                          {report?.keyMetrics?.onTimeCompletionRate && report.keyMetrics.onTimeCompletionRate < 50 ? (
                            <li className="list-disc">
                              معدل الإكمال في الوقت المحدد ({report.keyMetrics.onTimeCompletionRate}%) منخفض، يمكن تحسينه من خلال تحديد مواعيد نهائية أكثر واقعية.
                            </li>
                          ) : null}
                          {report?.blockedTasks?.length ? (
                            <li className="list-disc">
                              لديك {report.blockedTasks.length} مهام معلقة، يجب التركيز على حل المشاكل التي تعيقها.
                            </li>
                          ) : null}
                          {report?.inProgressTasks?.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length ? (
                            <li className="list-disc">
                              لديك {report.inProgressTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length} مهام متأخرة قيد التنفيذ، يجب إعطاؤها الأولوية.
                            </li>
                          ) : null}
                        </ul>
                      </div>

                      {/* الاتجاهات */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center">
                          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 ml-2"></span>
                          الاتجاهات الملحوظة
                        </h4>
                        <ul className="space-y-1 text-sm pr-5">
                          {report?.completedTasks?.length && report?.inProgressTasks?.length ? (
                            <li className="list-disc">
                              نسبة المهام المكتملة إلى المهام قيد التنفيذ هي {Math.round((report.completedTasks.length / report.inProgressTasks.length) * 100) / 100}،
                              {report.completedTasks.length > report.inProgressTasks.length ? ' مما يدل على تركيز جيد على إكمال المهام.' : ' مما يشير إلى الحاجة للتركيز أكثر على إكمال المهام الحالية قبل البدء بمهام جديدة.'}
                            </li>
                          ) : null}
                          {report?.completedTasks?.filter(t => t.priority === 'high').length ? (
                            <li className="list-disc">
                              أكملت {report.completedTasks.filter(t => t.priority === 'high').length} مهام ذات أولوية عالية،
                              {report.completedTasks.filter(t => t.priority === 'high').length > (report.completedTasks.filter(t => t.priority === 'medium').length || 0) ? ' مما يدل على تركيز جيد على المهام المهمة.' : ' ولكن يجب التركيز أكثر على المهام ذات الأولوية العالية.'}
                            </li>
                          ) : null}
                          {report?.upcomingTasks?.length ? (
                            <li className="list-disc">
                              لديك {report.upcomingTasks.length} مهام قادمة،
                              {report.upcomingTasks.length > 5 ? ' مما قد يشير إلى ضغط عمل كبير في المستقبل القريب. يُنصح بالتخطيط المسبق.' : ' وهو عدد معقول يمكن إدارته بفعالية.'}
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-right leading-7 mb-2">
                    {report?.summary ? (
                      // تنسيق الملخص المستلم من الخدمة
                      report.summary.split('. ').map((sentence, index) => (
                        <span key={index} className="block mb-1">{sentence.trim()}{sentence.trim().length > 0 ? '.' : ''}</span>
                      ))
                    ) : (
                      // إنشاء ملخص افتراضي منسق
                      <>
                        <span className="block mb-2">
                          خلال الفترة من {formatDate(reportPeriod.startDate)} إلى {formatDate(reportPeriod.endDate)}، تم إكمال {report?.completedTasks?.length || 0} مهام من أصل {
                            (report?.completedTasks?.length || 0) +
                            (report?.inProgressTasks?.length || 0) +
                            (report?.upcomingTasks?.length || 0) +
                            (report?.blockedTasks?.length || 0)
                          } مهام.
                        </span>
                        <span className="block mb-2">
                          معدل إكمال المهام: {Math.max(1, calculateCompletionRate(report))}%.
                        </span>

                        {report?.blockedTasks?.length ? <span className="block mb-1">هناك {report.blockedTasks.length} مهام معلقة تحتاج إلى متابعة.</span> : ''}
                        {report?.inProgressTasks?.length ? <span className="block mb-1">هناك {report.inProgressTasks.length} مهام قيد التنفيذ.</span> : ''}
                        {report?.upcomingTasks?.length ? <span className="block mb-1">هناك {report.upcomingTasks.length} مهام قادمة.</span> : ''}

                        <span className="block mt-2">
                          يجب التركيز على إكمال المهام المتأخرة وتحسين إدارة الوقت.
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* قائمة مصغرة للمهام الأكثر أهمية */}
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-3">المهام الأكثر أهمية</h3>
                  <div className="space-y-2">
                    {/* المهام المعلقة ذات الأولوية */}
                    {report?.blockedTasks && report.blockedTasks.filter(task => task.priority === 'high').length > 0 && (
                      <div className="border rounded-md p-3 bg-red-50">
                        <h4 className="font-medium text-red-700 mb-2">مهام معلقة ذات أولوية عالية</h4>
                        <ul className="space-y-1">
                          {report.blockedTasks
                            .filter(task => task.priority === 'high')
                            .slice(0, 2)
                            .map(task => (
                              <li key={task.id} className="flex items-center text-sm">
                                <PauseCircle className="h-4 w-4 text-red-500 ml-2 flex-shrink-0" />
                                <span className="truncate">{task.description}</span>
                              </li>
                            ))}
                          {report.blockedTasks.filter(task => task.priority === 'high').length > 2 && (
                            <li className="text-xs text-muted-foreground text-center">
                              + {report.blockedTasks.filter(task => task.priority === 'high').length - 2} مهام أخرى...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* المهام قيد التنفيذ المتأخرة */}
                    {report?.inProgressTasks && report.inProgressTasks.filter(task =>
                      task.dueDate && new Date(task.dueDate) < new Date()
                    ).length > 0 && (
                      <div className="border rounded-md p-3 bg-amber-50">
                        <h4 className="font-medium text-amber-700 mb-2">مهام متأخرة قيد التنفيذ</h4>
                        <ul className="space-y-1">
                          {report.inProgressTasks
                            .filter(task => task.dueDate && new Date(task.dueDate) < new Date())
                            .slice(0, 2)
                            .map(task => (
                              <li key={task.id} className="flex items-center text-sm">
                                <Clock className="h-4 w-4 text-amber-500 ml-2 flex-shrink-0" />
                                <span className="truncate">{task.description}</span>
                                {task.dueDate && (
                                  <span className="text-xs text-amber-600 mr-auto">
                                    تاريخ الاستحقاق: {formatDate(new Date(task.dueDate))}
                                  </span>
                                )}
                              </li>
                            ))}
                          {report.inProgressTasks.filter(task =>
                            task.dueDate && new Date(task.dueDate) < new Date()
                          ).length > 2 && (
                            <li className="text-xs text-muted-foreground text-center">
                              + {report.inProgressTasks.filter(task =>
                                task.dueDate && new Date(task.dueDate) < new Date()
                              ).length - 2} مهام أخرى...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* المهام القادمة ذات الأولوية العالية */}
                    {report?.upcomingTasks?.filter(task => task.priority === 'high').length > 0 && (
                      <div className="border rounded-md p-3 bg-blue-50">
                        <h4 className="font-medium text-blue-700 mb-2">مهام قادمة ذات أولوية عالية</h4>
                        <ul className="space-y-1">
                          {report.upcomingTasks
                            .filter(task => task.priority === 'high')
                            .slice(0, 2)
                            .map(task => (
                              <li key={task.id} className="flex items-center text-sm">
                                <Calendar className="h-4 w-4 text-blue-500 ml-2 flex-shrink-0" />
                                <span className="truncate">{task.description}</span>
                                {task.dueDate && (
                                  <span className="text-xs text-blue-600 mr-auto">
                                    تاريخ الاستحقاق: {formatDate(new Date(task.dueDate))}
                                  </span>
                                )}
                              </li>
                            ))}
                          {report.upcomingTasks.filter(task => task.priority === 'high').length > 2 && (
                            <li className="text-xs text-muted-foreground text-center">
                              + {report.upcomingTasks.filter(task => task.priority === 'high').length - 2} مهام أخرى...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* رسالة إذا لم تكن هناك مهام مهمة */}
                    {(!report?.blockedTasks?.filter(task => task.priority === 'high').length &&
                      !report?.inProgressTasks?.filter(task =>
                        task.dueDate && new Date(task.dueDate) < new Date()
                      ).length &&
                      !report?.upcomingTasks?.filter(task => task.priority === 'high').length) && (
                      <p className="text-center text-muted-foreground py-2">
                        لا توجد مهام ذات أولوية عالية أو متأخرة في هذه الفترة.
                      </p>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold flex items-center mt-4">
                  <BarChart className="ml-2 h-5 w-5 text-primary" />
                  مؤشرات الأداء الرئيسية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {report?.keyMetrics?.completionRate !== undefined
                            ? Math.max(1, Math.round(report.keyMetrics.completionRate))
                            : Math.max(1, calculateCompletionRate(report))}%
                        </div>
                        <p className="text-sm text-muted-foreground">نسبة إكمال المهام</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {report?.keyMetrics?.onTimeCompletionRate !== undefined
                            ? Math.max(1, Math.round(report.keyMetrics.onTimeCompletionRate))
                            : Math.max(1, calculateOnTimeCompletionRate(tasks))}%
                        </div>
                        <p className="text-sm text-muted-foreground">نسبة الإكمال في الوقت المحدد</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {report?.keyMetrics?.averageProgress !== undefined
                            ? Math.max(1, Math.round(report.keyMetrics.averageProgress))
                            : Math.max(1, calculateAverageProgress(report))}%
                        </div>
                        <p className="text-sm text-muted-foreground">متوسط التقدم</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <h3 className="text-lg font-semibold mt-4">التوصيات</h3>
                <ul className="space-y-2">
                  {report?.recommendations && report.recommendations.length > 0 ? (
                    report.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <span className="ml-2 text-primary">•</span>
                        <span>{recommendation}</span>
                      </li>
                    ))
                  ) : (
                    // استخدام دالة إنشاء التوصيات الافتراضية
                    generateDefaultRecommendations(report, tasks).map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <span className="ml-2 text-primary">•</span>
                        <span>{recommendation}</span>
                      </li>
                    ))
                  )}
                </ul>
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                <div className="flex items-center mb-4">
                  <CheckCircle2 className="ml-2 h-5 w-5 text-green-500" />
                  <h3 className="text-lg font-semibold">المهام مكتملة</h3>
                  <Badge className="mr-2 bg-green-100 text-green-800 hover:bg-green-200 border-green-300">
                    {report?.completedTasks?.length || 0}
                  </Badge>
                </div>

                {!report?.completedTasks?.length ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-muted-foreground">
                      لا توجد مهام مكتملة خلال هذه الفترة.
                    </p>
                    <div className="bg-muted/20 p-3 rounded-md max-w-md mx-auto">
                      <h4 className="text-sm font-medium mb-2 text-primary">اقتراحات لتحسين معدل إكمال المهام:</h4>
                      <ul className="text-xs text-right space-y-1">
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>قم بتقسيم المهام الكبيرة إلى مهام أصغر يمكن إنجازها بسهولة.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>حدد أوقاتًا محددة في اليوم للعمل على المهام ذات الأولوية.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>استخدم تقنية بومودورو (25 دقيقة عمل، 5 دقائق راحة) لزيادة التركيز.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {report.completedTasks.map((task) => {
                      // تحويل TaskSummary إلى TaskType للتوافق مع TaskCardTemp
                      const taskForCard = {
                        id: task.id,
                        description: task.description || task.title || '', // استخدام title إذا كان description غير موجود
                        details: task.comment || task.notes || '', // استخدام notes إذا كان comment غير موجود
                        status: 'completed' as const,
                        progress: 100,
                        priority: typeof task.priority === 'string' ?
                          task.priority === 'high' ? 'high' :
                          task.priority === 'medium' ? 'medium' :
                          task.priority === 'low' ? 'low' : 'medium'
                          : task.priority as any,
                        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
                        completedDate: task.completedDate ? new Date(task.completedDate) : undefined
                      } as TaskType;

                      return (
                        <TaskCardTemp
                          key={task.id}
                          id={task.id}
                          task={taskForCard}
                          aiReasoning={`تم إكمال هذه المهمة في ${task.completedDate ? format(new Date(task.completedDate), 'dd/MM/yyyy', { locale: ar }) : 'هذا الأسبوع'}`}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inProgress" className="space-y-4">
                <div className="flex items-center mb-4">
                  <Clock className="ml-2 h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">المهام قيد الانتظار</h3>
                  <Badge className="mr-2 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300">
                    {report?.inProgressTasks?.length || 0}
                  </Badge>
                </div>

                {!report?.inProgressTasks?.length ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-muted-foreground">
                      لا توجد مهام قيد الانتظار.
                    </p>
                    <div className="bg-muted/20 p-3 rounded-md max-w-md mx-auto">
                      <h4 className="text-sm font-medium mb-2 text-primary">نصائح لإدارة المهام قيد الانتظار:</h4>
                      <ul className="text-xs text-right space-y-1">
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>ابدأ بالمهام ذات الأولوية العالية أو المواعيد النهائية القريبة.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>قم بتحديث نسبة التقدم بانتظام لتتبع الإنجاز.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>حدد العقبات التي تواجهك مبكرًا وابحث عن حلول لها.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {report.inProgressTasks.map((task) => {
                      // تحويل TaskSummary إلى TaskType للتوافق مع TaskCardTemp
                      const taskForCard = {
                        id: task.id,
                        description: task.description || task.title || '', // استخدام title إذا كان description غير موجود
                        details: task.comment || task.notes || '', // استخدام notes إذا كان comment غير موجود
                        status: 'in-progress' as any,
                        progress: task.progress || 50,
                        priority: typeof task.priority === 'string' ?
                          task.priority === 'high' ? 'high' :
                          task.priority === 'medium' ? 'medium' :
                          task.priority === 'low' ? 'low' : 'medium'
                          : task.priority as any,
                        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
                      } as TaskType;

                      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                      const reasoning = isOverdue
                        ? `مهمة متأخرة - تاريخ الاستحقاق: ${task.dueDate ? format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: ar }) : 'غير محدد'}`
                        : `نسبة التقدم: ${task.progress || 0}%`;

                      return (
                        <TaskCardTemp
                          key={task.id}
                          id={task.id}
                          task={taskForCard}
                          aiReasoning={reasoning}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-4">
                <div className="flex items-center mb-4">
                  <Calendar className="ml-2 h-5 w-5 text-orange-500" />
                  <h3 className="text-lg font-semibold">المهام قادمة</h3>
                  <Badge className="mr-2 bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300">
                    {report?.upcomingTasks?.length || 0}
                  </Badge>
                </div>

                {!report?.upcomingTasks?.length ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-muted-foreground">
                      لا توجد مهام قادمة.
                    </p>
                    <div className="bg-muted/20 p-3 rounded-md max-w-md mx-auto">
                      <h4 className="text-sm font-medium mb-2 text-primary">نصائح للتخطيط للمهام القادمة:</h4>
                      <ul className="text-xs text-right space-y-1">
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>قم بتحديد أولويات المهام القادمة بناءً على أهميتها وتاريخ استحقاقها.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>خطط للمهام الكبيرة مبكرًا وقسمها إلى مهام فرعية أصغر.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>ضع تواريخ بدء للمهام القادمة لتجنب تراكمها قرب موعد الاستحقاق.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {report.upcomingTasks.map((task) => {
                      // تحويل TaskSummary إلى TaskType للتوافق مع TaskCardTemp
                      const taskForCard = {
                        id: task.id,
                        description: task.description || task.title || '', // استخدام title إذا كان description غير موجود
                        details: task.comment || task.notes || '', // استخدام notes إذا كان comment غير موجود
                        status: 'pending',
                        progress: task.progress || 0,
                        priority: typeof task.priority === 'string' ?
                          task.priority === 'high' ? 'high' :
                          task.priority === 'medium' ? 'medium' :
                          task.priority === 'low' ? 'low' : 'medium'
                          : task.priority as any,
                        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
                      } as TaskType;

                      return (
                        <TaskCardTemp
                          key={task.id}
                          id={task.id}
                          task={taskForCard}
                          aiReasoning={`تاريخ الاستحقاق: ${task.dueDate ? format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: ar }) : 'غير محدد'}`}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="planning" className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">التخطيط للأسبوع القادم</h3>
                  <p className="text-right leading-7 mb-4">
                    بناءً على تحليل أدائك في الأسبوع الحالي، إليك خطة عمل مقترحة للأسبوع القادم لتحسين إنتاجيتك وتحقيق أهدافك.
                  </p>
                </div>

                {/* الأولويات المقترحة */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>الأولويات المقترحة للأسبوع القادم</CardTitle>
                    <CardDescription>
                      مهام يجب التركيز عليها في الأسبوع القادم
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* المهام المتأخرة */}
                      {report?.inProgressTasks?.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length ? (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center">
                            <AlertTriangle className="h-4 w-4 text-red-500 ml-2" />
                            المهام المتأخرة
                          </h4>
                          <ul className="space-y-1 text-sm pr-5">
                            {report.inProgressTasks
                              .filter(t => t.dueDate && new Date(t.dueDate) < new Date())
                              .map((task, index) => (
                                <li key={index} className="list-disc">
                                  {task.description || task.title} - متأخرة منذ {task.dueDate ? Math.ceil((new Date().getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0} أيام
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}

                      {/* المهام المعلقة */}
                      {report?.blockedTasks?.length ? (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center">
                            <PauseCircle className="h-4 w-4 text-gray-500 ml-2" />
                            المهام المعلقة
                          </h4>
                          <ul className="space-y-1 text-sm pr-5">
                            {report.blockedTasks
                              .slice(0, 3)
                              .map((task, index) => (
                                <li key={index} className="list-disc">
                                  {task.description || task.title} - تحديد العقبات وإيجاد حلول
                                </li>
                              ))}
                            {report.blockedTasks.length > 3 && (
                              <li className="text-xs text-muted-foreground">
                                + {report.blockedTasks.length - 3} مهام معلقة أخرى...
                              </li>
                            )}
                          </ul>
                        </div>
                      ) : null}

                      {/* المهام ذات الأولوية العالية */}
                      {report?.upcomingTasks?.filter(t => t.priority === 'high').length ? (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center">
                            <span className="inline-block w-3 h-3 rounded-full bg-red-500 ml-2"></span>
                            المهام ذات الأولوية العالية
                          </h4>
                          <ul className="space-y-1 text-sm pr-5">
                            {report.upcomingTasks
                              .filter(t => t.priority === 'high')
                              .slice(0, 3)
                              .map((task, index) => (
                                <li key={index} className="list-disc">
                                  {task.description || task.title}
                                  {task.dueDate ? ` - تاريخ الاستحقاق: ${format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: ar })}` : ''}
                                </li>
                              ))}
                            {report.upcomingTasks.filter(t => t.priority === 'high').length > 3 && (
                              <li className="text-xs text-muted-foreground">
                                + {report.upcomingTasks.filter(t => t.priority === 'high').length - 3} مهام أخرى ذات أولوية عالية...
                              </li>
                            )}
                          </ul>
                        </div>
                      ) : null}

                      {/* المهام القريبة من الموعد النهائي */}
                      {report?.upcomingTasks?.filter(t =>
                        t.dueDate &&
                        new Date(t.dueDate) > new Date() &&
                        (new Date(t.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7
                      ).length ? (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center">
                            <Clock className="h-4 w-4 text-amber-500 ml-2" />
                            المهام القريبة من الموعد النهائي
                          </h4>
                          <ul className="space-y-1 text-sm pr-5">
                            {report.upcomingTasks
                              .filter(t =>
                                t.dueDate &&
                                new Date(t.dueDate) > new Date() &&
                                (new Date(t.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7
                              )
                              .slice(0, 3)
                              .map((task, index) => (
                                <li key={index} className="list-disc">
                                  {task.description || task.title} - متبقي {task.dueDate ? Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0} أيام
                                </li>
                              ))}
                            {report.upcomingTasks.filter(t =>
                              t.dueDate &&
                              new Date(t.dueDate) > new Date() &&
                              (new Date(t.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7
                            ).length > 3 && (
                              <li className="text-xs text-muted-foreground">
                                + {report.upcomingTasks.filter(t =>
                                  t.dueDate &&
                                  new Date(t.dueDate) > new Date() &&
                                  (new Date(t.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7
                                ).length - 3} مهام أخرى قريبة من الموعد النهائي...
                              </li>
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                {/* استراتيجيات مقترحة */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>استراتيجيات مقترحة لتحسين الإنتاجية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* استراتيجيات مخصصة بناءً على التحليل */}
                      <div className="space-y-2">
                        {report?.keyMetrics?.completionRate && report.keyMetrics.completionRate < 50 ? (
                          <div className="bg-blue-50 p-3 rounded-md">
                            <h4 className="text-sm font-semibold text-blue-700 mb-2">تحسين معدل إكمال المهام</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">تقسيم المهام الكبيرة إلى مهام فرعية أصغر يمكن إنجازها بسهولة.</li>
                              <li className="list-disc">تخصيص وقت محدد يوميًا للعمل على المهام ذات الأولوية العالية.</li>
                              <li className="list-disc">استخدام تقنية بومودورو (25 دقيقة عمل، 5 دقائق راحة) لزيادة التركيز.</li>
                            </ul>
                          </div>
                        ) : null}

                        {report?.keyMetrics?.onTimeCompletionRate && report.keyMetrics.onTimeCompletionRate < 70 ? (
                          <div className="bg-amber-50 p-3 rounded-md">
                            <h4 className="text-sm font-semibold text-amber-700 mb-2">تحسين الالتزام بالمواعيد النهائية</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">تحديد مواعيد نهائية واقعية للمهام مع إضافة وقت احتياطي.</li>
                              <li className="list-disc">تقسيم المهام الكبيرة إلى مراحل مع مواعيد نهائية لكل مرحلة.</li>
                              <li className="list-disc">البدء في المهام مبكرًا وعدم تأجيلها حتى اقتراب الموعد النهائي.</li>
                            </ul>
                          </div>
                        ) : null}

                        {report?.blockedTasks?.length ? (
                          <div className="bg-gray-50 p-3 rounded-md">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">التعامل مع المهام المعلقة</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">تحديد العقبات التي تعيق كل مهمة بوضوح.</li>
                              <li className="list-disc">طلب المساعدة أو الموارد اللازمة لتجاوز العقبات.</li>
                              <li className="list-disc">إعادة تقييم المهام المعلقة لفترة طويلة وتحديد ما إذا كانت لا تزال ضرورية.</li>
                            </ul>
                          </div>
                        ) : null}

                        {report?.upcomingTasks?.length > 5 ? (
                          <div className="bg-green-50 p-3 rounded-md">
                            <h4 className="text-sm font-semibold text-green-700 mb-2">إدارة المهام القادمة</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">ترتيب المهام القادمة حسب الأولوية والموعد النهائي.</li>
                              <li className="list-disc">تحديد المهام التي يمكن تفويضها أو تأجيلها إذا لزم الأمر.</li>
                              <li className="list-disc">وضع خطة زمنية واضحة للبدء في المهام القادمة.</li>
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* خطة الأسبوع القادم */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>خطة الأسبوع القادم</CardTitle>
                    <CardDescription>
                      توزيع مقترح للمهام على أيام الأسبوع القادم
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* توزيع المهام على أيام الأسبوع */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* اليوم الأول والثاني */}
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold mb-2">اليوم الأول والثاني</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">التركيز على المهام المتأخرة والمعلقة.</li>
                              {report?.inProgressTasks?.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length ? (
                                <li className="list-disc">إكمال {Math.min(report.inProgressTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length, 2)} مهام متأخرة.</li>
                              ) : null}
                              {report?.blockedTasks?.length ? (
                                <li className="list-disc">حل العقبات في {Math.min(report.blockedTasks.length, 2)} مهام معلقة.</li>
                              ) : null}
                              <li className="list-disc">مراجعة وتحديث خطة العمل الأسبوعية.</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold mb-2">اليوم الثالث والرابع</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">التركيز على المهام ذات الأولوية العالية.</li>
                              {report?.upcomingTasks?.filter(t => t.priority === 'high').length ? (
                                <li className="list-disc">البدء في {Math.min(report.upcomingTasks.filter(t => t.priority === 'high').length, 2)} مهام ذات أولوية عالية.</li>
                              ) : null}
                              {report?.inProgressTasks?.length ? (
                                <li className="list-disc">متابعة التقدم في المهام قيد التنفيذ.</li>
                              ) : null}
                              <li className="list-disc">تحديث نسب التقدم في المهام.</li>
                            </ul>
                          </div>
                        </div>
                        {/* اليوم الخامس والسادس والسابع */}
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold mb-2">اليوم الخامس والسادس</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">التركيز على المهام القريبة من الموعد النهائي.</li>
                              {report?.upcomingTasks?.filter(t =>
                                t.dueDate &&
                                new Date(t.dueDate) > new Date() &&
                                (new Date(t.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7
                              ).length ? (
                                <li className="list-disc">العمل على {Math.min(report.upcomingTasks.filter(t =>
                                  t.dueDate &&
                                  new Date(t.dueDate) > new Date() &&
                                  (new Date(t.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7
                                ).length, 2)} مهام قريبة من الموعد النهائي.</li>
                              ) : null}
                              <li className="list-disc">إكمال المهام قيد التنفيذ قدر الإمكان.</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold mb-2">اليوم السابع</h4>
                            <ul className="space-y-1 text-sm pr-5">
                              <li className="list-disc">مراجعة ما تم إنجازه خلال الأسبوع.</li>
                              <li className="list-disc">تحديث حالة جميع المهام.</li>
                              <li className="list-disc">التخطيط للأسبوع القادم.</li>
                              <li className="list-disc">تحديد الدروس المستفادة وفرص التحسين.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="blocked" className="space-y-4">
                <div className="flex items-center mb-4">
                  <PauseCircle className="ml-2 h-5 w-5 text-gray-500" />
                  <h3 className="text-lg font-semibold">المهام معلقة</h3>
                  <Badge className="mr-2 bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300">
                    {report?.blockedTasks?.length || 0}
                  </Badge>
                </div>

                {!report?.blockedTasks?.length ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-muted-foreground">
                      لا توجد مهام معلقة.
                    </p>
                    <div className="bg-muted/20 p-3 rounded-md max-w-md mx-auto">
                      <h4 className="text-sm font-medium mb-2 text-primary">نصائح للتعامل مع المهام معلقة:</h4>
                      <ul className="text-xs text-right space-y-1">
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>حدد بوضوح سبب تعليق كل مهمة وما هي العقبات التي تواجهها.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>ضع خطة عمل لإزالة العقبات وإعادة تنشيط المهام المعلقة.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>راجع المهام المعلقة بانتظام لتحديد ما إذا كانت لا تزال ذات صلة أو يجب إلغاؤها.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {report.blockedTasks.map((task) => {
                      // تحويل TaskSummary إلى TaskType للتوافق مع TaskCardTemp
                      const taskForCard = {
                        id: task.id,
                        description: task.description || task.title || '', // استخدام title إذا كان description غير موجود
                        details: task.comment || task.notes || '', // استخدام notes إذا كان comment غير موجود
                        status: 'hold',
                        progress: task.progress || 0,
                        priority: typeof task.priority === 'string' ?
                          task.priority === 'high' ? 'high' :
                          task.priority === 'medium' ? 'medium' :
                          task.priority === 'low' ? 'low' : 'medium'
                          : task.priority as any,
                        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
                      } as TaskType;

                      return (
                        <TaskCardTemp
                          key={task.id}
                          id={task.id}
                          task={taskForCard}
                          aiReasoning={task.comment || "هذه المهمة معلقة وتحتاج إلى مراجعة"}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="overdue" className="space-y-4">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="ml-2 h-5 w-5 text-red-500" />
                  <h3 className="text-lg font-semibold">المهام فائتة</h3>
                  <Badge className="mr-2 bg-red-100 text-red-800 hover:bg-red-200 border-red-300">
                    {report?.overdueTasks?.length || 0}
                  </Badge>
                </div>

                {!report?.overdueTasks?.length ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-muted-foreground">
                      لا توجد مهام فائتة.
                    </p>
                    <div className="bg-muted/20 p-3 rounded-md max-w-md mx-auto">
                      <h4 className="text-sm font-medium mb-2 text-primary">نصائح للتعامل مع المهام الفائتة:</h4>
                      <ul className="text-xs text-right space-y-1">
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>حدد أولويات المهام الفائتة وابدأ بالأكثر أهمية.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>قم بتحديث المواعيد النهائية إذا كانت المهام لا تزال ذات صلة.</span>
                        </li>
                        <li className="flex items-start">
                          <span className="ml-1 text-primary">•</span>
                          <span>حلل أسباب التأخير لتجنب تكرارها في المستقبل.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {report.overdueTasks.map((task) => {
                      // تحويل TaskSummary إلى TaskType للتوافق مع TaskCardTemp
                      const taskForCard = {
                        id: task.id,
                        description: task.description || task.title || '', // استخدام title إذا كان description غير موجود
                        details: task.comment || task.notes || '', // استخدام notes إذا كان comment غير موجود
                        status: 'pending',
                        progress: task.progress || 0,
                        priority: typeof task.priority === 'string' ?
                          task.priority === 'high' ? 'high' :
                          task.priority === 'medium' ? 'medium' :
                          task.priority === 'low' ? 'low' : 'medium'
                          : task.priority as any,
                        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
                      } as TaskType;

                      return (
                        <TaskCardTemp
                          key={task.id}
                          id={task.id}
                          task={taskForCard}
                          aiReasoning={`مهمة فائتة - تاريخ الاستحقاق: ${task.dueDate ? format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: ar }) : 'غير محدد'}`}
                        />
                      );
                    })}
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


