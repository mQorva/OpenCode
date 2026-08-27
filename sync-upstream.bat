@echo off
setlocal
cd /d "%~dp0"

if not "%~1"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sync-Upstream.ps1" %*
    goto :end
)

:menu
cls
echo ==========================================
echo   OpenCode - mQorva Edition: Upstream-Sync
echo ==========================================
echo.
echo  [1] Updates aus OpenCode holen (-Update)
echo  [2] Stand auf GitHub sichern   (-Backup)
echo  [3] Status pruefen             (-Status)
echo  [4] Beenden
echo.
set /p choice="Waehle eine Option (1-4): "

if "%choice%"=="1" (
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sync-Upstream.ps1" -Update
    echo.
    pause
    goto :end
)
if "%choice%"=="2" (
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sync-Upstream.ps1" -Backup
    echo.
    pause
    goto :end
)
if "%choice%"=="3" (
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Sync-Upstream.ps1" -Status
    echo.
    pause
    goto :menu
)
if "%choice%"=="4" (
    goto :end
)

echo Ungueltige Auswahl.
timeout /t 2 >nul
goto :menu

:end
endlocal
