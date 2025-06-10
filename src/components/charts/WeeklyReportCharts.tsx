'use client';

import React from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskSummary } from '@/services/ai';
import { defaultChartOptions, pieChartOptions, chartColors } from '@/config/charts';

interface WeeklyReportChartsProps {
  completedTasks?: TaskSummary[];
  inProgressTasks?: TaskSummary[];
  upcomingTasks?: TaskSummary[];
  blockedTasks?: TaskSummary[];
  overdueTasks?: TaskSummary[];
  keyMetrics?: {
    completionRate?: number;
    onTimeCompletionRate?: number;
    averageProgress?: number;
  };
}

export function WeeklyReportCharts({
  completedTasks = [],
  inProgressTasks = [],
  upcomingTasks = [],
  blockedTasks = [],
  overdueTasks = [],
  keyMetrics = {}
}: WeeklyReportChartsProps) {

  // بيانات الرسم البياني الدائري لتوزيع المهام
  const taskDistributionData = {
    labels: ['مكتملة', 'قيد التنفيذ', 'قادمة', 'معلقة', 'فائتة'],
    datasets: [
      {
        data: [
          completedTasks.length,
          inProgressTasks.length,
          upcomingTasks.length,
          blockedTasks.length,
          overdueTasks.length
        ],
        backgroundColor: [
          chartColors.success, // أخضر للمكتملة
          chartColors.primary, // أزرق للقيد التنفيذ
          chartColors.warning, // برتقالي للقادمة
          chartColors.secondary, // رمادي للمعلقة
          chartColors.danger  // أحمر للفائتة
        ],
        borderColor: [
          chartColors.success,
          chartColors.primary,
          chartColors.warning,
          chartColors.secondary,
          chartColors.danger
        ],
        borderWidth: 2,
      },
    ],
  };

  // بيانات الرسم البياني الشريطي للأولويات
  const priorityData = {
    labels: ['أولوية عالية', 'أولوية متوسطة', 'أولوية منخفضة', 'بدون أولوية'],
    datasets: [
      {
        label: 'مكتملة',
        data: [
          completedTasks.filter(t => t.priority === 'high').length,
          completedTasks.filter(t => t.priority === 'medium').length,
          completedTasks.filter(t => t.priority === 'low').length,
          completedTasks.filter(t => !t.priority).length,
        ],
        backgroundColor: '#10b981',
        borderColor: '#059669',
        borderWidth: 1,
      },
      {
        label: 'قيد التنفيذ',
        data: [
          inProgressTasks.filter(t => t.priority === 'high').length,
          inProgressTasks.filter(t => t.priority === 'medium').length,
          inProgressTasks.filter(t => t.priority === 'low').length,
          inProgressTasks.filter(t => !t.priority).length,
        ],
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 1,
      },
      {
        label: 'قادمة',
        data: [
          upcomingTasks.filter(t => t.priority === 'high').length,
          upcomingTasks.filter(t => t.priority === 'medium').length,
          upcomingTasks.filter(t => t.priority === 'low').length,
          upcomingTasks.filter(t => !t.priority).length,
        ],
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        borderWidth: 1,
      },
    ],
  };

  // بيانات مؤشرات الأداء الرئيسية
  const kpiData = {
    labels: ['نسبة الإكمال', 'الالتزام بالمواعيد', 'متوسط التقدم'],
    datasets: [
      {
        label: 'النسبة المئوية',
        data: [
          keyMetrics.completionRate || 0,
          keyMetrics.onTimeCompletionRate || 0,
          keyMetrics.averageProgress || 0,
        ],
        backgroundColor: [
          '#10b981',
          '#3b82f6',
          '#f59e0b',
        ],
        borderColor: [
          '#059669',
          '#2563eb',
          '#d97706',
        ],
        borderWidth: 2,
      },
    ],
  };

  // خيارات الرسوم البيانية
  const chartOptions = {
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
      },
    },
  };

  const barChartOptions = {
    ...chartOptions,
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
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
    },
  };

  const pieChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'right' as const,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* الرسوم البيانية الرئيسية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* توزيع المهام */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">توزيع المهام حسب الحالة</CardTitle>
            <CardDescription>
              نظرة عامة على حالة جميع المهام في الأسبوع
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Pie data={taskDistributionData} options={pieChartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* مؤشرات الأداء الرئيسية */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">مؤشرات الأداء الرئيسية</CardTitle>
            <CardDescription>
              قياس الكفاءة والإنتاجية الأسبوعية
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar data={kpiData} options={barChartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* تحليل الأولويات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">تحليل المهام حسب الأولوية</CardTitle>
          <CardDescription>
            توزيع المهام المكتملة وقيد التنفيذ والقادمة حسب مستوى الأولوية
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <Bar data={priorityData} options={barChartOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
