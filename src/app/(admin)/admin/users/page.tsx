'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/usePermissions';
import { useSecureUserManagement } from '@/hooks/useSecureUserManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Users, UserPlus, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { collection, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, functions, auth } from '@/lib/firebase';
import { httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { UserRole } from '@/types/roles';
import { SystemType } from '@/types/system';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { UserDetailsDialog } from '@/components/admin/UserDetailsDialog';
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog';
import { Translate } from '@/components/Translate';
import { ManagedUser } from '@/types/user';
import { useToast } from '@/hooks/use-toast';



export default function UsersPage() {
  const { user, userClaims, refreshUserData } = useAuth();
  const { checkPermission, loading: permissionsLoading } = usePermissions();
  const { createUser: secureCreateUser, updateUserRole: secureUpdateUserRole, updateUserPermissions: secureUpdateUserPermissions, toggleUserDisabled: secureToggleUserDisabled, isLoading: userManagementLoading } = useSecureUserManagement();
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // التحقق من صلاحيات المستخدم
  const hasViewPermission = checkPermission('users.view');

  // نقل دالة fetchUsers خارج useEffect لتصبح متاحة مع useCallback لتحسين الأداء
  const fetchUsers = useCallback(async () => {
      if (!user || !hasViewPermission) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // الحصول على معرف المؤسسة من userClaims
      const organizationId = userClaims?.organizationId;
      const isSystemOwner = userClaims?.isSystemOwner === true;
      const isSystemAdmin = userClaims?.isSystemAdmin === true;
      const isOrgOwner = userClaims?.isOrgOwner === true;
      const isOwner = isSystemOwner || isSystemAdmin || isOrgOwner;

      // استخدام وظائف الباك إند للحصول على المستخدمين
      try {
        setLoading(true);

      if (organizationId) {
        console.log(`Fetching users for organization: ${organizationId}`);

        // استخدام وظيفة getOrganizationMembers للحصول على أعضاء المؤسسة
        const getOrganizationMembersFn = httpsCallable<{ orgId: string }, { members: any[] }>(functions, 'getOrganizationMembers');
        const result = await getOrganizationMembersFn({ orgId: organizationId });

        if (!result.data || !result.data.members) {
          throw new Error('فشل في جلب أعضاء المؤسسة: لم يتم استلام بيانات صحيحة');
        }

        // تحويل البيانات إلى تنسيق ManagedUser
        const orgUsers = result.data.members.map((member: any) => ({
          uid: member.uid,
          email: member.email || '',
          role: member.role || 'isOrgAssistant',
          name: member.name || '',
          disabled: false,
          customPermissions: [],
          hasAdminAccess: member.role === 'isSystemAdmin' || member.role === 'isSystemOwner' ||
                         member.role === 'isOrgOwner' || member.role === 'isOrgAdmin',
          accountType: 'organization' as SystemType,
          organizationId
        }));

        setUsers(orgUsers);
      } else if (isOwner) {
        console.log('Fetching all users (owner view)');

        // استخدام وظيفة listFirebaseUsers للحصول على جميع المستخدمين
        const listFirebaseUsersFn = httpsCallable<{}, { users: any[] }>(functions, 'listFirebaseUsers');
        const result = await listFirebaseUsersFn({});

        if (!result.data || !result.data.users) {
          throw new Error('فشل في جلب قائمة المستخدمين: لم يتم استلام بيانات صحيحة');
        }

        // جلب جميع المستخدمين من Firestore مرة واحدة لتحسين الأداء
        const firestoreUsersSnapshot = await getDocs(collection(db, 'users'));
        const firestoreUsersMap = new Map();
        firestoreUsersSnapshot.docs.forEach(doc => {
          const userData = doc.data();
          if (userData.email) {
            firestoreUsersMap.set(userData.email, userData);
          }
        });

        // تحويل البيانات إلى تنسيق ManagedUser
        const allUsers = result.data.users.map((user: any) => {
          let userRole: UserRole = 'isIndependent'; // الافتراضي

          // أولاً: البحث في Firestore
          const firestoreUser = firestoreUsersMap.get(user.email);
          if (firestoreUser && firestoreUser.role) {
            userRole = firestoreUser.role as UserRole;
          } else {
            // ثانياً: استخدم customClaims كبديل
            if (user.customClaims?.role) {
              userRole = user.customClaims.role as UserRole;
            } else if (user.customClaims?.isSystemOwner) {
              userRole = 'isSystemOwner';
            } else if (user.customClaims?.isSystemAdmin) {
              userRole = 'isSystemAdmin';
            } else if (user.customClaims?.isOrgOwner) {
              userRole = 'isOrgOwner';
            } else if (user.customClaims?.isOrgAdmin) {
              userRole = 'isOrgAdmin';
            }
          }

          return {
            uid: user.uid,
            email: user.email || '',
            role: userRole,
            name: user.displayName || firestoreUser?.name || '',
            disabled: user.disabled || false,
            customPermissions: user.customClaims?.customPermissions || [],
            hasAdminAccess: user.customClaims?.isSystemAdmin === true || user.customClaims?.isSystemOwner === true ||
                           user.customClaims?.isOrgOwner === true || user.customClaims?.isOrgAdmin === true,
            accountType: (user.customClaims?.accountType as SystemType) || 'individual',
            organizationId: user.customClaims?.organizationId
          };
        });

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
    }, [user, hasViewPermission, userClaims, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const handleDeleteUser = (user: ManagedUser) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleUserDeleted = () => {
    // إعادة تحميل قائمة المستخدمين
    fetchUsers();
    setUserToDelete(null);
  };

  const handleCreateUser = async (userData: any) => {
    const result = await secureCreateUser(userData);

    if (result.success) {
      // إعادة تحميل قائمة المستخدمين
      await fetchUsers();
      setShowCreateDialog(false);
    }

    // الأخطاء يتم التعامل معها في Hook
  };

  const handleUpdateUser = async (userId: string, userData: any) => {
    const isCurrentUser = userId === user?.uid;
    let result;

    try {
      // تحديد نوع التحديث واستدعاء الدالة المناسبة
      if ('role' in userData) {
        result = await secureUpdateUserRole(userId, userData.role);

        // إذا كان تحديث للدور وكان المستخدم الحالي هو نفسه الذي تم تحديث دوره
        if (result.success && isCurrentUser) {
          console.log("[UsersPage] Current user role updated, refreshing user data");
          await refreshUserData();
        }
      } else if ('customPermissions' in userData) {
        result = await secureUpdateUserPermissions(userId, userData.customPermissions);
      } else if ('disabled' in userData) {
        result = await secureToggleUserDisabled(userId, userData.disabled);
      } else {
        toast({
          title: 'خطأ في البيانات',
          description: 'نوع التحديث غير مدعوم.',
          variant: 'destructive',
        });
        return;
      }

      if (result.success) {
        // تحديث المستخدم المحدد إذا كان هو نفسه الذي تم تحديثه
        if (selectedUser && selectedUser.uid === userId) {
          setSelectedUser({ ...selectedUser, ...userData });
        }

        // إعادة تحميل قائمة المستخدمين
        await fetchUsers();
      }

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
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/diagnostics">
              <Settings className="ml-2 h-4 w-4" />
              تشخيص المشاكل
            </Link>
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="flex items-center">
            <UserPlus className="ml-2 h-4 w-4" />
            إضافة مستخدم
          </Button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          لا يوجد مستخدمين
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.uid} className="hover:bg-accent/10">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="cursor-pointer flex-1" onClick={() => handleUserClick(user)}>
                  <h3 className="font-medium">{user.email}</h3>
                  <p className="text-sm text-muted-foreground">
                    <Translate text={`roles.${user.role}`} defaultValue={user.role} />
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleUserClick(user)}>
                    عرض التفاصيل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUser(user);
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    حذف
                  </Button>
                </div>
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
        loading={userManagementLoading}
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
          onUserDeleted={handleUserDeleted}
          loading={userManagementLoading}
        />
      )}

      {/* مربع حوار حذف المستخدم */}
      <DeleteUserDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        user={userToDelete ? {
          uid: userToDelete.uid,
          name: userToDelete.name || userToDelete.email || 'مستخدم غير معروف',
          email: userToDelete.email || '',
          role: userToDelete.role,
          accountType: userToDelete.accountType,
          organizationId: userToDelete.organizationId
        } : null}
        onUserDeleted={handleUserDeleted}
      />
    </div>
  );
}
