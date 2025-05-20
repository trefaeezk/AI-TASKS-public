'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { languages, defaultLanguage, getLanguageDirection, getTranslation } from '@/locales';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';

// تعريف نوع سياق اللغة
interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  direction: 'rtl' | 'ltr';
  t: (key: string, defaultValue?: string) => string;
}

// إنشاء سياق اللغة مع قيم افتراضية
const LanguageContext = createContext<LanguageContextType>({
  language: defaultLanguage,
  setLanguage: () => {},
  direction: 'rtl',
  t: (key: string) => key,
});

// مزود سياق اللغة
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // استخدام اللغة المخزنة في localStorage أو اللغة الافتراضية
  const [language, setLanguageState] = useState<string>(defaultLanguage);
  const [direction, setDirection] = useState<'rtl' | 'ltr'>(getLanguageDirection(defaultLanguage));
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // تحديث اللغة والاتجاه
  const setLanguage = async (lang: string) => {
    setLanguageState(lang);
    setDirection(getLanguageDirection(lang));

    if (typeof window !== 'undefined') {
      // حفظ في localStorage للاستخدام المؤقت
      localStorage.setItem('language', lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = getLanguageDirection(lang);

      // حفظ في قاعدة البيانات إذا كان المستخدم مسجل الدخول
      if (user) {
        try {
          const userSettingsRef = doc(db, 'userSettings', user.uid);
          const userSettingsDoc = await getDoc(userSettingsRef);

          if (userSettingsDoc.exists()) {
            // تحديث الإعدادات الموجودة
            await updateDoc(userSettingsRef, {
              language: lang,
              updatedAt: new Date()
            });
          } else {
            // إنشاء إعدادات جديدة
            await setDoc(userSettingsRef, {
              language: lang,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          console.log(`[LanguageContext] Language setting saved to database: ${lang}`);
        } catch (error) {
          console.error('[LanguageContext] Error saving language setting to database:', error);
        }
      }

      // تحديث الصفحة لتطبيق التغييرات
      router.refresh();
    }
  };

  // دالة للحصول على الترجمة
  const t = (key: string, defaultValue?: string): string => {
    return getTranslation(language, key, defaultValue);
  };

  // تحميل اللغة من قاعدة البيانات أو localStorage عند تحميل المكون
  useEffect(() => {
    const loadLanguageSettings = async () => {
      setIsClient(true);
      setIsLoading(true);

      try {
        // أولاً، إذا كان المستخدم مسجل الدخول، نحاول تحميل الإعدادات من قاعدة البيانات
        if (user) {
          const userSettingsRef = doc(db, 'userSettings', user.uid);
          const userSettingsDoc = await getDoc(userSettingsRef);

          if (userSettingsDoc.exists() && userSettingsDoc.data().language) {
            const dbLanguage = userSettingsDoc.data().language;
            console.log(`[LanguageContext] Loaded language from database: ${dbLanguage}`);
            setLanguage(dbLanguage);
            setIsLoading(false);
            return;
          }
        }

        // ثانيًا، إذا لم نتمكن من تحميل الإعدادات من قاعدة البيانات، نستخدم localStorage
        const storedLanguage = localStorage.getItem('language');
        if (storedLanguage) {
          console.log(`[LanguageContext] Loaded language from localStorage: ${storedLanguage}`);
          setLanguage(storedLanguage);
        } else {
          // ثالثًا، استخدام لغة المتصفح إذا كانت متوفرة
          const browserLang = navigator.language.split('-')[0];
          const supportedLang = Object.keys(languages).includes(browserLang) ? browserLang : defaultLanguage;
          console.log(`[LanguageContext] Using browser/default language: ${supportedLang}`);
          setLanguage(supportedLang);
        }
      } catch (error) {
        console.error('[LanguageContext] Error loading language settings:', error);
        // استخدام اللغة المخزنة في localStorage كخطة بديلة
        const storedLanguage = localStorage.getItem('language');
        if (storedLanguage) {
          setLanguage(storedLanguage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguageSettings();
  }, [user]);

  // تطبيق اتجاه اللغة على عنصر HTML
  useEffect(() => {
    if (isClient) {
      document.documentElement.lang = language;
      document.documentElement.dir = direction;
    }
  }, [language, direction, isClient]);

  // قيمة السياق
  const contextValue: LanguageContextType = {
    language,
    setLanguage,
    direction,
    t,
  };

  // عرض مؤشر التحميل أثناء تحميل إعدادات اللغة
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook لاستخدام سياق اللغة
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
