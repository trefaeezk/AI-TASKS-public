
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
import { firestoreListenerManager, handleFirestoreError } from '@/utils/firestoreListenerManager';

interface UserClaims {
  role?: string;
  admin?: boolean;
  owner?: boolean;
  individual_admin?: boolean;
  accountType?: SystemType;
  organizationId?: string;
  organizationName?: string;
  departmentId?: string;
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

  const determineAndSetAccountType = useCallback(async (currentUser: User, currentAuthClaims: UserClaims): Promise<UserClaims> => {
    console.log("[AuthContext] Starting determineAndSetAccountType for user:", currentUser.uid, "Current Claims:", currentAuthClaims);
    let finalClaims = { ...currentAuthClaims };
    let claimsNeedBackendUpdate = false;
    let determinedAccountType: SystemType | undefined = finalClaims.accountType;
    let determinedOrgId: string | undefined = finalClaims.organizationId;
    let determinedOrgName: string | undefined = finalClaims.organizationName;
    let determinedRole: string | undefined = finalClaims.role;

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.organizationId) {
        const orgIdFromUserDoc = userDocSnap.data().organizationId;
        const orgNameFromUserDoc = userDocSnap.data().organizationName || 'المؤسسة'; // Default name
        const memberDocRef = doc(db, 'organizations', orgIdFromUserDoc, 'members', currentUser.uid);
        const memberDocSnap = await getDoc(memberDocRef);

        if (memberDocSnap.exists()) {
          console.log(`[AuthContext] User is member of org ${orgIdFromUserDoc}. Firestore type: 'organization'.`);
          determinedAccountType = 'organization';
          determinedOrgId = orgIdFromUserDoc;
          determinedOrgName = orgNameFromUserDoc;
          determinedRole = userDocSnap.data().role || memberDocSnap.data()?.role || finalClaims.role;
        } else {
          console.log(`[AuthContext] User doc has orgId ${orgIdFromUserDoc}, but not in members. Fallback to 'individual'.`);
          determinedAccountType = 'individual';
          determinedOrgId = undefined;
          determinedOrgName = undefined;
          determinedRole = 'independent';
        }
      } else {
        const individualDocRef = doc(db, 'individuals', currentUser.uid);
        const individualDocSnap = await getDoc(individualDocRef);
        if (individualDocSnap.exists()) {
          console.log("[AuthContext] User found in 'individuals'. Firestore type: 'individual'.");
          determinedAccountType = 'individual';
          determinedOrgId = undefined;
          determinedOrgName = undefined;
          determinedRole = 'independent';
        } else {
          console.log("[AuthContext] User not in 'users' with org or 'individuals'. Defaulting to 'individual' and creating doc.");
          determinedAccountType = 'individual';
          determinedOrgId = undefined;
          determinedOrgName = undefined;
          determinedRole = 'independent';
          try {
            await setDoc(individualDocRef, {
              name: currentUser.displayName || currentUser.email || '', email: currentUser.email,
              role: 'independent', accountType: 'individual',
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
            console.log("[AuthContext] Created 'individuals' doc for new user:", currentUser.uid);
          } catch (docError) { console.error("[AuthContext] Error creating 'individuals' doc:", docError); }
        }
      }

      // Check if claims from token need updating based on Firestore data
      if (
        finalClaims.accountType !== determinedAccountType ||
        finalClaims.organizationId !== determinedOrgId ||
        finalClaims.organizationName !== determinedOrgName ||
        finalClaims.role !== determinedRole
      ) {
        claimsNeedBackendUpdate = true;
        finalClaims.accountType = determinedAccountType;
        finalClaims.organizationId = determinedOrgId;
        finalClaims.organizationName = determinedOrgName;
        finalClaims.role = determinedRole;
      }


      if (claimsNeedBackendUpdate) {
        console.log("[AuthContext] Account type/role claims mismatch or need initialization, calling updateAccountType Cloud Function with:", {
          accountType: finalClaims.accountType,
          organizationId: finalClaims.organizationId,
          // We don't pass role to updateAccountType, it's managed by setAdminRole/setOwnerRole
        });
        const { httpsCallable } = await import('firebase/functions');
        const { functions: firebaseFunctions } = await import('@/lib/firebase'); // Ensure correct import
        const updateAccountTypeFunc = httpsCallable(firebaseFunctions, 'updateAccountType');

        await updateAccountTypeFunc({
          accountType: finalClaims.accountType,
          organizationId: finalClaims.organizationId,
          // Do not send organizationName here, as the function might not expect it
        });
        console.log("[AuthContext] Cloud Function updateAccountType called. Forcing token refresh.");
        const refreshedTokenResult = await getIdTokenResult(currentUser, true); // Force refresh after backend update
        finalClaims = refreshedTokenResult.claims as UserClaims;
        console.log("[AuthContext] Claims refreshed after backend update:", finalClaims);
      }
    } catch (error) {
      console.error("[AuthContext] Error in determineAndSetAccountType:", error);
      // Fallback to current auth claims if determination fails to prevent breaking auth state
      // but log that determination failed
    }
    console.log("[AuthContext] Exiting determineAndSetAccountType with final claims:", finalClaims);
    return finalClaims;
  }, []);

  const refreshUserData = useCallback(async (forceRefresh = true) => { // Default to true for explicit calls
    console.log("[AuthContext] refreshUserData called, forceRefresh:", forceRefresh);
    if (!auth.currentUser) {
      console.log("[AuthContext] No current user in auth, skipping refresh.");
      setUserClaims(null);
      setUser(null);
      return;
    }

    const now = Date.now();
    const minRefreshInterval = forceRefresh ? 0 : 30000; // 30 seconds for non-forced refresh

    if (!forceRefresh && (now - lastRefreshTimeRef.current < minRefreshInterval)) {
      console.log("[AuthContext] Skipping refresh, too soon or not forced.");
      return;
    }
    setLoading(true); // Indicate loading during refresh
    try {
      lastRefreshTimeRef.current = now;
      console.log("[AuthContext] Refreshing user token and data via refreshUserData...");
      await auth.currentUser.reload(); // Reload user data from Firebase Auth
      const tokenResult = await getIdTokenResult(auth.currentUser, true);
      const initialClaims = tokenResult.claims as UserClaims;
      console.log("[AuthContext] Claims from token (refreshUserData):", initialClaims);

      const finalProcessedClaims = await determineAndSetAccountType(auth.currentUser, initialClaims);
      setUser(auth.currentUser);
      setUserClaims(finalProcessedClaims);
      console.log("[AuthContext] User claims updated via refreshUserData:", finalProcessedClaims);
    } catch (error) {
      console.error("[AuthContext] Error refreshing user data:", error);
      if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
        console.warn("[AuthContext] User token invalid during refreshUserData, signing out.");
        await auth.signOut();
      }
    } finally {
      setLoading(false); // Stop loading after refresh
    }
  }, [determineAndSetAccountType]);


  useEffect(() => {
    console.log("[AuthContext] Setting up auth state listener.");
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (isProcessingAuthStateRef.current) {
        console.log("[AuthContext] Auth state change ignored, already processing.");
        return;
      }
      isProcessingAuthStateRef.current = true;
      console.log("[AuthContext] Auth state changed, user:", currentUser?.uid, "Current loading state:", loading);

      // إلغاء جميع Firestore listeners فوراً عند تغيير حالة المصادقة
      firestoreListenerManager.removeAllListeners();
      if (firestoreListener) {
        console.log("[AuthContext] Cleaning up existing Firestore listener due to auth state change.");
        firestoreListener();
        setFirestoreListener(null);
      }

      // Always set loading true at the beginning of auth state change processing
      // This ensures that if a user logs out and then logs in quickly,
      // the loading state is correctly managed.
      if(!loading) setLoading(true);


      if (currentUser) {
        try {
          const initialTokenResult = await getIdTokenResult(currentUser, true);
          const initialClaims = initialTokenResult.claims as UserClaims;
          console.log("[AuthContext] Initial claims for user:", currentUser.uid, initialClaims);

          const finalProcessedClaims = await determineAndSetAccountType(currentUser, initialClaims);
          setUser(currentUser);
          setUserClaims(finalProcessedClaims);
          console.log("[AuthContext] Final claims set for user:", currentUser.uid, finalProcessedClaims);

          // Routing logic based on final processed claims
          const currentPath = pathname; // Use pathname from usePathname
          console.log("[AuthContext] Current path for routing:", currentPath);
          if (finalProcessedClaims.accountType === 'organization' && finalProcessedClaims.organizationId) {
            if (!currentPath.startsWith('/org')) {
              console.log("[AuthContext] Redirecting to /org for organization user.");
              router.replace('/org');
            }
          } else if (finalProcessedClaims.accountType === 'individual') {
            if (currentPath.startsWith('/org')) {
              console.log("[AuthContext] Redirecting to / for individual user from /org path.");
              router.replace('/');
            }
          } else {
            // This case should ideally not happen if determineAndSetAccountType ensures an accountType
            console.warn("[AuthContext] Account type undetermined. Current path:", currentPath);
            if (currentPath.startsWith('/org')) {
               router.replace('/'); // Fallback redirect if stuck on org path
            }
          }
        } catch (error) {
          console.error("[AuthContext] Error processing auth state (user exists):", currentUser.uid, error);
          setUser(null);
          setUserClaims(null);
          if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
             console.warn("[AuthContext] Critical auth error on user, signing out.");
             await auth.signOut(); // This will re-trigger onAuthStateChanged
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
        setLoading(false); // No user, so not loading
        isProcessingAuthStateRef.current = false;
        // No need to redirect to /login here if already on /login or /signup, etc.
        // ProtectedRoute component will handle redirection for protected pages.
      }
    });

    return () => {
      console.log("[AuthContext] Cleaning up auth state listener.");
      unsubscribeAuth();

      // إلغاء جميع Firestore listeners
      firestoreListenerManager.removeAllListeners();

      if (firestoreListener) {
        console.log("[AuthContext] Cleaning up Firestore listener.");
        firestoreListener();
        setFirestoreListener(null);
      }
      isProcessingAuthStateRef.current = false; // Reset on cleanup
    };
  }, [determineAndSetAccountType, router, pathname]); // Added pathname

  useEffect(() => {
    if (firestoreListener) {
      firestoreListener(); // Clean up previous listener
      setFirestoreListener(null);
    }

    if (user && userClaims) {
      let docPath: string | null = null;
      if (userClaims.accountType === 'organization' && userClaims.organizationId) {
        docPath = `organizations/${userClaims.organizationId}/members/${user.uid}`;
      } else if (userClaims.accountType === 'individual') {
        docPath = `individuals/${user.uid}`;
      } else if (userClaims.role) { // Fallback to 'users' collection if role exists but type is unclear
        docPath = `users/${user.uid}`;
      }


      if (docPath) {
        console.log("[AuthContext] Setting up Firestore listener for path:", docPath);
        const userDocRef = doc(db, docPath);
        const unsubscribeFirestore = onSnapshot(userDocRef, async (docSnapshot) => {
          console.log("[AuthContext] Firestore snapshot for", docPath, "exists:", docSnapshot.exists());
          if (docSnapshot.exists()) {
            const firestoreData = docSnapshot.data();
            // Check if relevant data (like role) changed in Firestore
            if (firestoreData.role && userClaims.role !== firestoreData.role) {
              console.log("[AuthContext] Role changed in Firestore for path", docPath, "forcing claims refresh.");
              await refreshUserData(true);
            }
          } else {
            // If the doc doesn't exist (e.g., user removed from org), claims might be stale.
            console.log("[AuthContext] User document at", docPath, "does not exist. Forcing claims refresh.");
            await refreshUserData(true);
          }
        }, (error: any) => {
          const isPermissionError = handleFirestoreError(error, 'AuthContext');

          if (isPermissionError) {
            // إلغاء listener إذا كان الخطأ بسبب عدم وجود مصادقة
            if (!auth.currentUser) {
              console.log("[AuthContext] No authenticated user, cleaning up Firestore listener.");
              if (firestoreListener) {
                firestoreListener();
                setFirestoreListener(null);
              }
              return;
            }

            if (docPath?.startsWith('organizations/')) {
              console.warn(
                `[AuthContext] Firestore permission denied for ${docPath}.
                This user (UID: ${user?.uid}) may not have permission to read their own member document at this path.
                Please check your Firestore security rules.
                Example rule:
                match /organizations/{orgId}/members/{memberId} {
                  allow read: if request.auth.uid == memberId;
                }
                Real-time role updates from this path might not work until rules are fixed.`
              );
            }
          }
        });
        setFirestoreListener(() => unsubscribeFirestore);
      } else {
        console.log("[AuthContext] No valid docPath for Firestore listener, userClaims:", userClaims);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userClaims?.accountType, userClaims?.organizationId, userClaims?.role]); // Role is important here if it changes


  // Render loading spinner only if truly loading initial auth state.
  // The children (layouts/pages) should handle their own loading states for subsequent data fetching.
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
