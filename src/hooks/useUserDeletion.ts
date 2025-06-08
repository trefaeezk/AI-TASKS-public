/**
 * Hook لحذف المستخدمين بشكل شامل
 * يدعم حذف المستخدمين الأفراد والتنظيميين مع جميع بياناتهم المرتبطة
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * واجهة طلب حذف المستخدم
 */
interface DeleteUserRequest {
  userId: string;
  forceDelete?: boolean; // حذف قسري حتى لو كان المستخدم مالك مؤسسة
}

/**
 * واجهة نتيجة عملية الحذف
 */
interface DeleteUserResult {
  success: boolean;
  deletedData: {
    userAccount: boolean;
    userData: boolean;
    individualData: boolean;
    organizationMemberships: number;
    tasks: number;
    meetings: number;
    objectives: number;
    keyResults: number;
    reports: number;
  };
  warnings?: string[];
  error?: string;
}

/**
 * Hook لحذف المستخدمين
 */
export const useUserDeletion = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<string>('');
  const { toast } = useToast();

  /**
   * حذف المستخدم بشكل شامل
   */
  const deleteUserCompletely = useCallback(async (
    userId: string, 
    forceDelete: boolean = false
  ): Promise<DeleteUserResult | null> => {
    if (!userId) {
      toast({
        title: 'خطأ في البيانات',
        description: 'معرف المستخدم مطلوب.',
        variant: 'destructive',
      });
      return null;
    }

    setIsDeleting(true);
    setDeleteProgress('بدء عملية الحذف...');

    try {
      const deleteUserFn = httpsCallable<DeleteUserRequest, DeleteUserResult>(
        functions, 
        'deleteUserCompletely'
      );

      setDeleteProgress('حذف بيانات المستخدم...');
      
      const result = await deleteUserFn({
        userId,
        forceDelete
      });

      if (result.data?.success) {
        const { deletedData, warnings } = result.data;
        
        // إنشاء رسالة تفصيلية عن البيانات المحذوفة
        const deletionSummary = [];
        
        if (deletedData.userAccount) {
          deletionSummary.push('حساب المصادقة');
        }
        
        if (deletedData.userData) {
          deletionSummary.push('البيانات الأساسية');
        }
        
        if (deletedData.individualData) {
          deletionSummary.push('بيانات المستخدم الفردي');
        }
        
        if (deletedData.organizationMemberships > 0) {
          deletionSummary.push(`${deletedData.organizationMemberships} عضوية مؤسسة`);
        }
        
        if (deletedData.tasks > 0) {
          deletionSummary.push(`${deletedData.tasks} مهمة`);
        }
        
        if (deletedData.meetings > 0) {
          deletionSummary.push(`${deletedData.meetings} اجتماع`);
        }
        
        if (deletedData.objectives > 0) {
          deletionSummary.push(`${deletedData.objectives} هدف`);
        }
        
        if (deletedData.keyResults > 0) {
          deletionSummary.push(`${deletedData.keyResults} نتيجة رئيسية`);
        }
        
        if (deletedData.reports > 0) {
          deletionSummary.push(`${deletedData.reports} تقرير`);
        }

        toast({
          title: 'تم حذف المستخدم بنجاح',
          description: `تم حذف: ${deletionSummary.join(', ')}`,
        });

        // عرض التحذيرات إن وجدت
        if (warnings && warnings.length > 0) {
          setTimeout(() => {
            toast({
              title: 'تحذيرات',
              description: warnings.join('\n'),
              variant: 'default',
            });
          }, 2000);
        }

        setDeleteProgress('تم الحذف بنجاح');
        return result.data;
      } else {
        throw new Error(result.data?.error || 'فشل في حذف المستخدم');
      }

    } catch (error: any) {
      console.error('Error deleting user:', error);
      
      let errorMessage = 'حدث خطأ أثناء حذف المستخدم';
      
      if (error.code === 'functions/permission-denied') {
        errorMessage = 'ليس لديك صلاحية لحذف هذا المستخدم';
      } else if (error.code === 'functions/failed-precondition') {
        errorMessage = error.message || 'لا يمكن حذف هذا المستخدم في الوقت الحالي';
      } else if (error.code === 'functions/unauthenticated') {
        errorMessage = 'يجب تسجيل الدخول أولاً';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'فشل في حذف المستخدم',
        description: errorMessage,
        variant: 'destructive',
      });

      setDeleteProgress('فشل في الحذف');
      return null;

    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteProgress(''), 3000);
    }
  }, [toast]);

  /**
   * حذف بيانات المستخدم الفردي فقط (بدون حذف الحساب)
   */
  const deleteIndividualUserData = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId) {
      toast({
        title: 'خطأ في البيانات',
        description: 'معرف المستخدم مطلوب.',
        variant: 'destructive',
      });
      return false;
    }

    setIsDeleting(true);
    setDeleteProgress('حذف بيانات المستخدم الفردي...');

    try {
      // استخدام الدالة العادية (تم إصلاح التصدير في index.ts)
      const deleteIndividualDataFn = httpsCallable(
        functions,
        'deleteIndividualUserData'
      );

      const result = await deleteIndividualDataFn({ userId });

      if (result.data?.success) {
        toast({
          title: 'تم حذف البيانات بنجاح',
          description: result.data.message || 'تم حذف بيانات المستخدم الفردي',
        });

        setDeleteProgress('تم الحذف بنجاح');
        return true;
      } else {
        throw new Error('فشل في حذف بيانات المستخدم الفردي');
      }

    } catch (error: any) {
      console.error('Error deleting individual user data:', error);
      
      let errorMessage = 'حدث خطأ أثناء حذف بيانات المستخدم';
      
      if (error.code === 'functions/permission-denied') {
        errorMessage = 'ليس لديك صلاحية لحذف بيانات هذا المستخدم';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'فشل في حذف البيانات',
        description: errorMessage,
        variant: 'destructive',
      });

      setDeleteProgress('فشل في الحذف');
      return false;

    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteProgress(''), 3000);
    }
  }, [toast]);

  /**
   * تأكيد حذف المستخدم مع عرض تحذير
   */
  const confirmUserDeletion = useCallback((
    userName: string,
    userEmail: string,
    onConfirm: () => void
  ) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المستخدم "${userName}" (${userEmail})؟\n\n` +
      'سيتم حذف:\n' +
      '• حساب المستخدم من Firebase Auth\n' +
      '• جميع بيانات المستخدم من قاعدة البيانات\n' +
      '• جميع المهام والاجتماعات والتقارير المرتبطة\n' +
      '• عضوية المستخدم في المؤسسات\n\n' +
      '⚠️ هذا الإجراء لا يمكن التراجع عنه!'
    );

    if (confirmed) {
      onConfirm();
    }
  }, []);

  return {
    isDeleting,
    deleteProgress,
    deleteUserCompletely,
    deleteIndividualUserData,
    confirmUserDeletion
  };
};
