/**
 * مكون عرض إحصائيات الموافقات
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users
} from 'lucide-react';
import { ApprovalStats } from '@/services/approvalReports';

interface ApprovalStatsCardProps {
  stats: ApprovalStats | null;
  loading: boolean;
  title?: string;
}

export function ApprovalStatsCard({ stats, loading, title = "إحصائيات الموافقات" }: ApprovalStatsCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">لا توجد بيانات متاحة</p>
        </CardContent>
      </Card>
    );
  }

  const totalTasks = stats.totalPendingTasks + stats.totalApprovedTasks + stats.totalRejectedTasks;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="ml-2 h-5 w-5 text-green-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* الإحصائيات الرئيسية */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600">{stats.totalPendingTasks}</div>
            <p className="text-xs text-muted-foreground">معلقة</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.totalApprovedTasks}</div>
            <p className="text-xs text-muted-foreground">معتمدة</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.totalRejectedTasks}</div>
            <p className="text-xs text-muted-foreground">مرفوضة</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">إجمالي</p>
          </div>
        </div>

        {/* معدلات الموافقة والرفض */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">معدل الموافقة</span>
              <span className="text-sm text-green-600 font-medium">
                {Math.round(stats.approvalRate)}%
              </span>
            </div>
            <Progress value={stats.approvalRate} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">معدل الرفض</span>
              <span className="text-sm text-red-600 font-medium">
                {Math.round(stats.rejectionRate)}%
              </span>
            </div>
            <Progress value={stats.rejectionRate} className="h-2" />
          </div>
        </div>

        {/* متوسط وقت الموافقة */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-muted-foreground ml-2" />
              <span className="text-sm font-medium">متوسط وقت الموافقة</span>
            </div>
            <Badge variant="outline">
              {stats.averageApprovalTime < 24
                ? `${Math.round(stats.averageApprovalTime)} ساعة`
                : `${Math.round(stats.averageApprovalTime / 24)} يوم`
              }
            </Badge>
          </div>
        </div>

        {/* توزيع المهام المعلقة حسب المستوى */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">المهام المعلقة حسب المستوى</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">{stats.departmentPendingTasks}</div>
              <p className="text-xs text-blue-600">مستوى القسم</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-purple-600">{stats.organizationPendingTasks}</div>
              <p className="text-xs text-purple-600">مستوى المؤسسة</p>
            </div>
          </div>
        </div>

        {/* أكثر المستخدمين نشاطاً في الموافقات */}
        {Object.keys(stats.approvalsByUser).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 ml-1" />
              أكثر المستخدمين نشاطاً
            </h4>
            <div className="space-y-1">
              {Object.entries(stats.approvalsByUser)
                .sort(([,a], [,b]) => (b.approved + b.rejected) - (a.approved + a.rejected))
                .slice(0, 3)
                .map(([userId, data]) => (
                  <div key={userId} className="flex items-center justify-between text-xs">
                    <span className="truncate">{data.name}</span>
                    <div className="flex items-center space-x-1 space-x-reverse">
                      <Badge variant="outline" className="text-xs">
                        {data.approved + data.rejected}
                      </Badge>
                      {data.approved > data.rejected ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
