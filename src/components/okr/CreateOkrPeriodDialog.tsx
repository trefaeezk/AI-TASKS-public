'use client';

/**
 * مربع حوار إنشاء فترة OKR جديدة
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, addMonths, format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CreateOkrPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; startDate: Date; endDate: Date; status: 'active' | 'planning' }) => void;
}

export function CreateOkrPeriodDialog({ open, onOpenChange, onSubmit }: CreateOkrPeriodDialogProps) {
  const today = new Date();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(addMonths(today, 3));
  const [status, setStatus] = useState<'active' | 'planning'>('planning');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      alert('يرجى إدخال اسم الفترة');
      return;
    }
    
    if (!startDate || !endDate) {
      alert('يرجى تحديد تاريخ البدء والانتهاء');
      return;
    }
    
    if (endDate < startDate) {
      alert('يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء');
      return;
    }
    
    onSubmit({ name, startDate, endDate, status });
  };
  
  const handleReset = () => {
    setName('');
    setStartDate(today);
    setEndDate(addMonths(today, 3));
    setStatus('planning');
  };
  
  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleReset();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>إنشاء فترة تخطيط سنوي جديدة</DialogTitle>
          <DialogDescription>
            أدخل تفاصيل فترة التخطيط السنوي (OKR) الجديدة.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم الفترة</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: الربع الأول 2024"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">تاريخ البدء</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="startDate"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? format(startDate, 'yyyy/MM/dd') : "اختر تاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">تاريخ الانتهاء</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="endDate"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {endDate ? format(endDate, 'yyyy/MM/dd') : "اختر تاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                    disabled={(date) => date < startDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">الحالة</Label>
            <Select value={status} onValueChange={(value: 'active' | 'planning') => setStatus(value)}>
              <SelectTrigger id="status">
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">تخطيط</SelectItem>
                <SelectItem value="active">نشطة</SelectItem>
              </SelectContent>
            </Select>
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
      </DialogContent>
    </Dialog>
  );
}
