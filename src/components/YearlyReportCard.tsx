'use client';

import React from 'react';
import { PeriodReportCard } from '@/components/PeriodReportCard';

interface YearlyReportCardProps {
  organizationId?: string;
  departmentId?: string;
  userId?: string;
  className?: string;
  reportPeriod?: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * مكون التقرير السنوي
 * يستخدم المكون الموحد مع تحديد النوع كسنوي
 */
export function YearlyReportCard({ 
  organizationId, 
  departmentId, 
  userId, 
  className, 
  reportPeriod 
}: YearlyReportCardProps) {
  return (
    <PeriodReportCard
      organizationId={organizationId}
      departmentId={departmentId}
      userId={userId}
      className={className}
      defaultPeriodType="yearly"
      reportPeriod={reportPeriod}
    />
  );
}
