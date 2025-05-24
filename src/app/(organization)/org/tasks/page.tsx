'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, FileText, Edit, Trash2, AlertTriangle, CalendarDays, CalendarCheck2, ListTodo, PauseCircle, CheckCircle2, Settings, Filter, Plus, Wand2, BarChart3, Users, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { TaskCardTemp } from '@/components/TaskCardTemp';
import type { TaskType, TaskStatus, TaskFirestoreData, DurationUnit, TaskCategoryDefinition, PriorityLevel } from '@/types/task';
import { useTaskPageContext, type TaskCategory, categoryInfo, categoryOrder } from '@/context/TaskPageContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firestoreListenerManager, handleFirestoreError } from '@/utils/firestoreListenerManager';
import { useToast } from '@/hooks/use-toast';
import { EditTaskSheet } from '@/components/EditTaskSheet';
import { AddTaskSheet } from '@/components/AddTaskSheet';
import { CategoryFilter } from '@/components/CategoryFilter';
import { DateFilter } from '@/components/DateFilter';
import { OkrFilter } from '@/components/OkrFilter';
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
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const organizationId = userClaims?.organizationId;

  // استخدام سياق صفحة المهام
  const taskPageContext = useTaskPageContext();

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
        const isPermissionError = handleFirestoreError(error, 'OrganizationTasksPage');

        if (!isPermissionError) {
          toast({
            title: 'خطأ في جلب المهام',
            description: 'حدث خطأ أثناء محاولة جلب المهام.',
            variant: 'destructive',
          });
        }
        setLoading(false);
      }
    );

    // إضافة listener إلى مدير listeners
    firestoreListenerManager.addListener(`org-tasks-${organizationId}`, unsubscribe);

    // تنظيف المستمع عند تفكيك المكون
    return () => {
      unsubscribe();
      firestoreListenerManager.removeListener(`org-tasks-${organizationId}`);
    };
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

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending').length;
    const overdue = tasks.filter(task => {
      if (!task.dueDate) return false;
      return task.dueDate < new Date() && task.status !== 'completed';
    }).length;
    const today = tasks.filter(task => {
      if (!task.dueDate) return false;
      const today = new Date();
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === today.toDateString();
    }).length;

    return { total, completed, pending, overdue, today };
  }, [tasks]);

  // التحقق من وجود سياق صفحة المهام
  if (!taskPageContext) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <AlertTriangle className="h-8 w-8 text-destructive ml-2" />
        <span>خطأ في تحميل سياق صفحة المهام</span>
      </div>
    );
  }

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
              setIsAddSheetOpen(true);
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

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <ListTodo className="h-4 w-4 text-muted-foreground ml-2" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">إجمالي المهام</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CalendarCheck2 className="h-4 w-4 text-blue-500 ml-2" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">مهام اليوم</p>
                <p className="text-2xl font-bold text-blue-500">{stats.today}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-orange-500 ml-2" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">قيد التنفيذ</p>
                <p className="text-2xl font-bold text-orange-500">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500 ml-2" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">متأخرة</p>
                <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">مكتملة</p>
                <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* الفلاتر */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="ml-2 h-5 w-5" />
            الفلاتر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">تصفية حسب التاريخ</label>
              <div className="text-xs text-muted-foreground">
                {dateFilter.startDate && dateFilter.endDate ?
                  `${dateFilter.startDate.toLocaleDateString()} - ${dateFilter.endDate.toLocaleDateString()}` :
                  'جميع التواريخ'
                }
              </div>
            </div>
            <CategoryFilter
              userId={user?.uid || ''}
              selectedCategory={categoryFilter}
              onSelectCategory={setCategoryFilter}
            />
            <OkrFilter
              value={okrFilter ? 'linked' : 'all'}
              onChange={(value) => setOkrFilter(value !== 'all')}
              label="تصفية حسب OKR"
              organizationId={organizationId}
            />
          </div>
        </CardContent>
      </Card>

      {/* علامات التبويب للفئات */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <Tabs
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as TaskCategory)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 h-auto p-1">
              <TabsTrigger value="today" className="flex flex-col items-center p-2 text-xs">
                <CalendarCheck2 className="h-4 w-4 mb-1 text-blue-500" />
                <span>اليوم</span>
                <Badge variant="secondary" className="text-xs">{categorizedTasks.today?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex flex-col items-center p-2 text-xs">
                <CalendarDays className="h-4 w-4 mb-1 text-green-500" />
                <span>القادمة</span>
                <Badge variant="secondary" className="text-xs">{categorizedTasks.upcoming?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex flex-col items-center p-2 text-xs">
                <AlertTriangle className="h-4 w-4 mb-1 text-red-500" />
                <span>متأخرة</span>
                <Badge variant="destructive" className="text-xs">{categorizedTasks.overdue?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex flex-col items-center p-2 text-xs">
                <CalendarDays className="h-4 w-4 mb-1 text-purple-500" />
                <span>مجدولة</span>
                <Badge variant="secondary" className="text-xs">{categorizedTasks.scheduled?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex flex-col items-center p-2 text-xs">
                <FileText className="h-4 w-4 mb-1 text-orange-500" />
                <span>معلقة</span>
                <Badge variant="secondary" className="text-xs">{categorizedTasks.pending?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="hold" className="flex flex-col items-center p-2 text-xs">
                <PauseCircle className="h-4 w-4 mb-1 text-yellow-500" />
                <span>متوقفة</span>
                <Badge variant="secondary" className="text-xs">{categorizedTasks.hold?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex flex-col items-center p-2 text-xs">
                <CheckCircle2 className="h-4 w-4 mb-1 text-green-500" />
                <span>مكتملة</span>
                <Badge variant="secondary" className="text-xs">{categorizedTasks.completed?.length || 0}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* عرض المهام */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              {categoryInfo[selectedCategory]?.icon &&
                React.createElement(categoryInfo[selectedCategory].icon, {
                  className: `ml-2 h-5 w-5 ${categoryInfo[selectedCategory].color}`
                })
              }
              {categoryInfo[selectedCategory]?.title || 'المهام'}
              <Badge variant="outline" className="mr-2">
                {tasksToDisplay.length}
              </Badge>
            </div>
            {tasksToDisplay.length > 0 && (
              <div className="text-sm text-muted-foreground">
                اسحب لإعادة الترتيب
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center">
                      {categoryInfo[selectedCategory]?.icon &&
                        React.createElement(categoryInfo[selectedCategory].icon, {
                          className: `h-12 w-12 mb-4 ${categoryInfo[selectedCategory].color} opacity-50`
                        })
                      }
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        لا توجد مهام في هذه الفئة
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        ابدأ بإنشاء مهمة جديدة أو استخدم الفلاتر لعرض مهام أخرى
                      </p>
                      <Button
                        onClick={() => {
                          setTaskToEdit(null);
                          setIsEditSheetOpen(true);
                        }}
                        variant="outline"
                      >
                        <Plus className="ml-2 h-4 w-4" />
                        إنشاء مهمة جديدة
                      </Button>
                    </div>
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
        </CardContent>
      </Card>

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
    </div>
  );
}
