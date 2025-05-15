'use client';

/**
 * مكون تصدير بيانات OKR إلى Excel
 *
 * يعرض هذا المكون زر لتصدير بيانات OKR بتنسيق Excel.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

interface OkrExcelExportProps {
  periodId: string;
  departmentId?: string;
  organizationId: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
}

export function OkrExcelExport({
  periodId,
  departmentId,
  organizationId,
  variant = 'outline',
  size = 'default',
  disabled = false
}: OkrExcelExportProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // تصدير البيانات إلى Excel
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
        description: 'يتم الآن تصدير البيانات إلى Excel...',
      });

      const exportOkrToExcel = httpsCallable<
        { periodId: string; departmentId?: string; organizationId: string },
        { success: boolean; url: string }
      >(functions, 'exportOkrToExcel');

      const result = await exportOkrToExcel({
        periodId,
        departmentId,
        organizationId,
      });

      if (result.data.success) {
        // تنزيل الملف
        const link = document.createElement('a');
        link.href = result.data.url;
        link.setAttribute('download', `okr_report_${periodId}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'تم التصدير',
          description: 'تم تصدير البيانات إلى Excel بنجاح',
        });
      } else {
        throw new Error('فشل تصدير البيانات');
      }
    } catch (error) {
      console.error('Error exporting OKR to Excel:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تصدير البيانات إلى Excel',
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
        <FileSpreadsheet className="ml-2 h-4 w-4" />
      )}
      تصدير Excel
    </Button>
  );
}
