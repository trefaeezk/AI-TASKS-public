'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface TranslateProps {
  text: string;
  defaultValue?: string;
  className?: string;
}

/**
 * مكون للترجمة يمكن استخدامه في أي مكان في التطبيق
 * 
 * مثال:
 * <Translate text="general.welcome" />
 * <Translate text="tasks.taskCreated" defaultValue="تم إنشاء المهمة بنجاح" />
 */
export function Translate({ text, defaultValue, className }: TranslateProps) {
  const { t } = useLanguage();
  return <span className={className}>{t(text, defaultValue)}</span>;
}

/**
 * مكون للترجمة مع دعم HTML
 * 
 * مثال:
 * <TranslateHTML text="general.welcome" />
 */
export function TranslateHTML({ text, defaultValue, className }: TranslateProps) {
  const { t } = useLanguage();
  return (
    <span 
      className={className} 
      dangerouslySetInnerHTML={{ __html: t(text, defaultValue) }} 
    />
  );
}
