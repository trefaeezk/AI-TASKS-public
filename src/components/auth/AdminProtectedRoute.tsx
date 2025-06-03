// src/components/auth/AdminProtectedRoute.tsx
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null initially, true/false after check
  const [isOwner, setIsOwner] = useState<boolean | null>(null); // null initially, true/false after check
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      console.log('[AdminProtectedRoute] Starting check...');
      if (authLoading) {
         console.log('[AdminProtectedRoute] Auth is still loading, waiting...');
         // Keep setLoading true while auth is loading
         if (!loading) setLoading(true);
         return;
      }
      console.log('[AdminProtectedRoute] Auth loading finished. User:', user?.uid);

      if (!user) {
        console.log('[AdminProtectedRoute] No user found, redirecting to login.');
        if (isAdmin !== false) setIsAdmin(false); // Ensure isAdmin state is updated
        if (loading) setLoading(false); // Stop loading if no user
        router.push('/login');
        return;
      }

      // If loading state is still true, set it based on isAdmin check progress
      if (loading && isAdmin === null) {
          console.log('[AdminProtectedRoute] User found, checking claims...');
      } else if (!loading && isAdmin !== null) {
          // Already checked, no need to re-check unless user changes (handled by dependency array)
          console.log(`[AdminProtectedRoute] Already checked. isAdmin: ${isAdmin}`);
          return;
      }

      try {
        console.log('[AdminProtectedRoute] Forcing token refresh for user:', user.uid);
        // Force refresh to get the latest claims
        const idTokenResult = await user.getIdTokenResult(true); // FORCE REFRESH = TRUE
        console.log('[AdminProtectedRoute] User Claims:', idTokenResult.claims); // Log claims
        // التحقق من الأدوار الموحدة حسب الهيكلة المتفق عليها
        const userRole = idTokenResult.claims.role;

        // أدوار النظام العامة (المستوى 1-2) - النمط الجديد is* فقط
        const userIsSystemOwner = userRole === 'isSystemOwner' || idTokenResult.claims.isSystemOwner === true;
        const userIsSystemAdmin = userRole === 'isSystemAdmin' || idTokenResult.claims.isSystemAdmin === true;

        // أدوار المؤسسات (المستوى 3-8) - النمط الجديد is* فقط
        const userisOrgOwner = userRole === 'isOrgOwner' || idTokenResult.claims.isOrgOwner === true;
        const userIsOrgAdmin = userRole === 'isOrgAdmin' || idTokenResult.claims.isOrgAdmin === true;
        const userIsOrgSupervisor = userRole === 'isOrgSupervisor' || idTokenResult.claims.isOrgSupervisor === true;
        const userIsOrgEngineer = userRole === 'isOrgEngineer' || idTokenResult.claims.isOrgEngineer === true;
        const userIsOrgTechnician = userRole === 'isOrgTechnician' || idTokenResult.claims.isOrgTechnician === true;
        const userIsOrgAssistant = userRole === 'isOrgAssistant' || idTokenResult.claims.isOrgAssistant === true;

        // النظام الموحد - تحديد مستويات الوصول
        const hasOwnerAccess = userIsSystemOwner;
        const hasAdminAccess = userIsSystemAdmin || userisOrgOwner ||
                               userIsOrgAdmin || userIsOrgSupervisor || userIsOrgEngineer ||
                               userIsOrgTechnician || userIsOrgAssistant;

        console.log('[AdminProtectedRoute] System Owner:', userIsSystemOwner);
        console.log('[AdminProtectedRoute] System Admin:', userIsSystemAdmin);
        console.log('[AdminProtectedRoute] Organization Owner:', userisOrgOwner);
        console.log('[AdminProtectedRoute] Org Admin:', userIsOrgAdmin);
        console.log('[AdminProtectedRoute] Org Supervisor:', userIsOrgSupervisor);
        console.log('[AdminProtectedRoute] Org Engineer:', userIsOrgEngineer);
        console.log('[AdminProtectedRoute] Org Technician:', userIsOrgTechnician);
        console.log('[AdminProtectedRoute] Org Assistant:', userIsOrgAssistant);
        console.log('[AdminProtectedRoute] Has Owner Access:', hasOwnerAccess);
        console.log('[AdminProtectedRoute] Has Admin Access:', hasAdminAccess);
        setIsAdmin(hasAdminAccess);
        setIsOwner(hasOwnerAccess);

        if (!hasAdminAccess && !hasOwnerAccess) {
          console.log('[AdminProtectedRoute] User is NOT admin or owner, redirecting to home.');
          toast({
              title: 'غير مصرح به',
              description: 'ليس لديك الإذن للوصول إلى هذه الصفحة.',
              variant: 'destructive',
          });
          router.push('/'); // Redirect non-admins to the home page
        } else {
           console.log('[AdminProtectedRoute] User IS admin or owner. Access granted.');
        }
      } catch (error) {
        console.error('[AdminProtectedRoute] Error checking admin status:', error);
        toast({
            title: 'خطأ في التحقق',
            description: 'حدث خطأ أثناء التحقق من صلاحيات المسؤول.',
            variant: 'destructive',
        });
        setIsAdmin(false); // Assume not admin on error
        router.push('/'); // Redirect on error
      } finally {
        // Ensure loading is set to false only after the check completes or if redirected
        if (loading) setLoading(false);
         console.log('[AdminProtectedRoute] Check finished.');
      }
    };

    // Run the check whenever the user or authLoading state changes.
    // This ensures we re-check claims if the user logs in/out or if the token might have expired.
    checkAdminStatus();

  }, [user, authLoading, router, toast]); // Removed loading and isAdmin from dependencies to avoid loops, rely on user/authLoading

  // Show loading indicator while checking auth and admin status
  if (authLoading || loading) { // Show loading if either auth or the admin check is loading
     console.log(`[AdminProtectedRoute] Rendering loading spinner (authLoading: ${authLoading}, loading: ${loading})`);
     return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <span className="ml-2">جارٍ التحقق من الصلاحيات...</span>
      </div>
    );
  }

  // Render children only if user is authenticated and is an admin or owner
   console.log(`[AdminProtectedRoute] Rendering children? user: ${!!user}, isAdmin: ${isAdmin}, isOwner: ${isOwner}`);
  return user && (isAdmin === true || isOwner === true) ? <>{children}</> : null; // Render null while redirecting or if not authorized
}
