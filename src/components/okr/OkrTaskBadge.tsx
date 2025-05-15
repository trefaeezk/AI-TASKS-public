'use client';

/**
 * مكون شارة المهام المرتبطة بنتائج رئيسية
 * 
 * يعرض هذا المكون شارة للمهام المرتبطة بنتائج رئيسية.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OkrTaskBadgeProps {
  linkedToOkr?: boolean;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

export function OkrTaskBadge({ 
  linkedToOkr = false, 
  size = 'md',
  showTooltip = true 
}: OkrTaskBadgeProps) {
  if (!linkedToOkr) return null;
  
  const badge = (
    <Badge 
      variant="outline" 
      className={`bg-primary/10 text-primary border-primary/20 ${
        size === 'sm' ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5'
      }`}
    >
      <Target className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} ml-1`} />
      OKR
    </Badge>
  );
  
  if (!showTooltip) return badge;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>مرتبطة بنتيجة رئيسية في نظام OKR</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
