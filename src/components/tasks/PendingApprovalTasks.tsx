/**
 * مكون عرض المهام المعلقة للموافقة
 */

import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/config/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types/task';
import { getPriorityColor, getPriorityText } from '@/utils/priority';

interface PendingApprovalTasksProps {
  organizationId: string;
  departmentId?: string;
  approvalLevel?: 'department' | 'organization';
}

export function PendingApprovalTasks({
  organizationId,
  departmentId,
  approvalLevel
}: PendingApprovalTasksProps) {
  const { toast } = useToast();
  const { userClaims } = useAuth();
  
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<{ [taskId: string]: string }>({});

  // جلب المهام المعلقة
  useEffect(() => {
    if (!organizationId) return;

    let q = query(
      collection(db, 'tasks'),
      where('status', '==', 'pending-approval'),
      where('requiresApproval', '==', true),
      where('organizationId', '==', organizationId),
      orderBy('submittedAt', 'desc')
    );

    // تصفية حسب مستوى الموافقة
    if (approvalLevel) {
      q = query(q, where('approvalLevel', '==', approvalLevel));
    }

    // تصفية حسب القسم للمهام على مستوى القسم
    if (approvalLevel === 'department' && departmentId) {
      q = query(q, where('departmentId', '==', departmentId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      
      setPendingTasks(tasks);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pending tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [organizationId, departmentId, approvalLevel]);

  const handleApproval = async (taskId: string, approved: boolean) => {
    setProcessingTaskId(taskId);
    
    try {
      const approveTask = httpsCallable(functions, 'approveTask');
      
      const result = await approveTask({
        taskId,
        approved,
        rejectionReason: approved ? undefined : rejectionReason[taskId]
      });
      
      if ((result.data as any)?.success) {
        toast({
          title: approved ? 'تمت الموافقة' : 'تم الرفض',
          description: (result.data as any)?.message,
        });
        
        // مسح سبب الرفض
        if (!approved) {
          setRejectionReason(prev => {
            const newState = { ...prev };
            delete newState[taskId];
            return newState;
          });
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
      setProcessingTaskId(null);
    }
  };



  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-6 w-6 animate-spin mr-2" />
            جاري تحميل المهام المعلقة...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingTasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            المهام المعلقة للموافقة
          </CardTitle>
          <CardDescription>
            لا توجد مهام معلقة للموافقة حالياً
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <h3 className="text-lg font-semibold">
          المهام المعلقة للموافقة ({pendingTasks.length})
        </h3>
      </div>

      {pendingTasks.map((task) => (
        <Card key={task.id} className="border-orange-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{task.description}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  مُرسل بواسطة: {task.submittedBy}
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
                <span>تاريخ الاستحقاق: {format(
                  task.dueDate instanceof Date
                    ? task.dueDate
                    : new Date((task.dueDate as any).seconds * 1000),
                  'PPP',
                  { locale: ar }
                )}</span>
              </div>
            )}

            {/* حقل سبب الرفض */}
            <div className="space-y-2">
              <Label htmlFor={`rejection-${task.id}`}>سبب الرفض (اختياري):</Label>
              <Textarea
                id={`rejection-${task.id}`}
                value={rejectionReason[task.id] || ''}
                onChange={(e) => setRejectionReason(prev => ({
                  ...prev,
                  [task.id]: e.target.value
                }))}
                placeholder="أدخل سبب الرفض إذا كنت ترغب في رفض المهمة"
                rows={2}
              />
            </div>

            {/* أزرار الموافقة والرفض */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handleApproval(task.id, true)}
                disabled={processingTaskId === task.id}
                className="flex-1"
              >
                {processingTaskId === task.id ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                موافقة
              </Button>
              
              <Button
                variant="destructive"
                onClick={() => handleApproval(task.id, false)}
                disabled={processingTaskId === task.id}
                className="flex-1"
              >
                {processingTaskId === task.id ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                رفض
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
