
'use client';

import type { FormEvent, MouseEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, Save, Loader2, Wand2, Settings, ListChecks, User as UserIcon, Target } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast'; // Corrected import path
import { suggestSmartDueDate, type SuggestSmartDueDateInput, type SuggestSmartDueDateOutput, suggestMilestones, type SuggestMilestonesInput, type SuggestMilestonesOutput } from '@/services/ai';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import type { TaskType, DurationUnit, TaskFirestoreData, PriorityLevel, TaskCategoryDefinition, Milestone, MilestoneFirestoreData } from '@/types/task';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { MilestoneTracker } from './MilestoneTracker';
import { ManageCategoriesDialog } from './ManageCategoriesDialog';
import { Separator } from '@/components/ui/separator';
import { TaskContextSelector } from './TaskContextSelector';
import { TaskContext } from '@/types/task';
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { TaskKeyResultsSection } from '@/components/okr/TaskKeyResultsSection';

interface EditTaskSheetProps {
    user: User;
    task: TaskType | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onTaskUpdated: () => void;
}

export function EditTaskSheet({ user, task, isOpen, onOpenChange, onTaskUpdated }: EditTaskSheetProps) {
  const { toast } = useToast();
  const { categories: userCategories, loading: categoriesLoading, addCategory, deleteCategory, editCategory, getCategoryColor } = useTaskCategories(user.uid);
  const { userClaims } = useAuth(); // Get userClaims to determine context for new tasks

  // تحديد الأدوار المتدنية التي لا يمكنها إسناد مهام للآخرين أو تغيير مستوى المهمة
  const isLowLevelRole = userClaims?.isOrgEngineer || userClaims?.isOrgTechnician || userClaims?.isOrgAssistant;

  // إخفاء خيارات الإسناد ومستوى المهمة للأدوار المتدنية
  const canAssignTasks = !isLowLevelRole;

  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [isStartPopoverOpen, setIsStartPopoverOpen] = useState(false);

  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [tempDueDate, setTempDueDate] = useState<Date | undefined>(undefined);
  const [isDuePopoverOpen, setIsDuePopoverOpen] = useState(false);

  const [durationValue, setDurationValue] = useState<number | undefined>(undefined);
  const [durationUnit, setDurationUnit] = useState<DurationUnit | undefined>(undefined);

  const [priority, setPriority] = useState<PriorityLevel | undefined>(3);
  const [taskCategoryName, setTaskCategoryName] = useState<string | undefined>(undefined);

  const [currentMilestones, setCurrentMilestones] = useState<Milestone[]>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<{uid: string, email: string, name: string}[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [taskContext, setTaskContext] = useState<{
    taskContext: TaskContext | undefined;
    departmentId: string | undefined;
    assignedToUserId: string | undefined;
  }>({
    taskContext: 'individual',
    departmentId: undefined,
    assignedToUserId: undefined
  });

  // This state holds the editing USER's organizationId, if any.
  // It's used to fetch members for assignment IF the task is an org task.
  const [editingUserOrganizationId, setEditingUserOrganizationId] = useState<string | undefined>(undefined);

  // OKR fields
  const [objectives, setObjectives] = useState<{id: string, title: string, keyResults: {id: string, title: string}[]}[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | undefined>(undefined);
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string | undefined>(undefined);
  const [loadingObjectives, setLoadingObjectives] = useState(false);

  const [isSuggestingDate, setIsSuggestingDate] = useState(false);
  const [isSuggestingMilestones, setIsSuggestingMilestones] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);

  // Effect to get editing user's organization ID from user claims
  useEffect(() => {
    if (userClaims?.organizationId) {
      setEditingUserOrganizationId(userClaims.organizationId);
    } else {
      setEditingUserOrganizationId(undefined);
    }
  }, [userClaims]);

  // جلب أعضاء المؤسسة (إذا كانت المهمة تنتمي لمؤسسة)
  useEffect(() => {
    if (isOpen && user && task?.organizationId) {
      const fetchOrganizationMembers = async () => {
        try {
          setLoadingMembers(true);
          const membersRef = collection(db, 'organizations', task.organizationId!, 'members');
          const membersSnapshot = await getDocs(membersRef);
          const membersList: {uid: string, email: string, name: string}[] = [];
          for (const memberDoc of membersSnapshot.docs) {
            const userDocSnapshot = await getDocs(query(collection(db, 'users'), where('__name__', '==', memberDoc.id)));
            if (!userDocSnapshot.empty) {
              const userData = userDocSnapshot.docs[0].data();
              membersList.push({
                uid: memberDoc.id,
                email: userData.email || 'بدون بريد إلكتروني',
                name: userData.displayName || userData.email || memberDoc.id
              });
            } else {
              membersList.push({ uid: memberDoc.id, email: 'بدون بريد إلكتروني', name: memberDoc.id });
            }
          }
          setOrganizationMembers(membersList);
        } catch (error) {
          console.error("Error fetching organization members:", error);
        } finally {
          setLoadingMembers(false);
        }
      };
      fetchOrganizationMembers();
    } else {
      setOrganizationMembers([]); // Clear members if not an org task or sheet is closed
    }
  }, [isOpen, user, task?.organizationId]);

  // جلب الأهداف والنتائج الرئيسية (إذا كانت المهمة تنتمي لمؤسسة)
  useEffect(() => {
    if (isOpen && user && task?.organizationId) {
      const fetchObjectives = async () => {
        try {
          setLoadingObjectives(true);
          const objectivesQuery = query(
            collection(db, 'objectives'),
            where('organizationId', '==', task.organizationId), // Use task's org ID
            where('status', '!=', 'completed')
          );
          const objectivesSnapshot = await getDocs(objectivesQuery);
          const objectivesList: {id: string, title: string, keyResults: {id: string, title: string}[]}[] = [];
          objectivesSnapshot.forEach((doc) => {
            const data = doc.data();
            objectivesList.push({
              id: doc.id,
              title: data.title,
              keyResults: (data.keyResults || []).map((kr: any) => ({ id: kr.id, title: kr.title })),
            });
          });
          setObjectives(objectivesList);
          if (task?.objectiveId) {
            setSelectedObjectiveId(task.objectiveId);
            if (task.keyResultId) setSelectedKeyResultId(task.keyResultId);
          }
        } catch (error) {
          console.error("Error fetching objectives:", error);
        } finally {
          setLoadingObjectives(false);
        }
      };
      fetchObjectives();
    } else {
      setObjectives([]); // Clear objectives if not an org task or sheet is closed
      setSelectedObjectiveId(undefined);
      setSelectedKeyResultId(undefined);
    }
  }, [isOpen, user, task?.organizationId, task?.objectiveId, task?.keyResultId]);

  useEffect(() => {
    if (task && isOpen) {
      setDescription(task.description || '');
      setDetails(task.details || '');
      setStartDate(task.startDate);
      setTempStartDate(task.startDate);
      setDueDate(task.dueDate);
      setTempDueDate(task.dueDate);
      setDurationValue(task.durationValue);
      setDurationUnit(task.durationUnit);
      setPriority(task.priority ?? 3);
      setTaskCategoryName(task.taskCategoryName);

      // Initialize taskContext based on the task being edited
      if (task.organizationId) { // If it's an organizational task
        setTaskContext({
          taskContext: task.taskContext || 'individual', // Default to individual if not set
          departmentId: task.departmentId,
          assignedToUserId: task.assignedToUserId,
        });
      } else { // If it's a purely individual task
        setTaskContext({
          taskContext: 'individual',
          departmentId: undefined,
          assignedToUserId: task.assignedToUserId || user.uid, // Assign to task's user or current user
        });
      }

      // Initialize OKR fields based on the task
      setSelectedObjectiveId(task.objectiveId);
      setSelectedKeyResultId(task.keyResultId);

      const safeInitialMilestones = Array.isArray(task.milestones) ? task.milestones : [];
      setCurrentMilestones(JSON.parse(JSON.stringify(safeInitialMilestones)));
    }
    setIsUpdatingTask(false);
    setIsSuggestingDate(false);
    setIsSuggestingMilestones(false);
  }, [task, isOpen, user.uid]);

   const formatDateSafe = (dateInput: Date | string | undefined): string | null => {
      if (!dateInput) return null;
      try {
          const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
          if (isNaN(date.getTime())) return null;
          return format(date, 'PPP', { locale: ar });
      } catch (e) {
          console.error("Error formatting date:", e);
          return null;
      }
  };

  const handleSuggestDueDate = useCallback(async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
        toast({ title: 'خطأ', description: 'يرجى إدخال وصف للمهمة أولاً.', variant: 'destructive' });
        return;
    }
    setIsSuggestingDate(true);
    try {
        const input: SuggestSmartDueDateInput = {
            taskDescription: trimmedDescription,
            taskDetails: details,
            startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
            duration: durationValue,
            durationUnit: durationUnit,
        };
        const result: SuggestSmartDueDateOutput = await suggestSmartDueDate(input);
        if (result.suggestedDueDate) {
             const suggestedDate = parseISO(result.suggestedDueDate);
             if (!isNaN(suggestedDate.getTime())) {
                 setDueDate(suggestedDate);
                 setTempDueDate(suggestedDate);
                 toast({
                    title: 'اقتراح تاريخ الاستحقاق',
                    description: `التاريخ المقترح: ${formatDateSafe(suggestedDate)}. السبب: ${result.reasoning}`,
                 });
             } else {
                 toast({ title: 'تنسيق تاريخ غير صالح', description: `التاريخ المقترح من الذكاء الاصطناعي (${result.suggestedDueDate}) غير صالح.`, variant: 'destructive' });
             }
        } else {
            toast({ title: 'لم يتم العثور على اقتراح', description: 'لم يتمكن الذكاء الاصطناعي من اقتراح تاريخ استحقاق لهذه المهمة.', variant: 'default' });
        }
    } catch (error) {
        console.error('Error suggesting due date:', error);
        toast({ title: 'خطأ في اقتراح التاريخ', description: 'حدث خطأ أثناء محاولة اقتراح تاريخ الاستحقاق.', variant: 'destructive' });
    } finally {
        setIsSuggestingDate(false);
    }
  }, [description, details, startDate, durationValue, durationUnit, toast]);

    const handleSuggestMilestones = useCallback(async () => {
        if (!description.trim()) {
            toast({ title: 'خطأ', description: 'وصف المهمة مطلوب لاقتراح نقاط التتبع.', variant: 'destructive' });
            return;
        }
        setIsSuggestingMilestones(true);
        try {
            const input: SuggestMilestonesInput = { taskDescription: description, taskDetails: details };
            const result: SuggestMilestonesOutput = await suggestMilestones(input);
            if (result.suggestedMilestones && result.suggestedMilestones.length > 0) {
                const suggested = result.suggestedMilestones.map(desc => ({
                    id: uuidv4(),
                    description: desc,
                    completed: false,
                    weight: 0,
                    dueDate: undefined,
                }));
                setCurrentMilestones(suggested);
                toast({ title: 'تم اقتراح نقاط تتبع جديدة', description: 'تم استبدال النقاط الحالية. يمكنك تعديلها وتوزيع الأوزان قبل الحفظ.' });
            } else {
                 setCurrentMilestones([]);
                toast({ title: 'لم يتم العثور على اقتراحات', description: 'لم يتمكن الذكاء الاصطناعي من اقتراح نقاط تتبع لهذه المهمة.' });
            }
        } catch (error) {
            console.error('Error suggesting milestones:', error);
            toast({ title: 'خطأ في اقتراح نقاط التتبع', description: 'حدث خطأ أثناء الاقتراح.', variant: 'destructive' });
        } finally {
            setIsSuggestingMilestones(false);
        }
    }, [description, details, toast]);

    const handleMilestonesChange = useCallback((updatedMilestones: Milestone[]) => {
        setCurrentMilestones(updatedMilestones);
    }, []);

  const handleUpdateTask = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription || !user || !task?.id) {
       toast({
        title: 'خطأ',
        description: 'وصف المهمة مطلوب، ومعرف المهمة غير موجود أو لم يتم تسجيل الدخول.',
        variant: 'destructive',
      });
      return;
    }
    const validMilestones = currentMilestones.filter(m => m.description.trim() !== '');

    if (validMilestones.length > 0) {
        const totalWeight = validMilestones.reduce((sum, m) => sum + (m.weight || 0), 0);
        if (totalWeight !== 100) {
            toast({
                 title: 'خطأ في الأوزان',
                 description: `مجموع أوزان نقاط التتبع هو ${totalWeight}%. يجب أن يكون المجموع 100% لحفظ المهمة.`,
                 variant: 'destructive',
                 duration: 7000,
            });
            return;
        }
    }

    setIsUpdatingTask(true);

    const taskDocRef = doc(db, 'tasks', task.id);

    let startTimestamp: Timestamp | null = null;
    if (startDate instanceof Date && !isNaN(startDate.getTime())) {
        startTimestamp = Timestamp.fromDate(startDate);
    }

    let dueTimestamp: Timestamp | null = null;
    if (dueDate instanceof Date && !isNaN(dueDate.getTime())) {
        dueTimestamp = Timestamp.fromDate(dueDate);
    }

     const cleanMilestonesToSave: MilestoneFirestoreData[] = validMilestones
       .filter(m => m != null)
       .map(m => ({
           id: m.id || uuidv4(),
           description: m.description || '',
           completed: !!m.completed,
           weight: typeof m.weight === 'number' ? m.weight : 0,
           dueDate: m.dueDate instanceof Date && !isNaN(m.dueDate.getTime()) ? Timestamp.fromDate(m.dueDate) : null,
       }));
    const milestonesToSave = cleanMilestonesToSave.length > 0 ? cleanMilestonesToSave : null;

    const updatedData: Partial<Omit<TaskFirestoreData, 'userId' | 'status' | 'priorityReason'>> & { updatedAt: Timestamp } = {
        description: trimmedDescription,
        details: details.trim() || null,
        startDate: startTimestamp,
        dueDate: dueTimestamp,
        durationValue: (durationValue !== undefined && !isNaN(durationValue) && durationValue >= 0) ? durationValue : null,
        durationUnit: (durationValue !== undefined && !isNaN(durationValue) && durationUnit) ? durationUnit : null,
        priority: priority ?? null,
        taskCategoryName: taskCategoryName ?? null,
        milestones: milestonesToSave,
        updatedAt: Timestamp.now(),
    };

    // If the original task was an organizational task, maintain its organizational context
    // unless explicitly changed by the user (which is handled by TaskContextSelector)
    if (task.organizationId) {
        updatedData.taskContext = taskContext.taskContext || task.taskContext || 'individual'; // Keep original context if new one is undefined
        updatedData.organizationId = task.organizationId; // Keep original org ID
        updatedData.departmentId = updatedData.taskContext === 'department' ? taskContext.departmentId || task.departmentId || null : null;
        updatedData.assignedToUserId = updatedData.taskContext === 'individual' ? taskContext.assignedToUserId || task.assignedToUserId || null : null;
        updatedData.objectiveId = selectedObjectiveId || null;
        updatedData.keyResultId = selectedKeyResultId || null;
    } else { // If it was an individual task, ensure it remains so
        updatedData.taskContext = 'individual';
        updatedData.organizationId = null;
        updatedData.departmentId = null;
        updatedData.assignedToUserId = user.uid; // Individual tasks are for the current user
        updatedData.objectiveId = null;
        updatedData.keyResultId = null;
    }

    try {
        await updateDoc(taskDocRef, updatedData);
        toast({
            title: 'تم تحديث المهمة',
            description: `تم تحديث "${trimmedDescription}" بنجاح.`,
        });
        onOpenChange(false);
        onTaskUpdated();

    } catch (error) {
        console.error("Error updating task in Firestore:", error);
        toast({
            title: 'خطأ في تحديث المهمة',
            description: 'حدث خطأ أثناء تحديث المهمة في قاعدة البيانات.',
            variant: 'destructive',
        });
    } finally {
         setIsUpdatingTask(false);
    }
  };

  const handleDateConfirm = (type: 'start' | 'due') => {
    if (type === 'start') {
        setStartDate(tempStartDate ?? undefined);
        setIsStartPopoverOpen(false);
    } else {
         setDueDate(tempDueDate ?? undefined);
        setIsDuePopoverOpen(false);
    }
  };

  const handleDateCancel = (type: 'start' | 'due') => {
     if (type === 'start') {
        setTempStartDate(startDate);
        setIsStartPopoverOpen(false);
     } else {
        setTempDueDate(dueDate);
        setIsDuePopoverOpen(false);
     }
  };

   const handleCategoriesUpdated = () => {
       console.log("Categories updated in dialog, potentially refresh UI.");
   };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">تعديل المهمة</SheetTitle>
          <SheetDescription>
            قم بتحديث تفاصيل المهمة أدناه.
          </SheetDescription>
        </SheetHeader>
        {task ? (
            <form onSubmit={handleUpdateTask} className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="edit-task-desc" className="font-medium">وصف المهمة (العنوان)</Label>
                    <Input
                    id="edit-task-desc"
                    type="text"
                    placeholder="اكتب عنوان المهمة هنا..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-input border-input focus:ring-primary placeholder-muted-foreground"
                    aria-label="تعديل وصف المهمة"
                    required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-task-details" className="font-medium">التفاصيل (اختياري)</Label>
                    <Textarea
                    id="edit-task-details"
                    placeholder="أضف تفاصيل إضافية، ملاحظات، أو خطوات..."
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="bg-input border-input focus:ring-primary placeholder-muted-foreground min-h-[100px]"
                    aria-label="تعديل تفاصيل المهمة"
                    />
                </div>

                {/* Show TaskContextSelector only if the task being edited has an organizationId and user can assign tasks */}
                {task.organizationId && canAssignTasks && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">سياق المهمة</h3>
                      <TaskContextSelector
                        value={taskContext}
                        onChange={setTaskContext}
                        organizationId={task.organizationId} // Pass task's orgId
                        disabled={isUpdatingTask}
                      />
                    </div>
                  </>
                )}

                {/* رسالة للأدوار المتدنية */}
                {task.organizationId && !canAssignTasks && (
                  <>
                    <Separator />
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      <UserIcon className="inline ml-1 h-4 w-4" />
                      هذه مهمة شخصية - لا يمكن تغيير الإسناد
                    </div>
                  </>
                )}

                 <Separator />
                 <div className="space-y-4">
                     <h3 className="text-sm font-medium text-muted-foreground mb-2">التواريخ</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="edit-start-date">تاريخ البدء</Label>
                            <Popover open={isStartPopoverOpen} onOpenChange={setIsStartPopoverOpen} modal={true}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="edit-start-date"
                                        type="button"
                                        variant={'outline'}
                                        className={cn(
                                        'w-full justify-start text-right font-normal border-input hover:bg-accent',
                                        !startDate && 'text-muted-foreground'
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTempStartDate(startDate || new Date());
                                            setIsStartPopoverOpen(true);
                                        }}
                                    >
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {formatDateSafe(startDate) ?? <span className="text-muted-foreground">اختر تاريخًا</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-popover border-border" align="start" collisionPadding={10}>
                                    <Calendar
                                        mode="single"
                                        selected={tempStartDate}
                                        onSelect={(date) => setTempStartDate(date ?? undefined)}
                                        initialFocus
                                        locale={ar}
                                        dir="rtl"
                                    />
                                    <div className="p-2 border-t border-border flex justify-end gap-2">
                                        <Button size="sm" type="button" variant="ghost" onClick={() => handleDateCancel('start')}>إلغاء</Button>
                                        <Button size="sm" type="button" onClick={() => handleDateConfirm('start')} className="bg-primary hover:bg-primary/90 text-primary-foreground">تأكيد</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-due-date">تاريخ الاستحقاق</Label>
                            <Popover open={isDuePopoverOpen} onOpenChange={setIsDuePopoverOpen} modal={true}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="edit-due-date"
                                        type="button"
                                        variant={'outline'}
                                        className={cn(
                                        'w-full justify-start text-right font-normal border-input hover:bg-accent',
                                        !dueDate && 'text-muted-foreground'
                                        )}
                                         onClick={(e) => {
                                             e.stopPropagation();
                                             setTempDueDate(dueDate || new Date());
                                             setIsDuePopoverOpen(true);
                                         }}
                                    >
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {formatDateSafe(dueDate) ?? <span className="text-muted-foreground">اختر تاريخًا</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-popover border-border" align="start" collisionPadding={10}>
                                    <Calendar
                                        mode="single"
                                        selected={tempDueDate}
                                         onSelect={(date) => setTempDueDate(date ?? undefined)}
                                        initialFocus
                                        locale={ar}
                                        dir="rtl"
                                    />
                                    <div className="p-2 border-t border-border flex justify-end gap-2">
                                        <Button size="sm" type="button" variant="ghost" onClick={() => handleDateCancel('due')}>إلغاء</Button>
                                        <Button size="sm" type="button" onClick={() => handleDateConfirm('due')} className="bg-primary hover:bg-primary/90 text-primary-foreground">تأكيد</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                 </div>

                 {canAssignTasks && (
                   <div className="flex pt-1">
                      <Button
                      type="button"
                      onClick={handleSuggestDueDate}
                      disabled={isSuggestingDate || !description.trim()}
                      variant="outline"
                      size="sm"
                      className="text-primary hover:bg-primary/10 hover:text-primary border-primary/30"
                      >
                      {isSuggestingDate ? (
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      ) : (
                          <Wand2 className="h-4 w-4 ml-2" />
                      )}
                      اقترح تاريخ الاستحقاق
                      </Button>
                  </div>
                 )}

                 <Separator />
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">المدة المقدرة</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-duration-value">القيمة</Label>
                            <Input
                                id="edit-duration-value"
                                type="number"
                                placeholder="e.g., 2"
                                value={durationValue ?? ''}
                                onChange={(e) => setDurationValue(e.target.value ? parseInt(e.target.value) : undefined)}
                                min="0"
                                className="bg-input border-input focus:ring-primary placeholder-muted-foreground"
                                aria-label="تعديل قيمة المدة"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-duration-unit">الوحدة</Label>
                            <Select
                                value={durationUnit}
                                onValueChange={(value) => setDurationUnit(value as DurationUnit)}
                                dir="rtl"
                                disabled={durationValue === undefined || durationValue === null || durationValue <= 0}
                            >
                                <SelectTrigger id="edit-duration-unit" className="w-full bg-input border-input focus:ring-primary">
                                    <SelectValue placeholder="اختر وحدة..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hours">ساعات</SelectItem>
                                    <SelectItem value="days">أيام</SelectItem>
                                    <SelectItem value="weeks">أسابيع</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                 <Separator />
                 {/* Show OKR section only if the task being edited is an organizational task */}
                 {task.organizationId && (
                   <>
                     <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center">
                          <Target className="ml-1 h-4 w-4 text-primary" />
                          ربط بالأهداف والنتائج الرئيسية
                        </h3>
                        {task?.id && task.organizationId && (
                          <TaskKeyResultsSection
                            taskId={task.id}
                            organizationId={task.organizationId}
                            disabled={isUpdatingTask}
                            onTaskUpdated={onTaskUpdated}
                          />
                        )}
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-objective">الهدف</Label>
                                <Select
                                    value={selectedObjectiveId || "none"}
                                    onValueChange={(value) => {
                                        setSelectedObjectiveId(value === "none" ? undefined : value);
                                        setSelectedKeyResultId(undefined);
                                    }}
                                    dir="rtl"
                                    disabled={loadingObjectives}
                                >
                                    <SelectTrigger id="edit-objective" className="w-full bg-input border-input focus:ring-primary">
                                        <SelectValue placeholder={loadingObjectives ? "تحميل الأهداف..." : "اختر هدف..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">بدون ربط بهدف</SelectItem>
                                        {objectives.length > 0 ? (
                                            objectives.map(objective => (
                                                <SelectItem key={objective.id} value={objective.id}>
                                                    {objective.title}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="no-objectives" disabled>لا توجد أهداف</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedObjectiveId && (
                                <div className="space-y-2">
                                    <Label htmlFor="edit-key-result">النتيجة الرئيسية</Label>
                                    <Select
                                        value={selectedKeyResultId || "none"}
                                        onValueChange={(value) => setSelectedKeyResultId(value === "none" ? undefined : value)}
                                        dir="rtl"
                                        disabled={!selectedObjectiveId}
                                    >
                                        <SelectTrigger id="edit-key-result" className="w-full bg-input border-input focus:ring-primary">
                                            <SelectValue placeholder="اختر نتيجة رئيسية..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">بدون ربط بنتيجة رئيسية</SelectItem>
                                            {(() => {
                                                const selectedObj = objectives.find(obj => obj.id === selectedObjectiveId);
                                                if (selectedObj && selectedObj.keyResults.length > 0) {
                                                    return selectedObj.keyResults.map(kr => (
                                                        <SelectItem key={kr.id} value={kr.id}>
                                                            {kr.title}
                                                        </SelectItem>
                                                    ));
                                                } else {
                                                    return <SelectItem value="no-key-results" disabled>لا توجد نتائج رئيسية</SelectItem>;
                                                }
                                            })()}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                     </div>
                     <Separator />
                   </>
                 )}

                 <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">التصنيف والأولوية والإسناد</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-priority">الأولوية</Label>
                            <Select
                                value={priority?.toString() ?? '3'}
                                onValueChange={(value) => setPriority(value ? parseInt(value) as PriorityLevel : undefined)}
                                dir="rtl"
                            >
                                <SelectTrigger id="edit-priority" className="w-full bg-input border-input focus:ring-primary">
                                    <SelectValue placeholder="اختر الأولوية..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 (الأعلى)</SelectItem>
                                    <SelectItem value="2">2 (عالية)</SelectItem>
                                    <SelectItem value="3">3 (متوسطة)</SelectItem>
                                    <SelectItem value="4">4 (منخفضة)</SelectItem>
                                    <SelectItem value="5">5 (الأدنى)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                               <Label htmlFor="edit-category">الفئة</Label>
                                <ManageCategoriesDialog userId={user.uid} onCategoriesUpdated={handleCategoriesUpdated}>
                                   <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" aria-label="إدارة الفئات">
                                      <Settings className="h-4 w-4" />
                                   </Button>
                                </ManageCategoriesDialog>
                            </div>
                            <Select
                                value={taskCategoryName}
                                onValueChange={setTaskCategoryName}
                                dir="rtl"
                                disabled={categoriesLoading}
                            >
                                <SelectTrigger id="edit-category" className="w-full bg-input border-input focus:ring-primary">
                                    <SelectValue placeholder={categoriesLoading ? "تحميل الفئات..." : "اختر فئة..."} />
                                </SelectTrigger>
                                <SelectContent>
                                     {userCategories.length > 0 ? (
                                        userCategories.map(category => (
                                            <SelectItem key={category.id} value={category.name}>
                                                 <span className="flex items-center">
                                                     {category.color && (
                                                        <span
                                                            className="inline-block h-2 w-2 rounded-full mr-2 ml-1 flex-shrink-0"
                                                            style={{ backgroundColor: category.color }}
                                                        />
                                                    )}
                                                    {category.name}
                                                </span>
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="no-categories" disabled>لا توجد فئات</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                 </div>

                 <Separator />
                 <div className="space-y-3 pt-2">
                     <h3 className="text-sm font-medium text-muted-foreground">نقاط التتبع (اختياري)</h3>
                     <MilestoneTracker
                         taskId={task.id}
                         taskDescription={description}
                         taskDetails={details}
                         initialMilestones={currentMilestones}
                         onMilestonesChange={handleMilestonesChange}
                     />
                 </div>

                <SheetFooter className="pt-6 mt-4 border-t">
                    <SheetClose asChild>
                        <Button type="button" variant="outline">إلغاء</Button>
                    </SheetClose>
                    <Button type="submit" disabled={isUpdatingTask || !description.trim()} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                        {isUpdatingTask ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="ml-2 h-5 w-5" />}
                        حفظ التغييرات
                    </Button>
                </SheetFooter>
            </form>
         ) : (
             <div className="flex justify-center items-center h-full">
                 <p>جار تحميل بيانات المهمة...</p>
            </div>
         )}
      </SheetContent>
    </Sheet>
  );
}
