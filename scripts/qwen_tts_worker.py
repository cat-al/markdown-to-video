#!/usr/bin/env python3
from __future__ import annotations

import json
import platform
import sys
import traceback
from pathlib import Path


def print_json(payload, stream=None):
    output = json.dumps(payload, ensure_ascii=False)
    (stream or sys.stdout).write(output)
    (stream or sys.stdout).write("\n")


def normalize_mode(model_name: str, mode: str | None) -> str:
    if mode and mode != "auto":
        return mode

    normalized = (model_name or "").lower()
    if "voicedesign" in normalized:
        return "voice-design"
    if "customvoice" in normalized:
        return "custom-voice"
    if "base" in normalized:
        return "base"
    return "voice-design"


def resolve_device(requested: str, torch_module) -> str:
    if requested and requested != "auto":
        return requested

    if torch_module.cuda.is_available():
        return "cuda:0"

    mps_backend = getattr(torch_module.backends, "mps", None)
    if mps_backend and mps_backend.is_available():
        return "mps"

    return "cpu"


def resolve_dtype(requested: str, device: str, torch_module):
    mapping = {
        "float32": torch_module.float32,
        "float16": torch_module.float16,
        "bfloat16": torch_module.bfloat16,
    }

    if requested and requested != "auto":
        return mapping.get(requested, torch_module.float32)

    if device.startswith("cuda"):
        return torch_module.bfloat16
    if device == "mps":
        return torch_module.float16
    return torch_module.float32


def normalize_batch_value(values, length, fallback):
    if isinstance(values, list):
        return values
    return [fallback] * length if values is None else [values] * length


def do_check():
    try:
        import soundfile  # type: ignore
        import torch  # type: ignore
        from qwen_tts import Qwen3TTSModel  # type: ignore

        details = {
            "ok": True,
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "packages": {
                "torch": getattr(torch, "__version__", "unknown"),
                "soundfile": getattr(soundfile, "__version__", "unknown"),
                "qwen_tts": getattr(sys.modules.get("qwen_tts"), "__version__", "installed"),
            },
            "hardware": {
                "cuda": bool(torch.cuda.is_available()),
                "mps": bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()),
            },
            "api": hasattr(Qwen3TTSModel, "from_pretrained"),
        }
        print_json(details)
        return 0
    except Exception as exc:  # pragma: no cover
        print_json(
            {
                "ok": False,
                "error": str(exc),
                "hint": "请先在独立 Python 环境中安装 requirements-qwen.txt，再重新执行 npm run qwen:doctor。",
            },
            stream=sys.stderr,
        )
        return 1


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        raise SystemExit(do_check())

    # Force UTF-8 for stdin/stdout/stderr on Windows
    if sys.platform == "win32":
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    try:
        payload = json.loads(sys.stdin.read() or "{}")
        items = payload.get("items") or []
        model_name = payload.get("model")
        if not model_name:
            raise ValueError("缺少 model 参数")
        if not items:
            raise ValueError("缺少 items 参数")

        import soundfile as sf  # type: ignore
        import torch  # type: ignore
        from qwen_tts import Qwen3TTSModel  # type: ignore

        device = resolve_device(payload.get("device", "auto"), torch)
        dtype = resolve_dtype(payload.get("dtype", "auto"), device, torch)
        attn_implementation = payload.get("attnImplementation", "auto")
        mode = normalize_mode(model_name, payload.get("mode"))

        if mode == "base":
            raise ValueError("当前 worker 暂不支持 Base / VoiceClone 模式，请改用 VoiceDesign 或 CustomVoice 模型。")

        model_kwargs = {
            "device_map": device,
            "dtype": dtype,
        }

        if attn_implementation and attn_implementation != "auto":
            model_kwargs["attn_implementation"] = attn_implementation
        elif device.startswith("cuda"):
            model_kwargs["attn_implementation"] = "flash_attention_2"

        model = Qwen3TTSModel.from_pretrained(model_name, **model_kwargs)

        texts = [item["text"] for item in items]
        languages = normalize_batch_value([item.get("language") for item in items], len(items), "Auto")

        wavs = []
        sample_rate = None

        if mode == "voice-design":
            instructs = normalize_batch_value([item.get("instruct") for item in items], len(items), "")
            for i in range(len(texts)):
                result_wavs, sr_i = model.generate_voice_design(
                    text=[texts[i]],
                    language=[languages[i]],
                    instruct=[instructs[i]],
                )
                wav_i = result_wavs[0] if isinstance(result_wavs, (list, tuple)) else result_wavs
                wavs.append(wav_i)
                if sample_rate is None:
                    sample_rate = sr_i
        elif mode == "custom-voice":
            speakers = normalize_batch_value([item.get("speaker") or "Vivian" for item in items], len(items), "Vivian")
            instructs = normalize_batch_value([item.get("instruct") or "" for item in items], len(items), "")
            for i in range(len(texts)):
                result_wavs, sr_i = model.generate_custom_voice(
                    text=[texts[i]],
                    language=[languages[i]],
                    speaker=[speakers[i]],
                    instruct=[instructs[i]],
                )
                wav_i = result_wavs[0] if isinstance(result_wavs, (list, tuple)) else result_wavs
                wavs.append(wav_i)
                if sample_rate is None:
                    sample_rate = sr_i
        else:
            raise ValueError(f"不支持的 mode: {mode}")

        if not isinstance(wavs, (list, tuple)):
            wavs = [wavs]

        for index, wav in enumerate(wavs):
            output_path = Path(items[index]["outputPath"])
            output_path.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(output_path), wav, sample_rate)

        print_json(
            {
                "ok": True,
                "mode": mode,
                "model": model_name,
                "device": device,
                "count": len(wavs),
            }
        )
        return 0
    except Exception as exc:  # pragma: no cover
        print_json(
            {
                "ok": False,
                "error": str(exc),
                "traceback": traceback.format_exc(),
            },
            stream=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
