import { Timestamp } from 'firebase/firestore';

// نوع الإشعار
export type NotificationType = 
  | 'task_created'        // إنشاء مهمة جديدة
  | 'task_assigned'       // تعيين مهمة
  | 'task_due_soon'       // مهمة على وشك الاستحقاق
  | 'task_overdue'        // مهمة متأخرة
  | 'task_completed'      // اكتمال مهمة
  | 'task_status_changed' // تغيير حالة مهمة
  | 'meeting_created'     // إنشاء اجتماع جديد
  | 'meeting_reminder'    // تذكير باجتماع
  | 'meeting_updated'     // تحديث اجتماع
  | 'meeting_cancelled'   // إلغاء اجتماع
  | 'department_created'  // إنشاء قسم جديد
  | 'member_added'        // إضافة عضو جديد
  | 'ai_suggestion'       // اقتراح من الذكاء الاصطناعي
  | 'system';             // إشعار نظام

// مستوى أهمية الإشعار
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

// حالة الإشعار
export type NotificationStatus = 'unread' | 'read' | 'archived';

// واجهة الإشعار
export interface Notification {
  id: string;
  userId: string;
  organizationId?: string;
  departmentId?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;
  actionLink?: string;
  actionText?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'task' | 'meeting' | 'department' | 'user';
  metadata?: Record<string, any>;
}

// واجهة الإشعار (Firestore)
export interface NotificationFirestore {
  id: string;
  userId: string;
  organizationId?: string;
  departmentId?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: Timestamp;
  readAt?: Timestamp;
  expiresAt?: Timestamp;
  actionLink?: string;
  actionText?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'task' | 'meeting' | 'department' | 'user';
  metadata?: Record<string, any>;
}

// واجهة إعدادات الإشعارات
export interface NotificationSettings {
  userId: string;
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  enableTaskNotifications: boolean;
  enableMeetingNotifications: boolean;
  enableSystemNotifications: boolean;
  enableAiSuggestions: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly' | 'never';
  doNotDisturbStart?: string; // Format: "HH:MM"
  doNotDisturbEnd?: string; // Format: "HH:MM"
  excludedTypes?: NotificationType[];
}

// واجهة إعدادات الإشعارات (Firestore)
export interface NotificationSettingsFirestore {
  userId: string;
  enableEmailNotifications: boolean;
  enablePushNotifications: boolean;
  enableTaskNotifications: boolean;
  enableMeetingNotifications: boolean;
  enableSystemNotifications: boolean;
  enableAiSuggestions: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly' | 'never';
  doNotDisturbStart?: string;
  doNotDisturbEnd?: string;
  excludedTypes?: NotificationType[];
  updatedAt: Timestamp;
}

// الإعدادات الافتراضية للإشعارات
export const DEFAULT_NOTIFICATION_SETTINGS: Omit<NotificationSettings, 'userId'> = {
  enableEmailNotifications: true,
  enablePushNotifications: true,
  enableTaskNotifications: true,
  enableMeetingNotifications: true,
  enableSystemNotifications: true,
  enableAiSuggestions: true,
  emailFrequency: 'daily',
};
