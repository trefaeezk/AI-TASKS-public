'use client';

import React from 'react';
import { PeriodReportCard } from '@/components/PeriodReportCard';

interface MonthlyReportCardProps {
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
 * مكون التقرير الشهري
 * يستخدم المكون الموحد مع تحديد النوع كشهري
 */
export function MonthlyReportCard({ 
  organizationId, 
  departmentId, 
  userId, 
  className, 
  reportPeriod 
}: MonthlyReportCardProps) {
  return (
    <PeriodReportCard
      organizationId={organizationId}
      departmentId={departmentId}
      userId={userId}
      className={className}
      defaultPeriodType="monthly"
      reportPeriod={reportPeriod}
    />
  );
}
