@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title Markdown-to-Video Render

:: Locate project root (this script is in <root>\scripts\)
set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%"
set "ROOT_DIR=%CD%"
popd
cd /d "%ROOT_DIR%"

:: Usage
if "%~1"=="" (
    echo.
    echo Usage:
    echo   scripts\render-video.bat ^<input.md^> [output.mp4]
    echo.
    echo Examples:
    echo   scripts\render-video.bat examples\published\001-llm-wiki-karpathy-zh.md
    echo   scripts\render-video.bat examples\published\001-llm-wiki-karpathy-zh.md dist\001.mp4
    echo   npm run video:render:win -- examples\published\001-llm-wiki-karpathy-zh.md
    echo.
    echo Defaults:
    echo   - Uses qwen-local TTS provider
    echo   - Output to dist\^<markdown-basename^>.mp4 if not specified
    echo   - Auto-detects .venv-qwen\Scripts\python.exe
    echo   - Uses CUDA acceleration if NVIDIA GPU available
    echo.
    echo Environment overrides:
    echo   TTS_PROVIDER=system^|qwen-local
    echo   QWEN_PYTHON=path\to\python.exe
    echo   QWEN_TTS_DEVICE=cpu^|cuda:0
    echo   QWEN_TTS_DTYPE=float32^|float16^|bfloat16
    echo.
    exit /b 1
)

set "INPUT_PATH=%~1"
set "OUTPUT_PATH=%~2"

:: Check input file
if not exist "%INPUT_PATH%" (
    echo [error] Markdown file not found: %INPUT_PATH%
    exit /b 1
)

:: Default output path
if "%OUTPUT_PATH%"=="" (
    for %%F in ("%INPUT_PATH%") do set "BASENAME=%%~nF"
    set "OUTPUT_PATH=dist\!BASENAME!.mp4"
)

:: Auto-detect Python
if "%QWEN_PYTHON%"=="" (
    if exist "%ROOT_DIR%\.venv-qwen\Scripts\python.exe" (
        set "QWEN_PYTHON=%ROOT_DIR%\.venv-qwen\Scripts\python.exe"
    )
)

:: Default TTS Provider
if "%TTS_PROVIDER%"=="" set "TTS_PROVIDER=qwen-local"

:: On Windows, let the system auto-detect CUDA
if "%QWEN_TTS_DEVICE%"=="" set "QWEN_TTS_DEVICE=auto"
if "%QWEN_TTS_DTYPE%"=="" set "QWEN_TTS_DTYPE=auto"

:: Qwen Doctor
if "%TTS_PROVIDER%"=="qwen-local" (
    echo [render-video] Checking Qwen3-TTS environment ...
    call npm run qwen:doctor
    if !ERRORLEVEL! neq 0 (
        echo [error] Qwen3-TTS check failed. Run install-win.bat first.
        exit /b 1
    )
)

echo.
echo [render-video] Starting render
echo   input : %INPUT_PATH%
echo   output: %OUTPUT_PATH%
echo   tts   : %TTS_PROVIDER%
if "%TTS_PROVIDER%"=="qwen-local" (
    echo   device: %QWEN_TTS_DEVICE%
    echo   dtype : %QWEN_TTS_DTYPE%
)
echo.

call npm run render:md -- "%INPUT_PATH%" "%OUTPUT_PATH%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo [render-video] Done: %OUTPUT_PATH%
) else (
    echo.
    echo [render-video] Render failed. Check the log above.
)
