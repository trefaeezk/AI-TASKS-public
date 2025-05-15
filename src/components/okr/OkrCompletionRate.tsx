'use client';

/**
 * مكون معدل إكمال OKR
 * 
 * يعرض هذا المكون مقياسًا دائريًا لمعدل إكمال الأهداف أو النتائج الرئيسية.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface OkrCompletionRateProps {
  value: number;
  total: number;
  loading?: boolean;
  title?: string;
  type?: 'objectives' | 'keyResults';
}

export function OkrCompletionRate({ 
  value, 
  total, 
  loading = false, 
  title = 'معدل الإكمال', 
  type = 'objectives' 
}: OkrCompletionRateProps) {
  // حساب النسبة المئوية
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  // الحصول على لون التقدم بناءً على النسبة المئوية
  const getProgressColor = (percent: number) => {
    if (percent >= 75) return 'bg-status-completed';
    if (percent >= 50) return 'bg-primary';
    if (percent >= 25) return 'bg-status-warning';
    return 'bg-status-urgent';
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold">{percentage}%</div>
              <p className="text-sm text-muted-foreground">
                {value} من {total} {type === 'objectives' ? 'هدف' : 'نتيجة رئيسية'} مكتمل
              </p>
            </div>
            
            <Progress 
              value={percentage} 
              className="h-2" 
              indicatorClassName={getProgressColor(percentage)} 
            />
            
            <div className="grid grid-cols-2 gap-4 text-center text-sm">
              <div>
                <div className="font-medium">{total}</div>
                <p className="text-muted-foreground">
                  {type === 'objectives' ? 'الأهداف' : 'النتائج الرئيسية'} الكلية
                </p>
              </div>
              <div>
                <div className="font-medium">{value}</div>
                <p className="text-muted-foreground">
                  {type === 'objectives' ? 'الأهداف' : 'النتائج الرئيسية'} المكتملة
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
