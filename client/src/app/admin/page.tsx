
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from '../../../../firebaseConfig'; // Corrected path

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ShieldOff, UserCog, FileText, AlertTriangle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ManagedUser } from '@/types/user';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';

// Define the structure for CreateUserInput expected by the Cloud Function
interface CreateUserInput {
    email: string;
    password: string;
    name: string;
    role: string; // e.g., 'org_admin', 'user'
}

// Initialize Firebase App if it hasn't been already
let app;
try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
    console.error("[AdminPage Client] Firebase initialization failed:", error);
    // Handle the error appropriately, maybe show a global error message
}

// Initialize Firebase Functions with explicit region - Ensure this happens only once
let functionsInstance: ReturnType<typeof getFunctions> | null = null;
if (app && !functionsInstance) { // Check if already initialized
    try {
        functionsInstance = getFunctions(app, "europe-west1");
         console.log("[AdminPage Client] Firebase Functions initialized for region europe-west1.");
    } catch(error) {
        console.error("[AdminPage Client] Failed to initialize Firebase Functions:", error);
         // Handle initialization error
    }
}

export default function AdminDashboardPage() {
  const { user } = useAuth(); // Get current authenticated user
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, Record<string, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);

  // --- Fetch Users using Cloud Function ---
  const fetchUsers = useCallback(async () => {
    if (!functionsInstance) {
        console.log("[AdminPage Client] fetchUsers skipped: functionsInstance not ready.");
        setError("Firebase Functions ليست مهيأة."); // Firebase Functions not initialized.
        setLoading(false);
        return;
    }
    console.log("[AdminPage Client] fetchUsers called");
    setError(null);
    setLoading(true); // Set loading true at the start of fetch
    const functionName = 'listFirebaseUsers';
    console.log(`[AdminPage Client] Calling Cloud Function '${functionName}'...`);

    try {
        // Ensure functionsInstance is available before calling
        if (!functionsInstance) throw new Error("Firebase Functions not initialized.");

        const listFirebaseUsersFn = httpsCallable<{/* Input type if any */}, { users?: any[]; error?: string }>(functionsInstance, functionName);
        const result = await listFirebaseUsersFn();
        console.log("[AdminPage Client] listFirebaseUsers function result:", result?.data);

        if (result?.data?.error) {
            console.error("[AdminPage] Error from listFirebaseUsers action:", result.data.error);
            throw new Error(result.data.error);
        }

        const usersData = result?.data?.users;
        if (!Array.isArray(usersData)) {
             console.error("[AdminPage Client] Unexpected response format from Cloud Function. Expected 'data.users' array, received:", result?.data);
             throw new Error("تنسيق استجابة غير متوقع من وظيفة السحابة."); // Unexpected response format from cloud function.
        }

         const fetchedUsers: ManagedUser[] = usersData.map((u: any) => ({
            uid: u.uid,
            email: u.email ?? `مستخدم (${u.uid.substring(0, 6)}...)`,
            name: u.displayName ?? u.name ?? 'غير متوفر', // Prioritize displayName, fallback to 'name' if stored
            role: u.role || u.customClaims?.role || 'isIndependent', // النظام الجديد الموحد
            accountType: u.accountType || u.customClaims?.accountType || 'individual',
            organizationId: u.organizationId || u.customClaims?.organizationId,
            departmentId: u.departmentId || u.customClaims?.departmentId,
            hasAdminAccess: !!(u.customClaims?.isSystemOwner || u.customClaims?.isSystemAdmin || u.customClaims?.isOrgOwner || u.customClaims?.isOrgAdmin),
            disabled: u.disabled ?? false,
            customPermissions: u.customPermissions || [], // Add customPermissions property
            createdAt: u.createdAt, // Add createdAt property
            lastLogin: u.lastLogin // Add lastLogin property
        }));

        setUsers(fetchedUsers);
        console.log(`[AdminPage Client] Successfully fetched ${fetchedUsers.length} users.`);
        setError(null); // Clear error on success

    } catch (err: any) {
       console.error("[AdminPage Client] Error in fetchUsers callback:", err);
       // Handle different types of errors (HttpsError vs others)
        let errorMessage = `فشل تحميل المستخدمين: ${err.message || 'سبب غير معروف'}.`;
        if (err.code && err.message) { // Firebase HttpsError
            console.error(`[AdminPage Client] HttpsError Details: Code=${err.code}, Message=${err.message}`);
            if (err.code === 'unauthenticated') {
                errorMessage = 'فشل في قائمة المستخدمين: يجب أن تكون مصادقًا.';
            } else if (err.code === 'permission-denied') {
                errorMessage = 'فشل في قائمة المستخدمين: ليس لديك الإذن.';
            } else if (err.code === 'not-found') {
                errorMessage = `فشل في قائمة المستخدمين: لم يتم العثور على وظيفة السحابة ('${functionName}'). يرجى التأكد من نشرها بالاسم الصحيح.`;
            } else {
                errorMessage = `فشل في قائمة المستخدمين: ${err.message} (${err.code}).`;
            }
        } else if (err.message && err.message.includes("Credential implementation provided to initializeApp()")) {
             errorMessage = "فشل في قائمة المستخدمين: مشكلة في تهيئة بيانات اعتماد مسؤول Firebase على الخادم.";
        } else if (err.message && err.message.includes("not-found")) {
            errorMessage = `فشل في قائمة المستخدمين: لم يتم العثور على وظيفة السحابة ('${functionName}'). تأكد من نشرها.`;
        }
       setError(errorMessage); // Set the error state
       toast({ // Show toast only on actual error
        title: 'فشل تحميل المستخدمين',
        description: errorMessage,
        variant: 'destructive',
       });
       setUsers([]); // Clear users on error
    } finally {
      console.log("[AdminPage Client] fetchUsers finished.");
      setLoading(false); // Ensure loading is set to false
    }
  }, [toast]); // Removed functionsInstance from here, check availability inside the function

  useEffect(() => {
    // Trigger fetch only when the user is authenticated and functions are likely initialized
    if (user && functionsInstance) {
        console.log("[AdminPage Client] useEffect triggered, calling fetchUsers.");
        fetchUsers();
    } else if (!user) {
        console.log("[AdminPage Client] useEffect: No user, clearing users and setting loading false.");
        setUsers([]);
        setLoading(false);
        setError(null); // Clear error if user logs out
    } else if (!functionsInstance && !error) {
         console.log("[AdminPage Client] useEffect: functionsInstance not ready.");
         setError("Firebase Functions ليست مهيأة."); // Set error if functions not ready
         setLoading(false);
    }
      // Cleanup function if needed (not strictly necessary for fetchUsers)
      // return () => { console.log("[AdminPage Client] useEffect cleanup"); };
  }, [user, fetchUsers]); // Depend only on user and the stable fetchUsers callback

  // Helper to update loading state
  const setActionLoadingState = (userId: string, actionType: 'org_admin' | 'disable' | 'create', isLoading: boolean) => {
    setActionLoading(prev => ({
      ...prev,
      [userId === 'createUser' ? 'createUserAction' : userId]: {
        ...(prev[userId === 'createUser' ? 'createUserAction' : userId] || {}),
        [actionType]: isLoading,
      }
    }));
  };

  // --- Toggle Admin Status using Cloud Function ---
  const toggleAdminStatus = async (userId: string, currentHasAdminAccess: boolean) => {
     if (!functionsInstance) {
        toast({ title: 'خطأ', description: "Firebase Functions ليست مهيأة.", variant: 'destructive' });
        return;
    }
    if (userId === user?.uid && currentHasAdminAccess) {
      toast({ title: 'لا يمكن إزالة صلاحية المسؤول عن نفسك', variant: 'destructive' });
      return;
    }

    setActionLoadingState(userId, 'org_admin', true);
    const functionName = 'setAdminRole';
    console.log(`[AdminPage Client] Calling Cloud Function '${functionName}' for user ${userId} to ${!currentHasAdminAccess}...`);

    try {
        const setAdminRoleFn = httpsCallable<{ uid: string; isAdmin: boolean }, { result?: string; error?: string }>(functionsInstance, functionName);
        const result = await setAdminRoleFn({ uid: userId, isAdmin: !currentHasAdminAccess });
        console.log(`[AdminPage Client] setAdminRole function result for ${userId}:`, result?.data);

        if (result?.data?.error) {
            throw new Error(result.data.error);
        }

        toast({
            title: 'تم تحديث صلاحية المسؤول',
            description: `تم ${currentHasAdminAccess ? 'إلغاء' : 'منح'} صلاحية المسؤول للمستخدم.`,
        });
        console.log(`[AdminPage Client] Successfully toggled admin status for ${userId}. Refetching users...`);
        fetchUsers(); // Refetch user list to get updated status

    } catch (err: any) {
       console.error("[AdminPage Client] Error calling setAdminRole function:", err);
        let errorMessage = `فشل في تحديث دور المستخدم: ${err.message || 'سبب غير معروف'}.`;
         if (err.code === 'not-found') {
             errorMessage = `فشل في تحديث دور المستخدم: لم يتم العثور على وظيفة السحابة ('${functionName}').`;
         } else if (err.code === 'permission-denied') {
             errorMessage = 'فشل في تحديث دور المستخدم: ليس لديك الإذن للقيام بهذا الإجراء.';
         } else if (err.message && err.message.includes("Credential implementation provided to initializeApp()")) {
              errorMessage = "فشل في تحديث دور المستخدم: مشكلة في تهيئة بيانات اعتماد مسؤول Firebase على الخادم.";
         }
        toast({
            title: 'فشل تحديث الصلاحية',
            description: errorMessage,
            variant: 'destructive',
        });
       // Optionally refetch users on error to revert optimistic UI if needed
       // fetchUsers();
    } finally {
      setActionLoadingState(userId, 'org_admin', false);
    }
  };

  // --- Toggle User Disabled Status using Cloud Function ---
  const toggleDisableStatus = async (userId: string, currentIsDisabled: boolean) => {
     if (!functionsInstance) {
        toast({ title: 'خطأ', description: "Firebase Functions ليست مهيأة.", variant: 'destructive' });
        return;
    }
    if (userId === user?.uid) {
      toast({ title: 'لا يمكن تعطيل حسابك الخاص', variant: 'destructive' });
      return;
    }

    setActionLoadingState(userId, 'disable', true);
    const functionName = 'setUserDisabledStatus';
    console.log(`[AdminPage Client] Calling Cloud Function '${functionName}' for user ${userId} to ${!currentIsDisabled}...`);

    try {
        const setUserDisabledStatusFn = httpsCallable<{ uid: string; disabled: boolean }, { result?: string; error?: string }>(functionsInstance, functionName);
        const result = await setUserDisabledStatusFn({ uid: userId, disabled: !currentIsDisabled });
        console.log(`[AdminPage Client] setUserDisabledStatus function result for ${userId}:`, result?.data);

        if (result?.data?.error) {
            throw new Error(result.data.error);
        }

        toast({
            title: 'تم تحديث حالة المستخدم',
            description: `تم ${currentIsDisabled ? 'تمكين' : 'تعطيل'} حساب المستخدم.`,
        });
        console.log(`[AdminPage Client] Successfully toggled disabled status for user ${userId}. Refetching users...`);
        fetchUsers(); // Refetch user list

    } catch (err: any) {
        console.error("[AdminPage Client] Error calling setUserDisabledStatus function:", err);
        let errorMessage = `فشل في تحديث حالة المستخدم: ${err.message || 'سبب غير معروف'}.`;
        if (err.code === 'not-found') {
            errorMessage = `فشل في تحديث حالة المستخدم: لم يتم العثور على وظيفة السحابة ('${functionName}').`;
        } else if (err.code === 'permission-denied') {
            errorMessage = 'فشل في تحديث حالة المستخدم: ليس لديك الإذن للقيام بهذا الإجراء.';
        } else if (err.message && err.message.includes("Credential implementation provided to initializeApp()")) {
             errorMessage = "فشل في تحديث حالة المستخدم: مشكلة في تهيئة بيانات اعتماد مسؤول Firebase على الخادم.";
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

  // --- Handle Create User using Cloud Function ---
  const handleCreateUser = async (userData: CreateUserInput) => {
      if (!functionsInstance) {
        toast({ title: 'خطأ', description: "Firebase Functions ليست مهيأة.", variant: 'destructive' });
        return;
      }
    console.log("[AdminPage Client] Calling createUser function with data:", userData);
    setActionLoadingState('createUser', 'create', true);
    const functionName = 'createUser';

    try {
        const createUserFn = httpsCallable<CreateUserInput, { uid?: string; error?: string }>(functionsInstance, functionName);
        const result = await createUserFn(userData);
        console.log("[AdminPage Client] createUser function result:", result?.data);

        if (result?.data?.error) {
             // Specific handling for email already exists error
            if (result.data.error.includes('email-already-exists') || result.data.error.includes('البريد الإلكتروني مستخدم بالفعل')) {
                 toast({
                    title: 'فشل إنشاء المستخدم',
                    description: 'فشل إنشاء المستخدم: البريد الإلكتروني مستخدم بالفعل.',
                    variant: 'destructive',
                 });
            } else {
                 throw new Error(result.data.error);
            }
        } else if (result?.data?.uid) {
            toast({
                title: 'تم إنشاء المستخدم بنجاح',
                description: `تم إنشاء المستخدم ${userData.email} بالمعرف ${result.data.uid}.`,
            });
            fetchUsers(); // Refresh the user list
            setIsCreateUserDialogOpen(false); // Close dialog on success
        } else {
            throw new Error('لم يتم إرجاع UID بعد إنشاء المستخدم.');
        }

    } catch (err: any) {
        console.error("[AdminPage Client] Error calling createUser function:", err);
        let errorMessage = `فشل في إنشاء المستخدم: ${err.message || 'سبب غير معروف'}.`;
        if (err.code === 'not-found') {
            errorMessage = `فشل في إنشاء المستخدم: لم يتم العثور على وظيفة السحابة ('${functionName}').`;
        } else if (err.code === 'permission-denied') {
            errorMessage = 'فشل في إنشاء المستخدم: ليس لديك الإذن للقيام بهذا الإجراء.';
        } else if (err.message && err.message.includes("Credential implementation provided to initializeApp()")) {
            errorMessage = "فشل في إنشاء المستخدم: مشكلة في تهيئة بيانات اعتماد مسؤول Firebase على الخادم.";
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
        <h1 className="text-2xl font-bold text-primary flex items-center">
          <UserCog className="ml-2 h-6 w-6" /> لوحة تحكم المسؤول
        </h1>
         <div className="flex items-center gap-2">
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
         </div>
      </div>

      <Card className="shadow-md border border-border">
        <CardHeader>
          <CardTitle>إدارة المستخدمين</CardTitle>
           <CardDescription>
                عرض المستخدمين وتغيير صلاحيات المسؤول وحالة الحساب.
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
                  <div className="flex-1 min-w-0">
                     <p className="text-sm font-medium text-foreground truncate">{u.name ?? u.email ?? `مستخدم (${u.uid.substring(0, 8)}...)`}</p>
                     <p className="text-xs text-muted-foreground truncate">{u.email ?? 'لا يوجد بريد إلكتروني'}</p> {/* Display email separately */}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={u.hasAdminAccess ? "default" : "secondary"} className="text-xs py-0.5 px-1.5 h-auto">
                        {u.hasAdminAccess ? 'مسؤول' : 'مستخدم'}
                      </Badge>
                      <Badge variant={u.disabled ? "destructive" : "outline"} className="text-xs py-0.5 px-1.5 h-auto">
                        {u.disabled ? 'معطل' : 'نشط'}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
                    {/* Toggle Admin */}
                    <Button
                      variant={u.hasAdminAccess ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => toggleAdminStatus(u.uid, u.hasAdminAccess)}
                      disabled={actionLoading[u.uid]?.admin || loading || u.uid === user?.uid}
                      className="w-full sm:w-32 flex items-center justify-center"
                      aria-label={u.hasAdminAccess ? 'إزالة صلاحية المسؤول' : 'منح صلاحية المسؤول'}
                    >
                      {actionLoading[u.uid]?.admin ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : u.hasAdminAccess ? (
                        <>
                          <ShieldOff className="ml-1.5 h-4 w-4" />
                          إزالة المسؤول
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="ml-1.5 h-4 w-4" />
                          جعله مسؤولاً
                        </>
                      )}
                    </Button>

                    {/* Toggle Disable Status */}
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
    </div>
  );
}


    