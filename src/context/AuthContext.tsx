// src/context/AuthContext.tsx
'use client';

import type { User } from 'firebase/auth';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/config/firebase';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0); // لتتبع وقت آخر تحديث

  // وظيفة لإعادة تحميل معلومات المستخدم (بما في ذلك custom claims)
  const refreshUserData = useCallback(async () => {
    console.log("[AuthContext] refreshUserData called");

    if (!user) {
      console.log("[AuthContext] No user, skipping refresh");
      setUserClaims(null);
      return;
    }

    // تحقق من الوقت المنقضي منذ آخر تحديث (منع التحديثات المتكررة)
    const now = Date.now();
    const minRefreshInterval = 500; // تقليل الفاصل الزمني إلى 500 مللي ثانية للاختبار

    console.log("[AuthContext] Time since last refresh:", now - lastRefreshTime, "ms");

    if (now - lastRefreshTime < minRefreshInterval) {
      console.log("[AuthContext] Skipping refresh, too soon since last refresh");
      return;
    }

    try {
      // تحديث وقت آخر تحديث
      setLastRefreshTime(now);
      console.log("[AuthContext] Last refresh time updated to:", now);

      // الحصول على بيانات المستخدم الحالي
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("[AuthContext] No current user found");
        return;
      }

      // إعادة تحميل المستخدم للحصول على أحدث البيانات
      console.log("[AuthContext] Reloading user");
      await currentUser.reload();
      console.log("[AuthContext] User reloaded");

      // إلغاء جميع الـ tokens الحالية وإجبار إصدار token جديد
      console.log("[AuthContext] Forcing token refresh");
      await currentUser.getIdToken(true);

      // الحصول على custom claims مع إجبار التحديث
      console.log("[AuthContext] Getting ID token result with force refresh");
      const tokenResult = await getIdTokenResult(currentUser, true); // force refresh
      console.log("[AuthContext] ID token result received:", tokenResult);

      // تحديث حالة المستخدم
      setUser(currentUser);

      // الحصول على claims من token
      const claims = tokenResult.claims as UserClaims;

      // التحقق من وثيقة المستخدم في Firestore للحصول على الدور الصحيح
      try {
        let userDoc;

        // تحديد المجموعة المناسبة بناءً على نوع الحساب
        if (claims.accountType === 'individual') {
          console.log("[AuthContext] Checking individuals collection for user role", currentUser.uid);
          userDoc = await getDoc(doc(db, 'individuals', currentUser.uid));
        } else {
          console.log("[AuthContext] Checking users collection for user role", currentUser.uid);
          userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        }

        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("[AuthContext] User document found in refreshUserData:", userData);

          // تحديث claims بالدور من وثيقة المستخدم إذا كان موجودًا
          if (userData.role) {
            console.log("[AuthContext] Updating role from Firestore:", userData.role);
            claims.role = userData.role;
          }
        }
      } catch (error) {
        console.error("[AuthContext] Error getting user document in refreshUserData:", error);
      }

      setUserClaims(claims);
      console.log("[AuthContext] User claims updated:", claims);
    } catch (error) {
      console.error("[AuthContext] Error refreshing user data:", error);
    }
  }, [user, lastRefreshTime]);

  // التحقق من نوع الحساب وتهيئة التطبيق تلقائيًا
  const checkAccountType = useCallback(async (currentUser: User, claims: UserClaims) => {
    // إذا كان المستخدم ليس لديه نوع حساب محدد، نحاول تحديده تلقائيًا
    if (!claims.accountType) {
      console.log("[AuthContext] User has no account type, attempting to determine automatically");

      try {
        // التحقق من وجود المستخدم في مجموعة individuals
        const individualDoc = await getDoc(doc(db, 'individuals', currentUser.uid));

        if (individualDoc.exists()) {
          console.log("[AuthContext] Found user in individuals collection, setting as individual");

          // تعيين المستخدم كمستخدم فردي
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('@/lib/firebase');

          const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
          await updateAccountTypeFunc({
            accountType: 'individual'
          });

          // تحديث معلومات المستخدم
          await refreshUserData();
          return true;
        }

        // التحقق من وجود المستخدم في أي مؤسسة
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

        if (userDoc.exists() && userDoc.data().organizationId) {
          const orgId = userDoc.data().organizationId;
          console.log(`[AuthContext] Found user in organization ${orgId}, setting as organization member`);

          // التحقق من وجود المستخدم في أعضاء المؤسسة
          const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', currentUser.uid));

          if (memberDoc.exists()) {
            // تعيين المستخدم كعضو في المؤسسة
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('@/lib/firebase');

            const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
            await updateAccountTypeFunc({
              accountType: 'organization',
              organizationId: orgId
            });

            // تحديث معلومات المستخدم
            await refreshUserData();
            return true;
          }
        }

        // إذا لم نجد المستخدم في أي مكان، نعينه كمستخدم مستقل تلقائيًا
        console.log("[AuthContext] Could not determine account type automatically, setting as individual");

        // تعيين المستخدم كمستخدم فردي
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');

        const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
        await updateAccountTypeFunc({
          accountType: 'individual'
        });

        // تحديث معلومات المستخدم
        await refreshUserData();
        return true;
      } catch (error) {
        console.error("[AuthContext] Error determining account type:", error);

        // في حالة حدوث خطأ، نحاول مرة أخرى تعيين المستخدم كمستخدم مستقل
        try {
          console.log("[AuthContext] Trying to set user as individual after error");
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('@/lib/firebase');

          const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
          await updateAccountTypeFunc({
            accountType: 'individual'
          });

          // تحديث معلومات المستخدم
          await refreshUserData();
          return true;
        } catch (secondError) {
          console.error("[AuthContext] Error setting user as individual after first error:", secondError);
          return false;
        }
      }
    }

    // التحقق من نوع الحساب (فرد/مؤسسة)
    if (claims.accountType === 'individual') {
      // التحقق من وجود المستخدم في مجموعة individuals
      try {
        const individualDoc = await getDoc(doc(db, 'individuals', currentUser.uid));

        // إذا لم تكن وثيقة المستخدم الفردي موجودة، نحاول إنشاءها عن طريق تحديث نوع الحساب
        if (!individualDoc.exists()) {
          console.log("[AuthContext] Individual user not found in Firestore, trying to create it");

          try {
            // استدعاء دالة Firebase لتحديث نوع الحساب
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('@/lib/firebase');

            const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
            await updateAccountTypeFunc({
              accountType: 'individual'
            });

            // تحديث معلومات المستخدم
            await refreshUserData();

            // التحقق مرة أخرى من وجود وثيقة المستخدم الفردي
            const updatedDoc = await getDoc(doc(db, 'individuals', currentUser.uid));
            if (!updatedDoc.exists()) {
              console.log("[AuthContext] Still could not find individual user document, creating it");

              // إنشاء وثيقة المستخدم الفردي
              await setDoc(doc(db, 'individuals', currentUser.uid), {
                name: currentUser.displayName || '',
                email: currentUser.email || '',
                role: 'independent',
                accountType: 'individual',
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }

            return true;
          } catch (error) {
            console.error("[AuthContext] Error creating individual user document:", error);
            return false;
          }
        }
      } catch (error) {
        console.error("[AuthContext] Error checking individual user:", error);

        // في حالة حدوث خطأ، نحاول مرة أخرى تعيين المستخدم كمستخدم مستقل
        try {
          console.log("[AuthContext] Trying to set user as individual after error in checking");

          // إنشاء وثيقة المستخدم الفردي
          await setDoc(doc(db, 'individuals', currentUser.uid), {
            name: currentUser.displayName || '',
            email: currentUser.email || '',
            role: 'independent',
            accountType: 'individual',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // تحديث معلومات المستخدم
          await refreshUserData();
          return true;
        } catch (secondError) {
          console.error("[AuthContext] Error setting user as individual after checking error:", secondError);
          return false;
        }
      }
    } else if (claims.accountType === 'organization') {
      // التحقق من وجود المستخدم في المؤسسة
      if (!claims.organizationId) {
        console.log("[AuthContext] Organization ID not found in claims, trying to find user's organization");

        try {
          // البحث عن المستخدم في مجموعة users للعثور على معرف المؤسسة
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

          if (userDoc.exists() && userDoc.data().organizationId) {
            const orgId = userDoc.data().organizationId;
            console.log(`[AuthContext] Found organization ID ${orgId} in user document`);

            // التحقق من وجود المستخدم في أعضاء المؤسسة
            const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', currentUser.uid));

            if (memberDoc.exists()) {
              console.log(`[AuthContext] User is a member of organization ${orgId}, updating claims`);

              // تحديث custom claims للمستخدم
              const { httpsCallable } = await import('firebase/functions');
              const { functions } = await import('@/lib/firebase');

              const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
              await updateAccountTypeFunc({
                accountType: 'organization',
                organizationId: orgId
              });

              // تحديث معلومات المستخدم
              await refreshUserData();
              return true;
            }
          }

          console.log("[AuthContext] Could not find user's organization, setting as individual");

          // تعيين المستخدم كمستخدم فردي
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('@/lib/firebase');

          const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
          await updateAccountTypeFunc({
            accountType: 'individual'
          });

          // إنشاء وثيقة المستخدم الفردي
          await setDoc(doc(db, 'individuals', currentUser.uid), {
            name: currentUser.displayName || '',
            email: currentUser.email || '',
            role: 'independent',
            accountType: 'individual',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // تحديث معلومات المستخدم
          await refreshUserData();
          return true;
        } catch (error) {
          console.error("[AuthContext] Error finding user's organization:", error);

          // في حالة حدوث خطأ، نحاول مرة أخرى تعيين المستخدم كمستخدم مستقل
          try {
            console.log("[AuthContext] Trying to set user as individual after organization error");

            // تعيين المستخدم كمستخدم فردي
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('@/lib/firebase');

            const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
            await updateAccountTypeFunc({
              accountType: 'individual'
            });

            // إنشاء وثيقة المستخدم الفردي
            await setDoc(doc(db, 'individuals', currentUser.uid), {
              name: currentUser.displayName || '',
              email: currentUser.email || '',
              role: 'independent',
              accountType: 'individual',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // تحديث معلومات المستخدم
            await refreshUserData();
            return true;
          } catch (secondError) {
            console.error("[AuthContext] Error setting user as individual after organization error:", secondError);
            return false;
          }
        }
      }

      try {
        // التحقق من عضوية المستخدم في المؤسسة المحددة
        const memberDoc = await getDoc(
          doc(db, 'organizations', claims.organizationId, 'members', currentUser.uid)
        );

        if (!memberDoc.exists()) {
          console.log(`[AuthContext] User not found in organization ${claims.organizationId} members`);

          // التحقق مما إذا كان المستخدم هو منشئ المؤسسة
          const orgDoc = await getDoc(doc(db, 'organizations', claims.organizationId));

          if (orgDoc.exists() && orgDoc.data().createdBy === currentUser.uid) {
            console.log(`[AuthContext] User is the creator of organization ${claims.organizationId}, adding as admin`);

            // استدعاء دالة Firebase للتحقق من نوع الحساب
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('@/lib/firebase');

            const verifyAccountTypeFunc = httpsCallable(functions, 'verifyAccountType');
            await verifyAccountTypeFunc({
              requestedType: 'organization',
              organizationId: claims.organizationId
            });

            // تحديث معلومات المستخدم
            await refreshUserData();
            return true;
          }

          // البحث عن طلبات مؤسسات تمت الموافقة عليها للمستخدم
          console.log("[AuthContext] Looking for approved organization requests for the user");

          // البحث عن طلبات المؤسسات التي أنشأها المستخدم وتمت الموافقة عليها
          const orgRequestsQuery = query(
            collection(db, 'organizationRequests'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'approved')
          );

          const orgRequestsSnapshot = await getDocs(orgRequestsQuery);

          if (!orgRequestsSnapshot.empty) {
            // وجدنا طلب مؤسسة تمت الموافقة عليه
            const approvedRequest = orgRequestsSnapshot.docs[0].data();
            console.log(`[AuthContext] Found approved organization request with organization ID: ${approvedRequest.organizationId}`);

            if (approvedRequest.organizationId) {
              // تحديث custom claims للمستخدم
              const { httpsCallable } = await import('firebase/functions');
              const { functions } = await import('@/lib/firebase');

              const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
              await updateAccountTypeFunc({
                accountType: 'organization',
                organizationId: approvedRequest.organizationId
              });

              // تحديث معلومات المستخدم
              await refreshUserData();
              return true;
            }
          }

          // البحث عن مؤسسات أخرى قد يكون المستخدم عضوًا فيها
          console.log("[AuthContext] Looking for other organizations the user might be a member of");

          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

          if (userDoc.exists() && userDoc.data().organizationId && userDoc.data().organizationId !== claims.organizationId) {
            const orgId = userDoc.data().organizationId;
            console.log(`[AuthContext] Found another organization ${orgId} in user document`);

            // التحقق من وجود المستخدم في أعضاء المؤسسة الأخرى
            const otherMemberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', currentUser.uid));

            if (otherMemberDoc.exists()) {
              console.log(`[AuthContext] User is a member of organization ${orgId}, updating claims`);

              // تحديث custom claims للمستخدم
              const { httpsCallable } = await import('firebase/functions');
              const { functions } = await import('@/lib/firebase');

              const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
              await updateAccountTypeFunc({
                accountType: 'organization',
                organizationId: orgId
              });

              // تحديث معلومات المستخدم
              await refreshUserData();
              return true;
            }
          }

          console.log("[AuthContext] User is not a member of any organization, setting as individual");

          // تعيين المستخدم كمستخدم فردي
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('@/lib/firebase');

          const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
          await updateAccountTypeFunc({
            accountType: 'individual'
          });

          // إنشاء وثيقة المستخدم الفردي
          await setDoc(doc(db, 'individuals', currentUser.uid), {
            name: currentUser.displayName || '',
            email: currentUser.email || '',
            role: 'independent',
            accountType: 'individual',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // تحديث معلومات المستخدم
          await refreshUserData();
          return true;
        }
      } catch (error) {
        console.error("[AuthContext] Error checking organization membership:", error);

        // في حالة حدوث خطأ، نحاول مرة أخرى تعيين المستخدم كمستخدم مستقل
        try {
          console.log("[AuthContext] Trying to set user as individual after membership error");

          // تعيين المستخدم كمستخدم فردي
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('@/lib/firebase');

          const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
          await updateAccountTypeFunc({
            accountType: 'individual'
          });

          // إنشاء وثيقة المستخدم الفردي
          await setDoc(doc(db, 'individuals', currentUser.uid), {
            name: currentUser.displayName || '',
            email: currentUser.email || '',
            role: 'independent',
            accountType: 'individual',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // تحديث معلومات المستخدم
          await refreshUserData();
          return true;
        } catch (secondError) {
          console.error("[AuthContext] Error setting user as individual after membership error:", secondError);
          return false;
        }
      }
    }

    return true;
  }, [router, refreshUserData]);

  // تتبع ما إذا كان التحقق من نوع الحساب قد تم بالفعل
  const [accountTypeChecked, setAccountTypeChecked] = useState<boolean>(false);

  // إعداد مستمع لتغييرات حالة المصادقة
  useEffect(() => {
    console.log("[AuthContext] Setting up auth state listener");

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("[AuthContext] Auth state changed, user:", currentUser?.uid);
      setUser(currentUser);

      if (currentUser) {
        try {
          // الحصول على custom claims عند تسجيل الدخول
          // إجبار تحديث الـ token أولاً
          console.log("[AuthContext] Forcing token refresh on auth state change");
          await currentUser.getIdToken(true);

          // ثم الحصول على الـ token المحدث
          const tokenResult = await getIdTokenResult(currentUser);
          const claims = tokenResult.claims as UserClaims;
          setUserClaims(claims);

          console.log("[AuthContext] User authenticated, claims:", claims);

          // التهيئة التلقائية للتطبيق حسب نوع الحساب
          if (!accountTypeChecked) {
            setAccountTypeChecked(true);

            // إضافة تأخير قبل التحقق من نوع الحساب
            setTimeout(async () => {
              try {
                console.log("[AuthContext] Automatically initializing application based on account type");

                // التحقق من نوع الحساب وتهيئة التطبيق
                const success = await checkAccountType(currentUser, claims);

                if (success) {
                  console.log("[AuthContext] Application initialized successfully");

                  // إجبار تحديث الـ token مرة أخرى
                  console.log("[AuthContext] Forcing token refresh after account type check");
                  await currentUser.getIdToken(true);

                  // توجيه المستخدم حسب نوع الحساب
                  const updatedClaims = (await getIdTokenResult(currentUser, true)).claims as UserClaims;

                  // تحديث claims في الحالة
                  setUserClaims(updatedClaims);

                  // التوجيه حسب نوع الحساب
                  const pathname = window.location.pathname;

                  if (updatedClaims.accountType === 'organization') {
                    // إذا كان المستخدم ينتمي لمؤسسة ولكنه ليس في مسار المؤسسات
                    if (!pathname.startsWith('/org')) {
                      console.log("[AuthContext] Redirecting to organization app");
                      router.push('/org');
                    }
                  } else {
                    // إذا كان المستخدم فردي ولكنه في مسار المؤسسات
                    if (pathname.startsWith('/org')) {
                      console.log("[AuthContext] Redirecting to individual app");
                      router.push('/');
                    }
                  }
                }
              } catch (error) {
                console.error("[AuthContext] Error initializing application:", error);
              }
            }, 1000);
          }
        } catch (error) {
          console.error("[AuthContext] Error getting token claims:", error);
          setUserClaims(null);
        }
      } else {
        setUserClaims(null);
        setAccountTypeChecked(false);
      }

      setLoading(false);
    });

    // تنظيف الاشتراك عند تفكيك المكون
    return () => {
      console.log("[AuthContext] Cleaning up auth state listener");
      unsubscribe();
    };
  }, []);

  // إعداد مستمع لتغييرات وثيقة المستخدم في Firestore
  useEffect(() => {
    console.log("[AuthContext] Setting up Firestore document listener");

    // إلغاء المستمع السابق إذا كان موجودًا
    if (firestoreListener) {
      console.log("[AuthContext] Cleaning up previous Firestore listener");
      firestoreListener();
      setFirestoreListener(null);
    }

    if (user && userClaims) {
      let docRef;

      // تحديد المجموعة المناسبة بناءً على نوع الحساب
      if (userClaims.accountType === 'individual') {
        docRef = doc(db, 'individuals', user.uid);
        console.log("[AuthContext] Listening to individual document:", user.uid);
      } else if (userClaims.accountType === 'organization' && userClaims.organizationId) {
        // مستمع لوثيقة العضوية في المؤسسة
        docRef = doc(db, 'organizations', userClaims.organizationId, 'members', user.uid);
        console.log("[AuthContext] Listening to organization member document:", userClaims.organizationId, user.uid);
      } else {
        // إذا لم يكن هناك نوع حساب محدد، نستخدم مجموعة users الافتراضية
        docRef = doc(db, 'users', user.uid);
        console.log("[AuthContext] Listening to user document:", user.uid);
      }

      // إنشاء مستمع جديد لوثيقة المستخدم
      const unsubscribe = onSnapshot(
        docRef,
        async (docSnapshot) => {
          if (docSnapshot.exists()) {
            console.log("[AuthContext] User document updated in Firestore:", docSnapshot.data());

            // تحديث userClaims مباشرة من وثيقة المستخدم
            const userData = docSnapshot.data();
            if (userData && userData.role) {
              console.log("[AuthContext] Updating userClaims with role from Firestore:", userData.role);
              setUserClaims(prevClaims => {
                if (prevClaims && prevClaims.role !== userData.role) {
                  return {
                    ...prevClaims,
                    role: userData.role
                  };
                }
                return prevClaims;
              });
            }

            // تحديث معلومات المستخدم عند تغيير وثيقة المستخدم، ولكن بتأخير لتجنب التحديثات المتكررة
            const now = Date.now();
            const minRefreshInterval = 5000; // 5 ثوان كحد أدنى بين التحديثات

            if (now - lastRefreshTime >= minRefreshInterval) {
              console.log("[AuthContext] Refreshing token after document update");

              // استخدام getIdTokenResult مباشرة بدلاً من refreshUserData لتجنب الحلقة اللانهائية
              if (user) {
                try {
                  // إجبار تحديث الـ token
                  const tokenResult = await user.getIdTokenResult(true);
                  setLastRefreshTime(Date.now());
                  console.log("[AuthContext] Token refreshed successfully:", tokenResult.claims);

                  // تحديث userClaims مباشرة من الـ token الجديد
                  setUserClaims(tokenResult.claims as UserClaims);
                } catch (error) {
                  console.error("[AuthContext] Error refreshing token:", error);
                }
              }
            } else {
              console.log("[AuthContext] Skipping token refresh after document update, too soon since last refresh");
            }
          }
        },
        (error) => {
          console.error("[AuthContext] Error listening to user document:", error);
        }
      );

      setFirestoreListener(() => unsubscribe);

      // تنظيف المستمع عند تغيير المستخدم
      return () => {
        console.log("[AuthContext] Cleaning up Firestore document listener");
        unsubscribe();
      };
    }
  }, [user, userClaims]);

  // عرض مؤشر التحميل أثناء التحقق من حالة المصادقة
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
