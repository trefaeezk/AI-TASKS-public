'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Users, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { collection, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { UserRole } from '@/types/roles';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { UserDetailsDialog } from '@/components/admin/UserDetailsDialog';
import { ManagedUser } from '@/types/user';
import { useToast } from '@/hooks/use-toast';

// تهيئة Firebase Functions
const functionsInstance = getFunctions();

export default function UsersPage() {
  const { user, refreshUserData } = useAuth();
  const { checkPermission, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // التحقق من صلاحيات المستخدم
  const hasViewPermission = checkPermission('users', 'view');

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user || !hasViewPermission) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // الحصول على معرف المؤسسة من custom claims
      const userClaims = (user as any).customClaims;
      const organizationId = userClaims?.organizationId;
      const isOwner = userClaims?.owner === true;

      // استخدام وظائف الباك إند للحصول على المستخدمين
      try {
        setLoading(true);

      if (organizationId) {
        console.log(`Fetching users for organization: ${organizationId}`);

        // استخدام وظيفة getOrganizationMembers للحصول على أعضاء المؤسسة
        const getOrganizationMembersFn = httpsCallable<{ orgId: string }, { members: any[] }>(functionsInstance, 'getOrganizationMembers');
        const result = await getOrganizationMembersFn({ orgId: organizationId });

        if (!result.data || !result.data.members) {
          throw new Error('فشل في جلب أعضاء المؤسسة: لم يتم استلام بيانات صحيحة');
        }

        // تحويل البيانات إلى تنسيق ManagedUser
        const orgUsers = result.data.members.map((member: any) => ({
          uid: member.uid,
          email: member.email || '',
          role: member.role || 'user',
          name: member.name || '',
          disabled: false,
          customPermissions: [],
          isAdmin: member.role === 'admin' || member.role === 'owner',
          accountType: 'organization',
          organizationId
        }));

        setUsers(orgUsers);
      } else if (isOwner) {
        console.log('Fetching all users (owner view)');

        // استخدام وظيفة listFirebaseUsers للحصول على جميع المستخدمين
        const listFirebaseUsersFn = httpsCallable<{}, { users: any[] }>(functionsInstance, 'listFirebaseUsers');
        const result = await listFirebaseUsersFn({});

        if (!result.data || !result.data.users) {
          throw new Error('فشل في جلب قائمة المستخدمين: لم يتم استلام بيانات صحيحة');
        }

        // تحويل البيانات إلى تنسيق ManagedUser
        const allUsers = result.data.users.map((user: any) => ({
          uid: user.uid,
          email: user.email || '',
          role: (user.customClaims?.role as UserRole) || 'user',
          name: user.displayName || '',
          disabled: user.disabled || false,
          customPermissions: user.customClaims?.customPermissions || [],
          isAdmin: user.customClaims?.admin === true || user.customClaims?.role === 'admin',
          accountType: user.customClaims?.accountType || 'individual',
          organizationId: user.customClaims?.organizationId
        }));

        setUsers(allUsers);
      } else {
        // إذا لم يكن المستخدم مالكًا أو ينتمي لمؤسسة، نعرض قائمة فارغة
        console.log('User is not an owner or organization member, showing empty list');
        setUsers([]);
      }

      setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'خطأ في جلب بيانات المستخدمين',
          description: error instanceof Error ? error.message : 'حدث خطأ غير معروف',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    fetchUsers();

    // لا نحتاج إلى مستمع للتغييرات بعد الآن، لأننا نستخدم وظائف Callable
    return () => {};
  }, [user, hasViewPermission, toast]);

  // عرض حالة التحميل
  if (permissionsLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // التحقق من صلاحيات المستخدم
  if (!hasViewPermission) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <AlertCircle className="ml-2 h-5 w-5 text-destructive" />
              غير مصرح
            </CardTitle>
            <CardDescription>
              ليس لديك صلاحية للوصول إلى هذه الصفحة.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // عرض حالة التحميل للمستخدمين
  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <Users className="ml-2 h-6 w-6" />
            إدارة المستخدمين
          </h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const handleUserClick = (user: ManagedUser) => {
    setSelectedUser(user);
    setShowDetailsDialog(true);
  };

  const handleCreateUser = async (userData: any) => {
    if (!user) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول لإنشاء مستخدم جديد.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // استخدام وظيفة createUser
      const createUserFn = httpsCallable<any, { uid?: string; error?: string }>(functionsInstance, 'createUser');
      const result = await createUserFn(userData);

      // التحقق من نجاح العملية
      if (result.data?.error) {
        throw new Error(result.data.error);
      }

      toast({
        title: 'تم إنشاء المستخدم بنجاح',
        description: `تم إنشاء المستخدم ${userData.email} بنجاح.`,
      });

      // تحديث قائمة المستخدمين
      const fetchUsers = async () => {
        // استدعاء وظيفة fetchUsers لتحديث القائمة
        if (user && hasViewPermission) {
          setLoading(true);
          try {
            // نفس الكود الموجود في useEffect
            const userClaims = (user as any).customClaims;
            const organizationId = userClaims?.organizationId;
            const isOwner = userClaims?.owner === true;

            if (organizationId) {
              const getOrganizationMembersFn = httpsCallable<{ orgId: string }, { members: any[] }>(functionsInstance, 'getOrganizationMembers');
              const result = await getOrganizationMembersFn({ orgId: organizationId });

              if (result.data?.members) {
                const orgUsers = result.data.members.map((member: any) => ({
                  uid: member.uid,
                  email: member.email || '',
                  role: member.role || 'user',
                  name: member.name || '',
                  disabled: false,
                  customPermissions: [],
                  isAdmin: member.role === 'admin' || member.role === 'owner',
                  accountType: 'organization',
                  organizationId
                }));
                setUsers(orgUsers);
              }
            } else if (isOwner) {
              const listFirebaseUsersFn = httpsCallable<{}, { users: any[] }>(functionsInstance, 'listFirebaseUsers');
              const result = await listFirebaseUsersFn({});

              if (result.data?.users) {
                const allUsers = result.data.users.map((user: any) => ({
                  uid: user.uid,
                  email: user.email || '',
                  role: (user.customClaims?.role as UserRole) || 'user',
                  name: user.displayName || '',
                  disabled: user.disabled || false,
                  customPermissions: user.customClaims?.customPermissions || [],
                  isAdmin: user.customClaims?.admin === true || user.customClaims?.role === 'admin',
                  accountType: user.customClaims?.accountType || 'individual',
                  organizationId: user.customClaims?.organizationId
                }));
                setUsers(allUsers);
              }
            }
          } catch (error) {
            console.error('Error refreshing users:', error);
          } finally {
            setLoading(false);
          }
        }
      };

      // تحديث القائمة
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'فشل إنشاء المستخدم',
        description: error.message || 'حدث خطأ أثناء إنشاء المستخدم.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateUser = async (userId: string, userData: any) => {
    if (!user) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول لتحديث بيانات المستخدم.',
        variant: 'destructive',
      });
      return;
    }

    // إذا كان المستخدم الحالي هو نفسه الذي يتم تحديث دوره، نحتاج لإعادة تحميل معلوماته
    const isCurrentUser = userId === user.uid;

    try {
      // تحديد الوظيفة المناسبة بناءً على نوع التحديث
      let functionName = '';
      let requestData = {};
      let isRoleUpdate = false;

      if ('role' in userData) {
        functionName = 'updateUserRole';
        requestData = {
          uid: userId,
          role: userData.role
        };
        isRoleUpdate = true;
      } else if ('customPermissions' in userData) {
        functionName = 'updateUserPermissions';
        requestData = {
          uid: userId,
          permissions: userData.customPermissions
        };
      } else if ('disabled' in userData) {
        functionName = 'setUserDisabledStatus';
        requestData = {
          uid: userId,
          disabled: userData.disabled
        };
      } else {
        throw new Error('نوع التحديث غير معروف');
      }

      // استدعاء الوظيفة المناسبة
      const updateFn = httpsCallable<any, { result?: string; error?: string }>(functionsInstance, functionName);
      const result = await updateFn(requestData);

      // التحقق من نجاح العملية
      if (result.data?.error) {
        throw new Error(result.data.error);
      }

      toast({
        title: 'تم تحديث بيانات المستخدم بنجاح',
        description: 'تم تحديث بيانات المستخدم بنجاح.',
      });

      // إذا كان تحديث للدور وكان المستخدم الحالي هو نفسه الذي تم تحديث دوره، نقوم بإعادة تحميل معلوماته
      if (isRoleUpdate && isCurrentUser) {
        console.log("[UsersPage] Current user role updated, refreshing user data");
        await refreshUserData();
      }

      // تحديث المستخدم المحدد إذا كان هو نفسه الذي تم تحديثه
      if (selectedUser && selectedUser.uid === userId) {
        setSelectedUser({
          ...selectedUser,
          ...userData
        });
      }

      // تحديث قائمة المستخدمين
      const fetchUsers = async () => {
        // استدعاء وظيفة fetchUsers لتحديث القائمة
        if (user && hasViewPermission) {
          setLoading(true);
          try {
            // نفس الكود الموجود في useEffect
            const userClaims = (user as any).customClaims;
            const organizationId = userClaims?.organizationId;
            const isOwner = userClaims?.owner === true;

            if (organizationId) {
              const getOrganizationMembersFn = httpsCallable<{ orgId: string }, { members: any[] }>(functionsInstance, 'getOrganizationMembers');
              const result = await getOrganizationMembersFn({ orgId: organizationId });

              if (result.data?.members) {
                const orgUsers = result.data.members.map((member: any) => ({
                  uid: member.uid,
                  email: member.email || '',
                  role: member.role || 'user',
                  name: member.name || '',
                  disabled: false,
                  customPermissions: [],
                  isAdmin: member.role === 'admin' || member.role === 'owner',
                  accountType: 'organization',
                  organizationId
                }));
                setUsers(orgUsers);
              }
            } else if (isOwner) {
              const listFirebaseUsersFn = httpsCallable<{}, { users: any[] }>(functionsInstance, 'listFirebaseUsers');
              const result = await listFirebaseUsersFn({});

              if (result.data?.users) {
                const allUsers = result.data.users.map((user: any) => ({
                  uid: user.uid,
                  email: user.email || '',
                  role: (user.customClaims?.role as UserRole) || 'user',
                  name: user.displayName || '',
                  disabled: user.disabled || false,
                  customPermissions: user.customClaims?.customPermissions || [],
                  isAdmin: user.customClaims?.admin === true || user.customClaims?.role === 'admin',
                  accountType: user.customClaims?.accountType || 'individual',
                  organizationId: user.customClaims?.organizationId
                }));
                setUsers(allUsers);
              }
            }
          } catch (error) {
            console.error('Error refreshing users:', error);
          } finally {
            setLoading(false);
          }
        }
      };

      // تحديث القائمة
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'فشل تحديث بيانات المستخدم',
        description: error.message || 'حدث خطأ أثناء تحديث بيانات المستخدم.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Users className="ml-2 h-6 w-6" />
          إدارة المستخدمين
        </h1>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center">
          <UserPlus className="ml-2 h-4 w-4" />
          إضافة مستخدم
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          لا يوجد مستخدمين
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.uid} className="cursor-pointer hover:bg-accent/10" onClick={() => handleUserClick(user)}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{user.email}</h3>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      switch(user.role) {
                        case 'admin': return 'مسؤول';
                        case 'engineer': return 'مهندس';
                        case 'supervisor': return 'مشرف';
                        case 'technician': return 'فني';
                        case 'assistant': return 'مساعد فني';
                        case 'user': return 'مستخدم';
                        case 'independent': return 'مستخدم مستقل';
                        default: return user.role;
                      }
                    })()}
                  </p>
                </div>
                <Button variant="ghost" size="sm">عرض التفاصيل</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* مربع حوار إنشاء مستخدم جديد */}
      <CreateUserDialog
        isOpen={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateUser}
        loading={false}
      />

      {/* مربع حوار تفاصيل المستخدم */}
      {selectedUser && (
        <UserDetailsDialog
          isOpen={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          user={selectedUser}
          onUpdateRole={async (userId, role) => {
            await handleUpdateUser(userId, { role });
          }}
          onUpdatePermissions={async (userId, permissions) => {
            await handleUpdateUser(userId, { customPermissions: permissions });
          }}
          onToggleDisabled={async (userId, disabled) => {
            await handleUpdateUser(userId, { disabled });
          }}
          loading={false}
        />
      )}
    </div>
  );
}
