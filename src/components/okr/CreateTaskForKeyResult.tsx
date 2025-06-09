'use client';

/**
 * مكون إنشاء مهمة جديدة مرتبطة بنتيجة رئيسية
 *
 * يعرض هذا المكون نموذج إنشاء مهمة جديدة مرتبطة بنتيجة رئيسية.
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { db, functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface CreateTaskForKeyResultProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResultId: string;
  objectiveId: string;
  onTaskCreated?: () => void;
}

export function CreateTaskForKeyResult({
  open,
  onOpenChange,
  keyResultId,
  objectiveId,
  onTaskCreated
}: CreateTaskForKeyResultProps) {
  const { user } = useAuth();
  const { organizationId } = useAccountType();
  const { toast } = useToast();
  const { categories } = useTaskCategories(user?.uid || '');

  // Estados para usuarios y departamentos
  const [users, setUsers] = useState<Array<{id: string, displayName: string, email: string}>>([]);
  const [departments, setDepartments] = useState<Array<{id: string, name: string}>>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [tempDueDate, setTempDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<string>('medium');
  const [assignedToUserId, setAssignedToUserId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // إعادة تعيين النموذج عند الفتح
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  // جلب المستخدمين والأقسام
  useEffect(() => {
    if (!organizationId) return;

    const fetchUsersAndDepartments = async () => {
      try {
        // جلب المستخدمين
        const usersQuery = query(
          collection(db, 'organizations', organizationId, 'members')
        );
        const usersSnapshot = await getDocs(usersQuery);
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().name || '',
          email: doc.data().email || ''
        }));
        setUsers(usersList);

        // جلب الأقسام من المسار الموحد
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const departmentsSnapshot = await getDocs(departmentsQuery);
        const departmentsList = departmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || ''
        }));
        setDepartments(departmentsList);
      } catch (error) {
        console.error('Error fetching users and departments:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء جلب المستخدمين والأقسام',
          variant: 'destructive',
        });
      }
    };

    fetchUsersAndDepartments();
  }, [organizationId, toast]);

  // إعادة تعيين النموذج
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate(undefined);
    setTempDueDate(undefined);
    setPriority('medium');
    setAssignedToUserId('');
    setDepartmentId('');
    setCategoryId('');
    setImpact('medium');
    setNotes('');
  };

  // تأكيد تاريخ الاستحقاق
  const handleDueDateConfirm = () => {
    setDueDate(tempDueDate);
  };

  // إلغاء تاريخ الاستحقاق
  const handleDueDateCancel = () => {
    setTempDueDate(dueDate);
  };

  // إنشاء المهمة
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال عنوان المهمة',
        variant: 'destructive',
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: 'خطأ',
        description: 'لم يتم العثور على معرف المؤسسة',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // إنشاء معرف فريد للمهمة
      const taskId = uuidv4();

      // إنشاء المهمة
      const createTaskForKeyResult = httpsCallable<
        {
          taskId: string;
          title: string;
          description: string;
          dueDate?: { seconds: number };
          priority: string;
          assignedToUserId?: string;
          departmentId?: string;
          categoryId?: string;
          keyResultId: string;
          objectiveId: string;
          impact: 'low' | 'medium' | 'high';
          notes?: string;
          organizationId: string;
        },
        { success: boolean }
      >(functions, 'createTaskForKeyResult');

      // تحويل التاريخ إلى ثواني
      const dueDateSeconds = dueDate ? { seconds: Math.floor(dueDate.getTime() / 1000) } : undefined;

      await createTaskForKeyResult({
        taskId,
        title,
        description,
        dueDate: dueDateSeconds,
        priority,
        assignedToUserId: assignedToUserId || undefined,
        departmentId: departmentId || undefined,
        categoryId: categoryId || undefined,
        keyResultId,
        objectiveId,
        impact,
        notes: notes || undefined,
        organizationId,
      });

      toast({
        title: 'تم إنشاء المهمة',
        description: 'تم إنشاء المهمة وربطها بالنتيجة الرئيسية بنجاح',
      });

      // إغلاق مربع الحوار
      onOpenChange(false);

      // استدعاء دالة التحديث إذا كانت موجودة
      if (onTaskCreated) onTaskCreated();
    } catch (error) {
      console.error('Error creating task for key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إنشاء المهمة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && !loading) {
        onOpenChange(newOpen);
      }
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>إنشاء مهمة جديدة مرتبطة بالنتيجة الرئيسية</DialogTitle>
          <DialogDescription>
            أدخل تفاصيل المهمة الجديدة التي سيتم ربطها بالنتيجة الرئيسية.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">عنوان المهمة *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="أدخل عنوان المهمة"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">وصف المهمة</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخل وصف المهمة"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="dueDate"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP', { locale: ar }) : <span>اختر تاريخًا</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempDueDate}
                    onSelect={setTempDueDate}
                    initialFocus
                    locale={ar}
                  />
                  <div className="p-2 border-t border-border flex justify-end gap-2">
                    <Button size="sm" type="button" variant="ghost" onClick={handleDueDateCancel}>إلغاء</Button>
                    <Button size="sm" type="button" onClick={handleDueDateConfirm}>تأكيد</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">الأولوية</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="اختر الأولوية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedToUserId">تعيين إلى</Label>
              <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                <SelectTrigger id="assignedToUserId">
                  <SelectValue placeholder="اختر مستخدم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">بدون تعيين</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departmentId">القسم</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="departmentId">
                  <SelectValue placeholder="اختر قسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قسم</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoryId">الفئة</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="اختر فئة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فئة</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="impact">تأثير المهمة على النتيجة الرئيسية</Label>
              <Select value={impact} onValueChange={(value: 'low' | 'medium' | 'high') => setImpact(value)}>
                <SelectTrigger id="impact">
                  <SelectValue placeholder="اختر مستوى التأثير" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفض</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات الربط (اختياري)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات حول ربط هذه المهمة بالنتيجة الرئيسية"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              <PlusCircle className="ml-2 h-4 w-4" />
              إنشاء المهمة
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
