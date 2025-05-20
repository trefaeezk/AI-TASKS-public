'use client';

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Languages } from 'lucide-react';
import { languageOptions } from '@/locales';
import { useRouter } from 'next/navigation';

interface LanguageSwitcherProps {
  variant?: 'default' | 'outline' | 'select';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function LanguageSwitcher({
  variant = 'select',
  size = 'default',
  className = '',
}: LanguageSwitcherProps) {
  const { language, setLanguage, direction, t } = useLanguage();
  const router = useRouter();

  // تبديل بين اللغات المتاحة
  const toggleLanguage = () => {
    const currentIndex = languageOptions.findIndex(lang => lang.code === language);
    const nextIndex = (currentIndex + 1) % languageOptions.length;
    const newLang = languageOptions[nextIndex].code;

    // تحديث اللغة في السياق
    setLanguage(newLang);
  };

  // عرض زر بسيط لتبديل اللغة
  if (variant === 'default' || variant === 'outline') {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={toggleLanguage}
        className={className}
        title={t('general.language')}
      >
        <Languages className="h-4 w-4 mr-2" />
        {languageOptions.find(lang => lang.code === language)?.name || language}
      </Button>
    );
  }

  // عرض قائمة منسدلة لاختيار اللغة
  return (
    <div className={`flex items-center ${className}`} dir={direction}>
      <Select
        value={language}
        onValueChange={(newLang) => {
          // تحديث اللغة في السياق
          setLanguage(newLang);
        }}
      >
        <SelectTrigger className={size === 'sm' ? 'h-8 w-[120px]' : 'w-[150px]'}>
          <SelectValue placeholder={t('general.language')} />
        </SelectTrigger>
        <SelectContent>
          {languageOptions.map(lang => (
            <SelectItem key={lang.code} value={lang.code}>
              <div className="flex items-center">
                {lang.code === 'ar' ? (
                  <span className={direction === 'rtl' ? 'ml-2' : 'mr-2'}>🇸🇦</span>
                ) : (
                  <span className={direction === 'rtl' ? 'ml-2' : 'mr-2'}>🇺🇸</span>
                )}
                <span>{lang.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
