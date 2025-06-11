import { PriorityLevel } from '@/types/task';

/**
 * تحويل Priority إلى string للاستخدام في UI
 */
export const normalizePriority = (priority: PriorityLevel | undefined): string => {
  if (priority === undefined || priority === null) return 'medium';
  
  if (typeof priority === 'number') {
    switch (priority) {
      case 1: return 'high';
      case 2: return 'high';
      case 3: return 'medium';
      case 4: return 'low';
      case 5: return 'low';
      default: return 'medium';
    }
  }
  
  return priority.toString();
};

/**
 * الحصول على لون Badge للأولوية
 */
export const getPriorityColor = (priority: PriorityLevel | undefined): 'destructive' | 'default' | 'secondary' => {
  const normalizedPriority = normalizePriority(priority);
  switch (normalizedPriority) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'default';
  }
};

/**
 * الحصول على النص العربي للأولوية
 */
export const getPriorityText = (priority: PriorityLevel | undefined): string => {
  const normalizedPriority = normalizePriority(priority);
  switch (normalizedPriority) {
    case 'high': return 'عالية';
    case 'medium': return 'متوسطة';
    case 'low': return 'منخفضة';
    default: return normalizedPriority;
  }
};
