'use client';

/**
 * مكون مخطط تقدم OKR
 * 
 * يعرض هذا المكون مخططًا بيانيًا لتقدم الأهداف والنتائج الرئيسية.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface OkrProgressChartProps {
  data: {
    name: string;
    progress: number;
    status: 'active' | 'completed' | 'at_risk' | 'behind';
    type: 'objective' | 'keyResult';
  }[];
  loading?: boolean;
  title?: string;
  height?: number;
}

// مكون مخصص للتلميح
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-2 rounded-md shadow-md">
        <p className="font-medium">{label}</p>
        <p className="text-sm">
          التقدم: <span className="font-medium">{payload[0].value}%</span>
        </p>
      </div>
    );
  }

  return null;
};

export function OkrProgressChart({ data, loading = false, title = 'تقدم OKR', height = 300 }: OkrProgressChartProps) {
  // الحصول على لون الشريط بناءً على الحالة
  const getBarColor = (status: string) => {
    switch (status) {
      case 'completed': return 'var(--status-completed)';
      case 'active': return 'var(--primary)';
      case 'at_risk': return 'var(--status-warning)';
      case 'behind': return 'var(--status-urgent)';
      default: return 'var(--primary)';
    }
  };
  
  // تحويل البيانات لإضافة اللون
  const chartData = data.map(item => ({
    ...item,
    fill: getBarColor(item.status),
  }));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="progress"
                fill="fill"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">لا توجد بيانات لعرضها</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
