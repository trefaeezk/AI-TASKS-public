'use client';

/**
 * بطاقة فترة OKR
 */

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, ArrowRight, CheckCircle, Clock, BarChart3 } from 'lucide-react';

interface OkrPeriodProps {
  period: {
    id: string;
    name: string;
    startDate: { seconds: number; nanoseconds: number };
    endDate: { seconds: number; nanoseconds: number };
    status: 'active' | 'completed' | 'planning';
    organizationId: string;
    departmentId?: string;
  };
  onClick?: () => void;
}

export function OkrPeriodCard({ period, onClick }: OkrPeriodProps) {
  // تحويل التواريخ من Firestore Timestamp إلى Date
  const startDate = new Date(period.startDate.seconds * 1000);
  const endDate = new Date(period.endDate.seconds * 1000);
  
  // حساب النسبة المئوية للوقت المنقضي
  const now = new Date();
  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsedDuration = now.getTime() - startDate.getTime();
  const timeProgress = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));
  
  // تحديد لون وأيقونة الحالة
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'planning': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'completed': return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="ml-1 h-3 w-3" />;
      case 'planning': return <Clock className="ml-1 h-3 w-3" />;
      case 'completed': return <BarChart3 className="ml-1 h-3 w-3" />;
      default: return null;
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'نشطة';
      case 'planning': return 'تخطيط';
      case 'completed': return 'مكتملة';
      default: return status;
    }
  };
  
  // تحديد ما إذا كانت الفترة حالية
  const isCurrent = now >= startDate && now <= endDate;
  
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md" onClick={onClick}>
      <div className="h-1 bg-gray-200">
        {period.status === 'active' && (
          <div
            className="h-full bg-primary"
            style={{ width: `${timeProgress}%` }}
          />
        )}
      </div>
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{period.name}</CardTitle>
          <Badge className={getStatusColor(period.status)}>
            {getStatusIcon(period.status)}
            {getStatusText(period.status)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <CalendarIcon className="ml-1 h-4 w-4" />
          <span>
            {format(startDate, 'dd MMM yyyy', { locale: ar })} - {format(endDate, 'dd MMM yyyy', { locale: ar })}
          </span>
        </div>
        
        {isCurrent && period.status === 'active' && (
          <p className="text-sm text-primary">
            {Math.round(timeProgress)}% من الوقت منقضي
          </p>
        )}
      </CardContent>
      
      <CardFooter>
        <Button variant="ghost" className="w-full justify-center" onClick={onClick}>
          عرض التفاصيل
          <ArrowRight className="mr-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
