/**
 * وظائف مساعدة للمؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db, ensureAuthenticated } from '../shared/utils';
import { LegacyCallableContext } from '../shared/function-utils';

/**
 * التحقق مما إذا كان المستخدم يملك صلاحيات إضافة أعضاء في المؤسسة
 * يمكن للمستخدمين ذوي الأدوار التالية إضافة أعضاء: admin, engineer, supervisor
 */
export const canInviteToOrganization = async (userId: string, organizationId: string): Promise<boolean> => {
    try {
        const memberDoc = await db.collection('organizations').doc(organizationId)
            .collection('members').doc(userId).get();

        if (!memberDoc.exists) {
            return false;
        }

        const memberData = memberDoc.data();
        const role = memberData?.role;

        // الأدوار التي يمكنها إضافة أعضاء (النمط الجديد is* فقط)
        const rolesWithInvitePermission = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer'];

        return rolesWithInvitePermission.includes(role);
    } catch (error) {
        console.error(`Error checking if user ${userId} can invite to organization ${organizationId}:`, error);
        return false;
    }
};

/**
 * التحقق من صلاحيات المستخدم في المؤسسة
 * @param userId معرف المستخدم
 * @param organizationId معرف المؤسسة
 * @param requiredRole الدور المطلوب (admin, engineer, supervisor, technician, assistant, user)
 * @returns true إذا كان المستخدم يملك الدور المطلوب أو أعلى، false خلاف ذلك
 */
export const hasOrganizationRole = async (
    userId: string,
    organizationId: string,
    requiredRole: string
): Promise<boolean> => {
    try {
        const memberDoc = await db.collection('organizations').doc(organizationId)
            .collection('members').doc(userId).get();

        if (!memberDoc.exists) {
            return false;
        }

        const memberData = memberDoc.data();
        const userRole = memberData?.role;

        // ترتيب الأدوار من الأعلى إلى الأدنى (النمط الجديد is* فقط)
        const roleHierarchy = ['isOrgOwner', 'isOrgAdmin', 'isOrgSupervisor', 'isOrgEngineer', 'isOrgTechnician', 'isOrgAssistant'];

        // التحقق من أن دور المستخدم أعلى من أو يساوي الدور المطلوب
        const userRoleIndex = roleHierarchy.indexOf(userRole);
        const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

        if (userRoleIndex === -1 || requiredRoleIndex === -1) {
            return false;
        }

        return userRoleIndex <= requiredRoleIndex;
    } catch (error) {
        console.error(`Error checking if user ${userId} has role ${requiredRole} in organization ${organizationId}:`, error);
        return false;
    }
};

/**
 * التحقق من أن المستخدم يملك صلاحيات إضافة أعضاء في المؤسسة
 * يستخدم في وظائف Firebase
 */
export const ensureCanInviteToOrganization = async (
    context: LegacyCallableContext,
    organizationId: string
): Promise<string> => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    const uid = context.auth.uid;

    const canInvite = await canInviteToOrganization(uid, organizationId);

    if (!canInvite) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'ليس لديك صلاحيات لإضافة أعضاء في هذه المؤسسة.'
        );
    }

    return uid;
};

/**
 * التحقق من أن المستخدم عضو في المؤسسة
 */
export const ensureOrgMembership = async (context: LegacyCallableContext, orgId: string): Promise<string> => {
    const uid = ensureAuthenticated(context);

    const memberDoc = await db.collection('organizations').doc(orgId)
        .collection('members').doc(uid).get();

    if (!memberDoc.exists) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'أنت لست عضوًا في هذه المؤسسة.'
        );
    }

    console.log(`[Organization] Authorization Success: User ${uid} is a member of organization ${orgId}.`);
    return uid;
};

/**
 * التحقق من أن المستخدم مدير في المؤسسة
 */
export const ensureOrgAdmin = async (context: LegacyCallableContext, orgId: string): Promise<string> => {
    const uid = ensureAuthenticated(context);

    const memberDoc = await db.collection('organizations').doc(orgId)
        .collection('members').doc(uid).get();

    const memberData = memberDoc.data();
    const isOrgAdmin = memberData?.role === 'isOrgOwner' || memberData?.role === 'isOrgAdmin';

    if (!memberDoc.exists || !isOrgAdmin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'يجب أن تكون مديرًا في المؤسسة للوصول إلى هذه الوظيفة.'
        );
    }

    console.log(`[Organization] Authorization Success: User ${uid} is an admin of organization ${orgId}.`);
    return uid;
};

/**
 * التحقق من أن المستخدم عضو في المؤسسة (للوظائف HTTP)
 */
export const ensureOrgMembershipHttp = async (req: functions.https.Request, orgId: string): Promise<string> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const memberDoc = await db.collection('organizations').doc(orgId)
        .collection('members').doc(decodedToken.uid).get();

    if (!memberDoc.exists) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'أنت لست عضوًا في هذه المؤسسة.'
        );
    }

    console.log(`[Organization] Authorization Success: User ${decodedToken.uid} is a member of organization ${orgId}.`);
    return decodedToken.uid;
};

/**
 * التحقق من أن المستخدم مدير في المؤسسة (للوظائف HTTP)
 */
export const ensureOrgAdminHttp = async (req: functions.https.Request, orgId: string): Promise<string> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'يجب تسجيل الدخول للوصول إلى هذه الوظيفة.'
        );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const memberDoc = await db.collection('organizations').doc(orgId)
        .collection('members').doc(decodedToken.uid).get();

    const memberData = memberDoc.data();
    const isOrgAdmin = memberData?.role === 'isOrgOwner' || memberData?.role === 'isOrgAdmin';

    if (!memberDoc.exists || !isOrgAdmin) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'يجب أن تكون مديرًا في المؤسسة للوصول إلى هذه الوظيفة.'
        );
    }

    console.log(`[Organization] Authorization Success: User ${decodedToken.uid} is an admin of organization ${orgId}.`);
    return decodedToken.uid;
};
