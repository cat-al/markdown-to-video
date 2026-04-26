# 产物目录规范化设计

**日期**: 2026-04-26
**状态**: 待实施

## 背景

当前 6 个 skill 的产物输出位置缺乏统一约定：
- `markdown-scriptwriter` 的 Markdown 输出没有固定路径
- `markdown-to-html` 的 HTML 输出惯例为 `output/presentation.html`，但未强制
- `tts-voiceover` 硬编码 `output/audio/` 和 `output/tts-manifest.json`
- `subtitle-timeline` 硬编码 `output/subtitles.srt`
- `video-render` 硬编码 `output/video/`

下游 skill 靠隐式约定或 manifest 字段来定位上游产物，缺乏统一规范。同时，当前结构只支持"同一时间做一个视频"，无法管理多个视频项目。

## 设计目标

1. 每个视频项目的产物隔离在独立目录中
2. 目录命名带递增编号，便于排序和识别
3. 所有 skill 拿到项目目录路径后，用固定文件名即可定位一切
4. manifest 内路径全部使用相对于项目目录的相对路径

## 目录结构

```
output/<NNN>-<slug>/
  script.md                    ← markdown-scriptwriter
  presentation.html            ← markdown-to-html
  paper-texture-bg.png         ← markdown-to-html（模板以相对路径引用）
  audio/                       ← tts-voiceover
    scene-01/
      001.wav
      002.wav
      ...
    scene-02/
      001.wav
      ...
  tts-manifest.json            ← tts-voiceover
  subtitles.srt                ← subtitle-timeline
  video/                       ← video-render
    silent.mp4                   （中间产物）
    full-audio.wav               （中间产物）
    final.mp4                    （最终视频）
```

## 命名规则

### 编号（NNN）

- 三位数零填充：`001`, `002`, ..., `999`
- **自动递增**：扫描 `output/` 下匹配 `/^\d{3}-/` 的目录名，取最大编号 +1
- 不存在任何项目时从 `001` 开始

### Slug

- 用户在 `markdown-scriptwriter` 的 brainstorming 阶段确认
- 格式：kebab-case 英文短名（如 `cognitive-awakening`、`attention-mechanism`）
- 禁止中文、空格、特殊字符

### 示例

```
output/
  001-cognitive-awakening/
  002-attention-mechanism/
  003-claude-code-deep-dive/
```

## 路径约定

### 固定文件名清单

| 文件 | 路径（相对于项目目录） | 产出 skill |
|------|----------------------|-----------|
| 视频文案 | `script.md` | markdown-scriptwriter |
| HTML 幻灯片 | `presentation.html` | markdown-to-html |
| 背景纹理 | `paper-texture-bg.png` | markdown-to-html |
| 逐句音频 | `audio/scene-NN/NNN.wav` | tts-voiceover |
| TTS 清单 | `tts-manifest.json` | tts-voiceover |
| SRT 字幕 | `subtitles.srt` | subtitle-timeline |
| 无声视频 | `video/silent.mp4` | video-render |
| 完整音轨 | `video/full-audio.wav` | video-render |
| 最终视频 | `video/final.mp4` | video-render |

### manifest 内路径格式

`tts-manifest.json` 中所有路径使用**相对于项目目录**的相对路径：

```json
{
  "source": "script.md",
  "html_path": "presentation.html",
  "scenes": [
    {
      "lines": [
        {
          "audio_path": "audio/scene-01/001.wav"
        }
      ]
    }
  ]
}
```

### skill 如何定位文件

每个 skill 接收项目目录路径作为参数。内部拼接：

```
项目目录 + 固定文件名 = 完整路径
```

例如 `subtitle-timeline` 接收 `output/003-cognitive-awakening/`：
- manifest → `output/003-cognitive-awakening/tts-manifest.json`
- HTML → `output/003-cognitive-awakening/presentation.html`
- SRT 输出 → `output/003-cognitive-awakening/subtitles.srt`

## 各 skill 职责

### markdown-scriptwriter

1. brainstorming 阶段让用户确认项目 slug
2. 扫描 `output/` 目录，自动分配下一个编号
3. 创建项目目录 `output/<NNN>-<slug>/`
4. 输出 `script.md` 到项目目录

### markdown-to-html

1. 接收项目目录路径
2. 读取 `<项目目录>/script.md`
3. 输出 `presentation.html` + `paper-texture-bg.png` 到项目目录

### html-layout-review

1. 接收项目目录路径
2. 审查 `<项目目录>/presentation.html`
3. 无文件产物

### tts-voiceover

1. 接收项目目录路径
2. 读取 `<项目目录>/script.md`
3. 输出 `audio/scene-NN/NNN.wav` 到项目目录
4. 输出 `tts-manifest.json` 到项目目录（内部路径均为相对路径）

### subtitle-timeline

1. 接收项目目录路径
2. 读取 `<项目目录>/tts-manifest.json`
3. 从 manifest 的 `html_path` 定位 HTML（相对于项目目录）
4. 输出 `subtitles.srt` 到项目目录
5. 原地修改 HTML

### video-render

1. 接收项目目录路径
2. 读取 manifest、HTML、SRT、音频（全部通过项目目录 + 固定文件名定位）
3. 输出 `video/` 子目录到项目目录

## 不在本次范围

- 脚本代码的路径硬编码修改（后续逐步迁移）
- `project.json` 或 `projects.json` 等额外元数据文件
- 项目状态追踪机制
