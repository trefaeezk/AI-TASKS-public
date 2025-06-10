
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, FileText, Edit, Trash2, AlertTriangle, CalendarDays, CalendarCheck2, ListTodo, PauseCircle, CheckCircle2, Settings, Filter, Percent } from 'lucide-react';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { TaskCardTemp } from '@/components/TaskCardTemp';
import { AssignedTasksList } from '@/components/AssignedTasksList';
import type { TaskType, TaskStatus, TaskFirestoreData, DurationUnit, TaskCategoryDefinition, PriorityLevel, Milestone } from '@/types/task';
import { useTaskPageContext, type TaskCategory, categoryInfo, categoryOrder } from '@/context/TaskPageContext';
import { db } from '@/config/firebase';
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
import { startOfDay, isPast, isToday, isWithinInterval, isFuture, differenceInDays, parseISO, format } from 'date-fns'; // Import format here
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { Button } from '@/components/ui/button';
// Removed Popover imports as filter UI is moved
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// import { DateRangePicker } from '@/components/DateRangePicker';
// import { CategoryFilter } from '@/components/CategoryFilter';

// --- Main Page Content Component ---
 function HomePageContent() {
  const { user, userClaims } = useAuth(); // Added userClaims
  const { direction, t } = useLanguage();
  const taskPageContext = useTaskPageContext();
  const { toast } = useToast();
  const { getCategoryColor } = useTaskCategories(user?.uid);

  // State for Edit/Delete
  const [editingTask, setEditingTask] = useState<TaskType | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Get data and filter state from context safely
  const {
      tasks, // Use raw tasks for DND revert logic if needed
      filteredTasks, // Use filtered tasks for display
      categorizedTasks, // Use categorized tasks (derived from filtered)
      selectedCategory,
      setSelectedCategory,
      updateTaskOptimistic,
      revertTaskOptimistic,
      removeTaskOptimistic,
      moveTaskOptimistic,
      setTasks: setTasksDirectly, // Keep for DND reordering
      // Filters (still needed for logic, but UI moved)
      dateFilter,
      setDateFilter,
      categoryFilter,
      setCategoryFilter,
  } = taskPageContext ?? {
      tasks: [],
      filteredTasks: [],
      categorizedTasks: { overdue: [], today: [], upcoming: [], scheduled: [], hold: [], cancelled: [], completed: [] },
      selectedCategory: 'today', // Default to 'today'
      setSelectedCategory: () => {},
      updateTaskOptimistic: () => {},
      revertTaskOptimistic: () => {},
      removeTaskOptimistic: () => {},
      moveTaskOptimistic: () => {},
      setTasks: () => {},
      dateFilter: { startDate: null, endDate: null },
      setDateFilter: () => {},
      categoryFilter: null,
      setCategoryFilter: () => {},
  };

  // DND Sensors
  const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
          coordinateGetter: sortableKeyboardCoordinates,
      })
  );

  // --- Handle Task Status Change (Using Optimistic Update) ---
  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
      if (!user || !taskId || !updateTaskOptimistic || !revertTaskOptimistic || !categoryInfo) {
          console.error("Cannot update status: Missing user, taskId, context functions, or categoryInfo.");
          toast({
            title: t('general.error'),
            description: t('tasks.cannotUpdateStatus'),
            variant: 'destructive'
          });
          return;
      }

      const originalTask = tasks.find(t => t.id === taskId);
      if (!originalTask) {
          console.error("Original task not found for optimistic update.");
          return;
      }
      const originalStatus = originalTask.status;

      // Store current category to revert back if needed (or just stay)
      const currentSelectedCategory = selectedCategory;

      updateTaskOptimistic(taskId, { status: newStatus });

      // Keep the current category selected
      setSelectedCategory(currentSelectedCategory);

      const taskDocRef = doc(db, 'tasks', taskId);
      try {
          console.log(`Updating task ${taskId} status to ${newStatus}`);
          await updateDoc(taskDocRef, { status: newStatus });
          toast({
              title: t('tasks.statusUpdated'),
              description: `${t('tasks.taskStatusUpdatedTo')} ${categoryInfo[newStatus as TaskCategory]?.title ?? newStatus}`,
          });
          // No need to manually change category here, stay on the current one
          // const newCategory = getTaskCategory({ ...originalTask, status: newStatus });
          // setSelectedCategory(newCategory); // Remove this line

      } catch (error) {
          console.error("Error updating task status in Firestore:", error);
          toast({
              title: t('tasks.statusUpdateError'),
              description: t('tasks.errorUpdatingTaskStatus'),
              variant: 'destructive',
          });
          revertTaskOptimistic(taskId, { status: originalStatus });
          setSelectedCategory(currentSelectedCategory); // Revert category if needed
      }
  }, [user, tasks, updateTaskOptimistic, revertTaskOptimistic, toast, categoryInfo, selectedCategory, setSelectedCategory, t]);

  // --- Handle Edit Task ---
  const handleEditTask = useCallback((task: TaskType) => {
      setEditingTask(task);
      setShowEditSheet(true);
  }, []);

  // --- Handle Delete Task (Using Optimistic Update) ---
   const handleDeleteTask = useCallback((taskId: string) => {
      setDeletingTaskId(taskId);
      setIsDeleteDialogOpen(true);
    }, []);

  const confirmDeleteTask = useCallback(async () => {
      if (!user || !deletingTaskId || !removeTaskOptimistic || !revertTaskOptimistic) {
           console.error("Cannot delete task: Missing user, taskId, or context functions.");
           toast({
             title: t('general.error'),
             description: t('tasks.invalidTaskIdOrNotLoggedIn'),
             variant: 'destructive'
           });
          setIsDeleteDialogOpen(false);
          setDeletingTaskId(null);
          return;
      }

       const taskToDelete = tasks.find(t => t.id === deletingTaskId);
       if (!taskToDelete) {
           console.error("Task to delete not found for optimistic removal.");
           setIsDeleteDialogOpen(false);
           setDeletingTaskId(null);
           return;
       }

       const currentSelectedCategory = selectedCategory; // Keep current category

       removeTaskOptimistic(deletingTaskId);
       setIsDeleteDialogOpen(false);
       setSelectedCategory(currentSelectedCategory); // Stay on current category

      const taskDocRef = doc(db, 'tasks', deletingTaskId);
      try {
          console.log(`Deleting task ${deletingTaskId}`);
          await deleteDoc(taskDocRef);
          toast({
              title: t('tasks.taskDeleted'),
              description: t('tasks.taskDeletedSuccessfully'),
          });
           setDeletingTaskId(null);
           // No need to change category
      } catch (error) {
          console.error("Error deleting task from Firestore:", error);
          toast({
              title: t('tasks.taskDeleteError'),
              description: t('tasks.errorDeletingTask'),
              variant: 'destructive',
          });
           revertTaskOptimistic(deletingTaskId, taskToDelete);
           setDeletingTaskId(null);
           setSelectedCategory(currentSelectedCategory); // Revert category if needed
      }
  }, [user, deletingTaskId, tasks, removeTaskOptimistic, revertTaskOptimistic, toast, selectedCategory, setSelectedCategory, t]);

   // --- Handle Drag and Drop End ---
   const handleDragEnd = useCallback(async (event: DragEndEvent) => {
       const { active, over } = event;

        if (!over || !active.id) {
            console.log("DND: Drag ended outside a drop zone or active item missing.");
            return;
        }

        const activeId = active.id as string;
        const overId = over.id as string;

        // Store the category the user is currently viewing
        const currentSelectedCategory = selectedCategory;

        if (activeId !== overId) {
            // Find the original task from the raw tasks list
            const originalTask = tasks.find((task) => task.id === activeId);
            if (!originalTask) {
                 console.error("DND: Original task not found for", activeId);
                 return;
             }

            // Determine the target category based on the 'over' item's category
            let targetCategoryKey: TaskCategory | null = null;
            for (const catKey of categoryOrder) {
                 if (categorizedTasks[catKey]?.some(t => t.id === overId)) {
                     targetCategoryKey = catKey;
                     break;
                 }
                 // Allow dropping onto an empty category list container (using data attribute)
                 if (over.data.current?.sortable?.containerId === catKey) {
                    targetCategoryKey = catKey;
                    break;
                }
            }

             if (targetCategoryKey) {
                const newStatus: TaskStatus | null =
                    targetCategoryKey === 'completed' ? 'completed' :
                    targetCategoryKey === 'cancelled' ? 'cancelled' :
                    targetCategoryKey === 'hold' ? 'hold' :
                    (targetCategoryKey === 'overdue' || targetCategoryKey === 'today' || targetCategoryKey === 'upcoming' || targetCategoryKey === 'scheduled') ? 'pending' :
                    null;

                if (newStatus !== null && originalTask.status !== newStatus) {
                    // Optimistic update for status change
                    moveTaskOptimistic(activeId, targetCategoryKey);
                    // Keep the user on the category they were viewing
                    setSelectedCategory(currentSelectedCategory);

                    // Update Firestore
                    const taskDocRef = doc(db, 'tasks', activeId);
                    try {
                        console.log(`Updating task ${activeId} status to ${newStatus} via DND to category ${targetCategoryKey}`);
                        await updateDoc(taskDocRef, { status: newStatus });
                        toast({
                            title: t('tasks.taskMoved'),
                            description: `${t('tasks.taskMovedTo')} ${categoryInfo[targetCategoryKey]?.title ?? targetCategoryKey}`,
                        });
                    } catch (error) {
                        console.error("Error updating task status in Firestore after DND:", error);
                        toast({
                            title: t('tasks.taskMoveError'),
                            description: t('tasks.errorMovingTask'),
                            variant: 'destructive',
                        });
                         console.warn("Reverting DND status change");
                         revertTaskOptimistic(activeId, { status: originalTask.status });
                         // Stay on the original category if the update fails
                         setSelectedCategory(currentSelectedCategory);
                    }
                } else if (originalTask.status === tasks.find(t=>t.id === overId)?.status || targetCategoryKey === selectedCategory) {
                     // Handle reordering within the same category visually (order not saved to Firestore yet)
                     if (setTasksDirectly) {
                         setTasksDirectly((currentTasks) => {
                             const oldIdx = currentTasks.findIndex(t => t.id === activeId);
                             const newIdx = currentTasks.findIndex(t => t.id === overId);
                             if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return currentTasks; // Add check for same index
                             return arrayMove(currentTasks, oldIdx, newIdx);
                         });
                         console.log("Task reordered visually within the same category (order not saved).");
                         // Stay on the current category
                          setSelectedCategory(currentSelectedCategory);
                     }
                } else {
                     console.log("DND: No status change needed or reordering across different displayed categories.");
                     // Stay on the current category
                     setSelectedCategory(currentSelectedCategory);
                }
            } else {
                 console.log("DND: Invalid drop target category.");
                 // Stay on the current category
                 setSelectedCategory(currentSelectedCategory);
            }
        } else {
             console.log("DND: Dragged item onto itself.");
             // Stay on the current category
             setSelectedCategory(currentSelectedCategory);
        }
    }, [user, tasks, moveTaskOptimistic, toast, categoryInfo, setTasksDirectly, revertTaskOptimistic, categorizedTasks, updateTaskOptimistic, selectedCategory, setSelectedCategory, t]);

  // --- Render Logic ---
  if (!taskPageContext || !user) {
     return <div className="text-center p-4">{t('general.errorLoadingPageContextOrUser')}</div>;
  }

  const currentCategoryTasks = categorizedTasks[selectedCategory] ?? [];

  return (
    <div dir={direction} className="flex flex-col h-full">
        {/* Assigned Tasks - Conditionally render based on account type */}
        {userClaims?.accountType === 'organization' && userClaims?.organizationId && (
          <AssignedTasksList className="mb-8" />
        )}

        {/* Task Content Area */}
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            {/* Use flex-1 and overflow-y-auto */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
                 {filteredTasks.length === 0 && (categoryFilter || dateFilter.startDate || dateFilter.endDate) ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-10">
                         <FileText className="w-16 h-16 mb-4" />
                         <p className="text-lg">{t('tasks.noTasksMatchCurrentFilters')}</p>
                         <Button variant="link" onClick={() => { setCategoryFilter(null); setDateFilter({ startDate: null, endDate: null }); }}>{t('tasks.removeFilters')}</Button>
                     </div>
                 ) : tasks.length === 0 ? ( // Check original tasks length for the initial empty state
                     <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-10">
                         <FileText className="w-16 h-16 mb-4" />
                         <p className="text-lg">{t('tasks.noTasksToDisplay')}</p>
                         <p className="text-sm mt-2">
                             {t('tasks.useButtonToAddNewTask')} <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded-md mx-1">+</kbd>
                         </p>
                     </div>
                 ) : (
                     <Tabs value={selectedCategory}> {/* Use Tabs to show/hide content based on selectedCategory */}
                         {categoryOrder.map(categoryKey => (
                             <TabsContent key={categoryKey} value={categoryKey} className="mt-0">
                                <SortableContext
                                     items={categorizedTasks[categoryKey]?.map(t => t.id) ?? []}
                                     strategy={verticalListSortingStrategy}
                                     id={categoryKey} // Use category key as ID for SortableContext
                                 >
                                     {/* Use currentCategoryTasks which is derived from filtered + categorized */}
                                     {categorizedTasks[categoryKey]?.length === 0 ? (
                                         <p className="text-center text-muted-foreground py-8 text-sm">
                                             {t('tasks.noTasksInCategory')}
                                             {categoryFilter ? ` ${t('tasks.forCategory')} ${categoryFilter}` : ''}
                                             {dateFilter.startDate || dateFilter.endDate ? ` ${t('tasks.withinSpecifiedDateRange')}` : ''}
                                         </p>
                                     ) : (
                                         <ul className="space-y-3">
                                             {categorizedTasks[categoryKey]?.map((task) => (
                                                 <TaskCardTemp
                                                     key={task.id}
                                                     task={task}
                                                     onStatusChange={handleStatusChange}
                                                     onEdit={handleEditTask}
                                                     onDelete={handleDeleteTask}
                                                     id={task.id}
                                                     getCategoryColor={getCategoryColor}
                                                     currentCategory={categoryKey}
                                                 />
                                             ))}
                                         </ul>
                                     )}
                                 </SortableContext>
                             </TabsContent>
                         ))}
                     </Tabs>
                 )}
            </div>
        </DndContext>

         {/* Edit Task Sheet */}
         {user && editingTask && (
             <EditTaskSheet
                 user={user}
                 task={editingTask}
                 isOpen={showEditSheet}
                 onOpenChange={setShowEditSheet}
                 onTaskUpdated={() => setEditingTask(null)}
             />
         )}

         {/* Delete Confirmation Dialog */}
         <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
             <AlertDialogContent dir={direction}>
                 <AlertDialogHeader>
                 <AlertDialogTitle>{t('tasks.deleteTaskConfirmation')}</AlertDialogTitle>
                 <AlertDialogDescription>
                     {t('tasks.deleteTaskWarning')}
                 </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                 <AlertDialogCancel onClick={() => setDeletingTaskId(null)}>{t('general.cancel')}</AlertDialogCancel>
                 <AlertDialogAction
                     onClick={confirmDeleteTask}
                     asChild
                 >
                      <Button variant="destructive">{t('general.delete')}</Button>
                 </AlertDialogAction>
                 </AlertDialogFooter>
             </AlertDialogContent>
         </AlertDialog>

    </div>
  );
}

export default function HomePage() {
    return <HomePageContent />;
}

