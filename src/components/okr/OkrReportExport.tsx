'use client';

/**
 * مكون تصدير تقرير OKR
 *
 * يعرض هذا المكون زر لتصدير تقرير OKR بتنسيق PDF.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2 } from 'lucide-react';

interface OkrReportExportProps {
  periodId: string;
  departmentId?: string;
  organizationId: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
}

export function OkrReportExport({
  periodId,
  departmentId,
  organizationId,
  variant = 'default',
  size = 'default',
  disabled = false
}: OkrReportExportProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // تصدير التقرير
  const handleExport = async () => {
    if (!periodId || !organizationId) {
      toast({
        title: 'خطأ',
        description: 'يرجى تحديد الفترة والمؤسسة',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      toast({
        title: 'جاري التصدير',
        description: 'يتم الآن تصدير التقرير...',
      });

      const exportOkrReport = httpsCallable<
        { periodId: string; departmentId?: string; organizationId: string },
        { success: boolean; url: string }
      >(functions, 'exportOkrReport');

      const result = await exportOkrReport({
        periodId,
        departmentId,
        organizationId,
      });

      if (result.data.success) {
        // فتح الرابط في نافذة جديدة
        window.open(result.data.url, '_blank');

        toast({
          title: 'تم التصدير',
          description: 'تم تصدير التقرير بنجاح',
        });
      } else {
        throw new Error('فشل تصدير التقرير');
      }
    } catch (error) {
      console.error('Error exporting OKR report:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تصدير التقرير',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading || !periodId || !organizationId}
      variant={variant}
      size={size}
    >
      {loading ? (
        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="ml-2 h-4 w-4" />
      )}
      تصدير التقرير
    </Button>
  );
}
