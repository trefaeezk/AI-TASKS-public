
// src/components/auth/SignOutButton.tsx
'use client';

import { LogOut, Loader2 } from 'lucide-react';
// import { Button } from '@/components/ui/button'; // Button replaced with SidebarMenuButton
import { SidebarMenuButton } from '@/components/ui/sidebar'; // Import SidebarMenuButton
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { useRouter } from 'next/navigation'; // Use App Router's router
import { cn } from '@/lib/utils'; // Import cn for conditional classes

export function SignOutButton({ className }: { className?: string }) {
  const { logOut, loading } = useFirebaseAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    const success = await logOut();
    if (success) {
      router.push('/login'); // Redirect to login page after sign out
    }
    // Error handling is managed within the hook (toast)
  };

  return (
    <SidebarMenuButton
      onClick={handleSignOut}
      disabled={loading}
      className={cn(
          "w-full text-destructive hover:bg-destructive/10 hover:text-destructive justify-start", // Use full width and destructive colors, ensure text is aligned start
          className // Allow passing additional classes
      )}
      tooltip="تسجيل الخروج" // Add tooltip for collapsed state
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      <span className="mr-2 group-data-[collapsible=icon]:hidden">تسجيل الخروج</span> {/* Use mr-2 for spacing in RTL, hide text when collapsed */}
    </SidebarMenuButton>
  );
}
