@echo off
REM Super Toto Local - dev launcher (server + vite). Double-click after reboot/Power reset.
set ROOT=%~dp0

start "STL-API" cmd /c "cd /d "%ROOT%server" && "C:\Program Files\nodejs\node.exe" src\index.js > "%TEMP%\stl-server.log" 2>&1"
start "STL-Web" cmd /c "cd /d "%ROOT%client" && "C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev > "%TEMP%\stl-vite.log" 2>&1"

echo Super Toto Local started.
echo   API :  http://localhost:5000
echo   App :  http://localhost:5173
echo Logs: %TEMP%\stl-server.log and %TEMP%\stl-vite.log
timeout /t 3 >nul