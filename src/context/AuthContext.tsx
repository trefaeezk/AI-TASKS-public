
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
  // الأدوار المتاحة:
  // - أدوار النظام: 'system_owner', 'system_admin', 'independent'
  // - أدوار المؤسسة: 'organization_owner', 'admin', 'supervisor', 'engineer', 'technician', 'assistant'
  role?: string;

  // الصلاحيات الخاصة
  system_owner?: boolean;       // مالك النظام (أعلى صلاحية)
  system_admin?: boolean;       // أدمن النظام العام
  organization_owner?: boolean; // مالك المؤسسة
  admin?: boolean;              // أدمن المؤسسة

  // معلومات الحساب
  accountType?: SystemType;     // 'individual' | 'organization'
  organizationId?: string;      // معرف المؤسسة (للمؤسسات فقط)
  organizationName?: string;    // اسم المؤسسة (للمؤسسات فقط)
  departmentId?: string;        // معرف القسم (اختياري)

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

    try {
      // 1️⃣ جلب بيانات المستخدم الأساسية من Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.log("[AuthContext] ⚠️ بيانات المستخدم غير موجودة، إنشاء حساب فردي جديد");

        // إنشاء حساب فردي جديد
        const newUserData = {
          name: currentUser.displayName || currentUser.email || '',
          email: currentUser.email,
          accountType: 'individual',
          role: 'independent',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(userDocRef, newUserData);

        return {
          accountType: 'individual',
          role: 'independent'
        };
      }

      const userData = userDocSnap.data();
      console.log("[AuthContext] ✅ بيانات المستخدم الأساسية:", userData);

      // 2️⃣ تحديد نوع الحساب أولاً
      const accountType = userData.accountType || 'individual';

      console.log("[AuthContext] 🎯 الخطوة 1: تحديد نوع الحساب");
      console.log("  - userData.accountType:", userData.accountType);
      console.log("  - نوع الحساب المحدد:", accountType);

      if (accountType === 'individual') {
        // 🧑 حساب فردي
        console.log("[AuthContext] 👤 الخطوة 2: معالجة حساب فردي");

        let individualRole = userData.role || 'independent';
        const isSystemOwner = userData.system_owner || false;
        const isSystemAdmin = userData.system_admin || false;

        // تصحيح الدور بناءً على الصلاحيات
        if (isSystemOwner) {
          individualRole = 'system_owner';
        } else if (isSystemAdmin) {
          individualRole = 'system_admin';
        }

        console.log("  - userData.role:", userData.role);
        console.log("  - الدور المحدد:", individualRole);
        console.log("  - system_owner:", isSystemOwner);
        console.log("  - system_admin:", isSystemAdmin);

        const individualClaims = {
          accountType: 'individual' as SystemType,
          role: individualRole,
          system_owner: isSystemOwner,
          system_admin: isSystemAdmin
        };

        console.log("[AuthContext] ✅ البيانات النهائية للحساب الفردي:", individualClaims);
        return individualClaims;

      } else if (accountType === 'organization') {
        // 🏢 حساب مؤسسة
        console.log("[AuthContext] 🏢 الخطوة 2: معالجة حساب مؤسسة");

        const organizationId = userData.organizationId;
        console.log("  - userData.organizationId:", organizationId);

        if (!organizationId) {
          console.error("[AuthContext] ❌ حساب مؤسسة بدون معرف مؤسسة!");
          return { accountType: 'individual', role: 'independent' };
        }

        console.log("[AuthContext] 🎯 الخطوة 3: جلب بيانات المؤسسة");

        // جلب بيانات المؤسسة
        const orgDocRef = doc(db, 'organizations', organizationId);
        const orgDocSnap = await getDoc(orgDocRef);

        if (!orgDocSnap.exists()) {
          console.error("[AuthContext] ❌ المؤسسة غير موجودة:", organizationId);
          return { accountType: 'individual', role: 'independent' };
        }

        const orgData = orgDocSnap.data();
        console.log("[AuthContext] 🏢 بيانات المؤسسة:", orgData);

        console.log("[AuthContext] 🎯 الخطوة 4: تحديد دور المستخدم في المؤسسة");

        // التحقق من دور المستخدم في المؤسسة
        let userRole = userData.role || 'assistant';
        let isOwner = false;
        let isAdmin = false;

        console.log("  - userData.role (الدور الأولي):", userData.role);
        console.log("  - userRole (الدور المحدد):", userRole);

        // التحقق من الملكية
        console.log("[AuthContext] 🔍 الخطوة 5: فحص ملكية المؤسسة:");
        console.log("  - orgData.ownerId:", orgData.ownerId);
        console.log("  - orgData.createdBy:", orgData.createdBy);
        console.log("  - currentUser.uid:", currentUser.uid);
        console.log("  - ownerId match:", orgData.ownerId === currentUser.uid);
        console.log("  - createdBy match:", orgData.createdBy === currentUser.uid);

        if (orgData.ownerId === currentUser.uid || orgData.createdBy === currentUser.uid) {
          isOwner = true;
          userRole = 'organization_owner';
          console.log("[AuthContext] 👑 المستخدم مالك المؤسسة");
        } else {
          // التحقق من العضوية
          console.log("[AuthContext] 🔍 الخطوة 6: فحص العضوية في المؤسسة...");
          const memberDocRef = doc(db, 'organizations', organizationId, 'members', currentUser.uid);
          const memberDocSnap = await getDoc(memberDocRef);

          console.log("  - memberDocSnap.exists():", memberDocSnap.exists());

          if (memberDocSnap.exists()) {
            const memberData = memberDocSnap.data();
            console.log("  - memberData:", memberData);
            userRole = memberData.role || userData.role || 'assistant';
            isAdmin = userRole === 'admin';
            console.log("[AuthContext] 👥 المستخدم عضو في المؤسسة، الدور:", userRole);
          } else {
            console.log("[AuthContext] ⚠️ المستخدم ليس عضو في المؤسسة");
            console.log("  - userData.role:", userData.role);
            console.log("  - سيتم استخدام الدور من userData أو assistant");
            userRole = userData.role || 'assistant';
          }
        }

        const finalClaims = {
          accountType: 'organization' as SystemType,
          role: userRole,
          organizationId: organizationId,
          organizationName: orgData.name || 'مؤسسة',
          organization_owner: isOwner,
          admin: isAdmin,
          system_owner: userData.system_owner || false,
          system_admin: userData.system_admin || false
        };

        console.log("[AuthContext] 🎯 الخطوة 7: النتيجة النهائية");
        console.log("[AuthContext] ✅ البيانات النهائية للمؤسسة:");
        console.log("  - نوع الحساب:", finalClaims.accountType);
        console.log("  - الدور:", finalClaims.role);
        console.log("  - معرف المؤسسة:", finalClaims.organizationId);
        console.log("  - اسم المؤسسة:", finalClaims.organizationName);
        console.log("  - مالك المؤسسة:", finalClaims.organization_owner);
        console.log("  - أدمن المؤسسة:", finalClaims.admin);
        console.log("  - مالك النظام:", finalClaims.system_owner);
        console.log("  - أدمن النظام:", finalClaims.system_admin);

        // ملخص التدفق
        console.log("[AuthContext] 📊 ملخص التدفق:");
        console.log("  1. نوع الحساب: organization ✅");
        console.log("  2. معرف المؤسسة:", organizationId, "✅");
        console.log("  3. بيانات المؤسسة: موجودة ✅");
        console.log("  4. فحص الملكية:", isOwner ? "مالك ✅" : "ليس مالك ❌");
        console.log("  5. فحص العضوية:", !isOwner ? "تم الفحص" : "تم تخطيه");
        console.log("  6. الدور النهائي:", finalClaims.role);

        return finalClaims;
      }

      // حالة افتراضية
      return {
        accountType: 'individual',
        role: 'independent'
      };

    } catch (error) {
      console.error("[AuthContext] ❌ خطأ في جلب بيانات المستخدم:", error);

      return {
        accountType: 'individual',
        role: 'independent'
      };
    }
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
      console.log("[AuthContext] 🔄 تحديث بيانات المستخدم...");

      await auth.currentUser.reload(); // Reload user data from Firebase Auth
      const finalProcessedClaims = await getUserDataFromFirestore(auth.currentUser);

      setUser(auth.currentUser);
      setUserClaims(finalProcessedClaims);
      console.log("[AuthContext] ✅ تم تحديث بيانات المستخدم:", finalProcessedClaims);
    } catch (error) {
      console.error("[AuthContext] Error refreshing user data:", error);
      if ((error as any).code === 'auth/user-token-expired' || (error as any).code === 'auth/id-token-revoked' || (error as any).code === 'auth/user-not-found') {
        console.warn("[AuthContext] User token invalid during refreshUserData, signing out.");
        await auth.signOut();
      }
    } finally {
      setLoading(false); // Stop loading after refresh
    }
  }, [getUserDataFromFirestore]);


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
          console.log("[AuthContext] 👤 مستخدم مسجل دخول:", currentUser.uid);

          const finalProcessedClaims = await getUserDataFromFirestore(currentUser);
          setUser(currentUser);
          setUserClaims(finalProcessedClaims);
          console.log("[AuthContext] ✅ تم تعيين بيانات المستخدم:", finalProcessedClaims);

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
  }, [getUserDataFromFirestore, router, pathname]); // Added pathname

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
