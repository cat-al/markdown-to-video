"""Qwen3-TTS local model adapter."""

import os
import wave

from .base import TTSAdapter, TTSResult


class Qwen3LocalAdapter(TTSAdapter):
    """Adapter for local Qwen3-TTS model inference.

    Expects config keys:
        model_path: str  — path to model weights (~ expanded)
        sample_rate: int — output sample rate (default 24000)
        format: str      — output format (default "wav")
    """

    def __init__(self, config: dict):
        super().__init__(config)
        self.model_path = os.path.expanduser(config.get("model_path", ""))
        self.sample_rate = int(config.get("sample_rate", 24000))
        self.format = config.get("format", "wav")
        self._model = None

    def _load_model(self):
        """Lazy-load the Qwen3-TTS model."""
        if self._model is not None:
            return

        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch
        except ImportError as e:
            raise RuntimeError(
                f"Qwen3-TTS requires 'transformers' and 'torch'. Install them first.\n{e}"
            )

        if not os.path.isdir(self.model_path):
            raise RuntimeError(
                f"Model path does not exist: {self.model_path}\n"
                "Download Qwen3-TTS model and set 'model_path' in config/tts-providers.yaml."
            )

        self._tokenizer = AutoTokenizer.from_pretrained(
            self.model_path, trust_remote_code=True
        )
        self._model = AutoModelForCausalLM.from_pretrained(
            self.model_path, trust_remote_code=True
        )
        # Move to GPU if available
        if torch.cuda.is_available():
            self._model = self._model.cuda()

    def synthesize(self, text: str, output_path: str) -> TTSResult:
        """Synthesize text to audio using local Qwen3-TTS model."""
        # Handle empty text
        if not text or not text.strip():
            self._write_empty_wav(output_path)
            return TTSResult(path=output_path, duration_ms=0)

        self._load_model()
        import torch

        # Qwen3-TTS inference
        # NOTE: Actual inference API depends on the specific Qwen3-TTS version.
        # This is the expected interface based on HuggingFace transformers convention.
        try:
            inputs = self._tokenizer(
                text, return_tensors="pt", padding=True
            )
            if torch.cuda.is_available():
                inputs = {k: v.cuda() for k, v in inputs.items()}

            with torch.no_grad():
                # The model's generate method should return audio tokens/waveform
                # Adjust based on actual Qwen3-TTS API
                outputs = self._model.generate(
                    **inputs,
                    max_new_tokens=4096,
                )

            # Extract audio waveform from model output
            # NOTE: This section may need adjustment based on actual Qwen3-TTS output format
            if hasattr(outputs, "audio") or hasattr(outputs, "waveform"):
                audio_data = getattr(outputs, "audio", None) or getattr(outputs, "waveform")
                if hasattr(audio_data, "cpu"):
                    audio_data = audio_data.cpu().numpy()
            else:
                # Fallback: treat output tokens as audio codec tokens
                # and decode them — this depends on the specific model architecture
                raise RuntimeError(
                    "Qwen3-TTS model output format not recognized. "
                    "Please check model version and update the adapter accordingly."
                )

            # Write WAV file
            self._write_wav(output_path, audio_data)
            duration_ms = int(len(audio_data) / self.sample_rate * 1000)

            return TTSResult(path=output_path, duration_ms=duration_ms)

        except Exception as e:
            raise RuntimeError(f"Qwen3-TTS synthesis failed: {e}")

    def _write_wav(self, path: str, audio_data) -> None:
        """Write audio data to WAV file."""
        import numpy as np

        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

        # Normalize to int16
        if audio_data.dtype != np.int16:
            audio_float = audio_data.astype(np.float32)
            max_val = max(abs(audio_float.max()), abs(audio_float.min()), 1e-8)
            audio_int16 = (audio_float / max_val * 32767).astype(np.int16)
        else:
            audio_int16 = audio_data

        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self.sample_rate)
            wf.writeframes(audio_int16.tobytes())

    def _write_empty_wav(self, path: str) -> None:
        """Write a valid but empty (0-sample) WAV file."""
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(b"")
