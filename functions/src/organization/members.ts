/**
 * وظائف Firebase لإدارة أعضاء المؤسسات
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { db } from '../shared/utils';
import { createCallableFunction } from '../shared/function-utils';
import { CallableRequest } from '../shared/types';

// تكوين CORS
const corsHandler = cors({ origin: true });

/**
 * دالة HTTP لجلب أعضاء المؤسسة
 * تتطلب أن يكون المستدعي عضوًا في المؤسسة
 */
export const getOrganizationMembersHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
  // إعداد CORS
  corsHandler(req, res, async () => {
    console.log("[getOrganizationMembersHttp] Function called");

    try {
      // التحقق من المصادقة
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        console.error("[getOrganizationMembersHttp] No authorization token provided");
        res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
        return;
      }

      const idToken = req.headers.authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // الحصول على معرف المؤسسة
      const orgId = req.query.orgId as string;

      if (!orgId) {
        console.error("[getOrganizationMembersHttp] No organization ID provided");
        res.status(400).json({ error: 'يجب توفير معرف المؤسسة.' });
        return;
      }

      console.log(`[getOrganizationMembersHttp] User ${decodedToken.uid} is requesting members of organization ${orgId}`);

      // التحقق من أن المستخدم عضو في المؤسسة أو مالك
      if (!decodedToken.owner) {
        // التحقق من أن المستخدم عضو في المؤسسة
        const memberDoc = await db.collection('organizations')
          .doc(orgId)
          .collection('members')
          .doc(decodedToken.uid)
          .get();

        if (!memberDoc.exists) {
          // التحقق من أن المستخدم ينتمي للمؤسسة في custom claims
          if (decodedToken.organizationId !== orgId) {
            console.error(`[getOrganizationMembersHttp] User ${decodedToken.uid} is not a member of organization ${orgId}`);
            res.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى أعضاء هذه المؤسسة.' });
            return;
          }
        }
      }

      // الحصول على أعضاء المؤسسة
      const membersSnapshot = await db.collection('organizations')
        .doc(orgId)
        .collection('members')
        .get();

      // الحصول على معلومات المستخدمين
      const membersPromises = membersSnapshot.docs.map(async (doc) => {
        const userId = doc.id;
        const memberData = doc.data();

        try {
          const userRecord = await admin.auth().getUser(userId);

          return {
            uid: userId,
            email: userRecord.email,
            name: userRecord.displayName,
            role: memberData.role,
            joinedAt: memberData.joinedAt,
            departmentId: memberData.departmentId || null
          };
        } catch (error) {
          console.error(`[getOrganizationMembersHttp] Error getting user ${userId}:`, error);
          return {
            uid: userId,
            email: 'غير متاح',
            name: 'مستخدم غير موجود',
            role: memberData.role,
            joinedAt: memberData.joinedAt,
            departmentId: memberData.departmentId || null,
            error: 'User not found'
          };
        }
      });

      const members = await Promise.all(membersPromises);

      res.status(200).json({ members });
    } catch (error: any) {
      console.error("[getOrganizationMembersHttp] Error:", error);
      res.status(500).json({ error: `حدث خطأ أثناء جلب أعضاء المؤسسة: ${error.message}` });
    }
  });
});
