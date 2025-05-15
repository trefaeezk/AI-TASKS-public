'use client';

/**
 * مكون قائمة المهام المرتبطة بالنتيجة الرئيسية
 *
 * يعرض هذا المكون قائمة بالمهام المرتبطة بالنتيجة الرئيسية ويسمح بربط مهام جديدة.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link as LinkIcon, PlusCircle, Unlink, CalendarIcon, CheckCircle, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { LinkTaskDialog } from '@/components/okr/LinkTaskDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface LinkedTasksListProps {
  tasks: {
    id: string;
    title: string;
    status: string;
    dueDate?: { seconds: number; nanoseconds: number };
    assignedTo?: string;
    assigneeName?: string;
  }[];
  keyResultId: string;
  objectiveId: string;
  canEdit: boolean;
  onTasksUpdated: (tasks: any[]) => void;
}

interface TaskLink {
  id: string;
  taskId: string;
  keyResultId: string;
  impact: 'low' | 'medium' | 'high';
  notes?: string;
}

export function LinkedTasksList({ tasks, keyResultId, objectiveId, canEdit, onTasksUpdated }: LinkedTasksListProps) {
  const { toast } = useToast();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedLinkId, setSelectedLinkId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // ربط مهمة بالنتيجة الرئيسية
  const handleLinkTask = async (data: {
    taskId: string;
    impact: 'low' | 'medium' | 'high';
    notes?: string;
  }) => {
    try {
      setLoading(true);

      const linkTaskToKeyResult = httpsCallable<
        {
          taskId: string;
          keyResultId: string;
          objectiveId: string;
          impact: 'low' | 'medium' | 'high';
          notes?: string;
        },
        { id: string }
      >(functions, 'linkTaskToKeyResult');

      await linkTaskToKeyResult({
        taskId: data.taskId,
        keyResultId,
        objectiveId,
        impact: data.impact,
        notes: data.notes,
      });

      toast({
        title: 'تم الربط',
        description: 'تم ربط المهمة بالنتيجة الرئيسية بنجاح',
      });

      // إعادة تحميل المهام المرتبطة
      const getTasksForKeyResult = httpsCallable<
        { keyResultId: string },
        { tasks: any[] }
      >(functions, 'getTasksForKeyResult');

      const tasksResult = await getTasksForKeyResult({ keyResultId });
      onTasksUpdated(tasksResult.data.tasks || []);

      // إغلاق مربع الحوار
      setIsLinkDialogOpen(false);
    } catch (error) {
      console.error('Error linking task to key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء ربط المهمة بالنتيجة الرئيسية',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // إلغاء ربط مهمة بالنتيجة الرئيسية
  const handleUnlinkTask = async () => {
    try {
      if (!selectedLinkId) return;

      setLoading(true);

      const unlinkTaskFromKeyResult = httpsCallable<
        { linkId: string },
        { success: boolean }
      >(functions, 'unlinkTaskFromKeyResult');

      await unlinkTaskFromKeyResult({ linkId: selectedLinkId });

      toast({
        title: 'تم إلغاء الربط',
        description: 'تم إلغاء ربط المهمة بالنتيجة الرئيسية بنجاح',
      });

      // إعادة تحميل المهام المرتبطة
      const getTasksForKeyResult = httpsCallable<
        { keyResultId: string },
        { tasks: any[] }
      >(functions, 'getTasksForKeyResult');

      const tasksResult = await getTasksForKeyResult({ keyResultId });
      onTasksUpdated(tasksResult.data.tasks || []);

      // إغلاق مربع الحوار
      setIsUnlinkConfirmOpen(false);
      setSelectedTaskId('');
      setSelectedLinkId('');
    } catch (error) {
      console.error('Error unlinking task from key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إلغاء ربط المهمة بالنتيجة الرئيسية',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // الحصول على لون حالة المهمة
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'done':
      case 'مكتملة':
        return 'bg-green-100 text-green-800';
      case 'in progress':
      case 'inprogress':
      case 'قيد التنفيذ':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      case 'معلقة':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
      case 'متأخرة':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">لا توجد مهام مرتبطة</h2>
          <p className="text-muted-foreground mb-4">
            لم يتم ربط أي مهام بهذه النتيجة الرئيسية بعد.
          </p>
          {canEdit && (
            <Button onClick={() => setIsLinkDialogOpen(true)}>
              <PlusCircle className="ml-2 h-4 w-4" />
              ربط مهمة
            </Button>
          )}
        </CardContent>

        {canEdit && (
          <LinkTaskDialog
            open={isLinkDialogOpen}
            onOpenChange={setIsLinkDialogOpen}
            onSubmit={handleLinkTask}
            keyResultId={keyResultId}
            loading={loading}
          />
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">المهام المرتبطة</CardTitle>
              <CardDescription>
                المهام المرتبطة بهذه النتيجة الرئيسية
              </CardDescription>
            </div>

            {canEdit && (
              <Button onClick={() => setIsLinkDialogOpen(true)}>
                <PlusCircle className="ml-2 h-4 w-4" />
                ربط مهمة
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks.map((task) => {
              const dueDate = task.dueDate ? new Date(task.dueDate.seconds * 1000) : null;

              return (
                <div key={task.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{task.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>

                        {dueDate && (
                          <span className="text-sm text-muted-foreground flex items-center">
                            <CalendarIcon className="ml-1 h-3 w-3" />
                            {format(dueDate, 'dd MMM yyyy', { locale: ar })}
                          </span>
                        )}

                        {task.assigneeName && (
                          <span className="text-sm text-muted-foreground">
                            المسؤول: {task.assigneeName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/org/tasks/${task.id}`} target="_blank">
                          <ExternalLink className="ml-2 h-4 w-4" />
                          عرض
                        </Link>
                      </Button>

                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setSelectedLinkId(task.id); // في هذا المثال، نستخدم معرف المهمة كمعرف للرابط
                            setIsUnlinkConfirmOpen(true);
                          }}
                        >
                          <Unlink className="ml-2 h-4 w-4" />
                          إلغاء الربط
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <>
          <LinkTaskDialog
            open={isLinkDialogOpen}
            onOpenChange={setIsLinkDialogOpen}
            onSubmit={handleLinkTask}
            keyResultId={keyResultId}
            loading={loading}
          />

          <ConfirmDialog
            open={isUnlinkConfirmOpen}
            onOpenChange={setIsUnlinkConfirmOpen}
            title="إلغاء ربط المهمة"
            description="هل أنت متأكد من إلغاء ربط هذه المهمة بالنتيجة الرئيسية؟"
            confirmText="إلغاء الربط"
            cancelText="إلغاء"
            onConfirm={handleUnlinkTask}
          />
        </>
      )}
    </div>
  );
}
