
// src/context/AuthContext.tsx
'use client';

import type { User } from 'firebase/auth';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/config/firebase';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { SystemType } from '@/types/system';

interface UserClaims {
  role?: string;
  admin?: boolean;
  owner?: boolean;
  individual_admin?: boolean;
  accountType?: SystemType;
  organizationId?: string;
  departmentId?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userClaims: UserClaims | null;
  refreshUserData: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [firestoreListener, setFirestoreListener] = useState<(() => void) | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const refreshUserData = useCallback(async (forceRefresh = false) => {
    console.log("[AuthContext] refreshUserData called, forceRefresh:", forceRefresh);

    if (!auth.currentUser) {
      console.log("[AuthContext] No current user in auth, skipping refresh");
      setUserClaims(null);
      setUser(null); // Ensure user state is also cleared if auth.currentUser is null
      return;
    }

    const now = Date.now();
    const minRefreshInterval = forceRefresh ? 0 : 1000; // Allow forced refresh

    if (now - lastRefreshTime < minRefreshInterval) {
      console.log("[AuthContext] Skipping refresh, too soon since last refresh or not forced.");
      return;
    }

    try {
      setLastRefreshTime(now);
      console.log("[AuthContext] Last refresh time updated to:", now);

      await auth.currentUser.reload();
      console.log("[AuthContext] User reloaded");

      const tokenResult = await getIdTokenResult(auth.currentUser, true); // force refresh
      console.log("[AuthContext] ID token result received in refreshUserData:", tokenResult.claims);

      const claims = tokenResult.claims as UserClaims;
      setUserClaims(claims);
      setUser(auth.currentUser); // Update user state with potentially reloaded user
      console.log("[AuthContext] User claims updated in refreshUserData:", claims);
    } catch (error) {
      console.error("[AuthContext] Error refreshing user data:", error);
       // If token is invalid (e.g., user deleted), sign out
       if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
        console.warn("[AuthContext] User token invalid or user not found, signing out.");
        await auth.signOut();
        setUser(null);
        setUserClaims(null);
        router.push('/login');
      }
    }
  }, [lastRefreshTime, router]);


  const determineAndSetAccountType = useCallback(async (currentUser: User, currentClaims: UserClaims): Promise<SystemType | null> => {
    console.log("[AuthContext] determineAndSetAccountType for user:", currentUser.uid, "Current claims:", currentClaims);

    // 1. Check if user is explicitly part of an organization via 'users' collection
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists() && userDocSnap.data()?.organizationId) {
      const orgIdFromUserDoc = userDocSnap.data().organizationId;
      console.log(`[AuthContext] User doc exists with organizationId: ${orgIdFromUserDoc}`);
      // Verify membership in that organization's 'members' subcollection
      const memberDocRef = doc(db, 'organizations', orgIdFromUserDoc, 'members', currentUser.uid);
      const memberDocSnap = await getDoc(memberDocRef);
      if (memberDocSnap.exists()) {
        console.log(`[AuthContext] User is a member of organization ${orgIdFromUserDoc}. Setting type to 'organization'.`);
        if (currentClaims.accountType !== 'organization' || currentClaims.organizationId !== orgIdFromUserDoc) {
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('@/lib/firebase');
          const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
          await updateAccountTypeFunc({ accountType: 'organization', organizationId: orgIdFromUserDoc });
          await refreshUserData(true); // Force refresh claims
        }
        return 'organization';
      } else {
        console.log(`[AuthContext] User doc has orgId ${orgIdFromUserDoc}, but not found in its members subcollection. Potential data inconsistency.`);
        // Fall through to check 'individuals' or default to individual
      }
    }

    // 2. Check if user is in the 'individuals' collection
    const individualDocRef = doc(db, 'individuals', currentUser.uid);
    const individualDocSnap = await getDoc(individualDocRef);
    if (individualDocSnap.exists()) {
      console.log("[AuthContext] User found in 'individuals' collection. Setting type to 'individual'.");
      if (currentClaims.accountType !== 'individual') {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');
        const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
        await updateAccountTypeFunc({ accountType: 'individual' });
        await refreshUserData(true); // Force refresh claims
      }
      return 'individual';
    }

    // 3. Fallback: If not found in 'users' with an org or in 'individuals', default to 'individual'
    // This could be a new user or a user whose data structure isn't fully formed yet.
    console.log("[AuthContext] User not found in 'users' with org or in 'individuals'. Defaulting to 'individual'.");
    if (currentClaims.accountType !== 'individual') { // Only update if it's not already individual
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');
        const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
        try {
            await updateAccountTypeFunc({ accountType: 'individual' });
            // Attempt to create the individual document if it doesn't exist
            if (!individualDocSnap.exists()) {
              await setDoc(individualDocRef, {
                name: currentUser.displayName || currentUser.email || '',
                email: currentUser.email,
                role: 'independent',
                accountType: 'individual',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              console.log("[AuthContext] Created document in 'individuals' for new individual user.");
            }
            await refreshUserData(true); // Force refresh claims
        } catch(error) {
            console.error("[AuthContext] Error setting default account type to individual:", error);
            // If setting type fails, return current claim's type or null
            return currentClaims.accountType || null;
        }
    }
    return 'individual';

  }, [refreshUserData]);


  useEffect(() => {
    console.log("[AuthContext] Setting up auth state listener");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("[AuthContext] Auth state changed, user:", currentUser?.uid);
      setLoading(true); // Set loading true at the start of auth state change
      setUser(currentUser);

      if (currentUser) {
        try {
          console.log("[AuthContext] User authenticated. Forcing token refresh for claims.");
          const tokenResult = await getIdTokenResult(currentUser, true); // Force refresh
          const claims = tokenResult.claims as UserClaims;
          console.log("[AuthContext] Initial claims from token:", claims);
          setUserClaims(claims);

          if (!initialCheckDone) {
            const determinedAccountType = await determineAndSetAccountType(currentUser, claims);
            console.log("[AuthContext] Determined account type:", determinedAccountType);

            // Re-fetch claims after potential update
            const finalTokenResult = await getIdTokenResult(currentUser, true);
            const finalClaims = finalTokenResult.claims as UserClaims;
            setUserClaims(finalClaims);
            console.log("[AuthContext] Final claims after account type determination:", finalClaims);

            // Routing logic
            const pathname = window.location.pathname;
            if (finalClaims.accountType === 'organization' && finalClaims.organizationId) {
              if (!pathname.startsWith('/org')) {
                console.log("[AuthContext] Redirecting to /org for organization user.");
                router.replace('/org');
              }
            } else if (finalClaims.accountType === 'individual') {
              if (pathname.startsWith('/org')) {
                console.log("[AuthContext] Redirecting to / for individual user from org path.");
                router.replace('/');
              }
            } else {
                // If accountType is still null or undefined, it might be a new user or error
                console.warn("[AuthContext] Account type could not be definitively determined. Defaulting to individual flow.");
                if (pathname.startsWith('/org')) {
                    router.replace('/');
                }
            }
            setInitialCheckDone(true);
          }
        } catch (error) {
          console.error("[AuthContext] Error during auth state change processing:", error);
          setUserClaims(null);
          // Handle potential token errors leading to sign-out
          if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
            console.warn("[AuthContext] User token invalid or user not found during auth state change, signing out.");
            await auth.signOut();
            setUser(null); // Ensure user state is cleared
            router.push('/login');
          }
        }
      } else {
        console.log("[AuthContext] No user authenticated.");
        setUserClaims(null);
        setInitialCheckDone(false); // Reset for next login
      }
      setLoading(false); // Set loading false after all checks
    });

    return () => {
      console.log("[AuthContext] Cleaning up auth state listener");
      unsubscribe();
      if (firestoreListener) {
        console.log("[AuthContext] Cleaning up Firestore document listener from auth effect");
        firestoreListener();
      }
    };
  }, [refreshUserData, determineAndSetAccountType, router, initialCheckDone]); // Added initialCheckDone

  // Firestore listener for user document changes (role updates, etc.)
  useEffect(() => {
    if (firestoreListener) {
      console.log("[AuthContext] Cleaning up previous Firestore listener before setting new one.");
      firestoreListener();
      setFirestoreListener(null);
    }

    if (user && userClaims) {
      let docPath: string;
      if (userClaims.accountType === 'organization' && userClaims.organizationId) {
        docPath = `organizations/${userClaims.organizationId}/members/${user.uid}`;
      } else if (userClaims.accountType === 'individual') {
        docPath = `individuals/${user.uid}`;
      } else {
        // Fallback or if accountType is not yet determined, listen to 'users'
        // This might need adjustment based on your exact logic for "undetermined" users
        docPath = `users/${user.uid}`;
      }
      
      console.log("[AuthContext] Setting up Firestore listener for user document at:", docPath);
      const userDocRef = doc(db, docPath);

      const unsubscribe = onSnapshot(userDocRef, async (docSnapshot) => {
        console.log("[AuthContext] Firestore document snapshot received for path:", docPath);
        if (docSnapshot.exists()) {
          const firestoreData = docSnapshot.data();
          console.log("[AuthContext] Firestore data:", firestoreData);
          // Potentially trigger a claims refresh if relevant data (like role) changed
          if (firestoreData.role && userClaims.role !== firestoreData.role) {
            console.log("[AuthContext] Role changed in Firestore, forcing claims refresh.");
            await refreshUserData(true); // Force refresh if role in DB changed
          }
        } else {
          console.log("[AuthContext] User document does not exist at path:", docPath);
          // If the listened-to document is deleted (e.g., user removed from org),
          // it might be a sign to refresh claims or re-evaluate account type.
          // This could be an edge case. For now, just log it.
          // A full refreshUserData might be too aggressive here without more context.
        }
      }, (error) => {
        console.error("[AuthContext] Error in Firestore listener:", error);
      });

      setFirestoreListener(() => unsubscribe);
      return () => {
        console.log("[AuthContext] Cleaning up Firestore listener for path:", docPath);
        unsubscribe();
      };
    }
  }, [user, userClaims, refreshUserData]); // Ensure dependencies are correct

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
