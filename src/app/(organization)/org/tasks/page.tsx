'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, FileText, Edit, Trash2, AlertTriangle, CalendarDays, CalendarCheck2, ListTodo, PauseCircle, CheckCircle2, Settings, Filter, Plus, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { TaskCardTemp } from '@/components/TaskCardTemp';
import type { TaskType, TaskStatus, TaskFirestoreData, DurationUnit, TaskCategoryDefinition, PriorityLevel } from '@/types/task';
import { useTaskPageContext, type TaskCategory, categoryInfo, categoryOrder } from '@/context/TaskPageContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { EditTaskSheet } from '@/components/EditTaskSheet';
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

export default function OrganizationTasksPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [taskToDelete, setTaskToDelete] = useState<TaskType | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<TaskType | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const organizationId = userClaims?.organizationId;

  // استخدام سياق صفحة المهام
  const taskPageContext = useTaskPageContext();

  // التحقق من وجود سياق صفحة المهام
  if (!taskPageContext) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <AlertTriangle className="h-8 w-8 text-destructive ml-2" />
        <span>خطأ في تحميل سياق صفحة المهام</span>
      </div>
    );
  }

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
  } = taskPageContext;

  // تكوين أجهزة استشعار السحب والإفلات
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
      setLoading(false);
      return;
    }

    setLoading(true);

    // إنشاء استعلام للمهام الخاصة بالمؤسسة
    const tasksColRef = collection(db, 'tasks');
    const q = query(
      tasksColRef,
      where('organizationId', '==', organizationId),
      orderBy('order', 'asc')
    );

    // إنشاء مستمع للتغييرات في المهام
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTasks: TaskType[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data() as TaskFirestoreData;

          // تحويل البيانات من Firestore إلى كائن المهمة
          // Crear un objeto que cumpla con la interfaz TaskType
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
          };

          fetchedTasks.push(task);
        });

        // تحديث المهام في السياق
        setTasksDirectly(fetchedTasks);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching tasks:', error);
        toast({
          title: 'خطأ في جلب المهام',
          description: 'حدث خطأ أثناء محاولة جلب المهام.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    // تنظيف المستمع عند تفكيك المكون
    return () => unsubscribe();
  }, [user, organizationId, setTasksDirectly, toast]);

  // معالجة حدث انتهاء السحب
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex(task => task.id === active.id);
      const newIndex = tasks.findIndex(task => task.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // تحديث ترتيب المهام محليًا
        const newTasks = arrayMove(tasks, oldIndex, newIndex);

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

  // عرض حالة التحميل
  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mr-2">جاري تحميل المهام...</span>
        </div>
      </div>
    );
  }

  // عرض المهام حسب الفئة المحددة
  const tasksToDisplay = categorizedTasks[selectedCategory] || [];

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <ListTodo className="ml-2 h-6 w-6" />
          مهام المؤسسة
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              // إنشاء مهمة جديدة
              setTaskToEdit(null);
              setIsEditSheetOpen(true);
            }}
            className="flex items-center"
          >
            <Plus className="ml-2 h-4 w-4" />
            مهمة جديدة
          </Button>
          <Button
            onClick={() => {
              // إنشاء خطة
              window.location.href = '/org/reports';
            }}
            variant="outline"
            className="flex items-center"
          >
            <Wand2 className="ml-2 h-4 w-4" />
            إنشاء خطة
          </Button>
        </div>
      </div>

      {/* عرض علامات التبويب للأجهزة المحمولة */}
      <div className="md:hidden mb-4">
        <Tabs
          value={selectedCategory}
          onValueChange={(value) => setSelectedCategory(value as TaskCategory)}
          className="w-full"
        >
          <TabsContent value="today" className="mt-0">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <CalendarCheck2 className="ml-2 h-5 w-5 text-blue-500" />
              مهام اليوم
            </h2>
          </TabsContent>
          <TabsContent value="upcoming" className="mt-0">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <CalendarDays className="ml-2 h-5 w-5 text-green-500" />
              المهام القادمة
            </h2>
          </TabsContent>
          <TabsContent value="overdue" className="mt-0">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <AlertTriangle className="ml-2 h-5 w-5 text-red-500" />
              المهام المتأخرة
            </h2>
          </TabsContent>
          <TabsContent value="scheduled" className="mt-0">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <CalendarDays className="ml-2 h-5 w-5 text-purple-500" />
              المهام المجدولة
            </h2>
          </TabsContent>
          <TabsContent value="pending" className="mt-0">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <FileText className="ml-2 h-5 w-5 text-orange-500" />
              المهام المعلقة
            </h2>
          </TabsContent>
          <TabsContent value="hold" className="mt-0">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <PauseCircle className="ml-2 h-5 w-5 text-yellow-500" />
              المهام المتوقفة
            </h2>
          </TabsContent>
          <TabsContent value="completed" className="mt-0">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <CheckCircle2 className="ml-2 h-5 w-5 text-green-500" />
              المهام المكتملة
            </h2>
          </TabsContent>
        </Tabs>
      </div>

      {/* عرض المهام */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tasksToDisplay.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {tasksToDisplay.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد مهام في هذه الفئة
              </div>
            ) : (
              tasksToDisplay.map(task => (
                <TaskCardTemp
                  key={task.id}
                  id={task.id}
                  task={task}
                  onEdit={() => {
                    setTaskToEdit(task);
                    setIsEditSheetOpen(true);
                  }}
                  onDelete={() => {
                    setTaskToDelete(task);
                    setIsDeleteDialogOpen(true);
                  }}
                  onStatusChange={(taskId, newStatus) => {
                    const updatedTask = { ...task, status: newStatus };
                    updateTaskOptimistic(task.id, updatedTask);

                    const taskRef = doc(db, 'tasks', task.id);
                    updateDoc(taskRef, {
                      status: newStatus,
                      updatedAt: Timestamp.now()
                    }).catch(error => {
                      console.error(`Error updating task status for ${task.id}:`, error);
                      revertTaskOptimistic(task.id, task);
                      toast({
                        title: 'خطأ في تحديث حالة المهمة',
                        description: 'حدث خطأ أثناء محاولة تحديث حالة المهمة.',
                        variant: 'destructive',
                      });
                    });
                  }}
                />
              ))
            )}
          </div>
        </SortableContext>
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

      {/* نافذة تعديل المهمة */}
      {taskToEdit && user && (
        <EditTaskSheet
          task={taskToEdit}
          user={user}
          isOpen={isEditSheetOpen}
          onOpenChange={setIsEditSheetOpen}
          onTaskUpdated={() => {
            // Recargar las tareas después de actualizar
            console.log("Task updated, refreshing tasks");
          }}
        />
      )}
    </div>
  );
}
