#!/usr/bin/env python3
"""
sync_timeline.py — 镜头蒙太奇字幕 + 时间轴同步

消费 tts-manifest.json（shots 扁平格式）+ presentation.html，
生成 SRT 字幕并原地重写 HTML 中的 timelineConfig.shots[].duration。

一镜一句一条 SRT，天然 1:1 映射。

用法:
    python sync_timeline.py <项目目录>
    python sync_timeline.py <项目目录> --dry-run
"""

import json
import os
import re
import sys
from pathlib import Path


def format_srt_time(ms: int) -> str:
    """将毫秒转为 SRT 时间格式 HH:MM:SS,mmm"""
    if ms < 0:
        ms = 0
    hours = ms // 3600000
    minutes = (ms % 3600000) // 60000
    seconds = (ms % 60000) // 1000
    millis = ms % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def load_manifest(project_dir: Path) -> dict:
    """加载 tts-manifest.json"""
    manifest_path = project_dir / "tts-manifest.json"
    if not manifest_path.exists():
        print(f"错误：找不到 {manifest_path}", file=sys.stderr)
        print("请先运行 tts-voiceover 生成 manifest", file=sys.stderr)
        sys.exit(1)

    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_html(project_dir: Path) -> str:
    """加载 presentation.html"""
    html_path = project_dir / "presentation.html"
    if not html_path.exists():
        print(f"错误：找不到 {html_path}", file=sys.stderr)
        print("请先运行 markdown-to-html 生成 HTML", file=sys.stderr)
        sys.exit(1)

    with open(html_path, "r", encoding="utf-8") as f:
        return f.read()


def generate_srt(shots: list, shot_gap: int = 300, group_transition: int = 600) -> str:
    """生成 SRT 字幕内容"""
    srt_entries = []
    offset = 0

    for i, shot in enumerate(shots):
        duration_ms = shot.get("duration_ms", 3000)
        text = shot.get("text", "")

        if not text:
            # 空话术跳过但仍计入时间
            offset += duration_ms + shot_gap
            continue

        # 如果 duration_ms 为 0（TTS 失败），使用默认值
        if duration_ms == 0:
            duration_ms = 3000
            print(f"警告：镜头 {shot.get('id', i+1)} 的 duration_ms 为 0，使用默认值 3000ms", file=sys.stderr)

        start = offset
        end = offset + duration_ms

        srt_entries.append(f"{len(srt_entries) + 1}\n{format_srt_time(start)} --> {format_srt_time(end)}\n{text}\n")

        # 计算下一个偏移
        offset = end

        # 判断下一个镜头是否是新画布组
        if i + 1 < len(shots):
            current_group = shot.get("canvas_group", 1)
            next_group = shots[i + 1].get("canvas_group", 1)
            if next_group != current_group:
                offset += group_transition
            else:
                offset += shot_gap

    return "\n".join(srt_entries)


def rewrite_timeline_config(html: str, shots: list) -> str:
    """重写 HTML 中 timelineConfig.shots[].duration"""
    # 构建新的 shots 配置
    new_shots = []
    for shot in shots:
        duration_ms = shot.get("duration_ms", 3000)
        if duration_ms == 0:
            duration_ms = 3000
        new_shots.append({
            "id": shot.get("id", 0),
            "canvasGroup": shot.get("canvas_group", 1),
            "duration": duration_ms
        })

    # 找到 timelineConfig 并重写
    # 匹配 window.timelineConfig = {...}
    pattern = r"(window\.timelineConfig\s*=\s*)\{[\s\S]*?\};"

    def replacer(match):
        config = {
            "autoPlay": True,
            "shots": new_shots,
            "shotGap": 300,
            "groupTransition": 600
        }
        return match.group(1) + json.dumps(config, ensure_ascii=False) + ";"

    new_html, count = re.subn(pattern, replacer, html)

    if count == 0:
        print("警告：未在 HTML 中找到 window.timelineConfig，跳过 duration 回填", file=sys.stderr)
        return html

    return new_html


def validate(manifest: dict, html: str) -> bool:
    """验证 manifest 与 HTML 的一致性"""
    shots = manifest.get("shots", [])

    # 计算 HTML 中 slide 数量
    slide_count = len(re.findall(r'class="slide\b', html))

    if len(shots) != slide_count:
        print(f"警告：manifest 中有 {len(shots)} 个镜头，HTML 中有 {slide_count} 个 slide", file=sys.stderr)
        # 不阻塞，只警告
        return True

    return True


def main():
    args = sys.argv[1:]

    if not args:
        print("用法: python sync_timeline.py <项目目录> [--dry-run]", file=sys.stderr)
        sys.exit(1)

    project_dir = Path(args[0])
    dry_run = "--dry-run" in args

    if not project_dir.is_dir():
        print(f"错误：{project_dir} 不是有效目录", file=sys.stderr)
        sys.exit(1)

    # 加载输入
    manifest = load_manifest(project_dir)
    html = load_html(project_dir)

    # 获取 shots 数据
    shots = manifest.get("shots", [])
    if not shots:
        print("错误：manifest 中没有 shots 数据", file=sys.stderr)
        sys.exit(1)

    print(f"镜头数: {len(shots)}", file=sys.stderr)

    # 验证
    validate(manifest, html)

    # 生成 SRT
    srt_content = generate_srt(shots)

    # 重写 HTML
    new_html = rewrite_timeline_config(html, shots)

    # 计算总时长
    total_duration_ms = sum(s.get("duration_ms", 3000) for s in shots)
    total_duration_ms += (len(shots) - 1) * 300  # shot gaps
    # 加上画布组切换
    group_transitions = 0
    for i in range(1, len(shots)):
        if shots[i].get("canvas_group") != shots[i-1].get("canvas_group"):
            group_transitions += 1
    total_duration_ms += group_transitions * 600

    print(f"总时长: {total_duration_ms / 1000:.1f}s", file=sys.stderr)
    print(f"SRT 条目: {srt_content.count(chr(10) + chr(10)) + 1}", file=sys.stderr)

    if dry_run:
        print("\n[DRY RUN] 不写入文件", file=sys.stderr)
        print("\n--- SRT 预览（前 5 条）---", file=sys.stderr)
        lines = srt_content.split("\n\n")[:5]
        for line in lines:
            print(line, file=sys.stderr)
        return

    # 写入 SRT
    srt_path = project_dir / "subtitles.srt"
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    print(f"✓ 字幕已写入: {srt_path}", file=sys.stderr)

    # 写入修改后的 HTML
    html_path = project_dir / "presentation.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(new_html)
    print(f"✓ HTML 时间轴已更新: {html_path}", file=sys.stderr)

    print(f"\n完成！总时长 {total_duration_ms / 1000:.1f}s，{len(shots)} 个镜头", file=sys.stderr)


if __name__ == "__main__":
    main()
