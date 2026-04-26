# 产物目录约定

所有 skill 生成的文件统一存放在按项目隔离的目录中。

## 目录结构

```
output/<NNN>-<slug>/
  script.md                    ← markdown-scriptwriter
  presentation.html            ← markdown-to-html
  paper-texture-bg.png         ← markdown-to-html
  audio/                       ← tts-voiceover
    scene-01/001.wav
    scene-02/001.wav
    ...
  tts-manifest.json            ← tts-voiceover
  subtitles.srt                ← subtitle-timeline
  video/                       ← video-render
    silent.mp4
    full-audio.wav
    final.mp4
```

## 命名规则

- **编号**：三位数零填充（`001`, `002`, ...），自动递增
- **Slug**：kebab-case 英文短名，用户在 brainstorming 阶段确认
- 自动分配：扫描 `output/` 下匹配 `/^\d{3}-/` 的目录，最大编号 +1

## 固定文件名

| 产物 | 相对路径 | 产出 skill |
|------|---------|-----------|
| 视频文案 | `script.md` | markdown-scriptwriter |
| HTML 幻灯片 | `presentation.html` | markdown-to-html |
| 背景纹理 | `paper-texture-bg.png` | markdown-to-html |
| 逐句音频 | `audio/scene-NN/NNN.wav` | tts-voiceover |
| TTS 清单 | `tts-manifest.json` | tts-voiceover |
| SRT 字幕 | `subtitles.srt` | subtitle-timeline |
| 无声视频 | `video/silent.mp4` | video-render |
| 完整音轨 | `video/full-audio.wav` | video-render |
| 最终视频 | `video/final.mp4` | video-render |

## 路径使用规则

1. **每个 skill 接收项目目录路径作为参数**，用户在调用时附带
2. **manifest 内路径全部使用相对于项目目录的相对路径**
3. **skill 内部定位文件**：`项目目录 + 固定文件名`

### manifest 路径示例

```json
{
  "source": "script.md",
  "html_path": "presentation.html",
  "scenes": [{
    "lines": [{
      "audio_path": "audio/scene-01/001.wav"
    }]
  }]
}
```

## 项目创建流程

1. `markdown-scriptwriter` brainstorming 阶段确认 slug
2. 扫描 `output/` 自动分配编号
3. 创建 `output/<NNN>-<slug>/` 目录
4. 后续所有 skill 调用时，用户带上此目录路径
