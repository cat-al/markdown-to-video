## Markdown 写法指南

本文档说明 Markdown 文稿的写法约定、支持的控制字段和布局系统。

如果你在写 **精读 / 解读 / 拆解类** 中文讲解稿，建议先看 `docs/文案生成规则.md`，再开始写第一页。
如果你在挑选示例底稿，先看 `examples/README.md`，确认应该放到 `examples/demo/` 还是 `examples/published/`。

### Frontmatter 与分页语法

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

#### Frontmatter 字段（全局生效）

- **`title` / `subtitle`**：演示文稿标题与副标题
- **`themeColor`**：整篇视频的默认主题色
- **`ttsProvider`**：默认推荐 `qwen-local`，也支持 `mimo`（小米云端）和 `system`（macOS 兼容）
- **`ttsModel`**：Qwen 模型名 / 本地路径；MiMo 默认 `mimo-v2-tts`
- **`ttsVoice`**：Qwen `CustomVoice` 音色名（如 `Vivian`）；MiMo 音色（如 `default_zh`）
- **`ttsRate`**：系统 TTS 兼容字段，Qwen 默认不会用到
- **`ttsLanguage`**：如 `Chinese` / `English`
- **`ttsInstruction`**：Qwen `VoiceDesign` 模式下的音色描述

#### 页面级控制指令（HTML 注释）

- **`<!-- voiceover -->`**：显式指定旁白文本
- **`<!-- duration: 6 -->`**：显式指定当前页最低时长（秒）
- **`<!-- layout: quote -->`**：强制当前页使用指定布局，适合总结页、提醒页、封面页等强风格页面
- **`<!-- accent: #f97316 -->`**：只覆盖当前页的强调色，不影响整篇其他页面

### 布局系统

#### 推荐的布局控制策略

为了适配**越来越多的文章**，建议采用下面这套规则：

- **默认交给系统自动选型**：普通内容页尽量不写 `layout`
- **只在关键页手动覆写**：例如封面页、章节过渡页、金句总结页、结尾提醒页
- **把样式决策留在 Markdown 内**：尽量不要为了某一篇文章去改视频组件里的硬编码规则

#### 支持的布局（共 30 种）

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
- **`centered`**：居中大段文字 + 引号装饰
- **`waterfall`**：瀑布流纵向递进卡片
- **`radar`**：中心辐射圆形布局
- **`compare`**：左右对比双栏
- **`pyramid`**：金字塔层级递进
- **`stat-cards`**：大数字统计卡片
- **`headline`**：巨幅标题 + 章节过渡
- **`sidebar-note`**：左窄侧栏 + 右主区
- **`filmstrip`**：横向胶片条步骤
- **`duo`**：上下两等分对比卡片
- **`orbit`**：左主题 + 右侧条目列表
- **`kanban`**：看板三列分类
- **`stack`**：堆叠偏移卡片
- **`accent-bar`**：粗色条 + 大文字声明
- **`split-quote`**：左引言右解释
- **`checklist`**：勾选列表样式
- **`minimal`**：极简大留白呼吸页
- **`magazine`**：杂志多栏信息密集布局

### 输出产物

执行渲染后，通常会生成以下内容：

- `dist/*.mp4`：最终视频
- `dist/*.srt`：字幕文件
- `dist/*.preview.srt`：Studio 预览字幕
- `public/generated/<name>/slide-*.wav`：每一页的配音音频
- `src/generated/preview-presentation.ts`：Studio 预览使用的数据模块
