'use client';

import { db } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

/**
 * إصلاح المهام التي تفتقر إلى userId
 * هذه دالة مساعدة لإصلاح البيانات الموجودة
 */
export async function fixMissingUserIds(): Promise<void> {
  try {
    console.log('بدء إصلاح المهام التي تفتقر إلى userId...');
    
    // جلب جميع المهام
    const tasksQuery = collection(db, 'tasks');
    const tasksSnapshot = await getDocs(tasksQuery);
    
    let fixedCount = 0;
    const batch: Promise<void>[] = [];
    
    tasksSnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      
      // التحقق من عدم وجود userId أو كونه undefined
      if (!taskData.userId) {
        // محاولة استخدام createdBy كبديل
        const fallbackUserId = taskData.createdBy || taskData.assignedToUserId || 'unknown';
        
        if (fallbackUserId && fallbackUserId !== 'unknown') {
          console.log(`إصلاح المهمة ${taskDoc.id}: إضافة userId = ${fallbackUserId}`);
          
          batch.push(
            updateDoc(doc(db, 'tasks', taskDoc.id), {
              userId: fallbackUserId
            })
          );
          fixedCount++;
        } else {
          console.warn(`لا يمكن إصلاح المهمة ${taskDoc.id}: لا توجد بيانات مستخدم صالحة`);
        }
      }
    });
    
    // تنفيذ جميع التحديثات
    if (batch.length > 0) {
      await Promise.all(batch);
      console.log(`تم إصلاح ${fixedCount} مهمة بنجاح`);
    } else {
      console.log('لا توجد مهام تحتاج إلى إصلاح');
    }
    
  } catch (error) {
    console.error('خطأ في إصلاح المهام:', error);
    throw error;
  }
}

/**
 * التحقق من وجود مهام تفتقر إلى userId
 */
export async function checkMissingUserIds(): Promise<number> {
  try {
    const tasksQuery = collection(db, 'tasks');
    const tasksSnapshot = await getDocs(tasksQuery);
    
    let missingCount = 0;
    
    tasksSnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      if (!taskData.userId) {
        missingCount++;
      }
    });
    
    return missingCount;
  } catch (error) {
    console.error('خطأ في فحص المهام:', error);
    return 0;
  }
}
