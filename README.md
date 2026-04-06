## Markdown to Video

把按页编写的 Markdown 文稿直接生成带 **配音、字幕、预览与导出视频** 的原型项目，核心技术栈是 `Remotion + React + Node.js`，默认语音链路已经切到 **`Qwen3-TTS` 本地模型**。

### 项目能做什么

- **Markdown 分页生成视频**：使用 `---` 作为分页符
- **Qwen3-TTS 默认配音**：默认走 `qwen-local`，不再依赖系统 `say`
- **自动字幕**：根据旁白文本拆分字幕，并额外输出 `.srt`
- **Studio 预览**：先生成预览素材，再启动 `Remotion Studio`
- **命令行渲染**：从 `.md` 直接输出 `.mp4`
- **本地模型优先**：若 `.models/` 下存在同名模型目录，会优先走本地镜像

### 目录说明

- `src/`：Remotion 入口、页面组件、预览模块
- `scripts/`：Markdown 解析、TTS 生成、预览准备、渲染脚本
- `examples/`：示例 Markdown，包括默认 demo 与 Qwen 示例
- `public/generated/`：按文稿生成的音频素材
- `dist/`：视频与字幕产物
- `log/`：运行日志与 PID 文件
- `.models/`：本地模型镜像目录（如 `Qwen3-TTS`）

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

安装脚本会自动完成：

1. **系统环境检查**：Node.js、Python、Git、GPU、内存、磁盘空间
2. **更换国内镜像加速**：npm → npmmirror、pip → 清华、PyTorch → 上海交大镜像
3. **安装 Node.js 和 Python 依赖**
4. **选择 TTS 模型**：0.6B（推荐，~1.7GB）或 1.7B（更高质量，~4.8GB）
5. **从 ModelScope 下载模型**（国内源，避免海外下载慢）
6. **验证 Qwen3-TTS 环境**
7. **生成快捷启动脚本**：`start-studio.bat`、`render-video.bat`

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

#### 4. 生成默认预览素材

```bash
npm run prepare:preview
```

#### 5. 启动默认预览

```bash
npm run dev
```

#### 6. 一键渲染 Markdown 为视频（推荐）

```bash
./scripts/render-video.sh examples/demo/demo.md
```

如果希望指定输出文件：

```bash
./scripts/render-video.sh examples/demo/demo.md dist/demo.mp4
```

如果更习惯走 npm 命令：

```bash
npm run video:render -- examples/demo/demo.md dist/demo.mp4
```

这个脚本会固定做几件事：

- 优先使用 `.venv-qwen/bin/python`
- 在正式渲染前执行一次 `qwen:doctor`
- 在 macOS 上默认使用 `CPU + float32` 跑 `Qwen3-TTS`
- 输出对应的 `.mp4` 和 `.srt`

如果你想直接调用底层命令，也仍然可以用：

```bash
npm run render:md -- examples/demo/demo.md dist/demo.mp4
```

### 常用命令

- **`./scripts/render-video.sh <input.md> [output.mp4]`**：推荐的一键渲染入口，固定走标准视频生成流程
- **`npm run video:render -- <input.md> [output.mp4]`**：上面脚本的 npm 包装命令
- **`npm run prepare:preview`**：使用默认示例生成预览素材
- **`npm run prepare:preview:qwen`**：使用 `examples/demo/qwen-local.md` 生成 Qwen 预览素材
- **`npm run studio`**：直接打开当前预览素材对应的 `Remotion Studio`，**不会重跑 TTS**
- **`npm run dev`**：准备默认预览素材并打开 `Remotion Studio`
- **`npm run dev:qwen`**：准备 `Qwen3-TTS` 预览素材并打开 `Remotion Studio`
- **`npm run render:md -- <input.md> [output.mp4]`**：底层渲染命令，适合已经明确参数时直接调用
- **`npm run render:preview -- <output.mp4>`**：直接渲染当前预览组合，**不会重跑 TTS**
- **`npm run qwen:doctor`**：检查本地 `Qwen3-TTS` 运行环境
- **`npm run download:qwen:modelscope`**：通过 `ModelScope` 拉取 `0.6B-CustomVoice` 模型镜像
- **`npm run check`**：TypeScript 类型检查

### 样式调试工作流（避免重复跑 TTS）

如果你只是修改：

- `src/MarkdownVideo.tsx` 里的布局、配色、动效、排版
- 其他纯视觉层代码

那**不要反复执行** `npm run prepare:preview`、`npm run dev` 或 `npm run render:md`，因为这些流程都会再次调用 `createPresentationAssets(...)`。当前系统虽然已经支持**按页复用未变化的 TTS 音频缓存**，但纯样式调试时直接走 `studio` / `render:preview` 仍然是最快的。

更高效的做法是：

1. **先生成一次预览素材**（首轮或文稿变更后再做）

```bash
npm run prepare:preview -- examples/demo/demo.md
```

这一步会更新：

- `src/generated/preview-presentation.ts`
- `public/generated/<assetKey>/slide-*.wav`

2. **后续只改样式时，直接打开 Studio**

```bash
npm run studio
```

3. **需要导出当前样式效果时，直接渲染预览组合**

```bash
npm run render:preview -- dist/style-preview.mp4
```

只有在以下内容变化时，才建议重新跑素材生成或整篇渲染：

- Markdown 文案本身
- `<!-- voiceover -->` 旁白文本
- `ttsVoice` / `ttsModel` / `ttsInstruction` / `ttsLanguage`
- 页数、分页结构、字幕内容

### Markdown 写法约定

如果你在写 **精读 / 解读 / 拆解类** 中文讲解稿，建议先看 `docs/文案生成规则.md`，再开始写第一页。
如果你在挑选示例底稿，先看 `examples/README.md`，确认应该放到 `examples/demo/` 还是 `examples/published/`。

支持简单 frontmatter 与分页语法：

```md
---
title: 你的标题
subtitle: 你的副标题
themeColor: #8b5cf6
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Vivian
ttsLanguage: Chinese
---
# 第一页
内容...

<!-- voiceover
这是这一页真正用于配音和字幕的文本。
-->

---

## 第二页
内容...
<!-- layout: quote -->
<!-- accent: #f97316 -->
<!-- duration: 6 -->
```

### 支持的控制字段

- **`title` / `subtitle`**：演示文稿标题与副标题
- **`themeColor`**：整篇视频的默认主题色
- **`ttsProvider`**：默认推荐 `qwen-local`，也保留 `system` 兼容分支
- **`ttsModel`**：Qwen 模型名或本地模型路径
- **`ttsVoice`**：Qwen `CustomVoice` 音色名，例如 `Vivian`
- **`ttsRate`**：系统 TTS 兼容字段，Qwen 默认不会用到
- **`ttsLanguage`**：如 `Chinese` / `English`
- **`ttsInstruction`**：Qwen `VoiceDesign` 模式下的音色描述
- **`<!-- voiceover -->`**：显式指定旁白文本
- **`<!-- duration: 6 -->`**：显式指定当前页最低时长（秒）
- **`<!-- layout: quote -->`**：强制当前页使用指定布局，适合总结页、提醒页、封面页等强风格页面
- **`<!-- accent: #f97316 -->`**：只覆盖当前页的强调色，不影响整篇其他页面

### 推荐的布局控制策略

为了适配**越来越多的文章**，建议采用下面这套规则：

- **默认交给系统自动选型**：普通内容页尽量不写 `layout`
- **只在关键页手动覆写**：例如封面页、章节过渡页、金句总结页、结尾提醒页
- **把样式决策留在 Markdown 内**：尽量不要为了某一篇文章去改 `MarkdownVideo.tsx` 里的硬编码规则

当前支持的 `layout` 值有：

- **`hero`**：封面 / 开场大标题
- **`split-list`**：轻量清单页
- **`timeline`**：步骤 / 顺序 / 演进关系
- **`grid`**：多点并列说明
- **`mosaic`**：多场景 / 多用例拼贴
- **`argument`**：原因拆解 / 论点页
- **`triptych`**：三列结构总结
- **`manifesto`**：原则 / 提醒 / 框架页
- **`spotlight`**：单一观点聚焦
- **`quote`**：金句 / 对比结论 / 收尾页
- **`code`**：代码讲解页
- **`panel`**：通用兜底布局

### 输出产物

执行渲染后，通常会生成以下内容：

- `dist/*.mp4`：最终视频
- `dist/*.srt`：字幕文件
- `dist/*.preview.srt`：Studio 预览字幕
- `public/generated/<name>/slide-*.wav`：每一页的配音音频
- `src/generated/preview-presentation.ts`：Studio 预览使用的数据模块

### 默认 Qwen3-TTS 配置

项目默认使用以下策略：

- **默认 provider**：`qwen-local`
- **默认模型**：`Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`
- **默认音色**：`Vivian`
- **macOS 默认推理策略**：`CPU + float32`
- **自动 Python 探测**：若存在 `.venv-qwen/bin/python`，脚本会优先使用它
- **自动本地模型探测**：若 `.models/<repoName>` 存在，会优先走本地路径

### 使用 Qwen3-TTS 本地模型

如果你想显式写在 Markdown 中，可以这样配置：

```md
---
title: Qwen Demo
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Vivian
ttsLanguage: Chinese
ttsInstruction: 自然、清晰、专业的中文视频讲解音色，节奏稳定，适合技术教程和产品介绍。
---
```

#### 下载本地模型镜像

```bash
npm run download:qwen:modelscope
```

#### 直接查看 Qwen 预览效果

```bash
npm run dev:qwen
```

#### 使用 Qwen 渲染视频

```bash
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run render:md -- examples/demo/qwen-local.md dist/qwen-local.mp4
```

### 系统 TTS 说明

代码里仍保留了 `system` provider 兼容分支，但它已经**不再是默认方案**。常规预览和渲染流程现在都默认使用 `Qwen3-TTS`。

### 日志与运行文件

当前项目会把运行时产生的日志与 PID 文件统一放到 `log/`：

- `log/*.log`：下载、预览、模型测试等日志
- `log/*.pid`：对应后台任务 PID

如果你只是想查看最近一次运行状态，可以优先看：

- `log/dev-server.log`
- `log/qwen-preview-gen.log`
- `log/qwen-modelscope.log`
- `log/hf-download-test.log`

### 示例文件

- `examples/demo/`：演示稿与功能验证案例
  - `demo.md`：默认 demo，已切到 Qwen 默认配置
  - `qwen-local.md`：显式 Qwen 本地语音示例
  - `ai-brain-fry-demo.md`：根据视频转录整理的简体中文演示稿
- `examples/published/`：已经发布或接近发布状态的成型文稿，使用三位编号前缀
  - `001-llm-wiki-karpathy-zh.md`：Karpathy《LLM Wiki》精读稿
  - `002-sam-altman-technical-only-zh.md`：Sam Altman 技术向访谈精读稿

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
