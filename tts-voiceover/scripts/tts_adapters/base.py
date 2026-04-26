"""TTSAdapter abstract base class — contract for all TTS backends."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TTSResult:
    """Result of a TTS synthesis call."""
    path: str           # 输出音频文件路径
    duration_ms: int    # 音频时长（毫秒）


class TTSAdapter(ABC):
    """Abstract base class for TTS backends.

    Subclasses must implement `synthesize()`.
    The adapter is initialized with its provider config dict from tts-providers.yaml.
    """

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    def synthesize(self, text: str, output_path: str) -> TTSResult:
        """将文本合成为音频文件，返回路径和时长。

        Args:
            text: 要合成的文本
            output_path: 输出音频文件路径

        Returns:
            TTSResult with path and duration_ms

        Raises:
            RuntimeError: TTS 合成失败
        """
        ...
