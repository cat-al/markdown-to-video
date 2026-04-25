# 参考音频 (Reference Voice)

Qwen3-TTS Base 模型通过**声音克隆**生成语音，需要一段参考音频作为音色模板。

## 使用方法

1. 将一段 **3~10 秒**的清晰语音文件放到本目录，命名为 `speaker.wav`
2. 录音建议：安静环境、正常语速、清晰发音
3. 支持格式：wav / mp3
4. 如果知道参考音频中说的文字内容，可在配置中填入 `ref_text` 提升克隆效果

## 配置

参考 `.codebuddy/skills/tts-voiceover/config/tts-providers.yaml`：

```yaml
ref_audio: assets/ref-voice/speaker.wav
ref_text: "参考音频中说的文字内容"
```
