/**
 * أنواع بيانات نظام التخطيط السنوي (OKRs)
 * 
 * يحتوي هذا الملف على تعريفات الأنواع المستخدمة في نظام التخطيط السنوي (OKRs).
 */

import { Timestamp } from 'firebase/firestore';

/**
 * فترة OKR
 * 
 * تمثل فترة زمنية محددة لتحقيق الأهداف، مثل ربع سنة أو سنة كاملة.
 */
export interface OkrPeriod {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'completed' | 'planning';
  organizationId: string;
  departmentId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * هدف استراتيجي
 * 
 * يمثل هدفًا استراتيجيًا رئيسيًا للمؤسسة أو القسم.
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
  progress: number; // 0-100
  status: 'active' | 'completed' | 'at_risk' | 'behind';
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * نتيجة رئيسية
 * 
 * تمثل نتيجة رئيسية قابلة للقياس مرتبطة بهدف استراتيجي.
 */
export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description?: string;
  type: 'numeric' | 'percentage' | 'boolean' | 'currency';
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string; // e.g., "$", "%", "users"
  progress: number; // 0-100
  status: 'active' | 'completed' | 'at_risk' | 'behind';
  dueDate: Timestamp;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * تحديث النتيجة الرئيسية
 * 
 * يمثل تحديثًا لقيمة النتيجة الرئيسية مع ملاحظات.
 */
export interface KeyResultUpdate {
  id: string;
  keyResultId: string;
  previousValue: number;
  newValue: number;
  notes?: string;
  date: Timestamp;
  userId: string;
  userName: string;
  organizationId: string;
  departmentId?: string;
  createdAt: Timestamp;
}

/**
 * ربط المهمة بالنتيجة الرئيسية
 * 
 * يمثل ربطًا بين مهمة ونتيجة رئيسية.
 */
export interface TaskKeyResultLink {
  id: string;
  taskId: string;
  keyResultId: string;
  objectiveId: string;
  impact: 'low' | 'medium' | 'high';
  notes?: string;
  organizationId: string;
  departmentId?: string;
  createdAt: Timestamp;
  createdBy: string;
}

/**
 * تقرير تقدم OKR
 * 
 * يمثل تقريرًا دوريًا عن تقدم الأهداف والنتائج الرئيسية.
 */
export interface OkrProgressReport {
  id: string;
  periodId: string;
  title: string;
  date: Timestamp;
  summary: string;
  highlights: string[];
  challenges: string[];
  nextSteps: string[];
  overallProgress: number; // 0-100
  objectivesProgress: {
    objectiveId: string;
    progress: number;
    status: 'on_track' | 'at_risk' | 'behind';
    notes?: string;
  }[];
  organizationId: string;
  departmentId?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

/**
 * إحصائيات OKR
 * 
 * تمثل إحصائيات مجمعة عن أداء OKR.
 */
export interface OkrStats {
  periodId: string;
  totalObjectives: number;
  completedObjectives: number;
  atRiskObjectives: number;
  behindObjectives: number;
  totalKeyResults: number;
  completedKeyResults: number;
  atRiskKeyResults: number;
  behindKeyResults: number;
  averageObjectiveProgress: number;
  averageKeyResultProgress: number;
  linkedTasksCount: number;
  completedLinkedTasksCount: number;
  organizationId: string;
  departmentId?: string;
  lastUpdated: Timestamp;
}
