'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Calendar, AlertTriangle, CheckCircle2, PauseCircle, ListChecks, User, Building2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { TaskType, TaskFirestoreData, TaskStatus, Milestone } from '@/types/task';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface AssignedTasksListProps {
  className?: string;
}

export function AssignedTasksList({ className }: AssignedTasksListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignedTasks, setAssignedTasks] = useState<TaskType[]>([]);
  const [assignedMilestones, setAssignedMilestones] = useState<{task: TaskType, milestone: Milestone}[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'milestones'>('tasks');

  // جلب المهام المعينة للمستخدم
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // جلب المهام المعينة للمستخدم
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('assignedToUserId', '==', user.uid)
    );
    
    const unsubscribeTasks = onSnapshot(tasksQuery, async (snapshot) => {
      try {
        const tasks: TaskType[] = [];
        
        for (const doc of snapshot.docs) {
          const data = doc.data() as TaskFirestoreData;
          
          // تحويل البيانات إلى النوع المطلوب
          const task: TaskType = {
            id: doc.id,
            description: data.description || '',
            details: data.details || undefined,
            status: data.status || 'pending',
            startDate: data.startDate ? data.startDate.toDate() : undefined,
            dueDate: data.dueDate ? data.dueDate.toDate() : undefined,
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
          
          tasks.push(task);
        }
        
        setAssignedTasks(tasks);
      } catch (error) {
        console.error('Error fetching assigned tasks:', error);
        toast({
          title: 'خطأ في جلب المهام المعينة',
          description: 'حدث خطأ أثناء محاولة جلب المهام المعينة.',
          variant: 'destructive',
        });
      }
    });
    
    // جلب المهام التي تحتوي على نقاط تتبع معينة للمستخدم
    const milestonesQuery = query(
      collection(db, 'tasks')
    );
    
    const unsubscribeMilestones = onSnapshot(milestonesQuery, async (snapshot) => {
      try {
        const milestonesWithTasks: {task: TaskType, milestone: Milestone}[] = [];
        
        for (const doc of snapshot.docs) {
          const data = doc.data() as TaskFirestoreData;
          
          // التحقق من وجود نقاط تتبع معينة للمستخدم
          if (data.milestones && Array.isArray(data.milestones)) {
            const assignedMilestones = data.milestones.filter(m => m.assignedToUserId === user.uid);
            
            if (assignedMilestones.length > 0) {
              // تحويل البيانات إلى النوع المطلوب
              const task: TaskType = {
                id: doc.id,
                description: data.description || '',
                details: data.details || undefined,
                status: data.status || 'pending',
                startDate: data.startDate ? data.startDate.toDate() : undefined,
                dueDate: data.dueDate ? data.dueDate.toDate() : undefined,
                durationValue: data.durationValue || undefined,
                durationUnit: data.durationUnit || undefined,
                priority: data.priority || undefined,
                priorityReason: data.priorityReason || undefined,
                taskCategoryName: data.taskCategoryName || undefined,
                milestones: data.milestones.map(m => ({
                  id: m.id,
                  description: m.description,
                  completed: m.completed,
                  weight: m.weight,
                  dueDate: m.dueDate ? m.dueDate.toDate() : undefined,
                  assignedToUserId: m.assignedToUserId || undefined
                })),
                taskContext: data.taskContext || 'individual',
                organizationId: data.organizationId || undefined,
                departmentId: data.departmentId || undefined,
                assignedToUserId: data.assignedToUserId || undefined,
                parentTaskId: data.parentTaskId || undefined,
              };
              
              // إضافة كل نقطة تتبع معينة للمستخدم مع المهمة المرتبطة بها
              for (const milestone of assignedMilestones) {
                milestonesWithTasks.push({
                  task,
                  milestone: {
                    id: milestone.id,
                    description: milestone.description,
                    completed: milestone.completed,
                    weight: milestone.weight || 0,
                    dueDate: milestone.dueDate ? milestone.dueDate.toDate() : undefined,
                    assignedToUserId: milestone.assignedToUserId
                  }
                });
              }
            }
          }
        }
        
        setAssignedMilestones(milestonesWithTasks);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching assigned milestones:', error);
        toast({
          title: 'خطأ في جلب نقاط التتبع المعينة',
          description: 'حدث خطأ أثناء محاولة جلب نقاط التتبع المعينة.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    });
    
    return () => {
      unsubscribeTasks();
      unsubscribeMilestones();
    };
  }, [user, toast]);

  // تحديث حالة نقطة التتبع
  const handleToggleMilestoneCompletion = async (taskId: string, milestoneId: string, completed: boolean) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);
      
      if (!taskDoc.exists()) {
        throw new Error('المهمة غير موجودة');
      }
      
      const taskData = taskDoc.data();
      const milestones = taskData.milestones || [];
      
      // تحديث حالة نقطة التتبع
      const updatedMilestones = milestones.map((milestone: any) => {
        if (milestone.id === milestoneId) {
          return {
            ...milestone,
            completed: !completed
          };
        }
        return milestone;
      });
      
      // تحديث المهمة بنقاط التتبع المعدلة
      await updateDoc(taskRef, {
        milestones: updatedMilestones,
        updatedAt: Timestamp.now()
      });
      
      toast({
        title: !completed ? 'تم إكمال نقطة التتبع' : 'تم إعادة فتح نقطة التتبع',
        description: !completed ? 'تم وضع علامة على نقطة التتبع كمكتملة.' : 'تم إعادة فتح نقطة التتبع.',
      });
    } catch (error: any) {
      console.error('Error updating milestone completion:', error);
      toast({
        title: 'خطأ في تحديث حالة نقطة التتبع',
        description: error.message || 'حدث خطأ أثناء محاولة تحديث حالة نقطة التتبع.',
        variant: 'destructive',
      });
    }
  };

  // تنسيق التاريخ
  const formatDate = (date?: Date) => {
    if (!date) return null;
    try {
      return format(date, 'PPP', { locale: ar });
    } catch (e) {
      return null;
    }
  };

  // التحقق مما إذا كانت المهمة متأخرة
  const isTaskOverdue = (task: TaskType) => {
    return task.status !== 'completed' && 
           task.status !== 'hold' && 
           task.dueDate && 
           task.dueDate < new Date(new Date().setHours(0,0,0,0));
  };

  // التحقق مما إذا كانت نقطة التتبع متأخرة
  const isMilestoneOverdue = (milestone: Milestone) => {
    return !milestone.completed && 
           milestone.dueDate && 
           milestone.dueDate < new Date(new Date().setHours(0,0,0,0));
  };

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <h2 className="text-xl font-bold">المهام المعينة لي</h2>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  const hasTasks = assignedTasks.length > 0;
  const hasMilestones = assignedMilestones.length > 0;

  if (!hasTasks && !hasMilestones) {
    return (
      <div className={cn("space-y-4", className)}>
        <h2 className="text-xl font-bold">المهام المعينة لي</h2>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            لا توجد مهام أو نقاط تتبع معينة لك حاليًا.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-xl font-bold flex items-center">
        <User className="ml-2 h-5 w-5 text-primary" />
        المهام المعينة لي
      </h2>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'tasks' | 'milestones')}>
        <TabsList className="mb-4">
          <TabsTrigger value="tasks" disabled={!hasTasks}>
            المهام الكاملة ({assignedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="milestones" disabled={!hasMilestones}>
            نقاط التتبع ({assignedMilestones.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="space-y-4">
          {assignedTasks.map((task) => {
            const isOverdue = isTaskOverdue(task);
            
            return (
              <Card key={task.id} className={cn(
                "border-r-4",
                isOverdue ? "border-r-status-urgent" : 
                task.status === 'completed' ? "border-r-status-completed" : 
                task.status === 'hold' ? "border-r-muted-foreground/50" : 
                "border-r-primary"
              )}>
                <CardHeader className="py-3 px-4">
                  <div className="space-y-1">
                    <CardTitle className={cn(
                      "text-base",
                      task.status === 'completed' && "line-through text-muted-foreground"
                    )}>
                      {task.description}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {task.organizationId && (
                        <Badge variant="outline" className="bg-muted/50">
                          <Building2 className="ml-1 h-3.5 w-3.5" />
                          {task.departmentId ? 'مهمة قسم' : 'مهمة مؤسسة'}
                        </Badge>
                      )}
                      
                      {task.dueDate && (
                        <span className={cn(
                          "flex items-center text-xs",
                          isOverdue && "text-status-urgent font-medium"
                        )}>
                          <Calendar className="ml-1 h-3.5 w-3.5" />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      
                      <Badge variant="outline" className={cn(
                        "flex items-center gap-1",
                        isOverdue && "border-status-urgent text-status-urgent",
                        task.status === 'completed' && "border-status-completed text-status-completed",
                        task.status === 'hold' && "border-muted-foreground/50 text-muted-foreground"
                      )}>
                        {task.status === 'pending' && isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : 
                         task.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : 
                         task.status === 'hold' ? <PauseCircle className="h-3.5 w-3.5" /> : null}
                        {task.status === 'pending' && isOverdue ? 'متأخرة' : 
                         task.status === 'completed' ? 'مكتملة' : 
                         task.status === 'hold' ? 'معلقة' : 'قيد التنفيذ'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                {task.milestones && task.milestones.length > 0 && (
                  <CardContent className="py-0 px-4 pb-3">
                    <Separator className="mb-2" />
                    <div className="text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">نقاط التتبع:</span>
                        <span className="text-xs">
                          {task.milestones.filter(m => m.completed).length} / {task.milestones.length}
                        </span>
                      </div>
                      <Progress 
                        value={task.milestones.filter(m => m.completed).length / task.milestones.length * 100} 
                        className="h-1.5" 
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>
        
        <TabsContent value="milestones" className="space-y-4">
          {assignedMilestones.map(({ task, milestone }) => {
            const isOverdue = isMilestoneOverdue(milestone);
            
            return (
              <Card key={`${task.id}-${milestone.id}`} className={cn(
                "border-r-4",
                isOverdue ? "border-r-status-urgent" : 
                milestone.completed ? "border-r-status-completed" : 
                "border-r-primary"
              )}>
                <CardHeader className="py-3 px-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className={cn(
                        "text-base",
                        milestone.completed && "line-through text-muted-foreground"
                      )}>
                        {milestone.description}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 p-0",
                          milestone.completed ? "text-status-completed" : "text-muted-foreground"
                        )}
                        onClick={() => handleToggleMilestoneCompletion(task.id, milestone.id, milestone.completed)}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="sr-only">
                          {milestone.completed ? 'إعادة فتح نقطة التتبع' : 'وضع علامة كمكتملة'}
                        </span>
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="bg-muted/50">
                        <ListChecks className="ml-1 h-3.5 w-3.5" />
                        نقطة تتبع
                      </Badge>
                      
                      <Badge variant="outline" className="bg-muted/50">
                        من مهمة: {task.description}
                      </Badge>
                      
                      {milestone.dueDate && (
                        <span className={cn(
                          "flex items-center text-xs",
                          isOverdue && "text-status-urgent font-medium"
                        )}>
                          <Calendar className="ml-1 h-3.5 w-3.5" />
                          {formatDate(milestone.dueDate)}
                        </span>
                      )}
                      
                      <Badge variant="outline" className={cn(
                        "flex items-center gap-1",
                        isOverdue && "border-status-urgent text-status-urgent",
                        milestone.completed && "border-status-completed text-status-completed"
                      )}>
                        {!milestone.completed && isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : 
                         milestone.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        {!milestone.completed && isOverdue ? 'متأخرة' : 
                         milestone.completed ? 'مكتملة' : 'قيد التنفيذ'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
