/**
 * مكون ملخص الموافقات للوحة التحكم
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import { getApprovalStats, type ApprovalStats } from '@/services/approvalReports';

interface ApprovalSummaryCardProps {
  organizationId: string;
  departmentId?: string;
  title?: string;
  showDetailsLink?: boolean;
}

export function ApprovalSummaryCard({ 
  organizationId, 
  departmentId,
  title = "ملخص الموافقات",
  showDetailsLink = true
}: ApprovalSummaryCardProps) {
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getApprovalStats(organizationId, departmentId);
        setStats(data);
      } catch (err) {
        console.error('Error fetching approval stats:', err);
        setError('فشل في جلب البيانات');
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchStats();
    }
  }, [organizationId, departmentId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{error || 'لا توجد بيانات متاحة'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalTasks = stats.totalPendingTasks + stats.totalApprovedTasks + stats.totalRejectedTasks;
  const hasUrgentTasks = stats.totalPendingTasks > 10 || stats.averageApprovalTime > 72;
  const approvalTrend = stats.approvalRate > 70 ? 'positive' : stats.approvalRate > 50 ? 'neutral' : 'negative';

  return (
    <Card className={hasUrgentTasks ? 'border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="ml-2 h-5 w-5 text-green-500" />
            {title}
          </div>
          {hasUrgentTasks && (
            <Badge variant="outline" className="border-orange-500 text-orange-600">
              يحتاج انتباه
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* الإحصائيات الرئيسية */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div className="text-lg font-bold text-orange-600">{stats.totalPendingTasks}</div>
            <p className="text-xs text-muted-foreground">معلقة</p>
          </div>
          
          <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
            <div className="flex items-center justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-lg font-bold text-green-600">{stats.totalApprovedTasks}</div>
            <p className="text-xs text-muted-foreground">معتمدة</p>
          </div>
          
          <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded">
            <div className="flex items-center justify-center mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-lg font-bold text-red-600">{stats.totalRejectedTasks}</div>
            <p className="text-xs text-muted-foreground">مرفوضة</p>
          </div>
        </div>

        {/* معدل الموافقة */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">معدل الموافقة</span>
            <div className="flex items-center">
              <span className={`text-sm font-medium ml-2 ${
                approvalTrend === 'positive' ? 'text-green-600' : 
                approvalTrend === 'neutral' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {stats.approvalRate.toFixed(1)}%
              </span>
              {approvalTrend === 'positive' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : approvalTrend === 'neutral' ? (
                <div className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          <Progress value={stats.approvalRate} className="h-2" />
        </div>

        {/* متوسط وقت الموافقة */}
        <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-muted-foreground ml-2" />
            <span className="text-sm">متوسط وقت الموافقة</span>
          </div>
          <Badge 
            variant="outline" 
            className={
              stats.averageApprovalTime <= 24 ? 'border-green-500 text-green-600' :
              stats.averageApprovalTime <= 72 ? 'border-yellow-500 text-yellow-600' :
              'border-red-500 text-red-600'
            }
          >
            {stats.averageApprovalTime < 24
              ? `${Math.round(stats.averageApprovalTime)} ساعة`
              : `${Math.round(stats.averageApprovalTime / 24)} يوم`
            }
          </Badge>
        </div>

        {/* توزيع المهام المعلقة */}
        {(stats.departmentPendingTasks > 0 || stats.organizationPendingTasks > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">المهام المعلقة حسب المستوى</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                <div className="text-sm font-bold text-blue-600">{stats.departmentPendingTasks}</div>
                <p className="text-xs text-blue-600">مستوى القسم</p>
              </div>
              <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                <div className="text-sm font-bold text-purple-600">{stats.organizationPendingTasks}</div>
                <p className="text-xs text-purple-600">مستوى المؤسسة</p>
              </div>
            </div>
          </div>
        )}

        {/* تحذيرات */}
        {hasUrgentTasks && (
          <div className="p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-sm">
            <div className="flex items-center text-orange-700 dark:text-orange-300 mb-1">
              <AlertTriangle className="h-4 w-4 ml-2" />
              <span className="font-medium">يحتاج انتباه:</span>
            </div>
            <ul className="text-orange-600 dark:text-orange-400 text-xs space-y-1">
              {stats.totalPendingTasks > 10 && (
                <li>• عدد كبير من المهام المعلقة ({stats.totalPendingTasks})</li>
              )}
              {stats.averageApprovalTime > 72 && (
                <li>• وقت موافقة طويل ({(stats.averageApprovalTime / 24).toFixed(1)} يوم)</li>
              )}
            </ul>
          </div>
        )}

        {/* رابط التفاصيل */}
        {showDetailsLink && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/org/reports/approval">
              عرض التقرير المفصل
              <ArrowRight className="mr-2 h-4 w-4" />
            </Link>
          </Button>
        )}

        {/* ملاحظة */}
        <p className="text-xs text-muted-foreground text-center">
          آخر تحديث: الآن
        </p>
      </CardContent>
    </Card>
  );
}
