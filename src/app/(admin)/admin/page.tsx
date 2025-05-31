'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UserCog,
  Users,
  Database,
  FileText,
  Building,
  Settings,
  Shield,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  pendingRequests: number;
  systemHealth: 'healthy' | 'warning' | 'error';
}

export default function AdminDashboard() {
  const { user, userClaims } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalOrganizations: 0,
    pendingRequests: 0,
    systemHealth: 'healthy'
  });
  const [loading, setLoading] = useState(true);

  // التحقق من صلاحيات المستخدم (النظام الجديد فقط)
  const isSystemOwner = userClaims?.system_owner === true;
  const isSystemAdmin = userClaims?.system_admin === true;
  const isOrgOwner = userClaims?.org_owner === true;
  const isIndividualAdmin = userClaims?.individual_admin === true;
  const canViewUsers = hasPermission('users.view') || isSystemOwner || isSystemAdmin || isOrgOwner || isIndividualAdmin;
  const canManageData = hasPermission('data.view') || isSystemOwner || isSystemAdmin;

  // جلب إحصائيات النظام
  useEffect(() => {
    const fetchStats = async () => {
      if (!user || (!isSystemOwner && !isSystemAdmin && !isOrgOwner && !isIndividualAdmin)) {
        setLoading(false);
        return;
      }

      try {
        // جلب عدد المستخدمين (تقريبي من Firestore)
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnapshot.size;

        // جلب عدد المؤسسات
        const orgsSnapshot = await getDocs(collection(db, 'organizations'));
        const totalOrganizations = orgsSnapshot.size;

        // جلب الطلبات المعلقة
        const pendingRequestsQuery = query(
          collection(db, 'organizationRequests'),
          where('status', '==', 'pending')
        );
        const pendingSnapshot = await getDocs(pendingRequestsQuery);
        const pendingRequests = pendingSnapshot.size;

        setStats({
          totalUsers,
          totalOrganizations,
          pendingRequests,
          systemHealth: pendingRequests > 10 ? 'warning' : 'healthy'
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        toast({
          title: 'خطأ في جلب الإحصائيات',
          description: 'حدث خطأ أثناء جلب إحصائيات النظام',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, isSystemOwner, isSystemAdmin, toast]);

  // عرض حالة التحميل
  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getHealthIcon = () => {
    switch (stats.systemHealth) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getHealthText = () => {
    switch (stats.systemHealth) {
      case 'healthy':
        return 'النظام يعمل بشكل طبيعي';
      case 'warning':
        return 'يوجد تحذيرات في النظام';
      case 'error':
        return 'يوجد أخطاء في النظام';
      default:
        return 'حالة النظام غير معروفة';
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <UserCog className="ml-3 h-8 w-8" />
            لوحة تحكم المسؤول
          </h1>
          <p className="text-muted-foreground mt-1">
            مرحباً {userClaims?.name || user?.email} - إدارة النظام والمستخدمين
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getHealthIcon()}
          <span className="text-sm text-muted-foreground">{getHealthText()}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المستخدمين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">مستخدم مسجل في النظام</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المؤسسات</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrganizations}</div>
            <p className="text-xs text-muted-foreground">مؤسسة مسجلة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الطلبات المعلقة</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">طلب إنشاء مؤسسة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">حالة النظام</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getHealthIcon()}
              <span className="text-sm font-medium">
                {stats.systemHealth === 'healthy' ? 'سليم' :
                 stats.systemHealth === 'warning' ? 'تحذير' : 'خطأ'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{getHealthText()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {canViewUsers && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="ml-2 h-5 w-5" />
                إدارة المستخدمين
              </CardTitle>
              <CardDescription>
                عرض وإدارة جميع المستخدمين في النظام
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/users">
                  عرض المستخدمين
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(isSystemOwner || isSystemAdmin) && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="ml-2 h-5 w-5" />
                إدارة المؤسسات
              </CardTitle>
              <CardDescription>
                إدارة المؤسسات وطلبات الإنشاء
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button asChild className="w-full" variant="outline">
                  <Link href="/admin/organization">
                    إدارة المؤسسات
                  </Link>
                </Button>
                <Button asChild className="w-full">
                  <Link href="/admin/organization-requests">
                    طلبات الإنشاء
                    {stats.pendingRequests > 0 && (
                      <Badge variant="destructive" className="mr-2">
                        {stats.pendingRequests}
                      </Badge>
                    )}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {canManageData && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="ml-2 h-5 w-5" />
                إدارة البيانات
              </CardTitle>
              <CardDescription>
                تصدير واستيراد بيانات النظام
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/admin/data-management">
                  إدارة البيانات
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(isSystemOwner || isSystemAdmin) && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="ml-2 h-5 w-5" />
                سجلات النظام
              </CardTitle>
              <CardDescription>
                عرض سجلات النشاط والأخطاء
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/logs">
                  عرض السجلات
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(isSystemOwner || isSystemAdmin) && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="ml-2 h-5 w-5" />
                التقارير والإحصائيات
              </CardTitle>
              <CardDescription>
                عرض تقارير مفصلة عن النظام
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" disabled>
                قريباً
              </Button>
            </CardContent>
          </Card>
        )}

        {isSystemOwner && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="ml-2 h-5 w-5" />
                إعدادات النظام
              </CardTitle>
              <CardDescription>
                إعدادات عامة ومتقدمة للنظام
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" disabled>
                قريباً
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* System Status */}
      {stats.pendingRequests > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-800">
              <AlertTriangle className="ml-2 h-5 w-5" />
              تنبيه: يوجد طلبات معلقة
            </CardTitle>
            <CardDescription className="text-yellow-700">
              يوجد {stats.pendingRequests} طلب إنشاء مؤسسة في انتظار المراجعة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100">
              <Link href="/admin/organization-requests">
                مراجعة الطلبات
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
