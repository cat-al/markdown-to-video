#!/usr/bin/env python3
"""极简章节音频播放器 — 顺序播放目录下所有 .wav 文件。

Usage:
    # 播放指定目录
    python .codebuddy/skills/tts-voiceover/scripts/play_audio.py output/audio/scene-01

    # 播放当前目录
    python .codebuddy/skills/tts-voiceover/scripts/play_audio.py

仅需 Python 标准库 + macOS afplay 命令，零额外依赖。
"""

import os
import subprocess
import sys


def natural_sort_key(s: str):
    """自然排序 key — 让 '002.wav' 排在 '10.wav' 前面。"""
    import re
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r'(\d+)', s)
    ]


def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."

    if not os.path.isdir(target_dir):
        print(f"错误: 目录不存在 — {target_dir}", file=sys.stderr)
        sys.exit(1)

    wav_files = sorted(
        [f for f in os.listdir(target_dir) if f.lower().endswith(".wav")],
        key=natural_sort_key,
    )

    if not wav_files:
        print(f"目录下没有 .wav 文件 — {target_dir}", file=sys.stderr)
        sys.exit(1)

    total = len(wav_files)
    print(f"播放 {target_dir}/ ({total} 个文件)\n")

    try:
        for i, filename in enumerate(wav_files, 1):
            filepath = os.path.join(target_dir, filename)
            print(f"  [{i}/{total}] {filename} ▶ 播放中...")
            subprocess.run(["afplay", filepath], check=True)
    except KeyboardInterrupt:
        print(f"\n\n已停止 (在 [{i}/{total}] {filename})")
        sys.exit(0)
    except FileNotFoundError:
        print(
            "\n错误: 未找到 afplay 命令。当前仅支持 macOS。",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"\n全部播放完成 ({total}个文件)")


if __name__ == "__main__":
    main()
