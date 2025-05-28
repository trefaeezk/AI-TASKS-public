@echo off
echo 🔧 إصلاح خطأ Syntax Error...

echo 1. مسح cache...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo 2. مسح ملفات مؤقتة...
if exist *.log del *.log
if exist .eslintcache del .eslintcache

echo 3. إعادة تثبيت dependencies...
npm install

echo 4. إعادة بناء المشروع...
npm run build

echo ✅ تم الانتهاء! جرب تشغيل المشروع الآن:
echo npm run dev

pause
