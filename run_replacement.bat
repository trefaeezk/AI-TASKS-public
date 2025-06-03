@echo off
echo ========================================
echo    Pattern Replacement Script
echo ========================================
echo.

echo Step 1: Checking for old patterns...
python check_patterns.py
echo.

echo Do you want to continue with replacement?
echo This will replace all old patterns with new ones
echo Make sure to backup your project before continuing
echo.
set /p choice="Type 'y' to continue or anything else to cancel: "

if /i "%choice%"=="y" (
    echo.
    echo Step 2: Applying replacements...
    python replace_old_patterns.py
    echo.
    echo Replacement completed!
    echo Make sure to test the application
) else (
    echo.
    echo Replacement cancelled
)

echo.
pause
