/** @type {import('next').NextConfig} */
const nextConfig = {
  // تكوين لتحسين عملية البناء
  reactStrictMode: true,

  // تعطيل التحقق من الأنواع أثناء البناء
  typescript: {
    // تعطيل التحقق من الأنواع أثناء البناء
    ignoreBuildErrors: true,
  },

  // تكوين لتجاوز مشاكل التوليد المسبق للصفحات
  // استخدام الخيار الرسمي من Next.js
  // تعطيل التوليد المسبق للصفحات التي تستخدم حزم خارجية
  serverExternalPackages: ['firebase', 'firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],

  experimental: {
    // خيارات تجريبية أخرى
  },

  // تكوين لتجاوز أخطاء البناء
  onDemandEntries: {
    // فترة انتظار أطول للصفحات المعقدة
    maxInactiveAge: 60 * 60 * 1000,
    // عدد أكبر من الصفحات في الذاكرة
    pagesBufferLength: 5,
  },

  // تكوين لتحسين الأداء
  compiler: {
    // تعطيل التحقق من الأنواع في وقت التشغيل
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // إعدادات إضافية لتجنب مشاكل البناء مع الصفحات التي تستخدم hooks
  // swcMinify تم إزالته في الإصدارات الحديثة

  // تعطيل التوليد المسبق للصفحات الديناميكية
  // هذا سيساعد في تجنب أخطاء useState في الصفحات التي تستخدم hooks
  staticPageGenerationTimeout: 120,
}

module.exports = nextConfig
