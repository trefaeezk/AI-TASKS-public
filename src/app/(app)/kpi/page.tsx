
// src/app/(app)/kpi/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Import missing Target icon, also import CheckCircle2, Percent for KPIs
import { Loader2, Wand2, BarChart3, AlertTriangle, ListChecks, Info, Target, CheckCircle2, Percent, Clock, XCircle, PauseCircle, Play } from 'lucide-react'; // Added Play for in-progress tasks
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/config/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { firestoreListenerManager, handleFirestoreError } from '@/utils/firestoreListenerManager'; // Use onSnapshot for real-time updates

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from '@/components/ui/progress'; // Import Progress
// Import the AI service
import { generateDailyPlan, Task } from '@/services/ai';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskType, TaskFirestoreData, DurationUnit, PriorityLevel, TaskStatus, Milestone } from '@/types/task';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { TaskCardTemp } from '@/components/TaskCardTemp';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { Separator } from '@/components/ui/separator';
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, ChartStyle } from '@/components/ui/chart'; // Import Chart components
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"; // Import Recharts components

// Function to map Firestore data to TaskType including milestones
const mapFirestoreTaskToTaskType = (id: string, data: TaskFirestoreData): TaskType | null => {
      if (!data.description || !data.status || !data.userId) {
          console.warn(`Firestore task document ${id} is missing required fields. Skipping.`);
          return null;
      }

      let priority: PriorityLevel | undefined = undefined;
      if (data.priority !== null && data.priority !== undefined) {
          const p = Number(data.priority);
          if (p >= 1 && p <= 5) {
              priority = p as PriorityLevel;
          } else {
              console.warn(`Invalid priority value ${data.priority} for task ${id}. Setting to undefined.`);
          }
      }

       // Ensure milestones are correctly mapped or defaulted to an empty array
        const mappedMilestones = Array.isArray(data.milestones)
            ? data.milestones.map(m => ({ // Basic validation/mapping for each milestone
                id: m.id || 'missing-id', // Provide default if ID is missing
                description: m.description || '',
                completed: !!m.completed, // Ensure boolean
                weight: typeof m.weight === 'number' ? m.weight : 0, // Ensure number, default to 0
            }))
            : []; // Default to empty array if null, undefined, or not an array

      return {
        id,
        description: data.description,
        details: data.details ?? undefined,
        startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : undefined,
        dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : undefined,
        durationValue: data.durationValue ?? undefined,
        durationUnit: data.durationUnit ?? undefined,
        priority: priority,
        priorityReason: data.priorityReason ?? undefined,
        status: data.status,
        taskCategoryName: data.taskCategoryName ?? undefined,
        milestones: mappedMilestones, // Use the processed milestones array
      };
};

// Function to calculate overall task progress based on milestones
const calculateTaskProgress = (milestones?: Milestone[]): number => {
    if (!milestones || milestones.length === 0) return 0;
    const totalWeight = milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
    if (totalWeight === 0) return 0; // Avoid division by zero
    const completedWeight = milestones.reduce((sum, m) => sum + (m.completed ? (m.weight || 0) : 0), 0);
    return Math.round((completedWeight / totalWeight) * 100);
};

// --- Chart Configuration ---
const chartConfig = {
    count: {
        label: "عدد المهام",
        color: "hsl(var(--chart-1))", // Use a theme color
    },
    // حالات المهام
    مكتملة: { label: "مكتملة", color: "hsl(var(--status-completed))", icon: CheckCircle2 },
    'قيد الانتظار': { label: "قيد الانتظار", color: "hsl(var(--primary))", icon: Clock },
    'قيد التنفيذ': { label: "قيد التنفيذ", color: "hsl(var(--status-warning))", icon: Play },
    فائتة: { label: "فائتة", color: "hsl(var(--status-urgent))", icon: AlertTriangle },
    معلقة: { label: "معلقة", color: "hsl(var(--muted-foreground))", icon: PauseCircle },
    // أولويات المهام
    عالية: { label: "عالية", color: "hsl(var(--status-urgent))" },
    متوسطة: { label: "متوسطة", color: "hsl(var(--status-warning))" },
    منخفضة: { label: "منخفضة", color: "hsl(var(--status-completed))" },
    'بدون أولوية': { label: "بدون أولوية", color: "hsl(var(--muted-foreground))" },
    // الإكمال في الوقت المحدد
    'في الوقت المحدد': { label: "في الوقت المحدد", color: "hsl(var(--status-completed))" },
    متأخرة: { label: "متأخرة", color: "hsl(var(--status-urgent))" },
} satisfies ChartConfig;

// --- Custom Legend for Chart ---
const CustomChartLegend = (props: any) => {
    const { payload } = props;

    const statusIconMap: Record<string, React.ElementType> = {
        مكتملة: CheckCircle2,
        'قيد الانتظار': Clock,
        'قيد التنفيذ': Play,
        فائتة: AlertTriangle,
        معلقة: PauseCircle,
    };

    return (
        <div className="flex items-center justify-center gap-x-4 gap-y-1.5 text-xs flex-wrap pt-3">
            {payload.map((entry: any, index: number) => {
                const IconComponent = statusIconMap[entry.value];
                const color = chartConfig[entry.value as keyof typeof chartConfig]?.color;
                return (
                    <div key={`item-${index}`} className="flex items-center gap-1.5">
                        {IconComponent && (
                            <IconComponent className="h-3.5 w-3.5" style={{ color: color }} />
                        )}
                        {!IconComponent && (
                             <div className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
                        )}
                        <span className="text-muted-foreground">{entry.value}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default function KpiPage() {
  const { user } = useAuth();
  const { getCategoryColor } = useTaskCategories(user?.uid);
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
        setTasks([]);
        setIsLoading(false);
        setError('يجب تسجيل الدخول لعرض مؤشرات الأداء.');
        return;
    }

    setIsLoading(true);
    setError(null);

    const tasksColRef = collection(db, 'tasks');
    // Fetch all tasks for the user for KPI analysis with optimized indexing
    const q = query(
      tasksColRef,
      where('userId', '==', user.uid),
      orderBy('status', 'asc') // استخدام الفهرس المركب userId + status
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedTasks: TaskType[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as TaskFirestoreData;
            if (data.userId === user.uid) { // Ensure task belongs to the user
                 const mappedTask = mapFirestoreTaskToTaskType(doc.id, data);
                 if (mappedTask) {
                    fetchedTasks.push(mappedTask);
                 }
            }
        });
        setTasks(fetchedTasks);
        setIsLoading(false);
    }, (err) => {
        const isPermissionError = handleFirestoreError(err, 'IndividualKpiPage');

        if (!isPermissionError) {
          setError('حدث خطأ أثناء تحميل بيانات المهام.');
        }
        setIsLoading(false);
    });

    // إضافة listener إلى مدير listeners
    firestoreListenerManager.addListener(`individual-kpi-${user.uid}`, unsubscribe);

    return () => {
      unsubscribe();
      firestoreListenerManager.removeListener(`individual-kpi-${user.uid}`);
    };
  }, [user]);

  // --- KPI Calculations ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const holdTasks = tasks.filter(t => t.status === 'hold').length;
  const onHoldTasks = tasks.filter(t => t.status === 'hold').length;

  // المهام الفائتة هي المهام معلقة أو قيد التنفيذ التي لها تاريخ استحقاق وتاريخ الاستحقاق قد مر
  const overdueTasks = tasks.filter(t =>
    (t.status === 'hold' || t.status === 'in-progress') &&
    t.dueDate &&
    new Date(t.dueDate) < new Date()
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // حساب معدل الإكمال في الوقت المحدد
  // المهام المكتملة في الوقت المحدد هي المهام التي لها تاريخ استحقاق وتاريخ إكمال، وتم إكمالها قبل أو في تاريخ الاستحقاق
  const completedOnTimeCount = tasks.filter(t =>
    t.status === 'completed' &&
    t.dueDate &&
    t.completedDate &&
    new Date(t.completedDate) <= new Date(t.dueDate)
  ).length;

  // المهام المكتملة التي لها تاريخ استحقاق
  const completedWithDueDateCount = tasks.filter(t =>
    t.status === 'completed' && t.dueDate
  ).length;

  // معدل الإكمال في الوقت المحدد هو نسبة المهام المكتملة في الوقت المحدد إلى إجمالي المهام المكتملة التي لها تاريخ استحقاق
  const onTimeCompletionRate = completedWithDueDateCount > 0
    ? Math.round((completedOnTimeCount / completedWithDueDateCount) * 100)
    : 0;

  // حساب متوسط الوقت لإكمال المهام (بالأيام)
  // المهام التي لها تاريخ بدء وتاريخ إكمال
  const tasksWithCompletionTime = tasks.filter(t =>
    t.status === 'completed' &&
    t.startDate &&
    t.completedDate
  );

  // حساب إجمالي عدد الأيام لإكمال المهام
  const totalCompletionDays = tasksWithCompletionTime.reduce((sum, t) => {
    // التأكد من أن التواريخ هي كائنات Date
    const startDate = t.startDate instanceof Date ? t.startDate : new Date(t.startDate || new Date());
    const completedDate = t.completedDate instanceof Date ? t.completedDate : new Date(t.completedDate || new Date());

    // حساب الفرق بالأيام (على الأقل يوم واحد)
    const days = Math.max(1, Math.ceil((completedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    return sum + days;
  }, 0);

  // حساب متوسط عدد الأيام
  const averageCompletionDays = tasksWithCompletionTime.length > 0
    ? Math.round(totalCompletionDays / tasksWithCompletionTime.length)
    : 0;

  // حساب توزيع المهام حسب الأولوية
  // الأولوية العالية: 1 أو 'high'
  const highPriorityTasks = tasks.filter(t =>
    t.priority === 1 ||
    t.priority === 'high'
  ).length;

  // الأولوية المتوسطة: 3 أو 'medium'
  const mediumPriorityTasks = tasks.filter(t =>
    t.priority === 3 ||
    t.priority === 'medium'
  ).length;

  // الأولوية المنخفضة: 5 أو 'low'
  const lowPriorityTasks = tasks.filter(t =>
    t.priority === 5 ||
    t.priority === 'low'
  ).length;

  // بدون أولوية
  const noPriorityTasks = totalTasks - (highPriorityTasks + mediumPriorityTasks + lowPriorityTasks);

  // حساب متوسط التقدم بطريقة أكثر دقة
  // تحديد المهام التي سيتم حساب التقدم لها (المهام النشطة فقط)
  const activeTasks = tasks.filter(t =>
    t.status === 'completed' ||
    t.status === 'in-progress' ||
    (t.status === 'hold' && t.startDate && t.startDate <= new Date())
  );

  // إذا لم تكن هناك مهام نشطة، فإن متوسط التقدم هو 0
  if (activeTasks.length === 0) {
    var averageProgress = 0;
  } else {
    // حساب التقدم لكل مهمة
    const taskProgressValues = activeTasks.map(task => {
      // المهام المكتملة لها تقدم 100%
      if (task.status === 'completed') {
        return 100;
      }

      // المهام التي لها نقاط تتبع (milestones)
      if (task.milestones && task.milestones.length > 0) {
        return calculateTaskProgress(task.milestones);
      }

      // المهام قيد التنفيذ بدون نقاط تتبع تحسب كـ 50% تقدم
      if (task.status === 'in-progress') {
        return 50;
      }

      // المهام المعلقة التي بدأت بالفعل تحسب كـ 10% تقدم
      if (task.status === 'hold' && task.startDate && task.startDate <= new Date()) {
        return 10;
      }

      // المهام الأخرى تحسب كـ 0% تقدم
      return 0;
    });

    // حساب متوسط التقدم
    const totalProgress = taskProgressValues.reduce((sum, progress) => sum + progress, 0);
    var averageProgress = Math.round(totalProgress / activeTasks.length);
  }

    // --- Chart Data Preparation ---
    const statusChartData = useMemo(() => {
        // حساب عدد المهام المعلقة (باستثناء المهام الفائتة)
        const holdCount = tasks.filter(t =>
            t.status === 'hold' &&
            !(t.dueDate && new Date(t.dueDate) < new Date())
        ).length;

        // حساب عدد المهام قيد التنفيذ
        const inProgressCount = tasks.filter(t =>
            t.status === 'in-progress'
        ).length;

        const data = [
            { status: 'مكتملة', count: completedTasks, fill: "hsl(var(--status-completed))" },
            { status: 'معلقة', count: holdCount, fill: "hsl(var(--primary))" },
            { status: 'قيد التنفيذ', count: inProgressCount, fill: "hsl(var(--status-warning))" },
            { status: 'فائتة', count: overdueTasks, fill: "hsl(var(--status-urgent))" },
        ];

        // إظهار جميع الحالات حتى لو كانت بقيمة صفر
        return data;
    }, [tasks, completedTasks, overdueTasks, onHoldTasks]);

    // بيانات الرسم البياني للأولويات
    const priorityChartData = useMemo(() => {
        const data = [
            { priority: 'عالية', count: highPriorityTasks, fill: "hsl(var(--status-urgent))" },
            { priority: 'متوسطة', count: mediumPriorityTasks, fill: "hsl(var(--status-warning))" },
            { priority: 'منخفضة', count: lowPriorityTasks, fill: "hsl(var(--status-completed))" },
            { priority: 'بدون أولوية', count: noPriorityTasks, fill: "hsl(var(--muted-foreground))" },
        ];
        return data.filter(item => item.count > 0); // Only include priorities with counts > 0
    }, [highPriorityTasks, mediumPriorityTasks, lowPriorityTasks, noPriorityTasks]);

    // بيانات الرسم البياني للإكمال في الوقت المحدد
    const timelineChartData = useMemo(() => {
        return [
            { name: 'في الوقت المحدد', value: completedOnTimeCount, fill: "hsl(var(--status-completed))" },
            { name: 'متأخرة', value: completedWithDueDateCount - completedOnTimeCount, fill: "hsl(var(--status-urgent))" },
        ];
    }, [completedOnTimeCount, completedWithDueDateCount]);

  if (isLoading) {
    return (
         <div className="space-y-6" dir="rtl">
             <h1 className="text-2xl font-bold text-primary flex items-center">
                 <BarChart3 className="ml-2 h-6 w-6"/> مؤشرات الأداء الرئيسية (KPIs)
             </h1>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Skeleton className="h-24 w-full rounded-lg bg-muted" />
                 <Skeleton className="h-24 w-full rounded-lg bg-muted" />
                 <Skeleton className="h-24 w-full rounded-lg bg-muted" />
                 <Skeleton className="h-24 w-full rounded-lg bg-muted" />
             </div>
             <Skeleton className="h-64 w-full rounded-lg bg-muted" />
             <Skeleton className="h-40 w-full rounded-lg bg-muted" />
         </div>
    );
  }

  if (error) {
    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]" dir="rtl">
            <Alert variant="destructive" className="w-full max-w-lg">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>خطأ في التحميل</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    // Use responsive padding and overflow hidden
    <div className="space-y-4 md:space-y-6 px-3 md:px-6 overflow-x-hidden max-w-[100vw]" dir="rtl">
       {/* Use semi-bold and slightly larger font for title */}
       <h1 className="text-lg md:text-2xl font-semibold text-primary flex items-center mt-2">
         <BarChart3 className="ml-2 h-5 w-5 md:h-6 md:w-6"/> مؤشرات الأداء
       </h1>

       {/* Key Metrics Summary Cards - Optimized for mobile */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Tasks Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">إجمالي المهام</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{totalTasks}</div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {completedTasks} مكتملة | {holdTasks} معلقة
                    </p>
                </CardContent>
            </Card>

            {/* Completion Rate Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">معدل الإنجاز</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-status-completed" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{completionRate}%</div>
                    <Progress value={completionRate} className="h-2 mt-1" />
                </CardContent>
            </Card>

            {/* On-Time Completion Rate Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">الإكمال في الوقت المحدد</CardTitle>
                    <Clock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{onTimeCompletionRate}%</div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {completedOnTimeCount} من {completedWithDueDateCount} مهمة
                    </p>
                </CardContent>
            </Card>

            {/* Average Completion Time Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">متوسط وقت الإكمال</CardTitle>
                    <Clock className="h-4 w-4 text-status-warning" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{averageCompletionDays} يوم</div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      لـ {tasksWithCompletionTime.length} مهمة مكتملة
                    </p>
                </CardContent>
            </Card>
        </div>

        {/* Row 2 of KPI Cards */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
            {/* Overdue Tasks Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">مهام فائتة</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-status-urgent" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{overdueTasks}</div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0}% من إجمالي المهام
                    </p>
                </CardContent>
            </Card>

            {/* On Hold Tasks Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">مهام معلقة</CardTitle>
                    <PauseCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{onHoldTasks}</div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {totalTasks > 0 ? Math.round((onHoldTasks / totalTasks) * 100) : 0}% من إجمالي المهام
                    </p>
                </CardContent>
            </Card>

            {/* High Priority Tasks Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">مهام ذات أولوية عالية</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-status-urgent" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{highPriorityTasks}</div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {totalTasks > 0 ? Math.round((highPriorityTasks / totalTasks) * 100) : 0}% من إجمالي المهام
                    </p>
                </CardContent>
            </Card>

            {/* Average Progress Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">متوسط التقدم</CardTitle>
                    <Percent className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{averageProgress}%</div>
                    <Progress value={averageProgress} className="h-2 mt-1" />
                </CardContent>
            </Card>
        </div>

        {/* Task Status Distribution - Simplified version */}
        <Card className="shadow-sm border border-border rounded-lg">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base font-semibold">توزيع حالات المهام</CardTitle>
                    <CardDescription className="text-xs italic text-muted-foreground">نظرة عامة على حالة المهام الحالية</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                {statusChartData.length > 0 ? (
                    <div className="space-y-4">
                        {/* Simplified chart using custom bars */}
                        <div className="space-y-4">
                            {statusChartData.map((item, index) => {
                                const total = statusChartData.reduce((sum, item) => sum + item.count, 0);
                                const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;

                                // استخدام الأيقونات المناسبة لكل حالة
                                const statusIconMap: Record<string, React.ElementType> = {
                                    'مكتملة': CheckCircle2,
                                    'قيد الانتظار': Clock,
                                    'قيد التنفيذ': Play,
                                    'فائتة': AlertTriangle,
                                    'معلقة': PauseCircle,
                                };
                                const IconComponent = statusIconMap[item.status];

                                return (
                                    <div key={index} className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {IconComponent && (
                                                    <IconComponent className="h-4 w-4" style={{ color: item.fill }} />
                                                )}
                                                <span className="font-medium text-sm">{item.status}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">{item.count}</span>
                                                <span className="text-xs text-muted-foreground">({percentage}%)</span>
                                            </div>
                                        </div>
                                        <div className="relative h-8">
                                            <div className="absolute inset-0 rounded-md bg-muted/30"></div>
                                            <div
                                                className="absolute inset-y-0 right-0 rounded-md transition-all duration-500 ease-in-out"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: item.fill,
                                                    minWidth: item.count > 0 ? '2rem' : '0'
                                                }}
                                            >
                                                {item.count > 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-xs font-medium text-white">{item.count}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Total count */}
                        <div className="flex justify-between items-center pt-3 mt-2 border-t border-border/50 text-sm">
                            <span className="font-medium">المجموع</span>
                            <span>{statusChartData.reduce((sum, item) => sum + item.count, 0)} مهمة</span>
                        </div>
                    </div>
                ) : (
                    <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                        لا توجد بيانات لعرض الرسم البياني.
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Task Priority Distribution - Simplified version */}
        <Card className="shadow-sm border border-border rounded-lg">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base font-semibold">توزيع المهام حسب الأولوية</CardTitle>
                    <CardDescription className="text-xs italic text-muted-foreground">تحليل المهام حسب مستوى الأولوية</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                {priorityChartData.length > 0 ? (
                    <div className="space-y-4">
                        {/* Simplified chart using custom bars */}
                        <div className="space-y-4">
                            {priorityChartData.map((item, index) => {
                                const total = priorityChartData.reduce((sum, item) => sum + item.count, 0);
                                const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;

                                return (
                                    <div key={index} className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }}></div>
                                                <span className="font-medium text-sm">{item.priority}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">{item.count}</span>
                                                <span className="text-xs text-muted-foreground">({percentage}%)</span>
                                            </div>
                                        </div>
                                        <div className="relative h-8">
                                            <div className="absolute inset-0 rounded-md bg-muted/30"></div>
                                            <div
                                                className="absolute inset-y-0 right-0 rounded-md transition-all duration-500 ease-in-out"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: item.fill,
                                                    minWidth: item.count > 0 ? '2rem' : '0'
                                                }}
                                            >
                                                {item.count > 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="text-xs font-medium text-white">{item.count}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Total count */}
                        <div className="flex justify-between items-center pt-3 mt-2 border-t border-border/50 text-sm">
                            <span className="font-medium">المجموع</span>
                            <span>{priorityChartData.reduce((sum, item) => sum + item.count, 0)} مهمة</span>
                        </div>
                    </div>
                ) : (
                    <div className="h-[150px] flex items-center justify-center text-muted-foreground">
                        لا توجد بيانات لعرض الرسم البياني.
                    </div>
                )}
            </CardContent>
        </Card>

        {/* On-Time Completion Analysis */}
        <Card className="shadow-sm border border-border rounded-lg">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base font-semibold">تحليل الإكمال في الوقت المحدد</CardTitle>
                    <CardDescription className="text-xs italic text-muted-foreground">نسبة المهام المكتملة في الوقت المحدد مقابل المهام المتأخرة</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                {completedWithDueDateCount > 0 ? (
                    <div className="space-y-4">
                        {/* نسبة الإكمال في الوقت المحدد */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">الإكمال في الوقت المحدد</span>
                                <span className="text-sm font-medium">{onTimeCompletionRate}%</span>
                            </div>
                            <div className="relative h-8">
                                <div className="absolute inset-0 rounded-md bg-muted/30"></div>
                                <div
                                    className="absolute inset-y-0 right-0 rounded-md transition-all duration-500 ease-in-out flex items-center justify-center"
                                    style={{
                                        width: `${onTimeCompletionRate}%`,
                                        backgroundColor: "hsl(var(--status-completed))",
                                        minWidth: '2rem'
                                    }}
                                >
                                    <span className="text-xs font-medium text-white">{completedOnTimeCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* نسبة الإكمال المتأخر */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">الإكمال المتأخر</span>
                                <span className="text-sm font-medium">{100 - onTimeCompletionRate}%</span>
                            </div>
                            <div className="relative h-8">
                                <div className="absolute inset-0 rounded-md bg-muted/30"></div>
                                <div
                                    className="absolute inset-y-0 right-0 rounded-md transition-all duration-500 ease-in-out flex items-center justify-center"
                                    style={{
                                        width: `${100 - onTimeCompletionRate}%`,
                                        backgroundColor: "hsl(var(--status-urgent))",
                                        minWidth: '2rem'
                                    }}
                                >
                                    <span className="text-xs font-medium text-white">{completedWithDueDateCount - completedOnTimeCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* معلومات إضافية */}
                        <div className="pt-2 mt-2 border-t border-border/50 text-xs text-muted-foreground">
                            <p>إجمالي المهام المكتملة مع تاريخ استحقاق: {completedWithDueDateCount}</p>
                            <p>متوسط وقت الإكمال: {averageCompletionDays} يوم</p>
                        </div>
                    </div>
                ) : (
                    <div className="h-[150px] md:h-[200px] flex items-center justify-center text-muted-foreground">
                        لا توجد مهام مكتملة مع تاريخ استحقاق لعرض التحليل.
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Productivity Insights */}
        <Card className="shadow-sm border border-border rounded-lg">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base font-semibold">تحليل الإنتاجية</CardTitle>
                    <CardDescription className="text-xs italic text-muted-foreground">نظرة متعمقة على أدائك وإنتاجيتك</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="space-y-4">
                    {/* نقاط القوة */}
                    <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center">
                            <span className="inline-block w-3 h-3 rounded-full bg-green-500 ml-2"></span>
                            نقاط القوة
                        </h4>
                        <ul className="space-y-1 text-sm pr-5">
                            {completionRate > 50 && (
                                <li className="list-disc">
                                    معدل إنجاز المهام ({completionRate}%) جيد، مما يدل على إنتاجية عالية.
                                </li>
                            )}
                            {onTimeCompletionRate > 70 && (
                                <li className="list-disc">
                                    معدل الإكمال في الوقت المحدد ({onTimeCompletionRate}%) مرتفع، مما يدل على إدارة جيدة للوقت.
                                </li>
                            )}
                            {averageCompletionDays < 7 && tasksWithCompletionTime.length > 0 && (
                                <li className="list-disc">
                                    متوسط وقت إكمال المهام ({averageCompletionDays} يوم) منخفض، مما يدل على كفاءة في العمل.
                                </li>
                            )}
                            {overdueTasks === 0 && totalTasks > 0 && (
                                <li className="list-disc">
                                    لا توجد مهام فائتة، مما يدل على التزام جيد بالمواعيد النهائية.
                                </li>
                            )}
                        </ul>
                    </div>

                    {/* مجالات التحسين */}
                    <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center">
                            <span className="inline-block w-3 h-3 rounded-full bg-amber-500 ml-2"></span>
                            مجالات التحسين
                        </h4>
                        <ul className="space-y-1 text-sm pr-5">
                            {completionRate < 50 && totalTasks > 0 && (
                                <li className="list-disc">
                                    معدل إنجاز المهام ({completionRate}%) منخفض، يمكن تحسينه من خلال تقسيم المهام الكبيرة إلى مهام أصغر.
                                </li>
                            )}
                            {onTimeCompletionRate < 50 && completedWithDueDateCount > 0 && (
                                <li className="list-disc">
                                    معدل الإكمال في الوقت المحدد ({onTimeCompletionRate}%) منخفض، يمكن تحسينه من خلال تحديد مواعيد نهائية أكثر واقعية.
                                </li>
                            )}
                            {overdueTasks > 0 && (
                                <li className="list-disc">
                                    لديك {overdueTasks} مهام فائتة، يجب إعطاؤها الأولوية.
                                </li>
                            )}
                            {onHoldTasks > 0 && (
                                <li className="list-disc">
                                    لديك {onHoldTasks} مهام معلقة، يجب التركيز على حل المشاكل التي تعيقها.
                                </li>
                            )}
                        </ul>
                    </div>

                    {/* توصيات */}
                    <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center">
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500 ml-2"></span>
                            توصيات لتحسين الإنتاجية
                        </h4>
                        <ul className="space-y-1 text-sm pr-5">
                            <li className="list-disc">
                                استخدم تقنية بومودورو (25 دقيقة عمل، 5 دقائق راحة) لزيادة التركيز.
                            </li>
                            <li className="list-disc">
                                حدد أولويات المهام بشكل واضح وركز على المهام ذات الأولوية العالية أولاً.
                            </li>
                            <li className="list-disc">
                                قسم المهام الكبيرة إلى مهام فرعية أصغر يمكن إنجازها بسهولة.
                            </li>
                            <li className="list-disc">
                                خصص وقتًا محددًا يوميًا لمراجعة وتحديث حالة المهام.
                            </li>
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>

    </div>
  );
}

