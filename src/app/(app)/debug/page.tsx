'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAccountType } from '@/hooks/useAccountType';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Bug, RefreshCw, ShieldAlert, Search, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserRole, PermissionKey, DEFAULT_ROLE_PERMISSIONS } from '@/types/roles';
import { UserDetailsDialog } from '@/components/admin/UserDetailsDialog';
import { ManagedUser } from '@/types/user';
import { PermissionsCheckboxGrid } from '@/components/PermissionsCheckboxGrid';
import { DebugAuthDialog } from '@/components/debug/DebugAuthDialog';

export default function DebugPage() {
  const { user, userClaims, refreshUserData } = useAuth();
  const { role, permissions, loading: permissionsLoading } = usePermissions();
  const { accountType, isLoading: accountTypeLoading } = useAccountType();
  const router = useRouter();
  const { toast } = useToast();

  // حالة التحقق المتعدد العوامل
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false);

  // التحقق من أن المستخدم هو مالك التطبيق فقط
  const isOwner = userClaims?.owner === true;

  // تسجيل نشاط الوصول إلى الصفحة
  const logActivity = async (action: string) => {
    try {
      await fetch('/api/debug/log-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('فشل تسجيل النشاط:', error);
    }
  };

  // التحقق من انتهاء صلاحية الجلسة
  useEffect(() => {
    if (user && isOwner) {
      // التحقق من وجود وقت انتهاء الصلاحية في التخزين المحلي
      const expiryTime = localStorage.getItem('debugAuthExpiry');

      if (expiryTime) {
        // التحقق مما إذا كان الوقت الحالي أقل من وقت انتهاء الصلاحية
        if (Date.now() < parseInt(expiryTime)) {
          setIsAuthenticated(true);
          // تسجيل نشاط الوصول إلى الصفحة
          logActivity('تم الوصول إلى صفحة التشخيص (جلسة سارية)');
        } else {
          // انتهت صلاحية الجلسة، عرض مربع حوار التحقق
          setShowAuthDialog(true);
          // حذف وقت انتهاء الصلاحية من التخزين المحلي
          localStorage.removeItem('debugAuthExpiry');
        }
      } else {
        // لا يوجد وقت انتهاء صلاحية، عرض مربع حوار التحقق
        setShowAuthDialog(true);
      }
    }
  }, [user, isOwner]);

  // إعادة توجيه المستخدم إذا لم يكن مالكًا
  useEffect(() => {
    if (user && userClaims && !isOwner) {
      toast({
        title: 'غير مصرح',
        description: 'ليس لديك صلاحية الوصول إلى هذه الصفحة، هذه الصفحة متاحة لمالك التطبيق فقط',
        variant: 'destructive',
      });
      router.push('/');
    }
  }, [user, userClaims, isOwner, router, toast]);

  const handleRefresh = async () => {
    if (user) {
      try {
        await refreshUserData();
        window.location.reload();
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  // حالة لتخزين معرف المستخدم المحدد
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.uid || '');
  const [selectedUserRole, setSelectedUserRole] = useState<string>('independent');
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<string[]>(['tools:view', 'tools:create', 'tools:edit']);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

  // متغيرات الحالة لمكون UserDetailsDialog
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  // تحويل بيانات المستخدم إلى تنسيق ManagedUser
  const convertToManagedUser = (doc: any, userData: any, isIndividual: boolean = false): ManagedUser => {
    return {
      uid: doc.id,
      email: userData.email || 'بدون بريد إلكتروني',
      name: userData.displayName || userData.name || 'بدون اسم',
      role: userData.role || (isIndividual ? 'independent' : 'user'),
      accountType: isIndividual ? 'individual' : 'organization',
      organizationId: userData.organizationId,
      departmentId: userData.departmentId,
      customPermissions: userData.customPermissions || [],
      isAdmin: userData.role === 'admin' || userData.role === 'owner',
      disabled: userData.disabled || false,
      createdAt: userData.createdAt,
      lastLogin: userData.lastLogin
    };
  };

  // جلب قائمة المستخدمين
  const fetchUsers = async () => {
    if (!user) return;

    setLoadingUsers(true);
    try {
      // جلب المستخدمين من مجموعة users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const managedUsers: ManagedUser[] = [];

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        managedUsers.push(convertToManagedUser(doc, userData));
      });

      // جلب المستخدمين من مجموعة individuals
      const individualsSnapshot = await getDocs(collection(db, 'individuals'));

      individualsSnapshot.forEach((doc) => {
        // التحقق مما إذا كان المستخدم موجودًا بالفعل في المصفوفة
        if (!managedUsers.some(u => u.uid === doc.id)) {
          const userData = doc.data();
          managedUsers.push(convertToManagedUser(doc, userData, true));
        }
      });

      setUsersList(managedUsers);
      console.log('Fetched users:', managedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء جلب قائمة المستخدمين',
        variant: 'destructive',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  // جلب المستخدمين عند تحميل الصفحة
  useEffect(() => {
    if (isOwner && user) {
      fetchUsers();
    }
  }, [isOwner, user]);

  // تحديث صلاحيات المستخدم المحدد
  const handleUpdatePermissions = async (userId: string, permissions: PermissionKey[]) => {
    if (!user || !userId) {
      toast({
        title: 'خطأ',
        description: 'يرجى تحديد مستخدم أولاً',
        variant: 'destructive',
      });
      return;
    }

    try {
      // تسجيل نشاط محاولة تحديث الصلاحيات
      await logActivity(`محاولة تحديث صلاحيات المستخدم: ${userId}`);

      const response = await fetch('/api/update-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          permissions: permissions
        }),
      });

      if (response.ok) {
        // تسجيل نشاط نجاح تحديث الصلاحيات
        await logActivity(`تم تحديث صلاحيات المستخدم بنجاح: ${userId}`);

        toast({
          title: 'تم بنجاح',
          description: 'تم تحديث صلاحيات المستخدم بنجاح',
          variant: 'default',
        });

        // إذا كان المستخدم المحدد هو المستخدم الحالي، قم بتحديث البيانات
        if (userId === user.uid) {
          await refreshUserData();
          window.location.reload();
        } else {
          // تحديث قائمة المستخدمين
          fetchUsers();
        }
      } else {
        const data = await response.json();

        // تسجيل نشاط فشل تحديث الصلاحيات
        await logActivity(`فشل تحديث صلاحيات المستخدم: ${userId} - ${data.error}`);

        toast({
          title: 'خطأ',
          description: `فشل تحديث الصلاحيات: ${data.error}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating permissions:', error);

      // تسجيل نشاط حدوث خطأ أثناء تحديث الصلاحيات
      await logActivity(`خطأ أثناء تحديث صلاحيات المستخدم: ${userId} - ${error}`);

      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث الصلاحيات',
        variant: 'destructive',
      });
    }
  };

  // تحديث دور المستخدم
  const handleUpdateRole = async (userId: string, role: UserRole) => {
    if (!user || !userId) {
      toast({
        title: 'خطأ',
        description: 'يرجى تحديد مستخدم أولاً',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/update-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          role: role
        }),
      });

      if (response.ok) {
        toast({
          title: 'تم بنجاح',
          description: 'تم تحديث دور المستخدم بنجاح',
          variant: 'default',
        });

        // إذا كان المستخدم المحدد هو المستخدم الحالي، قم بتحديث البيانات
        if (userId === user.uid) {
          await refreshUserData();
          window.location.reload();
        } else {
          // تحديث قائمة المستخدمين
          fetchUsers();
        }
      } else {
        const data = await response.json();
        toast({
          title: 'خطأ',
          description: `فشل تحديث دور المستخدم: ${data.error}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث دور المستخدم',
        variant: 'destructive',
      });
    }
  };

  // تعطيل/تفعيل المستخدم
  const handleToggleDisabled = async (userId: string, disabled: boolean) => {
    if (!user || !userId) {
      toast({
        title: 'خطأ',
        description: 'يرجى تحديد مستخدم أولاً',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/update-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          disabled: disabled
        }),
      });

      if (response.ok) {
        toast({
          title: 'تم بنجاح',
          description: `تم ${disabled ? 'تعطيل' : 'تفعيل'} المستخدم بنجاح`,
          variant: 'default',
        });

        // تحديث قائمة المستخدمين
        fetchUsers();
      } else {
        const data = await response.json();
        toast({
          title: 'خطأ',
          description: `فشل ${disabled ? 'تعطيل' : 'تفعيل'} المستخدم: ${data.error}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error toggling user disabled status:', error);
      toast({
        title: 'خطأ',
        description: `حدث خطأ أثناء ${disabled ? 'تعطيل' : 'تفعيل'} المستخدم`,
        variant: 'destructive',
      });
    }
  };

  // فتح مربع حوار تفاصيل المستخدم
  const openUserDetailsDialog = (user: ManagedUser) => {
    setSelectedUser(user);
    setShowUserDetailsDialog(true);
  };

  // إذا كان المستخدم ليس مالك التطبيق، نعرض رسالة تحميل فقط
  if (!isOwner && user) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <ShieldAlert className="ml-2 h-5 w-5" />
              غير مصرح
            </CardTitle>
            <CardDescription>
              هذه الصفحة متاحة فقط لمالك التطبيق
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>جاري إعادة توجيهك...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // عرض مربع حوار التحقق إذا لم يكن المستخدم مصادقًا
  if (isOwner && !isAuthenticated) {
    return (
      <>
        <DebugAuthDialog
          isOpen={showAuthDialog}
          onAuthenticated={() => {
            setIsAuthenticated(true);
            setShowAuthDialog(false);
            logActivity('تم المصادقة والدخول إلى صفحة التشخيص');
          }}
        />
        <div className="container mx-auto p-4">
          <Card className="border-warning">
            <CardHeader>
              <CardTitle className="flex items-center text-warning">
                <ShieldAlert className="ml-2 h-5 w-5" />
                جاري التحقق من الهوية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>يرجى إدخال كلمة المرور للوصول إلى صفحة التشخيص...</p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-4 border-warning bg-warning/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-warning">
            <ShieldAlert className="ml-2 h-5 w-5" />
            تنبيه أمني
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>هذه الصفحة متاحة فقط لمالك التطبيق وتحتوي على معلومات حساسة. يرجى عدم مشاركة هذه المعلومات مع أي شخص.</p>
          <div className="mt-2 flex items-center text-sm text-muted-foreground">
            <Clock className="ml-1 h-4 w-4" />
            <span>
              ستنتهي صلاحية الجلسة بعد{' '}
              {(() => {
                const expiryTime = localStorage.getItem('debugAuthExpiry');
                if (expiryTime) {
                  const remainingTime = parseInt(expiryTime) - Date.now();
                  const remainingMinutes = Math.max(0, Math.floor(remainingTime / (1000 * 60)));
                  return `${remainingMinutes} دقيقة`;
                }
                return '30 دقيقة';
              })()}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Bug className="ml-2 h-6 w-6" />
          صفحة التشخيص
        </h1>
        <div className="flex gap-2">
          <Button onClick={fetchUsers} variant="outline">
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث قائمة المستخدمين
          </Button>
          <Button onClick={handleRefresh}>
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* قسم إدارة المستخدمين */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>إدارة المستخدمين</CardTitle>
          <CardDescription>عرض وتعديل صلاحيات المستخدمين</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* قائمة المستخدمين */}
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-medium mb-2">قائمة المستخدمين</h3>

              {/* خانة البحث عن مستخدم محدد */}
              <div className="mb-4">
                <Label htmlFor="user-id" className="mb-1 block">إدخال معرف المستخدم مباشرة</Label>
                <div className="flex gap-2">
                  <Input
                    id="user-id"
                    placeholder="أدخل معرف المستخدم (UID)"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // البحث عن المستخدم في القائمة
                      const foundUser = usersList.find(u => u.id === selectedUserId);
                      if (foundUser) {
                        setSelectedUserRole(foundUser.role || 'independent');
                        setSelectedUserPermissions(foundUser.customPermissions || []);
                        toast({
                          title: 'تم العثور على المستخدم',
                          description: `تم تحديد المستخدم: ${foundUser.displayName || foundUser.email}`,
                        });
                      } else {
                        // إذا لم يتم العثور على المستخدم، نستخدم القيم الافتراضية
                        setSelectedUserRole('independent');
                        setSelectedUserPermissions(['tools:view', 'tools:create', 'tools:edit']);
                        toast({
                          title: 'لم يتم العثور على المستخدم',
                          description: 'سيتم استخدام القيم الافتراضية. يمكنك المتابعة لإنشاء سجل جديد لهذا المستخدم.',
                          variant: 'warning',
                        });
                      }
                    }}
                  >
                    بحث
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  أدخل معرف المستخدم (UID) للبحث عنه مباشرة أو اختر من القائمة أدناه
                </p>
              </div>

              {loadingUsers ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : usersList.length === 0 ? (
                <p className="text-muted-foreground">لا يوجد مستخدمين</p>
              ) : (
                <ScrollArea className="h-60">
                  <div className="space-y-2">
                    {usersList.map((user) => (
                      <div
                        key={user.uid}
                        className={`p-2 border rounded-md cursor-pointer hover:bg-accent ${selectedUserId === user.uid ? 'bg-accent' : ''}`}
                        onClick={() => {
                          setSelectedUserId(user.uid);
                          setSelectedUserRole(user.role || 'independent');
                          setSelectedUserPermissions(user.customPermissions || []);
                          // فتح مربع حوار تفاصيل المستخدم
                          openUserDetailsDialog(user);
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{user.name || 'بدون اسم'}</p>
                            <p className="text-xs text-muted-foreground">البريد: {user.email}</p>
                            <p className="text-xs text-muted-foreground">المعرف: {user.uid}</p>
                          </div>
                          <Badge variant="outline">{user.role}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* تعديل صلاحيات المستخدم */}
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-medium mb-4">تعديل صلاحيات المستخدم</h3>

              {selectedUserId ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-role">الدور</Label>
                    <Select
                      value={selectedUserRole}
                      onValueChange={setSelectedUserRole}
                    >
                      <SelectTrigger id="user-role">
                        <SelectValue placeholder="اختر الدور" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="independent">مستخدم مستقل</SelectItem>
                        <SelectItem value="user">مستخدم عادي</SelectItem>
                        <SelectItem value="admin">مسؤول</SelectItem>
                        <SelectItem value="owner">مالك</SelectItem>
                        <SelectItem value="individual_admin">مسؤول نظام الأفراد</SelectItem>
                        <SelectItem value="engineer">مهندس</SelectItem>
                        <SelectItem value="supervisor">مشرف</SelectItem>
                        <SelectItem value="technician">فني</SelectItem>
                        <SelectItem value="assistant">مساعد فني</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label>الصلاحيات</Label>
                    <PermissionsCheckboxGrid
                      permissions={selectedUserPermissions as PermissionKey[]}
                      onPermissionsChange={(permissions) => setSelectedUserPermissions(permissions)}
                    />
                  </div>

                  <Button
                    onClick={() => handleUpdatePermissions(selectedUserId, selectedUserPermissions as PermissionKey[])}
                    className="w-full"
                  >
                    تحديث صلاحيات المستخدم
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">يرجى تحديد مستخدم من القائمة</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>معلومات المستخدم</CardTitle>
            <CardDescription>معلومات أساسية عن المستخدم الحالي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user ? (
              <>
                <div>
                  <p className="font-semibold">معرف المستخدم:</p>
                  <p className="text-sm bg-muted p-2 rounded">{user.uid}</p>
                </div>
                <div>
                  <p className="font-semibold">البريد الإلكتروني:</p>
                  <p className="text-sm">{user.email}</p>
                </div>
                <div>
                  <p className="font-semibold">الاسم:</p>
                  <p className="text-sm">{user.displayName || 'غير محدد'}</p>
                </div>
                <div>
                  <p className="font-semibold">حالة التحقق من البريد الإلكتروني:</p>
                  <Badge variant={user.emailVerified ? 'default' : 'destructive'}>
                    {user.emailVerified ? 'تم التحقق' : 'لم يتم التحقق'}
                  </Badge>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center p-4">
                <AlertCircle className="ml-2 h-5 w-5 text-destructive" />
                <p>لم يتم تسجيل الدخول</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>معلومات الحساب</CardTitle>
            <CardDescription>معلومات عن نوع الحساب والدور</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold">نوع الحساب:</p>
              <Badge variant="outline" className="text-sm">
                {accountTypeLoading ? 'جاري التحميل...' : accountType === 'individual' ? 'فردي' : accountType === 'organization' ? 'مؤسسة' : 'غير محدد'}
              </Badge>
            </div>
            <div>
              <p className="font-semibold">الدور:</p>
              <Badge variant="outline" className="text-sm">
                {permissionsLoading ? 'جاري التحميل...' : role}
              </Badge>
            </div>
            <div>
              <p className="font-semibold">معلومات إضافية (Claims):</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(userClaims, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>الصلاحيات</CardTitle>
          <CardDescription>قائمة بجميع الصلاحيات المتاحة للمستخدم</CardDescription>
        </CardHeader>
        <CardContent>
          {permissionsLoading ? (
            <p>جاري تحميل الصلاحيات...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-2">الصلاحيات:</p>
                <div className="flex flex-wrap gap-2">
                  {permissions.length > 0 ? (
                    permissions.map((permission, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {permission}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">لا توجد صلاحيات</p>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <p className="font-semibold mb-2">اختبار الصلاحيات:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Badge variant={permissions.includes('tools:view') ? 'default' : 'destructive'}>
                      {permissions.includes('tools:view') ? 'متاح' : 'غير متاح'}
                    </Badge>
                    <span className="text-sm">tools:view</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Badge variant={permissions.includes('tools:create') ? 'default' : 'destructive'}>
                      {permissions.includes('tools:create') ? 'متاح' : 'غير متاح'}
                    </Badge>
                    <span className="text-sm">tools:create</span>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Badge variant={permissions.includes('tools:edit') ? 'default' : 'destructive'}>
                      {permissions.includes('tools:edit') ? 'متاح' : 'غير متاح'}
                    </Badge>
                    <span className="text-sm">tools:edit</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* مربع حوار تفاصيل المستخدم */}
      {selectedUser && (
        <UserDetailsDialog
          isOpen={showUserDetailsDialog}
          onOpenChange={setShowUserDetailsDialog}
          user={selectedUser}
          onUpdateRole={handleUpdateRole}
          onUpdatePermissions={handleUpdatePermissions}
          onToggleDisabled={handleToggleDisabled}
          loading={loadingUsers}
        />
      )}
    </div>
  );
}
