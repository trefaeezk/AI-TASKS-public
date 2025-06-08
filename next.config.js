/** @type {import('next').NextConfig} */
const nextConfig = {

  // تعطيل التحقق من الأنواع أثناء البناء
  typescript: {
    ignoreBuildErrors: true,
  },

  // تكوين webpack لتجاوز مشاكل الوحدات الخارجية ودعم WebAssembly
  webpack: (config, { isServer, dev }) => {
    // تجاهل مكتبات جانب الخادم في جانب العميل
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        net: false,
        http2: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }

    // إعدادات لحل مشاكل chunk loading
    if (dev) {
      config.output = {
        ...config.output,
        chunkLoadTimeout: 30000, // زيادة timeout إلى 30 ثانية
      };
    }

    // تحسين استخدام الذاكرة والمساحة في الإنتاج
    if (!dev) {
      // تقليل حجم الملفات
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              maxSize: 244000,
            },
          },
        },
      };

      // تقليل استخدام الذاكرة
      config.cache = false;
    }

    return config;
  },

  // تكوين لتحسين الأداء
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // تكوين لتجنب مشاكل HMR
  devIndicators: {
    position: 'bottom-right',
  },

  // إعدادات إضافية لحل مشاكل chunk loading
  experimental: {
    esmExternals: 'loose',
  },

  // تكوين لتحسين الأداء في بيئة الإنتاج
  productionBrowserSourceMaps: false,

  // تم إزالة خيار swcMinify لأنه غير معترف به في الإصدار الحالي

  // تكوين لتحسين الأداء في بيئة التطوير
  reactStrictMode: false,

  // تكوين لتجنب مشاكل التحميل
  poweredByHeader: false,

  // تكوين الصور للنشر الديناميكي
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },

  // تكوين Turbopack
  // تم تعطيل تكوين Turbopack لتجنب المشاكل
}

module.exports = nextConfig
