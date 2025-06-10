/**
 * أمثلة على استخدام نظام التقارير الجديد
 */

import React from 'react';
import { ReportSelector } from '@/components/ReportSelector';
import { WeeklyReportCard } from '@/components/WeeklyReportCard';
import { MonthlyReportCard } from '@/components/MonthlyReportCard';
import { YearlyReportCard } from '@/components/YearlyReportCard';
import { PeriodReportCard } from '@/components/PeriodReportCard';

// مثال 1: استخدام مكون اختيار التقرير
export function ReportSelectorExample() {
  return (
    <div className="p-6">
      <ReportSelector 
        organizationId="org-123"
        departmentId="dept-456" // اختياري
      />
    </div>
  );
}

// مثال 2: تقرير أسبوعي مباشر
export function WeeklyReportExample() {
  return (
    <div className="p-6">
      <WeeklyReportCard 
        organizationId="org-123"
        departmentId="dept-456"
      />
    </div>
  );
}

// مثال 3: تقرير شهري
export function MonthlyReportExample() {
  return (
    <div className="p-6">
      <MonthlyReportCard 
        organizationId="org-123"
      />
    </div>
  );
}

// مثال 4: تقرير سنوي
export function YearlyReportExample() {
  return (
    <div className="p-6">
      <YearlyReportCard 
        organizationId="org-123"
      />
    </div>
  );
}

// مثال 5: تقرير مخصص بفترة محددة
export function CustomPeriodReportExample() {
  const customPeriod = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31')
  };

  return (
    <div className="p-6">
      <PeriodReportCard 
        organizationId="org-123"
        defaultPeriodType="monthly"
        reportPeriod={customPeriod}
      />
    </div>
  );
}

// مثال 6: تقرير مستخدم فردي
export function IndividualUserReportExample() {
  return (
    <div className="p-6">
      <PeriodReportCard 
        organizationId="org-123"
        userId="user-789"
        defaultPeriodType="weekly"
      />
    </div>
  );
}

// مثال 7: تقرير قسم محدد
export function DepartmentReportExample() {
  return (
    <div className="p-6">
      <PeriodReportCard 
        organizationId="org-123"
        departmentId="dept-456"
        defaultPeriodType="monthly"
      />
    </div>
  );
}
