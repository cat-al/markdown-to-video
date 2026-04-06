# -*- coding: utf-8 -*-
# ============================================================
#  Markdown-to-Video  Windows Setup Script
#  Steps: Check env -> Mirror -> Select model -> Install -> Download
# ============================================================
param()

# Force UTF-8 output so Chinese characters display correctly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Markdown-to-Video Setup"

# Locate project root (this script lives in <root>/scripts/)
$ROOT_DIR = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..")).Path
Set-Location $ROOT_DIR

# ============================================================
#  Helper functions
# ============================================================
function Write-Title { param([string]$Text)
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step { param([string]$Text)
    Write-Host "[*] $Text" -ForegroundColor Green
}

function Write-Warn { param([string]$Text)
    Write-Host "[!] $Text" -ForegroundColor Yellow
}

function Write-Err { param([string]$Text)
    Write-Host "[x] $Text" -ForegroundColor Red
}

function Write-Info { param([string]$Text)
    Write-Host "    $Text" -ForegroundColor Gray
}

function Test-CommandExists { param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# ============================================================
#  Step 1: System environment check
# ============================================================
Write-Title "Step 1/9: System Environment Check"

$allOk = $true

# --- Node.js ---
Write-Step "Checking Node.js ..."
if (Test-CommandExists "node") {
    $nodeVer = (node --version 2>&1).ToString().Trim()
    $nodeMajor = [int]($nodeVer -replace "^v","" -split "\.")[0]
    Write-Info "Node.js: $nodeVer"
    if ($nodeMajor -lt 18) {
        Write-Warn "Node.js >= 18 recommended. Current: $nodeVer"
        $allOk = $false
    }
} else {
    Write-Err "Node.js not found! Install Node.js 18+ from https://nodejs.org"
    $allOk = $false
}

# --- npm ---
Write-Step "Checking npm ..."
if (Test-CommandExists "npm") {
    $npmVer = (npm --version 2>&1).ToString().Trim()
    Write-Info "npm: $npmVer"
} else {
    Write-Err "npm not found! It usually comes with Node.js."
    $allOk = $false
}

# --- Python ---
Write-Step "Checking Python ..."
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    if (Test-CommandExists $cmd) {
        try {
            $pyVer = & $cmd --version 2>&1 | Select-Object -First 1
            $pyVerStr = $pyVer.ToString().Trim()
            $pyMajor = [int](($pyVerStr -replace "Python\s*","") -split "\.")[0]
            $pyMinor = [int](($pyVerStr -replace "Python\s*","") -split "\.")[1]
            if ($pyMajor -ge 3 -and $pyMinor -ge 9) {
                $pythonCmd = $cmd
                Write-Info "Python: $pyVerStr (cmd: $cmd)"
                break
            }
        } catch {}
    }
}
if (-not $pythonCmd) {
    Write-Err "Python 3.9+ not found! Install from https://www.python.org/downloads/"
    Write-Info "IMPORTANT: Check 'Add Python to PATH' during installation"
    $allOk = $false
}

# --- Git ---
Write-Step "Checking Git ..."
if (Test-CommandExists "git") {
    $gitVer = (git --version 2>&1).ToString().Trim()
    Write-Info "Git: $gitVer"
} else {
    Write-Warn "Git not found. Required for model download."
    Write-Info "Install from https://git-scm.com/download/win"
}

# --- Git LFS ---
Write-Step "Checking Git LFS ..."
if (Test-CommandExists "git") {
    try {
        $lfsVer = git lfs version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Git LFS: $($lfsVer.ToString().Trim())"
        } else {
            Write-Warn "Git LFS not installed. Run: git lfs install"
        }
    } catch {
        Write-Warn "Git LFS check failed"
    }
} else {
    Write-Warn "Git not installed, skipping Git LFS check"
}

# --- ffmpeg / ffprobe ---
Write-Step "Checking ffprobe ..."
if (Test-CommandExists "ffprobe") {
    Write-Info "ffprobe: OK"
} else {
    Write-Warn "ffprobe not found. Audio duration detection may be limited."
    Write-Info "Install ffmpeg from https://ffmpeg.org/download.html and add to PATH"
}

# --- NVIDIA GPU ---
Write-Step "Checking NVIDIA GPU (CUDA) ..."
$hasCuda = $false
if (Test-CommandExists "nvidia-smi") {
    try {
        $gpuInfo = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Info "GPU: $($gpuInfo.ToString().Trim())"
            Write-Info "NVIDIA GPU detected - TTS will use CUDA acceleration"
            $hasCuda = $true
        }
    } catch {
        Write-Info "nvidia-smi failed, will use CPU"
    }
} else {
    Write-Info "No NVIDIA GPU detected. TTS will use CPU (slower but works fine)"
}

# --- Memory ---
Write-Step "Checking system memory ..."
$totalMem = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Write-Info "Total RAM: ${totalMem} GB"
if ($totalMem -lt 8) {
    Write-Warn "8GB+ RAM recommended. 0.6B model needs ~3GB, 1.7B needs ~6GB."
}

# --- Disk space ---
Write-Step "Checking disk space ..."
$drive = (Get-Item $ROOT_DIR).PSDrive
$freeGB = [math]::Round($drive.Free / 1GB, 1)
Write-Info "Free space: ${freeGB} GB (Drive: $($drive.Name):)"
if ($freeGB -lt 10) {
    Write-Warn "Less than 10GB free. Recommend 15GB+ for models + deps + output."
}

Write-Host ""
if (-not $allOk) {
    Write-Err "Required dependencies missing. Please fix the issues above and re-run."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Step "Environment check passed!"

# ============================================================
#  Step 2: Configure mirror acceleration
# ============================================================
Write-Title "Step 2/9: Mirror Acceleration (China)"

# npm - Taobao mirror
Write-Step "Setting npm registry (npmmirror.com) ..."
npm config set registry https://registry.npmmirror.com
Write-Info "npm registry => https://registry.npmmirror.com"

# pip - Tsinghua mirror
Write-Step "Setting pip mirror (tuna.tsinghua.edu.cn) ..."
$pipConfDir = Join-Path $env:APPDATA "pip"
if (-not (Test-Path $pipConfDir)) { New-Item -ItemType Directory -Path $pipConfDir -Force | Out-Null }
$pipConfFile = Join-Path $pipConfDir "pip.ini"
$pipContent = @"
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
"@
[System.IO.File]::WriteAllText($pipConfFile, $pipContent, [System.Text.Encoding]::UTF8)
Write-Info "pip index => https://pypi.tuna.tsinghua.edu.cn/simple"

# PyTorch mirror
Write-Step "PyTorch CUDA mirror (SJTU) prepared for later use"
$TORCH_INDEX_URL = "https://download.pytorch.org/whl/cu121"
$TORCH_INDEX_URL_CN = "https://mirror.sjtu.edu.cn/pytorch-wheels/cu121"
Write-Info "PyTorch mirror: $TORCH_INDEX_URL_CN"

# ModelScope
Write-Step "Model download will use ModelScope (modelscope.cn)"
Write-Info "Avoids slow downloads from overseas HuggingFace"

# ============================================================
#  Step 3: Select TTS model
# ============================================================
Write-Title "Step 3/9: Select Qwen3-TTS Model"

Write-Host "  Available models:" -ForegroundColor White
Write-Host ""
Write-Host "  [1] 0.6B (Recommended)" -ForegroundColor Green
Write-Host "      Qwen3-TTS-12Hz-0.6B-CustomVoice" -ForegroundColor Gray
Write-Host "      Size: ~1.7 GB  |  VRAM: ~3 GB  |  Speed: Fast" -ForegroundColor Gray
Write-Host "      Best for: 8GB+ RAM / 4GB+ VRAM / quick rendering" -ForegroundColor Gray
Write-Host ""
Write-Host "  [2] 1.7B (Higher quality)" -ForegroundColor Yellow
Write-Host "      Qwen3-TTS-12Hz-1.7B-CustomVoice" -ForegroundColor Gray
Write-Host "      Size: ~4.8 GB  |  VRAM: ~6 GB  |  Speed: Slower" -ForegroundColor Gray
Write-Host "      Best for: 16GB+ RAM / 8GB+ VRAM / best audio quality" -ForegroundColor Gray
Write-Host ""

$modelChoice = Read-Host "Select model (1 or 2, default 1)"
if ([string]::IsNullOrWhiteSpace($modelChoice)) { $modelChoice = "1" }

switch ($modelChoice) {
    "2" {
        $MODEL_REPO = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
        $MODEL_DIR_NAME = "Qwen3-TTS-12Hz-1.7B-CustomVoice"
        $MODEL_SCOPE_URL = "https://www.modelscope.cn/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice.git"
        Write-Step "Selected: 1.7B model"
    }
    default {
        $MODEL_REPO = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
        $MODEL_DIR_NAME = "Qwen3-TTS-12Hz-0.6B-CustomVoice"
        $MODEL_SCOPE_URL = "https://www.modelscope.cn/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice.git"
        Write-Step "Selected: 0.6B model (recommended)"
    }
}

$MODEL_LOCAL_PATH = Join-Path $ROOT_DIR ".models" $MODEL_DIR_NAME

# ============================================================
#  Step 4: Install Node.js dependencies
# ============================================================
Write-Title "Step 4/9: Install Node.js Dependencies"

Write-Step "Running npm install ..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed. Check network or Node.js version."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Step "Node.js dependencies installed"

# ============================================================
#  Step 5: Create Python venv and install packages
# ============================================================
Write-Title "Step 5/9: Python Environment Setup"

$VENV_DIR = Join-Path $ROOT_DIR ".venv-qwen"
$VENV_PYTHON = Join-Path $VENV_DIR "Scripts" "python.exe"
$VENV_PIP = Join-Path $VENV_DIR "Scripts" "pip.exe"

if (Test-Path $VENV_PYTHON) {
    Write-Step "Python venv already exists: $VENV_DIR"
} else {
    Write-Step "Creating Python virtual environment ..."
    & $pythonCmd -m venv $VENV_DIR
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to create virtual environment"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Info "Venv path: $VENV_DIR"
}

# Upgrade pip
Write-Step "Upgrading pip ..."
& $VENV_PYTHON -m pip install --upgrade pip -q

# Install PyTorch based on GPU availability
if ($hasCuda) {
    Write-Step "NVIDIA GPU detected - installing CUDA PyTorch ..."
    Write-Info "Using SJTU mirror: $TORCH_INDEX_URL_CN"
    & $VENV_PIP install torch torchaudio --index-url $TORCH_INDEX_URL_CN -q
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Mirror install failed, trying official source ..."
        & $VENV_PIP install torch torchaudio --index-url $TORCH_INDEX_URL -q
    }
} else {
    Write-Step "No NVIDIA GPU - installing CPU PyTorch ..."
    & $VENV_PIP install torch torchaudio -q
}

# Install qwen-tts + soundfile
Write-Step "Installing qwen-tts and soundfile ..."
& $VENV_PIP install -r (Join-Path $ROOT_DIR "requirements-qwen.txt") -q
if ($LASTEXITCODE -ne 0) {
    Write-Err "Python dependency installation failed"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Step "Python environment ready"

# ============================================================
#  Step 6: Download TTS model
# ============================================================
Write-Title "Step 6/9: Download TTS Model"

$modelsDir = Join-Path $ROOT_DIR ".models"
if (-not (Test-Path $modelsDir)) { New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null }

if (Test-Path (Join-Path $MODEL_LOCAL_PATH "model.safetensors")) {
    Write-Step "Model already exists, skipping: $MODEL_LOCAL_PATH"
} else {
    if (-not (Test-CommandExists "git")) {
        Write-Err "Git not installed. Cannot download model."
        Read-Host "Press Enter to exit"
        exit 1
    }

    # Ensure Git LFS is initialized
    git lfs install 2>&1 | Out-Null

    Write-Step "Downloading model from ModelScope ($MODEL_DIR_NAME) ..."
    Write-Info "URL: $MODEL_SCOPE_URL"
    Write-Info "Target: $MODEL_LOCAL_PATH"
    Write-Info "This may take a while for large model files ..."

    if (Test-Path (Join-Path $MODEL_LOCAL_PATH ".git")) {
        Write-Info "Existing git repo found, pulling updates ..."
        git -C $MODEL_LOCAL_PATH pull
        git -C $MODEL_LOCAL_PATH lfs pull
    } else {
        git clone $MODEL_SCOPE_URL $MODEL_LOCAL_PATH
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Err "Model download failed. Check your network connection."
        Write-Info "You can also download manually and place in: $MODEL_LOCAL_PATH"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Step "Model download complete!"
}

# ============================================================
#  Step 7: Verify Qwen3-TTS environment
# ============================================================
Write-Title "Step 7/9: Verify Qwen3-TTS"

Write-Step "Running Qwen environment check ..."
$env:QWEN_PYTHON = $VENV_PYTHON
& $VENV_PYTHON (Join-Path $ROOT_DIR "scripts" "qwen_tts_worker.py") --check
if ($LASTEXITCODE -eq 0) {
    Write-Step "Qwen3-TTS environment verified!"
} else {
    Write-Warn "Verification incomplete, but this won't block installation"
    Write-Info "Run later: npm run qwen:doctor"
}

# ============================================================
#  Step 8: Generate shortcut scripts
# ============================================================
Write-Title "Step 8/9: Generate Shortcut Scripts"

# --- render-video.bat (root convenience script) ---
$renderBat = Join-Path $ROOT_DIR "render-video.bat"
$renderContent = @"
@echo off
chcp 65001 >nul 2>&1
title Markdown-to-Video Render

set "ROOT_DIR=%~dp0"
set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"

set "QWEN_PYTHON=%ROOT_DIR%\.venv-qwen\Scripts\python.exe"
set "TTS_PROVIDER=qwen-local"
set "QWEN_TTS_MODEL=$MODEL_REPO"

if not exist "%QWEN_PYTHON%" (
    echo [error] Python venv not found. Run install-win.bat first.
    pause
    exit /b 1
)

if "%~1"=="" (
    echo.
    echo Usage: render-video.bat ^<input.md^> [output.mp4]
    echo.
    echo Examples:
    echo   render-video.bat examples\demo\demo.md
    echo   render-video.bat examples\published\001-llm-wiki-karpathy-zh.md dist\out.mp4
    echo.
    pause
    exit /b 0
)

echo [render-video] Starting render ...
echo   input : %~1
echo   output: %~2
echo   model : $MODEL_REPO

npm run render:md -- "%~1" "%~2"
pause
"@
[System.IO.File]::WriteAllText($renderBat, $renderContent, [System.Text.Encoding]::UTF8)

# --- start-studio.bat ---
$studioBat = Join-Path $ROOT_DIR "start-studio.bat"
$studioContent = @"
@echo off
chcp 65001 >nul 2>&1
title Remotion Studio

set "ROOT_DIR=%~dp0"
set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"

set "QWEN_PYTHON=%ROOT_DIR%\.venv-qwen\Scripts\python.exe"
set "TTS_PROVIDER=qwen-local"
set "QWEN_TTS_MODEL=$MODEL_REPO"

echo [studio] Starting Remotion Studio ...
echo [studio] Python: %QWEN_PYTHON%
echo.

npm run dev

pause
"@
[System.IO.File]::WriteAllText($studioBat, $studioContent, [System.Text.Encoding]::UTF8)

Write-Step "Shortcut scripts created:"
Write-Info "  render-video.bat  - Render Markdown to video"
Write-Info "  start-studio.bat  - Launch Remotion Studio preview"

# ============================================================
#  Step 9: Generate .env config
# ============================================================
Write-Title "Step 9/9: Generate Configuration"

$envFile = Join-Path $ROOT_DIR ".env"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$deviceVal = if ($hasCuda) { "auto" } else { "cpu" }
$dtypeVal  = if ($hasCuda) { "auto" } else { "float32" }
$envContent = @"
# Markdown-to-Video Windows Configuration
# Auto-generated by install-win.bat at $timestamp

# TTS engine
TTS_PROVIDER=qwen-local

# Python path (virtual environment)
QWEN_PYTHON=$VENV_PYTHON

# TTS model
QWEN_TTS_MODEL=$MODEL_REPO

# Device config (auto = CUDA if available, otherwise cpu)
QWEN_TTS_DEVICE=$deviceVal
QWEN_TTS_DTYPE=$dtypeVal
"@
[System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.Encoding]::UTF8)
Write-Step "Config saved to: .env"

# ============================================================
#  Done
# ============================================================
Write-Title "Installation Complete!"

Write-Host "  Installed:" -ForegroundColor White
Write-Host "    - Node.js dependencies (npm install)" -ForegroundColor Gray
Write-Host "    - Python venv (.venv-qwen)" -ForegroundColor Gray
Write-Host "    - Qwen3-TTS model ($MODEL_DIR_NAME)" -ForegroundColor Gray
Write-Host "    - npm / pip China mirror acceleration" -ForegroundColor Gray
Write-Host "    - Shortcut scripts" -ForegroundColor Gray
Write-Host ""
Write-Host "  Quick Start:" -ForegroundColor White
Write-Host ""
Write-Host "    1. Preview:  double-click start-studio.bat" -ForegroundColor Green
Write-Host "    2. Render:   render-video.bat examples\demo\demo.md" -ForegroundColor Green
Write-Host "    3. Doctor:   npm run qwen:doctor" -ForegroundColor Green
Write-Host ""
Write-Host "  CLI usage:" -ForegroundColor White
Write-Host ""
Write-Host "    set QWEN_PYTHON=$VENV_PYTHON" -ForegroundColor DarkGray
Write-Host "    npm run render:md -- examples\demo\demo.md dist\demo.mp4" -ForegroundColor DarkGray
Write-Host ""

Read-Host "Press Enter to exit"
