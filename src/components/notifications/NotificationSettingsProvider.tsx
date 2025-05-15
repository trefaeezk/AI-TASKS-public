'use client';

/**
 * مكون لضمان وجود إعدادات الإشعارات للمستخدم الحالي
 * 
 * يستخدم هذا المكون خطاف useEnsureNotificationSettings لضمان وجود إعدادات الإشعارات
 * للمستخدم الحالي عند تحميل التطبيق.
 */

import React from 'react';
import { useEnsureNotificationSettings } from '@/services/notificationSettings';

interface NotificationSettingsProviderProps {
  children: React.ReactNode;
}

/**
 * مكون لضمان وجود إعدادات الإشعارات للمستخدم الحالي
 */
export function NotificationSettingsProvider({ children }: NotificationSettingsProviderProps) {
  // استخدام خطاف لضمان وجود إعدادات الإشعارات
  useEnsureNotificationSettings();
  
  // عرض المحتوى بدون أي تغييرات
  return <>{children}</>;
}

export default NotificationSettingsProvider;
