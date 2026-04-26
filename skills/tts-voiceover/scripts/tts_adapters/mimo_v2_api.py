"""MiMo-V2 TTS API adapter — placeholder for future implementation."""

from .base import TTSAdapter, TTSResult


class MiMoV2APIAdapter(TTSAdapter):
    """Adapter for MiMo-V2 TTS API.

    Expects config keys:
        endpoint: str        — API endpoint URL
        api_key_env: str     — environment variable name for API key
        format: str          — output format (default "wav")

    Status: NOT YET IMPLEMENTED — placeholder for future use.
    """

    def synthesize(self, text: str, output_path: str) -> TTSResult:
        raise NotImplementedError(
            "MiMo-V2 TTS adapter is not yet implemented. "
            "Contributions welcome — see tts_adapters/base.py for the interface."
        )
