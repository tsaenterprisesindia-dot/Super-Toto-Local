@echo off
REM Super Toto Local — persistent server launcher.
REM Keeps the server running and restarts it if it crashes.
REM Double-click this file or run: cmd /c "H:\Super Toto Local\server\start-server.bat"

cd /d "H:\Super Toto Local\server"
:loop
echo [%date% %time%] Starting server...
"C:\Program Files\nodejs\node.exe" "src\index.js"
echo [%date% %time%] Server exited. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
