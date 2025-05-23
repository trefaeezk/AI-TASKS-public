'use client';

import { db } from '@/config/firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import {
  Notification,
  NotificationFirestore,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationSettings,
  NotificationSettingsFirestore,
  DEFAULT_NOTIFICATION_SETTINGS
} from '@/types/notification';
import { v4 as uuidv4 } from 'uuid';

// إنشاء إشعار جديد
export async function createNotification(notificationData: Omit<Notification, 'id' | 'status' | 'createdAt'>): Promise<string> {
  try {
    // تحويل البيانات إلى صيغة Firestore
    const firestoreData: any = {
      ...notificationData,
      status: 'unread',
      createdAt: serverTimestamp() as Timestamp,
      // لا نضيف حقل readAt لأنه سيكون undefined في البداية
      expiresAt: notificationData.expiresAt ? Timestamp.fromDate(notificationData.expiresAt) : null,
    };

    // حذف الحقول التي قيمتها undefined لأن Firestore لا يدعمها
    Object.keys(firestoreData).forEach(key => {
      if (firestoreData[key] === undefined) {
        delete firestoreData[key];
      }
    });

    console.log('Creating notification with data:', firestoreData);

    // إضافة الإشعار إلى Firestore
    const docRef = await addDoc(collection(db, 'notifications'), firestoreData);

    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// الحصول على إشعارات المستخدم
export async function getUserNotifications(
  userId: string,
  options?: {
    status?: NotificationStatus;
    limit?: number;
    organizationId?: string;
  }
): Promise<Notification[]> {
  try {
    // إنشاء الاستعلام الأساسي
    let notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    // إضافة فلتر الحالة إذا تم تحديده
    if (options?.status) {
      notificationsQuery = query(
        notificationsQuery,
        where('status', '==', options.status)
      );
    }

    // إضافة فلتر المؤسسة إذا تم تحديده
    if (options?.organizationId) {
      notificationsQuery = query(
        notificationsQuery,
        where('organizationId', '==', options.organizationId)
      );
    }

    // إضافة حد لعدد النتائج إذا تم تحديده
    if (options?.limit) {
      notificationsQuery = query(
        notificationsQuery,
        limit(options.limit)
      );
    }

    // تنفيذ الاستعلام
    const snapshot = await getDocs(notificationsQuery);

    // تحويل البيانات إلى صيغة Notification
    const notifications: Notification[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as NotificationFirestore;

      try {
        notifications.push({
          id: doc.id,
          userId: data.userId,
          organizationId: data.organizationId,
          departmentId: data.departmentId,
          type: data.type,
          title: data.title,
          message: data.message,
          priority: data.priority,
          status: data.status,
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(),
          readAt: data.readAt && typeof data.readAt.toDate === 'function' ? data.readAt.toDate() : undefined,
          expiresAt: data.expiresAt && typeof data.expiresAt.toDate === 'function' ? data.expiresAt.toDate() : undefined,
          actionLink: data.actionLink,
          actionText: data.actionText,
          relatedEntityId: data.relatedEntityId,
          relatedEntityType: data.relatedEntityType,
          metadata: data.metadata,
        });
      } catch (error) {
        console.error(`Error processing notification ${doc.id}:`, error, data);
      }
    });

    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
}

// الاستماع لإشعارات المستخدم في الوقت الفعلي
export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  options?: {
    status?: NotificationStatus;
    limit?: number;
    organizationId?: string;
  }
): () => void {
  // إنشاء الاستعلام الأساسي
  let notificationsQuery = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  // إضافة فلتر الحالة إذا تم تحديده
  if (options?.status) {
    notificationsQuery = query(
      notificationsQuery,
      where('status', '==', options.status)
    );
  }

  // إضافة فلتر المؤسسة إذا تم تحديده
  if (options?.organizationId) {
    notificationsQuery = query(
      notificationsQuery,
      where('organizationId', '==', options.organizationId)
    );
  }

  // إضافة حد لعدد النتائج إذا تم تحديده
  if (options?.limit) {
    notificationsQuery = query(
      notificationsQuery,
      limit(options.limit)
    );
  }

  // الاستماع للتغييرات
  const unsubscribe = onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications: Notification[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as NotificationFirestore;

        try {
          notifications.push({
            id: doc.id,
            userId: data.userId,
            organizationId: data.organizationId,
            departmentId: data.departmentId,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority,
            status: data.status,
            createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : new Date(),
            readAt: data.readAt && typeof data.readAt.toDate === 'function' ? data.readAt.toDate() : undefined,
            expiresAt: data.expiresAt && typeof data.expiresAt.toDate === 'function' ? data.expiresAt.toDate() : undefined,
            actionLink: data.actionLink,
            actionText: data.actionText,
            relatedEntityId: data.relatedEntityId,
            relatedEntityType: data.relatedEntityType,
            metadata: data.metadata,
          });
        } catch (error) {
          console.error(`Error processing notification ${doc.id} in subscription:`, error, data);
        }
      });

      callback(notifications);
    },
    (error) => {
      console.error('Error subscribing to user notifications:', error);

      // التعامل مع أخطاء الصلاحيات بعد تسجيل الخروج
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        console.warn('Notifications subscription: Permission denied, user may have been signed out.');
        // لا نستدعي callback مع خطأ في هذه الحالة
        return;
      }

      // استدعاء callback مع مصفوفة فارغة في حالة الأخطاء الأخرى
      callback([]);
    }
  );

  return unsubscribe;
}

// تحديث حالة الإشعار
export async function updateNotificationStatus(
  notificationId: string,
  status: NotificationStatus
): Promise<void> {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);

    const updateData: Partial<NotificationFirestore> = {
      status,
    };

    // إذا كانت الحالة "read"، قم بتعيين وقت القراءة
    if (status === 'read') {
      updateData.readAt = serverTimestamp() as Timestamp;
    }

    await updateDoc(notificationRef, updateData);
  } catch (error) {
    console.error('Error updating notification status:', error);
    throw error;
  }
}

// تعليم جميع إشعارات المستخدم كمقروءة
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    // الحصول على جميع الإشعارات غير المقروءة للمستخدم
    const unreadNotificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('status', '==', 'unread')
    );

    const snapshot = await getDocs(unreadNotificationsQuery);

    // تحديث كل إشعار
    const updatePromises = snapshot.docs.map((doc) => {
      return updateDoc(doc.ref, {
        status: 'read',
        readAt: serverTimestamp(),
      });
    });

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

// حذف إشعار
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

// الحصول على إعدادات الإشعارات للمستخدم
export async function getUserNotificationSettings(userId: string): Promise<NotificationSettings> {
  try {
    const settingsDoc = await getDoc(doc(db, 'notificationSettings', userId));

    if (!settingsDoc.exists()) {
      // إذا لم تكن الإعدادات موجودة، قم بإنشائها باستخدام الإعدادات الافتراضية
      const defaultSettings: NotificationSettingsFirestore = {
        userId,
        ...DEFAULT_NOTIFICATION_SETTINGS,
        updatedAt: serverTimestamp() as Timestamp,
      };

      // استخدام setDoc بدلاً من updateDoc لإنشاء وثيقة جديدة
      await setDoc(doc(db, 'notificationSettings', userId), defaultSettings);

      return {
        userId,
        ...DEFAULT_NOTIFICATION_SETTINGS,
      };
    }

    const data = settingsDoc.data() as NotificationSettingsFirestore;

    return {
      userId: data.userId,
      enableEmailNotifications: data.enableEmailNotifications,
      enablePushNotifications: data.enablePushNotifications,
      enableTaskNotifications: data.enableTaskNotifications,
      enableMeetingNotifications: data.enableMeetingNotifications,
      enableSystemNotifications: data.enableSystemNotifications,
      enableAiSuggestions: data.enableAiSuggestions,
      emailFrequency: data.emailFrequency,
      doNotDisturbStart: data.doNotDisturbStart,
      doNotDisturbEnd: data.doNotDisturbEnd,
      excludedTypes: data.excludedTypes,
    };
  } catch (error) {
    console.error('Error getting user notification settings:', error);
    throw error;
  }
}

// تحديث إعدادات الإشعارات للمستخدم
export async function updateUserNotificationSettings(
  userId: string,
  settings: Partial<NotificationSettings>
): Promise<void> {
  try {
    const settingsRef = doc(db, 'notificationSettings', userId);

    // نسخ الإعدادات لتجنب تعديل الكائن الأصلي
    const settingsCopy = { ...settings };

    // تحويل قيم undefined إلى null لأن Firestore لا يدعم undefined
    const cleanedSettings: Record<string, any> = {};

    Object.entries(settingsCopy).forEach(([key, value]) => {
      cleanedSettings[key] = value === undefined ? null : value;
    });

    const updateData: Partial<NotificationSettingsFirestore> = {
      ...cleanedSettings,
      updatedAt: serverTimestamp() as Timestamp,
    };

    await updateDoc(settingsRef, updateData);
  } catch (error) {
    console.error('Error updating user notification settings:', error);
    throw error;
  }
}
