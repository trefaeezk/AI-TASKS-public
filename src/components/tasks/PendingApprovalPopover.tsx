/**
 * مكون منبثق للمهام المعلقة للموافقة
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Bell
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types/task';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TaskApprovalDialog } from './TaskApprovalDialog';

interface PendingApprovalPopoverProps {
  organizationId: string;
  departmentId?: string;
  approvalLevel?: 'department' | 'organization';
}

export function PendingApprovalPopover({
  organizationId,
  departmentId,
  approvalLevel
}: PendingApprovalPopoverProps) {
  const { userClaims } = useAuth();
  
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // جلب المهام المعلقة
  useEffect(() => {
    if (!organizationId) return;

    let q = query(
      collection(db, 'tasks'),
      where('status', '==', 'pending-approval'),
      where('requiresApproval', '==', true),
      where('organizationId', '==', organizationId),
      orderBy('submittedAt', 'desc')
    );

    // تصفية حسب مستوى الموافقة
    if (approvalLevel) {
      q = query(q, where('approvalLevel', '==', approvalLevel));
    }

    // تصفية حسب القسم للمهام على مستوى القسم
    if (approvalLevel === 'department' && departmentId) {
      q = query(q, where('departmentId', '==', departmentId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      
      setPendingTasks(tasks);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pending tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [organizationId, departmentId, approvalLevel]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsApprovalDialogOpen(true);
    setIsPopoverOpen(false);
  };

  const handleApprovalComplete = () => {
    // المهام ستختفي تلقائياً من القائمة بسبب onSnapshot
    setSelectedTask(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'عالية';
      case 'medium': return 'متوسطة';
      case 'low': return 'منخفضة';
      default: return priority;
    }
  };

  // لا تظهر المكون إذا لم يكن المستخدم مسئولاً
  if (!userClaims || (!userClaims.isOrgOwner && !userClaims.isOrgAdmin && !userClaims.isOrgSupervisor)) {
    return null;
  }

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`relative h-8 w-8 ${pendingTasks.length > 0 ? 'text-orange-600 hover:text-orange-700' : ''}`}
            title={`المهام المعلقة للموافقة${pendingTasks.length > 0 ? ` (${pendingTasks.length})` : ''}`}
          >
            <Bell className="h-4 w-4" />
            {pendingTasks.length > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-pulse"
              >
                {pendingTasks.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <h3 className="font-semibold text-sm">المهام المعلقة للموافقة</h3>
            </div>
            {pendingTasks.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingTasks.length}
              </Badge>
            )}
          </div>

          <ScrollArea className="max-h-96">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Clock className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">جاري التحميل...</span>
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد مهام معلقة للموافقة</p>
              </div>
            ) : (
              <div className="p-2">
                {pendingTasks.map((task, index) => (
                  <div key={task.id}>
                    <Button
                      variant="ghost"
                      className="w-full p-3 h-auto justify-start text-right hover:bg-orange-50 border-r-2 border-r-orange-500"
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium line-clamp-2 text-right leading-relaxed">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-1 mr-2 flex-shrink-0">
                            <Badge
                              variant={getPriorityColor(task.priority || 'medium')}
                              className="text-xs"
                            >
                              {getPriorityText(task.priority || 'medium')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.approvalLevel === 'department' ? 'قسم' : 'مؤسسة'}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{task.submittedByName || task.submittedBy || 'مستخدم غير معروف'}</span>
                          </div>
                          {task.submittedAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{format(task.submittedAt.toDate(), 'dd/MM', { locale: ar })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Button>
                    {index < pendingTasks.length - 1 && <Separator className="my-1" />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* حوار الموافقة على المهمة */}
      <TaskApprovalDialog
        task={selectedTask}
        isOpen={isApprovalDialogOpen}
        onOpenChange={setIsApprovalDialogOpen}
        onApprovalComplete={handleApprovalComplete}
      />
    </>
  );
}
