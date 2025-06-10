
// src/context/TaskPageContext.tsx
'use client';

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { TaskType, TaskStatus } from '@/types/task';
import { startOfDay, isPast, isToday, isWithinInterval, isFuture, differenceInDays, startOfMonth, endOfMonth, subMonths, endOfDay } from 'date-fns'; // Added date functions
import { AlertTriangle, CalendarDays, CalendarCheck2, ListTodo, CheckCircle2, X } from 'lucide-react';

// Define category types and order
export type TaskCategory = 'overdue' | 'today' | 'upcoming' | 'scheduled' | 'hold' | 'cancelled' | 'completed';
export const categoryOrder: TaskCategory[] = ['overdue', 'today', 'upcoming', 'scheduled', 'hold', 'cancelled', 'completed'];

// Define category display info
export const categoryInfo: Record<TaskCategory, { title: string; icon: React.ElementType; color: string }> = {
    overdue: { title: 'فائتة', icon: AlertTriangle, color: 'text-destructive' },
    today: { title: 'اليوم', icon: CalendarDays, color: 'text-blue-500' },
    upcoming: { title: 'قادمة', icon: CalendarCheck2, color: 'text-amber-500' },
    scheduled: { title: 'مجدولة', icon: ListTodo, color: 'text-purple-500' },
    hold: { title: 'معلقة', icon: ListTodo, color: 'text-gray-500' }, // Represents tasks without specific dates fitting other categories or on hold

    cancelled: { title: 'ملغية', icon: X, color: 'text-destructive' },
    completed: { title: 'مكتملة', icon: CheckCircle2, color: 'text-status-completed' },
};

// دالة تحديد فئة المهمة بناءً على الحالة والتاريخ
const getTaskCategory = (task: TaskType): TaskCategory => {
     const todayStart = startOfDay(new Date());

     // التأكد من صحة التواريخ وتحويلها إذا لزم الأمر
     let startDate: Date | null = null;
     let dueDate: Date | null = null;

     if (task.startDate) {
         if (task.startDate instanceof Date && !isNaN(task.startDate.getTime())) {
             startDate = startOfDay(task.startDate);
         } else if (typeof task.startDate === 'object' && 'toDate' in task.startDate) {
             // Firestore Timestamp
             startDate = startOfDay((task.startDate as any).toDate());
         }
     }

     if (task.dueDate) {
         if (task.dueDate instanceof Date && !isNaN(task.dueDate.getTime())) {
             dueDate = startOfDay(task.dueDate);
         } else if (typeof task.dueDate === 'object' && 'toDate' in task.dueDate) {
             // Firestore Timestamp
             dueDate = startOfDay((task.dueDate as any).toDate());
         }
     }

     // المهام المكتملة والملغية لها فئات ثابتة
     if (task.status === 'completed') return 'completed';
     if (task.status === 'cancelled') return 'cancelled';

     // المهام المعلقة تذهب دائماً إلى فئة "المعلقة" بغض النظر عن التاريخ
     if (task.status === 'hold') return 'hold';

     // للمهام النشطة، نصنف حسب التاريخ بغض النظر عن الحالة
     // فائتة: تاريخ الاستحقاق مضى ولم يعد اليوم
     if (dueDate && isPast(dueDate) && !isToday(dueDate)) return 'overdue';

     // اليوم: تستحق اليوم أو تبدأ اليوم أو اليوم ضمن فترة المهمة
     if (dueDate && isToday(dueDate)) return 'today';
     if (startDate && isToday(startDate)) return 'today';
     if (startDate && dueDate && isWithinInterval(todayStart, { start: startDate, end: dueDate })) return 'today';

     // قادمة: خلال 7 أيام
     if ((startDate && isFuture(startDate) && differenceInDays(startDate, todayStart) <= 7) ||
         (dueDate && isFuture(dueDate) && differenceInDays(dueDate, todayStart) <= 7)) return 'upcoming';

     // مجدولة: أكثر من 7 أيام
     if ((startDate && isFuture(startDate) && differenceInDays(startDate, todayStart) > 7) ||
         (dueDate && isFuture(dueDate) && differenceInDays(dueDate, todayStart) > 7)) return 'scheduled';

     // إذا لم يكن هناك تواريخ، نصنف المهمة كـ "اليوم" للمهام النشطة
     if (!startDate && !dueDate && (task.status === 'pending' || task.status === 'in-progress' || !task.status)) {
         return 'today';
     }

     // افتراضي: اليوم بدلاً من معلقة للمهام النشطة
     if (task.status === 'pending' || task.status === 'in-progress') {
         return 'today';
     }

     // افتراضي: معلقة إذا لم تناسب أي فئة أخرى
     return 'hold';
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

   // تعيين فلتر التاريخ الافتراضي عند تغيير الفئة
   useEffect(() => {
       if (hasUserSetDateFilter.current) {
           return; // لا نغير الفلتر إذا قام المستخدم بتعيينه يدوياً
       }

       // تعيين الفلتر الافتراضي: شهر ماضي وشهر لاحق من اليوم
       const now = new Date();
       const defaultStartDate = new Date();
       const defaultEndDate = new Date();
       defaultStartDate.setDate(now.getDate() - 30);
       defaultEndDate.setDate(now.getDate() + 30);

       setDateFilter({ startDate: defaultStartDate, endDate: defaultEndDate });

   }, [selectedCategory]);

   // إعادة تعيين علامة فلتر المستخدم عند تغيير الفئة
    useEffect(() => {
        hasUserSetDateFilter.current = false;
    }, [selectedCategory]);

  // تحديث المهام عند تغيير البيانات الأولية
  useEffect(() => {
    setTasks(initialTasks);
    if (initialTasks.length === 0) {
        initialCategorySet.current = false;
    }
  }, [initialTasks]);

   // تطبيق الفلاتر على المهام
   const filteredTasks = useMemo(() => {
       return tasks.filter(task => {
           // فلتر الفئة
           if (categoryFilter && task.taskCategoryName !== categoryFilter) {
               return false;
           }

           // فلتر OKR
           if (okrFilter && !task.linkedToOkr) {
               return false;
           }

           // فلتر التاريخ
           let relevantDate: Date | null = null;

           // لا نطبق فلتر التاريخ على المهام الفائتة والمعلقة والملغية والمكتملة
           // لتجنب خطر فقدان هذه المهام المهمة
           if (selectedCategory === 'overdue' || selectedCategory === 'hold' ||
               selectedCategory === 'cancelled' || selectedCategory === 'completed') {
               // تجاهل فلتر التاريخ لهذه المهام
               return true;
           }

           // تطبيق فلتر التاريخ فقط على الفئات النشطة
           switch (selectedCategory) {
                 case 'today':
                 case 'upcoming':
                 case 'scheduled':
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
      overdue: [], today: [], upcoming: [], scheduled: [], hold: [], cancelled: [], completed: [],
    };

    // Categorize only the filtered tasks
    filteredTasks.forEach(task => {
      const category = getTaskCategory(task);
      categories[category].push(task);
    });

     // Sort tasks within each category
     Object.values(categories).forEach(categoryTasks => {
        categoryTasks.sort((a, b) => {
            const priorityA = typeof a.priority === 'number' ? a.priority : Infinity;
            const priorityB = typeof b.priority === 'number' ? b.priority : Infinity;
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
             const initialCategory = firstCategoryWithTasks || 'hold';
             console.log(` - Setting initial category to '${initialCategory}'`);
             setSelectedCategory(initialCategory);
         }
         initialCategorySet.current = true;
     } else if (tasks.length === 0 && !initialCategorySet.current) {
          console.log(" - No tasks, setting initial category to 'hold'");
         setSelectedCategory('hold');
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
            targetCategory === 'cancelled' ? 'cancelled' :
            targetCategory === 'hold' ? 'hold' :
            (targetCategory === 'overdue' || targetCategory === 'today' || targetCategory === 'upcoming' || targetCategory === 'scheduled') ? 'pending' :
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
