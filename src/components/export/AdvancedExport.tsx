'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Presentation,
  Image,
  Loader2,
  Settings
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as ExcelJS from 'exceljs';

interface ExportData {
  title: string;
  summary: string;
  completedTasks: any[];
  inProgressTasks: any[];
  upcomingTasks: any[];
  blockedTasks: any[];
  keyMetrics: {
    completionRate: number;
    onTimeCompletionRate: number;
    averageProgress: number;
  };
  recommendations: string[];
  departmentData?: any[];
}

interface AdvancedExportProps {
  data: ExportData;
  reportElement?: React.RefObject<HTMLDivElement>;
}

export function AdvancedExport({ data, reportElement }: AdvancedExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'image'>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [includeDepartments, setIncludeDepartments] = useState(true);

  // تصدير PDF محسن
  const exportToPDF = async () => {
    if (!reportElement?.current) return;

    try {
      setIsExporting(true);
      
      // إنشاء PDF جديد
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // إعدادات الخط العربي
      pdf.setFont('helvetica');
      
      // العنوان الرئيسي
      pdf.setFontSize(20);
      pdf.text(data.title, pageWidth / 2, 20, { align: 'center' });
      
      // التاريخ
      pdf.setFontSize(12);
      pdf.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, pageWidth / 2, 30, { align: 'center' });
      
      let yPosition = 50;
      
      // الملخص التنفيذي
      pdf.setFontSize(16);
      pdf.text('الملخص التنفيذي', 20, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      const summaryLines = pdf.splitTextToSize(data.summary, pageWidth - 40);
      pdf.text(summaryLines, 20, yPosition);
      yPosition += summaryLines.length * 5 + 10;
      
      // مؤشرات الأداء الرئيسية
      pdf.setFontSize(16);
      pdf.text('مؤشرات الأداء الرئيسية', 20, yPosition);
      yPosition += 15;
      
      pdf.setFontSize(12);
      pdf.text(`نسبة الإكمال: ${data.keyMetrics.completionRate.toFixed(1)}%`, 20, yPosition);
      yPosition += 8;
      pdf.text(`الالتزام بالمواعيد: ${data.keyMetrics.onTimeCompletionRate.toFixed(1)}%`, 20, yPosition);
      yPosition += 8;
      pdf.text(`متوسط التقدم: ${data.keyMetrics.averageProgress.toFixed(1)}%`, 20, yPosition);
      yPosition += 15;
      
      // إحصائيات المهام
      if (includeTasks) {
        pdf.setFontSize(16);
        pdf.text('إحصائيات المهام', 20, yPosition);
        yPosition += 15;
        
        pdf.setFontSize(12);
        pdf.text(`المهام المكتملة: ${data.completedTasks.length}`, 20, yPosition);
        yPosition += 8;
        pdf.text(`المهام قيد التنفيذ: ${data.inProgressTasks.length}`, 20, yPosition);
        yPosition += 8;
        pdf.text(`المهام القادمة: ${data.upcomingTasks.length}`, 20, yPosition);
        yPosition += 8;
        pdf.text(`المهام المعلقة: ${data.blockedTasks.length}`, 20, yPosition);
        yPosition += 15;
      }
      
      // التوصيات
      if (includeRecommendations && data.recommendations.length > 0) {
        if (yPosition > pageHeight - 50) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFontSize(16);
        pdf.text('التوصيات', 20, yPosition);
        yPosition += 15;
        
        pdf.setFontSize(10);
        data.recommendations.forEach((recommendation, index) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 20;
          }
          
          const recLines = pdf.splitTextToSize(`${index + 1}. ${recommendation}`, pageWidth - 40);
          pdf.text(recLines, 20, yPosition);
          yPosition += recLines.length * 5 + 5;
        });
      }
      
      // إضافة الرسوم البيانية إذا كانت مطلوبة
      if (includeCharts && reportElement.current) {
        const charts = reportElement.current.querySelectorAll('canvas');
        
        for (let i = 0; i < charts.length; i++) {
          const chart = charts[i];
          const canvas = await html2canvas(chart);
          const imgData = canvas.toDataURL('image/png');
          
          pdf.addPage();
          pdf.setFontSize(16);
          pdf.text(`الرسم البياني ${i + 1}`, 20, 20);
          
          const imgWidth = pageWidth - 40;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 20, 30, imgWidth, Math.min(imgHeight, pageHeight - 50));
        }
      }
      
      // حفظ الملف
      pdf.save(`التقرير_الأسبوعي_${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // تصدير Excel متقدم
  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      
      const workbook = new ExcelJS.Workbook();
      
      // ورقة الملخص
      const summarySheet = workbook.addWorksheet('الملخص التنفيذي');
      
      // تنسيق العنوان
      summarySheet.mergeCells('A1:D1');
      const titleCell = summarySheet.getCell('A1');
      titleCell.value = data.title;
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: 'center' };
      
      // مؤشرات الأداء
      summarySheet.getCell('A3').value = 'مؤشرات الأداء الرئيسية';
      summarySheet.getCell('A3').font = { bold: true };
      
      summarySheet.getCell('A4').value = 'نسبة الإكمال';
      summarySheet.getCell('B4').value = `${data.keyMetrics.completionRate.toFixed(1)}%`;
      
      summarySheet.getCell('A5').value = 'الالتزام بالمواعيد';
      summarySheet.getCell('B5').value = `${data.keyMetrics.onTimeCompletionRate.toFixed(1)}%`;
      
      summarySheet.getCell('A6').value = 'متوسط التقدم';
      summarySheet.getCell('B6').value = `${data.keyMetrics.averageProgress.toFixed(1)}%`;
      
      // ورقة المهام المكتملة
      if (includeTasks && data.completedTasks.length > 0) {
        const completedSheet = workbook.addWorksheet('المهام المكتملة');
        
        // العناوين
        completedSheet.getCell('A1').value = 'الوصف';
        completedSheet.getCell('B1').value = 'الأولوية';
        completedSheet.getCell('C1').value = 'تاريخ الإكمال';
        completedSheet.getCell('D1').value = 'التقدم';
        
        // تنسيق العناوين
        ['A1', 'B1', 'C1', 'D1'].forEach(cell => {
          completedSheet.getCell(cell).font = { bold: true };
          completedSheet.getCell(cell).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F3FF' }
          };
        });
        
        // البيانات
        data.completedTasks.forEach((task, index) => {
          const row = index + 2;
          completedSheet.getCell(`A${row}`).value = task.description || task.title;
          completedSheet.getCell(`B${row}`).value = task.priority || 'متوسطة';
          completedSheet.getCell(`C${row}`).value = task.completedDate ? 
            new Date(task.completedDate).toLocaleDateString('ar-SA') : '';
          completedSheet.getCell(`D${row}`).value = '100%';
        });
        
        // تعديل عرض الأعمدة
        completedSheet.columns.forEach(column => {
          column.width = 20;
        });
      }
      
      // ورقة التوصيات
      if (includeRecommendations && data.recommendations.length > 0) {
        const recommendationsSheet = workbook.addWorksheet('التوصيات');
        
        recommendationsSheet.getCell('A1').value = 'التوصيات';
        recommendationsSheet.getCell('A1').font = { size: 14, bold: true };
        
        data.recommendations.forEach((recommendation, index) => {
          const row = index + 3;
          recommendationsSheet.getCell(`A${row}`).value = `${index + 1}. ${recommendation}`;
          recommendationsSheet.getCell(`A${row}`).alignment = { wrapText: true };
        });
        
        recommendationsSheet.getColumn('A').width = 80;
      }
      
      // حفظ الملف
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `التقرير_الأسبوعي_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting Excel:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // تصدير صورة
  const exportToImage = async () => {
    if (!reportElement?.current) return;

    try {
      setIsExporting(true);
      
      const canvas = await html2canvas(reportElement.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `التقرير_الأسبوعي_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
    } catch (error) {
      console.error('Error exporting image:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    switch (exportFormat) {
      case 'pdf':
        exportToPDF();
        break;
      case 'excel':
        exportToExcel();
        break;
      case 'image':
        exportToImage();
        break;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="ml-2 h-5 w-5" />
          خيارات التصدير المتقدمة
        </CardTitle>
        <CardDescription>
          اختر تنسيق التصدير والمحتوى المطلوب تضمينه
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* اختيار التنسيق */}
        <div className="space-y-2">
          <Label>تنسيق التصدير</Label>
          <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">
                <div className="flex items-center">
                  <FileText className="ml-2 h-4 w-4" />
                  PDF - تقرير مفصل
                </div>
              </SelectItem>
              <SelectItem value="excel">
                <div className="flex items-center">
                  <FileSpreadsheet className="ml-2 h-4 w-4" />
                  Excel - جداول بيانات
                </div>
              </SelectItem>
              <SelectItem value="image">
                <div className="flex items-center">
                  <Image className="ml-2 h-4 w-4" />
                  PNG - صورة عالية الجودة
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* خيارات المحتوى */}
        <div className="space-y-3">
          <Label>المحتوى المطلوب تضمينه</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="charts" 
              checked={includeCharts} 
              onCheckedChange={setIncludeCharts}
            />
            <Label htmlFor="charts">الرسوم البيانية والمخططات</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="tasks" 
              checked={includeTasks} 
              onCheckedChange={setIncludeTasks}
            />
            <Label htmlFor="tasks">تفاصيل المهام</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="recommendations" 
              checked={includeRecommendations} 
              onCheckedChange={setIncludeRecommendations}
            />
            <Label htmlFor="recommendations">التوصيات والاقتراحات</Label>
          </div>
          
          {data.departmentData && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="departments" 
                checked={includeDepartments} 
                onCheckedChange={setIncludeDepartments}
              />
              <Label htmlFor="departments">تحليل الأقسام</Label>
            </div>
          )}
        </div>

        <Separator />

        {/* زر التصدير */}
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
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
      </CardContent>
    </Card>
  );
}
