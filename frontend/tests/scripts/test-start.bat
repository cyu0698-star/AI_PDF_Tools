@echo off
echo ========================================
echo    Test Script
echo ========================================
echo.

cd /d "%~dp0"
echo Directory: %CD%
echo.

echo Checking Node.js...
node --version
if errorlevel 1 (
    echo Node.js NOT found!
) else (
    echo Node.js OK
)
echo.

echo Checking npm...
npm --version
if errorlevel 1 (
    echo npm NOT found!
) else (
    echo npm OK
)
echo.

echo Checking package.json...
if exist "package.json" (
    echo package.json found
) else (
    echo package.json NOT found!
)
echo.

echo Checking node_modules...
if exist "node_modules" (
    echo node_modules found
) else (
    echo node_modules NOT found - need to run npm install
)
echo.

echo ========================================
echo    Test complete
echo ========================================
echo.
pause
