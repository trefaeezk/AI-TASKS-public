'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Clock,
  CheckCircle,
  Circle,
  Users,
  Target,
  TrendingUp,
  AlertCircle,
  Download,
  Printer,
  ArrowLeft,
  Plus,
  Wand2,
  Loader2,
  ListChecks,
  Info,
  AlertTriangle,
  Building,
  Tag
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, where, getDocs, orderBy, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateDailyPlan, Task } from '@/services/ai';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { TaskType, TaskFirestoreData, DurationUnit, PriorityLevel, TaskStatus } from '@/types/task';
import type { UserRole } from '@/types/roles';

interface DailyPlanReportProps {
  organizationId: string;
  onBack: () => void;
}

// Type for tasks displayed in the plan/warnings section, potentially enriched with AI reasoning
type PlanTask = TaskType & { planReasoning: string };
type WarningTask = TaskType & { warningReason: string };
type EnrichedTask = TaskType & { planReasoning?: string; warningReason?: string };

// Function to convert Firestore data to TaskType for organization tasks
const mapFirestoreTaskToTaskType = (id: string, data: TaskFirestoreData): TaskType | null => {
  if (!data.description || !data.status || !data.organizationId) {
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
    startDate: data.startDate ? data.startDate.toDate() : undefined,
    dueDate: data.dueDate ? data.dueDate.toDate() : undefined,
    durationValue: data.durationValue ?? undefined,
    durationUnit: data.durationUnit ?? undefined,
    priority: priority,
    priorityReason: data.priorityReason ?? undefined,
    status: data.status,
    taskCategoryName: data.taskCategoryName ?? undefined,
  };
};

export function DailyPlanReport({ organizationId, onBack }: DailyPlanReportProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [dailyPlan, setDailyPlan] = useState<EnrichedTask[]>([]);
  const [overdueWarnings, setOverdueWarnings] = useState<EnrichedTask[]>([]);
  const [observations, setObservations] = useState<string[]>([]);
  const [planGenerated, setPlanGenerated] = useState(false);

  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { user, userClaims } = useAuth();
  const userDepartmentId = userClaims?.departmentId;

  // دالة لتحديد لون الأولوية
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 border-red-200';
      case 'medium':
        return 'text-yellow-600 border-yellow-200';
      case 'low':
        return 'text-green-600 border-green-200';
      default:
        return 'text-gray-600 border-gray-200';
    }
  };

  // دالة لتنسيق الوقت
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}س ${mins > 0 ? `${mins}د` : ''}`;
    }
    return `${mins}د`;
  };

  // تحديد صلاحيات المستخدم
  const getUserPermissions = useCallback(() => {
    const isSystemOwner = userClaims?.isSystemOwner === true;
    const isSystemAdmin = userClaims?.isSystemAdmin === true;
    const isOrgOwner = userClaims?.isOrgOwner === true;
    const isOrgAdmin = userClaims?.isOrgAdmin === true;
    const isOrgSupervisor = userClaims?.isOrgSupervisor === true;
    const isOrgEngineer = userClaims?.isOrgEngineer === true;
    const isOrgTechnician = userClaims?.isOrgTechnician === true;
    const isOrgAssistant = userClaims?.isOrgAssistant === true;

    // مالك ومدير المؤسسة بدون قسم محدد (وصول كامل)
    const hasFullAccess = (isOrgOwner || isOrgAdmin) && !userDepartmentId;

    // الأدوار العليا التي يمكنها رؤية جميع المهام
    const canViewAllTasks = isSystemOwner || isSystemAdmin || hasFullAccess;

    // أعضاء الأقسام
    const isDepartmentMember = userDepartmentId && (isOrgSupervisor || isOrgEngineer || isOrgTechnician || isOrgAssistant);

    // المهندسون والمشرفون يرون جميع مهام القسم
    const canViewDepartmentTasks = isOrgEngineer || isOrgSupervisor;

    return {
      canViewAllTasks,
      isDepartmentMember,
      canViewDepartmentTasks,
      userDepartmentId,
      userId: user?.uid
    };
  }, [userClaims, userDepartmentId, user?.uid]);

  // Load Tasks from Firestore for the organization
  const loadTasks = useCallback(async (forceRefresh = false) => {
    if (!organizationId || !user) {
      setError('معرف المؤسسة ومعلومات المستخدم مطلوبة لعرض الخطة اليومية.');
      setIsLoadingTasks(false);
      setTasks([]);
      setDailyPlan([]);
      setOverdueWarnings([]);
      setObservations([]);
      setPlanGenerated(false);
      return;
    }

    // Only fetch if tasks are empty or forceRefresh is true
    if (!forceRefresh && tasks.length > 0) {
      setIsLoadingTasks(false);
      return;
    }

    setIsLoadingTasks(true);
    setError(null);
    setPlanGenerated(false);

    try {
      const permissions = getUserPermissions();
      const tasksColRef = collection(db, 'tasks');

      // إنشاء الاستعلام الأساسي
      let q = query(
        tasksColRef,
        where('organizationId', '==', organizationId),
        where('status', '==', 'hold'), // Fetch only active tasks
        orderBy('priority', 'asc'),
        orderBy('dueDate', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const fetchedTasks: TaskType[] = [];

      for (const docSnapshot of querySnapshot.docs) {
        const firestoreData = docSnapshot.data() as TaskFirestoreData;
        if (firestoreData.organizationId === organizationId) {

          // تطبيق فلتر الصلاحيات
          const shouldIncludeTask = () => {
            // الإدارة العليا ترى جميع المهام - بدون المهام الفرعية في مهام القسم
            if (permissions.canViewAllTasks) {
              // استبعاد المهام الفرعية من مهام القسم العامة
              if (firestoreData.taskContext === 'department' && firestoreData.parentTaskId !== undefined && firestoreData.parentTaskId !== null) {
                return false;
              }
              return true;
            }

            // أعضاء الأقسام
            if (permissions.isDepartmentMember) {
              // يجب أن تكون المهمة في نفس القسم
              if (firestoreData.departmentId !== permissions.userDepartmentId) {
                return false;
              }

              // المهندسون والمشرفون يرون جميع مهام القسم - بدون المهام الفرعية المُسندة للأفراد
              if (permissions.canViewDepartmentTasks) {
                // استبعاد المهام الفرعية من مهام القسم العامة
                if (firestoreData.taskContext === 'department' && firestoreData.parentTaskId !== undefined && firestoreData.parentTaskId !== null) {
                  return false;
                }
                return true;
              }

              // الفنيون والمساعدون يرون:
              // 1. مهام القسم العامة (taskContext === 'department') - بدون المهام الفرعية
              // 2. مهامهم الشخصية المكلفين بها فقط
              const isGeneralDeptTask = firestoreData.taskContext === 'department' && (firestoreData.parentTaskId === undefined || firestoreData.parentTaskId === null);
              const isMyPersonalTask = firestoreData.taskContext === 'individual' &&
                                      (firestoreData.assignedToUserId === permissions.userId ||
                                       (firestoreData.assignedToUserIds && firestoreData.assignedToUserIds.includes(permissions.userId)) ||
                                       firestoreData.createdBy === permissions.userId);

              return isGeneralDeptTask || isMyPersonalTask;
            }

            // إذا لم يكن لديه صلاحيات، لا يرى أي مهام
            return false;
          };

          if (!shouldIncludeTask()) {
            continue;
          }

          const mappedTask = mapFirestoreTaskToTaskType(docSnapshot.id, firestoreData);
          if (mappedTask) {
            // إضافة معلومات إضافية للمهمة
            const enrichedTask = {
              ...mappedTask,
              departmentId: firestoreData.departmentId || undefined,
              assignedToUserId: firestoreData.assignedToUserId || undefined,
              taskContext: firestoreData.taskContext || undefined,
              createdBy: firestoreData.createdBy || undefined,
            };

            // جلب اسم القسم إذا كان متاحًا
            if (firestoreData.departmentId) {
              try {
                const deptDocRef = firestoreDoc(db, 'organizations', organizationId, 'departments', firestoreData.departmentId);
                const deptDoc = await getDoc(deptDocRef);
                if (deptDoc.exists()) {
                  const deptData = deptDoc.data() as { name?: string };
                  (enrichedTask as any).departmentName = deptData.name;
                }
              } catch (error) {
                console.error('Error fetching department name:', error);
              }
            }

            // جلب اسم المستخدم المكلف إذا كان متاحًا
            if (firestoreData.assignedToUserId) {
              try {
                const memberDocRef = firestoreDoc(db, 'organizations', organizationId, 'members', firestoreData.assignedToUserId);
                const memberDoc = await getDoc(memberDocRef);
                if (memberDoc.exists()) {
                  const memberData = memberDoc.data() as { displayName?: string; name?: string };
                  (enrichedTask as any).assignedToUserName = memberData.displayName || memberData.name || 'مستخدم غير معروف';
                }
              } catch (error) {
                console.error('Error fetching user name:', error);
              }
            }

            fetchedTasks.push(enrichedTask);
          }
        } else {
          console.warn(`Firestore query returned task ${docSnapshot.id} for wrong organization ${firestoreData.organizationId}, expected ${organizationId}`);
        }
      }

      setTasks(fetchedTasks);
      console.log("Fetched active tasks for organization planning:", fetchedTasks.length);
      console.log("User permissions:", permissions);

    } catch (err) {
      console.error("Error fetching tasks from Firestore:", err);
      setError('فشل تحميل المهام من قاعدة البيانات.');
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [organizationId, tasks.length, getUserPermissions, user]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // AI Daily Plan Generation Function
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
      setObservations(['لا توجد مهام نشطة لعرضها في الخطة.']);
      setPlanGenerated(true);
      return;
    }

    setIsGeneratingPlan(true);
    setError(null);
    setDailyPlan([]);
    setOverdueWarnings([]);
    setObservations([]);

    try {
      const permissions = getUserPermissions();

      // Prepare input for the AI service using the fetched tasks
      const planInput: Task[] = tasks.map(task => ({
        id: task.id,
        description: task.description, // استخدام description بدلاً من title
        details: task.details || '',
        startDate: task.startDate,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        // إضافة معلومات المؤسسة والقسم إذا كانت متاحة
        departmentId: (task as any).departmentId,
        departmentName: (task as any).departmentName,
        assignedToUserId: (task as any).assignedToUserId,
        assignedToUserName: (task as any).assignedToUserName,
        taskContext: (task as any).taskContext,
        createdBy: (task as any).createdBy,
      }));

      // إضافة معلومات السياق للذكاء الاصطناعي
      const contextInfo = {
        userRole: userClaims?.role || 'unknown',
        userDepartmentId: permissions.userDepartmentId,
        canViewAllTasks: permissions.canViewAllTasks,
        isDepartmentMember: permissions.isDepartmentMember,
        canViewDepartmentTasks: permissions.canViewDepartmentTasks,
        organizationId,
        userId: permissions.userId
      };

      console.log("Sending to AI - Organization tasks:", planInput.length);
      console.log("User context:", contextInfo);
      console.log("Sample task data:", planInput[0]);

      const result = await generateDailyPlan(planInput);

      console.log("AI Plan Generation Result:", result);

      // Find full task details for planned and overdue tasks from the initially fetched `tasks` state
      const findTaskById = (id: string): TaskType | undefined => tasks.find(t => t.id === id);

      // Process daily plan tasks
      const enrichedDailyPlan = result.dailyPlan
        .map(planned => {
          const originalTask = findTaskById(planned.id);
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
      setPlanGenerated(true);

      toast({
        title: 'تم إنشاء خطة اليوم',
        description: 'تم اقتراح خطة ليومك بناءً على مهام المؤسسة النشطة.',
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
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [tasks, isLoadingTasks, toast, loadTasks, planGenerated]);

  // Auto-generate plan on load after tasks are fetched
  useEffect(() => {
    if (!isLoadingTasks && !planGenerated) {
      console.log("Auto-generating plan check: Tasks loaded, plan not generated yet.");
      if (tasks.length > 0) {
        console.log("   - Tasks found, proceeding with auto-generation.");
        handleGeneratePlan(true);
      } else {
        console.log("   - No active tasks found, setting observation and marking as generated.");
        setObservations(['لا توجد مهام نشطة لعرضها في الخطة.']);
        setPlanGenerated(true);
      }
    } else {
      console.log(`Skipping auto-generate effect: isLoadingTasks=${isLoadingTasks}, planGenerated=${planGenerated}`);
    }
  }, [isLoadingTasks, tasks.length, planGenerated, handleGeneratePlan]);

  // حساب الإحصائيات
  const stats = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    totalEstimatedTime: tasks.reduce((sum, t) => sum + (t.durationValue || 60), 0),
    totalActualTime: 0, // يمكن حسابها لاحقاً
    completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0,
    plannedTasks: dailyPlan.length,
    overdueTasksCount: overdueWarnings.length
  };

  // Placeholders for Edit/Delete/Status Change if needed on this page
  const handleDeleteTask = async (taskId: string) => console.warn("Delete action called on Reports page for task:", taskId);
  const handleEditTask = (task: TaskType) => console.warn("Edit action called on Reports page for task:", task.id);
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => console.warn("Status change action called on Reports page for task:", taskId, "to", newStatus);



  return (
    <div className="space-y-6">
      {/* العنوان والتنقل */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <Calendar className="ml-2 h-6 w-6" />
              الخطة اليومية
            </h1>
            <p className="text-muted-foreground">
              {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ar })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
            اليوم السابق
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
            اليوم
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
            اليوم التالي
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm">
            <Printer className="ml-2 h-4 w-4" />
            طباعة
          </Button>
          <Button variant="outline" size="sm">
            <Download className="ml-2 h-4 w-4" />
            تحميل
          </Button>
        </div>
      </div>

      {/* AI Daily Plan Card */}
      <Card className="mb-6 shadow-lg bg-card border-border rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl text-card-foreground flex items-center">
            <ListChecks className="ml-2 h-5 w-5 text-primary" />
            خطة اليوم المقترحة بالذكاء الاصطناعي
          </CardTitle>
          <CardDescription>
            اقتراحات الذكاء الاصطناعي لمهام اليوم بناءً على التواريخ والأولويات، مع تنبيهات للمهام الفائتة.
            {(() => {
              const permissions = getUserPermissions();
              if (permissions.canViewAllTasks) {
                return " (عرض جميع مهام المؤسسة)";
              } else if (permissions.isDepartmentMember && permissions.canViewDepartmentTasks) {
                return " (عرض مهام القسم)";
              } else if (permissions.isDepartmentMember) {
                return " (عرض مهام القسم العامة والمهام الشخصية)";
              }
              return "";
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generate Plan Button */}
          <div className="text-center">
            <Button
              onClick={() => handleGeneratePlan(false)}
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
                    مهام فائتة تتطلب انتباهًا ({overdueWarnings.length})
                  </h3>
                  <div className="space-y-4">
                    {overdueWarnings.map((task) => (
                      <Card key={task.id} className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-red-900 text-base">{task.description}</h4>
                                <Badge variant="destructive" className="text-xs">
                                  فائتة
                                </Badge>
                              </div>

                              {task.details && (
                                <p className="text-sm text-red-700 mb-3 leading-relaxed">{task.details}</p>
                              )}

                              {/* معلومات المهمة */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                                {/* الأولوية */}
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 text-gray-500" />
                                  <span className="text-xs text-gray-600">الأولوية:</span>
                                  <Badge variant="outline" className={getPriorityColor(task.priority === 1 ? 'high' : task.priority === 2 ? 'high' : task.priority === 3 ? 'medium' : task.priority === 4 ? 'low' : task.priority === 5 ? 'low' : 'medium')}>
                                    {task.priority === 1 || task.priority === 2 ? 'عالية' : task.priority === 3 ? 'متوسطة' : 'منخفضة'}
                                  </Badge>
                                </div>

                                {/* المكلف بالمهمة */}
                                {(task as any).assignedToUserName && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">المكلف:</span>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      {(task as any).assignedToUserName}
                                    </Badge>
                                  </div>
                                )}

                                {/* القسم */}
                                {(task as any).departmentName && (
                                  <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">القسم:</span>
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                      {(task as any).departmentName}
                                    </Badge>
                                  </div>
                                )}

                                {/* الفئة */}
                                {task.taskCategoryName && (
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">الفئة:</span>
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                      {task.taskCategoryName}
                                    </Badge>
                                  </div>
                                )}

                                {/* الوقت المقدر */}
                                {task.durationValue && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">المدة:</span>
                                    <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                      {formatTime(task.durationValue)}
                                    </Badge>
                                  </div>
                                )}

                                {/* تاريخ الاستحقاق */}
                                {task.dueDate && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">الاستحقاق:</span>
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                      {format(task.dueDate, 'dd/MM/yyyy', { locale: ar })}
                                    </Badge>
                                    {task.dueDate < new Date() && (
                                      <span className="text-xs text-red-600 font-medium">
                                        (متأخرة {Math.ceil((new Date().getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24))} يوم)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* تحليل الذكاء الاصطناعي */}
                              {task.warningReason && (
                                <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs font-medium text-red-800 mb-1">تحليل الذكاء الاصطناعي:</p>
                                      <p className="text-xs text-red-700 leading-relaxed">{task.warningReason}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Separator />
                </div>
              )}

              {/* Daily Plan Section */}
              {dailyPlan.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center">
                    <ListChecks className="ml-2 h-5 w-5" />
                    مهام مقترحة لليوم ({dailyPlan.length})
                  </h3>
                  <div className="space-y-4">
                    {dailyPlan.map((task) => (
                      <Card key={task.id} className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-blue-900 text-base">{task.description}</h4>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                  مقترحة
                                </Badge>
                              </div>

                              {task.details && (
                                <p className="text-sm text-blue-700 mb-3 leading-relaxed">{task.details}</p>
                              )}

                              {/* معلومات المهمة */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                                {/* الأولوية */}
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 text-gray-500" />
                                  <span className="text-xs text-gray-600">الأولوية:</span>
                                  <Badge variant="outline" className={getPriorityColor(task.priority === 1 ? 'high' : task.priority === 2 ? 'high' : task.priority === 3 ? 'medium' : task.priority === 4 ? 'low' : task.priority === 5 ? 'low' : 'medium')}>
                                    {task.priority === 1 || task.priority === 2 ? 'عالية' : task.priority === 3 ? 'متوسطة' : 'منخفضة'}
                                  </Badge>
                                </div>

                                {/* المكلف بالمهمة */}
                                {(task as any).assignedToUserName && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">المكلف:</span>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      {(task as any).assignedToUserName}
                                    </Badge>
                                  </div>
                                )}

                                {/* القسم */}
                                {(task as any).departmentName && (
                                  <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">القسم:</span>
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                      {(task as any).departmentName}
                                    </Badge>
                                  </div>
                                )}

                                {/* الفئة */}
                                {task.taskCategoryName && (
                                  <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">الفئة:</span>
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                      {task.taskCategoryName}
                                    </Badge>
                                  </div>
                                )}

                                {/* الوقت المقدر */}
                                {task.durationValue && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">المدة:</span>
                                    <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                      {formatTime(task.durationValue)}
                                    </Badge>
                                  </div>
                                )}

                                {/* تاريخ الاستحقاق */}
                                {task.dueDate && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <span className="text-xs text-gray-600">الاستحقاق:</span>
                                    <Badge variant="outline" className={
                                      task.dueDate < new Date()
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                    }>
                                      {format(task.dueDate, 'dd/MM/yyyy', { locale: ar })}
                                    </Badge>
                                  </div>
                                )}
                              </div>

                              {/* تحليل الذكاء الاصطناعي */}
                              {task.planReasoning && (
                                <div className="mt-3 p-3 bg-blue-100 border border-blue-200 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <Wand2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs font-medium text-blue-800 mb-1">تحليل الذكاء الاصطناعي:</p>
                                      <p className="text-xs text-blue-700 leading-relaxed">{task.planReasoning}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Separator />
                </div>
              )}

              {/* Observations Section */}
              {observations.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground flex items-center">
                    <Info className="ml-2 h-5 w-5" />
                    ملاحظات وتوصيات الذكاء الاصطناعي ({observations.length})
                  </h3>
                  <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-white">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {observations.map((obs, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-indigo-600">{index + 1}</span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-indigo-800 leading-relaxed">{obs}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Message shown when no plan is available */}
              {!isLoadingTasks && planGenerated && dailyPlan.length === 0 && overdueWarnings.length === 0 && !error && observations.length === 0 && (
                <Card className="border-dashed border-2 border-gray-200">
                  <CardContent className="p-8 text-center">
                    <ListChecks className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">لا توجد مهام مقترحة</h3>
                    <p className="text-muted-foreground">
                      لم يتم العثور على مهام مقترحة أو فائتة لهذا اليوم.
                    </p>
                  </CardContent>
                </Card>
              )}

              {!isLoadingTasks && planGenerated && tasks.length === 0 && (
                <Card className="border-dashed border-2 border-gray-200">
                  <CardContent className="p-8 text-center">
                    <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">لا توجد مهام نشطة</h3>
                    <p className="text-muted-foreground">
                      لا توجد مهام قيد الانتظار أو معلقة لإنشاء خطة اليوم.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>

        {/* Footer shows task count only if plan was generated and there were tasks */}
        {!isLoadingTasks && planGenerated && tasks.length > 0 && (
          <div className="text-sm text-muted-foreground text-center pb-4 border-t border-border pt-4">
            تم إنشاء هذه الخطة بواسطة الذكاء الاصطناعي بناءً على {tasks.length} {tasks.length === 1 ? 'مهمة' : 'مهام'} نشطة.
          </div>
        )}
      </Card>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">إجمالي المهام</p>
                <p className="text-2xl font-bold">{stats.totalTasks}</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">مهام مقترحة</p>
                <p className="text-2xl font-bold text-green-600">{stats.plannedTasks}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">مهام فائتة</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdueTasksCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">الوقت المقدر</p>
                <p className="text-2xl font-bold">{formatTime(stats.totalEstimatedTime)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>


    </div>
  );
}
