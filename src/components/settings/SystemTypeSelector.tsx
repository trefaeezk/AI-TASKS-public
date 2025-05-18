'use client';

/**
 * تم إزالة ميزة تغيير نوع النظام من صفحة الإعدادات
 * يتم تحديد نوع النظام تلقائيًا بناءً على نوع حساب المستخدم
 */

import React from 'react';
import { SystemType } from '@/types/system';

interface SystemTypeSelectorProps {
  onSystemTypeChange?: (type: SystemType) => void;
}

// مكون فارغ لتجنب أخطاء الاستيراد في الملفات الأخرى
export default function SystemTypeSelector({ onSystemTypeChange }: SystemTypeSelectorProps) {
  return null;
}
