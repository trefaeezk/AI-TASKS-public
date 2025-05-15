'use client';

/**
 * مكون فلتر المهام المرتبطة بنتائج رئيسية
 * 
 * يعرض هذا المكون زر تبديل لتصفية المهام المرتبطة بنتائج رئيسية.
 */

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Target } from 'lucide-react';

interface OkrTaskFilterProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function OkrTaskFilter({ value, onChange }: OkrTaskFilterProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">فلتر OKR</h4>
      <div className="flex items-center space-x-2 space-x-reverse">
        <Switch
          id="okr-filter"
          checked={value}
          onCheckedChange={onChange}
        />
        <Label htmlFor="okr-filter" className="flex items-center cursor-pointer">
          <Target className="ml-1 h-4 w-4 text-primary" />
          <span>عرض المهام المرتبطة بـ OKR فقط</span>
        </Label>
      </div>
    </div>
  );
}
