'use client';

/**
 * مربع حوار تعديل النتيجة الرئيسية
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { functions, db } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface EditKeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    type: 'numeric' | 'percentage' | 'boolean' | 'currency';
    targetValue: number;
    unit?: string;
    dueDate: Date;
    ownerId: string;
    ownerName: string;
    status: 'active' | 'completed' | 'at_risk' | 'behind';
  }) => void;
  keyResult: {
    id: string;
    title: string;
    description?: string;
    type: 'numeric' | 'percentage' | 'boolean' | 'currency';
    startValue: number;
    targetValue: number;
    currentValue: number;
    unit?: string;
    status: 'active' | 'completed' | 'at_risk' | 'behind';
    dueDate: { seconds: number; nanoseconds: number };
    ownerId: string;
    ownerName: string;
  };
}

interface OrgMember {
  uid: string;
  name: string;
  email: string;
  role: string;
}

export function EditKeyResultDialog({ open, onOpenChange, onSubmit, keyResult }: EditKeyResultDialogProps) {
  const { user } = useAuth();
  const { organizationId } = useAccountType();
  
  const [title, setTitle] = useState(keyResult.title);
  const [description, setDescription] = useState(keyResult.description || '');
  const [targetValue, setTargetValue] = useState(keyResult.targetValue);
  const [unit, setUnit] = useState(keyResult.unit || '');
  const [dueDate, setDueDate] = useState<Date>(new Date(keyResult.dueDate.seconds * 1000));
  const [ownerId, setOwnerId] = useState(keyResult.ownerId);
  const [status, setStatus] = useState<'active' | 'completed' | 'at_risk' | 'behind'>(keyResult.status);
  
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // تحديث الحالة عند تغيير النتيجة الرئيسية
  useEffect(() => {
    setTitle(keyResult.title);
    setDescription(keyResult.description || '');
    setTargetValue(keyResult.targetValue);
    setUnit(keyResult.unit || '');
    setDueDate(new Date(keyResult.dueDate.seconds * 1000));
    setOwnerId(keyResult.ownerId);
    setStatus(keyResult.status);
  }, [keyResult]);
  
  // جلب أعضاء المؤسسة
  useEffect(() => {
    if (!open || !organizationId) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // جلب أعضاء المؤسسة
        const getOrganizationMembers = httpsCallable<
          { orgId: string },
          { members: OrgMember[] }
        >(functions, 'getOrganizationMembers');
        
        const result = await getOrganizationMembers({ orgId: organizationId });
        setMembers(result.data.members || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [open, organizationId]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title) {
      alert('يرجى إدخال عنوان النتيجة الرئيسية');
      return;
    }
    
    if (!ownerId) {
      alert('يرجى اختيار مالك النتيجة الرئيسية');
      return;
    }
    
    const ownerMember = members.find(m => m.uid === ownerId);
    if (!ownerMember) {
      alert('مالك النتيجة الرئيسية غير صالح');
      return;
    }
    
    // التحقق من القيم حسب نوع النتيجة الرئيسية
    if (keyResult.type === 'boolean' && (targetValue < 0 || targetValue > 1)) {
      alert('القيمة المستهدفة للنتيجة الرئيسية من نوع نعم/لا يجب أن تكون 0 أو 1 فقط');
      return;
    }
    
    onSubmit({
      title,
      description: description || undefined,
      type: keyResult.type, // لا يمكن تغيير النوع بعد الإنشاء
      targetValue: Number(targetValue),
      unit: unit || undefined,
      dueDate,
      ownerId,
      ownerName: ownerMember.name || ownerMember.email,
      status,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>تعديل النتيجة الرئيسية</DialogTitle>
          <DialogDescription>
            قم بتعديل تفاصيل النتيجة الرئيسية.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">عنوان النتيجة الرئيسية</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="أدخل عنوان النتيجة الرئيسية"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">وصف النتيجة الرئيسية (اختياري)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="أدخل وصف النتيجة الرئيسية"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">نوع النتيجة</Label>
                <Input
                  id="type"
                  value={
                    keyResult.type === 'numeric' ? 'رقمي' :
                    keyResult.type === 'percentage' ? 'نسبة مئوية' :
                    keyResult.type === 'boolean' ? 'نعم/لا' :
                    keyResult.type === 'currency' ? 'عملة' : ''
                  }
                  disabled
                />
                <p className="text-xs text-muted-foreground">لا يمكن تغيير نوع النتيجة بعد الإنشاء</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">الحالة</Label>
                <Select value={status} onValueChange={(value: 'active' | 'completed' | 'at_risk' | 'behind') => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشطة</SelectItem>
                    <SelectItem value="at_risk">في خطر</SelectItem>
                    <SelectItem value="behind">متأخرة</SelectItem>
                    <SelectItem value="completed">مكتملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetValue">القيمة المستهدفة</Label>
                <Input
                  id="targetValue"
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(Number(e.target.value))}
                  disabled={keyResult.type === 'boolean'}
                  min={keyResult.type === 'boolean' ? 0 : undefined}
                  max={keyResult.type === 'boolean' ? 1 : keyResult.type === 'percentage' ? 100 : undefined}
                  step={keyResult.type === 'boolean' ? 1 : 'any'}
                />
              </div>
              
              {keyResult.type !== 'boolean' && (
                <div className="space-y-2">
                  <Label htmlFor="unit">وحدة القياس {keyResult.type === 'percentage' && '(% تلقائيًا)'}</Label>
                  <Input
                    id="unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="مثال: $، كجم، عدد"
                    disabled={keyResult.type === 'percentage'}
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">المسؤول</Label>
                <Select value={ownerId} onValueChange={setOwnerId} required>
                  <SelectTrigger id="owner">
                    <SelectValue placeholder="اختر المسؤول" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.uid} value={member.uid}>
                        {member.name || member.email} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
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
                      {dueDate ? format(dueDate, 'yyyy/MM/dd') : "اختر تاريخ"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => date && setDueDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit">
                حفظ التغييرات
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
