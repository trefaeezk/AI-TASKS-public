/**
 * وظائف Firebase للمصادقة والتحقق من نوع الحساب
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './shared/utils';
import { isIndividualUser } from './individual/utils';
import { isOrganizationMember } from './shared/utils';
import { createCallableFunction } from './shared/function-utils';
import { addTokenRefreshTimestamp } from './auth/tokenRefresh';

// تم حذف CORS - لم يعد مطلوب

/**
 * نوع بيانات طلب التحقق من نوع الحساب
 */
interface VerifyAccountTypeRequest {
    requestedType: 'individual' | 'organization';
    organizationId?: string;
    departmentId?: string;
}

/**
 * التحقق من نوع الحساب عند تسجيل الدخول
 * هذه الدالة تتحقق من نوع الحساب (فرد/مؤسسة) وتتأكد من أن المستخدم مسموح له بالدخول
 */
export const verifyAccountType = createCallableFunction<VerifyAccountTypeRequest>(async (request) => {
    const functionName = 'verifyAccountType';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = request.auth.uid;
        const { requestedType, organizationId, departmentId } = request.data;

        // التحقق من صحة المدخلات
        if (!requestedType || (requestedType !== 'organization' && requestedType !== 'individual')) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير نوع النظام (organization أو individual)."
            );
        }

        // الحصول على معلومات المستخدم
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        // التحقق من نوع الحساب
        if (requestedType === 'individual') {
            // التحقق مما إذا كان المستخدم فرديًا، وإنشاء وثيقة إذا لم تكن موجودة
            const isIndividual = await isIndividualUser(uid, true); // true لإنشاء الوثيقة إذا لم تكن موجودة

            if (!isIndividual) {
                // إذا لم يكن المستخدم فرديًا، نقوم بإنشاء وثيقة وتحديث custom claims
                try {
                    // تحديث custom claims للمستخدم
                    await admin.auth().setCustomUserClaims(uid, {
                        ...customClaims,
                        role: 'isIndependent',
                        accountType: 'individual'
                    });

                    // إنشاء وثيقة المستخدم الفردي
                    await db.collection('individuals').doc(uid).set({
                        name: userRecord.displayName || '',
                        email: userRecord.email || '',
                        role: 'isIndependent',
                        accountType: 'individual',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    console.log(`Created individual account for user ${uid}`);
                } catch (error) {
                    console.error(`Error creating individual account for user ${uid}:`, error);
                    throw new functions.https.HttpsError(
                        'internal',
                        'حدث خطأ أثناء إنشاء حساب فردي. يرجى المحاولة مرة أخرى.'
                    );
                }
            }

            return {
                success: true,
                accountType: 'individual',
                role: 'isIndependent'
            };
        } else {
            // التحقق مما إذا كان المستخدم عضوًا في المؤسسة المطلوبة
            if (!organizationId) {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    "يجب توفير معرف المؤسسة للدخول إلى نظام المؤسسات."
                );
            }

            // التحقق من عضوية المستخدم في المؤسسة
            const isMember = await isOrganizationMember(uid, organizationId);

            if (!isMember) {
                // التحقق مما إذا كان المستخدم هو منشئ المؤسسة
                const orgDoc = await db.collection('organizations').doc(organizationId).get();

                if (!orgDoc.exists || orgDoc.data()?.createdBy !== uid) {
                    throw new functions.https.HttpsError(
                        'permission-denied',
                        'أنت لست عضوًا في هذه المؤسسة.'
                    );
                }

                // إذا كان المستخدم هو منشئ المؤسسة ولكن ليس عضوًا، نضيفه كمسؤول
                console.log(`User ${uid} is the creator of organization ${organizationId} but not a member. Adding as admin.`);

                await db.collection('organizations').doc(organizationId).collection('members').doc(uid).set({
                    role: 'org_admin',
                    joinedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // تحديث custom claims للمستخدم (الأدوار الجديدة)
                await admin.auth().setCustomUserClaims(uid, {
                    ...customClaims,
                    role: 'org_admin',
                    isOrgAdmin: true,
                    accountType: 'organization',
                    organizationId
                });
            }

            // التحقق من القسم إذا تم توفيره
            if (departmentId) {
                const memberDoc = await db.collection('organizations').doc(organizationId)
                    .collection('members').doc(uid).get();

                if (memberDoc.exists) {
                    const memberData = memberDoc.data();
                    if (memberData?.departmentId !== departmentId) {
                        throw new functions.https.HttpsError(
                            'permission-denied',
                            'أنت لست عضوًا في هذا القسم.'
                        );
                    }
                }
            }

            // الحصول على دور المستخدم في المؤسسة
            const memberDoc = await db.collection('organizations').doc(organizationId)
                .collection('members').doc(uid).get();

            const role = memberDoc.exists ? memberDoc.data()?.role : 'org_assistant';

            return {
                success: true,
                accountType: 'organization',
                organizationId,
                departmentId: departmentId || null,
                role
            };
        }
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to verify account type: ${error.message || 'Unknown internal server error.'}`
        );
    }
});

/**
 * نوع بيانات طلب تحديث نوع الحساب
 */
interface UpdateAccountTypeRequest {
    accountType: 'individual' | 'organization';
    organizationId?: string;
    departmentId?: string;
}

/**
 * تحديث نوع الحساب في custom claims
 */
export const updateAccountType = createCallableFunction<UpdateAccountTypeRequest>(async (request) => {
    const functionName = 'updateAccountType';
    console.log(`--- ${functionName} Cloud Function triggered ---`);

    try {
        // التحقق من وجود مستخدم مسجل الدخول
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
            );
        }

        const uid = request.auth.uid;
        const { accountType, organizationId, departmentId } = request.data;

        // التحقق من صحة المدخلات
        if (!accountType || (accountType !== 'organization' && accountType !== 'individual')) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "يجب توفير نوع الحساب (organization أو individual)."
            );
        }

        // الحصول على معلومات المستخدم الحالية
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        // تحديث custom claims
        let newClaims: any = {
            ...customClaims,
            accountType
        };

        // إضافة معلومات المؤسسة إذا كان نوع الحساب مؤسسة
        if (accountType === 'organization') {
            const effectiveOrgId = organizationId || customClaims.organizationId;
            newClaims.organizationId = effectiveOrgId;
            newClaims.departmentId = departmentId || customClaims.departmentId;

            // التحقق مما إذا كان المستخدم هو منشئ المؤسسة
            if (effectiveOrgId) {
                try {
                    const orgDoc = await db.collection('organizations').doc(effectiveOrgId).get();
                    if (orgDoc.exists && orgDoc.data()?.createdBy === uid) {
                        console.log(`User ${uid} is the creator of organization ${effectiveOrgId}, setting as organization owner`);
                        newClaims.role = 'org_owner';
                        newClaims.isOrgOwner = true;

                        // تحديث وثيقة المستخدم في مجموعة users
                        const userDocRef = db.collection('users').doc(uid);
                        await userDocRef.set({
                            role: 'org_owner',
                            isOrgOwner: true,
                            accountType: 'organization',
                            organizationId: effectiveOrgId,
                            organizationName: orgDoc.data()?.name || '',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        // تحديث وثيقة العضوية في المؤسسة
                        await db.collection('organizations').doc(effectiveOrgId).collection('members').doc(uid).set({
                            role: 'org_owner',
                            joinedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    }
                } catch (error) {
                    console.error(`Error checking if user ${uid} is organization creator:`, error);
                }
            }
        }
        // إذا كان نوع الحساب فرديًا، نحذف معرفات المؤسسة والقسم
        else if (accountType === 'individual') {
            delete newClaims.organizationId;
            delete newClaims.departmentId;

            // تعيين الدور إلى 'isIndependent' للحسابات الفردية
            newClaims.role = 'isIndependent';

            // التحقق من وجود وثيقة المستخدم في مجموعة users أولاً
            const userDoc = await db.collection('users').doc(uid).get();

            if (!userDoc.exists) {
                console.log(`Creating user document for user ${uid} during updateAccountType`);

                // إنشاء وثيقة المستخدم في مجموعة users
                const userName = userRecord.displayName ||
                               (userRecord.email ? userRecord.email.split('@')[0] : '') ||
                               'مستخدم';

                await db.collection('users').doc(uid).set({
                    name: userName,
                    email: userRecord.email || '',
                    displayName: userName,
                    role: 'isIndependent',
                    accountType: 'individual',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    disabled: false,
                    // النمط الجديد is* فقط
                    isSystemOwner: false,
                    isSystemAdmin: false,
                    isOrgOwner: false,
                    isOrgAdmin: false,
                    isOrgSupervisor: false,
                    isOrgEngineer: false,
                    isOrgTechnician: false,
                    isOrgAssistant: false,
                    isIndependent: true
                });
            } else {
                // تحديث البيانات الموجودة
                await db.collection('users').doc(uid).update({
                    accountType: 'individual',
                    role: 'isIndependent',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        // تحديث custom claims
        await admin.auth().setCustomUserClaims(uid, newClaims);

        // إضافة طابع زمني لإجبار تحديث الـ token
        try {
            await addTokenRefreshTimestamp(uid);
            console.log(`[${functionName}] Added timestamp to force token refresh for user ${uid}`);
        } catch (refreshError) {
            console.error(`[${functionName}] Error forcing token refresh:`, refreshError);
            // نستمر حتى لو فشل إجبار تحديث الـ token
        }

        return {
            success: true,
            accountType,
            tokenRefreshed: true,
            ...(accountType === 'organization' && {
                organizationId: organizationId || customClaims.organizationId,
                departmentId: departmentId || customClaims.departmentId
            })
        };
    } catch (error: any) {
        console.error(`Error in ${functionName}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            `Failed to update account type: ${error.message || 'Unknown internal server error.'}`
        );
    }
});
