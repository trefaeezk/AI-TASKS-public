/**
 * مكون إحصائيات الموافقات حسب الأقسام
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { DepartmentApprovalStats as DepartmentStats } from '@/services/approvalReports';

interface DepartmentApprovalStatsProps {
  departments: DepartmentStats[];
  loading: boolean;
  title?: string;
  onDepartmentClick?: (departmentId: string) => void;
}

export function DepartmentApprovalStats({ 
  departments, 
  loading, 
  title = "إحصائيات الأقسام",
  onDepartmentClick 
}: DepartmentApprovalStatsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-2 w-full" />
                <div className="flex space-x-2 space-x-reverse">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building className="ml-2 h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد بيانات أقسام متاحة</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // حساب الإحصائيات الإجمالية
  const totalStats = departments.reduce((acc, dept) => ({
    pendingTasks: acc.pendingTasks + dept.pendingTasks,
    approvedTasks: acc.approvedTasks + dept.approvedTasks,
    rejectedTasks: acc.rejectedTasks + dept.rejectedTasks,
    totalTasks: acc.totalTasks + dept.pendingTasks + dept.approvedTasks + dept.rejectedTasks
  }), { pendingTasks: 0, approvedTasks: 0, rejectedTasks: 0, totalTasks: 0 });

  // ترتيب الأقسام حسب عدد المهام المعلقة
  const sortedDepartments = [...departments].sort((a, b) => b.pendingTasks - a.pendingTasks);

  // دالة لتحديد لون معدل الموافقة
  const getApprovalRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // دالة لتحديد لون وقت الموافقة
  const getApprovalTimeColor = (hours: number) => {
    if (hours <= 24) return 'text-green-600';
    if (hours <= 72) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Building className="ml-2 h-5 w-5" />
            {title}
          </div>
          <Badge variant="outline">
            {departments.length} قسم
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* الإحصائيات الإجمالية */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{totalStats.pendingTasks}</div>
            <p className="text-xs text-muted-foreground">معلقة</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{totalStats.approvedTasks}</div>
            <p className="text-xs text-muted-foreground">معتمدة</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{totalStats.rejectedTasks}</div>
            <p className="text-xs text-muted-foreground">مرفوضة</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{totalStats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">إجمالي</p>
          </div>
        </div>

        {/* قائمة الأقسام */}
        <div className="space-y-4">
          {sortedDepartments.map((department) => {
            const totalDeptTasks = department.pendingTasks + department.approvedTasks + department.rejectedTasks;
            const hasUrgentTasks = department.pendingTasks > 5 || department.averageApprovalTime > 72;
            
            return (
              <div 
                key={department.departmentId} 
                className={`border rounded-lg p-4 transition-colors ${
                  hasUrgentTasks ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Building className="h-5 w-5 text-muted-foreground ml-2" />
                    <h3 className="font-medium">{department.departmentName}</h3>
                    {hasUrgentTasks && (
                      <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                    )}
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    {onDepartmentClick && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDepartmentClick(department.departmentId)}
                        className="h-8"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* إحصائيات القسم */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="text-lg font-bold text-orange-600">{department.pendingTasks}</div>
                    <p className="text-xs text-muted-foreground">معلقة</p>
                  </div>
                  
                  <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
                    <div className="flex items-center justify-center mb-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-lg font-bold text-green-600">{department.approvedTasks}</div>
                    <p className="text-xs text-muted-foreground">معتمدة</p>
                  </div>
                  
                  <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded">
                    <div className="flex items-center justify-center mb-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="text-lg font-bold text-red-600">{department.rejectedTasks}</div>
                    <p className="text-xs text-muted-foreground">مرفوضة</p>
                  </div>
                  
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                    <div className="flex items-center justify-center mb-1">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-lg font-bold text-blue-600">{totalDeptTasks}</div>
                    <p className="text-xs text-muted-foreground">إجمالي</p>
                  </div>
                </div>

                {/* معدل الموافقة */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">معدل الموافقة</span>
                    <span className={`text-sm font-medium ${getApprovalRateColor(department.approvalRate)}`}>
                      {department.approvalRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={department.approvalRate} className="h-2" />
                </div>

                {/* متوسط وقت الموافقة */}
                <div className="flex justify-between items-center mt-3 p-2 bg-muted/30 rounded">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                    <span className="text-sm">متوسط وقت الموافقة</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getApprovalTimeColor(department.averageApprovalTime)}
                  >
                    {department.averageApprovalTime < 24
                      ? `${Math.round(department.averageApprovalTime)} ساعة`
                      : `${Math.round(department.averageApprovalTime / 24)} يوم`
                    }
                  </Badge>
                </div>

                {/* تحذيرات */}
                {hasUrgentTasks && (
                  <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-sm">
                    <div className="flex items-center text-orange-700 dark:text-orange-300">
                      <AlertTriangle className="h-4 w-4 ml-2" />
                      <span className="font-medium">يحتاج انتباه:</span>
                    </div>
                    <ul className="mt-1 text-orange-600 dark:text-orange-400 text-xs space-y-1">
                      {department.pendingTasks > 5 && (
                        <li>• عدد كبير من المهام المعلقة ({department.pendingTasks})</li>
                      )}
                      {department.averageApprovalTime > 72 && (
                        <li>• وقت موافقة طويل ({(department.averageApprovalTime / 24).toFixed(1)} يوم)</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
