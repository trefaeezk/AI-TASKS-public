import { useEffect, useState } from 'react';

/**
 * Hook لتأخير التحديثات لتجنب الاهتزاز
 * @param value القيمة المراد تأخيرها
 * @param delay مدة التأخير بالميلي ثانية
 * @returns القيمة المؤخرة
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook لتأخير استدعاء الدوال
 * @param callback الدالة المراد تأخيرها
 * @param delay مدة التأخير بالميلي ثانية
 * @returns الدالة المؤخرة
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const [debouncedCallback, setDebouncedCallback] = useState<T | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCallback(() => callback);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [callback, delay]);

  return (debouncedCallback || callback) as T;
}
