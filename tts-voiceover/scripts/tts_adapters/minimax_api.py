"""MiniMax TTS API adapter — placeholder for future implementation."""

from .base import TTSAdapter, TTSResult


class MiniMaxAPIAdapter(TTSAdapter):
    """Adapter for MiniMax TTS API.

    Expects config keys:
        endpoint: str        — API endpoint URL
        api_key_env: str     — environment variable name for API key
        format: str          — output format (default "mp3")

    Status: NOT YET IMPLEMENTED — placeholder for future use.
    """

    def synthesize(self, text: str, output_path: str) -> TTSResult:
        raise NotImplementedError(
            "MiniMax TTS adapter is not yet implemented. "
            "Contributions welcome — see tts_adapters/base.py for the interface."
        )
