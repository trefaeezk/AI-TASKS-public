'use client';

/**
 * مكون اختيار فترة OKR
 * 
 * يعرض هذا المكون قائمة منسدلة لاختيار فترة OKR.
 */

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface OkrPeriod {
  id: string;
  title: string;
  startDate: { seconds: number; nanoseconds: number };
  endDate: { seconds: number; nanoseconds: number };
  status: 'active' | 'completed' | 'planned';
  organizationId: string;
}

interface OkrPeriodSelectorProps {
  organizationId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function OkrPeriodSelector({
  organizationId,
  value,
  onChange,
  label = 'الفترة',
  placeholder = 'اختر الفترة',
  disabled = false
}: OkrPeriodSelectorProps) {
  const [periods, setPeriods] = useState<OkrPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  
  // جلب فترات OKR
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    
    const fetchPeriods = async () => {
      try {
        setLoading(true);
        
        const getOkrPeriods = httpsCallable<{ organizationId: string }, { periods: OkrPeriod[] }>(
          functions,
          'getOkrPeriods'
        );
        
        const result = await getOkrPeriods({ organizationId });
        const fetchedPeriods = result.data.periods || [];
        setPeriods(fetchedPeriods);
        
        // تعيين الفترة النشطة افتراضيًا إذا لم يتم تحديد قيمة
        if (!value && fetchedPeriods.length > 0) {
          const activePeriod = fetchedPeriods.find(p => p.status === 'active');
          if (activePeriod) {
            onChange(activePeriod.id);
          } else {
            onChange(fetchedPeriods[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching OKR periods:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPeriods();
  }, [organizationId, onChange, value]);
  
  // تنسيق تاريخ الفترة
  const formatPeriodDate = (period: OkrPeriod) => {
    const startDate = new Date(period.startDate.seconds * 1000);
    const endDate = new Date(period.endDate.seconds * 1000);
    
    return `${format(startDate, 'MMM yyyy', { locale: ar })} - ${format(endDate, 'MMM yyyy', { locale: ar })}`;
  };
  
  if (loading) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {label && <Label htmlFor="okr-period-selector">{label}</Label>}
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || periods.length === 0}
      >
        <SelectTrigger id="okr-period-selector">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {periods.length === 0 ? (
            <SelectItem value="no-periods" disabled>
              لا توجد فترات
            </SelectItem>
          ) : (
            periods.map(period => (
              <SelectItem key={period.id} value={period.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{period.title}</span>
                  <span className="text-xs text-muted-foreground mr-2">
                    {formatPeriodDate(period)}
                    {period.status === 'active' && (
                      <span className="mr-2 text-primary">(نشطة)</span>
                    )}
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
