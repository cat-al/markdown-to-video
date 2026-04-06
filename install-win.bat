@echo off
chcp 65001 >nul 2>&1
title Markdown-to-Video  Windows Setup
echo.
echo =============================================
echo   Markdown-to-Video  Windows Setup
echo =============================================
echo.

:: Check PowerShell
where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PowerShell not found. Please install PowerShell first.
    pause
    exit /b 1
)

:: Run PowerShell with explicit UTF-8 encoding
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::InputEncoding=[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; & '%~dp0scripts\win-setup.ps1' %*"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [INFO] Setup encountered errors. Check the log above.
)

echo.
pause
