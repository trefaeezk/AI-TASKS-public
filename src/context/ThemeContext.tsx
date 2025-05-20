'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

// تعريف نوع سياق السمة
interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
}

// إنشاء سياق السمة مع قيم افتراضية
const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
});

// مزود سياق السمة
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // استخدام السمة المخزنة في localStorage أو السمة الافتراضية
  const [theme, setThemeState] = useState<string>('light');
  const [isClient, setIsClient] = useState(false);

  // تحديث السمة
  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
    
    if (typeof window !== 'undefined') {
      // حفظ السمة في localStorage
      localStorage.setItem('theme', newTheme);
      
      // تطبيق السمة على عنصر HTML
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newTheme);
    }
  };

  // تحميل السمة من localStorage عند تحميل المكون
  useEffect(() => {
    setIsClient(true);
    
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      // التحقق من تفضيلات النظام إذا لم تكن هناك سمة مخزنة
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    }
  }, []);

  // قيمة السياق
  const contextValue: ThemeContextType = {
    theme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook لاستخدام سياق السمة
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
