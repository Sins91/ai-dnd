@echo off
setlocal
cd /d "%~dp0"

title Local AI RPG - Development

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js and reopen this file.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [ERROR] Dependencies are not installed.
  echo Run npm install in this directory first.
  pause
  exit /b 1
)

echo Starting Local AI RPG in development mode...
echo Keep this window open while playing.
echo.

call npm.cmd run dev

echo.
echo The development process has stopped.
pause
