'use client';

/**
 * مكون قسم النتائج الرئيسية المرتبطة بالمهمة
 * 
 * يعرض هذا المكون النتائج الرئيسية المرتبطة بالمهمة ويسمح بإدارتها.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from '@/components/ui/use-toast';
import { Target, Link as LinkIcon, Unlink, ExternalLink, PlusCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LinkTaskToKeyResultDialog } from '@/components/okr/LinkTaskToKeyResultDialog';

interface TaskKeyResultsSectionProps {
  taskId: string;
  organizationId?: string;
  disabled?: boolean;
  onTaskUpdated?: () => void;
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

interface TaskKeyResultLink {
  id: string;
  keyResultId: string;
  impact: 'low' | 'medium' | 'high';
  notes?: string;
}

export function TaskKeyResultsSection({ 
  taskId, 
  organizationId, 
  disabled = false,
  onTaskUpdated 
}: TaskKeyResultsSectionProps) {
  const [keyResults, setKeyResults] = useState<(KeyResult & { linkId: string; impact: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('');
  const [selectedLinkId, setSelectedLinkId] = useState<string>('');
  
  // جلب النتائج الرئيسية المرتبطة بالمهمة
  useEffect(() => {
    if (!taskId || !organizationId) {
      setLoading(false);
      return;
    }
    
    const fetchLinkedKeyResults = async () => {
      try {
        setLoading(true);
        
        const getKeyResultsForTask = httpsCallable<
          { taskId: string },
          { keyResults: KeyResult[]; objectives: any[]; links: TaskKeyResultLink[] }
        >(functions, 'getKeyResultsForTask');
        
        const result = await getKeyResultsForTask({ taskId });
        
        // دمج النتائج الرئيسية مع معلومات الربط
        const linkedKeyResults = result.data.keyResults.map(kr => {
          const link = result.data.links.find(l => l.keyResultId === kr.id);
          const objective = result.data.objectives.find(o => o.id === kr.objectiveId);
          
          return {
            ...kr,
            linkId: link?.id || '',
            impact: link?.impact || 'medium',
            objectiveTitle: objective?.title || 'هدف غير معروف'
          };
        });
        
        setKeyResults(linkedKeyResults);
      } catch (error) {
        console.error('Error fetching linked key results:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء جلب النتائج الرئيسية المرتبطة',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchLinkedKeyResults();
  }, [taskId, organizationId]);
  
  // إلغاء ربط النتيجة الرئيسية بالمهمة
  const handleUnlinkKeyResult = async () => {
    if (!selectedLinkId) return;
    
    try {
      const unlinkTaskFromKeyResult = httpsCallable<
        { linkId: string },
        { success: boolean }
      >(functions, 'unlinkTaskFromKeyResult');
      
      await unlinkTaskFromKeyResult({ linkId: selectedLinkId });
      
      toast({
        title: 'تم إلغاء الربط',
        description: 'تم إلغاء ربط المهمة بالنتيجة الرئيسية بنجاح',
      });
      
      // تحديث القائمة
      setKeyResults(prev => prev.filter(kr => kr.linkId !== selectedLinkId));
      
      // إغلاق مربع الحوار
      setIsUnlinkConfirmOpen(false);
      setSelectedKeyResultId('');
      setSelectedLinkId('');
      
      // استدعاء دالة التحديث إذا كانت موجودة
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error('Error unlinking task from key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إلغاء ربط المهمة بالنتيجة الرئيسية',
        variant: 'destructive',
      });
    }
  };
  
  // ربط النتيجة الرئيسية بالمهمة
  const handleLinkKeyResult = async (data: {
    keyResultId: string;
    objectiveId: string;
    impact: 'low' | 'medium' | 'high';
    notes?: string;
  }) => {
    try {
      const linkTaskToKeyResult = httpsCallable<
        {
          taskId: string;
          keyResultId: string;
          objectiveId: string;
          impact: 'low' | 'medium' | 'high';
          notes?: string;
          organizationId: string;
        },
        { id: string }
      >(functions, 'linkTaskToKeyResult');
      
      const result = await linkTaskToKeyResult({
        taskId,
        keyResultId: data.keyResultId,
        objectiveId: data.objectiveId,
        impact: data.impact,
        notes: data.notes,
        organizationId: organizationId || '',
      });
      
      toast({
        title: 'تم الربط',
        description: 'تم ربط المهمة بالنتيجة الرئيسية بنجاح',
      });
      
      // إعادة تحميل النتائج الرئيسية المرتبطة
      const getKeyResultsForTask = httpsCallable<
        { taskId: string },
        { keyResults: KeyResult[]; objectives: any[]; links: TaskKeyResultLink[] }
      >(functions, 'getKeyResultsForTask');
      
      const refreshResult = await getKeyResultsForTask({ taskId });
      
      // دمج النتائج الرئيسية مع معلومات الربط
      const linkedKeyResults = refreshResult.data.keyResults.map(kr => {
        const link = refreshResult.data.links.find(l => l.keyResultId === kr.id);
        const objective = refreshResult.data.objectives.find(o => o.id === kr.objectiveId);
        
        return {
          ...kr,
          linkId: link?.id || '',
          impact: link?.impact || 'medium',
          objectiveTitle: objective?.title || 'هدف غير معروف'
        };
      });
      
      setKeyResults(linkedKeyResults);
      
      // إغلاق مربع الحوار
      setIsLinkDialogOpen(false);
      
      // استدعاء دالة التحديث إذا كانت موجودة
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error('Error linking task to key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء ربط المهمة بالنتيجة الرئيسية',
        variant: 'destructive',
      });
    }
  };
  
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
  
  // الحصول على لون تأثير الربط
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // الحصول على نص تأثير الربط
  const getImpactText = (impact: string) => {
    switch (impact) {
      case 'high': return 'تأثير عالي';
      case 'medium': return 'تأثير متوسط';
      case 'low': return 'تأثير منخفض';
      default: return impact;
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
  
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium flex items-center">
          <Target className="ml-1 h-4 w-4 text-primary" />
          النتائج الرئيسية المرتبطة
        </h3>
        
        {!disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLinkDialogOpen(true)}
            className="h-7 px-2 text-xs"
          >
            <PlusCircle className="ml-1 h-3 w-3" />
            ربط بنتيجة رئيسية
          </Button>
        )}
      </div>
      
      {keyResults.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-3 border rounded-md">
          لا توجد نتائج رئيسية مرتبطة بهذه المهمة.
        </div>
      ) : (
        <div className="space-y-2">
          {keyResults.map((keyResult) => (
            <div key={keyResult.id} className="border rounded-md p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Badge className={getStatusColor(keyResult.status)}>
                      {getStatusText(keyResult.status)}
                    </Badge>
                    <Badge className={getImpactColor(keyResult.impact)}>
                      {getImpactText(keyResult.impact)}
                    </Badge>
                  </div>
                  
                  <h4 className="font-medium text-sm">{keyResult.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    الهدف: {keyResult.objectiveTitle}
                  </p>
                </div>
                
                <div className="flex gap-1">
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
                  
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedKeyResultId(keyResult.id);
                        setSelectedLinkId(keyResult.linkId);
                        setIsUnlinkConfirmOpen(true);
                      }}
                    >
                      <Unlink className="ml-1 h-3 w-3" />
                      إلغاء الربط
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="mt-2">
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
      
      {!disabled && (
        <>
          <LinkTaskToKeyResultDialog
            open={isLinkDialogOpen}
            onOpenChange={setIsLinkDialogOpen}
            onSubmit={handleLinkKeyResult}
            taskId={taskId}
            organizationId={organizationId || ''}
          />
          
          <ConfirmDialog
            open={isUnlinkConfirmOpen}
            onOpenChange={setIsUnlinkConfirmOpen}
            title="إلغاء ربط النتيجة الرئيسية"
            description="هل أنت متأكد من إلغاء ربط هذه النتيجة الرئيسية بالمهمة؟"
            confirmText="إلغاء الربط"
            cancelText="إلغاء"
            onConfirm={handleUnlinkKeyResult}
          />
        </>
      )}
    </div>
  );
}
