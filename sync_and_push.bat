@echo off
echo ==========================================
echo      SST Auto-Sync and Push Script
echo ==========================================

echo [1/4] Pulling latest changes from remote...
git pull origin main
if %errorlevel% neq 0 (
    echo Error: Pull failed. Please resolve conflicts manually.
    pause
    exit /b %errorlevel%
)

echo [2/4] Adding all changes...
git add .

echo [3/4] Committing with auto-generated message...
:: Get timestamp for commit message
set "timestamp=%date% %time%"
git commit -m "Auto-sync: %timestamp%"

echo [4/4] Pushing to main...
git push origin main

echo ==========================================
echo               Done!
echo ==========================================
pause
