# Markdown-to-Video Skills 设计文档

**日期**: 2026-04-24
**状态**: 已批准

## 概述

构建两个独立的 skill，形成 **Markdown → 视频** 管线的前两个阶段：

1. **markdown-scriptwriter** — 通过 brainstorming 对话，将用户的粗略内容/大纲转化为标准格式的视频文案 Markdown
2. **markdown-to-html** — 将标准格式 Markdown 转化为 16:9 宽屏动态 HTML 幻灯片

两个 skill 之间的契约是**标准格式 Markdown**。

## 目录结构

```
markdown-to-video2/
├── markdown-scriptwriter/       # Step 1
│   ├── SKILL.md                 # skill 定义
│   └── templates/
│       └── standard-format.md   # 标准输出格式模板
├── markdown-to-html/            # Step 2
│   ├── SKILL.md                 # skill 定义
│   ├── templates/
│   │   └── slide-base.html      # 基础幻灯片框架
│   └── scripts/
│       └── parse-markdown.js    # Markdown → JSON 场景解析
├── html-layout-review/          # Step 3（后续补充）
│   ├── SKILL.md                 # HTML 视觉验收 skill
│   └── references/
│       └── review-checklist.md  # 审查清单
└── docs/
    └── superpowers/specs/
        └── (本文件)
```

Skill 放在项目根目录下，不在 `.codebuddy/` 中，方便跨 Agent 工具使用。

## Step 1: markdown-scriptwriter

### 职责

- **强制走 brainstorming 流程**：即使用户已有 Markdown 文档，也必须先通过对话梳理视频内容结构
- 输出标准格式的视频文案 Markdown

### 输入

- 用户口头描述、大纲、或已有 Markdown 文档

### 输出：标准格式 Markdown

```markdown
---
title: "视频标题"
author: "作者"
topic: "主题分类"
estimated_duration: "预估时长(分钟)"
scenes_count: 场景数量
---

## 场景1：开场引入

**画面描述**: 深色背景，书籍封面缓缓浮现，标题文字逐字出现

> 你有没有想过，为什么大多数人学了很多知识，却始终无法改变自己的生活？
> 今天我们来精读一本改变了无数人认知的书。
> 这本书叫做《认知觉醒》，作者周岭。

## 场景2：核心观点一

**画面描述**: 左侧显示大脑图示，右侧逐条显示要点列表

> 书中提出了一个关键概念：你的大脑有三重结构。
> 本能脑负责生存，情绪脑负责感受，理性脑负责思考。
> 大多数时候，我们以为自己在思考，其实只是在被本能和情绪驱动。
```

**格式规范：**
- YAML frontmatter 包含元信息
- 每个 `## 场景N：标题` 代表一个视频画面/场景
- `**画面描述**` 描述该场景的视觉内容，供 Step 2 参考
- `>` 引用块逐行列出字幕文案，每行一句，顺序即播放顺序
- 不包含时间戳（时间信息由后续 TTS 阶段生成）

### 集成 brainstorming

SKILL.md 中集成 brainstorming 的核心流程：
- 理解用户意图和内容主旨
- 确认目标受众和视频风格
- 梳理内容结构和场景划分
- 逐步生成并验证文案

## Step 2: markdown-to-html

### 职责

- 将标准格式 Markdown 转化为 16:9 宽屏动态 HTML 幻灯片页面
- 集成 frontend-design 美学约束
- JS 驱动的可配置时间轴动画

### 输入

- Step 1 输出的标准格式 Markdown
- 可选：用户提供的参考 HTML 页面

### 输出

- 单个 HTML 文件，包含所有场景
- 幻灯片式翻页呈现
- 16:9 强制宽屏（1920x1080 视口）
- 每个场景有渐进式披露动效

### 风格控制

两种模式：
1. **参考模式**: 用户提供参考 HTML 页面，AI 分析其风格后模仿
2. **自动模式**: AI 根据内容主题自动决定风格

两种模式都必须遵循 frontend-design 美学规范：
- 大胆的美学方向（避免 AI slop）
- 独特的字体选择（禁止 Inter/Roboto/Arial）
- 有辨识度的色彩方案（禁止千篇一律的紫色渐变）
- 动效要服务于内容表达

### 时间轴引擎

HTML 中内置 JS 时间轴引擎：
- 每个场景有可配置的持续时间
- 场景内元素有可配置的出现时机（渐进式披露）
- 默认使用合理的预估时间
- 暴露配置接口，后续 TTS 生成音频后可回填真实时长
- 支持自动播放模式（用于录屏）

### 固定部分

- **slide-base.html**: 基础框架模板
  - 16:9 视口设置
  - 场景切换逻辑
  - 时间轴引擎核心代码
  - 动画基础设施（CSS + JS）
- **parse-markdown.js**: 标准 Markdown → JSON 解析脚本
  - 解析 YAML frontmatter
  - 提取场景结构
  - 提取字幕行和画面描述
  - 输出 JSON 供 HTML 模板消费

### 集成 frontend-design

SKILL.md 中内嵌 frontend-design 的核心规则：
- Design Thinking 流程
- 美学指南（字体、色彩、动效、空间构成、背景与视觉细节）
- 禁止通用 AI 美学的黑名单
- 强制在生成 HTML 时遵循这些约束

## 两步之间的契约

标准格式 Markdown 是两个 skill 之间的唯一接口：
- Step 1 保证输出符合格式规范
- Step 2 保证能解析该格式
- 格式模板 `standard-format.md` 是权威定义
