/**
 * وظائف Firebase للمصادقة وإدارة المستخدمين
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { db } from '../shared/utils';

// تكوين CORS
const corsHandler = cors({ origin: true });

/**
 * دالة HTTP لتحديث دور المستخدم
 * تتطلب أن يكون المستدعي مالكًا أو مسؤولًا
 */
export const updateUserRoleHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
  // إعداد CORS
  corsHandler(req, res, async () => {
    console.log("[updateUserRoleHttp] Function called");

    try {
      // التحقق من المصادقة
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        console.error("[updateUserRoleHttp] No authorization token provided");
        res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
        return;
      }

      const idToken = req.headers.authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // التحقق من صلاحيات المستخدم
      if (!decodedToken.owner && !decodedToken.admin) {
        console.error(`[updateUserRoleHttp] User ${decodedToken.uid} is not an owner or admin`);
        res.status(403).json({ error: 'يجب أن تكون مالكًا أو مسؤولًا لتحديث دور المستخدم.' });
        return;
      }

      // الحصول على معرف المستخدم والدور الجديد
      const uid = req.body.uid;
      const role = req.body.role;

      if (!uid || !role) {
        console.error("[updateUserRoleHttp] Missing required parameters");
        res.status(400).json({ error: 'يجب توفير معرف المستخدم والدور الجديد.' });
        return;
      }

      console.log(`[updateUserRoleHttp] Updating role for user ${uid} to ${role}`);

      // التحقق من أن المستخدم لا يحاول تعيين دور مالك إلا إذا كان هو نفسه مالكًا
      if (role === 'owner' && !decodedToken.owner) {
        console.error(`[updateUserRoleHttp] User ${decodedToken.uid} is not an owner and cannot set owner role`);
        res.status(403).json({ error: 'يجب أن تكون مالكًا لتعيين دور مالك.' });
        return;
      }

      // الحصول على معلومات المستخدم الحالية
      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};

      // تعيين الدور الجديد مع الحفاظ على الخصائص الأخرى
      const newClaims = {
        ...currentClaims,
        role,
        admin: role === 'admin' || role === 'owner',
        owner: role === 'owner'
      };

      // تحديث custom claims
      await admin.auth().setCustomUserClaims(uid, newClaims);

      // تحديث وثيقة المستخدم في Firestore
      await db.collection('users').doc(uid).update({
        role,
        isOwner: role === 'owner',
        isAdmin: role === 'admin' || role === 'owner',
        updatedAt: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'تم تحديث دور المستخدم بنجاح.',
        claims: newClaims
      });

    } catch (error: any) {
      console.error("[updateUserRoleHttp] Error:", error);
      res.status(500).json({ error: `حدث خطأ أثناء تحديث دور المستخدم: ${error.message}` });
    }
  });
});

/**
 * دالة HTTP لتحديث صلاحيات المستخدم
 * تتطلب أن يكون المستدعي مالكًا أو مسؤولًا
 */
export const updateUserPermissionsHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
  // إعداد CORS
  corsHandler(req, res, async () => {
    console.log("[updateUserPermissionsHttp] Function called");

    try {
      // التحقق من المصادقة
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        console.error("[updateUserPermissionsHttp] No authorization token provided");
        res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
        return;
      }

      const idToken = req.headers.authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // التحقق من صلاحيات المستخدم
      if (!decodedToken.owner && !decodedToken.admin) {
        console.error(`[updateUserPermissionsHttp] User ${decodedToken.uid} is not an owner or admin`);
        res.status(403).json({ error: 'يجب أن تكون مالكًا أو مسؤولًا لتحديث صلاحيات المستخدم.' });
        return;
      }

      // الحصول على معرف المستخدم والصلاحيات الجديدة
      const uid = req.body.uid;
      const permissions = req.body.permissions;

      if (!uid || !permissions) {
        console.error("[updateUserPermissionsHttp] Missing required parameters");
        res.status(400).json({ error: 'يجب توفير معرف المستخدم والصلاحيات الجديدة.' });
        return;
      }

      console.log(`[updateUserPermissionsHttp] Updating permissions for user ${uid}`);

      // الحصول على معلومات المستخدم الحالية
      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};

      // تعيين الصلاحيات الجديدة مع الحفاظ على الخصائص الأخرى
      const newClaims = {
        ...currentClaims,
        permissions
      };

      // تحديث custom claims
      await admin.auth().setCustomUserClaims(uid, newClaims);

      // تحديث وثيقة المستخدم في Firestore
      await db.collection('users').doc(uid).update({
        permissions,
        updatedAt: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'تم تحديث صلاحيات المستخدم بنجاح.',
        claims: newClaims
      });

    } catch (error: any) {
      console.error("[updateUserPermissionsHttp] Error:", error);
      res.status(500).json({ error: `حدث خطأ أثناء تحديث صلاحيات المستخدم: ${error.message}` });
    }
  });
});

/**
 * دالة HTTP لتعيين حالة تعطيل المستخدم
 * تتطلب أن يكون المستدعي مالكًا أو مسؤولًا
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد - استخدم setUserDisabledStatus بدلاً منها
 */
/*
export const setUserDisabledStatusHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
  // إعداد CORS
  corsHandler(req, res, async () => {
    console.log("[setUserDisabledStatusHttp] Function called");

    try {
      // التحقق من المصادقة
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        console.error("[setUserDisabledStatusHttp] No authorization token provided");
        res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
        return;
      }

      const idToken = req.headers.authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // التحقق من صلاحيات المستخدم
      if (!decodedToken.owner && !decodedToken.admin) {
        console.error(`[setUserDisabledStatusHttp] User ${decodedToken.uid} is not an owner or admin`);
        res.status(403).json({ error: 'يجب أن تكون مالكًا أو مسؤولًا لتعيين حالة تعطيل المستخدم.' });
        return;
      }

      // الحصول على معرف المستخدم وحالة التعطيل
      const uid = req.body.uid;
      const disabled = req.body.disabled;

      if (!uid || disabled === undefined) {
        console.error("[setUserDisabledStatusHttp] Missing required parameters");
        res.status(400).json({ error: 'يجب توفير معرف المستخدم وحالة التعطيل.' });
        return;
      }

      console.log(`[setUserDisabledStatusHttp] Setting disabled status for user ${uid} to ${disabled}`);

      // تحديث حالة تعطيل المستخدم
      await admin.auth().updateUser(uid, { disabled });

      // تحديث وثيقة المستخدم في Firestore
      await db.collection('users').doc(uid).update({
        disabled,
        updatedAt: new Date()
      });

      res.status(200).json({
        success: true,
        message: `تم ${disabled ? 'تعطيل' : 'تفعيل'} المستخدم بنجاح.`
      });

    } catch (error: any) {
      console.error("[setUserDisabledStatusHttp] Error:", error);
      res.status(500).json({ error: `حدث خطأ أثناء تعيين حالة تعطيل المستخدم: ${error.message}` });
    }
  });
});
*/

/**
 * دالة HTTP لتعيين دور المسؤول للمستخدم
 * تتطلب أن يكون المستدعي مالكًا
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد - استخدم setAdminRole بدلاً منها
 */
/*
export const setAdminRoleHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
  // إعداد CORS
  corsHandler(req, res, async () => {
    console.log("[setAdminRoleHttp] Function called");

    try {
      // التحقق من المصادقة
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        console.error("[setAdminRoleHttp] No authorization token provided");
        res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
        return;
      }

      const idToken = req.headers.authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // التحقق من صلاحيات المستخدم
      if (!decodedToken.owner) {
        console.error(`[setAdminRoleHttp] User ${decodedToken.uid} is not an owner`);
        res.status(403).json({ error: 'يجب أن تكون مالكًا لتعيين دور المسؤول.' });
        return;
      }

      // الحصول على معرف المستخدم
      const uid = req.body.uid;

      if (!uid) {
        console.error("[setAdminRoleHttp] Missing required parameters");
        res.status(400).json({ error: 'يجب توفير معرف المستخدم.' });
        return;
      }

      console.log(`[setAdminRoleHttp] Setting admin role for user ${uid}`);

      // الحصول على معلومات المستخدم الحالية
      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};

      // تعيين دور المسؤول مع الحفاظ على الخصائص الأخرى
      const newClaims = {
        ...currentClaims,
        role: 'admin',
        admin: true
      };

      // تحديث custom claims
      await admin.auth().setCustomUserClaims(uid, newClaims);

      // تحديث وثيقة المستخدم في Firestore
      await db.collection('users').doc(uid).update({
        role: 'admin',
        isAdmin: true,
        updatedAt: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'تم تعيين دور المسؤول للمستخدم بنجاح.',
        claims: newClaims
      });

    } catch (error: any) {
      console.error("[setAdminRoleHttp] Error:", error);
      res.status(500).json({ error: `حدث خطأ أثناء تعيين دور المسؤول للمستخدم: ${error.message}` });
    }
  });
});
*/

/**
 * دالة HTTP لإنشاء مستخدم جديد
 * تتطلب أن يكون المستدعي مالكًا أو مسؤولًا
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد - استخدم createUser بدلاً منها
 */
/*
export const createUserHttp = functions.region('us-central1').https.onRequest(async (req, res) => {
  // إعداد CORS
  corsHandler(req, res, async () => {
    console.log("[createUserHttp] Function called");

    try {
      // التحقق من المصادقة
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        console.error("[createUserHttp] No authorization token provided");
        res.status(401).json({ error: 'يجب توفير رمز المصادقة.' });
        return;
      }

      const idToken = req.headers.authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // التحقق من صلاحيات المستخدم
      if (!decodedToken.owner && !decodedToken.admin) {
        console.error(`[createUserHttp] User ${decodedToken.uid} is not an owner or admin`);
        res.status(403).json({ error: 'يجب أن تكون مالكًا أو مسؤولًا لإنشاء مستخدم جديد.' });
        return;
      }

      // الحصول على بيانات المستخدم الجديد
      const { email, password, displayName, role, organizationId } = req.body;

      if (!email || !password) {
        console.error("[createUserHttp] Missing required parameters");
        res.status(400).json({ error: 'يجب توفير البريد الإلكتروني وكلمة المرور.' });
        return;
      }

      console.log(`[createUserHttp] Creating new user with email ${email}`);

      // إنشاء المستخدم الجديد
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: displayName || email,
        disabled: false
      });

      // تعيين custom claims
      const claims: Record<string, any> = {
        role: role || 'user',
        admin: role === 'admin' || role === 'owner',
        owner: role === 'owner'
      };

      // إذا كان هناك معرف مؤسسة، نضيفه إلى custom claims
      if (organizationId) {
        claims.accountType = 'organization';
        claims.organizationId = organizationId;
      } else {
        claims.accountType = 'individual';
      }

      await admin.auth().setCustomUserClaims(userRecord.uid, claims);

      // إنشاء وثيقة المستخدم في Firestore
      await db.collection('users').doc(userRecord.uid).set({
        email,
        displayName: displayName || email,
        role: role || 'user',
        isAdmin: role === 'admin' || role === 'owner',
        isOwner: role === 'owner',
        accountType: organizationId ? 'organization' : 'individual',
        organizationId: organizationId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: decodedToken.uid
      });

      // إذا كان هناك معرف مؤسسة، نضيف المستخدم كعضو في المؤسسة
      if (organizationId) {
        await db.collection('organizations').doc(organizationId).collection('members').doc(userRecord.uid).set({
          role: role || 'user',
          joinedAt: new Date(),
          addedBy: decodedToken.uid
        });
      }

      res.status(200).json({
        success: true,
        message: 'تم إنشاء المستخدم بنجاح.',
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          claims
        }
      });

    } catch (error: any) {
      console.error("[createUserHttp] Error:", error);
      res.status(500).json({ error: `حدث خطأ أثناء إنشاء المستخدم: ${error.message}` });
    }
  });
});
*/