#!/usr/bin/env python3
"""TTS CLI — synthesize text to audio via pluggable TTS backends.

Usage:
    python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
      --text "要合成的文本" --output output/audio/scene-01/001.wav
    python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
      --text-file /tmp/text.txt --output output/audio/scene-01/001.wav

Output:
    stdout: one line of JSON — {"path": "...", "duration_ms": N}
    stderr: error messages (if any)
    exit code: 0 on success, non-zero on failure
"""

import argparse
import json
import os
import sys
from typing import Optional

import yaml


# ── Provider → Adapter class mapping ──

ADAPTER_MAP = {
    "qwen3-local": ("tts_adapters.qwen3_local", "Qwen3LocalAdapter"),
    "minimax":     ("tts_adapters.minimax_api",  "MiniMaxAPIAdapter"),
    "mimo-v2":     ("tts_adapters.mimo_v2_api",  "MiMoV2APIAdapter"),
}


def load_config(config_path: Optional[str] = None) -> dict:
    """Load TTS provider configuration from YAML."""
    if config_path is None:
        # Default: config/tts-providers.yaml relative to this script's directory
        scripts_dir = os.path.dirname(os.path.abspath(__file__))
        skill_dir = os.path.dirname(scripts_dir)
        config_path = os.path.join(skill_dir, "config", "tts-providers.yaml")

    if not os.path.exists(config_path):
        print(f"Error: config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_adapter(provider_name: str, config: dict):
    """Instantiate the appropriate TTS adapter for the given provider."""
    providers = config.get("providers", {})
    if provider_name not in providers:
        print(
            f"Error: unknown provider '{provider_name}'. "
            f"Available: {', '.join(providers.keys())}",
            file=sys.stderr,
        )
        sys.exit(1)

    provider_config = providers[provider_name]

    if provider_name not in ADAPTER_MAP:
        print(
            f"Error: no adapter registered for provider '{provider_name}'.",
            file=sys.stderr,
        )
        sys.exit(1)

    module_name, class_name = ADAPTER_MAP[provider_name]

    # Import adapter class dynamically
    import importlib
    try:
        mod = importlib.import_module(module_name)
        adapter_cls = getattr(mod, class_name)
    except (ImportError, AttributeError) as e:
        print(f"Error: failed to load adapter {module_name}.{class_name}: {e}", file=sys.stderr)
        sys.exit(1)

    return adapter_cls(provider_config)


def main():
    parser = argparse.ArgumentParser(
        description="Synthesize text to audio via TTS backend."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--text", type=str, help="Text to synthesize")
    group.add_argument("--text-file", type=str, help="File containing text to synthesize")
    parser.add_argument("--output", type=str, required=True, help="Output audio file path")
    parser.add_argument("--provider", type=str, default=None, help="TTS provider name (overrides config default)")
    parser.add_argument("--config", type=str, default=None, help="Path to tts-providers.yaml")

    args = parser.parse_args()

    # Load config
    config = load_config(args.config)

    # Determine provider
    provider_name = args.provider or config.get("default", "qwen3-local")

    # Get text
    if args.text_file:
        if not os.path.exists(args.text_file):
            print(f"Error: text file not found: {args.text_file}", file=sys.stderr)
            sys.exit(1)
        with open(args.text_file, "r", encoding="utf-8") as f:
            text = f.read().strip()
    else:
        text = args.text

    # Create output directory
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # Get adapter and synthesize
    adapter = get_adapter(provider_name, config)

    try:
        result = adapter.synthesize(text, args.output)
    except Exception as e:
        print(f"Error: TTS synthesis failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Output result as JSON to stdout
    output = {"path": result.path, "duration_ms": result.duration_ms}
    print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    # Add scripts directory to path so adapters can be imported
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    main()
