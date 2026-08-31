@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing packages... (first time only)
  call npm install
)
call npm run dev -- --open
pause
