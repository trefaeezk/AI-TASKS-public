@echo off
echo تشغيل وظيفة Firebase Cloud Function...
firebase functions:shell < call-function.js
echo.
echo تم الانتهاء من العملية.
pause
