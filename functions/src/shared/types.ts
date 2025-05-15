/**
 * أنواع مشتركة للاستخدام في وظائف Firebase
 */

import * as admin from 'firebase-admin';

/**
 * نوع معلومات المصادقة
 */
export interface AuthInfo {
  uid: string;
  token: Record<string, any>;
}

/**
 * نوع طلب الدالة القابلة للاستدعاء
 */
export interface CallableRequest<T = any> {
  data: T;
  auth?: AuthInfo;
  rawRequest: any;
}

/**
 * نوع الهدف الاستراتيجي
 */
export interface Objective {
  id: string;
  title: string;
  description?: string;
  periodId: string;
  organizationId: string;
  departmentId?: string;
  ownerId: string;
  ownerName: string;
  progress: number;
  status: string;
  priority: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  createdBy: string;
}

/**
 * نوع النتيجة الرئيسية
 */
export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description?: string;
  type: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string;
  progress: number;
  status: string;
  dueDate: admin.firestore.Timestamp;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  createdBy: string;
}

/**
 * نوع المهمة
 */
export interface Task {
  id: string;
  description: string;
  details?: string;
  status: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  createdBy: string;
  dueDate?: admin.firestore.Timestamp;
  priority?: string;
  assignedToUserId?: string;
  assigneeName?: string;
  departmentId?: string;
  departmentName?: string;
  taskCategoryId?: string;
  taskCategoryName?: string;
  organizationId: string;
  linkedToOkr?: boolean;
  order?: number;
}

/**
 * نوع رابط المهمة بالنتيجة الرئيسية
 */
export interface TaskKeyResultLink {
  id: string;
  taskId: string;
  keyResultId: string;
  objectiveId: string;
  impact: string;
  notes?: string;
  organizationId: string;
  departmentId?: string;
  createdAt: admin.firestore.Timestamp;
  createdBy: string;
}
