#!/bin/bash

echo "🧹 تنظيف الملفات المؤقتة..."

echo "1. حذف ملفات Next.js Cache..."
rm -rf .next/
rm -rf out/

echo "2. حذف ملفات Node.js Cache..."
rm -rf node_modules/.cache/
rm -rf .npm/
rm -f .eslintcache

echo "3. حذف ملفات TypeScript Build..."
rm -f *.tsbuildinfo
rm -f next-env.d.ts

echo "4. حذف ملفات Firebase Functions Build..."
rm -rf functions/lib/

echo "5. حذف ملفات Log..."
rm -f *.log
rm -f npm-debug.log*
rm -f yarn-debug.log*
rm -f yarn-error.log*
rm -f .pnpm-debug.log*
rm -f firebase-debug.log
rm -f firebase-debug.*.log

echo "6. حذف ملفات OS المؤقتة..."
rm -f .DS_Store
rm -f Thumbs.db
rm -f desktop.ini

echo "7. حذف ملفات Editor المؤقتة..."
rm -f *.swp
rm -f *.swo
rm -f *~

echo "✅ تم تنظيف الملفات المؤقتة بنجاح!"
echo "📊 يمكنك الآن تشغيل المشروع بـ: npm run dev"
