'use client';

import { useState, useEffect } from 'react';
import { Database, FileJson } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import IndividualDataManagement from '@/components/data/IndividualDataManagement';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { PermissionGuard } from '@/components/PermissionGuard';

/**
 * صفحة إدارة البيانات للمستخدم المستقل
 * تتيح للمستخدم المستقل تصدير واستيراد مهامه الخاصة فقط
 */
export default function DataPage() {
  const { user, userClaims, loading } = useAuth();
  const [isIndependent, setIsIndependent] = useState(false);

  useEffect(() => {
    if (!loading && userClaims) {
      setIsIndependent(userClaims.role === 'isIndependent');
    }
  }, [userClaims, loading]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mr-2">جاري التحميل...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>غير مصرح</AlertTitle>
        <AlertDescription>
          يجب تسجيل الدخول للوصول إلى هذه الصفحة.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      <PageHeader
        heading="إدارة البيانات"
        subheading="تصدير واستيراد مهامك الخاصة"
        icon={<Database className="h-6 w-6" />}
      />

      <PermissionGuard area="data" action="view">
        <IndividualDataManagement />
      </PermissionGuard>
    </div>
  );
}
