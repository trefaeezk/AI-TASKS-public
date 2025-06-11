/**
 * مكون حوار الموافقة على المهمة
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { Task } from '@/types/task';
import { getPriorityColor, getPriorityText } from '@/utils/priority';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TaskApprovalDialogProps {
  task: Task | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApprovalComplete?: () => void;
}

export function TaskApprovalDialog({
  task,
  isOpen,
  onOpenChange,
  onApprovalComplete
}: TaskApprovalDialogProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApproval = async (approved: boolean) => {
    if (!task) return;
    
    setProcessing(true);
    
    try {
      const approveTask = httpsCallable(functions, 'approveTask');
      
      const result = await approveTask({
        taskId: task.id,
        approved,
        rejectionReason: approved ? undefined : rejectionReason
      });
      
      if ((result.data as any)?.success) {
        toast({
          title: approved ? 'تمت الموافقة' : 'تم الرفض',
          description: (result.data as any)?.message,
        });
        
        // إغلاق الحوار ومسح البيانات
        setRejectionReason('');
        onOpenChange(false);
        
        // إشعار المكون الأب بإتمام العملية
        if (onApprovalComplete) {
          onApprovalComplete();
        }
      }
    } catch (error: any) {
      console.error('Error processing approval:', error);
      toast({
        title: 'خطأ في المعالجة',
        description: error.message || 'حدث خطأ أثناء معالجة الطلب',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };



  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            موافقة على مهمة
          </DialogTitle>
          <DialogDescription>
            راجع تفاصيل المهمة واتخذ قرار الموافقة أو الرفض
          </DialogDescription>
        </DialogHeader>

        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{task.description}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  مُرسل بواسطة: {task.submittedByName || task.submittedBy || 'مستخدم غير معروف'}
                  {task.submittedAt && (
                    <>
                      <Calendar className="h-4 w-4 ml-2" />
                      {format(task.submittedAt.toDate(), 'PPP', { locale: ar })}
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={getPriorityColor(task.priority)}>
                  {getPriorityText(task.priority)}
                </Badge>
                <Badge variant="outline">
                  {task.approvalLevel === 'department' ? 'قسم' : 'مؤسسة'}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* تفاصيل المهمة */}
            {task.details && (
              <div>
                <Label className="text-sm font-medium">التفاصيل:</Label>
                <p className="text-sm text-muted-foreground mt-1">{task.details}</p>
              </div>
            )}

            {/* ملاحظات المُرسل */}
            {task.notes && (
              <div>
                <Label className="text-sm font-medium">ملاحظات المُرسل:</Label>
                <p className="text-sm text-muted-foreground mt-1">{task.notes}</p>
              </div>
            )}

            {/* تاريخ الاستحقاق */}
            {task.dueDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>تاريخ الاستحقاق: {format(task.dueDate instanceof Date ? task.dueDate : (task.dueDate as any).toDate(), 'PPP', { locale: ar })}</span>
              </div>
            )}

            {/* حقل سبب الرفض */}
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">سبب الرفض (اختياري):</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="أدخل سبب الرفض إذا كنت ترغب في رفض المهمة"
                rows={3}
              />
            </div>

            {/* أزرار الموافقة والرفض */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => handleApproval(true)}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                موافقة
              </Button>
              
              <Button
                variant="destructive"
                onClick={() => handleApproval(false)}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                رفض
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
