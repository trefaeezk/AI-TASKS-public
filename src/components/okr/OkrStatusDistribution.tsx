'use client';

/**
 * مكون توزيع حالات OKR
 * 
 * يعرض هذا المكون مخططًا دائريًا لتوزيع حالات الأهداف أو النتائج الرئيسية.
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface OkrStatusDistributionProps {
  data: {
    name: string;
    value: number;
    status: 'active' | 'completed' | 'at_risk' | 'behind';
  }[];
  loading?: boolean;
  title?: string;
  height?: number;
}

// مكون مخصص للتلميح
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-2 rounded-md shadow-md">
        <p className="font-medium">{payload[0].name}</p>
        <p className="text-sm">
          العدد: <span className="font-medium">{payload[0].value}</span>
        </p>
      </div>
    );
  }

  return null;
};

export function OkrStatusDistribution({ 
  data, 
  loading = false, 
  title = 'توزيع الحالات', 
  height = 300 
}: OkrStatusDistributionProps) {
  // ألوان الحالات
  const COLORS = {
    completed: 'var(--status-completed)',
    active: 'var(--primary)',
    at_risk: 'var(--status-warning)',
    behind: 'var(--status-urgent)',
  };
  
  // تحويل البيانات لإضافة اللون
  const chartData = data.map(item => ({
    ...item,
    color: COLORS[item.status],
  }));
  
  // تنسيق النسبة المئوية
  const renderCustomizedLabel = ({ 
    cx, 
    cy, 
    midAngle, 
    innerRadius, 
    outerRadius, 
    percent, 
    index 
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
  
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
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(value, entry, index) => (
                  <span style={{ color: 'var(--foreground)' }}>{value}</span>
                )}
              />
            </PieChart>
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
