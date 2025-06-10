'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Printer,
  ArrowLeft,
  Calendar,
  Award,
  Activity
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  getWeeklyStats,
  getDepartmentPerformance,
  getWeeklyHighlights,
  WeeklyStats,
  DepartmentPerformance,
  WeeklyHighlight
} from '@/services/organizationReports';

interface WeeklyReportProps {
  organizationId: string;
  onBack: () => void;
}

export function WeeklyReport({ organizationId, onBack }: WeeklyReportProps) {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [departmentPerformance, setDepartmentPerformance] = useState<DepartmentPerformance[]>([]);
  const [highlights, setHighlights] = useState<WeeklyHighlight[]>([]);
  const [loading, setLoading] = useState(false);

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 6 }); // السبت
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 6 });

  // جلب البيانات الحقيقية
  useEffect(() => {
    const fetchData = async () => {
      if (!organizationId) return;

      setLoading(true);
      try {
        const [statsData, departmentData, highlightsData] = await Promise.all([
          getWeeklyStats(organizationId, selectedWeek),
          getDepartmentPerformance(organizationId, selectedWeek),
          getWeeklyHighlights(organizationId, selectedWeek)
        ]);

        setWeeklyStats(statsData);
        setDepartmentPerformance(departmentData);
        setHighlights(highlightsData);
      } catch (error) {
        console.error('Error fetching weekly report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, selectedWeek]);

  const getCompletionRate = (completed: number, total: number) => {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  const getHighlightIcon = (type: string) => {
    switch (type) {
      case 'achievement': return <Award className="h-5 w-5 text-green-600" />;
      case 'milestone': return <Target className="h-5 w-5 text-blue-600" />;
      case 'challenge': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default: return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getHighlightColor = (type: string) => {
    switch (type) {
      case 'achievement': return 'border-l-green-500 bg-green-50';
      case 'milestone': return 'border-l-blue-500 bg-blue-50';
      case 'challenge': return 'border-l-orange-500 bg-orange-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  if (loading || !weeklyStats) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="text-lg font-medium">جاري تحميل التقرير الأسبوعي...</div>
          <div className="text-sm text-muted-foreground mt-2">يرجى الانتظار</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* العنوان والتنقل */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <BarChart3 className="ml-2 h-6 w-6" />
              التقرير الأسبوعي
            </h1>
            <p className="text-muted-foreground">
              {format(weekStart, 'd MMMM', { locale: ar })} - {format(weekEnd, 'd MMMM yyyy', { locale: ar })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}>
            الأسبوع السابق
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedWeek(new Date())}>
            هذا الأسبوع
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}>
            الأسبوع التالي
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm">
            <Printer className="ml-2 h-4 w-4" />
            طباعة
          </Button>
          <Button variant="outline" size="sm">
            <Download className="ml-2 h-4 w-4" />
            تحميل
          </Button>
        </div>
      </div>

      {/* الإحصائيات الرئيسية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">المهام المكتملة</p>
                <p className="text-2xl font-bold">{weeklyStats.tasksCompleted}</p>
                <p className="text-xs text-muted-foreground">من {weeklyStats.tasksTotal}</p>
              </div>
              <div className="text-right">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <p className="text-sm font-medium text-green-600">
                  {getCompletionRate(weeklyStats.tasksCompleted, weeklyStats.tasksTotal)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ساعات العمل</p>
                <p className="text-2xl font-bold">{weeklyStats.hoursWorked}</p>
                <p className="text-xs text-muted-foreground">من {weeklyStats.hoursPlanned}</p>
              </div>
              <div className="text-right">
                <Clock className="h-8 w-8 text-blue-600" />
                <p className="text-sm font-medium text-blue-600">
                  {getCompletionRate(weeklyStats.hoursWorked, weeklyStats.hoursPlanned)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">الاجتماعات</p>
                <p className="text-2xl font-bold">{weeklyStats.meetingsHeld}</p>
                <p className="text-xs text-muted-foreground">من {weeklyStats.meetingsPlanned}</p>
              </div>
              <div className="text-right">
                <Users className="h-8 w-8 text-purple-600" />
                <p className="text-sm font-medium text-purple-600">
                  {getCompletionRate(weeklyStats.meetingsHeld, weeklyStats.meetingsPlanned)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">الأهداف المحققة</p>
                <p className="text-2xl font-bold">{weeklyStats.goalsAchieved}</p>
                <p className="text-xs text-muted-foreground">من {weeklyStats.goalsTotal}</p>
              </div>
              <div className="text-right">
                <Target className="h-8 w-8 text-orange-600" />
                <p className="text-sm font-medium text-orange-600">
                  {getCompletionRate(weeklyStats.goalsAchieved, weeklyStats.goalsTotal)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* أداء الأقسام */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>أداء الأقسام</CardTitle>
              <CardDescription>معدل إنجاز المهام والكفاءة لكل قسم</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {departmentPerformance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد بيانات أداء للأقسام في هذا الأسبوع
                </div>
              ) : (
                departmentPerformance.map((dept) => (
                <div key={dept.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{dept.name}</h4>
                      {getTrendIcon(dept.trend)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {dept.completionRate}%
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {dept.tasksCompleted}/{dept.tasksTotal}
                      </span>
                    </div>
                  </div>
                  <Progress value={dept.completionRate} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>الكفاءة: {dept.efficiency}%</span>
                    <span>
                      {dept.trend === 'up' ? 'تحسن' : dept.trend === 'down' ? 'تراجع' : 'مستقر'}
                    </span>
                  </div>
                </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* أبرز الأحداث */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>أبرز أحداث الأسبوع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {highlights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد أحداث بارزة لهذا الأسبوع
                </div>
              ) : (
                highlights.map((highlight) => (
                <div key={highlight.id} className={`p-3 border-l-4 rounded-r-lg ${getHighlightColor(highlight.type)}`}>
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {getHighlightIcon(highlight.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{highlight.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{highlight.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        {highlight.department && (
                          <Badge variant="outline" className="text-xs">
                            {highlight.department}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(highlight.date, 'dd/MM', { locale: ar })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>


    </div>
  );
}
