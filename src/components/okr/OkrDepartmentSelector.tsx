'use client';

/**
 * مكون اختيار قسم OKR
 * 
 * يعرض هذا المكون قائمة منسدلة لاختيار قسم للتقارير.
 */

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';

interface Department {
  id: string;
  name: string;
  organizationId: string;
}

interface OkrDepartmentSelectorProps {
  organizationId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  includeAllOption?: boolean;
}

export function OkrDepartmentSelector({
  organizationId,
  value,
  onChange,
  label = 'القسم',
  placeholder = 'اختر القسم',
  disabled = false,
  includeAllOption = true
}: OkrDepartmentSelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  
  // جلب الأقسام
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    
    const fetchDepartments = async () => {
      try {
        setLoading(true);
        
        const getDepartments = httpsCallable<{ organizationId: string }, { departments: Department[] }>(
          functions,
          'getDepartments'
        );
        
        const result = await getDepartments({ organizationId });
        setDepartments(result.data.departments || []);
        
        // تعيين القيمة الافتراضية إذا لم يتم تحديد قيمة
        if (!value && includeAllOption) {
          onChange('all');
        } else if (!value && result.data.departments && result.data.departments.length > 0) {
          onChange(result.data.departments[0].id);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDepartments();
  }, [organizationId, onChange, value, includeAllOption]);
  
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
      {label && <Label htmlFor="okr-department-selector">{label}</Label>}
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled || (departments.length === 0 && !includeAllOption)}
      >
        <SelectTrigger id="okr-department-selector">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {includeAllOption && (
            <SelectItem value="all">جميع الأقسام</SelectItem>
          )}
          
          {departments.length === 0 ? (
            <SelectItem value="no-departments" disabled>
              لا توجد أقسام
            </SelectItem>
          ) : (
            departments.map(department => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
