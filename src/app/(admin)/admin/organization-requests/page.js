'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

// استيراد المكونات والهوكس اللازمة
import React from 'react';
import dynamicImport from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';

// تعريف مكون التحميل
function LoadingComponent() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardContent className="py-10">
          <div className="flex justify-center items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span className="mr-3">جاري تحميل طلبات المؤسسات...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// تحميل المكون بشكل ديناميكي مع تعطيل SSR تمامًا
const OrganizationRequestsClient = dynamicImport(
  () => import('./page-client'),
  {
    ssr: false, // تعطيل التقديم على الخادم
    loading: () => <LoadingComponent />
  }
);

// المكون الرئيسي - يعمل فقط على جانب العميل
export default function OrganizationRequestsPage() {
  return <OrganizationRequestsClient />;
}
