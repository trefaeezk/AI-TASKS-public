'use client';

import type { ReactNode } from 'react';
import React from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SidebarProvider } from '@/components/ui/sidebar';
import { OrganizationLayoutContent } from './OrganizationLayoutContent';
import { OrganizationGuard } from '@/components/organization/OrganizationGuard';
import { TaskPageProvider } from '@/context/TaskPageContext';

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <OrganizationGuard>
        <TaskPageProvider initialTasks={[]}>
          <SidebarProvider>
            <OrganizationLayoutContent>{children}</OrganizationLayoutContent>
          </SidebarProvider>
        </TaskPageProvider>
      </OrganizationGuard>
    </ProtectedRoute>
  );
}
