/**
 * إعدادات التطبيق الأساسية
 * يستخدم متغيرات البيئة لضمان المرونة في التكوين
 */

// الحصول على الدومين الأساسي من متغيرات البيئة
export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9003';

// إعدادات أخرى للتطبيق
export const APP_CONFIG = {
  // الدومين الأساسي
  baseUrl: APP_BASE_URL,
  
  // إعدادات API
  api: {
    timeout: 30000, // 30 ثانية
    retries: 3,
  },
  
  // إعدادات Firebase
  firebase: {
    region: 'europe-west1',
    functionsTimeout: 60000, // 60 ثانية
  },
  
  // إعدادات التطوير
  development: {
    enableDebugLogs: process.env.NODE_ENV === 'development',
    enableDevTools: process.env.NODE_ENV === 'development',
  },
  
  // إعدادات الإنتاج
  production: {
    enableAnalytics: process.env.NODE_ENV === 'production',
    enableErrorReporting: process.env.NODE_ENV === 'production',
  },
};

// دالة مساعدة للحصول على URL كامل
export function getFullUrl(path: string): string {
  // إزالة الشرطة المائلة في البداية إذا كانت موجودة
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // إضافة الشرطة المائلة في النهاية للدومين الأساسي إذا لم تكن موجودة
  const baseUrl = APP_BASE_URL.endsWith('/') ? APP_BASE_URL.slice(0, -1) : APP_BASE_URL;
  
  return `${baseUrl}/${cleanPath}`;
}

// دالة للتحقق من صحة التكوين
export function validateConfig(): boolean {
  try {
    // التحقق من وجود الدومين الأساسي
    if (!APP_BASE_URL) {
      console.error('❌ APP_BASE_URL is not defined');
      return false;
    }
    
    // التحقق من صحة URL
    new URL(APP_BASE_URL);
    
    console.log('✅ App configuration is valid');
    console.log(`📍 Base URL: ${APP_BASE_URL}`);
    
    return true;
  } catch (error) {
    console.error('❌ Invalid app configuration:', error);
    return false;
  }
}

// تشغيل التحقق من التكوين عند تحميل الملف
if (typeof window !== 'undefined') {
  // فقط في المتصفح
  validateConfig();
}

export default APP_CONFIG;
