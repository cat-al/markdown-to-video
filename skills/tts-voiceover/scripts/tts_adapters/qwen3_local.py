"""Qwen3-TTS local model adapter — uses official qwen-tts SDK."""

import os
import sys
import wave

import soundfile as sf

from .base import TTSAdapter, TTSResult

# 参考音频约定路径
REF_VOICE_DIR = "assets/ref-voice"


class Qwen3LocalAdapter(TTSAdapter):
    """Adapter for local Qwen3-TTS Base model via qwen-tts SDK (voice clone).

    Base 模型通过声音克隆生成语音，**必须**提供一段参考音频。
    用户需将参考音频放到项目根目录 assets/ref-voice/ 下，
    并在 config/tts-providers.yaml 的 ref_audio 字段指定文件名。

    Expects config keys:
        model_path: str   — 模型权重路径（相对 CWD 或绝对路径）
        sample_rate: int  — 输出采样率 (default 24000)
        format: str       — 输出格式 (default "wav")
        language: str     — 合成语言 (default "chinese")
        ref_audio: str    — 参考音频文件路径（必填，相对项目根目录）
        ref_text: str     — 参考音频对应的文字（必填，用于声音克隆对齐）
    """

    def __init__(self, config: dict):
        super().__init__(config)
        raw_path = config.get("model_path", "")
        if not os.path.isabs(raw_path):
            self.model_path = os.path.abspath(raw_path)
        else:
            self.model_path = os.path.expanduser(raw_path)
        self.sample_rate = int(config.get("sample_rate", 24000))
        self.format = config.get("format", "wav")
        self.language = config.get("language", "chinese")

        # 参考音频 — 必填
        ref_audio_raw = config.get("ref_audio", "")
        if ref_audio_raw and not os.path.isabs(ref_audio_raw):
            self.ref_audio = os.path.abspath(ref_audio_raw)
        else:
            self.ref_audio = ref_audio_raw or ""

        # 参考文本 — 必填
        self.ref_text = config.get("ref_text") or None
        if not self.ref_text:
            raise RuntimeError(
                "未配置参考文本 ref_text。\n"
                "Qwen3-TTS Base 模型需要参考文本来对齐声音克隆。\n"
                "请在 config/tts-providers.yaml 中设置：\n"
                '  ref_text: "参考音频中说的文字内容"'
            )

        self._model = None

    def _validate_ref_audio(self):
        """检查参考音频是否存在，不存在则给出明确提示。"""
        if not self.ref_audio:
            raise RuntimeError(
                f"未配置参考音频。\n"
                f"Qwen3-TTS Base 模型需要一段参考音频来克隆音色。\n"
                f"请将一段 3~10 秒的清晰语音（wav/mp3）放到项目目录：\n"
                f"  {REF_VOICE_DIR}/\n"
                f"然后在 config/tts-providers.yaml 中设置：\n"
                f"  ref_audio: {REF_VOICE_DIR}/your-voice.wav"
            )
        if not os.path.isfile(self.ref_audio):
            raise RuntimeError(
                f"参考音频文件不存在: {self.ref_audio}\n"
                f"Qwen3-TTS Base 模型需要一段参考音频来克隆音色。\n"
                f"请将一段 3~10 秒的清晰语音（wav/mp3）放到项目目录：\n"
                f"  {REF_VOICE_DIR}/\n"
                f"然后在 config/tts-providers.yaml 中设置：\n"
                f"  ref_audio: {REF_VOICE_DIR}/speaker.wav\n"
                f"  ref_text: \"参考音频中说的文字内容\"  # 可选，提供后效果更好"
            )

    def _load_model(self):
        """Lazy-load the Qwen3-TTS model via qwen-tts SDK."""
        if self._model is not None:
            return

        try:
            import torch
            from qwen_tts import Qwen3TTSModel
        except ImportError as e:
            raise RuntimeError(
                f"Qwen3-TTS requires 'qwen-tts' and 'torch'. "
                f"Install: pip install qwen-tts\n{e}"
            )

        if not os.path.isdir(self.model_path):
            raise RuntimeError(
                f"Model path does not exist: {self.model_path}\n"
                "Download Qwen3-TTS model and set 'model_path' in config/tts-providers.yaml."
            )

        if torch.cuda.is_available():
            device_map = "cuda:0"
            dtype = torch.bfloat16
        elif torch.backends.mps.is_available():
            device_map = "mps"
            dtype = torch.float32
        else:
            device_map = "cpu"
            dtype = torch.float32

        print(f"Loading Qwen3-TTS model from {self.model_path} on {device_map}...", file=sys.stderr)

        self._model = Qwen3TTSModel.from_pretrained(
            self.model_path,
            device_map=device_map,
            dtype=dtype,
        )
        self._device = device_map
        print("Model loaded successfully.", file=sys.stderr)

    def synthesize(self, text: str, output_path: str) -> TTSResult:
        """Synthesize text to audio using local Qwen3-TTS Base model (voice clone)."""
        if not text or not text.strip():
            self._write_empty_wav(output_path)
            return TTSResult(path=output_path, duration_ms=0)

        # 先检查参考音频，再加载模型（避免等半天模型加载完才报错）
        self._validate_ref_audio()
        self._load_model()

        try:
            wavs, sr = self._model.generate_voice_clone(
                text=text,
                language=self.language.lower(),
                ref_audio=self.ref_audio,
                ref_text=self.ref_text,
            )

            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

            audio = wavs[0]
            if hasattr(audio, "cpu"):
                audio = audio.cpu().numpy()

            sf.write(output_path, audio, sr)

            duration_ms = int(len(audio) / sr * 1000)
            return TTSResult(path=output_path, duration_ms=duration_ms)

        except Exception as e:
            raise RuntimeError(f"Qwen3-TTS synthesis failed: {e}")

    def _write_empty_wav(self, path: str) -> None:
        """Write a valid but empty (0-sample) WAV file."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(b"")
