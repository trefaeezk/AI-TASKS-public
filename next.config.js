/** @type {import('next').NextConfig} */
const nextConfig = {

  // تعطيل التحقق من الأنواع أثناء البناء
  typescript: {
    ignoreBuildErrors: true,
  },

  // تكوين webpack لتجاوز مشاكل الوحدات الخارجية ودعم WebAssembly
  webpack: (config, { isServer }) => {
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

    // تعطيل HMR في بيئة الإنتاج
    if (process.env.NODE_ENV === 'production') {
      config.optimization.runtimeChunk = false;
      config.optimization.splitChunks = {
        cacheGroups: {
          default: false,
        },
      };
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
