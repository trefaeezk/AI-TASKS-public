// src/utils/firestoreListenerManager.ts

/**
 * مدير Firestore Listeners لضمان إلغاء جميع الاشتراكات بشكل صحيح
 * يساعد في تجنب أخطاء "Missing or insufficient permissions" عند تسجيل الخروج
 */

type UnsubscribeFunction = () => void;

class FirestoreListenerManager {
  private listeners: Map<string, UnsubscribeFunction> = new Map();

  /**
   * إضافة listener جديد
   * @param key مفتاح فريد للـ listener
   * @param unsubscribe دالة إلغاء الاشتراك
   */
  addListener(key: string, unsubscribe: UnsubscribeFunction): void {
    // إلغاء listener السابق إذا كان موجوداً
    this.removeListener(key);
    
    this.listeners.set(key, unsubscribe);
    console.log(`[FirestoreListenerManager] Added listener: ${key}`);
  }

  /**
   * إزالة listener محدد
   * @param key مفتاح الـ listener
   */
  removeListener(key: string): void {
    const unsubscribe = this.listeners.get(key);
    if (unsubscribe) {
      try {
        unsubscribe();
        console.log(`[FirestoreListenerManager] Removed listener: ${key}`);
      } catch (error) {
        console.error(`[FirestoreListenerManager] Error removing listener ${key}:`, error);
      }
      this.listeners.delete(key);
    }
  }

  /**
   * إزالة جميع listeners
   */
  removeAllListeners(): void {
    console.log(`[FirestoreListenerManager] Removing all ${this.listeners.size} listeners`);
    
    for (const [key, unsubscribe] of this.listeners.entries()) {
      try {
        unsubscribe();
        console.log(`[FirestoreListenerManager] Removed listener: ${key}`);
      } catch (error) {
        console.error(`[FirestoreListenerManager] Error removing listener ${key}:`, error);
      }
    }
    
    this.listeners.clear();
  }

  /**
   * الحصول على عدد listeners النشطة
   */
  getActiveListenersCount(): number {
    return this.listeners.size;
  }

  /**
   * الحصول على قائمة بمفاتيح listeners النشطة
   */
  getActiveListenerKeys(): string[] {
    return Array.from(this.listeners.keys());
  }
}

// إنشاء instance مشترك
export const firestoreListenerManager = new FirestoreListenerManager();

/**
 * Hook لإدارة Firestore listener في React component
 * @param key مفتاح فريد للـ listener
 * @param unsubscribe دالة إلغاء الاشتراك
 */
export function useFirestoreListener(key: string, unsubscribe?: UnsubscribeFunction) {
  if (unsubscribe) {
    firestoreListenerManager.addListener(key, unsubscribe);
  }

  // إرجاع دالة لإزالة listener
  return () => firestoreListenerManager.removeListener(key);
}

/**
 * معالج أخطاء Firestore موحد
 * @param error الخطأ
 * @param context السياق (اسم المكون أو الوظيفة)
 * @returns true إذا كان الخطأ متعلق بالصلاحيات بعد تسجيل الخروج
 */
export function handleFirestoreError(error: any, context: string): boolean {
  console.error(`[${context}] Firestore error:`, error);

  // التحقق من أخطاء الصلاحيات
  if (error.code === 'permission-denied' || 
      error.message?.includes('Missing or insufficient permissions') ||
      error.code === 'unauthenticated') {
    console.warn(`[${context}] Permission/authentication error, likely due to logout.`);
    return true; // إشارة أن الخطأ متعلق بالصلاحيات
  }

  return false; // خطأ عادي
}

/**
 * إنشاء Firestore listener مع معالجة أخطاء محسنة
 * @param key مفتاح فريد للـ listener
 * @param listenerFunction دالة إنشاء الـ listener
 * @param context السياق
 * @returns دالة إلغاء الاشتراك
 */
export function createManagedFirestoreListener(
  key: string,
  listenerFunction: () => UnsubscribeFunction,
  context: string
): UnsubscribeFunction {
  try {
    const unsubscribe = listenerFunction();
    firestoreListenerManager.addListener(key, unsubscribe);
    
    return () => firestoreListenerManager.removeListener(key);
  } catch (error) {
    console.error(`[${context}] Error creating Firestore listener:`, error);
    return () => {}; // إرجاع دالة فارغة
  }
}
