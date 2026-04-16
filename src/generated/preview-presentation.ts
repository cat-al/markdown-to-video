import type {MarkdownPresentation} from '../markdown';

export const previewMarkdown = "---\ntitle: Patrick Voice Clone Demo\nsubtitle: 先用仓库内录音接通 Qwen3 Base，再逐步补齐转写\nthemeColor: #ec4899\nttsProvider: qwen-local\nttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-Base\nttsLanguage: Chinese\nttsReferenceAudio: ../findings.wav\nttsXVectorOnlyMode: true\n---\n# Qwen3-TTS Base 语音克隆\n\n这份示例已经接入仓库里的 `examples/findings.wav`，用于先把派大星参考音色跑通。\n\n- `ttsReferenceAudio` 指向 `examples/findings.wav`\n- 当前先使用 `ttsXVectorOnlyMode: true`，所以**只有参考音频也能直接试听**\n- 等你补上逐字转写后，再把 `ttsReferenceText` 填回 frontmatter，效果通常会更稳\n\n<!-- voiceover\n这一页演示的是 Qwen3-TTS Base 模型的语音克隆模式。我们已经把仓库里的派大星参考录音接进来了，所以现在就可以直接试听第一版效果。后续如果补上逐字转写，整体的咬字和韵律通常还会再稳一些。\n-->\n\n---\n\n## 推荐工作流\n\n1. 先用当前 `findings.wav` 跑单页试听，确认音色方向对不对\n2. 如果音色对了，再补一版逐字转写，关闭 `ttsXVectorOnlyMode`\n3. 最后整篇渲染，必要时用 `npm run tts:redo` 单页重做\n\n<!-- voiceover\n现在最适合的工作流，是先用现有的参考录音跑单页试听，确认派大星的感觉有没有出来。如果方向对，再把参考文本按听写稿补进去，这样咬字和停顿通常会更稳定。最后再做整篇渲染，有问题的页也可以单独重生成音频。\n-->\n";

export const previewPresentation: MarkdownPresentation = {
  "meta": {
    "title": "Patrick Voice Clone Demo",
    "subtitle": "先用仓库内录音接通 Qwen3 Base，再逐步补齐转写",
    "themeColor": "#ec4899",
    "ttsProvider": "qwen-local",
    "ttsModel": "/Users/bierchen/project-person/markdown-to-video/.models/Qwen3-TTS-12Hz-0.6B-Base",
    "ttsLanguage": "Chinese",
    "ttsReferenceAudio": "/Users/bierchen/project-person/markdown-to-video/examples/findings.wav",
    "ttsXVectorOnlyMode": true,
    "ttsVoice": "Vivian",
    "ttsRate": 185,
    "ttsInstruction": "",
    "ttsReferenceText": ""
  },
  "slides": [
    {
      "id": "slide-1",
      "heading": "Qwen3-TTS Base 语音克隆",
      "markdown": "# Qwen3-TTS Base 语音克隆\n\n这份示例已经接入仓库里的 `examples/findings.wav`，用于先把派大星参考音色跑通。\n\n- `ttsReferenceAudio` 指向 `examples/findings.wav`\n- 当前先使用 `ttsXVectorOnlyMode: true`，所以**只有参考音频也能直接试听**\n- 等你补上逐字转写后，再把 `ttsReferenceText` 填回 frontmatter，效果通常会更稳",
      "narration": "这一页演示的是 Qwen3-TTS Base 模型的语音克隆模式。我们已经把仓库里的派大星参考录音接进来了，所以现在就可以直接试听第一版效果。后续如果补上逐字转写，整体的咬字和韵律通常还会再稳一些。",
      "wordCount": 49,
      "durationInFrames": 602,
      "captionCues": [
        {
          "id": "cue-1",
          "text": "这一页演示的是 Qwen3-TTS Base 模型的语音克隆模式。",
          "startFrame": 0,
          "endFrame": 184
        },
        {
          "id": "cue-2",
          "text": "我们已经把仓库里的派大星参考录音接进来了，",
          "startFrame": 184,
          "endFrame": 313
        },
        {
          "id": "cue-3",
          "text": "所以现在就可以直接试听第一版效果。",
          "startFrame": 313,
          "endFrame": 417
        },
        {
          "id": "cue-4",
          "text": "后续如果补上逐字转写，",
          "startFrame": 417,
          "endFrame": 484
        },
        {
          "id": "cue-5",
          "text": "整体的咬字和韵律通常还会再稳一些。",
          "startFrame": 484,
          "endFrame": 588
        }
      ],
      "audioSrc": "generated/qwen-base-clone/slide-01.wav",
      "audioDurationInFrames": 588
    },
    {
      "id": "slide-2",
      "heading": "推荐工作流",
      "markdown": "## 推荐工作流\n\n1. 先用当前 `findings.wav` 跑单页试听，确认音色方向对不对\n2. 如果音色对了，再补一版逐字转写，关闭 `ttsXVectorOnlyMode`\n3. 最后整篇渲染，必要时用 `npm run tts:redo` 单页重做",
      "narration": "现在最适合的工作流，是先用现有的参考录音跑单页试听，确认派大星的感觉有没有出来。如果方向对，再把参考文本按听写稿补进去，这样咬字和停顿通常会更稳定。最后再做整篇渲染，有问题的页也可以单独重生成音频。",
      "wordCount": 37,
      "durationInFrames": 667,
      "captionCues": [
        {
          "id": "cue-1",
          "text": "现在最适合的工作流，",
          "startFrame": 0,
          "endFrame": 66
        },
        {
          "id": "cue-2",
          "text": "是先用现有的参考录音跑单页试听，",
          "startFrame": 66,
          "endFrame": 172
        },
        {
          "id": "cue-3",
          "text": "确认派大星的感觉有没有出来。",
          "startFrame": 172,
          "endFrame": 264
        },
        {
          "id": "cue-4",
          "text": "如果方向对，",
          "startFrame": 264,
          "endFrame": 304
        },
        {
          "id": "cue-5",
          "text": "再把参考文本按听写稿补进去，",
          "startFrame": 304,
          "endFrame": 396
        },
        {
          "id": "cue-6",
          "text": "这样咬字和停顿通常会更稳定。",
          "startFrame": 396,
          "endFrame": 488
        },
        {
          "id": "cue-7",
          "text": "最后再做整篇渲染，有问题的页也可以单独重生成音频。",
          "startFrame": 488,
          "endFrame": 653
        }
      ],
      "audioSrc": "generated/qwen-base-clone/slide-02.wav",
      "audioDurationInFrames": 653
    }
  ],
  "totalFrames": 1269
};
