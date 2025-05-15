'use client';

/**
 * مكون شارة النتائج الرئيسية المرتبطة بالمهمة
 * 
 * يعرض هذا المكون شارة تفاعلية تعرض معلومات عن النتائج الرئيسية المرتبطة بالمهمة.
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Target, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import Link from 'next/link';

interface TaskKeyResultBadgeProps {
  taskId: string;
  size?: 'sm' | 'md';
}

interface KeyResult {
  id: string;
  title: string;
  objectiveId: string;
  objectiveTitle: string;
  periodId: string;
  progress: number;
  status: 'active' | 'completed' | 'at_risk' | 'behind';
}

export function TaskKeyResultBadge({ taskId, size = 'md' }: TaskKeyResultBadgeProps) {
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  // جلب النتائج الرئيسية المرتبطة بالمهمة
  useEffect(() => {
    if (!taskId) return;
    
    const fetchKeyResults = async () => {
      try {
        setLoading(true);
        
        const getKeyResultsForTask = httpsCallable<
          { taskId: string },
          { keyResults: KeyResult[]; objectives: any[]; links: any[] }
        >(functions, 'getKeyResultsForTask');
        
        const result = await getKeyResultsForTask({ taskId });
        
        // دمج النتائج الرئيسية مع معلومات الأهداف
        const keyResultsWithObjectives = result.data.keyResults.map(kr => {
          const objective = result.data.objectives.find(o => o.id === kr.objectiveId);
          return {
            ...kr,
            objectiveTitle: objective?.title || 'هدف غير معروف'
          };
        });
        
        setKeyResults(keyResultsWithObjectives);
      } catch (error) {
        console.error('Error fetching key results for task:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (open) {
      fetchKeyResults();
    }
  }, [taskId, open]);
  
  // الحصول على لون حالة النتيجة الرئيسية
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800';
      case 'behind': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // الحصول على نص حالة النتيجة الرئيسية
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'نشطة';
      case 'at_risk': return 'في خطر';
      case 'behind': return 'متأخرة';
      case 'completed': return 'مكتملة';
      default: return status;
    }
  };
  
  if (keyResults.length === 0 && !loading) return null;
  
  const badge = (
    <Badge 
      variant="outline" 
      className={`bg-primary/10 text-primary border-primary/20 cursor-pointer ${
        size === 'sm' ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5'
      }`}
    >
      <Target className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} ml-1`} />
      {keyResults.length > 0 ? `${keyResults.length} OKR` : 'OKR'}
    </Badge>
  );
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {loading ? (
          <Skeleton className={`${size === 'sm' ? 'h-5 w-16' : 'h-6 w-20'} rounded-full`} />
        ) : (
          badge
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Target className="ml-2 h-4 w-4 text-primary" />
            النتائج الرئيسية المرتبطة
          </h3>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : keyResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              لا توجد نتائج رئيسية مرتبطة بهذه المهمة.
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {keyResults.map(keyResult => (
                <div key={keyResult.id} className="border rounded-md p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge className={getStatusColor(keyResult.status)}>
                        {getStatusText(keyResult.status)}
                      </Badge>
                      <h4 className="font-medium text-sm mt-1">{keyResult.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        الهدف: {keyResult.objectiveTitle}
                      </p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-7 px-2 text-xs"
                    >
                      <Link href={`/org/okr/${keyResult.periodId}/objective/${keyResult.objectiveId}/key-result/${keyResult.id}`} target="_blank">
                        <ExternalLink className="ml-1 h-3 w-3" />
                        عرض
                      </Link>
                    </Button>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-muted-foreground">التقدم</span>
                      <span className="font-medium">{Math.round(keyResult.progress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${keyResult.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
