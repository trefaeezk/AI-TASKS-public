
'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Removed CalendarWarning, will use AlertTriangle which is already imported
import { Loader2, Wand2, BarChart3, AlertTriangle, ListChecks, Info, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, writeBatch, doc, Timestamp, orderBy } from 'firebase/firestore';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// Import the AI service
import { generateDailyPlan, Task } from '@/services/ai';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskType, TaskFirestoreData, DurationUnit, PriorityLevel, TaskStatus } from '@/types/task'; // Added TaskStatus
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { TaskCardTemp } from '@/components/TaskCardTemp';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { Separator } from '@/components/ui/separator';

// Function to convert Firestore data to TaskType, handling Timestamps and nulls
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
      };
};

// Type for tasks displayed in the plan/warnings section, potentially enriched with AI reasoning
// Define two specific types for plan tasks and warning tasks to ensure type safety
type PlanTask = TaskType & { planReasoning: string };
type WarningTask = TaskType & { warningReason: string };
// Combined type for general use
type EnrichedTask = TaskType & { planReasoning?: string; warningReason?: string };


 function ReportsPage() {
  const { user } = useAuth();
  const { getCategoryColor } = useTaskCategories(user?.uid);
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskType[]>([]); // All relevant tasks (pending, hold)
  const [dailyPlan, setDailyPlan] = useState<EnrichedTask[]>([]); // Enriched tasks for today's plan
  const [overdueWarnings, setOverdueWarnings] = useState<EnrichedTask[]>([]); // Enriched overdue tasks
  const [observations, setObservations] = useState<string[]>([]);
  const [planGenerated, setPlanGenerated] = useState(false); // Flag to track if plan was generated

  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Load Tasks from Firestore ---
  const loadTasks = useCallback(async (forceRefresh = false) => {
      if (!user) {
          setError('يجب تسجيل الدخول لعرض الخطة اليومية.');
          setIsLoadingTasks(false);
          setTasks([]);
          setDailyPlan([]);
          setOverdueWarnings([]);
          setObservations([]);
          setPlanGenerated(false); // Reset flag
          return;
      }
      // Only fetch if tasks are empty or forceRefresh is true
      if (!forceRefresh && tasks.length > 0) {
           setIsLoadingTasks(false); // Avoid reloading if tasks already loaded unless forced
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
              where('userId', '==', user.uid),
              where('status', 'in', ['pending', 'hold']), // Fetch only active tasks
              orderBy('priority', 'asc'),
              orderBy('dueDate', 'asc')
          );
          const querySnapshot = await getDocs(q);
          const fetchedTasks: TaskType[] = [];
          querySnapshot.forEach((doc) => {
              const firestoreData = doc.data() as TaskFirestoreData;
               // Ensure the task belongs to the current user (redundant check due to query, but good practice)
               if (firestoreData.userId === user.uid) {
                    const mappedTask = mapFirestoreTaskToTaskType(doc.id, firestoreData);
                    if (mappedTask) {
                        fetchedTasks.push(mappedTask);
                    }
               } else {
                   console.warn(`Firestore query returned task ${doc.id} for wrong user ${firestoreData.userId}, expected ${user.uid}`);
               }
          });
          setTasks(fetchedTasks);
           console.log("Fetched active tasks for planning:", fetchedTasks.length);

      } catch (err) {
          console.error("Error fetching tasks from Firestore:", err);
          setError('فشل تحميل المهام من قاعدة البيانات.');
          setTasks([]);
      } finally {
          setIsLoadingTasks(false);
      }
  }, [user, tasks.length]); // Depend on user and task length

   useEffect(() => {
      loadTasks();
   }, [loadTasks]); // Initial load trigger


   // --- AI Daily Plan Generation Function ---
   const handleGeneratePlan = useCallback(async (isAutoGenerate = false) => {
       // If auto-generating, check if already generated
       if (isAutoGenerate && planGenerated) {
           console.log("Skipping auto-generation: Plan already generated.");
           return;
       }

        // Re-fetch tasks before generating plan to ensure latest data if triggered manually
        if (!isAutoGenerate) {
           await loadTasks(true); // Force refresh on manual trigger
        }

       // Add a small delay if tasks are still loading from a manual refresh
        if (isLoadingTasks) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
            if (isLoadingTasks) { // Double check after delay
                 toast({ title: 'جاري تحميل المهام...', description: 'يرجى الانتظار لحظة ثم المحاولة مرة أخرى.', variant: 'default' });
                 return;
            }
        }


       if (tasks.length === 0) {
           toast({
               title: 'لا توجد مهام نشطة',
               description: 'لا توجد مهام قيد الانتظار أو معلقة لإنشاء خطة.',
               variant: 'default',
           });
           setDailyPlan([]);
           setOverdueWarnings([]);
           setObservations(['لا توجد مهام نشطة لعرضها في الخطة.']); // Add observation
           setPlanGenerated(true); // Mark as generated (even if empty)
           return;
       }

       setIsGeneratingPlan(true);
       setError(null);
       setDailyPlan([]); // Clear previous plan
       setOverdueWarnings([]);
       setObservations([]);

       try {
           // Prepare input for the AI service using the fetched tasks
            const planInput: Task[] = tasks.map(task => ({
                id: task.id,
                title: task.description,
                description: task.details || '',
                startDate: task.startDate,
                dueDate: task.dueDate,
                priority: task.priority,
                status: task.status, // Pass the current status
            }));

            const result = await generateDailyPlan(planInput);

            console.log("AI Plan Generation Result:", result); // Log AI result

            // Find full task details for planned and overdue tasks from the initially fetched `tasks` state
            const findTaskById = (id: string): TaskType | undefined => tasks.find(t => t.id === id);

            // Process daily plan tasks
            const enrichedDailyPlan = result.dailyPlan
                .map(planned => {
                    const originalTask = findTaskById(planned.id);
                    // Important: Enrich with the reasoning from the AI output
                    if (originalTask && planned.reasoning) {
                        return {
                            ...originalTask,
                            planReasoning: planned.reasoning
                        } as PlanTask;
                    }
                    return null;
                })
                .filter((task): task is PlanTask => task !== null);

            // Process overdue warning tasks
            const enrichedOverdueWarnings = result.overdueWarnings
                .map(warning => {
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

            toast({
                title: 'تم إنشاء خطة اليوم',
                description: 'تم اقتراح خطة ليومك بناءً على مهامك النشطة.',
            });

       } catch (error) {
           console.error('Error generating daily plan:', error);
           setError('حدث خطأ أثناء إنشاء خطة اليوم.');
           toast({
               title: 'خطأ في إنشاء الخطة',
               description: 'حدث خطأ أثناء محاولة إنشاء خطة اليوم بواسطة الذكاء الاصطناعي.',
               variant: 'destructive',
           });
           setDailyPlan([]);
           setOverdueWarnings([]);
           setObservations([]);
            // Don't set planGenerated to true on error
       } finally {
           setIsGeneratingPlan(false);
       }
   }, [tasks, isLoadingTasks, toast, loadTasks, planGenerated]); // Added planGenerated


   // --- Optional: Auto-generate plan on load after tasks are fetched ---
   useEffect(() => {
        // Only attempt auto-generation when tasks finish loading AND plan hasn't been generated yet
       if (!isLoadingTasks && !planGenerated) {
           console.log("Auto-generating plan check: Tasks loaded, plan not generated yet.");
           if (tasks.length > 0) {
               console.log("   - Tasks found, proceeding with auto-generation.");
                handleGeneratePlan(true); // Pass flag indicating auto-generation
           } else {
                console.log("   - No active tasks found, setting observation and marking as generated.");
                setObservations(['لا توجد مهام نشطة لعرضها في الخطة.']);
                setPlanGenerated(true); // Mark as generated (even if empty)
           }
       } else {
             console.log(`Skipping auto-generate effect: isLoadingTasks=${isLoadingTasks}, planGenerated=${planGenerated}`);
       }
   }, [isLoadingTasks, tasks.length, planGenerated, handleGeneratePlan]); // Depend on loading state, task count, flag, and the generation function



   // Placeholders for Edit/Delete/Status Change if needed on this page
    const handleDeleteTask = async (taskId: string) => console.warn("Delete action called on Reports page for task:", taskId);
    const handleEditTask = (task: TaskType) => console.warn("Edit action called on Reports page for task:", task.id);
    const handleStatusChange = (taskId: string, newStatus: TaskStatus) => console.warn("Status change action called on Reports page for task:", taskId, "to", newStatus);


  return (
    <div dir="rtl">

        <Card id="daily-plan" className="mb-8 shadow-lg bg-card border-border rounded-lg">
          <CardHeader>
            <CardTitle className="text-xl text-card-foreground flex items-center">
                <ListChecks className="ml-2 h-5 w-5 text-primary" />
                خطة اليوم المقترحة
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
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      ) : (
                          <Wand2 className="h-4 w-4 ml-2" />
                      )}
                      {planGenerated ? 'إعادة إنشاء الخطة' : 'إنشاء خطة اليوم'}
                  </Button>
              </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>خطأ</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

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

                     {/* Observations Section */}
                    {observations.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center">
                                <Info className="ml-2 h-5 w-5" />
                                ملاحظات الذكاء الاصطناعي
                            </h3>
                             <Alert>
                                <AlertDescription>
                                    <ul className="list-disc list-inside space-y-1">
                                        {observations.map((obs, index) => (
                                            <li key={index}>{obs}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
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
           {/* Footer shows task count only if plan was generated and there were tasks */}
            {!isLoadingTasks && planGenerated && tasks.length > 0 && (
                 <CardFooter className="text-sm text-muted-foreground justify-center pt-4 border-t border-border">
                    تم إنشاء هذه الخطة بواسطة الذكاء الاصطناعي بناءً على {tasks.length} {tasks.length === 1 ? 'مهمة' : 'مهام'} نشطة.
                 </CardFooter>
            )}
        </Card>

    </div>
  );
}

export default ReportsPage;
