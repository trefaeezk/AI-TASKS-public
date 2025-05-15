'use client';

/**
 * مربع حوار إنشاء نتيجة رئيسية جديدة
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
import { format, addMonths } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CreateKeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    type: 'numeric' | 'percentage' | 'boolean' | 'currency';
    startValue: number;
    targetValue: number;
    currentValue: number;
    unit?: string;
    dueDate: Date;
    ownerId: string;
    ownerName: string;
  }) => void;
  objectiveId: string;
}

interface OrgMember {
  uid: string;
  name: string;
  email: string;
  role: string;
}

export function CreateKeyResultDialog({ open, onOpenChange, onSubmit, objectiveId }: CreateKeyResultDialogProps) {
  const { user } = useAuth();
  const { organizationId } = useAccountType();
  const today = new Date();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'numeric' | 'percentage' | 'boolean' | 'currency'>('numeric');
  const [startValue, setStartValue] = useState(0);
  const [targetValue, setTargetValue] = useState(100);
  const [currentValue, setCurrentValue] = useState(0);
  const [unit, setUnit] = useState('');
  const [dueDate, setDueDate] = useState<Date>(addMonths(today, 1));
  const [ownerId, setOwnerId] = useState('');
  
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  
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
        
        // تعيين المستخدم الحالي كمالك افتراضي
        if (user && result.data.members) {
          const currentMember = result.data.members.find(m => m.uid === user.uid);
          if (currentMember) {
            setOwnerId(currentMember.uid);
          } else if (result.data.members.length > 0) {
            setOwnerId(result.data.members[0].uid);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [open, organizationId, user]);
  
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
    if (type === 'boolean' && (startValue < 0 || startValue > 1 || targetValue < 0 || targetValue > 1 || currentValue < 0 || currentValue > 1)) {
      alert('القيم للنتيجة الرئيسية من نوع نعم/لا يجب أن تكون 0 أو 1 فقط');
      return;
    }
    
    onSubmit({
      title,
      description: description || undefined,
      type,
      startValue: Number(startValue),
      targetValue: Number(targetValue),
      currentValue: Number(currentValue),
      unit: unit || undefined,
      dueDate,
      ownerId,
      ownerName: ownerMember.name || ownerMember.email,
    });
  };
  
  const handleReset = () => {
    setTitle('');
    setDescription('');
    setType('numeric');
    setStartValue(0);
    setTargetValue(100);
    setCurrentValue(0);
    setUnit('');
    setDueDate(addMonths(today, 1));
    // لا نعيد تعيين المالك لأنه يتم تعيينه تلقائيًا
  };
  
  // تعديل القيم الافتراضية حسب نوع النتيجة الرئيسية
  useEffect(() => {
    if (type === 'percentage') {
      setUnit('%');
      if (targetValue > 100) setTargetValue(100);
    } else if (type === 'boolean') {
      setStartValue(0);
      setTargetValue(1);
      setCurrentValue(0);
      setUnit('');
    } else {
      if (type !== 'currency') setUnit('');
    }
  }, [type, targetValue]);
  
  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleReset();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>إنشاء نتيجة رئيسية جديدة</DialogTitle>
          <DialogDescription>
            أدخل تفاصيل النتيجة الرئيسية الجديدة.
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
                <Select value={type} onValueChange={(value: 'numeric' | 'percentage' | 'boolean' | 'currency') => setType(value)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="اختر نوع النتيجة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric">رقمي</SelectItem>
                    <SelectItem value="percentage">نسبة مئوية</SelectItem>
                    <SelectItem value="boolean">نعم/لا</SelectItem>
                    <SelectItem value="currency">عملة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startValue">القيمة البدائية</Label>
                <Input
                  id="startValue"
                  type="number"
                  value={startValue}
                  onChange={(e) => setStartValue(Number(e.target.value))}
                  disabled={type === 'boolean'}
                  min={type === 'boolean' ? 0 : undefined}
                  max={type === 'boolean' ? 1 : type === 'percentage' ? 100 : undefined}
                  step={type === 'boolean' ? 1 : 'any'}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currentValue">القيمة الحالية</Label>
                <Input
                  id="currentValue"
                  type="number"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(Number(e.target.value))}
                  min={type === 'boolean' ? 0 : undefined}
                  max={type === 'boolean' ? 1 : type === 'percentage' ? 100 : undefined}
                  step={type === 'boolean' ? 1 : 'any'}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="targetValue">القيمة المستهدفة</Label>
                <Input
                  id="targetValue"
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(Number(e.target.value))}
                  disabled={type === 'boolean'}
                  min={type === 'boolean' ? 0 : undefined}
                  max={type === 'boolean' ? 1 : type === 'percentage' ? 100 : undefined}
                  step={type === 'boolean' ? 1 : 'any'}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {type !== 'boolean' && (
                <div className="space-y-2">
                  <Label htmlFor="unit">وحدة القياس {type === 'percentage' && '(% تلقائيًا)'}</Label>
                  <Input
                    id="unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="مثال: $، كجم، عدد"
                    disabled={type === 'percentage'}
                  />
                </div>
              )}
              
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
                      disabled={(date) => date < today}
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
                إنشاء
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
