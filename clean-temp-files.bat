@echo off
echo 🧹 تنظيف الملفات المؤقتة (مع حماية Git)...

echo ⚠️  تحذير: سيتم حذف الملفات المؤقتة فقط
echo ✅ ملفات Git محمية ولن يتم المساس بها
echo.

echo 1. حذف ملفات Next.js Cache...
if exist .next (
    echo    - حذف .next/
    rmdir /s /q .next
) else (
    echo    - .next/ غير موجود
)

if exist out (
    echo    - حذف out/
    rmdir /s /q out
) else (
    echo    - out/ غير موجود
)

echo 2. حذف ملفات Node.js Cache...
if exist node_modules\.cache (
    echo    - حذف node_modules\.cache/
    rmdir /s /q node_modules\.cache
) else (
    echo    - node_modules\.cache/ غير موجود
)

if exist .npm (
    echo    - حذف .npm/
    rmdir /s /q .npm
) else (
    echo    - .npm/ غير موجود
)

if exist .eslintcache (
    echo    - حذف .eslintcache
    del .eslintcache
) else (
    echo    - .eslintcache غير موجود
)

echo 3. حذف ملفات TypeScript Build...
if exist *.tsbuildinfo (
    echo    - حذف *.tsbuildinfo
    del *.tsbuildinfo
) else (
    echo    - *.tsbuildinfo غير موجود
)

if exist next-env.d.ts (
    echo    - حذف next-env.d.ts
    del next-env.d.ts
) else (
    echo    - next-env.d.ts غير موجود
)

echo 4. حذف ملفات Firebase Functions Build...
if exist functions\lib (
    echo    - حذف functions\lib/
    rmdir /s /q functions\lib
) else (
    echo    - functions\lib/ غير موجود
)

echo 5. حذف ملفات Log...
if exist *.log (
    echo    - حذف *.log
    del *.log
) else (
    echo    - *.log غير موجود
)

if exist firebase-debug.log (
    echo    - حذف firebase-debug.log
    del firebase-debug.log
) else (
    echo    - firebase-debug.log غير موجود
)

if exist firebase-debug.*.log (
    echo    - حذف firebase-debug.*.log
    del firebase-debug.*.log
) else (
    echo    - firebase-debug.*.log غير موجود
)

echo 6. حذف ملفات OS المؤقتة...
if exist .DS_Store (
    echo    - حذف .DS_Store
    del .DS_Store
) else (
    echo    - .DS_Store غير موجود
)

if exist Thumbs.db (
    echo    - حذف Thumbs.db
    del Thumbs.db
) else (
    echo    - Thumbs.db غير موجود
)

echo 7. حذف ملفات Editor المؤقتة...
if exist *.swp (
    echo    - حذف *.swp
    del *.swp
) else (
    echo    - *.swp غير موجود
)

echo.
echo ✅ تم تنظيف الملفات المؤقتة بنجاح!
echo 🔒 ملفات Git محفوظة وآمنة
echo 📊 يمكنك الآن تشغيل المشروع بـ: npm run dev
echo.

pause
