/**
 * مكون رأس الصفحة - يستخدم لعرض عنوان وعنوان فرعي للصفحة
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  heading: string;
  subheading?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function PageHeader({ heading, subheading, icon, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <h1 className="text-xl md:text-2xl font-semibold text-primary flex items-center">
        {icon && <span className="ml-2">{icon}</span>}
        {heading}
      </h1>
      {subheading && (
        <p className="text-sm text-muted-foreground">{subheading}</p>
      )}
    </div>
  );
}
