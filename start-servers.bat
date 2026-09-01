@echo off
cd /d "H:\Super Toto Local\server"

echo Starting Super Toto Local servers...
echo.

REM Kill any existing node processes on our ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1

REM Start API server in background
start "SuperToto-API" /MIN "C:\Program Files\nodejs\node.exe" "src\index.js"
echo [%time%] API server started on port 5000

REM Wait for server to be ready
timeout /t 10 /nobreak >nul

REM Start Vite dev server in background  
cd /d "H:\Super Toto Local\client"
start "SuperToto-Web" /MIN "C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev
echo [%time%] Vite dev server started on port 5173

echo.
echo Both servers are running!
echo   Web:    http://localhost:5173
echo   API:    http://localhost:5000
echo.
echo Close this window or press Ctrl+C to stop.
pause
