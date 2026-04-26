"""Qwen3-TTS local model adapter — uses official qwen-tts SDK."""

import os
import sys
import time
import wave

import soundfile as sf

from .base import TTSAdapter, TTSResult

# 参考音频约定路径
REF_VOICE_DIR = "assets/ref-voice"

# 参考音频时长限制
REF_AUDIO_MIN_SECONDS = 3
REF_AUDIO_MAX_SECONDS = 10
REF_AUDIO_RECOMMENDED_SECONDS = 5

# 单句合成异常时长阈值：每字符最大毫秒数
MAX_MS_PER_CHAR = 500
# 异常时长自动重试次数
MAX_RETRY_ON_ABNORMAL_DURATION = 2


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
        """检查参考音频是否存在并验证时长，不存在则给出明确提示。"""
        if not self.ref_audio:
            raise RuntimeError(
                f"未配置参考音频。\n"
                f"Qwen3-TTS Base 模型需要一段参考音频来克隆音色。\n"
                f"请将一段约 {REF_AUDIO_RECOMMENDED_SECONDS} 秒的清晰语音（wav/mp3）放到项目目录：\n"
                f"  {REF_VOICE_DIR}/\n"
                f"然后在 config/tts-providers.yaml 中设置：\n"
                f"  ref_audio: {REF_VOICE_DIR}/your-voice.wav\n"
                f"  ref_text: \"参考音频中说的文字内容\"  # 必填"
            )
        if not os.path.isfile(self.ref_audio):
            raise RuntimeError(
                f"参考音频文件不存在: {self.ref_audio}\n"
                f"Qwen3-TTS Base 模型需要一段参考音频来克隆音色。\n"
                f"请将一段约 {REF_AUDIO_RECOMMENDED_SECONDS} 秒的清晰语音（wav/mp3）放到项目目录：\n"
                f"  {REF_VOICE_DIR}/\n"
                f"然后在 config/tts-providers.yaml 中设置：\n"
                f"  ref_audio: {REF_VOICE_DIR}/speaker.wav\n"
                f"  ref_text: \"参考音频中说的文字内容\"  # 必填"
            )

        # 检查参考音频时长
        self._check_ref_audio_duration()

    def _check_ref_audio_duration(self):
        """检查参考音频时长并给出建议。"""
        try:
            info = sf.info(self.ref_audio)
            duration = info.duration
        except Exception as e:
            print(f"Warning: 无法读取参考音频时长: {e}", file=sys.stderr)
            return

        if duration > REF_AUDIO_MAX_SECONDS:
            print(
                f"⚠️  警告: 参考音频时长 {duration:.1f}s 超过推荐上限 {REF_AUDIO_MAX_SECONDS}s。\n"
                f"   过长的参考音频容易导致句首出现"嗯"/"嘿"等异常填充音。\n"
                f"   建议裁剪到约 {REF_AUDIO_RECOMMENDED_SECONDS}s，选取语气平稳的中间片段，\n"
                f"   避免选用以感叹/强语气开头的片段。",
                file=sys.stderr,
            )
        elif duration < REF_AUDIO_MIN_SECONDS:
            print(
                f"⚠️  警告: 参考音频时长 {duration:.1f}s 不足 {REF_AUDIO_MIN_SECONDS}s，"
                f"音色克隆效果可能不佳。建议使用约 {REF_AUDIO_RECOMMENDED_SECONDS}s 的音频。",
                file=sys.stderr,
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
        """Synthesize text to audio using local Qwen3-TTS Base model (voice clone).

        包含异常时长检测：如果生成时长超过 text长度 * MAX_MS_PER_CHAR，
        自动重试最多 MAX_RETRY_ON_ABNORMAL_DURATION 次。
        """
        if not text or not text.strip():
            self._write_empty_wav(output_path)
            return TTSResult(path=output_path, duration_ms=0)

        # 先检查参考音频，再加载模型（避免等半天模型加载完才报错）
        self._validate_ref_audio()
        self._load_model()

        max_expected_ms = len(text.strip()) * MAX_MS_PER_CHAR
        last_result = None

        for attempt in range(1 + MAX_RETRY_ON_ABNORMAL_DURATION):
            try:
                t0 = time.time()
                wavs, sr = self._model.generate_voice_clone(
                    text=text,
                    language=self.language.lower(),
                    ref_audio=self.ref_audio,
                    ref_text=self.ref_text,
                )
                elapsed_ms = int((time.time() - t0) * 1000)

                os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

                audio = wavs[0]
                if hasattr(audio, "cpu"):
                    audio = audio.cpu().numpy()

                sf.write(output_path, audio, sr)

                duration_ms = int(len(audio) / sr * 1000)
                last_result = TTSResult(path=output_path, duration_ms=duration_ms)

                # 异常时长检测
                if duration_ms > max_expected_ms:
                    if attempt < MAX_RETRY_ON_ABNORMAL_DURATION:
                        print(
                            f"⚠️  异常时长检测: 文本{len(text.strip())}字 → 生成{duration_ms}ms "
                            f"(阈值{max_expected_ms}ms, 耗时{elapsed_ms}ms)，"
                            f"自动重试 ({attempt + 1}/{MAX_RETRY_ON_ABNORMAL_DURATION})...",
                            file=sys.stderr,
                        )
                        continue
                    else:
                        print(
                            f"⚠️  异常时长警告: 文本{len(text.strip())}字 → 生成{duration_ms}ms "
                            f"(阈值{max_expected_ms}ms)，已重试{MAX_RETRY_ON_ABNORMAL_DURATION}次仍异常。",
                            file=sys.stderr,
                        )

                return last_result

            except Exception as e:
                raise RuntimeError(f"Qwen3-TTS synthesis failed: {e}")

        # 所有重试用完，返回最后一次结果
        return last_result

    def _write_empty_wav(self, path: str) -> None:
        """Write a valid but empty (0-sample) WAV file."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(b"")
