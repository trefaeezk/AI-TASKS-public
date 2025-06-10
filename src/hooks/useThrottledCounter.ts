import { useState, useEffect, useRef } from 'react';

/**
 * Hook لتأخير تحديث العدادات لتجنب الاهتزاز
 */
export function useThrottledCounter(value: number, delay: number = 500) {
  const [throttledValue, setThrottledValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    
    // إذا كان التحديث الأخير قريب جداً، أخر التحديث
    if (now - lastUpdateRef.current < delay) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value);
        lastUpdateRef.current = Date.now();
      }, delay);
    } else {
      // إذا مر وقت كافي، حدث فوراً
      setThrottledValue(value);
      lastUpdateRef.current = now;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return throttledValue;
}

/**
 * Hook لتجميع التحديثات المتعددة في تحديث واحد
 */
export function useBatchedUpdates<T>(
  values: T[],
  batchDelay: number = 300
): T[] {
  const [batchedValues, setBatchedValues] = useState<T[]>(values);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setBatchedValues(values);
    }, batchDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [values, batchDelay]);

  return batchedValues;
}
