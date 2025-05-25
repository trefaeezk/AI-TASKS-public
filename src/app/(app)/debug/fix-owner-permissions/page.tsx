'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Wrench,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function FixOwnerPermissionsPage() {
  const { user, userClaims, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [fixing, setFixing] = useState(false);
  const [checking, setChecking] = useState(false);

  // تحليل حالة الصلاحيات الحالية
  const analyzePermissions = () => {
    if (!userClaims) return { status: 'unknown', issues: ['لا توجد claims متاحة'] };

    const issues = [];
    const hasSystemOwner = userClaims.system_owner === true;
    const hasLegacyOwner = userClaims.owner === true;
    const hasSystemAdmin = userClaims.system_admin === true;
    const hasLegacyAdmin = userClaims.admin === true;

    // فحص الصلاحيات المطلوبة لمالك النظام
    if (!hasSystemOwner && !hasLegacyOwner) {
      issues.push('لا يوجد صلاحية مالك النظام (system_owner أو owner)');
    }

    if (!userClaims.role || (userClaims.role !== 'system_owner' && userClaims.role !== 'owner')) {
      issues.push('الدور (role) غير صحيح - يجب أن يكون system_owner');
    }

    if (userClaims.accountType !== 'individual') {
      issues.push('نوع الحساب يجب أن يكون individual');
    }

    // فحص التضارب في الأدوار
    const roleCount = [hasSystemOwner, hasLegacyOwner, hasSystemAdmin, hasLegacyAdmin].filter(Boolean).length;
    if (roleCount > 2) {
      issues.push('يوجد تضارب في الأدوار - أكثر من دور واحد مفعل');
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'issues',
      issues,
      hasSystemOwner,
      hasLegacyOwner,
      hasSystemAdmin,
      hasLegacyAdmin
    };
  };

  const analysis = analyzePermissions();

  // إصلاح صلاحيات مالك النظام
  const fixOwnerPermissions = async () => {
    if (!user) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول أولاً',
        variant: 'destructive',
      });
      return;
    }

    setFixing(true);
    try {
      const functions = getFunctions();
      
      // استدعاء Cloud Function لإصلاح الصلاحيات
      const fixPermissionsFn = httpsCallable(functions, 'fixUserPermissions');
      
      const result = await fixPermissionsFn({
        uid: user.uid,
        targetRole: 'system_owner',
        accountType: 'individual'
      });

      console.log('Fix permissions result:', result);

      // تحديث البيانات المحلية
      await refreshUserData(true);

      toast({
        title: 'تم الإصلاح بنجاح',
        description: 'تم إصلاح صلاحيات مالك النظام بنجاح',
        variant: 'default',
      });

    } catch (error: any) {
      console.error('Error fixing permissions:', error);
      toast({
        title: 'فشل في الإصلاح',
        description: error.message || 'حدث خطأ أثناء إصلاح الصلاحيات',
        variant: 'destructive',
      });
    } finally {
      setFixing(false);
    }
  };

  // فحص الوصول للصفحات المختلفة
  const checkPageAccess = async () => {
    setChecking(true);
    try {
      const pagesToCheck = [
        '/admin',
        '/admin/users',
        '/admin/data-management',
        '/admin/organization-requests'
      ];

      const results = [];
      for (const page of pagesToCheck) {
        try {
          const response = await fetch(page, { method: 'HEAD' });
          results.push({
            page,
            status: response.status,
            accessible: response.status !== 404 && response.status !== 403
          });
        } catch (error) {
          results.push({
            page,
            status: 'error',
            accessible: false
          });
        }
      }

      console.log('Page access results:', results);
      
      toast({
        title: 'تم فحص الصفحات',
        description: `تم فحص ${results.length} صفحة`,
        variant: 'default',
      });

    } catch (error) {
      console.error('Error checking page access:', error);
      toast({
        title: 'خطأ في الفحص',
        description: 'حدث خطأ أثناء فحص الوصول للصفحات',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4" dir="rtl">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>غير مسجل الدخول</AlertTitle>
          <AlertDescription>
            يجب تسجيل الدخول لاستخدام أدوات إصلاح الصلاحيات
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <Wrench className="ml-3 h-8 w-8" />
          إصلاح صلاحيات مالك النظام
        </h1>
        <p className="text-muted-foreground mt-1">
          أدوات تشخيص وإصلاح مشاكل الوصول لصفحات المسؤول
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="ml-2 h-5 w-5" />
            حالة الصلاحيات الحالية
          </CardTitle>
          <CardDescription>
            تحليل الصلاحيات والأدوار الحالية للمستخدم
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className="font-medium">الحالة العامة:</span>
              <Badge 
                variant={analysis.status === 'healthy' ? 'default' : 'destructive'}
                className="flex items-center gap-1"
              >
                {analysis.status === 'healthy' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {analysis.status === 'healthy' ? 'سليم' : 'يحتاج إصلاح'}
              </Badge>
            </div>

            {/* Current Claims */}
            <div>
              <span className="font-medium">الصلاحيات الحالية:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant={analysis.hasSystemOwner ? 'default' : 'secondary'}>
                  system_owner: {analysis.hasSystemOwner ? 'نعم' : 'لا'}
                </Badge>
                <Badge variant={analysis.hasLegacyOwner ? 'default' : 'secondary'}>
                  owner: {analysis.hasLegacyOwner ? 'نعم' : 'لا'}
                </Badge>
                <Badge variant={analysis.hasSystemAdmin ? 'default' : 'secondary'}>
                  system_admin: {analysis.hasSystemAdmin ? 'نعم' : 'لا'}
                </Badge>
                <Badge variant={analysis.hasLegacyAdmin ? 'default' : 'secondary'}>
                  admin: {analysis.hasLegacyAdmin ? 'نعم' : 'لا'}
                </Badge>
              </div>
            </div>

            {/* Issues */}
            {analysis.issues.length > 0 && (
              <div>
                <span className="font-medium text-destructive">المشاكل المكتشفة:</span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {analysis.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fix Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="ml-2 h-5 w-5" />
              إصلاح الصلاحيات
            </CardTitle>
            <CardDescription>
              إصلاح صلاحيات مالك النظام تلقائياً
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              سيتم تعيين الصلاحيات التالية:
            </p>
            <ul className="text-sm space-y-1">
              <li>• role: system_owner</li>
              <li>• system_owner: true</li>
              <li>• owner: true (للتوافق)</li>
              <li>• accountType: individual</li>
            </ul>
            <Button 
              onClick={fixOwnerPermissions}
              disabled={fixing || analysis.status === 'healthy'}
              className="w-full"
            >
              <Wrench className={`ml-2 h-4 w-4 ${fixing ? 'animate-spin' : ''}`} />
              {fixing ? 'جاري الإصلاح...' : 'إصلاح الصلاحيات'}
            </Button>
          </CardContent>
        </Card>

        {/* Check Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="ml-2 h-5 w-5" />
              فحص الوصول
            </CardTitle>
            <CardDescription>
              فحص الوصول لصفحات المسؤول المختلفة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              سيتم فحص الوصول للصفحات التالية:
            </p>
            <ul className="text-sm space-y-1">
              <li>• /admin (الصفحة الرئيسية)</li>
              <li>• /admin/users (إدارة المستخدمين)</li>
              <li>• /admin/data-management (إدارة البيانات)</li>
              <li>• /admin/organization-requests (طلبات المؤسسات)</li>
            </ul>
            <Button 
              onClick={checkPageAccess}
              disabled={checking}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`ml-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'جاري الفحص...' : 'فحص الوصول'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>تعليمات الاستخدام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">1. فحص الحالة الحالية:</span>
              <p className="text-muted-foreground">راجع حالة الصلاحيات أعلاه لمعرفة المشاكل الموجودة</p>
            </div>
            <div>
              <span className="font-medium">2. إصلاح الصلاحيات:</span>
              <p className="text-muted-foreground">اضغط على "إصلاح الصلاحيات" لتطبيق الصلاحيات الصحيحة</p>
            </div>
            <div>
              <span className="font-medium">3. فحص الوصول:</span>
              <p className="text-muted-foreground">اضغط على "فحص الوصول" للتأكد من إمكانية الوصول للصفحات</p>
            </div>
            <div>
              <span className="font-medium">4. اختبار الوصول:</span>
              <p className="text-muted-foreground">جرب الوصول إلى <a href="/admin" className="text-primary underline">/admin</a> للتأكد من عمل الإصلاح</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
