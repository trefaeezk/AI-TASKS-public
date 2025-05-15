'use client';

/**
 * إحصائيات OKR
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { Target, CheckCircle, AlertTriangle, Clock, BarChart3 } from 'lucide-react';

interface OkrStatsProps {
  organizationId?: string;
  periodId?: string;
  departmentId?: string;
}

interface OkrStatsData {
  totalObjectives: number;
  completedObjectives: number;
  atRiskObjectives: number;
  behindObjectives: number;
  totalKeyResults: number;
  completedKeyResults: number;
  atRiskKeyResults: number;
  behindKeyResults: number;
  averageObjectiveProgress: number;
  averageKeyResultProgress: number;
  linkedTasksCount: number;
  completedLinkedTasksCount: number;
}

export function OkrStats({ organizationId, periodId, departmentId }: OkrStatsProps) {
  const [stats, setStats] = useState<OkrStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // في الإصدار الحالي، سنستخدم بيانات وهمية
        // في المستقبل، سيتم استبدال هذا بطلب فعلي إلى Firebase Functions
        
        // مثال على طلب Firebase Function:
        // const getOkrStats = httpsCallable<
        //   { organizationId: string; periodId?: string; departmentId?: string },
        //   { stats: OkrStatsData }
        // >(functions, 'getOkrStats');
        // 
        // const result = await getOkrStats({
        //   organizationId,
        //   periodId,
        //   departmentId,
        // });
        // 
        // setStats(result.data.stats);
        
        // بيانات وهمية للعرض
        setTimeout(() => {
          setStats({
            totalObjectives: 12,
            completedObjectives: 5,
            atRiskObjectives: 2,
            behindObjectives: 1,
            totalKeyResults: 36,
            completedKeyResults: 18,
            atRiskKeyResults: 6,
            behindKeyResults: 3,
            averageObjectiveProgress: 62,
            averageKeyResultProgress: 58,
            linkedTasksCount: 48,
            completedLinkedTasksCount: 32,
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error fetching OKR stats:', error);
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [organizationId, periodId, departmentId]);
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  
  if (!stats) {
    return null;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">الأهداف</p>
              <h3 className="text-2xl font-bold">{stats.totalObjectives}</h3>
            </div>
            <Target className="h-8 w-8 text-primary opacity-80" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">متوسط التقدم</span>
              <span className="font-medium">{Math.round(stats.averageObjectiveProgress)}%</span>
            </div>
            <Progress value={stats.averageObjectiveProgress} className="h-1" />
            
            <div className="flex justify-between text-xs mt-2">
              <div className="flex items-center">
                <CheckCircle className="ml-1 h-3 w-3 text-green-500" />
                <span>مكتملة: {stats.completedObjectives}</span>
              </div>
              <div className="flex items-center">
                <AlertTriangle className="ml-1 h-3 w-3 text-amber-500" />
                <span>في خطر: {stats.atRiskObjectives}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">النتائج الرئيسية</p>
              <h3 className="text-2xl font-bold">{stats.totalKeyResults}</h3>
            </div>
            <BarChart3 className="h-8 w-8 text-primary opacity-80" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">متوسط التقدم</span>
              <span className="font-medium">{Math.round(stats.averageKeyResultProgress)}%</span>
            </div>
            <Progress value={stats.averageKeyResultProgress} className="h-1" />
            
            <div className="flex justify-between text-xs mt-2">
              <div className="flex items-center">
                <CheckCircle className="ml-1 h-3 w-3 text-green-500" />
                <span>مكتملة: {stats.completedKeyResults}</span>
              </div>
              <div className="flex items-center">
                <AlertTriangle className="ml-1 h-3 w-3 text-amber-500" />
                <span>في خطر: {stats.atRiskKeyResults}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">المهام المرتبطة</p>
              <h3 className="text-2xl font-bold">{stats.linkedTasksCount}</h3>
            </div>
            <Clock className="h-8 w-8 text-primary opacity-80" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">نسبة الإكمال</span>
              <span className="font-medium">
                {stats.linkedTasksCount > 0
                  ? Math.round((stats.completedLinkedTasksCount / stats.linkedTasksCount) * 100)
                  : 0}%
              </span>
            </div>
            <Progress
              value={stats.linkedTasksCount > 0
                ? (stats.completedLinkedTasksCount / stats.linkedTasksCount) * 100
                : 0}
              className="h-1"
            />
            
            <div className="flex justify-between text-xs mt-2">
              <div className="flex items-center">
                <CheckCircle className="ml-1 h-3 w-3 text-green-500" />
                <span>مكتملة: {stats.completedLinkedTasksCount}</span>
              </div>
              <div className="flex items-center">
                <Clock className="ml-1 h-3 w-3 text-blue-500" />
                <span>قيد التنفيذ: {stats.linkedTasksCount - stats.completedLinkedTasksCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">التقدم العام</p>
              <h3 className="text-2xl font-bold">
                {Math.round((stats.averageObjectiveProgress + stats.averageKeyResultProgress) / 2)}%
              </h3>
            </div>
            <CheckCircle className="h-8 w-8 text-primary opacity-80" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">الأهداف المكتملة</span>
              <span className="font-medium">
                {stats.totalObjectives > 0
                  ? Math.round((stats.completedObjectives / stats.totalObjectives) * 100)
                  : 0}%
              </span>
            </div>
            <Progress
              value={stats.totalObjectives > 0
                ? (stats.completedObjectives / stats.totalObjectives) * 100
                : 0}
              className="h-1"
            />
            
            <div className="flex justify-between text-xs mt-2">
              <span className="text-muted-foreground">النتائج المكتملة</span>
              <span className="font-medium">
                {stats.totalKeyResults > 0
                  ? Math.round((stats.completedKeyResults / stats.totalKeyResults) * 100)
                  : 0}%
              </span>
            </div>
            <Progress
              value={stats.totalKeyResults > 0
                ? (stats.completedKeyResults / stats.totalKeyResults) * 100
                : 0}
              className="h-1"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
