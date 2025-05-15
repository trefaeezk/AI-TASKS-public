'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Wand2, BarChart3, AlertTriangle, ListChecks, Info, FileText } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, writeBatch, doc, Timestamp, orderBy } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// Import the AI service
import { generateDailyPlan, Task } from '@/services/ai';

// Define types for the component
interface DailyPlanTask {
  id: string;
  title: string;
  priority?: number;
  dueDate?: string;
  reasoning: string;
}

interface OverdueWarning {
  id: string;
  title: string;
  dueDate: string;
  reasoning: string;
}
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskType, TaskFirestoreData, PriorityLevel, TaskStatus } from '@/types/task';
import { useAuth } from '@/context/AuthContext';
import { TaskCardTemp } from '@/components/TaskCardTemp';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { Separator } from '@/components/ui/separator';

// Type for tasks displayed in the plan/warnings section, potentially enriched with AI reasoning
// Define two specific types for plan tasks and warning tasks to ensure type safety
type PlanTask = TaskType & { planReasoning: string };
type WarningTask = TaskType & { warningReason: string };
// Combined type for general use
type EnrichedTask = TaskType & { planReasoning?: string; warningReason?: string };

export default function OrganizationReportsPage() {
  const { user, userClaims } = useAuth();
  const { getCategoryColor } = useTaskCategories(user?.uid);
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskType[]>([]); // All relevant tasks (pending, hold)
  const [dailyPlan, setDailyPlan] = useState<EnrichedTask[]>([]); // Enriched tasks for today's plan
  const [overdueWarnings, setOverdueWarnings] = useState<EnrichedTask[]>([]); // Enriched overdue tasks
  const [observations, setObservations] = useState<string[]>([]);
  const [planGenerated, setPlanGenerated] = useState(false); // Flag to track if plan was generated
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const organizationId = userClaims?.organizationId;

  // جلب المهام من Firestore
  useEffect(() => {
    const fetchTasks = async () => {
      if (!user || !organizationId) {
        setIsLoadingTasks(false);
        setError('يجب تسجيل الدخول وأن تكون عضوًا في مؤسسة لعرض التقارير.');
        return;
      }

      setIsLoadingTasks(true);
      setError(null);
      setPlanGenerated(false); // Reset flag on load/refresh

      try {
        const tasksColRef = collection(db, 'tasks');
        // Fetch pending, hold tasks for planning
        const q = query(
          tasksColRef,
          where('organizationId', '==', organizationId),
          where('status', 'in', ['pending', 'hold']), // Fetch only active tasks
          orderBy('priority', 'asc'),
          orderBy('dueDate', 'asc')
        );

        const querySnapshot = await getDocs(q);
        const fetchedTasks: TaskType[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data() as TaskFirestoreData;
          // تحويل البيانات من Firestore إلى TaskType
          const task: TaskType = {
            id: doc.id,
            description: data.description || '',
            status: data.status as TaskStatus,
            priority: data.priority as PriorityLevel,
            dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
            startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
            taskCategoryName: data.taskCategoryName || undefined,
            organizationId: data.organizationId || undefined,
            departmentId: data.departmentId || undefined,
            assignedToUserId: data.assignedToUserId || undefined,
          };
          fetchedTasks.push(task);
        });

        setTasks(fetchedTasks);

        // Auto-generate plan on initial load if there are tasks
        if (fetchedTasks.length > 0) {
          handleGeneratePlan(true); // true indicates auto-generation
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setError('حدث خطأ أثناء جلب المهام. يرجى المحاولة مرة أخرى.');
      } finally {
        setIsLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [user, organizationId]);

  // Helper function to find a task by ID
  const findTaskById = useCallback((taskId: string): TaskType | undefined => {
    return tasks.find(task => task.id === taskId);
  }, [tasks]);

  // إنشاء خطة اليوم باستخدام الذكاء الاصطناعي
  const handleGeneratePlan = async (isAutoGeneration: boolean = false) => {
    if (isGeneratingPlan || tasks.length === 0) return;

    setIsGeneratingPlan(true);
    setError(null);

    try {
      // تحضير المهام للذكاء الاصطناعي
      const tasksForAI: Task[] = tasks.map(task => ({
        id: task.id,
        title: task.description || '',
        description: task.details || '',
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        startDate: task.startDate,
      }));

      // استدعاء تدفق الذكاء الاصطناعي
      const result = await generateDailyPlan(tasksForAI);

      // Process planned tasks
      const enrichedDailyPlan = result.dailyPlan
        .map((plannedTask) => {
          const originalTask = findTaskById(plannedTask.id);
          // Important: Enrich with the reasoning from the AI output
          if (originalTask && plannedTask.reasoning) {
            return {
              ...originalTask,
              planReasoning: plannedTask.reasoning
            } as PlanTask;
          }
          return null;
        })
        .filter((task): task is PlanTask => task !== null);

      // Process overdue warning tasks
      const enrichedOverdueWarnings = result.overdueWarnings
        .map((warning) => {
          const originalTask = findTaskById(warning.id);
          // Important: Enrich with the reasoning from the AI output
          if (originalTask && warning.reasoning) {
            return {
              ...originalTask,
              warningReason: warning.reasoning
            } as WarningTask;
          }
          return null;
        })
        .filter((task): task is WarningTask => task !== null);

      // Set state with the processed tasks
      setDailyPlan(enrichedDailyPlan as EnrichedTask[]);
      setOverdueWarnings(enrichedOverdueWarnings as EnrichedTask[]);
      setObservations(result.observations);
      setPlanGenerated(true); // Set flag after generation

      // Only show toast for manual generation, not auto-generation
      if (!isAutoGeneration) {
        toast({
          title: 'تم إنشاء خطة اليوم',
          description: 'تم اقتراح خطة ليومك بناءً على مهام المؤسسة النشطة.',
        });
      }
    } catch (error) {
      console.error('Error generating plan:', error);
      setError('حدث خطأ أثناء إنشاء الخطة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // تحديث حالة المهمة
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      // تحديث المهمة في Firestore
      await writeBatch(db).update(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: new Date()
      }).commit();

      // تحديث المهمة في الحالة المحلية
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );

      // إزالة المهمة من الخطة أو التحذيرات إذا تم تحديثها إلى "مكتملة"
      if (newStatus === 'completed') {
        setDailyPlan(prev => prev.filter(task => task.id !== taskId));
        setOverdueWarnings(prev => prev.filter(task => task.id !== taskId));
      }

      toast({
        title: 'تم تحديث المهمة',
        description: `تم تغيير حالة المهمة إلى "${newStatus === 'completed' ? 'مكتملة' : newStatus === 'pending' ? 'قيد الانتظار' : 'معلقة'}"`,
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث حالة المهمة.',
        variant: 'destructive',
      });
    }
  };

  // تعديل المهمة
  const handleEditTask = (task: TaskType) => {
    // يمكن تنفيذ هذه الوظيفة لاحقًا
    console.log('Edit task:', task.id);
  };

  // حذف المهمة
  const handleDeleteTask = (taskId: string) => {
    // يمكن تنفيذ هذه الوظيفة لاحقًا
    console.log('Delete task:', taskId);
  };

  return (
    <div dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <ListChecks className="ml-2 h-5 w-5 text-primary" />
              خطة اليوم
            </CardTitle>
            <CardDescription>
              خطة مقترحة لمهام المؤسسة اليومية بناءً على الأولويات والمواعيد
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              الحصول على خطة ذكية لمهام المؤسسة اليومية مع تنبيهات للمهام المتأخرة
            </p>
            <Button asChild className="w-full">
              <Link href="#daily-plan">
                عرض خطة اليوم
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <FileText className="ml-2 h-5 w-5 text-primary" />
              التقارير الأسبوعية
            </CardTitle>
            <CardDescription>
              تقارير أسبوعية شاملة عن مهام وإنجازات المؤسسة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              الحصول على تقارير تفصيلية عن مهام المؤسسة المكتملة والجارية والقادمة
            </p>
            <Button asChild className="w-full">
              <Link href="/org/reports/weekly">
                عرض التقارير الأسبوعية
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card id="daily-plan" className="mb-8 shadow-lg bg-card border-border rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl text-card-foreground flex items-center">
            <ListChecks className="ml-2 h-5 w-5 text-primary" />
            خطة اليوم المقترحة للمؤسسة
          </CardTitle>
          <CardDescription>
            اقتراحات الذكاء الاصطناعي لمهام اليوم بناءً على التواريخ والأولويات، مع تنبيهات للمهام الفائتة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generate Plan Button (Manual trigger) */}
          <div className="text-center">
            <Button
              onClick={() => handleGeneratePlan(false)} // Explicitly pass false for manual trigger
              disabled={isGeneratingPlan || isLoadingTasks}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isGeneratingPlan ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري إنشاء الخطة...
                </>
              ) : (
                <>
                  <Wand2 className="ml-2 h-4 w-4" />
                  إنشاء خطة اليوم
                </>
              )}
            </Button>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>خطأ</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Content Area */}
          {isLoadingTasks ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3 mx-auto rounded-md bg-muted" />
              <Skeleton className="h-20 w-full rounded-md bg-muted" />
              <Skeleton className="h-20 w-full rounded-md bg-muted" />
            </div>
          ) : isGeneratingPlan ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-muted-foreground">جاري إنشاء الخطة بواسطة الذكاء الاصطناعي...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overdue Tasks Section */}
              {overdueWarnings.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-destructive flex items-center">
                    <AlertTriangle className="ml-2 h-5 w-5" />
                    مهام فائتة تتطلب انتباهًا
                  </h3>
                  <ul className="space-y-3">
                    {overdueWarnings.map((task) => (
                      <TaskCardTemp
                        key={task.id}
                        id={task.id}
                        task={task}
                        getCategoryColor={getCategoryColor}
                        aiReasoning={task.warningReason} // Pass warning reason
                        onStatusChange={handleStatusChange} // Optional: Allow status change from reports
                        onEdit={handleEditTask} // Optional: Allow edit from reports
                        onDelete={handleDeleteTask} // Optional: Allow delete from reports
                      />
                    ))}
                  </ul>
                  <Separator />
                </div>
              )}

              {/* Daily Plan Section */}
              {dailyPlan.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center">
                    <ListChecks className="ml-2 h-5 w-5" />
                    مهام مقترحة لليوم
                  </h3>
                  <ul className="space-y-3">
                    {dailyPlan.map((task) => (
                      <TaskCardTemp
                        key={task.id}
                        id={task.id}
                        task={task}
                        getCategoryColor={getCategoryColor}
                        aiReasoning={task.planReasoning} // Pass plan reason
                        onStatusChange={handleStatusChange} // Optional: Allow status change from reports
                        onEdit={handleEditTask} // Optional: Allow edit from reports
                        onDelete={handleDeleteTask} // Optional: Allow delete from reports
                      />
                    ))}
                  </ul>
                  <Separator />
                </div>
              )}

              {/* AI Observations Section */}
              {observations.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-muted-foreground flex items-center">
                    <Info className="ml-2 h-5 w-5" />
                    ملاحظات وتوصيات
                  </h3>
                  <ul className="space-y-2">
                    {observations.map((observation, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start">
                        <span className="ml-2 mt-1">•</span>
                        <span>{observation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Message shown ONLY when loading is done, plan is generated, but there's nothing to show */}
              {!isLoadingTasks && planGenerated && dailyPlan.length === 0 && overdueWarnings.length === 0 && !error && observations.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  لم يتم العثور على مهام مقترحة أو فائتة لهذا اليوم.
                </p>
              )}
              {/* Specific message for no active tasks found after loading and plan generation attempt */}
              {!isLoadingTasks && planGenerated && tasks.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد مهام قيد الانتظار أو معلقة لإنشاء خطة اليوم.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
