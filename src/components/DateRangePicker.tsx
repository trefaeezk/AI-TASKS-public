// src/components/DateRangePicker.tsx
'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  dateRange: { startDate: Date | null; endDate: Date | null };
  setDateRange: (range: { startDate: Date | null; endDate: Date | null }) => void;
}

export function DateRangePicker({
  className,
  dateRange,
  setDateRange,
}: DateRangePickerProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: dateRange.startDate ?? undefined,
    to: dateRange.endDate ?? undefined,
  });
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setDate(selectedRange);
    // Optionally update the context state immediately on select, or wait for confirm button
    // setDateRange({ startDate: selectedRange?.from ?? null, endDate: selectedRange?.to ?? null });
  };

  const handleConfirm = () => {
    setDateRange({ startDate: date?.from ?? null, endDate: date?.to ?? null });
    setIsOpen(false);
  };

  const handleCancel = () => {
     // Reset local state to context state
     setDate({ from: dateRange.startDate ?? undefined, to: dateRange.endDate ?? undefined });
     setIsOpen(false);
  };

  return (
    <div className={cn('grid gap-1', className)}> {/* Reduced gap */}
       <Label htmlFor="date-filter-trigger" className="text-xs font-medium text-foreground">التاريخ</Label> {/* Changed label text */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-filter-trigger"
            variant={'outline'}
            size="sm"
            className={cn(
              'w-full h-9 justify-start text-right text-xs font-normal', // Adjusted width/height
              !date?.from && !date?.to && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="ml-1 h-3.5 w-3.5" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'dd/MM/yy', { locale: ar })} -{' '}
                  {format(date.to, 'dd/MM/yy', { locale: ar })}
                </>
              ) : (
                format(date.from, 'dd/MM/yy', { locale: ar })
              )
            ) : (
              <span>اختر نطاق تاريخ</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from || dateRange.startDate || new Date()}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={1} // Show only one month to save space
            locale={ar}
            dir="rtl"
          />
           <div className="p-2 border-t border-border flex justify-end gap-2">
             <Button size="sm" type="button" variant="ghost" onClick={handleCancel}>إلغاء</Button>
             <Button size="sm" type="button" onClick={handleConfirm} className="bg-primary hover:bg-primary/90 text-primary-foreground">تطبيق</Button>
           </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
