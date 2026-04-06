# ============================================================
#  Markdown-to-Video  Windows 一键安装脚本
#  功能：检查环境 → 更换镜像加速 → 安装依赖 → 下载模型
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Markdown-to-Video 安装向导"

$ROOT_DIR = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $PSScriptRoot "win-setup.ps1"))) {
    $ROOT_DIR = Split-Path -Parent $PSScriptRoot
}
# 如果脚本在 scripts/ 下，ROOT_DIR 就是项目根目录
$ROOT_DIR = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..")).Path
Set-Location $ROOT_DIR

# ============================================================
#  辅助函数
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

function Get-VersionString { param([string]$Command, [string]$Args_)
    try {
        $output = & $Command $Args_ 2>&1 | Select-Object -First 1
        return $output.ToString().Trim()
    } catch { return "未安装" }
}

# ============================================================
#  第一步：系统环境检查
# ============================================================
Write-Title "第一步：系统环境检查"

$allOk = $true

# --- Node.js ---
Write-Step "检查 Node.js ..."
if (Test-CommandExists "node") {
    $nodeVer = (node --version 2>&1).ToString().Trim()
    $nodeMajor = [int]($nodeVer -replace "^v","" -split "\.")[0]
    Write-Info "Node.js 版本: $nodeVer"
    if ($nodeMajor -lt 18) {
        Write-Warn "建议 Node.js >= 18，当前 $nodeVer 可能会出问题"
        $allOk = $false
    }
} else {
    Write-Err "未找到 Node.js！请先安装 Node.js 18+ (https://nodejs.org)"
    $allOk = $false
}

# --- npm ---
Write-Step "检查 npm ..."
if (Test-CommandExists "npm") {
    $npmVer = (npm --version 2>&1).ToString().Trim()
    Write-Info "npm 版本: $npmVer"
} else {
    Write-Err "未找到 npm！通常随 Node.js 一起安装。"
    $allOk = $false
}

# --- Python ---
Write-Step "检查 Python ..."
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
                Write-Info "Python: $pyVerStr (命令: $cmd)"
                break
            }
        } catch {}
    }
}
if (-not $pythonCmd) {
    Write-Err "未找到 Python 3.9+！请先安装 Python (https://www.python.org/downloads/)"
    Write-Info "安装时务必勾选 'Add Python to PATH'"
    $allOk = $false
}

# --- Git ---
Write-Step "检查 Git ..."
if (Test-CommandExists "git") {
    $gitVer = (git --version 2>&1).ToString().Trim()
    Write-Info "Git: $gitVer"
} else {
    Write-Warn "未找到 Git，模型下载功能需要 Git LFS 支持"
    Write-Info "请安装 Git (https://git-scm.com/download/win)"
}

# --- Git LFS ---
Write-Step "检查 Git LFS ..."
if (Test-CommandExists "git") {
    $lfsVer = git lfs version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Git LFS: $($lfsVer.ToString().Trim())"
    } else {
        Write-Warn "Git LFS 未安装。模型下载需要 Git LFS。"
        Write-Info "安装命令: git lfs install"
    }
} else {
    Write-Warn "Git 未安装，跳过 Git LFS 检查"
}

# --- ffmpeg / ffprobe ---
Write-Step "检查 ffmpeg / ffprobe ..."
if (Test-CommandExists "ffprobe") {
    Write-Info "ffprobe: 已安装"
} else {
    Write-Warn "ffprobe 未找到，音频时长检测可能受限"
    Write-Info "建议安装 ffmpeg (https://ffmpeg.org/download.html) 并加入 PATH"
}

# --- NVIDIA GPU ---
Write-Step "检查 NVIDIA GPU (CUDA) ..."
if (Test-CommandExists "nvidia-smi") {
    $gpuInfo = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Info "GPU: $($gpuInfo.ToString().Trim())"
        Write-Info "检测到 NVIDIA GPU，TTS 推理将默认使用 CUDA 加速"
    } else {
        Write-Info "nvidia-smi 执行失败，将回退到 CPU"
    }
} else {
    Write-Info "未检测到 NVIDIA GPU，TTS 推理将使用 CPU（速度较慢但完全可用）"
}

# --- 系统内存 ---
Write-Step "检查系统内存 ..."
$totalMem = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Write-Info "总内存: ${totalMem} GB"
if ($totalMem -lt 8) {
    Write-Warn "建议至少 8GB 内存。0.6B 模型约需 3GB，1.7B 模型约需 6GB。"
}

# --- 磁盘空间 ---
Write-Step "检查磁盘空间 ..."
$drive = (Get-Item $ROOT_DIR).PSDrive
$freeGB = [math]::Round($drive.Free / 1GB, 1)
Write-Info "可用空间: ${freeGB} GB (盘符: $($drive.Name):)"
if ($freeGB -lt 10) {
    Write-Warn "可用空间不足 10GB，建议至少预留 15GB（模型 + 依赖 + 视频产物）"
}

Write-Host ""
if (-not $allOk) {
    Write-Err "存在必要依赖缺失，请先解决上述问题后重新运行。"
    Read-Host "按回车退出"
    exit 1
}
Write-Step "环境检查通过！"

# ============================================================
#  第二步：更换 npm / pip 国内镜像加速
# ============================================================
Write-Title "第二步：更换镜像加速源"

# npm 淘宝镜像
Write-Step "设置 npm 国内镜像 (npmmirror.com) ..."
npm config set registry https://registry.npmmirror.com
Write-Info "npm registry => https://registry.npmmirror.com"

# pip 清华镜像
Write-Step "设置 pip 国内镜像 (tuna.tsinghua.edu.cn) ..."
$pipConfDir = Join-Path $env:APPDATA "pip"
if (-not (Test-Path $pipConfDir)) { New-Item -ItemType Directory -Path $pipConfDir -Force | Out-Null }
$pipConfFile = Join-Path $pipConfDir "pip.ini"
@"
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
"@ | Out-File -FilePath $pipConfFile -Encoding utf8
Write-Info "pip index => https://pypi.tuna.tsinghua.edu.cn/simple"

# PyTorch 国内镜像源（用于 CUDA 版本安装加速）
Write-Step "记录 PyTorch 国内镜像地址（安装时使用）..."
$TORCH_INDEX_URL = "https://download.pytorch.org/whl/cu121"
$TORCH_INDEX_URL_CN = "https://mirror.sjtu.edu.cn/pytorch-wheels/cu121"
Write-Info "PyTorch CUDA 镜像: $TORCH_INDEX_URL_CN"

# ModelScope 加速说明
Write-Step "模型下载将使用 ModelScope (modelscope.cn) 国内源"
Write-Info "避免 HuggingFace 海外下载慢的问题"

# ============================================================
#  第三步：选择 TTS 模型
# ============================================================
Write-Title "第三步：选择 Qwen3-TTS 模型"

Write-Host "  可选模型：" -ForegroundColor White
Write-Host ""
Write-Host "  [1] 0.6B (推荐)" -ForegroundColor Green
Write-Host "      模型: Qwen3-TTS-12Hz-0.6B-CustomVoice" -ForegroundColor Gray
Write-Host "      大小: ~1.7 GB  |  显存: ~3 GB  |  速度: 快" -ForegroundColor Gray
Write-Host "      适合: 内存 8GB+ / 显存 4GB+ / 快速出片" -ForegroundColor Gray
Write-Host ""
Write-Host "  [2] 1.7B (更高质量)" -ForegroundColor Yellow
Write-Host "      模型: Qwen3-TTS-12Hz-1.7B-CustomVoice" -ForegroundColor Gray
Write-Host "      大小: ~4.8 GB  |  显存: ~6 GB  |  速度: 较慢" -ForegroundColor Gray
Write-Host "      适合: 内存 16GB+ / 显存 8GB+ / 追求音质" -ForegroundColor Gray
Write-Host ""

$modelChoice = Read-Host "请选择模型 (1 或 2，默认 1)"
if ([string]::IsNullOrWhiteSpace($modelChoice)) { $modelChoice = "1" }

switch ($modelChoice) {
    "2" {
        $MODEL_REPO = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
        $MODEL_DIR_NAME = "Qwen3-TTS-12Hz-1.7B-CustomVoice"
        $MODEL_SCOPE_URL = "https://www.modelscope.cn/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice.git"
        Write-Step "已选择 1.7B 模型"
    }
    default {
        $MODEL_REPO = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
        $MODEL_DIR_NAME = "Qwen3-TTS-12Hz-0.6B-CustomVoice"
        $MODEL_SCOPE_URL = "https://www.modelscope.cn/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice.git"
        Write-Step "已选择 0.6B 模型（推荐）"
    }
}

$MODEL_LOCAL_PATH = Join-Path $ROOT_DIR ".models" $MODEL_DIR_NAME

# ============================================================
#  第四步：安装 Node.js 依赖
# ============================================================
Write-Title "第四步：安装 Node.js 依赖"

Write-Step "执行 npm install ..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install 失败，请检查网络或 Node.js 版本"
    Read-Host "按回车退出"
    exit 1
}
Write-Step "Node.js 依赖安装完成"

# ============================================================
#  第五步：创建 Python 虚拟环境并安装依赖
# ============================================================
Write-Title "第五步：创建 Python 环境"

$VENV_DIR = Join-Path $ROOT_DIR ".venv-qwen"
$VENV_PYTHON = Join-Path $VENV_DIR "Scripts" "python.exe"
$VENV_PIP = Join-Path $VENV_DIR "Scripts" "pip.exe"

if (Test-Path $VENV_PYTHON) {
    Write-Step "Python 虚拟环境已存在: $VENV_DIR"
} else {
    Write-Step "创建 Python 虚拟环境 ..."
    & $pythonCmd -m venv $VENV_DIR
    if ($LASTEXITCODE -ne 0) {
        Write-Err "创建虚拟环境失败"
        Read-Host "按回车退出"
        exit 1
    }
    Write-Info "虚拟环境: $VENV_DIR"
}

# 升级 pip
Write-Step "升级 pip ..."
& $VENV_PYTHON -m pip install --upgrade pip -q

# 检查是否有 CUDA GPU → 决定是否安装 CUDA 版 PyTorch
$hasCuda = Test-CommandExists "nvidia-smi"
if ($hasCuda) {
    $nvidiaOut = nvidia-smi --query-gpu=name --format=csv,noheader 2>&1
    $hasCuda = ($LASTEXITCODE -eq 0)
}

if ($hasCuda) {
    Write-Step "检测到 NVIDIA GPU，安装 CUDA 版 PyTorch ..."
    Write-Info "使用上海交大镜像加速: $TORCH_INDEX_URL_CN"
    & $VENV_PIP install torch torchaudio --index-url $TORCH_INDEX_URL_CN -q
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "从镜像安装失败，尝试官方源 ..."
        & $VENV_PIP install torch torchaudio --index-url $TORCH_INDEX_URL -q
    }
} else {
    Write-Step "未检测到 NVIDIA GPU，安装 CPU 版 PyTorch ..."
    & $VENV_PIP install torch torchaudio -q
}

# 安装 qwen-tts 和 soundfile
Write-Step "安装 qwen-tts 和 soundfile ..."
& $VENV_PIP install -r (Join-Path $ROOT_DIR "requirements-qwen.txt") -q
if ($LASTEXITCODE -ne 0) {
    Write-Err "Python 依赖安装失败"
    Read-Host "按回车退出"
    exit 1
}
Write-Step "Python 环境安装完成"

# ============================================================
#  第六步：下载 TTS 模型
# ============================================================
Write-Title "第六步：下载 TTS 模型"

$modelsDir = Join-Path $ROOT_DIR ".models"
if (-not (Test-Path $modelsDir)) { New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null }

if (Test-Path (Join-Path $MODEL_LOCAL_PATH "model.safetensors")) {
    Write-Step "模型已存在，跳过下载: $MODEL_LOCAL_PATH"
} else {
    if (-not (Test-CommandExists "git")) {
        Write-Err "Git 未安装，无法下载模型。请安装 Git 后重新运行。"
        Read-Host "按回车退出"
        exit 1
    }

    # 确保 Git LFS 已初始化
    git lfs install 2>&1 | Out-Null

    Write-Step "从 ModelScope 下载模型 ($MODEL_DIR_NAME) ..."
    Write-Info "源地址: $MODEL_SCOPE_URL"
    Write-Info "目标路径: $MODEL_LOCAL_PATH"
    Write-Info "模型较大，请耐心等待 ..."

    if (Test-Path (Join-Path $MODEL_LOCAL_PATH ".git")) {
        Write-Info "检测到已有 git 仓库，执行增量更新 ..."
        git -C $MODEL_LOCAL_PATH pull
        git -C $MODEL_LOCAL_PATH lfs pull
    } else {
        git clone $MODEL_SCOPE_URL $MODEL_LOCAL_PATH
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Err "模型下载失败，请检查网络连接"
        Write-Info "也可以手动下载后放到: $MODEL_LOCAL_PATH"
        Read-Host "按回车退出"
        exit 1
    }
    Write-Step "模型下载完成！"
}

# ============================================================
#  第七步：环境检查 (Qwen Doctor)
# ============================================================
Write-Title "第七步：验证 Qwen3-TTS 环境"

Write-Step "运行 Qwen 环境检查 ..."
$env:QWEN_PYTHON = $VENV_PYTHON
& $VENV_PYTHON (Join-Path $ROOT_DIR "scripts" "qwen_tts_worker.py") --check
if ($LASTEXITCODE -eq 0) {
    Write-Step "Qwen3-TTS 环境验证通过！"
} else {
    Write-Warn "环境检查未完全通过，但不影响后续安装"
    Write-Info "你可以稍后运行: npm run qwen:doctor 重新检查"
}

# ============================================================
#  第八步：生成 Windows 快捷启动脚本
# ============================================================
Write-Title "第八步：生成快捷启动脚本"

# --- render-video.bat ---
$renderBat = Join-Path $ROOT_DIR "render-video.bat"
@"
@echo off
chcp 65001 >nul 2>&1
title Markdown-to-Video 渲染

set ROOT_DIR=%~dp0
set ROOT_DIR=%ROOT_DIR:~0,-1%
cd /d "%ROOT_DIR%"

set QWEN_PYTHON=%ROOT_DIR%\.venv-qwen\Scripts\python.exe
set TTS_PROVIDER=qwen-local
set QWEN_TTS_MODEL=$MODEL_REPO

if exist "%QWEN_PYTHON%" (
    echo [info] Python: %QWEN_PYTHON%
) else (
    echo [error] 未找到 Python 虚拟环境，请先运行 install-win.bat
    pause
    exit /b 1
)

if "%~1"=="" (
    echo.
    echo 用法: render-video.bat ^<input.md^> [output.mp4]
    echo.
    echo 示例:
    echo   render-video.bat examples\demo\demo.md
    echo   render-video.bat examples\published\001-llm-wiki-karpathy-zh.md dist\output.mp4
    echo.
    pause
    exit /b 0
)

set INPUT=%~1
set OUTPUT=%~2

if "%OUTPUT%"=="" (
    for %%F in ("%INPUT%") do set BASENAME=%%~nF
    set OUTPUT=dist\%BASENAME%.mp4
)

echo [render-video] 开始渲染
echo   input : %INPUT%
echo   output: %OUTPUT%
echo   model : $MODEL_REPO

npx.cmd remotion render src/index.ts MarkdownVideo "%OUTPUT%" --props "{}"
echo [render-video] 如需完整渲染（含 TTS），请使用:
echo   npm run render:md -- "%INPUT%" "%OUTPUT%"
pause
"@ | Out-File -FilePath $renderBat -Encoding utf8

# --- start-studio.bat ---
$studioBat = Join-Path $ROOT_DIR "start-studio.bat"
@"
@echo off
chcp 65001 >nul 2>&1
title Remotion Studio

set ROOT_DIR=%~dp0
set ROOT_DIR=%ROOT_DIR:~0,-1%
cd /d "%ROOT_DIR%"

set QWEN_PYTHON=%ROOT_DIR%\.venv-qwen\Scripts\python.exe
set TTS_PROVIDER=qwen-local
set QWEN_TTS_MODEL=$MODEL_REPO

echo [studio] 启动 Remotion Studio ...
echo [studio] Python: %QWEN_PYTHON%
echo.

npm run dev

pause
"@ | Out-File -FilePath $studioBat -Encoding utf8

Write-Step "已生成快捷脚本:"
Write-Info "  render-video.bat  — 渲染 Markdown 为视频"
Write-Info "  start-studio.bat  — 启动 Remotion Studio 预览"

# ============================================================
#  第九步：写入 .env 配置文件
# ============================================================
Write-Title "第九步：生成环境配置"

$envFile = Join-Path $ROOT_DIR ".env"
@"
# Markdown-to-Video Windows 环境配置
# 由 install-win.bat 自动生成于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# TTS 引擎
TTS_PROVIDER=qwen-local

# Python 路径（虚拟环境）
QWEN_PYTHON=$VENV_PYTHON

# TTS 模型
QWEN_TTS_MODEL=$MODEL_REPO

# 设备配置（有 NVIDIA GPU 时使用 auto，否则 cpu）
QWEN_TTS_DEVICE=$(if ($hasCuda) { "auto" } else { "cpu" })
QWEN_TTS_DTYPE=$(if ($hasCuda) { "auto" } else { "float32" })
"@ | Out-File -FilePath $envFile -Encoding utf8
Write-Step "环境配置已写入: .env"

# ============================================================
#  安装完成
# ============================================================
Write-Title "安装完成！"

Write-Host "  已安装内容：" -ForegroundColor White
Write-Host "    - Node.js 依赖 (npm install)" -ForegroundColor Gray
Write-Host "    - Python 虚拟环境 (.venv-qwen)" -ForegroundColor Gray
Write-Host "    - Qwen3-TTS 模型 ($MODEL_DIR_NAME)" -ForegroundColor Gray
Write-Host "    - npm / pip 国内镜像加速" -ForegroundColor Gray
Write-Host "    - 快捷启动脚本" -ForegroundColor Gray
Write-Host ""
Write-Host "  快速开始：" -ForegroundColor White
Write-Host ""
Write-Host "    1. 启动预览:  双击 start-studio.bat" -ForegroundColor Green
Write-Host "    2. 渲染视频:  render-video.bat examples\demo\demo.md" -ForegroundColor Green
Write-Host "    3. 环境检查:  npm run qwen:doctor" -ForegroundColor Green
Write-Host ""
Write-Host "  或使用命令行：" -ForegroundColor White
Write-Host ""
Write-Host "    set QWEN_PYTHON=%ROOT_DIR%\.venv-qwen\Scripts\python.exe" -ForegroundColor DarkGray
Write-Host "    npm run video:render -- examples\demo\demo.md" -ForegroundColor DarkGray
Write-Host ""
