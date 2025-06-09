'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, ChevronDown, ChevronUp, Building, Users, Calendar, AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { getSubtasks } from '@/services/subtasks';
import { TaskType, TaskFirestoreData, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface SubtasksListProps {
  parentTaskId: string;
}

interface Department {
  id: string;
  name: string;
}

interface SubtaskWithDepartment extends TaskType {
  departmentName?: string;
}

export function SubtasksList({ parentTaskId }: SubtasksListProps) {
  const { toast } = useToast();
  const [subtasks, setSubtasks] = useState<SubtaskWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Record<string, Department>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // جلب المهام الفرعية والأقسام
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // جلب المهام الفرعية
        const subtasksData = await getSubtasks(parentTaskId);
        
        if (subtasksData.length === 0) {
          setLoading(false);
          return;
        }
        
        // استخراج معرف المؤسسة من أول مهمة فرعية
        const orgId = subtasksData[0].organizationId;
        setOrganizationId(orgId || null);
        
        // جلب معلومات الأقسام إذا كان هناك معرف مؤسسة
        const departmentsMap: Record<string, Department> = {};
        
        if (orgId) {
          const departmentsQuery = query(
            collection(db, 'organizations', orgId, 'departments')
          );
          const departmentsSnapshot = await getDocs(departmentsQuery);
          
          departmentsSnapshot.forEach((doc) => {
            departmentsMap[doc.id] = {
              id: doc.id,
              name: doc.data().name || 'قسم بدون اسم',
            };
          });
        }
        
        setDepartments(departmentsMap);
        
        // تحويل بيانات المهام الفرعية إلى النوع المطلوب
        const mappedSubtasks: SubtaskWithDepartment[] = subtasksData.map((data, index) => {
          const subtask: SubtaskWithDepartment = {
            id: `subtask-${index}`, // استخدام index كمعرف مؤقت
            description: data.description || '',
            details: data.details || undefined,
            status: data.status || 'pending',
            startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : undefined,
            dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : undefined,
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
              dueDate: m.dueDate instanceof Timestamp ? m.dueDate.toDate() : undefined,
            })) : undefined,
            taskContext: data.taskContext || 'department',
            organizationId: data.organizationId || undefined,
            departmentId: data.departmentId || undefined,
            assignedToUserId: data.assignedToUserId || undefined,
            parentTaskId: data.parentTaskId || undefined,
            departmentName: data.departmentId && departmentsMap[data.departmentId] 
              ? departmentsMap[data.departmentId].name 
              : 'قسم غير معروف',
          };
          
          return subtask;
        });
        
        setSubtasks(mappedSubtasks);
      } catch (error) {
        console.error('Error fetching subtasks:', error);
        toast({
          title: 'خطأ في جلب المهام الفرعية',
          description: 'حدث خطأ أثناء محاولة جلب المهام الفرعية.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [parentTaskId, toast]);

  // حساب التقدم الإجمالي للمهام الفرعية
  const calculateOverallProgress = () => {
    if (subtasks.length === 0) return 0;
    
    const completedTasks = subtasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / subtasks.length) * 100);
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

  // الحصول على لون حالة المهمة
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return 'bg-status-completed';
      case 'hold': return 'bg-muted-foreground/50';
      case 'pending': return 'bg-primary';
      default: return 'bg-primary';
    }
  };

  // الحصول على أيقونة حالة المهمة
  const getStatusIcon = (status: TaskStatus, isOverdue: boolean) => {
    if (isOverdue && status === 'pending') return <AlertTriangle className="h-4 w-4 text-status-urgent" />;
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-status-completed" />;
      case 'hold': return <PauseCircle className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  // التحقق مما إذا كانت المهمة متأخرة
  const isTaskOverdue = (task: SubtaskWithDepartment) => {
    return task.status !== 'completed' && 
           task.status !== 'hold' && 
           task.dueDate && 
           task.dueDate < new Date(new Date().setHours(0,0,0,0));
  };

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">المهام الفرعية</h3>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (subtasks.length === 0) {
    return null;
  }

  const progress = calculateOverallProgress();

  return (
    <div className="space-y-4 mt-4 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center">
          <Users className="ml-2 h-5 w-5 text-primary" />
          المهام الفرعية للأقسام ({subtasks.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-8 px-2"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-sm font-medium">{progress}%</span>
      </div>
      
      {expanded && (
        <div className="space-y-3 mt-2">
          {subtasks.map((subtask) => {
            const isOverdue = isTaskOverdue(subtask);
            
            return (
              <Card key={subtask.id} className={cn(
                "border-r-4",
                isOverdue ? "border-r-status-urgent" : 
                subtask.status === 'completed' ? "border-r-status-completed" : 
                subtask.status === 'hold' ? "border-r-muted-foreground/50" : 
                "border-r-primary"
              )}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className={cn(
                        "text-base",
                        subtask.status === 'completed' && "line-through text-muted-foreground"
                      )}>
                        {subtask.description}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="bg-muted/50">
                          <Building className="ml-1 h-3.5 w-3.5" />
                          {subtask.departmentName}
                        </Badge>
                        
                        {subtask.dueDate && (
                          <span className={cn(
                            "flex items-center text-xs",
                            isOverdue && "text-status-urgent font-medium"
                          )}>
                            <Calendar className="ml-1 h-3.5 w-3.5" />
                            {formatDate(subtask.dueDate)}
                          </span>
                        )}
                        
                        <Badge variant="outline" className={cn(
                          "flex items-center gap-1",
                          isOverdue && "border-status-urgent text-status-urgent",
                          subtask.status === 'completed' && "border-status-completed text-status-completed",
                          subtask.status === 'hold' && "border-muted-foreground/50 text-muted-foreground"
                        )}>
                          {getStatusIcon(subtask.status, isOverdue || false)}
                          {subtask.status === 'pending' && isOverdue ? 'متأخرة' : 
                           subtask.status === 'completed' ? 'مكتملة' : 
                           subtask.status === 'hold' ? 'معلقة' : 'قيد التنفيذ'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                {subtask.milestones && subtask.milestones.length > 0 && (
                  <CardContent className="py-0 px-4 pb-3">
                    <Separator className="mb-2" />
                    <div className="text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">نقاط التتبع:</span>
                        <span className="text-xs">
                          {subtask.milestones.filter(m => m.completed).length} / {subtask.milestones.length}
                        </span>
                      </div>
                      <Progress 
                        value={subtask.milestones.filter(m => m.completed).length / subtask.milestones.length * 100} 
                        className="h-1.5" 
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
