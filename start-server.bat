@echo off
REM Super Toto Local - always-on server launcher.
REM Frees port 5001, clears any stale database lock, then runs the server in a
REM restart loop so it keeps running even if it crashes or is closed.
REM Started by the "SuperToto Local Server" scheduled task (see README).
setlocal
set ROOT=%~dp0
set NODE=C:\Program Files\nodejs\node.exe

:loop
REM Free port 5001 if a previous instance is still listening.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":5001 " ^| findstr LISTENING') do taskkill /PID %%P /F >nul 2>&1

REM Clear any orphaned mongod holding the .data\db lock.
for /f "tokens=2" %%M in ('tasklist /FI "IMAGENAME eq mongod-x64-win32-7.0.24.exe" /NH 2^>nul ^| findstr /I "mongod"') do taskkill /PID %%M /F >nul 2>&1

cd /d "%ROOT%server"
if not exist "%ROOT%client\dist\index.html" echo [start-server] WARNING: client\dist not built - run start-app.bat once first.

set NODE_ENV=production
set ALLOW_DEMO_LOGIN=1
"%NODE%" src\index.js
echo [start-server] server exited (code %errorlevel%). Restarting in 5s...
ping -n 6 127.0.0.1 >nul
goto loop
