/**
 * Language configuration and utilities
 */

import ar from './ar';
import en from './en';

// Available languages
export const languages = {
  ar,
  en,
};

// Language codes and names
export const languageOptions = [
  { code: 'ar', name: 'العربية', direction: 'rtl' },
  { code: 'en', name: 'English', direction: 'ltr' },
];

// Default language
export const defaultLanguage = 'ar';

// Get language direction
export const getLanguageDirection = (languageCode: string): 'rtl' | 'ltr' => {
  const language = languageOptions.find(lang => lang.code === languageCode);
  return language?.direction || 'rtl';
};

// Get translation
export const getTranslation = (
  languageCode: string,
  key: string,
  defaultValue?: string
): string => {
  const keys = key.split('.');
  const language = languages[languageCode as keyof typeof languages] || languages[defaultLanguage as keyof typeof languages];
  
  let translation: any = language;
  
  for (const k of keys) {
    if (translation && typeof translation === 'object' && k in translation) {
      translation = translation[k];
    } else {
      return defaultValue || key;
    }
  }
  
  return typeof translation === 'string' ? translation : defaultValue || key;
};

export default languages;
