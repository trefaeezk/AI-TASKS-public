'use client';

import { Database } from 'lucide-react';
import OrganizationDataManagement from '@/components/organization/OrganizationDataManagement';

export default function OrganizationDataPage() {
  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex items-center mb-6">
        <Database className="ml-2 h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">إدارة البيانات</h1>
          <p className="text-muted-foreground">تصدير واستيراد بيانات المؤسسة</p>
        </div>
      </div>

      <div className="mb-8">
        <OrganizationDataManagement />
      </div>

      <div className="text-center text-sm text-muted-foreground mt-8 mb-4">
        <p>يمكنك استخدام هذه الأدوات لعمل نسخة احتياطية من بيانات المؤسسة أو نقلها إلى نظام آخر</p>
      </div>
    </div>
  );
}
