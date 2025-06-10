/**
 * مكون إنشاء مهمة تتطلب موافقة
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';

interface CreateTaskWithApprovalProps {
  organizationId: string;
  departmentId?: string;
  onTaskCreated?: () => void;
  onCancel?: () => void;
}

export function CreateTaskWithApproval({
  organizationId,
  departmentId,
  onTaskCreated,
  onCancel
}: CreateTaskWithApprovalProps) {
  const { toast } = useToast();
  const { userClaims } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    approvalLevel: departmentId ? 'department' : 'organization',
    notes: ''
  });
  
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  // تحديد ما إذا كان المستخدم يمكنه إنشاء مهام على مستوى المؤسسة
  const canCreateOrgTasks = userClaims?.isOrgOwner || userClaims?.isOrgAdmin || 
                           userClaims?.isOrgSupervisor || userClaims?.isOrgEngineer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: 'خطأ',
        description: 'يجب إدخال عنوان المهمة',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      const createTaskWithApproval = httpsCallable(functions, 'createTaskWithApproval');
      
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        organizationId,
        approvalLevel: formData.approvalLevel,
        departmentId: formData.approvalLevel === 'department' ? (departmentId || userClaims?.departmentId) : undefined,
        dueDate: dueDate ? { seconds: Math.floor(dueDate.getTime() / 1000) } : undefined,
        notes: formData.notes.trim() || undefined
      };

      const result = await createTaskWithApproval(taskData);
      
      if (result.data.success) {
        toast({
          title: 'تم إرسال المهمة للموافقة',
          description: result.data.message || 'تم إرسال المهمة للموافقة بنجاح',
        });
        
        // إعادة تعيين النموذج
        setFormData({
          title: '',
          description: '',
          priority: 'medium',
          approvalLevel: departmentId ? 'department' : 'organization',
          notes: ''
        });
        setDueDate(undefined);
        
        onTaskCreated?.();
      }
    } catch (error: any) {
      console.error('Error creating task with approval:', error);
      toast({
        title: 'خطأ في إنشاء المهمة',
        description: error.message || 'حدث خطأ أثناء إنشاء المهمة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          إنشاء مهمة تتطلب موافقة
        </CardTitle>
        <CardDescription>
          إنشاء مهمة جديدة تتطلب موافقة من المسئولين قبل التنفيذ
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* عنوان المهمة */}
          <div className="space-y-2">
            <Label htmlFor="title">عنوان المهمة *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="أدخل عنوان المهمة"
              required
            />
          </div>

          {/* وصف المهمة */}
          <div className="space-y-2">
            <Label htmlFor="description">وصف المهمة</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="أدخل وصف تفصيلي للمهمة"
              rows={3}
            />
          </div>

          {/* الأولوية */}
          <div className="space-y-2">
            <Label>أولوية المهمة</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* مستوى الموافقة */}
          <div className="space-y-2">
            <Label>مستوى الموافقة المطلوب</Label>
            <Select
              value={formData.approvalLevel}
              onValueChange={(value) => setFormData(prev => ({ ...prev, approvalLevel: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departmentId && (
                  <SelectItem value="department">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">قسم</Badge>
                      موافقة مسئول القسم
                    </div>
                  </SelectItem>
                )}
                {canCreateOrgTasks && (
                  <SelectItem value="organization">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">مؤسسة</Badge>
                      موافقة مسئول المؤسسة
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* تاريخ الاستحقاق */}
          <div className="space-y-2">
            <Label>تاريخ الاستحقاق</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP", { locale: ar }) : "اختر تاريخ الاستحقاق"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* ملاحظات */}
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات إضافية</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="أي ملاحظات أو تفاصيل إضافية"
              rows={2}
            />
          </div>

          {/* معلومات الموافقة */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  معلومات الموافقة
                </p>
                <p className="text-sm text-blue-700">
                  {formData.approvalLevel === 'department' 
                    ? 'ستحتاج هذه المهمة لموافقة مسئول القسم قبل أن تصبح نشطة'
                    : 'ستحتاج هذه المهمة لموافقة مسئول المؤسسة قبل أن تصبح نشطة'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  إرسال للموافقة
                </>
              )}
            </Button>
            
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                إلغاء
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
