/**
 * مكون الرسم البياني للخط الزمني للموافقات
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ApprovalTimelineData } from '@/services/approvalReports';
import { TrendingUp, Calendar } from 'lucide-react';

interface ApprovalTimelineChartProps {
  data: ApprovalTimelineData[];
  loading: boolean;
  title?: string;
  showArea?: boolean;
}

export function ApprovalTimelineChart({ 
  data, 
  loading, 
  title = "الخط الزمني للموافقات",
  showArea = false 
}: ApprovalTimelineChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="ml-2 h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="ml-2 h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p>لا توجد بيانات للعرض</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // تحضير البيانات للرسم البياني
  const chartData = data.map(item => ({
    ...item,
    date: format(new Date(item.date), 'dd/MM', { locale: ar }),
    fullDate: item.date,
    total: item.pending + item.approved + item.rejected
  }));

  // حساب الإحصائيات
  const totalPending = data.reduce((sum, item) => sum + item.pending, 0);
  const totalApproved = data.reduce((sum, item) => sum + item.approved, 0);
  const totalRejected = data.reduce((sum, item) => sum + item.rejected, 0);
  const totalTasks = totalPending + totalApproved + totalRejected;

  // مكون Tooltip مخصص
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{format(new Date(data.fullDate), 'EEEE، dd MMMM yyyy', { locale: ar })}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-orange-600">معلقة:</span>
              <span className="font-medium">{data.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-green-600">معتمدة:</span>
              <span className="font-medium">{data.approved}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-red-600">مرفوضة:</span>
              <span className="font-medium">{data.rejected}</span>
            </div>
            <div className="border-t pt-1 mt-1">
              <div className="flex items-center justify-between font-medium">
                <span>الإجمالي:</span>
                <span>{data.total}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="ml-2 h-5 w-5" />
            {title}
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Badge variant="outline" className="text-xs">
              {data.length} يوم
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{totalPending}</div>
            <p className="text-xs text-muted-foreground">معلقة</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{totalApproved}</div>
            <p className="text-xs text-muted-foreground">معتمدة</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{totalRejected}</div>
            <p className="text-xs text-muted-foreground">مرفوضة</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">إجمالي</p>
          </div>
        </div>

        {/* الرسم البياني */}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {showArea ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="pending"
                    stackId="1"
                    stroke="hsl(var(--warning))"
                    fill="hsl(var(--warning))"
                    fillOpacity={0.6}
                    name="معلقة"
                  />
                  <Area
                    type="monotone"
                    dataKey="approved"
                    stackId="1"
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.6}
                    name="معتمدة"
                  />
                  <Area
                    type="monotone"
                    dataKey="rejected"
                    stackId="1"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.6}
                    name="مرفوضة"
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="pending"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--warning))', strokeWidth: 2, r: 4 }}
                    name="معلقة"
                  />
                  <Line
                    type="monotone"
                    dataKey="approved"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 4 }}
                    name="معتمدة"
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 2, r: 4 }}
                    name="مرفوضة"
                  />
                </>
              )}
            </ChartComponent>
          </ResponsiveContainer>
        </div>

        {/* ملاحظات */}
        <div className="mt-4 text-xs text-muted-foreground">
          <p>* البيانات تُظهر عدد المهام المُرسلة للموافقة يومياً وحالتها الحالية</p>
        </div>
      </CardContent>
    </Card>
  );
}
