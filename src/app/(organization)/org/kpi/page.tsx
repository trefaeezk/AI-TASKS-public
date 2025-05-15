'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, AlertTriangle, Target, CheckCircle2, Clock, PauseCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskType, PriorityLevel, TaskStatus, DurationUnit } from '@/types/task';
import { useAuth } from '@/context/AuthContext';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

// --- Chart Configuration ---
const chartConfig = {
    count: {
        label: "عدد المهام",
        color: "hsl(var(--chart-1))", // Use a theme color
    },
    مكتملة: { label: "مكتملة", color: "hsl(var(--status-completed))", icon: CheckCircle2 },
    'قيد الانتظار': { label: "قيد الانتظار", color: "hsl(var(--primary))", icon: Clock },
    فائتة: { label: "فائتة", color: "hsl(var(--status-urgent))", icon: AlertTriangle },
    معلقة: { label: "معلقة", color: "hsl(var(--muted-foreground))", icon: PauseCircle },
} satisfies ChartConfig;

// Status icon mapping for chart tooltip
const statusIconMap: Record<string, React.ElementType> = {
    'مكتملة': CheckCircle2,
    'قيد الانتظار': Clock,
    'فائتة': AlertTriangle,
    'معلقة': PauseCircle,
};

// Status icon mapping for chart tooltip
// Removed unused CustomTooltip component

export default function OrganizationKpiPage() {
  const { user, userClaims } = useAuth();
  const { getCategoryColor } = useTaskCategories(user?.uid);
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const organizationId = userClaims?.organizationId;

  useEffect(() => {
    if (!user || !organizationId) {
        setTasks([]);
        setIsLoading(false);
        setError('يجب تسجيل الدخول وأن تكون عضوًا في مؤسسة لعرض مؤشرات الأداء.');
        return;
    }

    setIsLoading(true);
    setError(null);

    const tasksColRef = collection(db, 'tasks');
    // Fetch all tasks for the organization for KPI analysis with optimized indexing
    const q = query(
      tasksColRef,
      where('organizationId', '==', organizationId),
      orderBy('status', 'asc')
    );

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTasks: TaskType[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          fetchedTasks.push({
            id: doc.id,
            description: data.description || '',
            details: data.details || undefined,
            status: data.status as TaskStatus,
            priority: data.priority as PriorityLevel,
            dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
            startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
            durationValue: data.durationValue || undefined,
            durationUnit: data.durationUnit as DurationUnit || undefined,
            taskCategoryName: data.taskCategoryName || undefined,
            priorityReason: data.priorityReason || undefined,
            milestones: data.milestones ? data.milestones.map((m: any) => ({
              id: m.id,
              description: m.description || '',
              completed: m.completed,
              weight: m.weight || 0,
              dueDate: m.dueDate ? (m.dueDate as Timestamp).toDate() : undefined,
            })) : undefined,
            // إضافة حقول إضافية كخصائص مخصصة
            ...(data.organizationId && { organizationId: data.organizationId }),
            ...(data.departmentId && { departmentId: data.departmentId }),
          });
        });
        setTasks(fetchedTasks);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching tasks for KPI:', err);
        setError('حدث خطأ أثناء جلب بيانات المهام. يرجى المحاولة مرة أخرى.');
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user, organizationId]);

  // --- KPI Calculations ---
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const onHoldTasks = tasks.filter(t => t.status === 'hold').length;
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.dueDate && t.dueDate < new Date()).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // --- Department-based KPI Calculations ---
  const departmentStats = useMemo(() => {
    const stats: Record<string, { total: number, completed: number, pending: number, overdue: number, hold: number }> = {};

    tasks.forEach(task => {
      // استخدام خاصية departmentId كخاصية مخصصة (إذا كانت موجودة)
      const deptId = (task as any).departmentId || 'none';

      if (!stats[deptId]) {
        stats[deptId] = { total: 0, completed: 0, pending: 0, overdue: 0, hold: 0 };
      }

      stats[deptId].total++;

      if (task.status === 'completed') {
        stats[deptId].completed++;
      } else if (task.status === 'pending') {
        stats[deptId].pending++;
        if (task.dueDate && task.dueDate < new Date()) {
          stats[deptId].overdue++;
        }
      } else if (task.status === 'hold') {
        stats[deptId].hold++;
      }
    });

    return stats;
  }, [tasks]);

  // --- Chart Data Preparation ---
  const chartData = useMemo(() => {
    const pendingCount = tasks.filter(t => t.status === 'pending' && !(t.dueDate && t.dueDate < new Date())).length; // Exclude overdue from pending
    const data = [
      { status: 'مكتملة', count: completedTasks, fill: "hsl(var(--status-completed))" },
      { status: 'قيد الانتظار', count: pendingCount, fill: "hsl(var(--primary))" },
      { status: 'فائتة', count: overdueTasks, fill: "hsl(var(--status-urgent))" },
      { status: 'معلقة', count: onHoldTasks, fill: "hsl(var(--muted-foreground))" },
    ];

    // Filter out zero counts for cleaner chart
    return data.filter(item => item.count > 0);
  }, [completedTasks, pendingTasks, onHoldTasks, overdueTasks]);

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
    <div className="space-y-4 md:space-y-6 px-3 md:px-6 overflow-x-hidden max-w-[100vw]" dir="rtl">
      <h1 className="text-lg md:text-2xl font-semibold text-primary flex items-center mt-2">
        <BarChart3 className="ml-2 h-5 w-5 md:h-6 md:w-6"/> مؤشرات الأداء
      </h1>

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

        {/* Pending Tasks Card */}
        <Card className="shadow-sm border border-border rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">المهام قيد الانتظار</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-xl font-bold">{pendingTasks}</div>
            <Progress value={pendingTasks / totalTasks * 100} className="h-1 mt-1" />
          </CardContent>
        </Card>

        {/* Overdue Tasks Card */}
        <Card className="shadow-sm border border-border rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">المهام المتأخرة</CardTitle>
            <AlertTriangle className="h-4 w-4 text-status-urgent" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg md:text-xl font-bold">{overdueTasks}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">{Math.round(overdueTasks / totalTasks * 100)}% من إجمالي المهام</p>
          </CardContent>
        </Card>
      </div>

      {/* Task Status Distribution Chart */}
      <Card className="shadow-sm border border-border rounded-lg">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm sm:text-base font-semibold">توزيع حالات المهام</CardTitle>
          <CardDescription className="text-xs">نظرة عامة على حالة المهام الحالية.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {chartData.length > 0 ? (
            <>
              {/* Desktop Chart - Only show on larger screens */}
              <div className="hidden md:block">
                <div className="aspect-[4/3] sm:aspect-[16/9] h-[200px] md:h-[300px]">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="status" width={80} />
                    <Bar dataKey="count" fill="fill" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ fill: 'var(--foreground)' }}
                        formatter={(value: number) => {
                          const total = chartData.reduce((sum, item) => sum + item.count, 0);
                          const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                          return `${value} (${percentage}%)`;
                        }}
                      />
                    </Bar>
                  </BarChart>
                </div>
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
    </div>
  );
}
