## 视频制作与渲染指南

本文档说明视频的完整制作流程、增量渲染机制和样式调试工作流。

### 视频制作流程（必须遵守）

**重要规则：所有视频在最终合成前，必须先逐页确认画面和音频。不允许跳过预览直接生成完整视频。**

完整流程分四步：

#### 第一步：截图预览画面（必选，最快）

不跑 TTS，只生成 PNG 截图，几秒一张，快速检查布局和样式：

```bash
# 看所有页样式
npm run preview:still -- examples/published/004-hermes-agent-vs-openclaw-zh.md all

# 只看第 5 页
npm run preview:still -- examples/published/004-hermes-agent-vs-openclaw-zh.md 5

# 一次打开所有截图
open dist/preview/004-hermes-agent-vs-openclaw-zh/slide-*.png
```

检查要点：布局是否正确、表格是否显示完整、文字是否溢出、标题是否重复。

#### 第二步：试听音频（必选）

确认画面没问题后，生成 TTS 音频并试听：

```bash
# 全篇生成音频（会自动缓存）
npm run preview:slide -- examples/published/004-hermes-agent-vs-openclaw-zh.md all

# 或只听某一页
open public/generated/004-hermes-agent-vs-openclaw-zh/slide-05.wav
```

检查要点：语句是否通顺、有无吞字或语调异常、节奏是否自然。

#### 第三步：修复问题页（按需）

```bash
# 音频有问题：重新生成某页音频
npm run tts:redo -- examples/published/004-hermes-agent-vs-openclaw-zh.md 3

# 画面有问题：改完代码后重新截图确认
npm run preview:still -- examples/published/004-hermes-agent-vs-openclaw-zh.md 3
```

#### 第四步：确认无误后生成完整视频

所有页面画面和音频都确认没问题后，执行最终渲染。**推荐使用增量渲染**：

```bash
# 推荐：增量渲染（只渲染改动的页，其余复用缓存）
npm run render:fast -- examples/published/004-hermes-agent-vs-openclaw-zh.md

# 备选：全量渲染（从头渲染所有页）
npm run render:md -- examples/published/004-hermes-agent-vs-openclaw-zh.md
```

### 增量渲染（render:fast）

`render:fast` 是日常迭代的**推荐渲染方式**，只重新渲染改动的页，其他页复用上次的视频片段，最后 ffmpeg 拼接。

#### 性能对比

| 场景 | `render:md`（全量） | `render:fast`（增量） |
|------|:---:|:---:|
| 首次渲染 | ~15 分钟 | ~15 分钟（首次无缓存） |
| 换 1 页音频 | ~15 分钟 | **~1 分钟** |
| 改 2-3 页文案 | ~15 分钟 | **~2-3 分钟** |
| 改了样式代码 | ~15 分钟 | ~15 分钟（需 `--force`） |

#### 用法

```bash
# 日常使用：自动检测改动页，只渲染变化的部分
npm run render:fast -- input.md

# 指定输出路径
npm run render:fast -- input.md dist/output.mp4

# 改了样式代码后，强制全部重新渲染
npm run render:fast -- input.md --force
```

#### 工作原理

1. 为每页生成内容指纹（markdown + narration + audioSrc + duration 等）
2. 与上次渲染的指纹对比，只重新渲染内容有变化的页
3. 每页渲染为独立 mp4 片段，缓存在 `public/generated/<name>/segments/`
4. 最后 ffmpeg concat 拼接所有片段为完整视频

#### 什么时候需要 `--force`

- 修改了 `src/video/` 中的布局、动画、样式代码
- 修改了 `src/markdown.ts` 中的解析逻辑
- 指纹不含样式信息，所以纯样式改动不会自动触发重新渲染

#### 什么时候不需要 `--force`

- 修改了 Markdown 文案内容（自动检测）
- 重新生成了某页 TTS 音频（自动检测）
- 修改了 voiceover 文本（自动检测）

#### 典型工作流：换一段音频

```bash
# 1. 重新生成第 11 页音频
npm run tts:redo -- input.md 11

# 2. 试听
open public/generated/<name>/slide-11.wav

# 3. 增量渲染（只渲染第 11 页，~1 分钟）
npm run render:fast -- input.md
```

### 样式调试工作流（避免重复跑 TTS）

如果你只是修改 `src/video/` 里的布局、配色、动效、排版等纯视觉层代码，**不要反复执行** `npm run prepare:preview`、`npm run dev` 或 `npm run render:md`，因为这些流程都会再次调用 `createPresentationAssets(...)`。当前系统虽然已经支持**按页复用未变化的 TTS 音频缓存**，但纯样式调试时直接走 `studio` / `render:preview` 仍然是最快的。

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
