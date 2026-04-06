@echo off
chcp 65001 >nul 2>&1
title Markdown-to-Video 一键安装
echo.
echo =============================================
echo   Markdown-to-Video  Windows 一键安装
echo =============================================
echo.

:: 检查 PowerShell 是否可用
where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 PowerShell，请确保系统中安装了 PowerShell。
    pause
    exit /b 1
)

:: 用 PowerShell 执行安装脚本
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\win-setup.ps1" %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo [提示] 安装过程中遇到错误，请检查上方日志。
)

echo.
pause
