'use client';

import React from 'react';
import { Bar, Radar } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Users, Target, Clock } from 'lucide-react';

interface DepartmentPerformance {
  id: string;
  name: string;
  completionRate: number;
  tasksCompleted: number;
  tasksTotal: number;
  efficiency: number;
  onTimeRate: number;
  averageTaskDuration: number; // بالساعات
  teamSize: number;
  trend: 'up' | 'down' | 'stable';
}

interface DepartmentAnalysisProps {
  departments: DepartmentPerformance[];
}

export function DepartmentAnalysis({ departments }: DepartmentAnalysisProps) {
  // ترتيب الأقسام حسب الأداء
  const sortedDepartments = [...departments].sort((a, b) => b.completionRate - a.completionRate);
  const topPerformer = sortedDepartments[0];
  const needsImprovement = sortedDepartments[sortedDepartments.length - 1];

  // بيانات الرسم البياني الشريطي للمقارنة
  const comparisonData = {
    labels: departments.map(dept => dept.name),
    datasets: [
      {
        label: 'نسبة الإكمال (%)',
        data: departments.map(dept => dept.completionRate),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: '#10b981',
        borderWidth: 1,
      },
      {
        label: 'الكفاءة (%)',
        data: departments.map(dept => dept.efficiency),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 1,
      },
      {
        label: 'الالتزام بالمواعيد (%)',
        data: departments.map(dept => dept.onTimeRate),
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderColor: '#f59e0b',
        borderWidth: 1,
      },
    ],
  };

  // بيانات الرسم البياني الرادار للقسم الأفضل
  const radarData = topPerformer ? {
    labels: ['نسبة الإكمال', 'الكفاءة', 'الالتزام بالمواعيد', 'سرعة الإنجاز', 'حجم الفريق'],
    datasets: [
      {
        label: topPerformer.name,
        data: [
          topPerformer.completionRate,
          topPerformer.efficiency,
          topPerformer.onTimeRate,
          Math.max(0, 100 - (topPerformer.averageTaskDuration * 10)), // تحويل مدة المهمة إلى نقاط سرعة
          Math.min(100, topPerformer.teamSize * 10), // تحويل حجم الفريق إلى نقاط
        ],
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10b981',
        borderWidth: 2,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#10b981',
      },
    ],
  } : null;

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
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10,
          },
          maxRotation: 45,
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

  const radarOptions = {
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
        },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        pointLabels: {
          font: {
            size: 11,
          },
        },
        ticks: {
          display: false,
        },
      },
    },
  };

  // مكون لعرض الاتجاه
  const TrendBadge = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const color = trend === 'up' ? 'bg-green-100 text-green-800' : 
                  trend === 'down' ? 'bg-red-100 text-red-800' : 
                  'bg-gray-100 text-gray-800';

    return (
      <Badge variant="secondary" className={color}>
        <Icon className="h-3 w-3 ml-1" />
        {trend === 'up' ? 'متحسن' : trend === 'down' ? 'متراجع' : 'مستقر'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* مقارنة الأقسام */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">مقارنة أداء الأقسام</CardTitle>
          <CardDescription>
            مقارنة شاملة لمؤشرات الأداء الرئيسية عبر جميع الأقسام
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <Bar data={comparisonData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* أفضل قسم - تحليل رادار */}
      {topPerformer && radarData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">تحليل القسم الأفضل أداءً</CardTitle>
            <CardDescription>
              تحليل متعدد الأبعاد لأداء قسم {topPerformer.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Radar data={radarData} options={radarOptions} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* تفاصيل الأقسام */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <Card key={dept.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{dept.name}</CardTitle>
                <TrendBadge trend={dept.trend} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* نسبة الإكمال */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>نسبة الإكمال</span>
                  <span className="font-medium">{Math.round(dept.completionRate)}%</span>
                </div>
                <Progress value={dept.completionRate} className="h-2" />
              </div>

              {/* الكفاءة */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>الكفاءة</span>
                  <span className="font-medium">{dept.efficiency.toFixed(1)}%</span>
                </div>
                <Progress value={dept.efficiency} className="h-2" />
              </div>

              {/* الالتزام بالمواعيد */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>الالتزام بالمواعيد</span>
                  <span className="font-medium">{dept.onTimeRate.toFixed(1)}%</span>
                </div>
                <Progress value={dept.onTimeRate} className="h-2" />
              </div>

              {/* إحصائيات إضافية */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">المهام</div>
                  <div className="text-sm font-medium">{dept.tasksCompleted}/{dept.tasksTotal}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">الفريق</div>
                  <div className="text-sm font-medium">{dept.teamSize}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">متوسط المدة</div>
                  <div className="text-sm font-medium">{dept.averageTaskDuration.toFixed(1)}س</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* تحليل الأداء */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* أفضل الأقسام */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-700">الأقسام الأفضل أداءً</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedDepartments.slice(0, 3).map((dept, index) => (
                <div key={dept.id} className="flex items-center justify-between p-3 bg-green-50 rounded-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <span className="font-medium">{dept.name}</span>
                  </div>
                  <span className="text-green-700 font-bold">{dept.completionRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* الأقسام التي تحتاج تحسين */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-amber-700">الأقسام التي تحتاج تحسين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedDepartments.slice(-3).reverse().map((dept) => (
                <div key={dept.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-md">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{dept.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-700 font-bold">{dept.completionRate.toFixed(1)}%</div>
                    <div className="text-xs text-amber-600">
                      {dept.tasksCompleted}/{dept.tasksTotal} مهام
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
