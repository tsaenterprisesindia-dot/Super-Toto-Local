@echo off
REM Super Toto Local - start the API (5001) and Vite dev server (5174).
REM Chosen so both run alongside TriVista GST ERP (API 5000 / dev 5173).
set ROOT=%~dp0

REM Stop any previous Super Toto instances on our ports (does not touch 5000/5173).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":5001 " ^| findstr LISTENING') do taskkill /f /pid %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":5174 " ^| findstr LISTENING') do taskkill /f /pid %%p >nul 2>&1

echo Starting Super Toto Local API on 5001...
start "STL-API" /min cmd /c "cd /d "%ROOT%server" && "C:\Program Files\nodejs\node.exe" src\index.js > "%TEMP%\stl-server.log" 2>&1"

echo Waiting for the API to seed...
for /l %%i in (1,1,45) do (
  timeout /t 1 /nobreak >nul
  netstat -ano | findstr /C:":5001 " | findstr LISTENING >nul 2>&1
  if not errorlevel 1 goto apiup
)
echo   API did not come up in time. See %TEMP%\stl-server.log
pause
exit /b 1

:apiup
echo Starting Super Toto Local web (Vite) on 5174...
start "STL-Web" /min cmd /c "cd /d "%ROOT%client" && "C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev > "%TEMP%\stl-vite.log" 2>&1"

echo.
echo Both Super Toto Local servers are running:
echo   App :  http://localhost:5174
echo   API :  http://localhost:5001
echo   Health: http://localhost:5001/api/health
echo.
echo Logs: %TEMP%\stl-server.log and %TEMP%\stl-vite.log
pause
