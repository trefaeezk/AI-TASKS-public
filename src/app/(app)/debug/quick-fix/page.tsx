'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Wrench,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function QuickFixPage() {
  const { user, userClaims, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [fixing, setFixing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [authClaims, setAuthClaims] = useState<any>(null);

  // جلب Claims مباشرة من Firebase Auth
  const fetchAuthClaims = async () => {
    if (!user) return;
    
    setChecking(true);
    try {
      const idTokenResult = await user.getIdTokenResult(true); // Force refresh
      setAuthClaims(idTokenResult.claims);
      console.log('Direct Auth Claims:', idTokenResult.claims);
    } catch (error) {
      console.error('Error fetching auth claims:', error);
      toast({
        title: 'خطأ في جلب Claims',
        description: 'حدث خطأ أثناء جلب صلاحيات Firebase Auth',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAuthClaims();
    }
  }, [user]);

  // تحليل المشكلة
  const analyzeProblem = () => {
    if (!authClaims) return { status: 'loading', issues: [] };

    const issues = [];
    const hasSystemOwner = authClaims.system_owner === true;
    const hasLegacyOwner = authClaims.owner === true;
    const hasSystemAdmin = authClaims.system_admin === true;
    const hasLegacyAdmin = authClaims.admin === true;

    if (!hasSystemOwner && !hasLegacyOwner) {
      issues.push('❌ لا يوجد صلاحية مالك النظام في Auth Claims');
    }

    if (!authClaims.role || authClaims.role !== 'system_owner') {
      issues.push('❌ الدور في Auth Claims غير صحيح');
    }

    if (authClaims.accountType !== 'individual') {
      issues.push('❌ نوع الحساب في Auth Claims غير صحيح');
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'needs_fix',
      issues,
      hasSystemOwner,
      hasLegacyOwner,
      hasSystemAdmin,
      hasLegacyAdmin
    };
  };

  const analysis = analyzeProblem();

  // إصلاح سريع للصلاحيات
  const quickFix = async () => {
    if (!user) return;

    setFixing(true);
    try {
      const functions = getFunctions();
      const fixPermissionsFn = httpsCallable(functions, 'fixUserPermissions');
      
      const result = await fixPermissionsFn({
        uid: user.uid,
        targetRole: 'system_owner',
        accountType: 'individual'
      });

      console.log('Fix result:', result);

      // تحديث البيانات
      await refreshUserData(true);
      await fetchAuthClaims();

      toast({
        title: '✅ تم الإصلاح بنجاح',
        description: 'تم إصلاح صلاحيات مالك النظام. جرب الوصول إلى /admin الآن',
        variant: 'default',
      });

    } catch (error: any) {
      console.error('Error in quick fix:', error);
      toast({
        title: '❌ فشل الإصلاح',
        description: error.message || 'حدث خطأ أثناء الإصلاح',
        variant: 'destructive',
      });
    } finally {
      setFixing(false);
    }
  };

  // اختبار الوصول للصفحات
  const testAccess = () => {
    const adminPages = [
      { name: 'الصفحة الرئيسية', url: '/admin' },
      { name: 'إدارة المستخدمين', url: '/admin/users' },
      { name: 'إدارة البيانات', url: '/admin/data-management' },
      { name: 'طلبات المؤسسات', url: '/admin/organization-requests' }
    ];

    return (
      <div className="space-y-2">
        {adminPages.map((page) => (
          <div key={page.url} className="flex items-center justify-between">
            <span className="text-sm">{page.name}</span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.open(page.url, '_blank')}
            >
              اختبار
            </Button>
          </div>
        ))}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4" dir="rtl">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>غير مسجل الدخول</AlertTitle>
          <AlertDescription>يجب تسجيل الدخول أولاً</AlertDescription>
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
          إصلاح سريع لصلاحيات مالك النظام
        </h1>
        <p className="text-muted-foreground mt-1">
          تشخيص وإصلاح سريع لمشاكل الوصول
        </p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Firestore Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="ml-2 h-5 w-5" />
              بيانات Firestore
            </CardTitle>
            <CardDescription>البيانات المخزنة في قاعدة البيانات</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>الدور:</span>
                <Badge variant="default">system_owner</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>isSystemOwner:</span>
                <Badge variant="default">true</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>isSystemAdmin:</span>
                <Badge variant="default">true</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>accountType:</span>
                <Badge variant="secondary">individual</Badge>
              </div>
              <div className="text-center mt-4">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                <p className="text-sm text-green-600 mt-1">بيانات Firestore صحيحة</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auth Claims */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="ml-2 h-5 w-5" />
              Firebase Auth Claims
            </CardTitle>
            <CardDescription>
              الصلاحيات في Firebase Auth
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={fetchAuthClaims}
                disabled={checking}
                className="mr-2"
              >
                <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="text-center py-4">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">جاري التحقق...</p>
              </div>
            ) : authClaims ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>role:</span>
                  <Badge variant={authClaims.role === 'system_owner' ? 'default' : 'destructive'}>
                    {authClaims.role || 'غير محدد'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>system_owner:</span>
                  <Badge variant={authClaims.system_owner ? 'default' : 'destructive'}>
                    {String(authClaims.system_owner)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>owner:</span>
                  <Badge variant={authClaims.owner ? 'default' : 'secondary'}>
                    {String(authClaims.owner)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>accountType:</span>
                  <Badge variant={authClaims.accountType === 'individual' ? 'default' : 'destructive'}>
                    {authClaims.accountType || 'غير محدد'}
                  </Badge>
                </div>
                <div className="text-center mt-4">
                  {analysis.status === 'healthy' ? (
                    <>
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                      <p className="text-sm text-green-600 mt-1">Auth Claims صحيحة</p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
                      <p className="text-sm text-red-600 mt-1">يحتاج إصلاح</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <XCircle className="h-6 w-6 text-red-500 mx-auto" />
                <p className="text-sm text-red-600 mt-2">فشل في جلب Claims</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issues and Fix */}
      {analysis.status === 'needs_fix' && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center text-red-800">
              <AlertTriangle className="ml-2 h-5 w-5" />
              مشاكل مكتشفة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {analysis.issues.map((issue, index) => (
                <p key={index} className="text-sm text-red-700">{issue}</p>
              ))}
            </div>
            <Button 
              onClick={quickFix}
              disabled={fixing}
              className="w-full"
              variant="destructive"
            >
              <Wrench className={`ml-2 h-4 w-4 ${fixing ? 'animate-spin' : ''}`} />
              {fixing ? 'جاري الإصلاح...' : 'إصلاح سريع'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Test Access */}
      <Card>
        <CardHeader>
          <CardTitle>اختبار الوصول للصفحات</CardTitle>
          <CardDescription>
            اختبر الوصول لصفحات المسؤول المختلفة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testAccess()}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>التعليمات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>1.</strong> إذا كانت Auth Claims غير صحيحة، اضغط "إصلاح سريع"</p>
            <p><strong>2.</strong> بعد الإصلاح، اختبر الوصول للصفحات</p>
            <p><strong>3.</strong> إذا استمرت المشكلة، تحقق من console logs</p>
            <p><strong>4.</strong> تأكد من نشر Cloud Functions الجديدة</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
