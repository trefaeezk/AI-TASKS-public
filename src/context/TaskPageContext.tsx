
// src/context/TaskPageContext.tsx
'use client';

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { TaskType, TaskStatus } from '@/types/task';
import { startOfDay, isPast, isToday, isWithinInterval, isFuture, differenceInDays, startOfMonth, endOfMonth, subMonths, endOfDay } from 'date-fns'; // Added date functions
import { AlertTriangle, CalendarDays, CalendarCheck2, ListTodo, PauseCircle, CheckCircle2 } from 'lucide-react';

// Define category types and order
export type TaskCategory = 'overdue' | 'today' | 'upcoming' | 'scheduled' | 'pending' | 'hold' | 'completed';
export const categoryOrder: TaskCategory[] = ['overdue', 'today', 'upcoming', 'scheduled', 'pending', 'hold', 'completed'];

// Define category display info
export const categoryInfo: Record<TaskCategory, { title: string; icon: React.ElementType; color: string }> = {
    overdue: { title: 'فائتة', icon: AlertTriangle, color: 'text-destructive' },
    today: { title: 'اليوم', icon: CalendarDays, color: 'text-blue-500' },
    upcoming: { title: 'قادمة', icon: CalendarCheck2, color: 'text-amber-500' },
    scheduled: { title: 'مجدولة', icon: ListTodo, color: 'text-purple-500' },
    pending: { title: 'قيد الانتظار', icon: ListTodo, color: 'text-gray-500' }, // Represents tasks without specific dates fitting other categories
    hold: { title: 'معلقة', icon: PauseCircle, color: 'text-gray-500' },
    completed: { title: 'مكتملة', icon: CheckCircle2, color: 'text-status-completed' },
};

// Function to determine the category of a task
const getTaskCategory = (task: TaskType): TaskCategory => {
     const todayStart = startOfDay(new Date());
     // Ensure dates are valid Date objects
     const startDate = task.startDate instanceof Date && !isNaN(task.startDate.getTime()) ? startOfDay(task.startDate) : null;
     const dueDate = task.dueDate instanceof Date && !isNaN(task.dueDate.getTime()) ? startOfDay(task.dueDate) : null;

     if (task.status === 'completed') return 'completed';
     if (task.status === 'hold') return 'hold';

     // If pending status, categorize based on dates
     if (task.status === 'pending') {
         if (dueDate && isPast(dueDate) && !isToday(dueDate)) return 'overdue';
         if (dueDate && isToday(dueDate)) return 'today'; // Explicitly check due today first
         if (startDate && isToday(startDate)) return 'today'; // Check start today
         // Check if today falls between start and due date (inclusive)
         if (startDate && dueDate && isWithinInterval(todayStart, { start: startDate, end: dueDate })) return 'today';
         // Check upcoming (within 7 days)
         if ((startDate && isFuture(startDate) && differenceInDays(startDate, todayStart) <= 7) ||
             (dueDate && isFuture(dueDate) && differenceInDays(dueDate, todayStart) <= 7)) return 'upcoming';
         // Check scheduled (more than 7 days away)
         if ((startDate && isFuture(startDate) && differenceInDays(startDate, todayStart) > 7) ||
             (dueDate && isFuture(dueDate) && differenceInDays(dueDate, todayStart) > 7)) return 'scheduled';
     }

     // Default to 'pending' if no other category fits
     return 'pending';
};

// Interface for Date Range Filter
export interface DateFilter {
  startDate: Date | null;
  endDate: Date | null;
}

interface TaskPageContextType {
  tasks: TaskType[]; // Raw tasks from loader
  filteredTasks: TaskType[]; // Tasks after applying filters
  categorizedTasks: Record<TaskCategory, TaskType[]>;
  selectedCategory: TaskCategory;
  setSelectedCategory: Dispatch<SetStateAction<TaskCategory>>;
  categoryInfo: typeof categoryInfo;
  categoryOrder: typeof categoryOrder;
  // Filter state and setters
  dateFilter: DateFilter;
  setDateFilter: Dispatch<SetStateAction<DateFilter>>;
  categoryFilter: string | null;
  setCategoryFilter: Dispatch<SetStateAction<string | null>>;
  okrFilter: boolean;
  setOkrFilter: Dispatch<SetStateAction<boolean>>;
  // Optimistic update functions
  updateTaskOptimistic: (taskId: string, updates: Partial<TaskType>) => void;
  revertTaskOptimistic: (taskId: string, originalState: Partial<TaskType> | TaskType) => void; // Allow full task revert
  removeTaskOptimistic: (taskId: string) => void;
  moveTaskOptimistic: (taskId: string, targetCategory: TaskCategory) => void;
  setTasks: Dispatch<SetStateAction<TaskType[]>>; // Allow direct setting for DND reordering
}

const TaskPageContext = createContext<TaskPageContextType | null>(null);

export const TaskPageProvider = ({ initialTasks = [], children }: { initialTasks?: TaskType[], children: ReactNode }) => {
  // Directly use initialTasks from props to set the state
  const [tasks, setTasks] = useState<TaskType[]>(initialTasks);
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>('today');
  const [previousTaskState, setPreviousTaskState] = useState<Record<string, Partial<TaskType> | TaskType>>({}); // Store partial or full task
  const initialCategorySet = useRef(false); // Ref to track initial setting

  // تهيئة فلتر التاريخ ليكون شهر ماضي وشهر لاحق من تاريخ اليوم افتراضيًا
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysLater.setDate(now.getDate() + 30);
    return { startDate: thirtyDaysAgo, endDate: thirtyDaysLater };
  });

  const [categoryFilter, setCategoryFilter] = useState<string | null>(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('lastCategoryFilter') || null;
      }
      return null;
  });
  const [okrFilter, setOkrFilter] = useState<boolean>(false);
  // Flag to track if user has actively set a date filter
  const hasUserSetDateFilter = useRef(false);

   // Save category filter to localStorage
   useEffect(() => {
       if (typeof window !== 'undefined') {
           if (categoryFilter) {
               localStorage.setItem('lastCategoryFilter', categoryFilter);
           } else {
               localStorage.removeItem('lastCategoryFilter');
           }
       }
   }, [categoryFilter]);

   // Wrapper for setDateFilter to track user interaction
   const handleSetDateFilter: Dispatch<SetStateAction<DateFilter>> = (value) => {
       hasUserSetDateFilter.current = true; // Mark that user has set the filter
       setDateFilter(value);
   };

   // Set default date filter based on selected category, only if user hasn't set one
   useEffect(() => {
       if (hasUserSetDateFilter.current) {
           // Reset the flag when category changes, allowing default to apply again if needed
           // Or keep the user's filter? Let's reset the flag for now.
           // hasUserSetDateFilter.current = false;
           return; // Don't override user's manual filter setting immediately
       }

       console.log(`Applying default date filter for category: ${selectedCategory}`);
       let defaultStartDate: Date | null = null;
       let defaultEndDate: Date | null = null;

       // تعيين الفلتر الافتراضي ليكون شهر ماضي وشهر لاحق من تاريخ اليوم لجميع الفئات
       const now = new Date();
       defaultStartDate = new Date();
       defaultEndDate = new Date();
       defaultStartDate.setDate(now.getDate() - 30);
       defaultEndDate.setDate(now.getDate() + 30);

       console.log(` - Default date filter for ${selectedCategory}: ${defaultStartDate} to ${defaultEndDate}`);

       setDateFilter({ startDate: defaultStartDate, endDate: defaultEndDate });

   }, [selectedCategory]); // Run when selectedCategory changes

   // Reset user filter flag when category changes so defaults can apply again
    useEffect(() => {
        hasUserSetDateFilter.current = false;
    }, [selectedCategory]);


  // Update state if initialTasks prop changes (e.g., due to TaskDataLoader update)
  useEffect(() => {
    console.log("TaskPageProvider: initialTasks prop updated, setting tasks state.", initialTasks.length);
    setTasks(initialTasks);
    if (initialTasks.length === 0) {
        initialCategorySet.current = false;
    }
  }, [initialTasks]); // Only depend on initialTasks

   // Apply filters
   const filteredTasks = useMemo(() => {
       console.log("TaskPageProvider: Applying filters...", { categoryFilter, dateFilter, okrFilter });
       return tasks.filter(task => {
           // Category Filter
           if (categoryFilter && task.taskCategoryName !== categoryFilter) {
               // console.log(` - Task ${task.id} filtered out by category: ${task.taskCategoryName} !== ${categoryFilter}`);
               return false;
           }

           // OKR Filter
           if (okrFilter && !task.linkedToOkr) {
               return false;
           }

           // Date Filter
           // Apply based on the selected category's logic
           let relevantDate: Date | null = null;

           // لا نطبق فلتر التاريخ على المهام المعلقة (hold/blocked) والمهام الفائتة (overdue)
           // لتجنب خطر فقدان هذه المهام المهمة
           if (selectedCategory === 'hold' || selectedCategory === 'overdue' ||
               task.status === 'hold' || (task.status === 'blocked' as any) ||
               (task.dueDate && task.dueDate < new Date() && task.status === 'pending')) {
               // تجاهل فلتر التاريخ لهذه المهام
               return true;
           }

           switch (selectedCategory) {
                case 'completed':
                    // Assuming 'completed' tasks might have a completion timestamp later,
                    // but for filtering by range, maybe use dueDate or startDate?
                    // Using dueDate primarily for completed filtering for now.
                    relevantDate = task.dueDate || task.startDate || null;
                    break;
                 case 'today':
                 case 'upcoming':
                 case 'scheduled':
                 case 'pending': // Apply date range to these based on due date first, then start date
                     relevantDate = task.dueDate || task.startDate || null;
                     break;
                 default:
                    relevantDate = task.dueDate || task.startDate || null; // Default fallback
           }


           if (dateFilter.startDate && dateFilter.endDate && relevantDate) {
               const taskStartOfDay = startOfDay(relevantDate);
               const filterStartOfDay = startOfDay(dateFilter.startDate);
               const filterEndOfDay = endOfDay(dateFilter.endDate);

               const isInRange = taskStartOfDay >= filterStartOfDay && taskStartOfDay <= filterEndOfDay;
               // if (!isInRange) console.log(` - Task ${task.id} filtered out by date: ${taskStartOfDay} not in [${filterStartOfDay}, ${filterEndOfDay}]`);
               if (!isInRange) return false;
           } else if (dateFilter.startDate && !dateFilter.endDate && relevantDate) {
               const taskStartOfDay = startOfDay(relevantDate);
               const filterStartOfDay = startOfDay(dateFilter.startDate);
               if (taskStartOfDay < filterStartOfDay) return false;
           } else if (!dateFilter.startDate && dateFilter.endDate && relevantDate) {
               const taskStartOfDay = startOfDay(relevantDate);
               const filterEndOfDay = endOfDay(dateFilter.endDate);
               if (taskStartOfDay > filterEndOfDay) return false;
           }

           // If passes all filters
           return true;
       });
   }, [tasks, categoryFilter, dateFilter, selectedCategory]);


  // --- Task Categorization and Sorting Logic (uses filteredTasks) ---
  const categorizedTasks = useMemo(() => {
    console.log("TaskPageProvider: Recalculating categories for filtered tasks:", filteredTasks.length); // Use filteredTasks
    const categories: Record<TaskCategory, TaskType[]> = {
      overdue: [], today: [], upcoming: [], scheduled: [], pending: [], hold: [], completed: [],
    };

    // Categorize only the filtered tasks
    filteredTasks.forEach(task => {
      const category = getTaskCategory(task);
      categories[category].push(task);
    });

     // Sort tasks within each category
     Object.values(categories).forEach(categoryTasks => {
        categoryTasks.sort((a, b) => {
            const priorityA = a.priority ?? Infinity;
            const priorityB = b.priority ?? Infinity;
            if (priorityA !== priorityB) return priorityA - priorityB;

            const dateAObj = a.dueDate;
            const dateBObj = b.dueDate;
            const dateA = dateAObj && dateAObj instanceof Date && !isNaN(dateAObj.getTime()) ? dateAObj.getTime() : Infinity;
            const dateB = dateBObj && dateBObj instanceof Date && !isNaN(dateBObj.getTime()) ? dateBObj.getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;

            const startDateAObj = a.startDate;
            const startDateBObj = b.startDate;
            const startDateA = startDateAObj && startDateAObj instanceof Date && !isNaN(startDateAObj.getTime()) ? startDateAObj.getTime() : Infinity;
            const startDateB = startDateBObj && startDateBObj instanceof Date && !isNaN(startDateBObj.getTime()) ? startDateBObj.getTime() : Infinity;
            if (startDateA !== startDateB) return startDateA - startDateB;

             return a.description.localeCompare(b.description);
        });
    });
    return categories;
  }, [filteredTasks]); // Depend on filteredTasks


  // --- Set Initial Selected Category (Revised) ---
   useEffect(() => {
     if (!initialCategorySet.current && tasks.length > 0) {
         console.log("TaskPageProvider: Determining initial selected category.");
         // Use the categorized tasks (which are based on filtered tasks initially)
         if (categorizedTasks.overdue.length > 0) {
             console.log(" - Setting initial category to 'overdue'");
             setSelectedCategory('overdue');
         } else if (categorizedTasks.today.length > 0) {
             console.log(" - Setting initial category to 'today'");
             setSelectedCategory('today');
         } else {
             const firstCategoryWithTasks = categoryOrder.find(cat => categorizedTasks[cat]?.length > 0);
             const initialCategory = firstCategoryWithTasks || 'pending';
             console.log(` - Setting initial category to '${initialCategory}'`);
             setSelectedCategory(initialCategory);
         }
         initialCategorySet.current = true;
     } else if (tasks.length === 0 && !initialCategorySet.current) {
          console.log(" - No tasks, setting initial category to 'pending'");
         setSelectedCategory('pending');
         initialCategorySet.current = true;
     } else {
          // console.log("TaskPageProvider: Skipping initial category setting."); // Less verbose
     }
   }, [categorizedTasks, tasks.length]);


  // --- Optimistic Update Functions ---
  const updateTaskOptimistic = useCallback((taskId: string, updates: Partial<TaskType>) => {
    setTasks(currentTasks => {
        const taskIndex = currentTasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            console.warn(`Optimistic update failed: Task ${taskId} not found.`);
            return currentTasks;
        }

        const originalTask = currentTasks[taskIndex];
        const originalFields: Partial<TaskType> = {};
        for (const key in updates) {
            if (Object.prototype.hasOwnProperty.call(updates, key)) {
                // تجنب الخطأ في TypeScript عن طريق استخدام التحويل المزدوج
                const taskKey = key as keyof TaskType;
                originalFields[taskKey] = originalTask[taskKey] as any;
            }
        }
        setPreviousTaskState(prev => ({ ...prev, [taskId]: { ...(prev[taskId] || {}), ...originalFields } }));

        const newTasks = [...currentTasks];
        newTasks[taskIndex] = { ...originalTask, ...updates };
        console.log(`Optimistic update applied for ${taskId}:`, updates);
        return newTasks;
    });
  }, []);

  const revertTaskOptimistic = useCallback((taskId: string, originalState: Partial<TaskType> | TaskType) => {
      setTasks(currentTasks => {
          const isFullTaskRevert = 'description' in originalState && 'status' in originalState;

          if (!currentTasks.some(t => t.id === taskId)) {
              if (isFullTaskRevert) {
                  console.log(`Reverting optimistic removal by adding back task ${taskId}`);
                  const newTasks = [...currentTasks, originalState as TaskType];
                  setPreviousTaskState(prev => {
                      const newState = { ...prev };
                      delete newState[taskId];
                      return newState;
                  });
                  return newTasks;
              } else {
                  console.warn(`Cannot revert removal for task ${taskId}: Incomplete original state provided.`);
                  return currentTasks;
              }
          }

          const taskIndex = currentTasks.findIndex(t => t.id === taskId);
          if (taskIndex === -1) {
              console.warn(`Cannot revert update: Task ${taskId} not found.`);
              return currentTasks;
          }

          const newTasks = [...currentTasks];
          newTasks[taskIndex] = { ...newTasks[taskIndex], ...originalState };
          console.log(`Reverting optimistic update for ${taskId} to:`, originalState);

          setPreviousTaskState(prev => {
              const newState = { ...prev };
              delete newState[taskId];
              return newState;
          });

          return newTasks;
      });
  }, []);

  const removeTaskOptimistic = useCallback((taskId: string) => {
      setTasks(currentTasks => {
           const taskToRemove = currentTasks.find(t => t.id === taskId);
           if (taskToRemove) {
                setPreviousTaskState(prev => ({ ...prev, [taskId]: taskToRemove }));
                console.log(`Optimistic remove applied for ${taskId}`);
                return currentTasks.filter(t => t.id !== taskId);
            } else {
                 console.warn(`Optimistic remove failed: Task ${taskId} not found.`);
                 return currentTasks;
            }
      });
  }, []);


    const moveTaskOptimistic = useCallback((taskId: string, targetCategory: TaskCategory) => {
        const newStatus: TaskStatus | null =
            targetCategory === 'completed' ? 'completed' :
            targetCategory === 'hold' ? 'hold' :
            (targetCategory === 'overdue' || targetCategory === 'today' || targetCategory === 'upcoming' || targetCategory === 'scheduled' || targetCategory === 'pending') ? 'pending' :
            null;

        if (newStatus !== null) {
            updateTaskOptimistic(taskId, { status: newStatus });
            console.log(`Optimistic move applied for ${taskId} to category ${targetCategory} (status: ${newStatus})`);
        } else {
             console.warn(`Cannot move task ${taskId} to category ${targetCategory}: Invalid target.`);
        }
    }, [updateTaskOptimistic]);


  // --- Context Value ---
  const value = useMemo(() => ({
    tasks, // Raw tasks
    filteredTasks, // Filtered tasks
    categorizedTasks, // Categorized (from filtered)
    selectedCategory,
    setSelectedCategory,
    categoryInfo,
    categoryOrder,
    dateFilter,
    setDateFilter: handleSetDateFilter, // Use the wrapper function
    categoryFilter,
    setCategoryFilter,
    okrFilter,
    setOkrFilter,
    updateTaskOptimistic,
    revertTaskOptimistic,
    removeTaskOptimistic,
    moveTaskOptimistic,
    setTasks, // Expose setTasks for direct manipulation (e.g., DND reordering)
  }), [
      tasks,
      filteredTasks, // Include filteredTasks
      categorizedTasks,
      selectedCategory,
      setSelectedCategory,
      dateFilter, // Include filter state
      // setDateFilter, // handleSetDateFilter replaces this
      categoryFilter,
      setCategoryFilter,
      okrFilter,
      setOkrFilter,
      updateTaskOptimistic,
      revertTaskOptimistic,
      removeTaskOptimistic,
      moveTaskOptimistic,
      setTasks
  ]);

  return (
    <TaskPageContext.Provider value={value}>
      {children}
    </TaskPageContext.Provider>
  );
};

export const useTaskPageContext = () => {
  const context = useContext(TaskPageContext);
  if (context === null) {
    throw new Error("useTaskPageContext must be used within a TaskPageProvider");
  }
  return context;
};
