'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollapsibleSidebarMenuProps {
  href: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSidebarMenu({
  href,
  icon,
  label,
  active,
  children,
  defaultOpen = false
}: CollapsibleSidebarMenuProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen || active);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SidebarMenuItem>
        {/* العنصر الرئيسي */}
        <div className="flex items-center w-full">
          <SidebarMenuButton asChild isActive={active} className="flex-1">
            <Link href={href} className="flex items-center">
              {icon}
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>

          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "p-1.5 hover:bg-accent rounded-sm transition-all duration-200",
                "data-[state=open]:bg-accent",
                "group-data-[collapsible=icon]:hidden" // إخفاء في وضع الأيقونة
              )}
              aria-label={isOpen ? "طي القائمة" : "توسيع القائمة"}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isOpen && "rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
        </div>

        {/* القائمة الفرعية مع انتقال سلس */}
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <SidebarMenuSub>
            {children}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

interface CollapsibleSidebarSubItemProps {
  href: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
}

export function CollapsibleSidebarSubItem({
  href,
  icon,
  label,
  active = false
}: CollapsibleSidebarSubItemProps) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={active}>
        <Link
          href={href}
          className={cn(
            "flex items-center w-full transition-colors",
            active && "text-primary font-medium"
          )}
        >
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
