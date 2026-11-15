@echo off
rem Opens the web app for a playtest (ADR 0020): starts the dev server if it is not running, then opens the app in
rem a full-screen Edge app window. Not Edge kiosk mode: kiosk mode is InPrivate and would lose the pictures.
setlocal
cd /d "%~dp0.."
set "URL=http://localhost:5173/"
set "PROFILE=%LOCALAPPDATA%\CrayonBox\EdgePlaytest"

call :probe
if errorlevel 1 (
  echo Starting the dev server...
  start "Crayon Box dev server" /min cmd /c "npm run dev"
  powershell -NoProfile -Command "$end=(Get-Date).AddSeconds(45); while((Get-Date) -lt $end){ try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%' | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 500 } }; exit 1"
  if errorlevel 1 (
    echo The dev server did not start. Run "npm run dev" in this folder to see why.
    pause
    exit /b 1
  )
)

start "" msedge --app=%URL% --start-fullscreen --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check
exit /b 0

:probe
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%' | Out-Null; exit 0 } catch { exit 1 }"
exit /b %errorlevel%
