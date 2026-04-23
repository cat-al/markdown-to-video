# 操作手册：从 Markdown 到完整视频

> 本文档是一份面向实际操作的全流程指南，覆盖从零开始写一份 Markdown 文稿、到最终拿到一个带配音字幕的 .mp4 视频的每一步。

---

## 〇、整体流程概览

```
① 环境准备（一次性）
     ↓
② 编写 Markdown 文稿
     ↓
③ 截图预览画面 ← 反复调整直到满意
     ↓
④ 试听 TTS 配音 ← 不满意可单页重做
     ↓
⑤ 渲染输出 .mp4 + .srt 字幕
```

整个流程有两条渲染路径可选：

| 路径 | 适用场景 | 视觉风格 |
|------|---------|---------|
| **Native 模式**（默认） | 快速出片、样式完全由 React 组件控制 | 30 种自动布局 + 纯色渐变背景 |
| **HTML-PPT 模式** | 需要更精美的视觉效果、Canvas 动效 | 36 套 CSS 主题 + 20 种 Canvas 特效 |

下文会同时说明两种模式的操作方式，差别只在 Markdown 头部的一行配置。

---

## 一、环境准备（只做一次）

### 1.1 基础依赖

```bash
# 进入项目目录
cd /Users/bierchen/project-person/markdown-to-video

# 安装 Node.js 依赖（含 Remotion、Playwright 等）
npm install
```

### 1.2 确认 ffmpeg

```bash
ffmpeg -version
# 需要看到版本号输出。若未安装：brew install ffmpeg
```

### 1.3 TTS 语音环境（选一种）

#### 方案 A：Qwen3-TTS 本地模型（推荐，免费离线）

```bash
# 创建 Python 虚拟环境
python3 -m venv .venv-qwen
source .venv-qwen/bin/activate
pip install -r requirements-qwen.txt

# 下载模型（约 1.2GB，首次需要）
npm run download:qwen:modelscope

# 验证环境
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run qwen:doctor
```

#### 方案 B：MiMo-V2-TTS 云端（小米，限时免费，无需 GPU）

```bash
# 在项目根目录创建 .env 文件
echo "MIMO_API_KEY=你的API密钥" > .env
```

API Key 从 https://platform.xiaomimimo.com/ 获取。

#### 方案 C：macOS 系统语音（零配置，质量一般）

无需任何额外安装，在 frontmatter 中设置 `ttsProvider: system` 即可。

### 1.4 Playwright 浏览器（仅 HTML-PPT 模式需要）

```bash
npx playwright install chromium
```

---

## 二、编写 Markdown 文稿

### 2.1 创建文件

在 `examples/demo/` 或 `examples/published/` 下新建 `.md` 文件。

### 2.2 基本结构

一个完整文稿的骨架：

```markdown
---
title: 视频标题
ttsProvider: qwen-local
ttsVoice: Vivian
ttsLanguage: Chinese
---
# 第一页标题（自动作为封面）

正文内容，会显示在画面中。

- 支持无序列表
- 会自动布局为卡片

<!-- voiceover
这段文字不会显示在画面上，只用来生成配音和字幕。
写成你想「念出来」的口播稿。
-->

---

## 第二页标题

1. 有序列表第一项
2. 有序列表第二项
3. 有序列表第三项

<!-- voiceover
这一页我们来看三个关键步骤……
-->

---

## 最后一页

> 一句话总结全文。

<!-- voiceover
感谢观看，我们下期再见。
-->
```

### 2.3 关键语法规则

| 语法 | 作用 | 示例 |
|------|------|------|
| `---` | 分页符（必须独占一行，前后各有空行） | 见上方 |
| `<!-- voiceover -->` | 旁白文本（用于 TTS 配音 + 字幕） | `<!-- voiceover\n你好\n-->` |
| `<!-- duration: 8 -->` | 强制该页最低时长（秒） | 用于需要停留更久的页 |
| `<!-- layout: quote -->` | 强制使用指定布局 | 覆盖自动选择 |
| `<!-- accent: #f97316 -->` | 仅覆盖当前页的强调色 | 不影响其他页 |
| `<!-- fx: particle-burst -->` | Canvas 特效（仅 HTML-PPT 模式） | 见特效列表 |

### 2.4 Frontmatter 字段速查

```yaml
---
# ── 基础 ──
title: 视频标题
subtitle: 副标题（可选）
themeColor: "#7c3aed"          # 整篇主题色

# ── TTS 配音 ──
ttsProvider: qwen-local        # qwen-local | mimo | system
ttsVoice: Vivian               # Qwen 音色名 或 MiMo 音色
ttsLanguage: Chinese           # Chinese | English
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice  # 模型（一般不用改）

# ── HTML-PPT 模式（可选） ──
renderer: html-ppt             # 不写或写 native 则用默认模式
theme: tokyo-night             # 36 套主题可选
---
```

### 2.5 如果使用 HTML-PPT 模式

只需在 frontmatter 加两行：

```yaml
renderer: html-ppt
theme: tokyo-night             # 可选，默认 tokyo-night
```

推荐主题（按场景）：

| 场景 | 推荐主题 |
|------|---------|
| 技术分享 | `tokyo-night`、`dracula`、`terminal-green` |
| 产品介绍 | `minimal-white`、`glassmorphism`、`corporate-clean` |
| 学术报告 | `academic-paper`、`swiss-grid`、`editorial-serif` |
| 创意内容 | `cyberpunk-neon`、`aurora`、`vaporwave`、`neo-brutalism` |
| 小红书风 | `xiaohongshu-white`、`soft-pastel` |

Canvas 特效（在页面中通过 `<!-- fx: xxx -->` 使用）：

| 特效 | 适合场景 |
|------|---------|
| `particle-burst` | 封面、关键结论页 |
| `knowledge-graph` | 概念关系、架构页 |
| `neural-net` | AI / 技术主题 |
| `matrix-rain` | 代码、黑客风 |
| `starfield` | 开场、宇宙主题 |
| `confetti-cannon` | 庆祝、结尾感谢 |
| `data-stream` | 数据分析主题 |

---

## 三、预览画面（必做）

**规则：不允许跳过预览直接渲染视频。**

### 3.1 截图预览（最快，不跑 TTS）

```bash
# 查看所有页的截图
npm run preview:still -- 你的文件.md all

# 只看第 3 页
npm run preview:still -- 你的文件.md 3

# 打开截图查看（macOS）
open dist/preview/你的文件名/slide-*.png
```

检查清单：
- [ ] 每页布局是否合理（列表、代码、引用各有对应布局）
- [ ] 文字有没有溢出或截断
- [ ] 标题层级是否正确（# 做封面，## 做内页）
- [ ] 页数是否正确（检查 `---` 分页符）

### 3.2 Studio 实时预览（可选，更直观）

```bash
# Native 模式
npm run dev

# HTML-PPT 模式
PREVIEW_MARKDOWN=你的文件.md npm run dev

# 指定文件预览
PREVIEW_MARKDOWN=examples/demo/html-ppt-demo.md npm run dev
```

浏览器会自动打开 Remotion Studio，可以拖动时间轴逐帧查看。

---

## 四、试听配音（必做）

### 4.1 生成全篇音频

```bash
npm run preview:slide -- 你的文件.md all
```

### 4.2 逐页试听

```bash
# macOS 快速试听（页码从 01 开始）
open public/generated/你的文件名/slide-01.wav
open public/generated/你的文件名/slide-02.wav
# ...
```

检查清单：
- [ ] 语句通顺，没有吞字
- [ ] 语调自然，没有突兀的停顿或升调
- [ ] 节奏匹配画面内容的信息量

### 4.3 重做不满意的页

```bash
# 重做第 3 页音频
npm run tts:redo -- 你的文件.md 3

# 重做多页
npm run tts:redo -- 你的文件.md 3,5,7

# 重做一个范围
npm run tts:redo -- 你的文件.md 3-7

# 试听新音频
open public/generated/你的文件名/slide-03.wav
```

TTS 有随机性，同样的文案重跑一次可能就好了。如果反复不满意，考虑：
- 调整 `<!-- voiceover -->` 中的措辞（更口语化通常效果更好）
- 换一个 `ttsVoice`
- 加 `ttsInstruction` 描述期望的音色风格

---

## 五、渲染输出视频

### 5.1 推荐方式：增量渲染

```bash
npm run render:fast -- 你的文件.md
```

增量渲染只重渲改动的页，其余复用上次的片段，日常迭代最快。

### 5.2 全量渲染

```bash
# 方式一：npm 脚本
npm run render:md -- 你的文件.md

# 方式二：shell 一键脚本（自动配置环境变量）
./scripts/render-video.sh 你的文件.md

# 指定输出路径
npm run render:md -- 你的文件.md dist/my-video.mp4
```

### 5.3 输出产物

渲染完成后你会得到：

```
dist/
├── 你的文件名.mp4          ← 最终视频
└── 你的文件名.srt          ← SRT 字幕文件（可导入剪映/PR/YouTube）

public/generated/你的文件名/
├── slide-01.wav             ← 每页的配音音频（已缓存）
├── slide-02.wav
├── tts-manifest.json        ← 音频缓存索引
└── segments/                ← 增量渲染的分段视频缓存
```

---

## 六、完整实操示例

### 示例 A：Native 模式（默认，最简单）

```bash
# 1. 创建文稿
cat > examples/demo/my-talk.md << 'EOF'
---
title: 我的第一个视频
ttsProvider: system
---
# 欢迎来到 Markdown 视频

用最简单的方式，把文稿变成视频。

- 写 Markdown
- 自动配音
- 一键出片

<!-- voiceover
大家好！今天我来演示如何用 Markdown 生成视频。整个过程只需要三步。
-->

---

## 为什么选这个工具

1. **零设计门槛**：30 种布局自动匹配
2. **本地 TTS**：不依赖云端，隐私安全
3. **增量渲染**：改一页只重渲一页

<!-- voiceover
这个工具最大的优势是零设计门槛。你只需要写 Markdown，系统会自动选择最合适的布局。
-->

---

## 感谢

开始你的第一个视频吧！

<!-- voiceover
以上就是全部内容，感谢观看！
-->
EOF

# 2. 截图预览
npm run preview:still -- examples/demo/my-talk.md all
open dist/preview/my-talk/slide-*.png

# 3. 试听配音
npm run preview:slide -- examples/demo/my-talk.md all
open public/generated/my-talk/slide-01.wav

# 4. 渲染视频
npm run render:fast -- examples/demo/my-talk.md

# 5. 播放
open dist/my-talk.mp4
```

### 示例 B：HTML-PPT 模式（精美视觉）

```bash
# 1. 使用项目自带的示例文件
cat examples/demo/html-ppt-demo.md

# 2. 截图预览
npm run preview:still -- examples/demo/html-ppt-demo.md all

# 3. 试听
npm run preview:slide -- examples/demo/html-ppt-demo.md all

# 4. 渲染（html-ppt 模式会自动：生成 HTML → Playwright 录制 → Remotion 合成）
npm run render:fast -- examples/demo/html-ppt-demo.md

# 5. 播放
open dist/html-ppt-demo.mp4
```

### 示例 C：用 Qwen 本地模型配音

```bash
# 1. 确保 Qwen 环境就绪
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run qwen:doctor

# 2. 文稿中使用 Qwen
cat > examples/demo/qwen-talk.md << 'EOF'
---
title: Qwen 配音演示
ttsProvider: qwen-local
ttsVoice: Vivian
ttsLanguage: Chinese
---
# 本地语音，无需联网

Qwen3-TTS 在你的机器上运行，完全离线。

<!-- voiceover
这段配音完全在本地生成，不依赖任何云端服务。Qwen3 模型可以在 CPU 上稳定运行。
-->
EOF

# 3. 渲染
./scripts/render-video.sh examples/demo/qwen-talk.md
```

---

## 七、常见问题排查

### Q: 渲染时报 `Chromium not found`
```bash
npx playwright install chromium
```

### Q: Qwen TTS 报错
```bash
# 检查环境
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run qwen:doctor

# 重新安装依赖
source .venv-qwen/bin/activate
pip install -r requirements-qwen.txt
```

### Q: 某页配音质量差
```bash
# 重新生成该页（TTS 有随机性，重跑通常能改善）
npm run tts:redo -- 你的文件.md 5
open public/generated/你的文件名/slide-05.wav
```

### Q: 改了样式代码但视频没变化
```bash
# 增量渲染的指纹不含样式，需加 --force
npm run render:fast -- 你的文件.md --force
```

### Q: HTML-PPT 模式录制的视频是黑屏
- 确保 `vendor/html-ppt/` 目录存在且文件完整
- 确保 `ffmpeg` 已安装
- 检查 `public/generated/*/html-slide-*.mp4` 是否生成

### Q: 想换主题
只需修改 frontmatter 中的 `theme` 字段，重新渲染即可：
```yaml
theme: cyberpunk-neon
```

---

## 八、命令速查表

| 操作 | 命令 |
|------|------|
| **截图预览全部页** | `npm run preview:still -- <file.md> all` |
| **截图预览某页** | `npm run preview:still -- <file.md> 3` |
| **试听全部配音** | `npm run preview:slide -- <file.md> all` |
| **Studio 实时预览** | `PREVIEW_MARKDOWN=<file.md> npm run dev` |
| **增量渲染（推荐）** | `npm run render:fast -- <file.md>` |
| **全量渲染** | `npm run render:md -- <file.md>` |
| **一键渲染** | `./scripts/render-video.sh <file.md>` |
| **重做某页音频** | `npm run tts:redo -- <file.md> 3` |
| **重做+渲染** | `npm run tts:redo -- <file.md> 3 --render` |
| **强制全量** | `npm run render:fast -- <file.md> --force` |
| **检查 Qwen** | `npm run qwen:doctor` |
| **TypeScript 检查** | `npm run check` |

---

## 九、项目目录结构

```
markdown-to-video/
├── examples/              # Markdown 文稿（你的输入）
│   ├── demo/              #   功能验证与演示稿
│   └── published/         #   已发布的成型文稿
├── src/                   # Remotion 视频组件源码
│   ├── video/layouts/     #   30 种布局组件
│   └── video/components/  #   通用组件（含 HtmlSlideBackground）
├── scripts/               # 构建脚本
│   ├── lib/               #   核心库（pipeline、HTML生成器、录制器、HTTP服务）
│   └── *.mjs             #   入口脚本（渲染、预览等）
├── vendor/html-ppt/       # HTML-PPT 资产（主题、动画、模板）
├── public/generated/      # 运行时生成的音频和视频片段
├── dist/                  # 最终产物（.mp4 + .srt）
├── docs/                  # 文档
└── .models/               # 本地 TTS 模型
```
