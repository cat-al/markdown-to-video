## Markdown to Video

把按页编写的 Markdown 文稿直接生成带 **配音、字幕、预览与导出视频** 的原型项目，核心技术栈是 `Remotion + React + Node.js`，默认语音链路已经切到 **`Qwen3-TTS` 本地模型**。

### 项目能做什么

- **Markdown 分页生成视频**：使用 `---` 作为分页符
- **Qwen3-TTS 默认配音**：默认走 `qwen-local`，不再依赖系统 `say`
- **Qwen3-TTS Base 语音克隆**：支持 `Qwen3-TTS-12Hz-0.6B-Base` 的参考音频复刻
- **自动字幕**：根据旁白文本拆分字幕，并额外输出 `.srt`
- **Studio 预览**：先生成预览素材，再启动 `Remotion Studio`
- **命令行渲染**：从 `.md` 直接输出 `.mp4`
- **本地模型优先**：若 `.models/` 下存在同名模型目录，会优先走本地镜像

### 目录说明

- `src/`：Remotion 入口、视频组件（布局 / 主题 / 样式）、预览模块
- `scripts/`：Markdown 解析、TTS 生成、预览准备、渲染脚本
- `examples/`：示例 Markdown，包括默认 demo 与 Qwen 示例
- `docs/`：详细使用文档（Markdown 写法、音频配置、视频制作流程）
- `public/generated/`：按文稿生成的音频素材
- `dist/`：视频与字幕产物
- `log/`：运行日志与 PID 文件
- `.models/`：本地模型镜像目录（如 `Qwen3-TTS`）

### 详细文档

| 文档 | 内容 |
|------|------|
| [Markdown 写法指南](docs/markdown-guide.md) | Frontmatter、分页语法、控制字段、30 种布局列表、输出产物 |
| [音频与语音合成指南](docs/audio-guide.md) | Qwen3-TTS / MiMo-V2-TTS / 系统 TTS 配置、单页音频重做 |
| [Qwen Base 语音克隆与派大星方案](docs/qwen-base-voice-clone.md) | `Qwen3-TTS-12Hz-0.6B-Base` 接入说明、参考音频字段、派大星复刻实操方案 |
| [视频制作与渲染指南](docs/video-guide.md) | 四步制作流程、增量渲染、样式调试工作流 |
| [文案生成规则](docs/文案生成规则.md) | 精读 / 解读类视频文案的写作规范 |

### 环境要求

- **Node.js**：建议 `18+`
- **Python**：使用 `qwen-local` 需要 Python 3.9+ 环境
- **ffprobe**：建议安装，用于音频时长探测；macOS 没有时会回退到 `afinfo`
- **Git + Git LFS**：用于从 ModelScope 下载模型

### Windows 一键安装（推荐）

如果你在 **Windows** 上使用，直接双击 `install-win.bat` 即可完成全部安装：

```
双击 install-win.bat
```

安装完成后，双击 `start-studio.bat` 启动预览，或使用：

```cmd
scripts\render-video.bat examples\demo\demo.md
```

### 快速开始（macOS / Linux）

#### 1. 安装依赖

```bash
npm install
```

#### 2. 准备 Python 环境

```bash
python3 -m venv .venv-qwen
source .venv-qwen/bin/activate
pip install -r requirements-qwen.txt
```

#### 3. 检查 Qwen 环境

```bash
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run qwen:doctor
```

#### 4. 启动预览

```bash
npm run dev
```

#### 5. 一键渲染 Markdown 为视频

```bash
./scripts/render-video.sh examples/demo/demo.md
```

指定输出文件：

```bash
./scripts/render-video.sh examples/demo/demo.md dist/demo.mp4
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `./scripts/render-video.sh <input.md> [output.mp4]` | 推荐的一键渲染入口 |
| `npm run render:fast -- <input.md> [output.mp4]` | 增量渲染（只渲染改动页，推荐日常使用） |
| `npm run render:md -- <input.md> [output.mp4]` | 全量渲染 |
| `npm run dev` | 生成预览素材 + 打开 Remotion Studio |
| `npm run dev:qwen:base` | 直接打开 `qwen-base-clone` demo，使用 `examples/findings.wav` 做语音克隆试听 |
| `npm run studio` | 直接打开 Studio（不重跑 TTS） |
| `npm run preview:still -- <input.md> <页码\|all>` | 单页截图预览（不跑 TTS，秒出 PNG） |
| `npm run preview:slide -- <input.md> <页码\|all>` | 单页视频预览（含音频） |
| `npm run tts:redo -- <input.md> <页码> [--render]` | 单页音频重新生成 |
| `npm run qwen:doctor` | 检查 Qwen3-TTS 环境 |
| `npm run download:qwen:modelscope` | 下载默认 `CustomVoice` 模型镜像 |
| `npm run download:qwen:custom:modelscope` | 下载 `Qwen3-TTS-12Hz-0.6B-CustomVoice` |
| `npm run download:qwen:base:modelscope` | 下载 `Qwen3-TTS-12Hz-0.6B-Base` |
| `npm run check` | TypeScript 类型检查 |

### 日志与运行文件

运行时日志统一在 `log/` 目录：`log/*.log`（运行日志）、`log/*.pid`（后台任务 PID）。

### 示例文件

- `examples/demo/`：演示稿与功能验证案例（`demo.md`、`qwen-local.md`、`qwen-base-clone.md`、`mimo-tts.md`、`ai-brain-fry-demo.md`）
- `examples/published/`：已发布或接近发布的成型文稿，使用三位编号前缀

更详细的放置规则见 `examples/README.md`。

### 当前适合的使用场景

- 技术教程视频
- 产品介绍视频
- Markdown 讲稿快速成片
- 本地验证 TTS / 字幕 / 视频生成闭环

### 后续可继续扩展

- **模板系统**：封面、章节页、结尾页、转场
- **字幕增强**：逐词高亮、双语字幕、样式模板
- **批量渲染**：扫描目录后批量生成视频
- **音色能力**：VoiceClone、本地缓存复用、更多模型支持
- **工程化能力**：任务队列、Web 界面、远程渲染
