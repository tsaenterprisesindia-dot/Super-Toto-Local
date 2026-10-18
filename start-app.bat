@echo off
REM Super Toto Local - single-URL mode.
REM Builds the web app (if needed) and serves the API + built frontend together
REM at http://localhost:5001 (runs the server with NODE_ENV=production).
REM Use start-dev.bat instead if you want hot-reload during development.
setlocal
set ROOT=%~dp0
set NODE=C:\Program Files\nodejs\node.exe
cd /d "%ROOT%"

REM Free port 5001 if a previous instance is still running.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":5001 " ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>&1

if /i "%~1"=="rebuild" goto build
if not exist "client\dist\index.html" goto build
goto run

:build
echo Building the web app...
"%NODE%" client\build.mjs build
if errorlevel 1 (echo. & echo Build failed - see the output above. & pause & exit /b 1)

:run
echo.
echo Starting Super Toto Local - open http://localhost:5001
echo Press Ctrl+C to stop (data is saved to server\.data).
echo.
set NODE_ENV=production
set ALLOW_DEMO_LOGIN=1
cd /d "%ROOT%server"
"%NODE%" src\index.js
