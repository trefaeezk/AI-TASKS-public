/**
 * خدمة إدارة إعدادات الإشعارات
 *
 * توفر هذه الخدمة وظائف للتعامل مع إعدادات الإشعارات، بما في ذلك إنشاء إعدادات افتراضية
 * إذا لم تكن موجودة.
 */

import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useEffect } from 'react';

/**
 * نوع إعدادات الإشعارات
 */
export interface NotificationSettings {
  userId: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
  taskReminders: boolean;
  taskAssignments: boolean;
  taskUpdates: boolean;
  organizationId?: string;
  departmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * إنشاء إعدادات إشعارات افتراضية للمستخدم
 *
 * @param userId معرف المستخدم
 * @param organizationId معرف المؤسسة (اختياري)
 * @param departmentId معرف القسم (اختياري)
 * @returns وعد بإعدادات الإشعارات
 */
export async function createDefaultNotificationSettings(
  userId: string,
  organizationId?: string,
  departmentId?: string
): Promise<NotificationSettings> {
  const now = new Date();

  // إنشاء الإعدادات الافتراضية مع التحقق من القيم غير المحددة
  const defaultSettings: NotificationSettings = {
    userId,
    email: true,
    push: true,
    inApp: true,
    dailySummary: true,
    weeklySummary: true,
    taskReminders: true,
    taskAssignments: true,
    taskUpdates: true,
    createdAt: now,
    updatedAt: now
  };

  // إضافة organizationId فقط إذا كان محدداً
  if (organizationId) {
    defaultSettings.organizationId = organizationId;
  }

  // إضافة departmentId فقط إذا كان محدداً
  if (departmentId) {
    defaultSettings.departmentId = departmentId;
  }

  // إنشاء وثيقة إعدادات الإشعارات
  await setDoc(doc(db, 'notificationSettings', userId), defaultSettings);

  return defaultSettings;
}

/**
 * الحصول على إعدادات الإشعارات للمستخدم
 *
 * @param userId معرف المستخدم
 * @returns وعد بإعدادات الإشعارات
 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  try {
    const docRef = doc(db, 'notificationSettings', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as NotificationSettings;
    }

    // إذا لم تكن إعدادات الإشعارات موجودة، قم بإنشاء إعدادات افتراضية
    return await createDefaultNotificationSettings(userId);
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return null;
  }
}

/**
 * تحديث إعدادات الإشعارات للمستخدم
 *
 * @param userId معرف المستخدم
 * @param settings إعدادات الإشعارات الجديدة
 * @returns وعد بنجاح التحديث
 */
export async function updateNotificationSettings(
  userId: string,
  settings: Partial<NotificationSettings>
): Promise<boolean> {
  try {
    const docRef = doc(db, 'notificationSettings', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // إذا لم تكن إعدادات الإشعارات موجودة، قم بإنشاء إعدادات افتراضية أولاً
      await createDefaultNotificationSettings(userId, settings.organizationId, settings.departmentId);
    }

    // تحديث إعدادات الإشعارات
    await updateDoc(docRef, {
      ...settings,
      updatedAt: new Date()
    });

    return true;
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return false;
  }
}

/**
 * خطاف لضمان وجود إعدادات الإشعارات للمستخدم الحالي
 */
export function useEnsureNotificationSettings() {
  const { user } = useAuth();
  const { accountType, organizationId, departmentId } = useAccountType();

  useEffect(() => {
    if (!user || accountType === 'loading') return;

    const ensureSettings = async () => {
      try {
        const docRef = doc(db, 'notificationSettings', user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          // إذا لم تكن إعدادات الإشعارات موجودة، قم بإنشاء إعدادات افتراضية
          if (accountType === 'organization' && organizationId) {
            // إذا كان المستخدم ينتمي لمؤسسة وتم تحديد معرف المؤسسة
            await createDefaultNotificationSettings(
              user.uid,
              organizationId,
              departmentId
            );
          } else {
            // إذا كان المستخدم فردياً أو لم يتم تحديد معرف المؤسسة
            await createDefaultNotificationSettings(
              user.uid
            );
          }
          console.log('Created default notification settings for user:', user.uid);
        }
      } catch (error) {
        console.error('Error ensuring notification settings:', error);
      }
    };

    ensureSettings();
  }, [user, accountType, organizationId, departmentId]);
}
