
// src/context/AuthContext.tsx
'use client';

import type { User } from 'firebase/auth';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/config/firebase';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { SystemType } from '@/types/system';

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
  loading: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [userClaims, setUserClaims] = useState<UserClaims | null>(null);
  const [loading, setLoading] = useState(true); // Stays true until initial auth & account type check is done
  const [firestoreListener, setFirestoreListener] = useState<(() => void) | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const isDeterminingAccountTypeRef = useRef<boolean>(false); // To prevent race conditions

  const refreshUserData = useCallback(async (forceRefresh = false) => {
    console.log("[AuthContext] refreshUserData called, forceRefresh:", forceRefresh);
    if (!auth.currentUser) {
      console.log("[AuthContext] No current user in auth, skipping refresh");
      setUserClaims(null); // Clear claims if no user
      setUser(null);
      return;
    }

    const now = Date.now();
    const minRefreshInterval = forceRefresh ? 0 : 5000; // Only refresh if forced or 5s passed

    if (!forceRefresh && (now - lastRefreshTimeRef.current < minRefreshInterval)) {
      console.log("[AuthContext] Skipping refresh, too soon or not forced.");
      return;
    }

    try {
      lastRefreshTimeRef.current = now;
      console.log("[AuthContext] Refreshing user token and data...");
      await auth.currentUser.reload();
      const tokenResult = await getIdTokenResult(auth.currentUser, true); // force token refresh
      const claims = tokenResult.claims as UserClaims;
      setUserClaims(claims);
      setUser(auth.currentUser); // Update user state with potentially reloaded user
      console.log("[AuthContext] User claims updated via refreshUserData:", claims);
    } catch (error) {
      console.error("[AuthContext] Error refreshing user data:", error);
      if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
        console.warn("[AuthContext] User token invalid during refresh, signing out.");
        await auth.signOut(); // This will trigger onAuthStateChanged
      }
    }
  }, []);

  const determineAndSetAccountType = useCallback(async (currentUser: User, currentAuthClaims: UserClaims): Promise<UserClaims> => {
    if (isDeterminingAccountTypeRef.current) {
      console.log("[AuthContext] determineAndSetAccountType already in progress, skipping.");
      return currentAuthClaims;
    }
    isDeterminingAccountTypeRef.current = true;
    console.log("[AuthContext] Starting determineAndSetAccountType for user:", currentUser.uid);
    let finalClaims = { ...currentAuthClaims };
    let claimsNeedBackendUpdate = false;

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.organizationId) {
        const orgIdFromUserDoc = userDocSnap.data().organizationId;
        const orgNameFromUserDoc = userDocSnap.data().organizationName || 'المؤسسة';
        const memberDocRef = doc(db, 'organizations', orgIdFromUserDoc, 'members', currentUser.uid);
        const memberDocSnap = await getDoc(memberDocRef);

        if (memberDocSnap.exists()) {
          console.log(`[AuthContext] User is member of org ${orgIdFromUserDoc}. Verified type: 'organization'.`);
          if (finalClaims.accountType !== 'organization' || finalClaims.organizationId !== orgIdFromUserDoc || finalClaims.organizationName !== orgNameFromUserDoc) {
            finalClaims.accountType = 'organization';
            finalClaims.organizationId = orgIdFromUserDoc;
            finalClaims.organizationName = orgNameFromUserDoc;
            finalClaims.role = userDocSnap.data().role || memberDocSnap.data()?.role || finalClaims.role; // Prioritize user doc role
            claimsNeedBackendUpdate = true;
          }
        } else {
          console.log(`[AuthContext] User doc has orgId ${orgIdFromUserDoc}, but not in members. Setting type to 'individual'.`);
          if (finalClaims.accountType !== 'individual' || finalClaims.organizationId) {
            finalClaims.accountType = 'individual';
            finalClaims.organizationId = undefined;
            finalClaims.organizationName = undefined;
            finalClaims.role = 'independent';
            claimsNeedBackendUpdate = true;
          }
        }
      } else {
        const individualDocRef = doc(db, 'individuals', currentUser.uid);
        const individualDocSnap = await getDoc(individualDocRef);
        if (individualDocSnap.exists()) {
          console.log("[AuthContext] User found in 'individuals'. Verified type: 'individual'.");
          if (finalClaims.accountType !== 'individual' || finalClaims.organizationId) {
            finalClaims.accountType = 'individual';
            finalClaims.organizationId = undefined;
            finalClaims.organizationName = undefined;
            finalClaims.role = 'independent';
            claimsNeedBackendUpdate = true;
          }
        } else {
          console.log("[AuthContext] User not in 'users' with org or 'individuals'. Defaulting to 'individual'.");
          if (finalClaims.accountType !== 'individual') {
            finalClaims.accountType = 'individual';
            finalClaims.organizationId = undefined;
            finalClaims.organizationName = undefined;
            finalClaims.role = 'independent';
            claimsNeedBackendUpdate = true;
            try {
              await setDoc(individualDocRef, {
                name: currentUser.displayName || currentUser.email || '', email: currentUser.email,
                role: 'independent', accountType: 'individual',
                createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
              });
            } catch (docError) { console.error("[AuthContext] Error creating 'individuals' doc:", docError); }
          }
        }
      }

      if (claimsNeedBackendUpdate) {
        console.log("[AuthContext] Account type claims changed, updating Firebase Auth claims:", finalClaims);
        const { httpsCallable } = await import('firebase/functions');
        const { functions: firebaseFunctions } = await import('@/lib/firebase');
        const updateAccountTypeFunc = httpsCallable(firebaseFunctions, 'updateAccountType');
        await updateAccountTypeFunc({
          accountType: finalClaims.accountType,
          organizationId: finalClaims.organizationId,
        });
        // Crucially, refresh token to get the *new* claims from backend
        const refreshedTokenResult = await getIdTokenResult(currentUser, true);
        finalClaims = refreshedTokenResult.claims as UserClaims;
        console.log("[AuthContext] Claims refreshed after backend update:", finalClaims);
      }
    } catch (error) {
      console.error("[AuthContext] Error in determineAndSetAccountType:", error);
      // Fallback to current auth claims if determination fails
      finalClaims = currentAuthClaims;
    } finally {
      isDeterminingAccountTypeRef.current = false;
    }
    return finalClaims;
  }, []);

  useEffect(() => {
    console.log("[AuthContext] Setting up auth state listener.");
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      console.log("[AuthContext] Auth state changed, user:", currentUser?.uid);
      setLoading(true); // Ensure loading is true during this process

      if (currentUser) {
        try {
          const initialTokenResult = await getIdTokenResult(currentUser, true); // Force refresh for initial claims
          const initialClaims = initialTokenResult.claims as UserClaims;
          console.log("[AuthContext] Initial claims from token for user:", currentUser.uid, initialClaims);

          const finalProcessedClaims = await determineAndSetAccountType(currentUser, initialClaims);
          setUser(currentUser);
          setUserClaims(finalProcessedClaims);
          console.log("[AuthContext] Final claims set for user:", currentUser.uid, finalProcessedClaims);

          // Routing logic
          const currentPath = window.location.pathname;
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
            console.warn("[AuthContext] Account type is still null/undefined. This shouldn't happen if determineAndSetAccountType works correctly. Staying on current path or redirecting to / if on /org.");
             if (currentPath.startsWith('/org')) {
                router.replace('/');
            }
          }
        } catch (error) {
          console.error("[AuthContext] Error processing auth state change for user:", currentUser.uid, error);
          setUser(null);
          setUserClaims(null);
          // Handle specific auth errors that might require sign-out
          if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
             console.warn("[AuthContext] Critical auth error, signing out and redirecting to login.");
             await auth.signOut(); // This will re-trigger onAuthStateChanged
             router.push('/login'); // Explicit redirect
          }
        } finally {
          setLoading(false); // Set loading to false only after all processing is done
        }
      } else {
        console.log("[AuthContext] No user authenticated, clearing state.");
        setUser(null);
        setUserClaims(null);
        setLoading(false); // No user, so not loading
      }
    });

    return () => {
      console.log("[AuthContext] Cleaning up auth state listener.");
      unsubscribeAuth();
      if (firestoreListener) {
        console.log("[AuthContext] Cleaning up Firestore listener.");
        firestoreListener();
      }
    };
  }, [determineAndSetAccountType, router]); // refreshUserData removed as it's used internally

  useEffect(() => {
    if (firestoreListener) {
      firestoreListener(); // Clean up previous listener
      setFirestoreListener(null);
    }

    if (user && userClaims) {
      let docPath: string;
      if (userClaims.accountType === 'organization' && userClaims.organizationId) {
        docPath = `organizations/${userClaims.organizationId}/members/${user.uid}`;
      } else { // Default or individual
        docPath = `users/${user.uid}`; // Listen to 'users' for role changes even for individuals if that's where it's stored
      }
      
      console.log("[AuthContext] Setting up Firestore listener for path:", docPath);
      const userDocRef = doc(db, docPath);
      const unsubscribeFirestore = onSnapshot(userDocRef, async (docSnapshot) => {
        console.log("[AuthContext] Firestore snapshot for", docPath, "exists:", docSnapshot.exists());
        if (docSnapshot.exists()) {
          const firestoreData = docSnapshot.data();
          if (firestoreData.role && userClaims.role !== firestoreData.role) {
            console.log("[AuthContext] Role changed in Firestore, forcing claims refresh.");
            await refreshUserData(true);
          }
        } else {
          // If the doc doesn't exist (e.g., user removed from org), claims might be stale.
          console.log("[AuthContext] User document at", docPath, "does not exist. Forcing claims refresh.");
          await refreshUserData(true);
        }
      }, (error) => {
        console.error("[AuthContext] Error in Firestore listener for path:", docPath, error);
      });
      setFirestoreListener(() => unsubscribeFirestore);
    }
  }, [user, userClaims, refreshUserData]);


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

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
