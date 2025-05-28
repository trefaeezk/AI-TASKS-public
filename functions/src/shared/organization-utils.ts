/**
 * وظائف مساعدة للتعامل مع المؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './utils';

/**
 * التحقق مما إذا كان المستخدم عضوًا في المؤسسة
 */
export const isOrganizationMember = async (userId: string, organizationId: string): Promise<boolean> => {
    try {
        const memberDoc = await db.collection('organizations').doc(organizationId)
            .collection('members').doc(userId).get();

        return memberDoc.exists;
    } catch (error) {
        console.error(`Error checking if user ${userId} is member of organization ${organizationId}:`, error);
        return false;
    }
};

/**
 * التحقق مما إذا كان المستخدم مسؤولاً في المؤسسة
 */
export const isOrganizationAdmin = async (userId: string, organizationId: string): Promise<boolean> => {
    try {
        const memberDoc = await db.collection('organizations').doc(organizationId)
            .collection('members').doc(userId).get();

        if (!memberDoc.exists) {
            return false;
        }

        const memberData = memberDoc.data();
        return memberData?.role === 'admin';
    } catch (error) {
        console.error(`Error checking if user ${userId} is admin of organization ${organizationId}:`, error);
        return false;
    }
};

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

        // الأدوار التي يمكنها إضافة أعضاء
        const rolesWithInvitePermission = ['org_admin', 'org_engineer', 'org_supervisor'];

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

        // ترتيب الأدوار من الأعلى إلى الأدنى
        const roleHierarchy = ['admin', 'engineer', 'supervisor', 'technician', 'assistant', 'user'];

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
    context: any,
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
