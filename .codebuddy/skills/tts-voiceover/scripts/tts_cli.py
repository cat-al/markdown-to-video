#!/usr/bin/env python3
"""TTS CLI — synthesize text to audio via pluggable TTS backends.

Usage:
    # 单句合成
    python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
      --text "要合成的文本" --output output/audio/scene-01/001.wav

    # 从文件读取文本
    python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
      --text-file /tmp/text.txt --output output/audio/scene-01/001.wav

    # 快速验证 TTS 全链路
    python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py --demo

    # 指定 demo 输出目录
    python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py --demo --demo-dir output/demo

Output:
    stdout: one line of JSON — {"path": "...", "duration_ms": N}
    stderr: log / error messages
    exit code: 0 on success, non-zero on failure
"""

import argparse
import json
import os
import sys
import time
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

    import importlib
    try:
        mod = importlib.import_module(module_name)
        adapter_cls = getattr(mod, class_name)
    except (ImportError, AttributeError) as e:
        print(f"Error: failed to load adapter {module_name}.{class_name}: {e}", file=sys.stderr)
        sys.exit(1)

    return adapter_cls(provider_config)


def run_synthesize(args):
    """单句合成模式。"""
    config = load_config(args.config)
    provider_name = args.provider or config.get("default", "qwen3-local")

    if args.text_file:
        if not os.path.exists(args.text_file):
            print(f"Error: text file not found: {args.text_file}", file=sys.stderr)
            sys.exit(1)
        with open(args.text_file, "r", encoding="utf-8") as f:
            text = f.read().strip()
    else:
        text = args.text

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    adapter = get_adapter(provider_name, config)

    try:
        result = adapter.synthesize(text, args.output)
    except Exception as e:
        print(f"Error: TTS synthesis failed: {e}", file=sys.stderr)
        sys.exit(1)

    output = {"path": result.path, "duration_ms": result.duration_ms}
    print(json.dumps(output, ensure_ascii=False))


def run_demo(args):
    """快速验证 TTS 全链路：加载模型 → 合成多句 → 输出结果。"""
    config = load_config(args.config)
    provider_name = args.provider or config.get("default", "qwen3-local")
    demo_dir = args.demo_dir or "output/tts-demo"

    os.makedirs(demo_dir, exist_ok=True)

    test_cases = [
        ("今天我们来聊一本非常有趣的书。", "001_intro.wav"),
        ("这本书的核心观点是，人类的认知能力远超我们的想象。", "002_content.wav"),
        ("科技改变生活，创新引领未来。", "003_short.wav"),
    ]

    print(f"{'=' * 50}", file=sys.stderr)
    print(f"TTS Demo — provider: {provider_name}", file=sys.stderr)
    print(f"Output: {demo_dir}/", file=sys.stderr)
    print(f"{'=' * 50}", file=sys.stderr)

    adapter = get_adapter(provider_name, config)
    results = []

    for text, filename in test_cases:
        output_path = os.path.join(demo_dir, filename)
        print(f"\n  '{text}'", file=sys.stderr)
        t0 = time.time()

        try:
            result = adapter.synthesize(text, output_path)
            elapsed = time.time() - t0
            print(
                f"  ✓ {result.duration_ms}ms | {elapsed:.1f}s | {filename}",
                file=sys.stderr,
            )
            results.append({
                "text": text,
                "path": result.path,
                "duration_ms": result.duration_ms,
                "synthesis_time_s": round(elapsed, 2),
            })
        except Exception as e:
            print(f"  ✗ {e}", file=sys.stderr)
            results.append({
                "text": text,
                "path": output_path,
                "error": str(e),
            })

    total_dur = sum(r.get("duration_ms", 0) for r in results)
    total_synth = sum(r.get("synthesis_time_s", 0) for r in results)
    ok = sum(1 for r in results if "error" not in r)

    print(f"\n{'=' * 50}", file=sys.stderr)
    print(
        f"Done: {ok}/{len(results)} OK | "
        f"audio {total_dur}ms | synth {total_synth:.1f}s",
        file=sys.stderr,
    )
    print(f"{'=' * 50}", file=sys.stderr)

    # stdout 输出结构化 JSON，方便脚本消费
    print(json.dumps({
        "provider": provider_name,
        "demo_dir": demo_dir,
        "results": results,
        "total_duration_ms": total_dur,
        "total_synthesis_time_s": round(total_synth, 2),
    }, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Synthesize text to audio via TTS backend."
    )

    # 公共参数
    parser.add_argument("--provider", type=str, default=None, help="TTS provider name (overrides config default)")
    parser.add_argument("--config", type=str, default=None, help="Path to tts-providers.yaml")

    # Demo 模式
    parser.add_argument("--demo", action="store_true", help="Run quick demo to verify TTS pipeline")
    parser.add_argument("--demo-dir", type=str, default=None, help="Output directory for demo files (default: output/tts-demo)")

    # 合成模式
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--text", type=str, help="Text to synthesize")
    group.add_argument("--text-file", type=str, help="File containing text to synthesize")
    parser.add_argument("--output", type=str, help="Output audio file path")

    args = parser.parse_args()

    if args.demo:
        run_demo(args)
    elif args.text or args.text_file:
        if not args.output:
            parser.error("--output is required for synthesis mode")
        run_synthesize(args)
    else:
        parser.error("Either --demo or (--text/--text-file + --output) is required")


if __name__ == "__main__":
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    main()
