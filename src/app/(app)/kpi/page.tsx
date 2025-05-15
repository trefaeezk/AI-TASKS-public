
// src/app/(app)/kpi/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Import missing Target icon, also import CheckCircle2, Percent for KPIs
import { Loader2, Wand2, BarChart3, AlertTriangle, ListChecks, Info, Target, CheckCircle2, Percent, Clock, XCircle, PauseCircle } from 'lucide-react'; // Added Clock, XCircle, PauseCircle
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/config/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore'; // Use onSnapshot for real-time updates

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
    مكتملة: { label: "مكتملة", color: "hsl(var(--status-completed))", icon: CheckCircle2 },
    'قيد الانتظار': { label: "قيد الانتظار", color: "hsl(var(--primary))", icon: Clock }, // Use primary or another color
    فائتة: { label: "فائتة", color: "hsl(var(--status-urgent))", icon: AlertTriangle },
    معلقة: { label: "معلقة", color: "hsl(var(--muted-foreground))", icon: PauseCircle },
} satisfies ChartConfig;

// --- Custom Legend for Chart ---
const CustomChartLegend = (props: any) => {
    const { payload } = props;

    const statusIconMap: Record<string, React.ElementType> = {
        مكتملة: CheckCircle2,
        'قيد الانتظار': Clock,
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
        console.error("Error fetching tasks for KPI:", err);
        setError('حدث خطأ أثناء تحميل بيانات المهام.');
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);


  // --- KPI Calculations ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const onHoldTasks = tasks.filter(t => t.status === 'hold').length;
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.dueDate && t.dueDate < new Date()).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

   // Calculate average progress for tasks with milestones
   const tasksWithMilestones = tasks.filter(t => t.milestones && t.milestones.length > 0);
   const totalProgressSum = tasksWithMilestones.reduce((sum, t) => sum + calculateTaskProgress(t.milestones), 0);
   const averageProgress = tasksWithMilestones.length > 0 ? Math.round(totalProgressSum / tasksWithMilestones.length) : 0;

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        const pendingCount = tasks.filter(t => t.status === 'pending' && !(t.dueDate && t.dueDate < new Date())).length; // Exclude overdue from pending
        const data = [
            { status: 'مكتملة', count: completedTasks, fill: "hsl(var(--status-completed))" },
            { status: 'قيد الانتظار', count: pendingCount, fill: "hsl(var(--primary))" }, // Use primary color
            { status: 'فائتة', count: overdueTasks, fill: "hsl(var(--status-urgent))" },
            { status: 'معلقة', count: onHoldTasks, fill: "hsl(var(--muted-foreground))" },
        ];
        // Sort bars, e.g., by count descending (optional)
        // data.sort((a, b) => b.count - a.count);
        return data.filter(item => item.count > 0); // Only include statuses with counts > 0
    }, [tasks, completedTasks, overdueTasks, onHoldTasks]);

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
                    <p className="text-[10px] md:text-xs text-muted-foreground">{completedTasks} من {totalTasks}</p>
                </CardContent>
            </Card>

            {/* Overdue Tasks Card */}
            <Card className="shadow-sm border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">مهام فائتة</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-status-urgent" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <div className="text-lg md:text-xl font-bold">{overdueTasks}</div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">مهام متأخرة</p>
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

        {/* Task Status Distribution - Responsive version */}
        <Card className="shadow-sm border border-border rounded-lg">
            <CardHeader className="p-4 pb-2">
                {/* Adjusted title size and weight */}
                <CardTitle className="text-sm sm:text-base font-semibold">توزيع حالات المهام</CardTitle>
                <CardDescription className="text-xs">نظرة عامة على حالة المهام الحالية.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                {chartData.length > 0 ? (
                    <>
                        {/* Desktop Chart - Only show on larger screens */}
                        <div className="hidden md:block">
                            <ChartContainer config={chartConfig} className="h-[250px] w-full">
                                <BarChart
                                    data={chartData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                                    barCategoryGap="20%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                                    <XAxis type="number" dataKey="count" hide />
                                    <YAxis
                                        dataKey="status"
                                        type="category"
                                        tickLine={false}
                                        axisLine={true}
                                        stroke="hsl(var(--foreground))"
                                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                        width={60}
                                        tickMargin={5}
                                    />
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel hideIndicator />} />
                                    <Bar dataKey="count" radius={4} background={{ fill: 'hsl(var(--muted) / 0.3)', radius: 4 }}>
                                        {chartData.map((entry, index) => (
                                            <Bar
                                                key={`cell-${index}`}
                                                dataKey="count"
                                                fill={entry.fill}
                                                className="hover:opacity-90 transition-opacity"
                                            />
                                        ))}
                                        <LabelList
                                            dataKey="count"
                                            position="right"
                                            offset={8}
                                            className="fill-foreground"
                                            fontSize={10}
                                            formatter={(value: number) => {
                                                const total = chartData.reduce((sum, item) => sum + item.count, 0);
                                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                                return `${value} (${percentage}%)`;
                                            }}
                                        />
                                    </Bar>
                                    <ChartLegend content={<CustomChartLegend />} verticalAlign="bottom" wrapperStyle={{ paddingTop: '15px' }} />
                                </BarChart>
                            </ChartContainer>
                        </div>

                        {/* Mobile-friendly alternative - Only show on small screens */}
                        <div className="md:hidden space-y-2">
                            {chartData.map((item, index) => {
                                const total = chartData.reduce((sum, item) => sum + item.count, 0);
                                const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                                // استخدام الأيقونات المناسبة لكل حالة
                                const statusIconMap: Record<string, React.ElementType> = {
                                    'مكتملة': CheckCircle2,
                                    'قيد الانتظار': Clock,
                                    'فائتة': AlertTriangle,
                                    'معلقة': PauseCircle,
                                };
                                const IconComponent = statusIconMap[item.status];

                                return (
                                    <div key={index} className="flex items-center space-x-2 space-x-reverse">
                                        <div className="flex items-center space-x-1 space-x-reverse min-w-[80px]">
                                            {IconComponent && (
                                                <IconComponent className="h-3.5 w-3.5" style={{ color: item.fill }} />
                                            )}
                                            <span className="text-xs font-medium">{item.status}</span>
                                        </div>
                                        <div className="flex-1 relative h-7">
                                            <div className="absolute inset-0 rounded-full bg-muted/30"></div>
                                            <div
                                                className="absolute inset-y-0 right-0 rounded-full transition-all duration-500 ease-in-out"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: item.fill
                                                }}
                                            ></div>
                                            <div className="absolute inset-0 flex items-center justify-end px-2">
                                                <span className="text-[10px] font-medium text-foreground">
                                                    {item.count} ({percentage}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Total count */}
                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-border/50 text-xs">
                                <span className="font-medium">المجموع</span>
                                <span>{chartData.reduce((sum, item) => sum + item.count, 0)} مهمة</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-[150px] md:h-[250px] flex items-center justify-center text-muted-foreground">
                        لا توجد بيانات لعرض الرسم البياني.
                    </div>
                )}
            </CardContent>
        </Card>


        {/* Placeholder for future charts/KPIs */}
        {/* <Card className="shadow-md border border-border rounded-lg">
            <CardHeader>
                <CardTitle>تحليل إضافي للمهام</CardTitle>
            </CardHeader>
            <CardContent className="h-48 flex items-center justify-center text-muted-foreground">
                سيتم إضافة رسوم بيانية وتحليلات أخرى هنا قريبًا.
            </CardContent>
        </Card> */}

    </div>
  );
}

