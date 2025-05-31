# PowerShell script لتنظيف الملفات المؤقتة (مع حماية Git)

Write-Host "🧹 تنظيف الملفات المؤقتة (مع حماية Git)..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  تحذير: سيتم حذف الملفات المؤقتة فقط" -ForegroundColor Yellow
Write-Host "✅ ملفات Git محمية ولن يتم المساس بها" -ForegroundColor Green
Write-Host ""

Write-Host "1. حذف ملفات Next.js Cache..." -ForegroundColor Blue
if (Test-Path ".next") {
    Write-Host "   - حذف .next/" -ForegroundColor Red
    Remove-Item ".next" -Recurse -Force
} else {
    Write-Host "   - .next/ غير موجود" -ForegroundColor Gray
}

if (Test-Path "out") {
    Write-Host "   - حذف out/" -ForegroundColor Red
    Remove-Item "out" -Recurse -Force
} else {
    Write-Host "   - out/ غير موجود" -ForegroundColor Gray
}

Write-Host "2. حذف ملفات Node.js Cache..." -ForegroundColor Blue
if (Test-Path "node_modules\.cache") {
    Write-Host "   - حذف node_modules\.cache/" -ForegroundColor Red
    Remove-Item "node_modules\.cache" -Recurse -Force
} else {
    Write-Host "   - node_modules\.cache/ غير موجود" -ForegroundColor Gray
}

if (Test-Path ".npm") {
    Write-Host "   - حذف .npm/" -ForegroundColor Red
    Remove-Item ".npm" -Recurse -Force
} else {
    Write-Host "   - .npm/ غير موجود" -ForegroundColor Gray
}

if (Test-Path ".eslintcache") {
    Write-Host "   - حذف .eslintcache" -ForegroundColor Red
    Remove-Item ".eslintcache" -Force
} else {
    Write-Host "   - .eslintcache غير موجود" -ForegroundColor Gray
}

Write-Host "3. حذف ملفات TypeScript Build..." -ForegroundColor Blue
$tsbuildFiles = Get-ChildItem "*.tsbuildinfo" -ErrorAction SilentlyContinue
if ($tsbuildFiles) {
    Write-Host "   - حذف *.tsbuildinfo" -ForegroundColor Red
    Remove-Item "*.tsbuildinfo" -Force
} else {
    Write-Host "   - *.tsbuildinfo غير موجود" -ForegroundColor Gray
}

if (Test-Path "next-env.d.ts") {
    Write-Host "   - حذف next-env.d.ts" -ForegroundColor Red
    Remove-Item "next-env.d.ts" -Force
} else {
    Write-Host "   - next-env.d.ts غير موجود" -ForegroundColor Gray
}

Write-Host "4. حذف ملفات Firebase Functions Build..." -ForegroundColor Blue
if (Test-Path "functions\lib") {
    Write-Host "   - حذف functions\lib/" -ForegroundColor Red
    Remove-Item "functions\lib" -Recurse -Force
} else {
    Write-Host "   - functions\lib/ غير موجود" -ForegroundColor Gray
}

Write-Host "5. حذف ملفات Log..." -ForegroundColor Blue
$logFiles = Get-ChildItem "*.log" -ErrorAction SilentlyContinue
if ($logFiles) {
    Write-Host "   - حذف *.log" -ForegroundColor Red
    Remove-Item "*.log" -Force
} else {
    Write-Host "   - *.log غير موجود" -ForegroundColor Gray
}

if (Test-Path "firebase-debug.log") {
    Write-Host "   - حذف firebase-debug.log" -ForegroundColor Red
    Remove-Item "firebase-debug.log" -Force
} else {
    Write-Host "   - firebase-debug.log غير موجود" -ForegroundColor Gray
}

$firebaseLogFiles = Get-ChildItem "firebase-debug.*.log" -ErrorAction SilentlyContinue
if ($firebaseLogFiles) {
    Write-Host "   - حذف firebase-debug.*.log" -ForegroundColor Red
    Remove-Item "firebase-debug.*.log" -Force
} else {
    Write-Host "   - firebase-debug.*.log غير موجود" -ForegroundColor Gray
}

Write-Host "6. حذف ملفات OS المؤقتة..." -ForegroundColor Blue
if (Test-Path ".DS_Store") {
    Write-Host "   - حذف .DS_Store" -ForegroundColor Red
    Remove-Item ".DS_Store" -Force
} else {
    Write-Host "   - .DS_Store غير موجود" -ForegroundColor Gray
}

if (Test-Path "Thumbs.db") {
    Write-Host "   - حذف Thumbs.db" -ForegroundColor Red
    Remove-Item "Thumbs.db" -Force
} else {
    Write-Host "   - Thumbs.db غير موجود" -ForegroundColor Gray
}

Write-Host "7. حذف ملفات Editor المؤقتة..." -ForegroundColor Blue
$swpFiles = Get-ChildItem "*.swp" -ErrorAction SilentlyContinue
if ($swpFiles) {
    Write-Host "   - حذف *.swp" -ForegroundColor Red
    Remove-Item "*.swp" -Force
} else {
    Write-Host "   - *.swp غير موجود" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ تم تنظيف الملفات المؤقتة بنجاح!" -ForegroundColor Green
Write-Host "🔒 ملفات Git محفوظة وآمنة" -ForegroundColor Green
Write-Host "📊 يمكنك الآن تشغيل المشروع بـ: npm run dev" -ForegroundColor Cyan
Write-Host ""

Read-Host "اضغط Enter للمتابعة"
