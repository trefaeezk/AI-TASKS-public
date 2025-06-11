'use client';

import React from 'react';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WeeklyComparison {
  currentWeek: {
    completionRate: number;
    onTimeRate: number;
    efficiency: number;
    tasksCompleted: number;
    totalTasks: number;
  };
  previousWeek: {
    completionRate: number;
    onTimeRate: number;
    efficiency: number;
    tasksCompleted: number;
    totalTasks: number;
  };
  weekBeforePrevious?: {
    completionRate: number;
    onTimeRate: number;
    efficiency: number;
    tasksCompleted: number;
    totalTasks: number;
  };
}

interface WeeklyTrendAnalysisProps {
  comparison: WeeklyComparison;
}

export function WeeklyTrendAnalysis({ comparison }: WeeklyTrendAnalysisProps) {
  const { currentWeek, previousWeek, weekBeforePrevious } = comparison;

  // حساب الاتجاهات
  const calculateTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
    const difference = current - previous;
    if (Math.abs(difference) < 2) return 'stable'; // تغيير أقل من 2% يعتبر مستقر
    return difference > 0 ? 'up' : 'down';
  };

  const completionTrend = calculateTrend(currentWeek.completionRate, previousWeek.completionRate);
  const onTimeTrend = calculateTrend(currentWeek.onTimeRate, previousWeek.onTimeRate);
  const efficiencyTrend = calculateTrend(currentWeek.efficiency, previousWeek.efficiency);

  // بيانات الرسم البياني الخطي للاتجاهات
  const trendData = {
    labels: weekBeforePrevious 
      ? ['الأسبوع قبل السابق', 'الأسبوع السابق', 'الأسبوع الحالي']
      : ['الأسبوع السابق', 'الأسبوع الحالي'],
    datasets: [
      {
        label: 'نسبة الإكمال (%)',
        data: weekBeforePrevious
          ? [weekBeforePrevious.completionRate, previousWeek.completionRate, currentWeek.completionRate]
          : [previousWeek.completionRate, currentWeek.completionRate],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'الالتزام بالمواعيد (%)',
        data: weekBeforePrevious
          ? [weekBeforePrevious.onTimeRate, previousWeek.onTimeRate, currentWeek.onTimeRate]
          : [previousWeek.onTimeRate, currentWeek.onTimeRate],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'الكفاءة (%)',
        data: weekBeforePrevious
          ? [weekBeforePrevious.efficiency, previousWeek.efficiency, currentWeek.efficiency]
          : [previousWeek.efficiency, currentWeek.efficiency],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            family: 'system-ui, -apple-system, sans-serif',
            size: 12,
          },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#374151',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${Math.round(context.parsed.y)}%`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return value + '%';
          }
        },
      },
    },
  };

  // مكون لعرض الاتجاه
  const TrendIndicator = ({ trend, value, previousValue }: { 
    trend: 'up' | 'down' | 'stable', 
    value: number, 
    previousValue: number 
  }) => {
    const difference = value - previousValue;
    const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const color = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
    const bgColor = trend === 'up' ? 'bg-green-100' : trend === 'down' ? 'bg-red-100' : 'bg-gray-100';

    return (
      <div className={`flex items-center space-x-1 ${bgColor} px-2 py-1 rounded-md`}>
        <Icon className={`h-4 w-4 ${color}`} />
        <span className={`text-sm font-medium ${color}`}>
          {difference > 0 ? '+' : ''}{Math.round(difference)}%
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* الرسم البياني للاتجاهات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">تحليل الاتجاهات الأسبوعية</CardTitle>
          <CardDescription>
            مقارنة الأداء عبر الأسابيع لتحديد الاتجاهات والتحسينات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <Line data={trendData} options={lineChartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* ملخص المقارنات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">نسبة الإكمال</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{Math.round(currentWeek.completionRate)}%</div>
                <div className="text-sm text-muted-foreground">
                  السابق: {Math.round(previousWeek.completionRate)}%
                </div>
              </div>
              <TrendIndicator 
                trend={completionTrend} 
                value={currentWeek.completionRate} 
                previousValue={previousWeek.completionRate} 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">الالتزام بالمواعيد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{currentWeek.onTimeRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">
                  السابق: {previousWeek.onTimeRate.toFixed(1)}%
                </div>
              </div>
              <TrendIndicator 
                trend={onTimeTrend} 
                value={currentWeek.onTimeRate} 
                previousValue={previousWeek.onTimeRate} 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">الكفاءة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{currentWeek.efficiency.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">
                  السابق: {previousWeek.efficiency.toFixed(1)}%
                </div>
              </div>
              <TrendIndicator 
                trend={efficiencyTrend} 
                value={currentWeek.efficiency} 
                previousValue={previousWeek.efficiency} 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* تحليل التغييرات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">تحليل التغييرات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {completionTrend === 'up' && (
              <div className="flex items-center space-x-2 text-green-700 bg-green-50 p-3 rounded-md">
                <TrendingUp className="h-5 w-5" />
                <span>تحسن في نسبة إكمال المهام بمقدار {(currentWeek.completionRate - previousWeek.completionRate).toFixed(1)}%</span>
              </div>
            )}
            {completionTrend === 'down' && (
              <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-md">
                <TrendingDown className="h-5 w-5" />
                <span>انخفاض في نسبة إكمال المهام بمقدار {Math.abs(currentWeek.completionRate - previousWeek.completionRate).toFixed(1)}%</span>
              </div>
            )}
            {onTimeTrend === 'up' && (
              <div className="flex items-center space-x-2 text-green-700 bg-green-50 p-3 rounded-md">
                <TrendingUp className="h-5 w-5" />
                <span>تحسن في الالتزام بالمواعيد بمقدار {(currentWeek.onTimeRate - previousWeek.onTimeRate).toFixed(1)}%</span>
              </div>
            )}
            {onTimeTrend === 'down' && (
              <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-md">
                <TrendingDown className="h-5 w-5" />
                <span>انخفاض في الالتزام بالمواعيد بمقدار {Math.abs(currentWeek.onTimeRate - previousWeek.onTimeRate).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
