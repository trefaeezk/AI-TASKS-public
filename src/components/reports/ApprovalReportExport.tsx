/**
 * مكون تصدير تقارير الموافقات
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Image,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  ApprovalStats,
  ApprovalTimelineData,
  DepartmentApprovalStats,
  PendingTaskDetails
} from '@/services/approvalReports';

interface ApprovalReportExportProps {
  approvalStats: ApprovalStats | null;
  timelineData: ApprovalTimelineData[];
  departmentStats: DepartmentApprovalStats[];
  pendingTasks: PendingTaskDetails[];
  organizationName?: string;
}

type ExportFormat = 'pdf' | 'excel' | 'csv' | 'png';
type ExportSection = 'stats' | 'timeline' | 'departments' | 'pending';

export function ApprovalReportExport({
  approvalStats,
  timelineData,
  departmentStats,
  pendingTasks,
  organizationName = 'المؤسسة'
}: ApprovalReportExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [selectedSections, setSelectedSections] = useState<ExportSection[]>(['stats', 'pending']);

  // معالجة تغيير الأقسام المحددة
  const handleSectionChange = (section: ExportSection, checked: boolean) => {
    if (checked) {
      setSelectedSections(prev => [...prev, section]);
    } else {
      setSelectedSections(prev => prev.filter(s => s !== section));
    }
  };

  // تحضير بيانات CSV
  const generateCSVData = () => {
    const csvData: string[] = [];
    
    // إضافة رأس التقرير
    csvData.push(`تقرير الموافقات - ${organizationName}`);
    csvData.push(`تاريخ التقرير: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}`);
    csvData.push('');

    // إحصائيات الموافقات
    if (selectedSections.includes('stats') && approvalStats) {
      csvData.push('إحصائيات الموافقات العامة');
      csvData.push('المؤشر,القيمة');
      csvData.push(`المهام المعلقة,${approvalStats.totalPendingTasks}`);
      csvData.push(`المهام المعتمدة,${approvalStats.totalApprovedTasks}`);
      csvData.push(`المهام المرفوضة,${approvalStats.totalRejectedTasks}`);
      csvData.push(`معدل الموافقة,${approvalStats.approvalRate.toFixed(2)}%`);
      csvData.push(`معدل الرفض,${approvalStats.rejectionRate.toFixed(2)}%`);
      csvData.push(`متوسط وقت الموافقة,${approvalStats.averageApprovalTime.toFixed(2)} ساعة`);
      csvData.push('');
    }

    // المهام المعلقة
    if (selectedSections.includes('pending') && pendingTasks.length > 0) {
      csvData.push('المهام المعلقة للموافقة');
      csvData.push('العنوان,المُرسل,مستوى الموافقة,الأولوية,وقت الانتظار (ساعة),تاريخ الإرسال');
      pendingTasks.forEach(task => {
        csvData.push([
          `"${task.title}"`,
          `"${task.submittedByName}"`,
          task.approvalLevel === 'organization' ? 'المؤسسة' : 'القسم',
          task.priority === 'high' ? 'عالية' : task.priority === 'medium' ? 'متوسطة' : 'منخفضة',
          task.waitingTime.toFixed(2),
          format(task.submittedAt, 'dd/MM/yyyy HH:mm')
        ].join(','));
      });
      csvData.push('');
    }

    // إحصائيات الأقسام
    if (selectedSections.includes('departments') && departmentStats.length > 0) {
      csvData.push('إحصائيات الأقسام');
      csvData.push('القسم,المعلقة,المعتمدة,المرفوضة,معدل الموافقة,متوسط وقت الموافقة (ساعة)');
      departmentStats.forEach(dept => {
        csvData.push([
          `"${dept.departmentName}"`,
          dept.pendingTasks,
          dept.approvedTasks,
          dept.rejectedTasks,
          `${dept.approvalRate.toFixed(2)}%`,
          dept.averageApprovalTime.toFixed(2)
        ].join(','));
      });
      csvData.push('');
    }

    // بيانات الخط الزمني
    if (selectedSections.includes('timeline') && timelineData.length > 0) {
      csvData.push('الخط الزمني للموافقات');
      csvData.push('التاريخ,المعلقة,المعتمدة,المرفوضة');
      timelineData.forEach(item => {
        csvData.push([
          item.date,
          item.pending,
          item.approved,
          item.rejected
        ].join(','));
      });
    }

    return csvData.join('\n');
  };

  // تحضير بيانات Excel
  const generateExcelData = () => {
    // هنا يمكن استخدام مكتبة مثل xlsx لإنشاء ملف Excel
    // للبساطة، سنستخدم CSV مع تنسيق مناسب لـ Excel
    return generateCSVData();
  };

  // تنزيل الملف
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // معالجة التصدير
  const handleExport = async () => {
    if (selectedSections.length === 0) {
      toast({
        title: 'خطأ في التصدير',
        description: 'يرجى اختيار قسم واحد على الأقل للتصدير',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
      const baseFilename = `تقرير_الموافقات_${timestamp}`;

      switch (exportFormat) {
        case 'csv':
          const csvContent = generateCSVData();
          downloadFile(csvContent, `${baseFilename}.csv`, 'text/csv;charset=utf-8;');
          break;

        case 'excel':
          const excelContent = generateExcelData();
          downloadFile(excelContent, `${baseFilename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          break;

        case 'pdf':
          // هنا يمكن إضافة منطق إنشاء PDF
          toast({
            title: 'قيد التطوير',
            description: 'تصدير PDF سيكون متاحاً قريباً',
            variant: 'default',
          });
          break;

        case 'png':
          // هنا يمكن إضافة منطق إنشاء صورة
          toast({
            title: 'قيد التطوير',
            description: 'تصدير الصور سيكون متاحاً قريباً',
            variant: 'default',
          });
          break;

        default:
          throw new Error('تنسيق تصدير غير مدعوم');
      }

      toast({
        title: 'تم التصدير بنجاح',
        description: `تم تصدير التقرير بتنسيق ${exportFormat.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'خطأ في التصدير',
        description: 'حدث خطأ أثناء تصدير التقرير',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Download className="ml-2 h-5 w-5" />
          تصدير التقرير
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* اختيار تنسيق التصدير */}
        <div>
          <Label className="text-sm font-medium mb-2 block">تنسيق التصدير</Label>
          <Select value={exportFormat} onValueChange={(value: ExportFormat) => setExportFormat(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">
                <div className="flex items-center">
                  <FileText className="ml-2 h-4 w-4" />
                  CSV
                </div>
              </SelectItem>
              <SelectItem value="excel">
                <div className="flex items-center">
                  <FileSpreadsheet className="ml-2 h-4 w-4" />
                  Excel
                </div>
              </SelectItem>
              <SelectItem value="pdf" disabled>
                <div className="flex items-center">
                  <FileText className="ml-2 h-4 w-4" />
                  PDF (قريباً)
                </div>
              </SelectItem>
              <SelectItem value="png" disabled>
                <div className="flex items-center">
                  <Image className="ml-2 h-4 w-4" />
                  PNG (قريباً)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* اختيار الأقسام */}
        <div>
          <Label className="text-sm font-medium mb-3 block">الأقسام المراد تصديرها</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="stats"
                checked={selectedSections.includes('stats')}
                onCheckedChange={(checked) => handleSectionChange('stats', checked as boolean)}
              />
              <Label htmlFor="stats" className="text-sm">الإحصائيات العامة</Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="pending"
                checked={selectedSections.includes('pending')}
                onCheckedChange={(checked) => handleSectionChange('pending', checked as boolean)}
              />
              <Label htmlFor="pending" className="text-sm">المهام المعلقة ({pendingTasks.length})</Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="departments"
                checked={selectedSections.includes('departments')}
                onCheckedChange={(checked) => handleSectionChange('departments', checked as boolean)}
              />
              <Label htmlFor="departments" className="text-sm">إحصائيات الأقسام ({departmentStats.length})</Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="timeline"
                checked={selectedSections.includes('timeline')}
                onCheckedChange={(checked) => handleSectionChange('timeline', checked as boolean)}
              />
              <Label htmlFor="timeline" className="text-sm">الخط الزمني ({timelineData.length} يوم)</Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* زر التصدير */}
        <Button
          onClick={handleExport}
          disabled={isExporting || selectedSections.length === 0}
          className="w-full"
        >
          {isExporting ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري التصدير...
            </>
          ) : (
            <>
              <Download className="ml-2 h-4 w-4" />
              تصدير التقرير
            </>
          )}
        </Button>

        {selectedSections.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            يرجى اختيار قسم واحد على الأقل للتصدير
          </p>
        )}
      </CardContent>
    </Card>
  );
}
