
// src/context/AuthContext.tsx
'use client';

import type { User } from 'firebase/auth';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { auth } from '@/config/firebase';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { SystemType } from '@/types/system';
import { UserRole, PermissionKey } from '@/types/roles';
import { firestoreListenerManager, handleFirestoreError } from '@/utils/firestoreListenerManager';

interface UserClaims {
  // الأدوار المتاحة في النظام الجديد فقط
  role?: UserRole;

  // النمط الجديد is* فقط - بدون أي توافق قديم
  isSystemOwner?: boolean;       // مالك النظام
  isSystemAdmin?: boolean;       // أدمن النظام
  isOrgOwner?: boolean;          // مالك المؤسسة
  isOrgAdmin?: boolean;          // أدمن المؤسسة
  isOrgSupervisor?: boolean;     // مشرف المؤسسة
  isOrgEngineer?: boolean;       // مهندس المؤسسة
  isOrgTechnician?: boolean;     // فني المؤسسة
  isOrgAssistant?: boolean;      // مساعد المؤسسة
  isIndependent?: boolean;       // مستخدم مستقل

  // معلومات الحساب
  accountType?: SystemType;
  organizationId?: string;
  organizationName?: string;
  departmentId?: string;

  // صلاحيات مخصصة
  customPermissions?: PermissionKey[];

  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean; // This will be true until initial auth check and account type determination is complete
  userClaims: UserClaims | null;
  refreshUserData: (forceRefresh?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userClaims: null,
  refreshUserData: async () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const [user, setUser] = useState<User | null>(null);
  const [userClaims, setUserClaims] = useState<UserClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [firestoreListener, setFirestoreListener] = useState<(() => void) | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const isProcessingAuthStateRef = useRef<boolean>(false); // To prevent race conditions

  const getUserDataFromFirestore = useCallback(async (currentUser: User): Promise<UserClaims> => {
    console.log("[AuthContext] 🔍 جلب بيانات المستخدم:", currentUser.uid);

    // Force refresh ID token to get latest claims
    const idTokenResult = await currentUser.getIdTokenResult(true);
    const claimsFromToken = idTokenResult.claims as UserClaims;
    console.log("[AuthContext] 🔑 Firebase Token Claims (Refreshed):", claimsFromToken);

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.log("[AuthContext] 🆕 مستخدم جديد - الوثيقة غير موجودة، الاعتماد على Token Claims أو البيانات الافتراضية");

        if (claimsFromToken.accountType && claimsFromToken.role) {
            console.log("[AuthContext] 🔄 استخدام البيانات من Custom Claims (مباشرة بعد التحديث):", claimsFromToken);
            return {
              accountType: claimsFromToken.accountType,
              role: claimsFromToken.role,
              organizationId: claimsFromToken.organizationId,
              organizationName: claimsFromToken.organizationName,
              departmentId: claimsFromToken.departmentId,
              isSystemOwner: !!claimsFromToken.isSystemOwner,
              isSystemAdmin: !!claimsFromToken.isSystemAdmin,
              isOrgOwner: !!claimsFromToken.isOrgOwner,
              isOrgAdmin: !!claimsFromToken.isOrgAdmin,
              isOrgSupervisor: !!claimsFromToken.isOrgSupervisor,
              isOrgEngineer: !!claimsFromToken.isOrgEngineer,
              isOrgTechnician: !!claimsFromToken.isOrgTechnician,
              isOrgAssistant: !!claimsFromToken.isOrgAssistant,
              isIndependent: !!claimsFromToken.isIndependent,
              customPermissions: claimsFromToken.customPermissions || []
            };
        }

        console.log("[AuthContext] استخدام البيانات الافتراضية للمستخدم الجديد (الوثيقة لم تنشأ بعد)");
        return {
          accountType: 'individual',
          role: 'isIndependent',
          isSystemOwner: false,
          isSystemAdmin: false,
          isOrgOwner: false,
          isOrgAdmin: false,
          isOrgSupervisor: false,
          isOrgEngineer: false,
          isOrgTechnician: false,
          isOrgAssistant: false,
          isIndependent: true,
          customPermissions: [],
          departmentId: undefined
        };
      }

      const userData = userDocSnap.data() as any;
      console.log("[AuthContext] ✅ بيانات المستخدم الأساسية من Firestore:", userData);

      const accountType = claimsFromToken.accountType || userData.accountType || 'individual';
      let role = claimsFromToken.role || userData.role;

      // Ensure role consistency
      const isSystemOwner = !!claimsFromToken.isSystemOwner || !!userData.isSystemOwner;
      const isSystemAdmin = !!claimsFromToken.isSystemAdmin || !!userData.isSystemAdmin;
      const isOrgOwner = !!claimsFromToken.isOrgOwner || !!userData.isOrgOwner;
      const isOrgAdmin = !!claimsFromToken.isOrgAdmin || !!userData.isOrgAdmin;
      const isOrgSupervisor = !!claimsFromToken.isOrgSupervisor || !!userData.isOrgSupervisor;
      const isOrgEngineer = !!claimsFromToken.isOrgEngineer || !!userData.isOrgEngineer;
      const isOrgTechnician = !!claimsFromToken.isOrgTechnician || !!userData.isOrgTechnician;
      const isOrgAssistant = !!claimsFromToken.isOrgAssistant || !!userData.isOrgAssistant;
      const isIndependent = !!claimsFromToken.isIndependent || !!userData.isIndependent;

      // Prioritize specific roles from claims/Firestore
      if (isSystemOwner) role = 'isSystemOwner';
      else if (isSystemAdmin) role = 'isSystemAdmin';
      else if (isOrgOwner) role = 'isOrgOwner';
      else if (isOrgAdmin) role = 'isOrgAdmin';
      else if (isOrgSupervisor) role = 'isOrgSupervisor';
      else if (isOrgEngineer) role = 'isOrgEngineer';
      else if (isOrgTechnician) role = 'isOrgTechnician';
      else if (isOrgAssistant) role = 'isOrgAssistant';
      else if (isIndependent) role = 'isIndependent';
      else role = accountType === 'individual' ? 'isIndependent' : 'isOrgAssistant';


      const finalClaimsResult: UserClaims = {
          accountType: accountType as SystemType,
          role: role as UserRole,
          organizationId: claimsFromToken.organizationId || userData.organizationId || undefined,
          organizationName: claimsFromToken.organizationName || userData.organizationName || (accountType === 'organization' ? 'مؤسسة' : undefined),
          departmentId: claimsFromToken.departmentId || userData.departmentId || undefined,
          isSystemOwner,
          isSystemAdmin,
          isOrgOwner,
          isOrgAdmin,
          isOrgSupervisor,
          isOrgEngineer,
          isOrgTechnician,
          isOrgAssistant,
          isIndependent,
          customPermissions: claimsFromToken.customPermissions || userData.customPermissions || []
      };
       console.log("[AuthContext] ✅ البيانات النهائية المجمعة:", finalClaimsResult);
       return finalClaimsResult;

    } catch (error) {
      console.error("[AuthContext] ❌ خطأ في جلب بيانات المستخدم:", error);
      // Fallback to token claims if Firestore read fails or is problematic
      if (claimsFromToken.accountType && claimsFromToken.role) {
        console.warn("[AuthContext] Fallback to token claims due to Firestore error.");
        return {
            accountType: claimsFromToken.accountType,
            role: claimsFromToken.role,
            organizationId: claimsFromToken.organizationId,
            organizationName: claimsFromToken.organizationName,
            departmentId: claimsFromToken.departmentId,
            isSystemOwner: !!claimsFromToken.isSystemOwner,
            isSystemAdmin: !!claimsFromToken.isSystemAdmin,
            isOrgOwner: !!claimsFromToken.isOrgOwner,
            isOrgAdmin: !!claimsFromToken.isOrgAdmin,
            isOrgSupervisor: !!claimsFromToken.isOrgSupervisor,
            isOrgEngineer: !!claimsFromToken.isOrgEngineer,
            isOrgTechnician: !!claimsFromToken.isOrgTechnician,
            isOrgAssistant: !!claimsFromToken.isOrgAssistant,
            isIndependent: !!claimsFromToken.isIndependent,
            customPermissions: claimsFromToken.customPermissions || []
        };
      }
      // Final fallback
      return {
        accountType: 'individual',
        role: 'isIndependent'
      };
    }
  }, []);

  const refreshUserData = useCallback(async (forceRefresh = true) => {
    console.log("[AuthContext] refreshUserData called, forceRefresh:", forceRefresh);
    if (!auth.currentUser) {
      console.log("[AuthContext] No current user in auth, skipping refresh.");
      setUserClaims(null);
      setUser(null);
      return;
    }

    const now = Date.now();
    const minRefreshInterval = forceRefresh ? 0 : 30000;

    if (!forceRefresh && (now - lastRefreshTimeRef.current < minRefreshInterval)) {
      console.log("[AuthContext] Skipping refresh, too soon or not forced.");
      return;
    }
    if (!loading) setLoading(true);
    try {
      lastRefreshTimeRef.current = now;
      console.log("[AuthContext] 🔄 تحديث بيانات المستخدم...");

      await auth.currentUser.reload();
      const finalProcessedClaims = await getUserDataFromFirestore(auth.currentUser);

      setUser(auth.currentUser); // Update user object as well
      setUserClaims(finalProcessedClaims);
      console.log("[AuthContext] ✅ تم تحديث بيانات المستخدم:", finalProcessedClaims);
    } catch (error) {
      console.error("[AuthContext] Error refreshing user data:", error);
      if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
        console.warn("[AuthContext] User token invalid during refreshUserData, signing out.");
        await auth.signOut();
      }
    } finally {
      if (loading) setLoading(false);
    }
  }, [getUserDataFromFirestore, loading]); // Added loading to dependencies

  useEffect(() => {
    console.log("[AuthContext] Setting up auth state listener.");
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (isProcessingAuthStateRef.current) {
        console.log("[AuthContext] Auth state change ignored, already processing.");
        return;
      }
      isProcessingAuthStateRef.current = true;
      console.log("[AuthContext] Auth state changed, user:", currentUser?.uid, "Current loading state:", loading);

      if (firestoreListener) {
        console.log("[AuthContext] Cleaning up existing Firestore listener for current user doc due to auth state change.");
        firestoreListener();
        setFirestoreListener(null);
      }
      // Global listeners are now removed only during explicit sign-out in useFirebaseAuth.ts

      if(!loading) setLoading(true);

      if (currentUser) {
        try {
          console.log("[AuthContext] 👤 مستخدم مسجل دخول:", currentUser.uid);

          const finalProcessedClaims = await getUserDataFromFirestore(currentUser);
          setUser(currentUser);
          setUserClaims(finalProcessedClaims);
          console.log("[AuthContext] ✅ تم تعيين بيانات المستخدم:", finalProcessedClaims);

          const currentPath = pathname || '/';
          console.log("[AuthContext] 🔍 ROUTING DEBUG - Current path:", currentPath);
          console.log("[AuthContext] 🔍 ROUTING DEBUG - Account type:", finalProcessedClaims.accountType);

          if (finalProcessedClaims.accountType === 'organization' && finalProcessedClaims.organizationId) {
            const isSystemOwner = finalProcessedClaims.isSystemOwner === true;
            const isSystemAdmin = finalProcessedClaims.isSystemAdmin === true;
            const isOrgOwner = finalProcessedClaims.isOrgOwner === true;
            const isOrgAdmin = finalProcessedClaims.isOrgAdmin === true;
            const hasFullAccess = (isOrgOwner || isOrgAdmin) && !finalProcessedClaims.departmentId;
            const isDepartmentMember = finalProcessedClaims.departmentId && !hasFullAccess;
            const canAccessDashboard = isSystemOwner || isSystemAdmin || isOrgOwner || isOrgAdmin;

            if (!currentPath.startsWith('/org')) {
              if (isDepartmentMember && finalProcessedClaims.departmentId) {
                console.log("[AuthContext] ✅ Redirecting department member to their department page:", `/org/departments/${finalProcessedClaims.departmentId}`);
                router.replace(`/org/departments/${finalProcessedClaims.departmentId}`);
              } else if (canAccessDashboard) {
                console.log("[AuthContext] ✅ Redirecting to /org dashboard for high-level user.");
                router.replace('/org');
              } else {
                 const isLowRoleWithoutDepartment = !finalProcessedClaims.departmentId &&
                  (finalProcessedClaims.isOrgAssistant || finalProcessedClaims.isOrgTechnician ||
                   finalProcessedClaims.isOrgEngineer || finalProcessedClaims.isOrgSupervisor);
                if (isLowRoleWithoutDepartment) {
                  router.replace('/org/tasks');
                } else {
                  router.replace('/org');
                }
              }
            }
          } else if (finalProcessedClaims.accountType === 'individual') {
            if (currentPath.startsWith('/org/') || currentPath === '/org') {
              console.log("[AuthContext] ✅ Redirecting to / for individual user from /org path.");
              router.replace('/');
            }
          } else {
             console.warn("[AuthContext] ⚠️ Account type undetermined. Current path:", currentPath);
             if (currentPath.startsWith('/org/') || currentPath === '/org') {
               router.replace('/');
            }
          }
        } catch (error) {
          console.error("[AuthContext] Error processing auth state (user exists):", currentUser.uid, error);
          setUser(null);
          setUserClaims(null);
          if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
             console.warn("[AuthContext] Critical auth error on user, signing out.");
             await auth.signOut();
          }
        } finally {
          console.log("[AuthContext] Finished processing authenticated user. Setting loading to false.");
          setLoading(false);
          isProcessingAuthStateRef.current = false;
        }
      } else {
        console.log("[AuthContext] No user authenticated, clearing state. Setting loading to false.");
        setUser(null);
        setUserClaims(null);
        setLoading(false);
        isProcessingAuthStateRef.current = false;
      }
    });

    return () => {
      console.log("[AuthContext] Cleaning up auth state listener.");
      unsubscribeAuth();
      if (firestoreListener) {
        console.log("[AuthContext] Cleaning up Firestore listener for user doc.");
        firestoreListener();
        setFirestoreListener(null);
      }
      isProcessingAuthStateRef.current = false;
    };
  }, [getUserDataFromFirestore, router, pathname]);

  useEffect(() => {
    if (firestoreListener) {
      firestoreListener(); // Clean up previous listener for user doc
      setFirestoreListener(null);
    }

    if (user && userClaims) {
      let docPath: string | null = `users/${user.uid}`; // Always listen to the main user document

      console.log("[AuthContext] Setting up Firestore listener for user document:", docPath);
      const userDocRef = doc(db, docPath);
      const unsubscribeFirestore = onSnapshot(userDocRef, async (docSnapshot) => {
        console.log("[AuthContext] Firestore snapshot for", docPath, "exists:", docSnapshot.exists());
        if (docSnapshot.exists()) {
          const firestoreData = docSnapshot.data() as any;
          let needsRefresh = false;
          if (userClaims.role !== firestoreData.role) {
            console.log(`[AuthContext] Firestore role ('${firestoreData.role}') differs from claims role ('${userClaims.role}').`);
            needsRefresh = true;
          }
          if (userClaims.organizationId !== firestoreData.organizationId) {
            console.log(`[AuthContext] Firestore organizationId ('${firestoreData.organizationId}') differs from claims organizationId ('${userClaims.organizationId}').`);
            needsRefresh = true;
          }
          if (userClaims.departmentId !== firestoreData.departmentId) {
            console.log(`[AuthContext] Firestore departmentId ('${firestoreData.departmentId}') differs from claims departmentId ('${userClaims.departmentId}').`);
            needsRefresh = true;
          }
          const firestoreCustomPermissions = firestoreData.customPermissions || [];
          const claimsCustomPermissions = userClaims.customPermissions || [];
          if (JSON.stringify(firestoreCustomPermissions.sort()) !== JSON.stringify(claimsCustomPermissions.sort())) {
            console.log("[AuthContext] Firestore customPermissions differ from claims customPermissions.");
            needsRefresh = true;
          }

          if (needsRefresh) {
            console.log("[AuthContext] Firestore data for", docPath, "differs from current claims, forcing claims refresh.");
            await refreshUserData(true);
          }
        } else {
          console.log("[AuthContext] User document at", docPath, "does not exist. Forcing claims refresh (might be new user or data issue).");
          await refreshUserData(true);
        }
      }, (error: any) => {
        const isPermissionError = handleFirestoreError(error, 'AuthContext-UserDoc');
        if (isPermissionError && !auth.currentUser) {
          console.log("[AuthContext] No authenticated user for user doc listener, cleaning up.");
          if (firestoreListener) {
            firestoreListener();
            setFirestoreListener(null);
          }
        }
      });
      setFirestoreListener(() => unsubscribeFirestore);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userClaims?.role, userClaims?.organizationId, userClaims?.departmentId, JSON.stringify(userClaims?.customPermissions)]);


  if (loading && !user && pathname !== '/login' && pathname !== '/signup' && pathname !== '/reset-password') {
    console.log("[AuthContext] Displaying global loading spinner. Loading:", loading, "User:", !!user, "Path:", pathname);
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  console.log("[AuthContext] Rendering children. Loading:", loading, "User:", !!user, "Claims:", userClaims);

  return (
    <AuthContext.Provider value={{ user, loading, userClaims, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
