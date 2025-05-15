// src/components/CategoryFilter.tsx
'use client';

import React from 'react';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

interface CategoryFilterProps {
  userId: string;
  selectedCategory: string | null;
  onSelectCategory: (categoryName: string | null) => void;
}

export function CategoryFilter({ userId, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  const { categories, loading } = useTaskCategories(userId);

  const handleValueChange = (value: string) => {
    onSelectCategory(value === 'all' ? null : value);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor="category-filter" className="text-xs font-medium text-foreground">الفئة</Label>
      <Select
        value={selectedCategory ?? 'all'}
        onValueChange={handleValueChange}
        dir="rtl"
        disabled={loading}
      >
        <SelectTrigger id="category-filter" className="w-full h-9 text-xs"> {/* Adjusted width/height */}
          <SelectValue placeholder={loading ? "تحميل..." : "كل الفئات"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل الفئات</SelectItem>
          {categories.map(category => (
            <SelectItem key={category.id} value={category.name}>
              <span className="flex items-center">
                {category.color && (
                  <span
                    className="inline-block h-2 w-2 rounded-full mr-2 ml-1 flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                {category.name}
              </span>
            </SelectItem>
          ))}
           {categories.length === 0 && !loading && (
             <SelectItem value="no-categories" disabled>لا توجد فئات</SelectItem>
           )}
        </SelectContent>
      </Select>
    </div>
  );
}
