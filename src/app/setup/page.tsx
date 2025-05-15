/**
 * صفحة إعداد النظام - تظهر عند تشغيل التطبيق لأول مرة
 */
import { Metadata } from 'next';
import SystemSetup from '@/components/setup/SystemSetup';
import { PageHeader } from '@/components/PageHeader';
import { Settings } from 'lucide-react';

export const metadata: Metadata = {
  title: 'إعداد النظام',
  description: 'إعداد نظام إدارة المهام',
};

export default function SetupPage() {
  return (
    <div className="container mx-auto px-4 py-6 md:py-8 min-h-screen flex flex-col">
      <PageHeader
        heading="إعداد النظام"
        subheading="قم بإعداد نظام إدارة المهام حسب احتياجاتك"
        icon={<Settings className="h-6 w-6" />}
        className="text-center"
      />

      <div className="flex-1 flex items-center justify-center py-6">
        <SystemSetup />
      </div>
    </div>
  );
}
