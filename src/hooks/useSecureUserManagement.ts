/**
 * Hook آمن لإدارة المستخدمين باستخدام Firebase Functions فقط
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { CreateUserInput } from '@/types/user';

interface UseSecureUserManagementReturn {
  createUser: (userData: CreateUserInput) => Promise<{ success: boolean; uid?: string; error?: string }>;
  updateUserRole: (userId: string, role: string) => Promise<{ success: boolean; error?: string }>;
  updateUserPermissions: (userId: string, permissions: string[]) => Promise<{ success: boolean; error?: string }>;
  toggleUserDisabled: (userId: string, disabled: boolean) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

export function useSecureUserManagement(): UseSecureUserManagementReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // التأكد من أن المستخدم مصادق عليه
  const ensureAuthenticated = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('يجب تسجيل الدخول أولاً');
    }

    // تحديث token للتأكد من صحة الصلاحيات
    await currentUser.getIdToken(true);
    return currentUser;
  }, []);

  // إنشاء مستخدم جديد بطريقة آمنة
  const createUser = useCallback(async (userData: CreateUserInput) => {
    setIsLoading(true);
    try {
      await ensureAuthenticated();

      // التحقق من وجود functions
      if (!functions) {
        throw new Error('Firebase Functions غير متاح في هذه البيئة');
      }

      console.log('🚀 Creating user with data:', userData);
      console.log('🚀 Functions instance:', !!functions);

      // استخدام createUserHttp مؤقتاً لحل مشكلة CORS
      const createUserFn = httpsCallable<CreateUserInput, { uid?: string; error?: string }>(functions, 'createUserHttp');

      console.log('🚀 Calling createUser function...');
      const result = await createUserFn(userData);
      console.log('🚀 Function result:', result);

      if (result.data?.error) {
        console.error('🚨 Function returned error:', result.data.error);

        // معالجة أخطاء محددة
        if (result.data.error.includes('already-exists') || result.data.error.includes('البريد الإلكتروني مستخدم بالفعل')) {
          toast({
            title: 'فشل إنشاء المستخدم',
            description: 'البريد الإلكتروني مستخدم بالفعل.',
            variant: 'destructive',
          });
        } else if (result.data.error.includes('permission-denied')) {
          toast({
            title: 'ليس لديك صلاحية',
            description: 'ليس لديك صلاحية لإنشاء هذا النوع من المستخدمين.',
            variant: 'destructive',
          });
        } else if (result.data.error.includes('unauthenticated')) {
          toast({
            title: 'خطأ في المصادقة',
            description: 'يجب تسجيل الدخول أولاً.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'فشل إنشاء المستخدم',
            description: result.data.error,
            variant: 'destructive',
          });
        }
        return { success: false, error: result.data.error };
      }

      if (result.data?.uid) {
        console.log('✅ User created successfully with UID:', result.data.uid);
        toast({
          title: 'تم إنشاء المستخدم بنجاح',
          description: `تم إنشاء المستخدم ${userData.email} بنجاح.`,
        });
        return { success: true, uid: result.data.uid };
      }

      throw new Error('لم يتم إرجاع UID بعد إنشاء المستخدم');

    } catch (error: any) {
      console.error('🚨 Error creating user:', error);

      let errorMessage = 'حدث خطأ أثناء إنشاء المستخدم';

      // معالجة أنواع مختلفة من الأخطاء
      if (error.code === 'functions/unauthenticated') {
        errorMessage = 'يجب تسجيل الدخول أولاً';
      } else if (error.code === 'functions/permission-denied') {
        errorMessage = 'ليس لديك صلاحية لتنفيذ هذا الإجراء';
      } else if (error.code === 'functions/internal') {
        errorMessage = 'خطأ داخلي في الخادم';
      } else if (error.code === 'functions/unavailable') {
        errorMessage = 'الخدمة غير متاحة حالياً، يرجى المحاولة لاحقاً';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'فشل إنشاء المستخدم',
        description: errorMessage,
        variant: 'destructive',
      });

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [ensureAuthenticated, toast]);

  // تحديث دور المستخدم بطريقة آمنة
  const updateUserRole = useCallback(async (userId: string, role: string) => {
    setIsLoading(true);
    try {
      await ensureAuthenticated();

      // التحقق من وجود functions
      if (!functions) {
        throw new Error('Firebase Functions غير متاح في هذه البيئة');
      }

      console.log(`🚀 Updating role for user ${userId} to ${role}`);
      const updateRoleFn = httpsCallable<{ uid: string; role: string }, { result?: string; error?: string }>(functions, 'updateUserRole');
      const result = await updateRoleFn({ uid: userId, role });

      if (result.data?.error) {
        console.error('🚨 Function returned error:', result.data.error);
        toast({
          title: 'فشل تحديث الدور',
          description: result.data.error,
          variant: 'destructive',
        });
        return { success: false, error: result.data.error };
      }

      console.log('✅ Role updated successfully');
      toast({
        title: 'تم تحديث الدور بنجاح',
        description: `تم تحديث دور المستخدم إلى ${role}.`,
      });

      return { success: true };

    } catch (error: any) {
      console.error('🚨 Error updating user role:', error);

      let errorMessage = 'حدث خطأ أثناء تحديث الدور';

      if (error.code === 'functions/unauthenticated') {
        errorMessage = 'يجب تسجيل الدخول أولاً';
      } else if (error.code === 'functions/permission-denied') {
        errorMessage = 'ليس لديك صلاحية لتحديث أدوار المستخدمين';
      } else if (error.code === 'functions/internal') {
        errorMessage = 'خطأ داخلي في الخادم';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'فشل تحديث الدور',
        description: errorMessage,
        variant: 'destructive',
      });

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [ensureAuthenticated, toast]);

  // تحديث صلاحيات المستخدم بطريقة آمنة
  const updateUserPermissions = useCallback(async (userId: string, permissions: string[]) => {
    setIsLoading(true);
    try {
      await ensureAuthenticated();

      console.log(`Updating permissions for user ${userId}:`, permissions);
      const updatePermissionsFn = httpsCallable<{ uid: string; permissions: string[] }, { result?: string; error?: string }>(functions, 'updateUserPermissions');
      const result = await updatePermissionsFn({ uid: userId, permissions });

      if (result.data?.error) {
        toast({
          title: 'فشل تحديث الصلاحيات',
          description: result.data.error,
          variant: 'destructive',
        });
        return { success: false, error: result.data.error };
      }

      toast({
        title: 'تم تحديث الصلاحيات بنجاح',
        description: 'تم تحديث صلاحيات المستخدم بنجاح.',
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error updating user permissions:', error);
      const errorMessage = error.message || 'حدث خطأ أثناء تحديث الصلاحيات';

      toast({
        title: 'فشل تحديث الصلاحيات',
        description: errorMessage,
        variant: 'destructive',
      });

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [ensureAuthenticated, toast]);

  // تفعيل/إلغاء تفعيل المستخدم بطريقة آمنة
  const toggleUserDisabled = useCallback(async (userId: string, disabled: boolean) => {
    setIsLoading(true);
    try {
      await ensureAuthenticated();

      console.log(`${disabled ? 'Disabling' : 'Enabling'} user ${userId}`);
      const toggleDisabledFn = httpsCallable<{ uid: string; disabled: boolean }, { result?: string; error?: string }>(functions, 'toggleUserDisabled');
      const result = await toggleDisabledFn({ uid: userId, disabled });

      if (result.data?.error) {
        toast({
          title: `فشل ${disabled ? 'إلغاء تفعيل' : 'تفعيل'} المستخدم`,
          description: result.data.error,
          variant: 'destructive',
        });
        return { success: false, error: result.data.error };
      }

      toast({
        title: `تم ${disabled ? 'إلغاء تفعيل' : 'تفعيل'} المستخدم بنجاح`,
        description: `تم ${disabled ? 'إلغاء تفعيل' : 'تفعيل'} المستخدم بنجاح.`,
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error toggling user disabled status:', error);
      const errorMessage = error.message || `حدث خطأ أثناء ${disabled ? 'إلغاء تفعيل' : 'تفعيل'} المستخدم`;

      toast({
        title: `فشل ${disabled ? 'إلغاء تفعيل' : 'تفعيل'} المستخدم`,
        description: errorMessage,
        variant: 'destructive',
      });

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [ensureAuthenticated, toast]);

  return {
    createUser,
    updateUserRole,
    updateUserPermissions,
    toggleUserDisabled,
    isLoading
  };
}
