/**
 * أنواع بيانات إعدادات النظام
 */

// نوع النظام: مؤسسة أو فردي
export type SystemType = 'organization' | 'individual';

// إعدادات النظام
export interface SystemSettings {
  // نوع النظام
  type: SystemType;
  
  // اسم المؤسسة (في حالة نظام المؤسسة)
  organizationName?: string;
  
  // شعار المؤسسة (في حالة نظام المؤسسة)
  organizationLogo?: string;
  
  // معلومات الاتصال بالمؤسسة (في حالة نظام المؤسسة)
  organizationContact?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  
  // إعدادات عامة
  settings: {
    // السماح بالتسجيل الذاتي للمستخدمين
    allowSelfRegistration: boolean;
    
    // الدور الافتراضي للمستخدمين الجدد
    defaultUserRole: string;
    
    // تفعيل المستخدمين الجدد تلقائيًا
    autoActivateUsers: boolean;
    
    // تفعيل الإشعارات
    enableNotifications: boolean;
  };
  
  // تاريخ إنشاء الإعدادات
  createdAt: Date;
  
  // تاريخ آخر تحديث للإعدادات
  updatedAt: Date;
}

// إعدادات النظام الافتراضية
export const DEFAULT_SYSTEM_SETTINGS: Omit<SystemSettings, 'createdAt' | 'updatedAt'> = {
  type: 'individual',
  settings: {
    allowSelfRegistration: true,
    defaultUserRole: 'user',
    autoActivateUsers: true,
    enableNotifications: true
  }
};

// إعدادات نظام المؤسسة الافتراضية
export const DEFAULT_ORGANIZATION_SETTINGS: Omit<SystemSettings, 'createdAt' | 'updatedAt'> = {
  type: 'organization',
  organizationName: 'مؤسستي',
  settings: {
    allowSelfRegistration: false,
    defaultUserRole: 'user',
    autoActivateUsers: false,
    enableNotifications: true
  }
};
