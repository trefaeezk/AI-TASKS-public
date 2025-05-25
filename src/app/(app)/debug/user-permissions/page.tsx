'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  User, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Settings,
  Database
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function UserPermissionsDebugPage() {
  const { user, userClaims, loading: authLoading, refreshUserData } = useAuth();
  const { role, hasPermission, checkRole, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  // قائمة الصلاحيات للاختبار
  const testPermissions = [
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'data.view',
    'data.create',
    'settings.view',
    'settings.edit',
    'tasks.view',
    'tasks.create',
    'reports.view'
  ];

  // قائمة الأدوار للاختبار
  const testRoles = [
    'system_owner',
    'system_admin',
    'organization_owner',
    'admin',
    'supervisor',
    'engineer',
    'technician',
    'assistant',
    'independent'
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUserData(true); // Force refresh
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث بيانات المستخدم بنجاح',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error refreshing user data:', error);
      toast({
        title: 'خطأ في التحديث',
        description: 'حدث خطأ أثناء تحديث بيانات المستخدم',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (authLoading || permissionsLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <XCircle className="ml-2 h-5 w-5" />
              غير مسجل الدخول
            </CardTitle>
            <CardDescription>
              يجب تسجيل الدخول لعرض معلومات الصلاحيات
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <Shield className="ml-3 h-8 w-8" />
            تشخيص صلاحيات المستخدم
          </h1>
          <p className="text-muted-foreground mt-1">
            فحص مفصل لصلاحيات وأدوار المستخدم الحالي
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث البيانات
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="ml-2 h-5 w-5" />
              معلومات المستخدم
            </CardTitle>
            <CardDescription>
              البيانات الأساسية للمستخدم الحالي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">البريد الإلكتروني:</span>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div>
              <span className="font-medium">معرف المستخدم:</span>
              <p className="text-sm text-muted-foreground font-mono">{user.uid}</p>
            </div>
            <div>
              <span className="font-medium">الدور الحالي:</span>
              <Badge variant="outline" className="mr-2">{role}</Badge>
            </div>
            <div>
              <span className="font-medium">نوع الحساب:</span>
              <Badge variant="secondary" className="mr-2">
                {userClaims?.accountType || 'غير محدد'}
              </Badge>
            </div>
            {userClaims?.organizationId && (
              <div>
                <span className="font-medium">معرف المؤسسة:</span>
                <p className="text-sm text-muted-foreground font-mono">{userClaims.organizationId}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claims Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="ml-2 h-5 w-5" />
              Custom Claims
            </CardTitle>
            <CardDescription>
              الصلاحيات المخزنة في Firebase Auth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userClaims ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(userClaims).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="font-medium">{key}:</span>
                      <Badge 
                        variant={value === true ? "default" : value === false ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {String(value)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد claims متاحة</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permission Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="ml-2 h-5 w-5" />
              اختبار الصلاحيات
            </CardTitle>
            <CardDescription>
              فحص الصلاحيات المختلفة للمستخدم
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testPermissions.map((permission) => {
                const hasAccess = hasPermission(permission);
                return (
                  <div key={permission} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{permission}</span>
                    <div className="flex items-center">
                      {hasAccess ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge 
                        variant={hasAccess ? "default" : "secondary"}
                        className="mr-2 text-xs"
                      >
                        {hasAccess ? 'مسموح' : 'مرفوض'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Role Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="ml-2 h-5 w-5" />
              اختبار الأدوار
            </CardTitle>
            <CardDescription>
              فحص مستوى الدور مقارنة بالأدوار الأخرى
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testRoles.map((testRole) => {
                const hasRoleAccess = checkRole(testRole as any);
                return (
                  <div key={testRole} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{testRole}</span>
                    <div className="flex items-center">
                      {hasRoleAccess ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge 
                        variant={hasRoleAccess ? "default" : "secondary"}
                        className="mr-2 text-xs"
                      >
                        {hasRoleAccess ? 'أعلى/مساوي' : 'أقل'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="ml-2 h-5 w-5" />
            حالة النظام
          </CardTitle>
          <CardDescription>
            معلومات إضافية عن حالة النظام والصلاحيات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {hasPermission('users.view') ? '✅' : '❌'}
              </div>
              <p className="text-sm text-muted-foreground">وصول المستخدمين</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {hasPermission('data.view') ? '✅' : '❌'}
              </div>
              <p className="text-sm text-muted-foreground">إدارة البيانات</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {checkRole('admin' as any) ? '✅' : '❌'}
              </div>
              <p className="text-sm text-muted-foreground">صلاحيات إدارية</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
