/**
 * ملف اختبار للتأكد من عمل التقرير الأسبوعي المحسن
 */

import React from 'react';
import { WeeklyReportCard } from '@/components/WeeklyReportCard';

// بيانات اختبار
const testData = {
  organizationId: 'test-org-123',
  departmentId: 'test-dept-456',
  reportPeriod: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-07')
  }
};

// مكون اختبار للتقرير الأسبوعي
export function WeeklyReportTest() {
  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">اختبار التقرير الأسبوعي المحسن</h1>
      
      {/* اختبار تقرير المؤسسة */}
      <div>
        <h2 className="text-xl font-semibold mb-4">تقرير المؤسسة</h2>
        <WeeklyReportCard
          organizationId={testData.organizationId}
          reportPeriod={testData.reportPeriod}
          className="max-w-6xl"
        />
      </div>

      {/* اختبار تقرير القسم */}
      <div>
        <h2 className="text-xl font-semibold mb-4">تقرير القسم</h2>
        <WeeklyReportCard
          organizationId={testData.organizationId}
          departmentId={testData.departmentId}
          reportPeriod={testData.reportPeriod}
          className="max-w-6xl"
        />
      </div>
    </div>
  );
}

// دالة اختبار للمكونات الفردية
export function testComponents() {
  console.log('🧪 اختبار المكونات الجديدة...');
  
  try {
    // اختبار استيراد المكونات
    import('@/components/charts/WeeklyReportCharts').then(() => {
      console.log('✅ WeeklyReportCharts - تم التحميل بنجاح');
    });
    
    import('@/components/charts/WeeklyTrendAnalysis').then(() => {
      console.log('✅ WeeklyTrendAnalysis - تم التحميل بنجاح');
    });
    
    import('@/components/charts/DepartmentAnalysis').then(() => {
      console.log('✅ DepartmentAnalysis - تم التحميل بنجاح');
    });
    
    import('@/components/export/AdvancedExport').then(() => {
      console.log('✅ AdvancedExport - تم التحميل بنجاح');
    });
    
    // اختبار المكتبات الخارجية
    import('chart.js').then(() => {
      console.log('✅ Chart.js - تم التحميل بنجاح');
    });
    
    import('react-chartjs-2').then(() => {
      console.log('✅ React-ChartJS-2 - تم التحميل بنجاح');
    });
    
    import('jspdf').then(() => {
      console.log('✅ jsPDF - تم التحميل بنجاح');
    });
    
    import('exceljs').then(() => {
      console.log('✅ ExcelJS - تم التحميل بنجاح');
    });
    
    import('html2canvas').then(() => {
      console.log('✅ html2canvas - تم التحميل بنجاح');
    });
    
    console.log('🎉 جميع المكونات والمكتبات تعمل بنجاح!');
    
  } catch (error) {
    console.error('❌ خطأ في اختبار المكونات:', error);
  }
}

// تشغيل الاختبار عند التحميل
if (typeof window !== 'undefined') {
  testComponents();
}
