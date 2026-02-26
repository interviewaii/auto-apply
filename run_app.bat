@echo off
echo ===================================================
echo      Starting JobReach Application
echo ===================================================

:: Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed on this computer!
    echo Please download and install Node.js from https://nodejs.org/
    echo then try again.
    pause
    exit /b
)

echo [Step 1/3] Checking dependencies...
if not exist "node_modules" (
    echo node_modules not found. Installing...
    call npm install
) else (
    echo Dependencies found. Skipping install.
)

echo [Step 2/3] Verifying Chrome Browser...
call npx puppeteer browsers install chrome

echo [Step 3/3] Launching App...
echo If it closes immediately, there was an error.
echo.

call npm run ui

pause
