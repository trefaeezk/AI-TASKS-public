'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export type DateFilterValue = 'all' | 'today' | 'week' | 'month' | 'overdue';

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  label?: string;
}

export function DateFilter({ value, onChange, label = "تصفية حسب التاريخ" }: DateFilterProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="date-filter">{label}</Label>
      <Select
        value={value}
        onValueChange={(newValue) => onChange(newValue as DateFilterValue)}
      >
        <SelectTrigger id="date-filter">
          <SelectValue placeholder="اختر فترة زمنية" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">جميع المهام</SelectItem>
          <SelectItem value="today">اليوم</SelectItem>
          <SelectItem value="week">هذا الأسبوع</SelectItem>
          <SelectItem value="month">هذا الشهر</SelectItem>
          <SelectItem value="overdue">المتأخرة</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
