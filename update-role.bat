@echo off
echo تحديث دور المستخدم...

REM استبدل TOKEN_HERE برمز المصادقة الخاص بك
REM استبدل USER_ID_HERE بمعرف المستخدم الذي كتبته في الترمنال

curl -X POST ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer TOKEN_HERE" ^
  -d "{\"uid\":\"USER_ID_HERE\",\"role\":\"engineer\"}" ^
  https://us-central1-tasks-intelligence.cloudfunctions.net/updateUserRoleHttp

echo.
echo تم الانتهاء من العملية.
pause
