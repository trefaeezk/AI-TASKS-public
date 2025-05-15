import { Timestamp } from 'firebase/firestore';

// نوع الاجتماع
export type MeetingType = 'daily' | 'weekly' | 'monthly' | 'custom';

// حالة الاجتماع
export type MeetingStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

// نوع حضور المشارك
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

// واجهة المشارك في الاجتماع
export interface MeetingParticipant {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  attendanceStatus?: AttendanceStatus;
  joinedAt?: Date;
  leftAt?: Date;
}

// واجهة المشارك في الاجتماع (Firestore)
export interface MeetingParticipantFirestore {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  attendanceStatus?: AttendanceStatus;
  joinedAt?: Timestamp;
  leftAt?: Timestamp;
}

// واجهة بند جدول الأعمال
export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  duration?: number; // بالدقائق
  presenter?: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'skipped';
  notes?: string;
}

// واجهة قرار الاجتماع
export interface MeetingDecision {
  id: string;
  description: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  dueDate?: Date;
  status?: 'pending' | 'in-progress' | 'completed';
  relatedAgendaItemId?: string;
}

// واجهة قرار الاجتماع (Firestore)
export interface MeetingDecisionFirestore {
  id: string;
  description: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  dueDate?: Timestamp;
  status?: 'pending' | 'in-progress' | 'completed';
  relatedAgendaItemId?: string;
}

// واجهة مهمة الاجتماع
export interface MeetingTask {
  id: string;
  description: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  dueDate?: Date;
  status?: 'pending' | 'in-progress' | 'completed';
  relatedAgendaItemId?: string;
  relatedDecisionId?: string;
}

// واجهة مهمة الاجتماع (Firestore)
export interface MeetingTaskFirestore {
  id: string;
  description: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  dueDate?: Timestamp;
  status?: 'pending' | 'in-progress' | 'completed';
  relatedAgendaItemId?: string;
  relatedDecisionId?: string;
}

// واجهة الاجتماع
export interface Meeting {
  id: string;
  title: string;
  description?: string;
  type: MeetingType;
  status: MeetingStatus;
  startDate: Date;
  endDate?: Date;
  location?: string;
  isOnline?: boolean;
  meetingLink?: string;
  organizationId?: string;
  departmentId?: string;
  createdBy: string;
  participants: MeetingParticipant[];
  agenda: AgendaItem[];
  decisions: MeetingDecision[];
  tasks: MeetingTask[];
  notes?: string;
  summary?: string;
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    daysOfWeek?: number[]; // 0 = الأحد، 1 = الاثنين، إلخ
    endDate?: Date;
    count?: number;
  };
}

// واجهة الاجتماع (Firestore)
export interface MeetingFirestore {
  id: string;
  title: string;
  description?: string;
  type: MeetingType;
  status: MeetingStatus;
  startDate: Timestamp;
  endDate?: Timestamp;
  location?: string;
  isOnline?: boolean;
  meetingLink?: string;
  organizationId?: string;
  departmentId?: string;
  createdBy: string;
  participants: MeetingParticipantFirestore[];
  agenda: AgendaItem[];
  decisions: MeetingDecisionFirestore[];
  tasks: MeetingTaskFirestore[];
  notes?: string;
  summary?: string;
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    daysOfWeek?: number[]; // 0 = الأحد، 1 = الاثنين، إلخ
    endDate?: Timestamp;
    count?: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
