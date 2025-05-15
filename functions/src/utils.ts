/**
 * ملف مساعد قديم - تم نقل الوظائف إلى المجلدات المناسبة
 *
 * هذا الملف محتفظ به للتوافق مع الكود القديم
 * يرجى استخدام الوظائف من المجلدات الجديدة:
 * - shared/utils.ts: للوظائف المشتركة
 * - organization/utils.ts: للوظائف الخاصة بالمؤسسات
 * - individual/utils.ts: للوظائف الخاصة بالمستخدمين الفرديين
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ensureOrgAdmin as newEnsureOrgAdmin, ensureOrgAdminHttp as newEnsureOrgAdminHttp } from './organization/utils';

// تصدير الوظائف من المجلدات الجديدة للحفاظ على التوافق مع الكود القديم
export const ensureOrgAdmin = newEnsureOrgAdmin;
export const ensureOrgAdminHttp = newEnsureOrgAdminHttp;

// تصدير تطبيق Firebase Admin للحفاظ على التوافق مع الكود القديم
export const orgAdminApp = admin.apps.find(app => app?.name === 'organization') ||
                          admin.initializeApp({
                              projectId: 'tasks-intelligence'
                          }, 'organization');
