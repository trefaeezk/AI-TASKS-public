'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from '@/context/AuthContext';
import { TaskCardTemp } from '@/components/TaskCardTemp';
import type { TaskType, TaskStatus, TaskFirestoreData, DurationUnit, TaskCategoryDefinition, PriorityLevel } from '@/types/task';
import { useTaskPageContext, type TaskCategory, categoryInfo, categoryOrder } from '@/context/TaskPageContext';
import { db } from '@/config/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firestoreListenerManager, handleFirestoreError } from '@/utils/firestoreListenerManager';
import { useToast } from '@/hooks/use-toast';
import { EditTaskSheet } from '@/components/EditTaskSheet';
import { AddTaskSheet } from '@/components/AddTaskSheet';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { useTaskTypeFilter } from '../../OrganizationLayoutContent';
import { updateSubtasksFromParent, updateParentTaskComprehensive, resetMilestonesOnReopen } from '@/services/parentTaskUpdater';
import { ReopenTaskDialog } from '@/components/ReopenTaskDialog';
import { useDebounce } from '@/hooks/useDebounce';
import { useThrottledCounter } from '@/hooks/useThrottledCounter';

export default function OrganizationTasksPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const { getCategoryColor } = useTaskCategories(user?.uid);
  const [taskToDelete, setTaskToDelete] = useState<TaskType | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<TaskType | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [taskToReopen, setTaskToReopen] = useState<TaskType | null>(null);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);

  const organizationId = userClaims?.organizationId;

  // استخدام سياق صفحة المهام
  const taskPageContext = useTaskPageContext();

  // استخدام فلتر نوع المهام
  const { taskTypeFilter } = useTaskTypeFilter();

  // الحصول على البيانات وحالة التصفية من السياق بأمان
  const {
    tasks,
    filteredTasks,
    categorizedTasks,
    selectedCategory,
    setSelectedCategory,
    updateTaskOptimistic,
    revertTaskOptimistic,
    removeTaskOptimistic,
    moveTaskOptimistic,
    setTasks: setTasksDirectly,
    dateFilter,
    setDateFilter,
    categoryFilter,
    setCategoryFilter,
    okrFilter,
    setOkrFilter,
  } = taskPageContext || {};

  console.log('Task page context state:', {
    hasContext: !!taskPageContext,
    tasksLength: tasks?.length || 0,
    filteredTasksLength: filteredTasks?.length || 0,
    selectedCategory,
    hasSetTasksDirectly: !!setTasksDirectly
  });

  // استخدام debounce لتقليل التحديثات المستمرة
  const debouncedTasks = useDebounce(tasks || [], 300);
  const debouncedFilteredTasks = useDebounce(filteredTasks || [], 300);

  // إعداد sensors للسحب والإفلات
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // تفعيل السحب بعد تحريك 8 بكسل
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // جلب المهام من Firestore
  useEffect(() => {
    if (!user || !organizationId) {
      console.log('Missing user or organizationId:', { user: !!user, organizationId });
      return;
    }

    console.log('Fetching tasks for organization:', organizationId);

    // إنشاء استعلام للمهام الخاصة بالمؤسسة
    const tasksColRef = collection(db, 'tasks');

    // جرب استعلام بسيط أولاً لمعرفة ما إذا كانت هناك مهام
    const simpleQuery = query(tasksColRef, where('organizationId', '==', organizationId));

    console.log('Querying tasks with organizationId:', organizationId, 'taskTypeFilter:', taskTypeFilter);

    // إنشاء مستمع للتغييرات في المهام مع throttling
    let lastUpdate = 0;
    const unsubscribe = onSnapshot(
      simpleQuery,
      (snapshot) => {
        const now = Date.now();
        // تجنب التحديثات المتكررة جداً (أقل من 200ms)
        if (now - lastUpdate < 200) {
          return;
        }
        lastUpdate = now;

        console.log('Snapshot received, docs count:', snapshot.size);
        const fetchedTasks: TaskType[] = [];

        snapshot.forEach((doc) => {
          console.log('Processing doc:', doc.id, doc.data());
          const data = doc.data() as TaskFirestoreData;

          // تصفية المهام حسب النوع والصلاحيات
          const shouldIncludeTask = () => {
            switch (taskTypeFilter) {
              case 'organization':
                // مهام المؤسسة - للإدارة العليا فقط
                if (!userClaims?.isOrgOwner && !userClaims?.isOrgAdmin) return false;
                return data.taskContext === 'organization' || (!data.taskContext && !data.departmentId && !data.assignedToUserId);

              case 'department':
                // مهام القسم - لمالك المؤسسة وأدمن المؤسسة وأعضاء الأقسام

                // مالك المؤسسة وأدمن المؤسسة يرون جميع مهام جميع الأقسام
                if (userClaims?.isOrgOwner || userClaims?.isOrgAdmin) {
                  console.log(`[DEPT FILTER] Owner/Admin access for task ${doc.id}`, {
                    taskContext: data.taskContext,
                    parentTaskId: data.parentTaskId,
                    departmentId: data.departmentId,
                    assignedToUserId: data.assignedToUserId,
                    assignedToUserIds: data.assignedToUserIds
                  });
                  // يرون جميع مهام الأقسام:
                  // 1. المهام الأصلية للقسم (taskContext === 'department' بدون parentTaskId)
                  // 2. المهام المُوزعة من المؤسسة للقسم (taskContext === 'department' مع parentTaskId)
                  const shouldShow = data.taskContext === 'department';
                  console.log(`[DEPT FILTER] Owner/Admin decision for task ${doc.id}: ${shouldShow}`);
                  return shouldShow;
                }

                // أعضاء الأقسام يرون مهام قسمهم فقط
                if (!userClaims?.departmentId) return false; // يجب أن ينتمي لقسم
                if (data.departmentId !== userClaims?.departmentId) return false; // نفس القسم فقط

                // المهندسون والمشرفون يرون جميع مهام القسم (المهندس أعلى من المشرف)
                if (userClaims?.isOrgEngineer || userClaims?.isOrgSupervisor) {
                  console.log(`[DEPT FILTER] Engineer/Supervisor access for task ${doc.id}`);
                  // يرون جميع مهام قسمهم:
                  // 1. المهام الأصلية للقسم (taskContext === 'department' بدون parentTaskId)
                  // 2. المهام المُوزعة من المؤسسة للقسم (taskContext === 'department' مع parentTaskId)
                  return data.taskContext === 'department' &&
                         data.departmentId === userClaims?.departmentId;
                }

                // أعضاء القسم العاديون (فنيون، مساعدون فنيون) يرون:
                // 1. جميع مهام قسمهم (taskContext === 'department')
                // 2. سواء كانت أصلية أو مُوزعة من المؤسسة
                if (userClaims?.isOrgTechnician || userClaims?.isOrgAssistant) {
                  const isDeptTask = data.taskContext === 'department' &&
                                   data.departmentId === userClaims?.departmentId;
                  console.log(`[DEPT FILTER] Technician/Assistant access for task ${doc.id}:`, {
                    isDeptTask,
                    taskContext: data.taskContext,
                    taskDeptId: data.departmentId,
                    userDeptId: userClaims?.departmentId,
                    parentTaskId: data.parentTaskId,
                    currentUser: user?.uid
                  });
                  return isDeptTask;
                }

                // للأدوار الأخرى - لا يُسمح بالوصول
                console.log(`[DEPT FILTER] No access for task ${doc.id} - unrecognized role`);
                return false;

              case 'individual':
                // المهام الفردية - تشمل فقط:
                // 1. المهام المُسندة للمستخدم شخصياً (assignedToUserId أو assignedToUserIds)
                // 2. المهام الفردية التي أنشأها المستخدم (taskContext === 'individual')
                // 3. المهام الفرعية المُسندة للمستخدم من مهام الأقسام أو المؤسسة
                const isAssignedToUser = data.assignedToUserId === user?.uid ||
                                       (data.assignedToUserIds && data.assignedToUserIds.includes(user?.uid));
                const isOwnIndividualTask = data.taskContext === 'individual' &&
                                          (data.userId === user?.uid || data.createdBy === user?.uid);

                // المهام الفرعية المُسندة للمستخدم (من مهام المؤسسة أو الأقسام)
                const isAssignedSubtask = data.parentTaskId &&
                                        (data.assignedToUserId === user?.uid ||
                                         (data.assignedToUserIds && data.assignedToUserIds.includes(user?.uid)));

                console.log(`[INDIVIDUAL FILTER] Task ${doc.id} (${data.description}):`, {
                  isAssignedToUser,
                  isOwnIndividualTask,
                  isAssignedSubtask,
                  taskContext: data.taskContext,
                  assignedToUserId: data.assignedToUserId,
                  assignedToUserIds: data.assignedToUserIds,
                  userId: data.userId,
                  createdBy: data.createdBy,
                  currentUserId: user?.uid,
                  parentTaskId: data.parentTaskId,
                  status: data.status
                });

                return isAssignedToUser || isOwnIndividualTask || isAssignedSubtask;

              default:
                return false;
            }
          };

          if (!shouldIncludeTask()) {
            console.log(`Skipping task ${doc.id} - doesn't match filter ${taskTypeFilter}`, {
              taskContext: data.taskContext,
              departmentId: data.departmentId,
              assignedToUserId: data.assignedToUserId,
              userId: data.userId,
              createdBy: data.createdBy,
              userDepartmentId: userClaims?.departmentId,
              currentUserId: user?.uid,
              userRole: {
                isOrgOwner: userClaims?.isOrgOwner,
                isOrgAdmin: userClaims?.isOrgAdmin,
                isOrgEngineer: userClaims?.isOrgEngineer,
                isOrgSupervisor: userClaims?.isOrgSupervisor,
                isOrgTechnician: userClaims?.isOrgTechnician,
                isOrgAssistant: userClaims?.isOrgAssistant
              }
            });
            return; // تخطي هذه المهمة
          }

          // تحويل البيانات من Firestore إلى كائن المهمة
          const task: TaskType = {
            id: doc.id,
            description: data.description || '',
            details: data.details || '',
            status: data.status as TaskStatus,
            priority: data.priority as PriorityLevel,
            dueDate: data.dueDate ? data.dueDate.toDate() : undefined,
            startDate: data.startDate ? data.startDate.toDate() : undefined,
            durationValue: data.durationValue || undefined,
            durationUnit: data.durationUnit as DurationUnit || undefined,
            taskCategoryName: data.taskCategoryName || undefined,
            priorityReason: data.priorityReason || undefined,
            milestones: data.milestones ? data.milestones.map((m: any) => ({
              id: m.id,
              description: m.description || '',
              completed: m.completed,
              weight: m.weight || 1,
              dueDate: m.dueDate ? m.dueDate.toDate() : undefined
            })) : [],
            organizationId: data.organizationId || undefined,
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
            order: data.order || 0,
            // إضافة الحقول المفقودة مع تحويل null إلى undefined
            assignedToUserId: data.assignedToUserId || undefined,
            assignedToUserIds: data.assignedToUserIds || undefined, // إضافة حقل assignedToUserIds
            taskContext: data.taskContext || undefined,
            departmentId: data.departmentId || undefined,
            createdBy: data.createdBy || undefined,
            parentTaskId: data.parentTaskId || undefined, // إضافة حقل parentTaskId
          };

          fetchedTasks.push(task);
        });

        // ترتيب المهام حسب order أو تاريخ الإنشاء
        fetchedTasks.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          // التعامل مع حالة عدم وجود createdAt
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });

        console.log('Fetched organization tasks:', fetchedTasks.length, fetchedTasks);
        // تحديث المهام في السياق
        if (setTasksDirectly) {
          setTasksDirectly(fetchedTasks);
          console.log('Tasks updated in context');
        } else {
          console.error('setTasksDirectly is not available');
        }
      },
      (error) => {
        console.error('Error fetching organization tasks:', error);
        const isPermissionError = handleFirestoreError(error, 'OrganizationTasksPage');

        if (!isPermissionError) {
          toast({
            title: 'خطأ في جلب المهام',
            description: 'حدث خطأ أثناء محاولة جلب المهام.',
            variant: 'destructive',
          });
        }
      }
    );

    // إضافة listener إلى مدير listeners
    firestoreListenerManager.addListener(`org-tasks-${organizationId}`, unsubscribe);

    // تنظيف المستمع عند تفكيك المكون
    return () => {
      unsubscribe();
      firestoreListenerManager.removeListener(`org-tasks-${organizationId}`);
    };
  }, [user, organizationId, setTasksDirectly, toast, taskTypeFilter, userClaims]);

  // معالجة حدث انتهاء السحب
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentTasks = tasks || [];
      const oldIndex = currentTasks.findIndex(task => task.id === active.id);
      const newIndex = currentTasks.findIndex(task => task.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // تحديث ترتيب المهام محليًا
        const newTasks = arrayMove(currentTasks, oldIndex, newIndex);

        // تحديث ترتيب المهام في Firestore
        const updatedTasks = newTasks.map((task, index) => ({
          ...task,
          order: index
        }));

        // تحديث المهام في السياق
        setTasksDirectly(updatedTasks);

        // تحديث ترتيب المهام في Firestore
        updatedTasks.forEach(task => {
          const taskRef = doc(db, 'tasks', task.id);
          updateDoc(taskRef, { order: task.order }).catch(error => {
            console.error(`Error updating task order for ${task.id}:`, error);
            toast({
              title: 'خطأ في تحديث ترتيب المهام',
              description: 'حدث خطأ أثناء محاولة تحديث ترتيب المهام.',
              variant: 'destructive',
            });
          });
        });
      }
    }
  }, [tasks, setTasksDirectly, toast]);

  // معالجة حذف المهمة
  const handleDeleteTask = useCallback(async () => {
    if (!taskToDelete) return;

    try {
      // حذف المهمة من Firestore
      await deleteDoc(doc(db, 'tasks', taskToDelete.id));

      // حذف المهمة من السياق
      removeTaskOptimistic(taskToDelete.id);

      toast({
        title: 'تم حذف المهمة',
        description: 'تم حذف المهمة بنجاح.',
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'خطأ في حذف المهمة',
        description: 'حدث خطأ أثناء محاولة حذف المهمة.',
        variant: 'destructive',
      });
    } finally {
      setTaskToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  }, [taskToDelete, removeTaskOptimistic, toast]);

  // دالة تنفيذ تغيير الحالة
  const executeStatusChange = useCallback(async (task: TaskType, newStatus: TaskStatus, resetMilestones: boolean = false) => {
    const updatedTask = { ...task, status: newStatus };
    updateTaskOptimistic(task.id, updatedTask);

    try {
      // إذا كانت إعادة فتح وطُلب إعادة تعيين نقاط التتبع
      if (newStatus === 'pending' && (task.status === 'completed' || task.status === 'cancelled') && resetMilestones) {
        await resetMilestonesOnReopen(task.id);
        console.log(`Reset milestones for reopened task ${task.id}`);
      }

      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      // تحديث المهام الفرعية إذا كانت هذه مهمة رئيسية
      await updateSubtasksFromParent(task.id, newStatus);

      // تحديث المهمة الرئيسية إذا كانت هذه مهمة فرعية
      if (task.parentTaskId) {
        await updateParentTaskComprehensive(task.parentTaskId);
      }
    } catch (error) {
      console.error(`Error updating task status for ${task.id}:`, error);
      revertTaskOptimistic(task.id, task);
      toast({
        title: 'خطأ في تحديث حالة المهمة',
        description: 'حدث خطأ أثناء محاولة تحديث حالة المهمة.',
        variant: 'destructive',
      });
    }
  }, [updateTaskOptimistic, revertTaskOptimistic, toast]);

  // معالجة تأكيد إعادة الفتح
  const handleReopenConfirm = useCallback((resetMilestones: boolean) => {
    if (taskToReopen) {
      executeStatusChange(taskToReopen, 'pending', resetMilestones);
      setTaskToReopen(null);
    }
  }, [taskToReopen, executeStatusChange]);

  // التحقق من وجود سياق صفحة المهام
  if (!taskPageContext) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <AlertTriangle className="h-8 w-8 text-destructive ml-2" />
        <span>خطأ في تحميل سياق صفحة المهام</span>
      </div>
    );
  }



  return (
    <div className="flex flex-col h-full">
      {/* Task Content Area */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {/* Use flex-1 and overflow-y-auto */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {(() => {
            console.log('Render conditions:', {
              filteredTasksLength: debouncedFilteredTasks?.length || 0,
              tasksLength: debouncedTasks?.length || 0,
              hasFilters: !!(categoryFilter || dateFilter?.startDate || dateFilter?.endDate),
              categoryFilter,
              dateFilter
            });

            if (!debouncedTasks || !debouncedFilteredTasks) {
              return (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-10">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg">جاري تحميل المهام...</p>
                </div>
              );
            }

            if (debouncedFilteredTasks.length === 0 && (categoryFilter || dateFilter?.startDate || dateFilter?.endDate)) {
              return (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-10">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg">لا توجد مهام تطابق الفلاتر الحالية</p>
                  <Button variant="link" onClick={() => {
                    setCategoryFilter?.(null);
                    setDateFilter?.({ startDate: null, endDate: null });
                  }}>إزالة الفلاتر</Button>
                </div>
              );
            }

            if (debouncedTasks.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-10">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg">لا توجد مهام للعرض</p>
                  <p className="text-sm mt-2">
                    استخدم زر <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded-md mx-1">+</kbd> لإضافة مهمة جديدة
                  </p>
                </div>
              );
            }

            return (
            <Tabs value={selectedCategory}> {/* Use Tabs to show/hide content based on selectedCategory */}
              {categoryOrder.map(categoryKey => (
                <TabsContent key={categoryKey} value={categoryKey} className="mt-0">
                  <SortableContext
                    items={categorizedTasks[categoryKey]?.map(t => t.id) ?? []}
                    strategy={verticalListSortingStrategy}
                    id={categoryKey} // Use category key as ID for SortableContext
                  >
                    {/* Use currentCategoryTasks which is derived from filtered + categorized */}
                    {(() => {
                      const categoryTasks = categorizedTasks?.[categoryKey] || [];
                      console.log(`Category ${categoryKey} tasks:`, categoryTasks.length, categoryTasks);
                      return categoryTasks.length === 0;
                    })() ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">
                        لا توجد مهام في هذه الفئة
                        {categoryFilter ? ` للفئة ${categoryFilter}` : ''}
                        {dateFilter.startDate || dateFilter.endDate ? ' ضمن النطاق الزمني المحدد' : ''}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {(() => {
                          const categoryTasks = categorizedTasks?.[categoryKey] || [];
                          console.log(`Rendering ${categoryTasks.length} tasks for category ${categoryKey}`);
                          return categoryTasks.map((task) => (
                          <TaskCardTemp
                            key={task.id}
                            task={task}
                            currentCategory={categoryKey}
                            onStatusChange={async (_, newStatus) => {
                              // إذا كانت إعادة فتح (من مكتملة أو ملغية إلى معلقة)، اعرض الحوار
                              if (newStatus === 'pending' && (task.status === 'completed' || task.status === 'cancelled')) {
                                setTaskToReopen(task);
                                setIsReopenDialogOpen(true);
                                return;
                              }

                              // للحالات الأخرى، نفذ التغيير مباشرة
                              await executeStatusChange(task, newStatus);
                            }}
                            onEdit={() => {
                              setTaskToEdit(task);
                              setIsEditSheetOpen(true);
                            }}
                            onDelete={() => {
                              setTaskToDelete(task);
                              setIsDeleteDialogOpen(true);
                            }}
                            id={task.id}
                            getCategoryColor={getCategoryColor}
                          />
                          ));
                        })()}
                      </ul>
                    )}
                  </SortableContext>
                </TabsContent>
              ))}
            </Tabs>
            );
          })()}
        </div>
      </DndContext>



      {/* مربع حوار تأكيد الحذف */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف هذه المهمة؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المهمة نهائيًا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* نافذة إنشاء مهمة جديدة */}
      {user && (
        <AddTaskSheet
          user={user}
          isOpen={isAddSheetOpen}
          onOpenChange={setIsAddSheetOpen}
          showTrigger={false}
        />
      )}

      {/* نافذة تعديل المهمة */}
      {taskToEdit && user && (
        <EditTaskSheet
          task={taskToEdit}
          user={user}
          isOpen={isEditSheetOpen}
          onOpenChange={setIsEditSheetOpen}
          onTaskUpdated={() => {
            // إعادة تحميل المهام بعد التحديث
            console.log("Task updated, refreshing tasks");
          }}
        />
      )}

      {/* حوار إعادة الفتح */}
      {taskToReopen && (
        <ReopenTaskDialog
          isOpen={isReopenDialogOpen}
          onOpenChange={setIsReopenDialogOpen}
          onConfirm={handleReopenConfirm}
          taskDescription={taskToReopen.description}
          hasMilestones={taskToReopen.milestones ? taskToReopen.milestones.length > 0 : false}
        />
      )}
    </div>
  );
}
