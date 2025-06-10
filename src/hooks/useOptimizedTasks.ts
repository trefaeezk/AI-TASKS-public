import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TaskType } from '@/types/task';
import { useDebounce } from './useDebounce';

interface UseOptimizedTasksProps {
  organizationId: string;
  departmentId?: string;
  userId?: string;
  enabled?: boolean;
}

/**
 * Hook محسن لجلب المهام مع تقليل التحديثات المستمرة
 */
export function useOptimizedTasks({
  organizationId,
  departmentId,
  userId,
  enabled = true
}: UseOptimizedTasksProps) {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // استخدام ref لتجنب إعادة الاشتراك المستمرة
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastUpdateRef = useRef<number>(0);
  
  // debounce للمهام لتقليل التحديثات
  const debouncedTasks = useDebounce(tasks, 200);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setLoading(false);
      return;
    }

    // إلغاء الاشتراك السابق إذا وجد
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);
    setError(null);

    try {
      // بناء الاستعلام حسب المعايير
      let taskQuery = query(
        collection(db, 'tasks'),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );

      // إضافة فلتر القسم إذا وجد
      if (departmentId) {
        taskQuery = query(
          collection(db, 'tasks'),
          where('organizationId', '==', organizationId),
          where('departmentId', '==', departmentId),
          orderBy('createdAt', 'desc')
        );
      }

      // الاشتراك في التحديثات مع throttling
      const unsubscribe = onSnapshot(
        taskQuery,
        (snapshot) => {
          const now = Date.now();
          
          // تجنب التحديثات المتكررة جداً (أقل من 100ms)
          if (now - lastUpdateRef.current < 100) {
            return;
          }
          
          lastUpdateRef.current = now;

          const tasksData: TaskType[] = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            tasksData.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() || new Date(),
              updatedAt: data.updatedAt?.toDate?.() || new Date(),
              dueDate: data.dueDate?.toDate?.() || null,
            } as TaskType);
          });

          setTasks(tasksData);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching tasks:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      unsubscribeRef.current = unsubscribe;

    } catch (err) {
      console.error('Error setting up tasks listener:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }

    // تنظيف الاشتراك عند إلغاء المكون
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [organizationId, departmentId, enabled]);

  return {
    tasks: debouncedTasks,
    loading,
    error,
    refetch: () => {
      // إعادة تحميل البيانات
      setLoading(true);
      lastUpdateRef.current = 0;
    }
  };
}
