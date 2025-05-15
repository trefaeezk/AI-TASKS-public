
// src/app/(app)/settings/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Moon, Languages } from 'lucide-react'; // Import icons
import SystemTypeSelector from '@/components/settings/SystemTypeSelector';
import OrganizationRequestButton from '@/components/settings/OrganizationRequestButton';
import { useAuth } from '@/hooks/use-auth';

// Settings page component
export default function SettingsPage() {
  const { user, role } = useAuth();
  const [theme, setTheme] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  // Effect to load settings from localStorage on mount (client-side only)
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const storedLanguage = localStorage.getItem('language');
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      // Check system preference if no theme is stored
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    }

    if (storedLanguage) {
      setLanguage(storedLanguage);
    } else {
        // Default language if none stored (e.g., browser preference or default 'ar')
        const browserLang = navigator.language.split('-')[0];
        setLanguage(browserLang === 'en' ? 'en' : 'ar'); // Default to Arabic if not English
    }
  }, []);


   // Effect to apply theme changes to the documentElement and save to localStorage
  useEffect(() => {
    if (theme) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

   // Effect to save language changes to localStorage (applying language is usually handled by i18n libraries or context)
   useEffect(() => {
    if (language) {
        localStorage.setItem('language', language);
        // Here you would typically update your i18n context or state management
        // For this example, we just save it. We might also need to update document 'lang' and 'dir'
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    }
   }, [language]);


  // Handler for theme change
  const handleThemeChange = (value: string) => {
    setTheme(value);
  };

  // Handler for language change
   const handleLanguageChange = (value: string) => {
    setLanguage(value);
    // Potentially force a reload or update UI elements if not using a full i18n library
    // window.location.reload(); // Example: Force reload (can be disruptive)
   };


  // Render loading state or null until settings are loaded client-side
   if (theme === null || language === null) {
    return null; // Or a loading skeleton
   }

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader>
          <CardTitle>المظهر</CardTitle>
          <CardDescription>اختر المظهر الفاتح أو الداكن للتطبيق.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={handleThemeChange} className="grid grid-cols-3 gap-4">
            <div>
              <RadioGroupItem value="light" id="light" className="peer sr-only" />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Sun className="mb-3 h-6 w-6" />
                فاتح
              </Label>
            </div>
            <div>
              <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Moon className="mb-3 h-6 w-6" />
                داكن
              </Label>
            </div>
             {/* Optional: System Preference Option */}
             {/*
             <div>
                <RadioGroupItem value="system" id="system" className="peer sr-only" />
                <Label
                    htmlFor="system"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                    <Laptop className="mb-3 h-6 w-6" />
                    النظام
                </Label>
             </div>
              */}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اللغة</CardTitle>
          <CardDescription>اختر لغة واجهة التطبيق.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center space-x-4 space-x-reverse"> {/* Use space-x-reverse for RTL */}
          <Languages className="h-6 w-6 text-muted-foreground ml-3" /> {/* Add margin for RTL */}
          <Select value={language} onValueChange={handleLanguageChange} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="اختر لغة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
              {/* Add other languages here */}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* نوع النظام - التبديل بين نظام الأفراد والمؤسسات */}
      {user && <SystemTypeSelector />}

      {/* بطاقة خيارات متقدمة */}
      <Card>
        <CardHeader>
          <CardTitle>خيارات متقدمة</CardTitle>
          <CardDescription>إعدادات وخيارات متقدمة للنظام</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
          {/* يمكن إضافة خيارات متقدمة أخرى هنا */}
        </CardContent>
        <CardFooter className="flex justify-end">
          <OrganizationRequestButton />
        </CardFooter>
      </Card>

      {/* Add more settings sections as needed */}
    </div>
  );
}
