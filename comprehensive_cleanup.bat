@echo off
echo ========================================
echo    Comprehensive Pattern Cleanup
echo ========================================
echo.

echo Step 1: Finding remaining old patterns...
python find_old_patterns.py
echo.

echo This will perform comprehensive cleanup:
echo - Remove all old role patterns (admin, owner, system_owner, etc.)
echo - Replace with new is* patterns (isSystemOwner, isOrgAdmin, etc.)
echo - Remove deprecated compatibility code
echo - Clean up empty lines and formatting
echo.
echo WARNING: This will make extensive changes to your codebase!
echo Make sure you have a backup before proceeding.
echo.
set /p choice="Type 'CLEANUP' to proceed or anything else to cancel: "

if /i "%choice%"=="CLEANUP" (
    echo.
    echo Step 2: Performing comprehensive cleanup...
    python comprehensive_cleanup.py
    echo.
    echo Step 3: Verifying cleanup results...
    python find_old_patterns.py
    echo.
    echo Comprehensive cleanup completed!
    echo Please test your application thoroughly.
) else (
    echo.
    echo Cleanup cancelled - no changes made
)

echo.
pause
