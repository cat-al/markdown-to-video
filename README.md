# markdown-to-video2

一个面向 **`Markdown -> 视频`** 的 skill 项目。

目标是参考 **superpowers 的多子 skill 组织方式**，把视频生成流程拆成多个可组合的阶段，每个子 skill 只负责一件事，最终串起从内容输入到视频输出的完整链路。

## 当前进度

已落地五个模块，覆盖从文案到配音/字幕/时间轴的完整链路：

1. `markdown-scriptwriter`：生成结构化的视频文案 Markdown
2. `markdown-to-html`：将标准 Markdown 转成 16:9 宽屏 HTML 动画幻灯片
3. `html-layout-review`：对 HTML 页面做 `1920x1080` 画布视觉验收
4. `tts-voiceover`：解析文案字幕行，逐句调用 TTS 生成配音音频 + `tts-manifest.json`
5. `subtitle-timeline`：消费 manifest + HTML，生成 SRT 字幕并用真实音频时长重写时间轴

## 完整链路

```
内容/想法
    ↓
markdown-scriptwriter → Markdown 文案
    ├──→ markdown-to-html → HTML（stepConfig duration 为估算值）
    │         ↓
    │    html-layout-review → 视觉验收
    │
    └──→ tts-voiceover → 音频文件 + tts-manifest.json
                                    ↓
                          subtitle-timeline
                              ├── subtitles.srt
                              └── 原地修改 HTML（重写 stepConfig.duration + timelineConfig.scenes[].duration）
                                    ↓
                              【下一步：视频输出】
```

`tts-voiceover` 和 `markdown-to-html` 是**平行**关系，都以 Markdown 文案为输入。`subtitle-timeline` 在两者之后，消费两者的输出。

## TTS 基础设施

TTS 配音通过可插拔的适配器架构支持多后端，脚本和配置位于 `tts-voiceover` skill 内部：

```
.codebuddy/skills/tts-voiceover/
  SKILL.md
  config/
    tts-providers.yaml              # 供应商配置
  scripts/
    tts_cli.py                      # CLI 入口
    tts_adapters/
      base.py                       # TTSAdapter 抽象基类
      qwen3_local.py                # Qwen3-TTS 本地模型（默认）
      minimax_api.py                # MiniMax API（预留）
      mimo_v2_api.py                # MiMo-V2 API（预留）
```

使用方式：

```bash
python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
  --text "要合成的文本" --output output/audio/scene-01/001.wav
```

切换后端只需修改 skill 内 `config/tts-providers.yaml` 的 `default` 字段或传 `--provider` 参数。

## 设计方向

- 参考 superpowers 的多个子 skill 设计
- 每个阶段独立演进、可替换、可组合
- 两个 skill 通过 `tts-manifest.json` 作为契约格式解耦
- TTS 后端通过适配器模式支持本地模型和外部 API 切换
