
// src/app/(app)/layout.tsx
'use client'; // Required because we need client-side logic (context, hooks)

import type { ReactNode } from 'react';
import React from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppLayoutContent } from './AppLayoutContent';
import { TaskDataLoader } from './TaskDataLoader'; // Import TaskDataLoader here

// No need to explicitly import TaskPageProvider, it's included via TaskDataLoader

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      {/* Wrap SidebarProvider and AppLayoutContent with TaskDataLoader */}
      <TaskDataLoader>
        <SidebarProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </SidebarProvider>
      </TaskDataLoader>
    </ProtectedRoute>
  );
}
