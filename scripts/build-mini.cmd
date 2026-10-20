@echo off
rem Build the WeChat mini program (does not rely on "powershell" being in PATH).
rem Usage: double-click this file, or run  scripts\build-mini.cmd
setlocal
cd /d "%~dp0.."

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo Windows PowerShell not found. Run manually:
  echo   cd apps\uni-mobile
  echo   npm run build:mp-weixin
  pause
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-mini.ps1"
set "CODE=%ERRORLEVEL%"

echo.
if "%CODE%"=="0" (
  echo [OK] Build finished. Press Ctrl+B in WeChat DevTools to reload.
) else (
  echo [FAIL] Exit code %CODE% - see errors above.
)
pause
exit /b %CODE%
