// src/components/auth/ProtectedRoute.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until loading is false and user is checked
    if (!loading && !user) {
      router.push('/login'); // Redirect to login if not authenticated
    }
  }, [user, loading, router]);

  // Show loading indicator while checking auth state
  if (loading) {
     return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Render children only if user is authenticated
  return user ? <>{children}</> : null; // Render null while redirecting
}
