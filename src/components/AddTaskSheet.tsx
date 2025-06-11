
'use client';

import type { FormEvent, MouseEvent } from 'react';
import React, { useState, useCallback, useEffect } from 'react';
import { Calendar as CalendarIcon, PlusCircle, Loader2, Wand2, Settings, ListChecks, Target, User as UserIcon, Clock, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { User } from 'firebase/auth';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TaskType, DurationUnit, TaskFirestoreData, PriorityLevel, TaskCategoryDefinition, Milestone, MilestoneFirestoreData } from '@/types/task';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { MilestoneTracker } from './MilestoneTracker';
import { ManageCategoriesDialog } from './ManageCategoriesDialog';
import { Separator } from '@/components/ui/separator';
import { TaskContextSelector } from './TaskContextSelector';
import { TaskContext } from '@/types/task';
import { useAuth } from '@/context/AuthContext'; // Import useAuth

interface AddTaskSheetProps {
    user: User;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    showTrigger?: boolean;
}

export function AddTaskSheet({ user, isOpen, onOpenChange, showTrigger = true }: AddTaskSheetProps) {
  const { toast } = useToast();
  const { categories: userCategories, loading: categoriesLoading, addCategory, deleteCategory, editCategory, getCategoryColor } = useTaskCategories(user.uid);
  const { userClaims } = useAuth(); // Get userClaims

  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDetails, setNewTaskDetails] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState<Date | undefined>(undefined);
  const [tempNewTaskStartDate, setTempNewTaskStartDate] = useState<Date | undefined>(undefined);
  const [isNewTaskStartPopoverOpen, setIsNewTaskStartPopoverOpen] = useState(false);

  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [tempNewTaskDueDate, setTempNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [isNewTaskDuePopoverOpen, setIsNewTaskDuePopoverOpen] = useState(false);

  const [newTaskDurationValue, setNewTaskDurationValue] = useState<number | undefined>(undefined);
  const [newTaskDurationUnit, setNewTaskDurationUnit] = useState<DurationUnit | undefined>(undefined);

  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel | undefined>(3);
  const [newTaskCategoryName, setNewTaskCategoryName] = useState<string | undefined>(undefined);

  const [currentMilestones, setCurrentMilestones] = useState<Milestone[]>([]);

  // Task context state
  const [taskContext, setTaskContext] = useState<{
    taskContext: TaskContext | undefined;
    departmentId: string | undefined;
    assignedToUserId: string | undefined;
  }>({
    taskContext: 'individual', // Default for org users if selector is shown
    departmentId: undefined,
    assignedToUserId: undefined
  });

  // Approval state - مبسط
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  // User's organization ID from claims
  const organizationIdFromClaims = userClaims?.organizationId;

  // تبسيط المنطق:
  // - الجميع يمكنهم إنشاء مهام شخصية أو مهام تتطلب موافقة
  // - المسئولون فقط يمكنهم إسناد المهام للآخرين وتغيير مستوى المهمة
  const isManager = userClaims?.isOrgOwner || userClaims?.isOrgAdmin || userClaims?.isOrgSupervisor;
  const canAssignTasks = isManager;

  const [isSuggestingDate, setIsSuggestingDate] = useState(false);
  const [isSuggestingMilestones, setIsSuggestingMilestones] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // استخدام isOpen الخارجي إذا تم تمريره، وإلا استخدام الداخلي
  const sheetIsOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  const setSheetIsOpen = onOpenChange || setInternalIsOpen;

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
    if (!newTaskDescription.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال وصف للمهمة أولاً.',
        variant: 'destructive',
      });
      return;
    }
    setIsSuggestingDate(true);
    try {
       const input: SuggestSmartDueDateInput = {
        taskDescription: newTaskDescription,
        taskDetails: newTaskDetails,
        startDate: newTaskStartDate ? format(newTaskStartDate, 'yyyy-MM-dd') : undefined,
        duration: newTaskDurationValue,
        durationUnit: newTaskDurationUnit,
      };

      const result: SuggestSmartDueDateOutput = await suggestSmartDueDate(input);

      if (result.suggestedDueDate) {
        const suggestedDate = parseISO(result.suggestedDueDate);

        if (!isNaN(suggestedDate.getTime())) {
          setNewTaskDueDate(suggestedDate);
          setTempNewTaskDueDate(suggestedDate);
          toast({
            title: 'اقتراح تاريخ الاستحقاق',
            description: `التاريخ المقترح: ${formatDateSafe(suggestedDate)}. السبب: ${result.reasoning}`,
          });
        } else {
           toast({
            title: 'تنسيق تاريخ غير صالح',
            description: `التاريخ المقترح من الذكاء الاصطناعي (${result.suggestedDueDate}) غير صالح.`,
            variant: 'destructive',
           });
        }
      } else {
         toast({
          title: 'لم يتم العثور على اقتراح',
          description: 'لم يتمكن الذكاء الاصطناعي من اقتراح تاريخ استحقاق لهذه المهمة.',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error suggesting due date:', error);
      toast({
        title: 'خطأ في اقتراح التاريخ',
        description: 'حدث خطأ أثناء محاولة اقتراح تاريخ الاستحقاق.',
        variant: 'destructive',
      });
    } finally {
      setIsSuggestingDate(false);
    }
  }, [newTaskDescription, newTaskDetails, newTaskStartDate, newTaskDurationValue, newTaskDurationUnit, toast]);

    const handleSuggestMilestones = useCallback(async () => {
        if (!newTaskDescription.trim()) {
            toast({ title: 'خطأ', description: 'يرجى إدخال وصف للمهمة أولاً.', variant: 'destructive' });
            return;
        }
        setIsSuggestingMilestones(true);
        try {
            const input: SuggestMilestonesInput = { taskDescription: newTaskDescription, taskDetails: newTaskDetails };
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
    }, [newTaskDescription, newTaskDetails, toast]);

   const handleMilestonesChange = useCallback((updatedMilestones: Milestone[]) => {
       setCurrentMilestones(updatedMilestones);
   }, []);

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedDescription = newTaskDescription.trim();
    if (!trimmedDescription || !user) {
       toast({
        title: 'خطأ',
        description: 'وصف المهمة مطلوب ويجب تسجيل الدخول.',
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

    // التحقق من صلاحيات الموافقة - مبسط
    if (requiresApproval) {
      // يجب أن يكون المستخدم عضو في مؤسسة
      if (!organizationIdFromClaims) {
        toast({
          title: 'خطأ',
          description: 'يجب أن تكون عضواً في مؤسسة لإنشاء مهام تتطلب موافقة.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsAddingTask(true);

    // إذا كانت المهمة تتطلب موافقة، استخدم وظيفة الموافقة
    if (requiresApproval && organizationIdFromClaims) {
      try {
        const createTaskWithApprovalFn = httpsCallable<{
          title: string;
          description?: string;
          startDate?: { seconds: number };
          dueDate?: { seconds: number };
          priority: string;
          organizationId: string;
          approvalLevel: string;
          departmentId?: string;
          categoryName?: string;
          notes?: string;
          milestones?: Array<{
            id: string;
            description: string;
            completed: boolean;
            weight: number;
            dueDate?: { seconds: number };
          }>;
          durationValue?: number;
          durationUnit?: string;
        }, {
          success: boolean;
          taskId?: string;
          message?: string;
        }>(functions, 'createTaskWithApproval');

        // تحديد مستوى الموافقة حسب مستوى المهمة المختار
        const approvalLevel = taskContext.taskContext === 'department' ? 'department' : 'organization';
        const departmentId = taskContext.taskContext === 'department' ?
          (taskContext.departmentId || userClaims?.departmentId) :
          userClaims?.departmentId;

        // التحقق من تحديد القسم للمهام على مستوى القسم
        if (approvalLevel === 'department') {
          // للأدوار الإدارية: يجب اختيار قسم يدوياً
          const isAdminRole = userClaims?.isOrgOwner || userClaims?.isOrgAdmin;

          if (isAdminRole && !taskContext.departmentId) {
            toast({
              title: 'خطأ',
              description: 'يجب اختيار قسم لإنشاء مهمة على مستوى القسم',
              variant: 'destructive',
            });
            setIsAddingTask(false);
            return;
          }

          // للأدوار غير الإدارية: يجب أن يكون لديهم قسم حالي
          if (!isAdminRole && !userClaims?.departmentId) {
            toast({
              title: 'خطأ',
              description: 'يجب أن تكون عضواً في قسم لإنشاء مهام على مستوى القسم',
              variant: 'destructive',
            });
            setIsAddingTask(false);
            return;
          }
        }

        // تحضير نقاط التتبع للإرسال
        const milestonesForApproval = validMilestones.length > 0 ? validMilestones.map(m => ({
          id: m.id || uuidv4(),
          description: m.description || '',
          completed: !!m.completed,
          weight: typeof m.weight === 'number' ? m.weight : 0,
          dueDate: m.dueDate instanceof Date && !isNaN(m.dueDate.getTime()) ?
            { seconds: Math.floor(m.dueDate.getTime() / 1000) } : undefined
        })) : undefined;

        const taskData = {
          title: trimmedDescription,
          description: newTaskDetails?.trim() || undefined,
          priority: newTaskPriority === 3 ? 'medium' : newTaskPriority === 2 ? 'high' : newTaskPriority === 1 ? 'critical' : 'low',
          organizationId: organizationIdFromClaims,
          approvalLevel: approvalLevel,
          departmentId: departmentId || undefined,
          startDate: newTaskStartDate ? { seconds: Math.floor(newTaskStartDate.getTime() / 1000) } : undefined,
          dueDate: newTaskDueDate ? { seconds: Math.floor(newTaskDueDate.getTime() / 1000) } : undefined,
          categoryName: newTaskCategoryName || undefined,
          milestones: milestonesForApproval,
          durationValue: (newTaskDurationValue !== undefined && !isNaN(newTaskDurationValue) && newTaskDurationValue >= 0) ? newTaskDurationValue : undefined,
          durationUnit: (newTaskDurationValue !== undefined && !isNaN(newTaskDurationValue) && newTaskDurationValue >= 0 && newTaskDurationUnit) ? newTaskDurationUnit : undefined,
          notes: approvalNotes.trim() || undefined
        };

        console.log('[AddTaskSheet] Calling createTaskWithApproval with data:', taskData);
        const result = await createTaskWithApprovalFn(taskData);
        console.log('[AddTaskSheet] createTaskWithApproval result:', result.data);

        if (result.data?.success) {
          toast({
            title: 'تم إرسال المهمة للموافقة',
            description: result.data.message || 'تم إرسال المهمة للمسئول للموافقة عليها',
          });

          // إعادة تعيين النموذج
          resetForm();
          setSheetIsOpen(false);
        } else {
          throw new Error(result.data?.message || 'فشل في إنشاء المهمة');
        }
      } catch (error: any) {
        console.error('Error creating task with approval:', error);
        toast({
          title: 'خطأ في إنشاء المهمة',
          description: error.message || 'حدث خطأ أثناء إنشاء المهمة',
          variant: 'destructive',
        });
      } finally {
        setIsAddingTask(false);
      }
      return;
    }

    let startTimestamp: Timestamp | null = null;
    if (newTaskStartDate instanceof Date && !isNaN(newTaskStartDate.getTime())) {
        startTimestamp = Timestamp.fromDate(newTaskStartDate);
    }

    let dueTimestamp: Timestamp | null = null;
    if (newTaskDueDate instanceof Date && !isNaN(newTaskDueDate.getTime())) {
         dueTimestamp = Timestamp.fromDate(newTaskDueDate);
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

    // منطق مبسط: إذا لم تتطلب موافقة، فهي مهمة شخصية
    const newTaskData: Omit<TaskFirestoreData, 'userId'> & { userId: string } = {
        userId: user.uid,
        description: trimmedDescription,
        status: 'pending',
        details: newTaskDetails?.trim() || null,
        startDate: startTimestamp,
        dueDate: dueTimestamp,
        durationValue: (newTaskDurationValue !== undefined && !isNaN(newTaskDurationValue) && newTaskDurationValue >= 0) ? newTaskDurationValue : null,
        durationUnit: (newTaskDurationValue !== undefined && !isNaN(newTaskDurationValue) && newTaskDurationValue >= 0 && newTaskDurationUnit) ? newTaskDurationUnit : null,
        priority: newTaskPriority ?? null,
        taskCategoryName: newTaskCategoryName ?? null,
        priorityReason: null,
        milestones: milestonesToSave,
        // استخدام مستوى المهمة المحدد
        taskContext: taskContext.taskContext || 'individual',
        organizationId: organizationIdFromClaims || null,
        departmentId: taskContext.departmentId || null,
        assignedToUserId: taskContext.assignedToUserId || user.uid,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    try {
        const tasksColRef = collection(db, 'tasks');
        const docRef = await addDoc(tasksColRef, newTaskData);

        toast({
            title: 'تمت إضافة المهمة الشخصية',
            description: `تمت إضافة "${newTaskData.description}" كمهمة شخصية لك.`,
        });

        resetForm();
        setSheetIsOpen(false);

    } catch (error) {
        console.error("Error adding task to Firestore:", error);
        toast({
            title: 'خطأ في إضافة المهمة',
            description: 'حدث خطأ أثناء إضافة المهمة إلى قاعدة البيانات.',
            variant: 'destructive',
        });
    } finally {
         setIsAddingTask(false);
    }
  };

  const handleNewTaskDateConfirm = (type: 'start' | 'due') => {
    if (type === 'start') {
        setNewTaskStartDate(tempNewTaskStartDate ?? undefined);
        setIsNewTaskStartPopoverOpen(false);
    } else {
         setNewTaskDueDate(tempNewTaskDueDate ?? undefined);
        setIsNewTaskDuePopoverOpen(false);
    }
  };

  const handleNewTaskDateCancel = (type: 'start' | 'due') => {
     if (type === 'start') {
        setTempNewTaskStartDate(newTaskStartDate);
        setIsNewTaskStartPopoverOpen(false);
     } else {
        setTempNewTaskDueDate(newTaskDueDate);
        setIsNewTaskDuePopoverOpen(false);
     }
  };

  const handleCategoriesUpdated = () => {
     console.log("Categories updated in dialog, potentially refresh UI.");
  };

  // دالة إعادة تعيين النموذج
  const resetForm = () => {
    setNewTaskDescription('');
    setNewTaskDetails('');
    setNewTaskStartDate(undefined);
    setTempNewTaskStartDate(undefined);
    setNewTaskDueDate(undefined);
    setTempNewTaskDueDate(undefined);
    setNewTaskDurationValue(undefined);
    setNewTaskDurationUnit(undefined);
    setNewTaskPriority(3);
    setNewTaskCategoryName(undefined);
    setCurrentMilestones([]);
    setTaskContext({
      taskContext: organizationIdFromClaims ? 'individual' : 'individual',
      departmentId: undefined,
      assignedToUserId: organizationIdFromClaims ? undefined : user.uid
    });
    setRequiresApproval(false);
    setApprovalNotes('');
  };

  useEffect(() => {
      if (sheetIsOpen) {
          resetForm();
          setIsAddingTask(false);
          setIsSuggestingDate(false);
          setIsSuggestingMilestones(false);
      }
  }, [sheetIsOpen, organizationIdFromClaims, user.uid]);

  return (
    <Sheet open={sheetIsOpen} onOpenChange={setSheetIsOpen}>
      {showTrigger && (
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only">إضافة مهمة جديدة</span>
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl">إضافة مهمة جديدة</SheetTitle>
          <SheetDescription>
            املأ التفاصيل أدناه لإضافة مهمة جديدة إلى قائمتك.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleAddTask} className="space-y-5">
          <div className="space-y-2">
             <Label htmlFor="new-task-desc" className="font-medium">وصف المهمة (العنوان)</Label>
            <Input
              id="new-task-desc"
              type="text"
              placeholder="اكتب عنوان المهمة هنا..."
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              className="bg-input border-input focus:ring-primary placeholder-muted-foreground"
              aria-label="وصف المهمة الجديدة"
              required
            />
          </div>

           <div className="space-y-2">
             <Label htmlFor="new-task-details" className="font-medium">التفاصيل (اختياري)</Label>
            <Textarea
              id="new-task-details"
              placeholder="أضف تفاصيل إضافية، ملاحظات، أو خطوات..."
              value={newTaskDetails}
              onChange={(e) => setNewTaskDetails(e.target.value)}
              className="bg-input border-input focus:ring-primary placeholder-muted-foreground min-h-[100px]"
              aria-label="تفاصيل المهمة الجديدة"
            />
          </div>

          {/* مستوى المهمة - يظهر للجميع */}
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">مستوى المهمة</h3>
            <TaskContextSelector
              value={taskContext}
              onChange={setTaskContext}
              userClaims={userClaims}
              organizationId={organizationIdFromClaims}
              disabled={requiresApproval} // تعطيل عند طلب الموافقة
              requiresApproval={requiresApproval}
              onRequiresApprovalChange={setRequiresApproval}
            />
          </div>

          {/* تم نقل الرسالة التوضيحية إلى TaskContextSelector */}

          <Separator />
          <div className="space-y-4">
             <h3 className="text-sm font-medium text-muted-foreground mb-2">التواريخ</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                 <div className="space-y-2">
                    <Label htmlFor="new-start-date">تاريخ البدء</Label>
                    <Popover open={isNewTaskStartPopoverOpen} onOpenChange={setIsNewTaskStartPopoverOpen} modal={true}>
                        <PopoverTrigger asChild>
                        <Button
                            id="new-start-date"
                            type="button"
                            variant={'outline'}
                            className={cn(
                            'w-full justify-start text-right font-normal border-input hover:bg-accent',
                            !newTaskStartDate && 'text-muted-foreground'
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                setTempNewTaskStartDate(newTaskStartDate || new Date());
                                setIsNewTaskStartPopoverOpen(true);
                            }}
                        >
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {formatDateSafe(newTaskStartDate) ?? <span className="text-muted-foreground">اختر تاريخًا</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover border-border" align="start" collisionPadding={10}>
                        <Calendar
                            mode="single"
                            selected={tempNewTaskStartDate}
                            onSelect={(date) => setTempNewTaskStartDate(date ?? undefined)}
                            initialFocus
                            locale={ar}
                            dir="rtl"
                        />
                        <div className="p-2 border-t border-border flex justify-end gap-2">
                            <Button size="sm" type="button" variant="ghost" onClick={() => handleNewTaskDateCancel('start')}>إلغاء</Button>
                            <Button size="sm" type="button" onClick={() => handleNewTaskDateConfirm('start')} className="bg-primary hover:bg-primary/90 text-primary-foreground">تأكيد</Button>
                        </div>
                        </PopoverContent>
                    </Popover>
                </div>

                 <div className="space-y-2">
                     <Label htmlFor="new-due-date">تاريخ الاستحقاق</Label>
                     <Popover open={isNewTaskDuePopoverOpen} onOpenChange={setIsNewTaskDuePopoverOpen} modal={true}>
                        <PopoverTrigger asChild>
                        <Button
                            id="new-due-date"
                            type="button"
                            variant={'outline'}
                            className={cn(
                            'w-full justify-start text-right font-normal border-input hover:bg-accent',
                            !newTaskDueDate && 'text-muted-foreground'
                            )}
                             onClick={(e) => {
                                 e.stopPropagation();
                                 setTempNewTaskDueDate(newTaskDueDate || new Date());
                                 setIsNewTaskDuePopoverOpen(true);
                             }}
                        >
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {formatDateSafe(newTaskDueDate) ?? <span className="text-muted-foreground">اختر تاريخًا</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover border-border" align="start" collisionPadding={10}>
                        <Calendar
                            mode="single"
                            selected={tempNewTaskDueDate}
                             onSelect={(date) => setTempNewTaskDueDate(date ?? undefined)}
                            initialFocus
                            locale={ar}
                            dir="rtl"
                        />
                         <div className="p-2 border-t border-border flex justify-end gap-2">
                            <Button size="sm" type="button" variant="ghost" onClick={() => handleNewTaskDateCancel('due')}>إلغاء</Button>
                            <Button size="sm" type="button" onClick={() => handleNewTaskDateConfirm('due')} className="bg-primary hover:bg-primary/90 text-primary-foreground">تأكيد</Button>
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
                disabled={isSuggestingDate || !newTaskDescription.trim()}
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
                        <Label htmlFor="new-duration-value">القيمة</Label>
                        <Input
                            id="new-duration-value"
                            type="number"
                            placeholder="e.g., 2"
                            value={newTaskDurationValue ?? ''}
                            onChange={(e) => setNewTaskDurationValue(e.target.value ? parseInt(e.target.value) : undefined)}
                            min="0"
                            className="bg-input border-input focus:ring-primary placeholder-muted-foreground"
                            aria-label="قيمة المدة"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-duration-unit">الوحدة</Label>
                        <Select
                            value={newTaskDurationUnit}
                            onValueChange={(value) => setNewTaskDurationUnit(value as DurationUnit)}
                            dir="rtl"
                            disabled={newTaskDurationValue === undefined || newTaskDurationValue === null || newTaskDurationValue <= 0}
                        >
                            <SelectTrigger id="new-duration-unit" className="w-full bg-input border-input focus:ring-primary">
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
             <div className="space-y-4">
                 <h3 className="text-sm font-medium text-muted-foreground mb-2">التصنيف والأولوية</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="new-priority">الأولوية</Label>
                        <Select
                            value={newTaskPriority?.toString() ?? '3'}
                            onValueChange={(value) => setNewTaskPriority(value ? parseInt(value) as PriorityLevel : undefined)}
                            dir="rtl"
                        >
                            <SelectTrigger id="new-priority" className="w-full bg-input border-input focus:ring-primary">
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
                         <Label htmlFor="new-category">الفئة</Label>
                          <ManageCategoriesDialog userId={user.uid} onCategoriesUpdated={handleCategoriesUpdated}>
                             <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" aria-label="إدارة الفئات">
                                <Settings className="h-4 w-4" />
                             </Button>
                          </ManageCategoriesDialog>
                       </div>
                        <Select
                            value={newTaskCategoryName}
                            onValueChange={setNewTaskCategoryName}
                            dir="rtl"
                            disabled={categoriesLoading}
                        >
                            <SelectTrigger id="new-category" className="w-full bg-input border-input focus:ring-primary">
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
             <div className="space-y-2 pt-2">
                <h3 className="text-sm font-medium text-muted-foreground">نقاط التتبع (اختياري)</h3>
                <div className="bg-muted/30 rounded-lg p-3 -mt-1">
                    <MilestoneTracker
                        taskId="new-task"
                        taskDescription={newTaskDescription}
                        taskDetails={newTaskDetails}
                        initialMilestones={currentMilestones}
                        onMilestonesChange={handleMilestonesChange}
                    />
                </div>
             </div>

             {/* خيارات الموافقة - تظهر فقط للمستخدمين في المؤسسات */}
             {organizationIdFromClaims && (
               <>
                 <Separator />
                 <div className="space-y-4">
                   <div className="flex items-center space-x-2 space-x-reverse">
                     <Checkbox
                       id="requires-approval"
                       checked={requiresApproval}
                       onCheckedChange={(checked) => setRequiresApproval(checked as boolean)}
                     />
                     <Label htmlFor="requires-approval" className="flex items-center gap-2 text-sm font-medium">
                       <Clock className="h-4 w-4" />
                       تتطلب موافقة من المسئول قبل التنفيذ
                     </Label>
                   </div>

                   {requiresApproval && (
                     <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                       {/* ملاحظات الموافقة */}
                       <div className="space-y-2">
                         <Label htmlFor="approval-notes">ملاحظات للمسئول (اختياري)</Label>
                         <Textarea
                           id="approval-notes"
                           placeholder="أضف أي ملاحظات أو تفسيرات للمسئول حول سبب الحاجة للموافقة..."
                           value={approvalNotes}
                           onChange={(e) => setApprovalNotes(e.target.value)}
                           className="bg-input border-input focus:ring-primary placeholder-muted-foreground min-h-[80px]"
                         />
                       </div>

                       {/* معلومات إضافية */}
                       <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                         <div className="flex items-start gap-2">
                           <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
                           <div>
                             <p className="font-medium mb-1">معلومات مهمة:</p>
                             <ul className="space-y-1">
                               <li>• ستتم مراجعة المهمة من قبل المسئولين قبل التنفيذ</li>
                               <li>• ستتلقى إشعاراً عند الموافقة أو الرفض</li>
                               <li>• إذا لم تفعل هذا الخيار، ستكون المهمة شخصية لك فقط</li>
                             </ul>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
               </>
             )}

           <SheetFooter className="pt-6 mt-4 border-t">
             <SheetClose asChild>
                <Button type="button" variant="outline">إلغاء</Button>
             </SheetClose>
            <Button type="submit" disabled={isAddingTask || !newTaskDescription.trim()} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {isAddingTask ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : requiresApproval ? (
                <Clock className="ml-2 h-5 w-5" />
              ) : (
                <PlusCircle className="ml-2 h-5 w-5" />
              )}
              {requiresApproval ? 'إرسال للموافقة' : 'أضف المهمة'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
