'use client';

import React from 'react';
import Link from 'next/link';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';

interface SidebarMenuLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SidebarMenuLink({ href, active, children, className }: SidebarMenuLinkProps) {
  return (
    <SidebarMenuItem className={className}>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={href}>
          {children}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
