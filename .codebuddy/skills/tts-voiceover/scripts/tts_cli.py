#!/usr/bin/env python3
"""TTS CLI — synthesize text to audio via pluggable TTS backends.

Usage:
    # 批量合成（推荐）
    python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
      --batch script.md --output-dir output/audio \
      --html-path output/presentation.html --provider qwen3-local

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
    --batch mode:
        stdout: structured JSON summary (provider, counts, total_audio_ms, etc.)
        stderr: progress display per sentence
    single mode:
        stdout: one line of JSON — {"path": "...", "duration_ms": N}
        stderr: log / error messages
    exit code: 0 on success, non-zero on failure
"""

import argparse
import json
import os
import re
import sys
import time
import wave
from datetime import datetime
from typing import Optional, List, Dict, Any

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


def parse_markdown(filepath: str) -> List[Dict[str, Any]]:
    """解析 Markdown 文案，提取场景和字幕段落。

    连续 > 行（中间无空行）合并为一段，空行分隔段落。
    每段对应一个 step / 一个 TTS 音频 / 一条 SRT 字幕。

    返回格式:
    [
        {
            "scene_number": 1,
            "title": "场景标题",
            "lines": ["段落1文本", "段落2文本", ...]
        },
        ...
    ]
    """
    scene_title_re = re.compile(r'^## 场景(\d+)[：:]\s*(.+)$')
    subtitle_re = re.compile(r'^>\s*(.+)$')

    scenes: List[Dict[str, Any]] = []
    current_scene: Optional[Dict[str, Any]] = None
    in_code_block = False

    with open(filepath, 'r', encoding='utf-8') as f:
        all_lines = [line.rstrip('\n') for line in f]

    idx = 0
    while idx < len(all_lines):
        line = all_lines[idx]

        # 代码块围栏切换
        if line.startswith('```'):
            in_code_block = not in_code_block
            idx += 1
            continue

        if in_code_block:
            idx += 1
            continue

        # 场景标题
        m = scene_title_re.match(line)
        if m:
            current_scene = {
                "scene_number": int(m.group(1)),
                "title": m.group(2).strip(),
                "lines": [],
            }
            scenes.append(current_scene)
            idx += 1
            continue

        # 字幕段落：连续 > 行合并为一段
        if current_scene is not None:
            m = subtitle_re.match(line)
            if m:
                paragraph_parts = [m.group(1).strip()]
                idx += 1
                while idx < len(all_lines):
                    next_m = subtitle_re.match(all_lines[idx])
                    if next_m:
                        paragraph_parts.append(next_m.group(1).strip())
                        idx += 1
                    else:
                        break
                current_scene["lines"].append(' '.join(paragraph_parts))
                continue

        idx += 1

    return scenes


def _write_empty_wav(path: str) -> None:
    """生成一个 0 采样的空 WAV 文件（用于失败的句子）。"""
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(b'')


def run_batch(args):
    """批量合成模式：解析 Markdown → 逐句合成（带进度条）→ 生成 tts-manifest.json。"""
    md_path = args.batch
    output_dir = args.output_dir or "output/audio"
    html_path = args.html_path or ""

    # ── 验证 Markdown 文件 ──
    if not os.path.exists(md_path):
        print(f"Error: Markdown 文件不存在: {md_path}", file=sys.stderr)
        sys.exit(1)

    try:
        scenes = parse_markdown(md_path)
    except UnicodeDecodeError as e:
        print(f"Error: Markdown 文件编码错误（需要 UTF-8）: {e}", file=sys.stderr)
        sys.exit(1)

    # 检查解析结果
    total_lines = sum(len(s["lines"]) for s in scenes)
    if not scenes or total_lines == 0:
        print("Warning: Markdown 文件中未找到任何场景或字幕行。", file=sys.stderr)
        sys.exit(1)

    # ── 加载配置和适配器 ──
    config = load_config(args.config)
    provider_name = args.provider or config.get("default", "qwen3-local")
    adapter = get_adapter(provider_name, config)

    # ── 打印头部 ──
    sep = "═" * 50
    print(f"\n{sep}", file=sys.stderr)
    print(f"TTS 批量合成 — provider: {provider_name}", file=sys.stderr)
    print(f"源文件: {md_path} → {output_dir}/", file=sys.stderr)
    print(f"{sep}", file=sys.stderr)

    # ── 逐句合成 ──
    global_idx = 0
    success_count = 0
    failed_count = 0
    total_audio_ms = 0
    total_synthesis_s = 0.0
    manifest_scenes: List[Dict[str, Any]] = []

    for scene in scenes:
        sn = scene["scene_number"]
        scene_dir_name = f"scene-{sn:02d}"
        scene_dir = os.path.join(output_dir, scene_dir_name)
        os.makedirs(scene_dir, exist_ok=True)

        print(f"\n场景{sn}：{scene['title']} ({len(scene['lines'])}句)", file=sys.stderr)

        manifest_lines: List[Dict[str, Any]] = []

        for line_idx, text in enumerate(scene["lines"]):
            global_idx += 1
            filename = f"{line_idx + 1:03d}.wav"
            rel_path = os.path.join(output_dir, scene_dir_name, filename)
            abs_path = os.path.abspath(rel_path)

            t0 = time.time()
            try:
                result = adapter.synthesize(text, abs_path)
                elapsed = time.time() - t0
                duration_ms = result.duration_ms
                success_count += 1
                total_audio_ms += duration_ms
                total_synthesis_s += elapsed

                audio_s = duration_ms / 1000.0
                print(
                    f"  [{global_idx}/{total_lines}] {scene_dir_name}/{filename} "
                    f"✓ 音频:{audio_s:.1f}s 合成:{elapsed:.1f}s",
                    file=sys.stderr,
                )

                manifest_lines.append({
                    "index": line_idx,
                    "text": text,
                    "audio_path": rel_path,
                    "duration_ms": duration_ms,
                })

            except Exception as e:
                elapsed = time.time() - t0
                failed_count += 1
                total_synthesis_s += elapsed

                print(
                    f"  [{global_idx}/{total_lines}] {scene_dir_name}/{filename} "
                    f"✗ 错误: {e}",
                    file=sys.stderr,
                )

                # 生成空 WAV 文件
                try:
                    _write_empty_wav(abs_path)
                except Exception:
                    pass

                manifest_lines.append({
                    "index": line_idx,
                    "text": text,
                    "audio_path": rel_path,
                    "duration_ms": 0,
                })

        manifest_scenes.append({
            "scene_id": f"scene_{sn}",
            "scene_number": sn,
            "title": scene["title"],
            "lines": manifest_lines,
        })

    # ── 生成 tts-manifest.json ──
    manifest_dir = os.path.dirname(output_dir.rstrip("/"))
    if not manifest_dir:
        manifest_dir = "."
    manifest_path = os.path.join(manifest_dir, "tts-manifest.json")

    manifest = {
        "source": os.path.basename(md_path),
        "html_path": html_path,
        "provider": provider_name,
        "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "scenes": manifest_scenes,
    }

    os.makedirs(manifest_dir, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # ── 打印尾部摘要 ──
    total_audio_s = total_audio_ms / 1000.0
    synth_min = int(total_synthesis_s) // 60
    synth_sec = int(total_synthesis_s) % 60
    synth_str = f"{synth_min}m{synth_sec:02d}s" if synth_min > 0 else f"{synth_sec}s"

    print(f"\n{sep}", file=sys.stderr)
    print(
        f"完成: {success_count + failed_count}/{total_lines} 句 | "
        f"{len(scenes)}个场景 | "
        f"总音频 {total_audio_s:.1f}s | "
        f"合成耗时 {synth_str}",
        file=sys.stderr,
    )
    if failed_count > 0:
        print(f"⚠ 失败: {failed_count} 句", file=sys.stderr)
    print(f"tts-manifest.json 已生成 → {manifest_path}", file=sys.stderr)
    print(f"{sep}\n", file=sys.stderr)

    # ── stdout 输出结构化 JSON ──
    print(json.dumps({
        "provider": provider_name,
        "source": os.path.basename(md_path),
        "output_dir": output_dir,
        "manifest_path": manifest_path,
        "total_scenes": len(scenes),
        "total_lines": total_lines,
        "success": success_count,
        "failed": failed_count,
        "total_audio_ms": total_audio_ms,
        "total_synthesis_s": round(total_synthesis_s, 2),
    }, ensure_ascii=False, indent=2))

    # 全部失败时 exit code 非零
    if success_count == 0 and failed_count > 0:
        sys.exit(1)


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

    # 合成模式（互斥组）
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--text", type=str, help="Text to synthesize")
    group.add_argument("--text-file", type=str, help="File containing text to synthesize")
    group.add_argument("--batch", type=str, help="Markdown file for batch synthesis")
    parser.add_argument("--output", type=str, help="Output audio file path (single mode)")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory for batch mode (default: output/audio)")
    parser.add_argument("--html-path", type=str, default=None, help="HTML file path to write into manifest")

    args = parser.parse_args()

    if args.demo:
        run_demo(args)
    elif args.batch:
        run_batch(args)
    elif args.text or args.text_file:
        if not args.output:
            parser.error("--output is required for synthesis mode")
        run_synthesize(args)
    else:
        parser.error("Either --demo, --batch, or (--text/--text-file + --output) is required")


if __name__ == "__main__":
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    main()
