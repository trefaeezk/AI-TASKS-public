
'use client';

import type { TaskType, DurationUnit, TaskStatus, PriorityLevel, Milestone, MilestoneFirestoreData } from '@/types/task';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, MoreHorizontal, Edit, Trash2, GripVertical, Tag, CircleHelp, Info, ListChecks, Share2, Target, User as UserIcon, X } from 'lucide-react'; // Renamed User to UserIcon
import { CreateSubtasksDialog } from './CreateSubtasksDialog';
import { SubtasksList } from './SubtasksList';
import { AssignTaskToMembersDialog } from './AssignTaskToMembersDialog';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MilestoneTracker } from './MilestoneTracker';
import { db } from '@/config/firebase';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { v4 as uuidv4 } from 'uuid';
import { updateParentTaskComprehensive, updateSubtasksFromParent, calculateTaskStatusFromMilestones, resetMilestonesOnReopen } from '@/services/parentTaskUpdater';
import { OkrTaskBadge } from './okr/OkrTaskBadge';
import { TaskKeyResultBadge } from './okr/TaskKeyResultBadge';
import { CompactAssigneesList } from './CompactAssigneesList';
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { ReopenTaskDialog } from './ReopenTaskDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { categoryInfo, TaskCategory } from '@/context/TaskPageContext';

interface TaskCardTempProps {
  task: TaskType;
  id: string;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onEdit?: (task: TaskType) => void;
  onDelete?: (taskId: string) => void;
  getCategoryColor?: (categoryName?: string) => string | undefined;
  aiReasoning?: string;
  currentCategory?: string;
}

// Helper to safely format date
const formatDateSafe = (dateInput: Date | undefined): string | null => {
  if (!dateInput || !(dateInput instanceof Date) || isNaN(dateInput.getTime())) {
      return null;
  }
  try {
    return format(dateInput, 'PPP', { locale: ar });
  } catch (e) {
    console.error("Error formatting date:", e);
    return null;
  }
};

// Helper to display duration
const formatDuration = (value?: number, unit?: DurationUnit): string | null => {
  if (value === undefined || value === null || !unit) return null;
  let unitText = '';
  switch (unit) {
    case 'hours': unitText = value === 1 ? 'ساعة' : value === 2 ? 'ساعتان' : value <= 10 ? 'ساعات' : 'ساعة'; break;
    case 'days': unitText = value === 1 ? 'يوم' : value === 2 ? 'يومان' : value <= 10 ? 'أيام' : 'يوم'; break;
    case 'weeks': unitText = value === 1 ? 'أسبوع' : value === 2 ? 'أسبوعان' : value <= 10 ? 'أسابيع' : 'أسبوع'; break;
    default: return null;
  }
  return `${value} ${unitText}`;
};

// Helper function to truncate text to the first line or a certain length
const getFirstLine = (text?: string): string => {
    if (!text) return '';
    const maxLength = 80;
    const firstNewlineIndex = text.indexOf('\n');

    if (firstNewlineIndex === -1) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    } else {
        const firstLineContent = text.substring(0, firstNewlineIndex);
         const truncatedFirstLine = firstLineContent.length > maxLength ? firstLineContent.substring(0, maxLength) + '...' : firstLineContent;
        const hasMoreContent = text.length > firstNewlineIndex + 1;
        return (hasMoreContent || firstLineContent.length > maxLength) ? truncatedFirstLine + '...' : truncatedFirstLine;
    }
};

// Function to calculate overall task progress based on milestones
const calculateTaskProgress = (milestones?: Milestone[]): number => {
    if (!milestones || milestones.length === 0) return 0;
    const totalWeight = milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
    if (totalWeight === 0) return 0;
    const completedWeight = milestones.reduce((sum, m) => sum + (m.completed ? (m.weight || 0) : 0), 0);
    return Math.round((completedWeight / totalWeight) * 100);
};

const TaskCardTempComponent = ({ task, id, onStatusChange, onEdit, onDelete, getCategoryColor, aiReasoning, currentCategory }: TaskCardTempProps) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isMilestonesExpanded, setIsMilestonesExpanded] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);

  const { toast } = useToast();
  const { user, userClaims } = useAuth(); // Get userClaims from useAuth

  const getAvailableActions = () => {
    const actions = {
      canComplete: false,
      canReopen: false,
      canHold: false,
      canActivate: false,
      canRestart: false,
      canCancel: false
    };

    const canModifyTask = () => {
      if (userClaims?.isOrgOwner || userClaims?.isOrgAdmin) {
        return true;
      }
      if (userClaims?.isOrgEngineer || userClaims?.isOrgSupervisor) {
        if (task.departmentId === userClaims?.departmentId) {
          return true;
        }
        if (task.assignedToUserId === user?.uid ||
            (task.assignedToUserIds && user?.uid && task.assignedToUserIds.includes(user.uid))) {
          return true;
        }
        if (task.userId === user?.uid || task.createdBy === user?.uid) {
          return true;
        }
        return false;
      }
      if (userClaims?.isOrgTechnician || userClaims?.isOrgAssistant) {
        return task.assignedToUserId === user?.uid ||
               (task.assignedToUserIds && user?.uid && task.assignedToUserIds.includes(user.uid)) ||
               (task.userId === user?.uid || task.createdBy === user?.uid);
      }
      // For individual tasks, or if no specific org role matches
      if (task.userId === user?.uid || task.createdBy === user?.uid || task.assignedToUserId === user?.uid || (task.assignedToUserIds && user?.uid && task.assignedToUserIds.includes(user.uid))) {
        return true;
      }
      return false;
    };

    if (!canModifyTask()) {
      return actions;
    }

    switch (currentCategory) {
      case 'completed':
        actions.canReopen = true;
        break;
      case 'cancelled':
        actions.canRestart = true;
        break;
      case 'hold':
        actions.canComplete = true;
        actions.canActivate = true;
        actions.canCancel = true;
        break;
      case 'today':
      case 'upcoming':
      case 'scheduled':
      case 'overdue':
      default:
        if (task.status === 'pending' || task.status === 'in-progress') {
            actions.canComplete = true;
            actions.canHold = true;
            actions.canCancel = true;
        } else if (task.status === 'hold') {
            actions.canComplete = true;
            actions.canActivate = true;
            actions.canCancel = true;
        } else if (task.status === 'completed') {
            actions.canReopen = true;
        } else if (task.status === 'cancelled') {
            actions.canRestart = true;
        }
        break;
    }
    return actions;
  };

  const availableActions = getAvailableActions();

  const isTechnicianOrAssistant = userClaims?.isOrgTechnician || userClaims?.isOrgAssistant;
  const isTaskAssignedToCurrentUser = task.assignedToUserId === user?.uid || (task.assignedToUserIds && user?.uid && task.assignedToUserIds.includes(user.uid));
  const shouldHideEditAndAssignButtons = isTechnicianOrAssistant && isTaskAssignedToCurrentUser;


  const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
  } = useSortable({ id: id, data: { type: 'task', task } });

  const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 10 : undefined,
      cursor: isDragging ? 'grabbing' : 'grab',
  };

  const startDateFormatted = formatDateSafe(task.startDate);
  const dueDateFormatted = formatDateSafe(task.dueDate);
  const durationFormatted = formatDuration(task.durationValue, task.durationUnit);
  const taskDetails = task.details;
  const taskCategoryName = task.taskCategoryName;
  const categoryColor = getCategoryColor?.(taskCategoryName);
  const initialMilestonesForTracker = useMemo(() => Array.isArray(task.milestones) ? task.milestones : [], [task.milestones]);
  const hasMilestones = initialMilestonesForTracker.length > 0;
  const milestoneProgress = useMemo(() => calculateTaskProgress(initialMilestonesForTracker), [initialMilestonesForTracker]);

   const needsExpand = useMemo(() => {
       if (!taskDetails) return false;
       const lines = taskDetails.split('\n');
       return lines.length > 1 || (lines[0] && lines[0].length > 80);
   }, [taskDetails]);

  const displayDetails = useMemo(() => {
    if (!taskDetails) return null;
    return isDetailsExpanded ? taskDetails : getFirstLine(taskDetails);
  }, [isDetailsExpanded, taskDetails]);

  const isOverdue = task.status !== 'completed' && task.status !== 'cancelled' && task.dueDate && task.dueDate < new Date(new Date().setHours(0,0,0,0));
  const isCompleted = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';

  const toggleDetailsExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDetailsExpanded(!isDetailsExpanded);
  };

   const toggleMilestonesExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMilestonesExpanded(!isMilestonesExpanded);
   };

  const priority = task.priority;
  const priorityClass = priority ? `priority-${priority}` : '';
  const priorityTextMap: Record<PriorityLevel, string> = {
    1: 'الأعلى', 2: 'عالية', 3: 'متوسطة', 4: 'منخفضة', 5: 'الأدنى',
    'high': 'عالية', 'medium': 'متوسطة', 'low': 'منخفضة'
  };
  const priorityText = priority ? priorityTextMap[priority] : 'غير محددة';

  const getBorderColor = (): string => {
    if (isCompleted) return 'border-status-completed';
    if (isCancelled) return 'border-destructive';
    if (isOverdue) return 'border-status-urgent';
    if (typeof priority === 'number') {
        return `border-[hsl(var(--priority-${priority}))]`;
    } else if (typeof priority === 'string') {
        if (priority === 'high') return 'border-[hsl(var(--priority-1))]';
        if (priority === 'medium') return 'border-[hsl(var(--priority-3))]';
        if (priority === 'low') return 'border-[hsl(var(--priority-5))]';
    }
    return 'border-border';
  };

  const executeStatusChange = async (newStatus: TaskStatus, resetMiles: boolean = false) => {
    if (task?.id && onStatusChange) {
      const originalStatus = task.status; // Save original status for potential revert
      onStatusChange(task.id, newStatus); // Optimistic update

      if (newStatus === 'pending' && (originalStatus === 'completed' || originalStatus === 'cancelled') && resetMiles) {
        try {
          await resetMilestonesOnReopen(task.id);
          console.log(`Reset milestones for reopened task ${task.id}`);
        } catch (error) {
          console.error('Error resetting milestones on reopen:', error);
          // Not reverting optimistic update here as the main status change might still succeed
        }
      }

      const taskRef = doc(db, 'tasks', task.id);
      try {
        await updateDoc(taskRef, {
          status: newStatus,
          updatedAt: Timestamp.now()
        });
        toast({
          title: 'تم تحديث الحالة',
          description: `تم تحديث حالة المهمة "${task.description}" إلى ${categoryInfo[newStatus as TaskCategory]?.title ?? newStatus}.`,
        });

        if (task.parentTaskId) {
          try {
            console.log(`TaskCardTemp: Calling updateParentTaskComprehensive for parent ${task.parentTaskId}`);
            await updateParentTaskComprehensive(task.parentTaskId);
            console.log(`TaskCardTemp: Successfully updated parent task ${task.parentTaskId} after status change of subtask ${task.id}`);
          } catch (parentError) {
            console.error(`TaskCardTemp: Error updating parent task ${task.parentTaskId}:`, parentError);
            toast({
              title: 'خطأ في تحديث المهمة الأم',
              description: 'حدث خطأ أثناء تحديث بيانات المهمة الرئيسية.',
              variant: 'destructive',
            });
          }
        }

        await updateSubtasksFromParent(task.id, newStatus);

      } catch (error) {
        console.error(`TaskCardTemp: Error updating task status for ${task.id} in Firestore:`, error);
        if (onStatusChange) { // Check if onStatusChange (revert) is defined
          onStatusChange(task.id, originalStatus); // Revert optimistic update
        }
        toast({
          title: 'خطأ في تحديث حالة المهمة',
          description: 'حدث خطأ أثناء محاولة تحديث حالة المهمة.',
          variant: 'destructive',
        });
      }
    } else {
        console.error("Task ID is missing or onStatusChange not provided.");
    }
  };

  const handleStatusChangeLocal = async (e: React.MouseEvent, newStatus: TaskStatus) => {
     e.stopPropagation();
    if (newStatus === 'pending' && (task.status === 'completed' || task.status === 'cancelled')) {
      setIsReopenDialogOpen(true); // Set task to reopen for the dialog
      return;
    }
    await executeStatusChange(newStatus);
  };

  const handleReopenConfirm = (resetMilestonesChoice: boolean) => {
    // The 'task' from closure is the correct one to reopen here
    executeStatusChange('pending', resetMilestonesChoice);
  };


  const handleEditLocal = (e: React.MouseEvent) => {
     e.stopPropagation();
     if (task && onEdit) {
        onEdit(task);
     }
  };

  const handleDeleteLocal = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (task?.id && onDelete) {
          onDelete(task.id);
      } else {
           console.error("Task ID is missing or onDelete not provided.");
      }
  };

   const handleMilestonesChange = useCallback(async (updatedMilestones: Milestone[]) => {
       if (!task?.id) return;

       console.log(`[MILESTONE CHANGE] Task ${task.id} milestone update started`, {
         taskId: task.id,
         taskDescription: task.description,
         parentTaskId: task.parentTaskId,
         taskContext: task.taskContext,
         departmentId: task.departmentId,
         organizationId: task.organizationId,
         milestonesCount: updatedMilestones.length
       });

       const taskDocRef = doc(db, 'tasks', task.id);
       try {
             const cleanMilestones: MilestoneFirestoreData[] = updatedMilestones
                 .filter(m => m != null && m.description?.trim() !== '')
                 .map(m => {
                     let firestoreDueDate = null;
                     if (m.dueDate instanceof Date && !isNaN(m.dueDate.getTime())) {
                         try {
                             firestoreDueDate = Timestamp.fromDate(m.dueDate);
                         } catch (e) {
                             console.error(`[TaskCardTemp ${task.id}] Error converting dueDate for milestone ${m.id}:`, e);
                             firestoreDueDate = null;
                         }
                     }
                     return {
                         id: m.id || uuidv4(),
                         description: m.description || '',
                         completed: !!m.completed,
                         weight: typeof m.weight === 'number' ? m.weight : 0,
                         dueDate: firestoreDueDate,
                         assignedToUserId: m.assignedToUserId || null,
                     };
                 });
             const milestonesToSave = cleanMilestones.length > 0 ? cleanMilestones : null;

             const newTaskStatus = calculateTaskStatusFromMilestones(
               cleanMilestones,
               task.status
             );

             const updateData: any = {
               milestones: milestonesToSave,
               updatedAt: Timestamp.now()
             };

             if (newTaskStatus !== task.status) {
               updateData.status = newTaskStatus;
             }

             await updateDoc(taskDocRef, updateData);

             if (task.parentTaskId) {
               try {
                 console.log(`[MILESTONE UPDATE] Updating parent task ${task.parentTaskId} for subtask ${task.id}`);
                 await updateParentTaskComprehensive(task.parentTaskId);
                 console.log(`[MILESTONE UPDATE] Successfully updated parent task ${task.parentTaskId}`);
               } catch (error) {
                 console.error('Error updating parent task:', error);
               }
             } else {
               console.log(`[MILESTONE UPDATE] Task ${task.id} has no parent task, skipping parent update`);
             }

             if (newTaskStatus !== task.status) {
               try {
                 await updateSubtasksFromParent(task.id, newTaskStatus);
                 console.log(`Updated subtasks for parent task ${task.id} due to milestone changes, new status: ${newTaskStatus}`);
               } catch (error) {
                 console.error('Error updating subtasks from milestone changes:', error);
               }
             }

             console.log(`[TaskCardTemp ${task.id}] Milestones updated successfully in Firestore.`);
             toast({
                 title: 'تم تحديث نقاط التتبع',
                 duration: 2000
             });
       } catch (error) {
           console.error(`[TaskCardTemp ${task.id}] Error updating milestones in Firestore:`, error);
           toast({
               title: 'خطأ في تحديث نقاط التتبع',
               description: 'حدث خطأ أثناء حفظ نقاط التتبع.',
               variant: 'destructive',
           });
       }
   }, [task?.id, task?.status, task?.parentTaskId, task?.description, task?.taskContext, task?.departmentId, task?.organizationId, toast]);

  if (!task) {
      console.warn("TaskCardTemp rendered without a task object.");
      return null;
  }

  return (
    <li ref={setNodeRef} style={style} {...attributes} >
      <Card className={cn(
          "mb-3 shadow-md border-l-[6px] rounded-lg overflow-hidden bg-card transition-opacity duration-300 relative group/task-card",
          getBorderColor(),
          (isCompleted || isCancelled) && "opacity-60 hover:opacity-100"
      )}>
         {/* Drag Handle */}
          <button
             {...listeners}
             className={cn(
                 "absolute top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-grab",
                 "right-1 z-10" // Adjusted for RTL handle
              )}
              aria-label="اسحب لإعادة الترتيب"
              onClick={(e) => e.stopPropagation()}
         >
             <GripVertical className="h-4 w-4" />
         </button>

        <CardHeader className="pb-2 pt-3 px-4 pr-8 flex flex-row items-start justify-between"> {/* Adjusted padding for RTL handle */}
           <div className="flex-1 mr-2 space-y-1 min-w-0"> {/* Adjusted margin for RTL handle */}
              <CardTitle className={cn("text-base font-semibold break-words", (isCompleted || isCancelled) && "line-through text-muted-foreground")}>
              {task.description}
              </CardTitle>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs">
                 {isOverdue && (
                    <Badge variant="destructive" className="py-0.5 px-1.5 h-auto text-xs bg-status-urgent">
                        <AlertTriangle className="ml-1 h-3 w-3" />
                        متأخرة
                    </Badge>
                 )}

                 {isCancelled && (
                    <Badge variant="destructive" className="py-0.5 px-1.5 h-auto text-xs">
                        <X className="ml-1 h-3 w-3" />
                        ملغية
                    </Badge>
                 )}
                 {isCompleted && (
                     <Badge variant="default" className="py-0.5 px-1.5 h-auto text-xs bg-status-completed text-white">
                         <CheckCircle2 className="ml-1 h-3 w-3" />
                         مكتملة
                     </Badge>
                 )}
                 {priority !== undefined && priority !== null && !isCompleted && !isCancelled && (
                      <TooltipProvider delayDuration={100}>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                   <Badge variant="outline" className="py-0.5 px-1.5 h-auto text-xs cursor-default border-none">
                                       <span className={cn('priority-badge ml-1', priorityClass)}></span>
                                      {priorityText}
                                   </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>الأولوية: {priorityText}</p>
                              </TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                 )}
                 {task.linkedToOkr ? (
                   <TaskKeyResultBadge taskId={task.id} size="sm" />
                 ) : (
                   <OkrTaskBadge linkedToOkr={task.linkedToOkr} size="sm" />
                 )}
             </div>
          </div>

           {(onStatusChange || onEdit || onDelete) && (
               <DropdownMenu dir="rtl">
                  <DropdownMenuTrigger asChild>
                       <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground group-hover/task-card:opacity-100 md:opacity-0 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">إجراءات المهمة</span>
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} >
                      {onStatusChange && availableActions.canComplete && (
                          <DropdownMenuItem onClick={(e) => handleStatusChangeLocal(e, 'completed')} className="text-green-700 hover:text-green-800 focus:bg-green-50 hover:bg-green-50 focus:text-green-800 cursor-pointer">
                              <CheckCircle2 className="ml-2 h-4 w-4" />
                              <span>وضع علامة كمكتملة</span>
                          </DropdownMenuItem>
                       )}
                      {onStatusChange && availableActions.canReopen && (
                          <DropdownMenuItem onClick={(e) => handleStatusChangeLocal(e, 'pending')} className="text-blue-700 hover:text-blue-800 focus:bg-blue-50 hover:bg-blue-50 focus:text-blue-800 cursor-pointer">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                              <span>إعادة فتح</span>
                          </DropdownMenuItem>
                      )}
                      {onStatusChange && availableActions.canRestart && (
                          <DropdownMenuItem onClick={(e) => handleStatusChangeLocal(e, 'pending')} className="text-emerald-700 hover:text-emerald-800 focus:bg-emerald-50 hover:bg-emerald-50 focus:text-emerald-800 cursor-pointer">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
                              <span>إعادة تشغيل المهمة</span>
                          </DropdownMenuItem>
                      )}
                      {onStatusChange && availableActions.canHold && (
                          <DropdownMenuItem onClick={(e) => handleStatusChangeLocal(e, 'hold')} className="text-amber-700 hover:text-amber-800 focus:bg-amber-50 hover:bg-amber-50 focus:text-amber-800 cursor-pointer">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><rect width="6" height="14" x="4" y="5" rx="2"/><rect width="6" height="14" x="14" y="5" rx="2"/></svg>
                              <span>تعليق المهمة</span>
                          </DropdownMenuItem>
                      )}
                      {onStatusChange && availableActions.canActivate && (
                          <DropdownMenuItem onClick={(e) => handleStatusChangeLocal(e, 'in-progress')} className="text-indigo-700 hover:text-indigo-800 focus:bg-indigo-50 hover:bg-indigo-50 focus:text-indigo-800 cursor-pointer">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><polygon points="5,3 19,12 5,21"/></svg>
                              <span>إعادة تفعيل المهمة</span>
                          </DropdownMenuItem>
                      )}
                      {onStatusChange && availableActions.canCancel && (
                          <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => handleStatusChangeLocal(e, 'cancelled')} className="text-red-700 hover:text-red-800 focus:bg-red-50 hover:bg-red-50 focus:text-red-800 cursor-pointer">
                                  <X className="ml-2 h-4 w-4" />
                                  <span>إلغاء المهمة</span>
                              </DropdownMenuItem>
                          </>
                      )}
                       {onStatusChange && (onEdit || onDelete) && <DropdownMenuSeparator />}
                       {onEdit && !shouldHideEditAndAssignButtons && (
                           <DropdownMenuItem onClick={handleEditLocal} className="cursor-pointer">
                              <Edit className="ml-2 h-4 w-4" />
                              <span>تعديل</span>
                           </DropdownMenuItem>
                       )}
                       {onDelete && (
                          <DropdownMenuItem onClick={handleDeleteLocal} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                              <Trash2 className="ml-2 h-4 w-4" />
                              <span>حذف</span>
                          </DropdownMenuItem>
                       )}
                  </DropdownMenuContent>
              </DropdownMenu>
           )}
        </CardHeader>

        <CardContent className="space-y-2 pt-0 pb-3 px-4 pr-8 text-sm text-muted-foreground"> {/* Adjusted padding for RTL handle */}
           <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs items-center">
              {startDateFormatted && (
                  <span className="flex items-center whitespace-nowrap">
                  <CalendarIcon className="h-3 w-3 ml-1" />
                  البدء: {startDateFormatted}
                  </span>
              )}
              {dueDateFormatted && (
                  <span className={cn("flex items-center whitespace-nowrap", isOverdue && "text-destructive font-medium")}>
                    <CalendarIcon className="h-3 w-3 ml-1" />
                    الاستحقاق: {dueDateFormatted}
                  </span>
              )}
              {durationFormatted && (
                  <span className="flex items-center whitespace-nowrap">
                  <Clock className="h-3 w-3 ml-1" />
                  المدة: {durationFormatted}
                  </span>
              )}
              {task.organizationId && (task.assignedToUserId || task.assignedToUserIds) && (
                  <CompactAssigneesList
                    assignedToUserId={task.assignedToUserId}
                    assignedToUserIds={task.assignedToUserIds}
                    organizationId={task.organizationId}
                    className="text-blue-600 dark:text-blue-400"
                    maxVisible={2}
                    size="md"
                  />
              )}
               {taskCategoryName && (
                  <Badge variant="outline" className="py-0 px-1.5 h-auto text-xs font-normal" style={categoryColor ? { borderColor: categoryColor, color: categoryColor } : {}}>
                    {categoryColor && <span className="inline-block h-1.5 w-1.5 rounded-full ml-1" style={{ backgroundColor: categoryColor }}></span>}
                    <Tag className={cn("h-3 w-3 ml-1", categoryColor && "hidden")} />
                    {taskCategoryName}
                  </Badge>
               )}
               {task.taskContext === 'organization' && task.organizationId && !shouldHideEditAndAssignButtons && (
                  <div className="flex-shrink-0">
                    <CreateSubtasksDialog
                      task={task}
                      onSubtasksCreated={() => {
                        toast({
                          title: 'تم إنشاء المهام الفرعية',
                          description: 'تم إنشاء المهام الفرعية للأقسام بنجاح.',
                        });
                      }}
                    />
                  </div>
               )}
               {task.taskContext === 'department' && task.departmentId && task.organizationId && !shouldHideEditAndAssignButtons && (
                  <div className="flex-shrink-0">
                    <AssignTaskToMembersDialog
                      task={task}
                      onTaskAssigned={() => {
                        toast({
                          title: 'تم تعيين المهمة',
                          description: 'تم تعيين المهمة للأعضاء بنجاح.',
                        });
                      }}
                    />
                  </div>
               )}
           </div>

          {taskDetails && (
              <div className="pt-1">
                  <p className={cn(
                      "whitespace-pre-wrap text-foreground/90 text-sm break-words",
                      !isDetailsExpanded && "line-clamp-1"
                   )}>
                      {taskDetails}
                  </p>
                  {needsExpand && (
                      <Button
                          variant="link"
                          size="sm"
                          onClick={toggleDetailsExpand}
                          className="h-auto p-0 mt-1 text-xs text-primary hover:text-primary/80 flex items-center"
                          aria-expanded={isDetailsExpanded}
                      >
                          {isDetailsExpanded ? (
                              <>
                                  <ChevronUp className="h-3 w-3 ml-1" />
                                  عرض أقل
                              </>
                          ) : (
                              <>
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                  عرض المزيد
                              </>
                          )}
                      </Button>
                  )}
              </div>
          )}

           {hasMilestones && (
               <div className="pt-2 border-t border-border mt-2">
                    {!isMilestonesExpanded && !isCompleted && (
                        <div className="flex items-center gap-2 mb-1">
                            <Progress value={milestoneProgress} className="h-1.5 flex-1 bg-secondary/20 dark:bg-secondary/30" indicatorClassName="bg-primary" />
                            <span className="text-xs font-medium text-muted-foreground">{milestoneProgress}%</span>
                        </div>
                    )}
                   <Button
                       variant="ghost"
                       size="sm"
                       onClick={toggleMilestonesExpand}
                       className="h-auto p-0 mb-1 text-xs text-primary hover:text-primary/80 flex items-center w-full justify-start"
                       aria-expanded={isMilestonesExpanded}
                   >
                       <ListChecks className="h-3.5 w-3.5 ml-1" />
                       <span>نقاط التتبع ({initialMilestonesForTracker.length})</span>
                       {isMilestonesExpanded ? (
                           <ChevronUp className="h-3 w-3 mr-1" />
                       ) : (
                           <ChevronDown className="h-3 w-3 mr-1" />
                       )}
                   </Button>
                   {isMilestonesExpanded && (
                       <MilestoneTracker
                           taskId={task.id}
                           taskDescription={task.description}
                           taskDetails={task.details}
                           initialMilestones={initialMilestonesForTracker}
                           onMilestonesChange={handleMilestonesChange}
                           parentTaskStatus={task.status}
                       />
                   )}
               </div>
           )}

          {task.priorityReason && !isCompleted && (
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <div className="pt-2 text-xs border-t border-border mt-2 flex items-center cursor-default">
                            <CircleHelp className="h-3.5 w-3.5 text-muted-foreground ml-1 flex-shrink-0"/>
                            <p className="text-muted-foreground truncate"><strong className="font-medium text-foreground/80">سبب الأولوية (AI):</strong> {task.priorityReason}</p>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                         <p>{task.priorityReason}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          )}

            {aiReasoning && (
                 <div className={cn(
                     "pt-2 text-xs border-t border-border mt-2 flex items-start",
                     isOverdue ? "text-destructive" : "text-blue-600 dark:text-blue-400"
                 )}>
                     <Info className="h-3.5 w-3.5 ml-1 flex-shrink-0 mt-0.5"/>
                     <p className="flex-1"><strong className="font-medium">{isOverdue ? 'تحذير:' : 'ملاحظة الخطة:'}</strong> {aiReasoning}</p>
                 </div>
            )}
            {task.taskContext === 'organization' && task.organizationId && !shouldHideEditAndAssignButtons && (
              <div className="pt-2 border-t border-border mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSubtasks(!showSubtasks);
                  }}
                  className="h-7 px-2 text-xs text-primary hover:text-primary/80 flex items-center w-full justify-start"
                >
                  <Share2 className="h-3.5 w-3.5 ml-1" />
                  <span>المهام الفرعية للأقسام</span>
                  {showSubtasks ? (
                    <ChevronUp className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  )}
                </Button>
                {showSubtasks && (
                  <SubtasksList parentTaskId={task.id} />
                )}
              </div>
            )}
        </CardContent>
      </Card>

      <ReopenTaskDialog
        isOpen={isReopenDialogOpen}
        onOpenChange={setIsReopenDialogOpen}
        onConfirm={handleReopenConfirm}
        taskDescription={task.description}
        hasMilestones={hasMilestones}
      />
    </li>
  );
};

export const TaskCardTemp = React.memo(TaskCardTempComponent, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.description === nextProps.task.description &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.dueDate === nextProps.task.dueDate &&
    JSON.stringify(prevProps.task.milestones) === JSON.stringify(nextProps.task.milestones) &&
    JSON.stringify(prevProps.task.assignedToUserIds) === JSON.stringify(nextProps.task.assignedToUserIds) &&
    prevProps.currentCategory === nextProps.currentCategory
  );
});
