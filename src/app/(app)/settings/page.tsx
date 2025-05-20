
// src/app/(app)/settings/page.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sun, Moon, Bell, ArrowRight } from 'lucide-react'; // Import icons
import OrganizationRequestButton from '@/components/settings/OrganizationRequestButton';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// Settings page component
export default function SettingsPage() {
  const { user } = useAuth();
  const { direction, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6" dir={direction}>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.themeSettings')}</CardTitle>
          <CardDescription>{t('settings.theme')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-4">
            <div>
              <RadioGroupItem value="light" id="light" className="peer sr-only" />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Sun className="mb-3 h-6 w-6" />
                {t('general.light')}
              </Label>
            </div>
            <div>
              <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <Moon className="mb-3 h-6 w-6" />
                {t('general.dark')}
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
                    {t('general.system')}
                </Label>
             </div>
              */}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.languageSettings')}</CardTitle>
          <CardDescription>{t('settings.language')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      {/* قسم إعدادات الإشعارات */}
      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.notificationSettings')}</CardTitle>
          <CardDescription>{t('settings.notificationSettings')}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center space-x-4 space-x-reverse">
            <Bell className="h-6 w-6 text-muted-foreground ml-3" />
            <div>
              <h3 className="font-medium">{t('notifications.notificationSettings')}</h3>
              <p className="text-sm text-muted-foreground">{t('notifications.notifyOnSystemUpdates')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/notifications" className="flex items-center">
              <span>{t('settings.notificationSettings')}</span>
              <ArrowRight className={direction === 'rtl' ? 'mr-2 h-4 w-4' : 'ml-2 h-4 w-4'} />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* بطاقة خيارات متقدمة */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.advancedSettings')}</CardTitle>
          <CardDescription>{t('settings.systemSettings')}</CardDescription>
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
