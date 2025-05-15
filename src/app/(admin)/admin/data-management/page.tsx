/**
 * صفحة إدارة البيانات - تصدير واستيراد بيانات المستخدمين والمهام
 */
import { Metadata } from 'next';
import DataManagement from '@/components/admin/DataManagement';
import { PageHeader } from '@/components/PageHeader';
import { Database } from 'lucide-react';

export const metadata: Metadata = {
  title: 'إدارة البيانات',
  description: 'تصدير واستيراد بيانات المستخدمين والمهام',
};

export default function DataManagementPage() {
  return (
    <div className="container mx-auto px-4 py-4">
      <PageHeader
        heading="إدارة البيانات"
        subheading="تصدير واستيراد بيانات المستخدمين والمهام"
        icon={<Database className="h-6 w-6" />}
        className="mb-6"
      />

      <div className="mb-8">
        <DataManagement />
      </div>

      <div className="text-center text-sm text-muted-foreground mt-8 mb-4">
        <p>يمكنك استخدام هذه الأدوات لعمل نسخة احتياطية من بياناتك أو نقلها إلى نظام آخر</p>
      </div>
    </div>
  );
}
