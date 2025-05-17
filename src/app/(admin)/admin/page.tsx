'use client'; // Make this a client component

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from '../../../../firebaseConfig';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auth } from '@/config/firebase';
import { ExtendedUser } from '@/types/user';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, ShieldCheck, ShieldOff, UserCog, FileText,
  AlertTriangle, PlusCircle, UserCog2, Settings, Eye,
  Building, X, Bug
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreateUserInput, ManagedUser } from '@/types/user';
import { PermissionKey, UserRole } from '@/types/roles';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { UserDetailsDialog } from '@/components/admin/UserDetailsDialog';


// Initialize Firebase App if it hasn't been already
let app;
try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    console.log("[AdminPage Client] Firebase App initialized or retrieved.");
} catch (error) {
    console.error("[AdminPage Client] Firebase initialization failed:", error);
    // Handle the error appropriately, maybe show a global error message
}

// Initialize Firebase Functions with explicit region - Ensure this happens only once
let functionsInstance: ReturnType<typeof getFunctions> | null = null;
if (app && !functionsInstance) { // Check if already initialized
    try {
        // Explicitly set the region 'us-central1'
        functionsInstance = getFunctions(app, "us-central1");
         console.log("[AdminPage Client] Firebase Functions initialized for region us-central1.");
    } catch(error) {
        console.error("[AdminPage Client] Failed to initialize Firebase Functions:", error);
         // Handle initialization error
    }
}


export default function AdminDashboardPage() {
  const { user, refreshUserData } = useAuth(); // Get current authenticated user
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, Record<string, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isUserDetailsDialogOpen, setIsUserDetailsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);


  // دالة لإعادة تحميل المستخدمين
  const fetchUsers = useCallback(() => {
    console.log("[AdminPage Client] Manually fetching users");
    setLoading(true);
    setError(null);

    // إعادة تعيين المستمع سيتم في useEffect
    return () => {};
  }, []);

  // --- استخدام مستمع Firestore بدلاً من Cloud Function ---
  const setupUsersListener = useCallback(() => {
    if (!user) {
      console.log("[AdminPage Client] setupUsersListener skipped: user not authenticated.");
      setUsers([]);
      setLoading(false);
      return () => {}; // إرجاع دالة فارغة
    }

    console.log("[AdminPage Client] Setting up Firestore users listener");
    setError(null);
    setLoading(true);

    try {
      // إنشاء استعلام لمجموعة المستخدمين
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef);

      // إنشاء مستمع للتغييرات في مجموعة المستخدمين
      const unsubscribe = onSnapshot(
        usersQuery,
        async (snapshot) => {
          try {
            // تحويل البيانات إلى مصفوفة من كائنات المستخدمين
            const fetchedUsers: ManagedUser[] = [];

            // الحصول على قائمة المستخدمين من Firebase Authentication
            const idToken = await user.getIdToken();
            const response = await fetch('https://us-central1-tasks-intelligence.cloudfunctions.net/listUsersHttp', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${idToken}`
              }
            });

            if (!response.ok) {
              throw new Error('فشل في جلب قائمة المستخدمين من Firebase Authentication');
            }

            const authUsers = await response.json();
            const authUserIds = new Set(authUsers.users.map((u: any) => u.uid));

            // تصفية المستخدمين الذين تم حذفهم من Firebase Authentication
            for (const doc of snapshot.docs) {
              const data = doc.data();

              // التحقق من وجود المستخدم في Firebase Authentication
              if (authUserIds.has(doc.id)) {
                fetchedUsers.push({
                  uid: doc.id,
                  email: data.email || `مستخدم (${doc.id.substring(0, 6)}...)`,
                  role: (data.role as UserRole) || 'user',
                  isAdmin: data.role === 'admin' || false,
                  name: data.name || data.displayName || 'غير متوفر',
                  disabled: data.disabled || false,
                  customPermissions: data.customPermissions || [],
                  createdAt: data.createdAt,
                  lastLogin: data.lastLogin
                } as ManagedUser);
              } else {
                console.log(`[AdminPage Client] User ${doc.id} exists in Firestore but not in Authentication. Skipping.`);
              }
            }

            setUsers(fetchedUsers);
            console.log(`[AdminPage Client] Successfully fetched ${fetchedUsers.length} users from Firestore.`);
            setLoading(false);
            setError(null);
          } catch (error) {
            console.error("[AdminPage Client] Error processing users:", error);
            const errorMessage = `فشل في معالجة بيانات المستخدمين: ${(error as Error).message || 'سبب غير معروف'}.`;
            setError(errorMessage);
            toast({
              title: 'فشل معالجة المستخدمين',
              description: errorMessage,
              variant: 'destructive',
            });
            setUsers([]);
            setLoading(false);
          }
        },
        (err) => {
          console.error("[AdminPage Client] Error in Firestore users listener:", err);
          const errorMessage = `فشل في جلب بيانات المستخدمين: ${err.message || 'سبب غير معروف'}.`;
          setError(errorMessage);
          toast({
            title: 'فشل تحميل المستخدمين',
            description: errorMessage,
            variant: 'destructive',
          });
          setUsers([]);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (err: any) {
      console.error("[AdminPage Client] Error setting up Firestore listener:", err);
      const errorMessage = `فشل في إعداد مستمع Firestore: ${err.message || 'سبب غير معروف'}.`;
      setError(errorMessage);
      toast({
        title: 'فشل تحميل المستخدمين',
        description: errorMessage,
        variant: 'destructive',
      });
      setUsers([]);
      setLoading(false);
      return () => {}; // إرجاع دالة فارغة
    }
  }, [user, toast]);

  useEffect(() => {
    console.log("[AdminPage Client] useEffect triggered, setting up users listener.");

    // إعداد مستمع Firestore
    const unsubscribe = setupUsersListener();

    // تنظيف المستمع عند تفكيك المكون
    return () => {
      console.log("[AdminPage Client] useEffect cleanup: unsubscribing from Firestore listener.");
      unsubscribe();
    };
  }, [setupUsersListener]); // الاعتماد فقط على دالة setupUsersListener المستقرة

  // إضافة useEffect لتحديث fetchUsers
  useEffect(() => {
    // تحديث دالة fetchUsers لاستخدام setupUsersListener
    fetchUsers();
  }, [fetchUsers]);

  // Helper to update loading state
  const setActionLoadingState = (userId: string, actionType: 'admin' | 'disable' | 'create' | 'role' | 'permissions', isLoading: boolean) => {
    setActionLoading(prev => ({
      ...prev,
      [userId === 'createUser' ? 'createUserAction' : userId]: {
        ...(prev[userId === 'createUser' ? 'createUserAction' : userId] || {}),
        [actionType]: isLoading,
      }
    }));
  };

  // Open user details dialog
  const handleOpenUserDetails = (user: ManagedUser) => {
    setSelectedUser(user);
    setIsUserDetailsDialogOpen(true);
  };

  // --- Update User Role using HTTP Function ---
  const updateUserRole = async (userId: string, role: UserRole) => {
    if (!user) {
      console.error("[AdminPage Client] updateUserRole skipped: user not authenticated.");
      toast({ title: 'خطأ', description: "يجب تسجيل الدخول أولاً.", variant: 'destructive' });
      return;
    }

    setActionLoadingState(userId, 'role', true);

    // إذا كان المستخدم الحالي هو نفسه الذي يتم تحديث دوره، نحتاج لإعادة تحميل معلوماته
    const isCurrentUser = userId === user.uid;

    try {
      // Get the current user's ID token for authentication
      const idToken = await user.getIdToken();

      // Make a direct HTTP request to the function URL
      const response = await fetch('https://us-central1-tasks-intelligence.cloudfunctions.net/updateUserRoleHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          uid: userId,
          role: role
        })
      });

      // Parse the response
      const result = await response.json();

      // Check for errors in the response
      if (!response.ok) {
        throw new Error(result.error || 'حدث خطأ أثناء تحديث دور المستخدم.');
      }

      toast({
        title: 'تم تحديث دور المستخدم',
        description: `تم تغيير دور المستخدم إلى ${role}.`,
      });

      // إذا كان المستخدم الحالي هو نفسه الذي تم تحديث دوره، نقوم بإعادة تحميل معلوماته
      if (isCurrentUser) {
        console.log("[AdminPage Client] Current user role updated, refreshing user data");
        await refreshUserData();
      }

      // لا نحتاج لتحديث القائمة يدويًا لأن المستمع سيقوم بذلك تلقائيًا

    } catch (err: any) {
      console.error("[AdminPage Client] Error updating user role:", err);
      toast({
        title: 'فشل تحديث دور المستخدم',
        description: err.message || 'حدث خطأ أثناء تحديث دور المستخدم.',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingState(userId, 'role', false);
    }
  };

  // --- Update User Permissions using HTTP Function ---
  const updateUserPermissions = async (userId: string, permissions: PermissionKey[]) => {
    if (!user) {
      console.error("[AdminPage Client] updateUserPermissions skipped: user not authenticated.");
      toast({ title: 'خطأ', description: "يجب تسجيل الدخول أولاً.", variant: 'destructive' });
      return;
    }

    setActionLoadingState(userId, 'permissions', true);

    try {
      // Get the current user's ID token for authentication
      const idToken = await user.getIdToken();

      // Make a direct HTTP request to the function URL
      const response = await fetch('https://us-central1-tasks-intelligence.cloudfunctions.net/updateUserPermissionsHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          uid: userId,
          permissions: permissions
        })
      });

      // Parse the response
      const result = await response.json();

      // Check for errors in the response
      if (!response.ok) {
        throw new Error(result.error || 'حدث خطأ أثناء تحديث صلاحيات المستخدم.');
      }

      toast({
        title: 'تم تحديث صلاحيات المستخدم',
        description: 'تم تحديث صلاحيات المستخدم بنجاح.',
      });

      // لا نحتاج لتحديث القائمة يدويًا لأن المستمع سيقوم بذلك تلقائيًا

    } catch (err: any) {
      console.error("[AdminPage Client] Error updating user permissions:", err);
      toast({
        title: 'فشل تحديث صلاحيات المستخدم',
        description: err.message || 'حدث خطأ أثناء تحديث صلاحيات المستخدم.',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingState(userId, 'permissions', false);
    }
  };

  // --- Toggle Admin Status using HTTP Function with CORS support ---
  const toggleAdminStatus = async (userId: string, currentIsAdmin: boolean) => {
     if (!user) {
         console.error("[AdminPage Client] toggleAdminStatus skipped: user not authenticated.");
        toast({ title: 'خطأ', description: "يجب تسجيل الدخول أولاً.", variant: 'destructive' });
        return;
    }
    if (userId === user?.uid && currentIsAdmin) {
      toast({ title: 'لا يمكن إزالة صلاحية المسؤول عن نفسك', variant: 'destructive' });
      return;
    }

    setActionLoadingState(userId, 'admin', true);
    // Use the HTTP version of the function with CORS support
    const functionUrl = 'https://us-central1-tasks-intelligence.cloudfunctions.net/setAdminRoleHttp';
    console.log(`[AdminPage Client] Calling HTTP Function at ${functionUrl} for user ${userId} to ${!currentIsAdmin}...`);

    try {
        // Get the current user's ID token for authentication
        const idToken = await user.getIdToken();

        // Make a direct HTTP request to the function URL
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                uid: userId,
                isAdmin: !currentIsAdmin
            })
        });

        // Parse the response
        const result = await response.json();
        console.log(`[AdminPage Client] HTTP function result for ${userId}:`, result);

        // Check for errors in the response
        if (!response.ok) {
            console.error(`[AdminPage Client] Error from HTTP function:`, result.error);
            throw new Error(result.error || 'حدث خطأ أثناء تحديث صلاحية المسؤول.');
        }

        toast({
            title: 'تم تحديث صلاحية المسؤول',
            description: `تم ${currentIsAdmin ? 'إلغاء' : 'منح'} صلاحية المسؤول للمستخدم.`,
        });
        console.log(`[AdminPage Client] Successfully toggled admin status for ${userId}.`);
        // لا نحتاج لتحديث القائمة يدويًا لأن المستمع سيقوم بذلك تلقائيًا

    } catch (err: any) {
       console.error("[AdminPage Client] Error calling HTTP function:", err);
        let errorMessage = `فشل في تحديث دور المستخدم: ${err.message || 'سبب غير معروف'}.`;
        if (err.message && err.message.includes('not-found')) {
            errorMessage = `فشل في تحديث دور المستخدم: لم يتم العثور على وظيفة السحابة. تأكد من نشرها في us-central1.`;
        } else if (err.message && err.message.includes('permission-denied')) {
            errorMessage = 'فشل في تحديث دور المستخدم: ليس لديك الإذن للقيام بهذا الإجراء.';
        } else if (err.message && err.message.includes("Credential implementation")) {
             errorMessage = `فشل في تحديث دور المستخدم: مشكلة في بيانات اعتماد تهيئة Admin SDK على الخادم.`;
        } else if (err.message && err.message.includes("internal")) {
             errorMessage = `فشل في تحديث دور المستخدم: خطأ داخلي في الخادم.`;
        }
        toast({
            title: 'فشل تحديث الصلاحية',
            description: errorMessage,
            variant: 'destructive',
        });
       // Optionally refetch users on error to revert optimistic UI if needed
       // fetchUsers();
    } finally {
      setActionLoadingState(userId, 'admin', false);
    }
  };

  // --- Toggle User Disabled Status using HTTP Function with CORS support ---
  const toggleDisableStatus = async (userId: string, currentIsDisabled: boolean) => {
     if (!user) {
         console.error("[AdminPage Client] toggleDisableStatus skipped: user not authenticated.");
        toast({ title: 'خطأ', description: "يجب تسجيل الدخول أولاً.", variant: 'destructive' });
        return;
    }
    if (userId === user?.uid) {
      toast({ title: 'لا يمكن تعطيل حسابك الخاص', variant: 'destructive' });
      return;
    }

    setActionLoadingState(userId, 'disable', true);
    // Use the HTTP version of the function with CORS support
    const functionUrl = 'https://us-central1-tasks-intelligence.cloudfunctions.net/setUserDisabledStatusHttp';
    console.log(`[AdminPage Client] Calling HTTP Function at ${functionUrl} for user ${userId} to ${!currentIsDisabled}...`);

    try {
        // Get the current user's ID token for authentication
        const idToken = await user.getIdToken();

        // Make a direct HTTP request to the function URL
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                uid: userId,
                disabled: !currentIsDisabled
            })
        });

        // Parse the response
        const result = await response.json();
        console.log(`[AdminPage Client] HTTP function result for ${userId}:`, result);

        // Check for errors in the response
        if (!response.ok) {
            console.error(`[AdminPage Client] Error from HTTP function:`, result.error);
            throw new Error(result.error || 'حدث خطأ أثناء تحديث حالة المستخدم.');
        }

        toast({
            title: 'تم تحديث حالة المستخدم',
            description: `تم ${currentIsDisabled ? 'تمكين' : 'تعطيل'} حساب المستخدم.`,
        });
        console.log(`[AdminPage Client] Successfully toggled disabled status for user ${userId}.`);
        // لا نحتاج لتحديث القائمة يدويًا لأن المستمع سيقوم بذلك تلقائيًا

    } catch (err: any) {
        console.error("[AdminPage Client] Error calling HTTP function:", err);
        let errorMessage = `فشل في تحديث حالة المستخدم: ${err.message || 'سبب غير معروف'}.`;
        if (err.message && err.message.includes('not-found')) {
            errorMessage = `فشل في تحديث حالة المستخدم: لم يتم العثور على وظيفة السحابة. تأكد من نشرها في us-central1.`;
        } else if (err.message && err.message.includes('permission-denied')) {
            errorMessage = 'فشل في تحديث حالة المستخدم: ليس لديك الإذن للقيام بهذا الإجراء.';
        } else if (err.message && err.message.includes("Credential implementation")) {
             errorMessage = `فشل في تحديث حالة المستخدم: مشكلة في بيانات اعتماد تهيئة Admin SDK على الخادم.`;
        } else if (err.message && err.message.includes("internal")) {
             errorMessage = `فشل في تحديث حالة المستخدم: خطأ داخلي في الخادم.`;
        }
        toast({
            title: 'فشل تحديث حالة المستخدم',
            description: errorMessage,
            variant: 'destructive',
        });
        // fetchUsers();
    } finally {
      setActionLoadingState(userId, 'disable', false);
    }
  };

  // --- Handle Create User using HTTP Function with CORS support ---
  const handleCreateUser = async (userData: CreateUserInput) => {
      if (!user) {
         console.error("[AdminPage Client] handleCreateUser skipped: user not authenticated.");
        toast({ title: 'خطأ', description: "يجب تسجيل الدخول أولاً.", variant: 'destructive' });
        return;
      }
    console.log("[AdminPage Client] Calling createUserHttp function with data:", userData);
    setActionLoadingState('createUser', 'create', true);

    // Use the HTTP version of the function with CORS support
    const functionUrl = 'https://us-central1-tasks-intelligence.cloudfunctions.net/createUserHttp';

    try {
        // Get the current user's ID token for authentication
        const idToken = await user.getIdToken();

        // Make a direct HTTP request to the function URL
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(userData)
        });

        // Parse the response
        const result = await response.json();
        console.log("[AdminPage Client] HTTP function result:", result);

        // Check for errors in the response
        if (!response.ok) {
            console.error(`[AdminPage Client] Error from HTTP function:`, result.error);

            // Specific handling for email already exists error
            if (result.error && (result.error.includes('email-already-exists') || result.error.includes('البريد الإلكتروني مستخدم بالفعل'))) {
                toast({
                    title: 'فشل إنشاء المستخدم',
                    description: 'فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.',
                    variant: 'destructive',
                });
            } else {
                throw new Error(result.error || 'حدث خطأ أثناء إنشاء المستخدم.');
            }
        } else if (result.uid) {
            toast({
                title: 'تم إنشاء المستخدم بنجاح',
                description: `تم إنشاء المستخدم ${userData.email} بالمعرف ${result.uid}.`,
            });
            // لا نحتاج لتحديث القائمة يدويًا لأن المستمع سيقوم بذلك تلقائيًا
            setIsCreateUserDialogOpen(false); // Close dialog on success
        } else {
            console.error("[AdminPage Client] HTTP function did not return UID.");
            throw new Error('لم يتم إرجاع UID بعد إنشاء المستخدم.');
        }

    } catch (err: any) {
        console.error("[AdminPage Client] Error calling HTTP function:", err);
        let errorMessage = `فشل في إنشاء المستخدم: ${err.message || 'سبب غير معروف'}.`;

        if (err.message && err.message.includes('not-found')) {
            errorMessage = `فشل في إنشاء المستخدم: لم يتم العثور على وظيفة السحابة. تأكد من نشرها في us-central1.`;
        } else if (err.message && err.message.includes('permission-denied')) {
            errorMessage = 'فشل في إنشاء المستخدم: ليس لديك الإذن للقيام بهذا الإجراء.';
        } else if (err.message && err.message.includes("Credential implementation")) {
            errorMessage = `فشل في إنشاء المستخدم: مشكلة في بيانات اعتماد تهيئة Admin SDK على الخادم.`;
        } else if (err.message && err.message.includes("internal")) {
            errorMessage = `فشل في إنشاء المستخدم: خطأ داخلي في الخادم.`;
        }

        // Avoid showing the specific error if it was already handled above (like email exists)
        if (!errorMessage.includes('البريد الإلكتروني مستخدم بالفعل')) {
            toast({
                title: 'فشل إنشاء المستخدم',
                description: errorMessage,
                variant: 'destructive',
            });
        }
    } finally {
       setActionLoadingState('createUser', 'create', false);
    }
  };


  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center">
            <UserCog className="ml-2 h-6 w-6" /> لوحة تحكم المسؤول
          </h1>
          <div className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded-md">
            <div className="flex justify-between items-center">
              <p className="font-semibold">معلومات المستخدم:</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  // عرض معلومات المستخدم كاملة
                  toast({
                    title: 'معلومات المستخدم الكاملة',
                    description: (
                      <pre className="mt-2 w-full p-2 rounded bg-muted text-xs overflow-auto">
                        {JSON.stringify(user, null, 2)}
                      </pre>
                    ),
                    duration: 10000,
                  });
                }}
              >
                عرض كامل البيانات
              </Button>
            </div>
            <ul className="mt-1 space-y-1">
              <li><strong>الدور:</strong> {(user as ExtendedUser)?.customClaims?.role || 'غير محدد'}</li>
              <li><strong>مالك النظام:</strong> {(user as ExtendedUser)?.customClaims?.owner ? 'نعم' : 'لا'}</li>
              <li><strong>مسؤول:</strong> {(user as ExtendedUser)?.customClaims?.admin ? 'نعم' : 'لا'}</li>
              <li><strong>البريد الإلكتروني:</strong> {user?.email || 'غير متوفر'}</li>
              <li><strong>معرف المستخدم:</strong> {user?.uid || 'غير متوفر'}</li>
            </ul>
          </div>
        </div>
         <div className="flex items-center gap-2">
            {/* زر تحديث الصلاحيات */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await refreshUserData();
                  toast({
                    title: 'تم التحديث',
                    description: 'تم تحديث معلومات المستخدم وصلاحياته بنجاح',
                  });
                  // تأخير قبل تحديث الصفحة
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                } catch (error) {
                  console.error('Error refreshing user data:', error);
                  toast({
                    title: 'خطأ',
                    description: 'حدث خطأ أثناء تحديث معلومات المستخدم',
                    variant: 'destructive',
                  });
                }
              }}
            >
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              تحديث الصلاحيات
            </Button>

            {/* زر تعيين نفسي كمالك */}
            {!(user as ExtendedUser)?.customClaims?.owner && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // استدعاء دالة تعيين المستخدم كمالك
                      const functions = getFunctions();
                      const setOwnerRoleFunction = httpsCallable(functions, 'setOwnerRole');
                      await setOwnerRoleFunction({ uid: user?.uid, isOwner: true });

                      toast({
                        title: 'تم تعيين نفسك كمالك',
                        description: 'تم تعيينك كمالك بنجاح. يرجى تسجيل الخروج وإعادة تسجيل الدخول لتفعيل الصلاحيات الجديدة.',
                      });
                    } catch (error) {
                      console.error('Error setting owner role:', error);
                      toast({
                        title: 'خطأ',
                        description: 'حدث خطأ أثناء تعيين نفسك كمالك',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <ShieldCheck className="ml-2 h-4 w-4" />
                  تعيين نفسي كمالك
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // تعيين المستخدم كمالك بشكل مباشر عن طريق تحديث وثيقة المستخدم
                      const userDocRef = doc(db, 'users', user?.uid || '');
                      await updateDoc(userDocRef, {
                        role: 'owner',
                        isOwner: true,
                        isAdmin: true,
                        updatedAt: new Date()
                      });

                      toast({
                        title: 'تم تحديث وثيقة المستخدم',
                        description: 'تم تحديث وثيقة المستخدم بنجاح. يرجى تحديث الصلاحيات ثم تسجيل الخروج وإعادة تسجيل الدخول.',
                      });
                    } catch (error) {
                      console.error('Error updating user document:', error);
                      toast({
                        title: 'خطأ',
                        description: 'حدث خطأ أثناء تحديث وثيقة المستخدم',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <ShieldCheck className="ml-2 h-4 w-4" />
                  تحديث وثيقة المستخدم
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // استدعاء دالة تعيين المستخدم كمالك بشكل مباشر
                      const idToken = await auth.currentUser?.getIdToken();
                      if (!idToken) {
                        throw new Error('لم يتم العثور على رمز المصادقة');
                      }

                      const response = await fetch(`https://us-central1-tasks-intelligence.cloudfunctions.net/setOwnerDirectHttp?uid=${user?.uid}`, {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${idToken}`
                        }
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'حدث خطأ أثناء تعيين المستخدم كمالك');
                      }

                      const data = await response.json();

                      toast({
                        title: 'تم تعيين المستخدم كمالك',
                        description: 'تم تعيين المستخدم كمالك بنجاح. يرجى تحديث الصلاحيات ثم تسجيل الخروج وإعادة تسجيل الدخول.',
                      });

                      // تحديث معلومات المستخدم
                      await refreshUserData();
                    } catch (error) {
                      console.error('Error setting owner directly:', error);
                      toast({
                        title: 'خطأ',
                        description: `حدث خطأ أثناء تعيين المستخدم كمالك: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <ShieldCheck className="ml-2 h-4 w-4" />
                  تعيين كمالك مباشرة
                </Button>
              </>
            )}

            {/* زر تسجيل الخروج وإعادة تسجيل الدخول */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  // تسجيل الخروج
                  await auth.signOut();
                  toast({
                    title: 'تم تسجيل الخروج',
                    description: 'تم تسجيل الخروج بنجاح، سيتم إعادة توجيهك لصفحة تسجيل الدخول...',
                  });
                  // إعادة توجيه المستخدم لصفحة تسجيل الدخول
                  setTimeout(() => {
                    window.location.href = '/login';
                  }, 1500);
                } catch (error) {
                  console.error('Error signing out:', error);
                  toast({
                    title: 'خطأ',
                    description: 'حدث خطأ أثناء تسجيل الخروج',
                    variant: 'destructive',
                  });
                }
              }}
            >
              <X className="ml-2 h-4 w-4" />
              تسجيل الخروج
            </Button>

            {/* Add Create User Button */}
             <Button onClick={() => setIsCreateUserDialogOpen(true)} size="sm">
                <PlusCircle className="ml-2 h-4 w-4" /> إنشاء مستخدم جديد
            </Button>

             <Button asChild variant="outline" size="sm">
                <Link href="/admin/logs">
                     <FileText className="ml-2 h-4 w-4" />
                     عرض السجلات
                 </Link>
            </Button>

            {/* زر صفحة التشخيص - يظهر فقط للمالك */}
            {(user as ExtendedUser)?.customClaims?.owner && (
              <Button asChild variant="outline" size="sm">
                <Link href="/debug">
                  <Bug className="ml-2 h-4 w-4" />
                  صفحة التشخيص
                </Link>
              </Button>
            )}
         </div>
      </div>

      {/* بطاقة طلبات إنشاء المؤسسات - تظهر فقط للمالك */}
      {(user as ExtendedUser)?.customClaims?.owner && (
        <Card className="shadow-md border border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="ml-2 h-5 w-5" />
              طلبات إنشاء المؤسسات
            </CardTitle>
            <CardDescription>
              مراجعة والموافقة على طلبات إنشاء المؤسسات الجديدة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <p className="text-sm">يمكنك مراجعة طلبات إنشاء المؤسسات والموافقة عليها أو رفضها.</p>
              <Button asChild variant="default" size="sm">
                <Link href="/admin/organization-requests">
                  <Eye className="ml-2 h-4 w-4" />
                  عرض الطلبات
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* بطاقة إدارة المستخدمين */}
      <Card className="shadow-md border border-border">
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserCog className="ml-2 h-5 w-5" />
            إدارة المستخدمين
          </CardTitle>
          <CardDescription>
            عرض المستخدمين وتغيير الأدوار والصلاحيات وحالة الحساب.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full rounded-md bg-muted" />
              <Skeleton className="h-16 w-full rounded-md bg-muted" />
              <Skeleton className="h-16 w-full rounded-md bg-muted" />
            </div>
          ) : error ? (
            <div className="text-center text-destructive p-4 border border-destructive/30 bg-destructive/10 rounded-md flex flex-col items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              <p className="font-semibold">فشل تحميل المستخدمين</p>
              <p className="text-sm">{error}</p>
              <Button onClick={fetchUsers} variant="destructive" size="sm" className="mt-2">
                إعادة المحاولة
              </Button>
            </div>
          ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                 لم يتم العثور على مستخدمين.
             </p>
          ) : (
            <ul className="space-y-4">
              {users.map(u => (
                <li key={u.uid} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-md bg-card hover:bg-muted/50 gap-4">
                  {/* User Info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenUserDetails(u)}>
                     <p className="text-sm font-medium text-foreground truncate">{u.name ?? u.email ?? `مستخدم (${u.uid.substring(0, 8)}...)`}</p>
                     <p className="text-xs text-muted-foreground truncate">{u.email ?? 'لا يوجد بريد إلكتروني'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* Role Badge */}
                      <Badge
                        variant={
                          u.role === 'owner' ? "destructive" :
                          u.role === 'admin' ? "default" :
                          u.role === 'user' ? "secondary" :
                          "outline"
                        }
                        className={`text-xs py-0.5 px-1.5 h-auto ${u.role === 'owner' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                      >
                        {(() => {
                          switch(u.role) {
                            case 'owner': return 'مالك النظام';
                            case 'admin': return 'مسؤول';
                            case 'individual_admin': return 'مسؤول نظام الأفراد';
                            case 'engineer': return 'مهندس';
                            case 'supervisor': return 'مشرف';
                            case 'technician': return 'فني';
                            case 'assistant': return 'مساعد فني';
                            case 'user': return 'مستخدم';
                            case 'independent': return 'مستخدم مستقل';
                            default: return u.role;
                          }
                        })()}
                      </Badge>

                      {/* Status Badge */}
                      <Badge variant={u.disabled ? "destructive" : "outline"} className="text-xs py-0.5 px-1.5 h-auto">
                        {u.disabled ? 'معطل' : 'نشط'}
                      </Badge>

                      {/* Custom Permissions Badge */}
                      {u.customPermissions && u.customPermissions.length > 0 && (
                        <Badge variant="outline" className="text-xs py-0.5 px-1.5 h-auto bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                          صلاحيات مخصصة
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
                    {/* View/Edit Details Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenUserDetails(u)}
                      className="w-full sm:w-auto flex items-center justify-center"
                    >
                      <UserCog className="ml-1.5 h-4 w-4" />
                      تفاصيل
                    </Button>

                    {/* زر تعيين المستخدم كمالك - يظهر فقط للمالك */}
                    {(user as ExtendedUser)?.customClaims?.owner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            setActionLoadingState(u.uid, 'role', true);

                            // استدعاء دالة تعيين المستخدم كمالك
                            const functions = getFunctions();
                            const setOwnerRoleFunction = httpsCallable(functions, 'setOwnerRole');
                            await setOwnerRoleFunction({ uid: u.uid, isOwner: true });

                            toast({
                              title: 'تم تعيين المستخدم كمالك',
                              description: 'تم تعيين المستخدم كمالك بنجاح. يرجى الطلب منه تسجيل الخروج وإعادة تسجيل الدخول لتفعيل الصلاحيات الجديدة.',
                            });

                            // تحديث قائمة المستخدمين
                            fetchUsers();
                          } catch (error) {
                            console.error('Error setting owner role:', error);
                            toast({
                              title: 'خطأ',
                              description: 'حدث خطأ أثناء تعيين المستخدم كمالك',
                              variant: 'destructive',
                            });
                          } finally {
                            setActionLoadingState(u.uid, 'role', false);
                          }
                        }}
                        disabled={actionLoading[u.uid]?.role || loading || u.role === 'owner'}
                        className="w-full sm:w-auto flex items-center justify-center"
                      >
                        <ShieldCheck className="ml-1.5 h-4 w-4" />
                        {u.role === 'owner' ? 'مالك بالفعل' : 'تعيين كمالك'}
                      </Button>
                    )}

                    {/* Toggle Disabled Status */}
                    <div className="flex items-center space-x-2 space-x-reverse w-full sm:w-auto justify-center sm:justify-start">
                      <Switch
                        id={`disable-switch-${u.uid}`}
                        checked={!u.disabled}
                        onCheckedChange={() => toggleDisableStatus(u.uid, u.disabled)}
                        disabled={actionLoading[u.uid]?.disable || loading || u.uid === user?.uid}
                        aria-label={u.disabled ? 'تمكين المستخدم' : 'تعطيل المستخدم'}
                      />
                      <Label htmlFor={`disable-switch-${u.uid}`} className="text-xs cursor-pointer min-w-[40px] text-center">
                        {u.disabled ? 'تمكين' : 'تعطيل'}
                      </Label>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <CreateUserDialog
        isOpen={isCreateUserDialogOpen}
        onOpenChange={setIsCreateUserDialogOpen}
        onSubmit={handleCreateUser}
        loading={actionLoading['createUserAction']?.create}
      />

      {/* User Details Dialog */}
      <UserDetailsDialog
        isOpen={isUserDetailsDialogOpen}
        onOpenChange={setIsUserDetailsDialogOpen}
        user={selectedUser}
        onUpdateRole={updateUserRole}
        onUpdatePermissions={updateUserPermissions}
        onToggleDisabled={toggleDisableStatus}
        loading={loading}
      />
    </div>
  );
}

