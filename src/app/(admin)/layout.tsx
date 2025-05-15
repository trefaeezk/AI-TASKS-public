// src/app/(admin)/layout.tsx
'use client';

import type { ReactNode } from 'react';
import React from 'react';
import { AdminProtectedRoute } from '@/components/auth/AdminProtectedRoute';
import { SidebarProvider } from '@/components/ui/sidebar'; // Assuming admin layout might use sidebar
import { AppLayoutContent } from '@/app/(app)/AppLayoutContent'; // Reuse main app layout structure if desired
// TaskDataLoader is not needed here as admin pages don't directly interact with task context via AppLayoutContent in the same way.

// This layout applies only to routes within the (admin) group
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProtectedRoute>
      {/* You can reuse the existing AppLayout structure or create a distinct admin layout */}
      <SidebarProvider>
        {/* AppLayoutContent will now handle the case where TaskPageContext might be null */}
        <AppLayoutContent>
          {/* Admin-specific header/content adjustments might go here or in AdminAppLayoutContent */}
          <div className="p-4 md:p-6"> {/* Add padding for admin content */}
            {children}
          </div>
        </AppLayoutContent>
      </SidebarProvider>
      {/* Example of a simpler, distinct admin layout: */}
      {/*
      <div className="flex min-h-screen flex-col">
        <header className="bg-primary text-primary-foreground p-4">
          <h1>Admin Panel</h1>
          {/* Admin-specific navigation *}
        </header>
        <main className="flex-1 p-6 bg-muted/40">
          {children}
        </main>
      </div>
      */}
    </AdminProtectedRoute>
  );
}
