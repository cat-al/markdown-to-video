#!/usr/bin/env python3
"""sync_timeline.py — 字幕生成 + HTML 时间轴同步脚本

根据 tts-manifest.json 的真实 TTS 音频时长：
  1. 生成 SRT 字幕文件
  2. 原地重写 HTML 中的 stepConfig duration 和 timelineConfig scene duration

确保 silent.mp4（视频录制）和 full-audio.wav（音频拼接）时长完全一致。

Usage:
    python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
        --project-dir output/001-xxx

    python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
        --manifest output/001-xxx/tts-manifest.json \
        --html output/001-xxx/presentation.html \
        --srt-output output/001-xxx/subtitles.srt

    # 仅诊断，不修改任何文件
    python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
        --project-dir output/001-xxx --dry-run

    # 自定义映射文件（AI 预生成的 step↔line 映射 JSON）
    python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
        --project-dir output/001-xxx --mapping mapping.json
"""

import argparse
import json
import os
import re
import sys
import wave
from typing import List, Dict, Any, Optional, Tuple


# ══════════════════════════════════════════════════════════════════════
#  常量 — 与 audio.js / TimelineEngine / record.js 保持一致
# ══════════════════════════════════════════════════════════════════════

LINE_GAP_MS = 300       # 字幕行间呼吸间隔（audio.js 拼接时用）
SCENE_GAP_MS = 800      # 场景切换静默间隔（audio.js 拼接时用）
STEP_GAP_MS = 600       # step 间隔（TimelineEngine.stepGap）
TRANSITION_MS = 800     # 场景过渡动画时长（--transition-duration CSS 变量）


# ══════════════════════════════════════════════════════════════════════
#  工具函数
# ══════════════════════════════════════════════════════════════════════

def ms_to_srt_time(ms: int) -> str:
    """毫秒 → SRT 时间格式 HH:MM:SS,mmm"""
    if ms < 0:
        ms = 0
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    f = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{f:03d}"


def get_wav_duration_ms(wav_path: str) -> int:
    """读取 WAV 文件实际时长（毫秒）"""
    with wave.open(wav_path, 'rb') as w:
        return int(w.getnframes() / float(w.getframerate()) * 1000)


def extract_json_block(html: str, var_name: str) -> Tuple[Any, int, int]:
    """从 HTML 中提取 window.xxx = {...}; 的 JSON 对象。

    Returns: (parsed_json, start_index, end_index)
    """
    for m in re.finditer(rf'window\.{var_name}\s*=\s*', html):
        start = m.end()
        depth = 0
        i = start
        in_str = False
        escape = False
        while i < len(html):
            ch = html[i]
            if escape:
                escape = False
                i += 1
                continue
            if ch == '\\':
                escape = True
                i += 1
                continue
            if ch == '"':
                in_str = not in_str
            elif not in_str:
                if ch in ('{', '['):
                    depth += 1
                elif ch in ('}', ']'):
                    depth -= 1
                    if depth == 0:
                        json_str = html[start:i + 1]
                        return json.loads(json_str), m.start(), i + 1
            i += 1
    raise ValueError(f"在 HTML 中未找到 window.{var_name}")


# ══════════════════════════════════════════════════════════════════════
#  step↔line 映射
# ══════════════════════════════════════════════════════════════════════

def distribute_lines_to_steps(n_lines: int, n_steps: int) -> List[List[int]]:
    """将 n_lines 条字幕行均匀分配到 n_steps 个 step。"""
    if n_steps <= 0:
        return []
    if n_lines <= 0:
        return [[] for _ in range(n_steps)]

    base = n_lines // n_steps
    remainder = n_lines % n_steps
    mapping = []
    line_idx = 0
    for step_idx in range(n_steps):
        count = base + (1 if step_idx < remainder else 0)
        mapping.append(list(range(line_idx, line_idx + count)))
        line_idx += count
    return mapping


def load_mapping_file(mapping_path: str) -> Dict[str, List[List[int]]]:
    """加载自定义映射文件。格式: {"scene_1": [[0,1],[2],[3,4]], ...}"""
    with open(mapping_path) as f:
        return json.load(f)


# ══════════════════════════════════════════════════════════════════════
#  核心计算
#
#  时长对齐的关键推导（SCENE_GAP_MS == TRANSITION_MS == 800ms）：
#
#    record.js:  video_total = sum(scene.duration) + transition * (N-1)
#    audio.js:   audio_total = sum(audio_scene)    + scene_gap  * (N-1)
#    ⇒ scene.duration = audio_scene_duration（每scene的字幕行总时长含line_gap）
#
#    TimelineEngine.scheduleAutoSteps 实际播放:
#      totalStepTime = sum(step.dur) + stepGap * N_steps
#      切换到下一scene的延迟 = totalStepTime + transition
#    record.js 认为一个 scene 占用 = scene.duration (+ transition for non-last)
#    ⇒ scene.duration = sum(step.dur) + stepGap * N_steps
#    ⇒ sum(step.dur)  = audio_scene_duration - stepGap * N_steps
#
#  ⚠️ SKILL.md 旧公式 stepGap*(N-1) 少算了最后step后的stepGap
# ══════════════════════════════════════════════════════════════════════

def compute_step_durations(
    lines: List[Dict],
    step_line_mapping: List[List[int]],
) -> List[int]:
    """计算每个 step 的"原始"字幕时长（含行间 gap）。"""
    step_durations = []
    for line_indices in step_line_mapping:
        if not line_indices:
            step_durations.append(0)
            continue
        dur = sum(lines[idx]['duration_ms'] for idx in line_indices)
        dur += LINE_GAP_MS * (len(line_indices) - 1)
        step_durations.append(dur)
    return step_durations


def compute_scene_duration_for_video(step_durations: List[int]) -> int:
    """scene.duration = sum(step.dur) + stepGap * N_steps"""
    n = len(step_durations)
    if n == 0:
        return 0
    return sum(step_durations) + STEP_GAP_MS * n


def compute_audio_scene_duration(lines: List[Dict]) -> int:
    """一个 scene 的音频时长 = sum(dur_ms) + LINE_GAP * (N-1)"""
    if not lines:
        return 0
    return sum(l['duration_ms'] for l in lines) + LINE_GAP_MS * (len(lines) - 1)


def compute_adjusted_step_durations(
    lines: List[Dict],
    step_line_mapping: List[List[int]],
) -> List[int]:
    """计算调整后的 step duration，使 sum(step.dur) + stepGap*N == audio_scene_duration。

    按每个 step 映射到的字幕行时长比例分配。
    """
    n_steps = len(step_line_mapping)
    if n_steps == 0:
        return []

    audio_dur = compute_audio_scene_duration(lines)
    target_sum = audio_dur - STEP_GAP_MS * n_steps

    if target_sum <= 0:
        return [max(100, audio_dur // n_steps) for _ in range(n_steps)]

    raw_step_durs = compute_step_durations(lines, step_line_mapping)
    raw_total = sum(raw_step_durs)

    if raw_total == 0:
        base = target_sum // n_steps
        adjusted = [base] * n_steps
        adjusted[-1] += target_sum - sum(adjusted)
        return adjusted

    adjusted = [int(dur / raw_total * target_sum) for dur in raw_step_durs]

    diff = target_sum - sum(adjusted)
    if diff != 0:
        max_idx = adjusted.index(max(adjusted))
        adjusted[max_idx] += diff

    return adjusted


# ══════════════════════════════════════════════════════════════════════
#  SRT 生成
# ══════════════════════════════════════════════════════════════════════

def generate_srt(manifest: Dict) -> str:
    """根据 manifest 生成 SRT 字幕内容。"""
    srt_lines = []
    index = 1
    global_offset = 0

    scenes = manifest['scenes']
    for scene_idx, scene in enumerate(scenes):
        lines = scene['lines']
        for line_idx, line in enumerate(lines):
            start = global_offset
            end = start + line['duration_ms']

            srt_lines.append(str(index))
            srt_lines.append(f"{ms_to_srt_time(start)} --> {ms_to_srt_time(end)}")
            srt_lines.append(line['text'])
            srt_lines.append('')

            # 句间间隔：场景最后一行后面不加 LINE_GAP（与 audio.js 保持一致）
            if line_idx < len(lines) - 1:
                global_offset = end + LINE_GAP_MS
            else:
                global_offset = end
            index += 1

        if scene_idx < len(scenes) - 1:
            global_offset += SCENE_GAP_MS

    return '\n'.join(srt_lines)


# ══════════════════════════════════════════════════════════════════════
#  HTML 修改
# ══════════════════════════════════════════════════════════════════════

def rewrite_html(
    html: str,
    new_step_config: Dict,
    new_timeline_config: Dict,
) -> str:
    """替换 HTML 中的 stepConfig 和 timelineConfig（只改 duration，保留其余结构）。"""
    step_json = json.dumps(new_step_config, ensure_ascii=False)
    html = re.sub(
        r'(window\.stepConfig\s*=\s*)(\{.*?\})(;)',
        lambda m: m.group(1) + step_json + m.group(3),
        html, count=1, flags=re.DOTALL,
    )

    tc_json = json.dumps(new_timeline_config, ensure_ascii=False)
    html = re.sub(
        r'(window\.timelineConfig\s*=\s*)(\{.*?\})(;)',
        lambda m: m.group(1) + tc_json + m.group(3),
        html, count=1, flags=re.DOTALL,
    )

    return html


# ══════════════════════════════════════════════════════════════════════
#  诊断 / 校验
# ══════════════════════════════════════════════════════════════════════

def diagnose(manifest: Dict, step_config: Dict, timeline_config: Dict, audio_path: Optional[str] = None):
    """打印诊断报告：manifest vs stepConfig vs timelineConfig vs 实际音频。"""
    scenes = manifest['scenes']
    n_scenes = len(scenes)

    print("\n" + "=" * 100)
    print("  诊断报告：时间轴一致性检查")
    print("=" * 100)

    header = "{:>6} {:>6} {:>6} {:>12} {:>12} {:>12} {:>12} {:>10}".format(
        "Scene", "Lines", "Steps", "Audio(ms)", "StepSum(ms)", "StepCalc", "SceneDur", "Delta")
    print(header)
    print("-" * 100)

    total_audio = 0
    total_scene_dur = 0

    for scene in scenes:
        sn = scene['scene_number']
        n_lines = len(scene['lines'])
        audio_dur = compute_audio_scene_duration(scene['lines'])
        total_audio += audio_dur

        slide_key = f"slide-{sn}"
        steps = step_config.get(slide_key, [])
        n_steps = len(steps)
        step_durs = [s['duration'] for s in steps]
        step_sum = sum(step_durs)

        engine_actual = step_sum + STEP_GAP_MS * n_steps + TRANSITION_MS

        scene_dur = next((s['duration'] for s in timeline_config['scenes'] if s['scene'] == sn), 0)
        total_scene_dur += scene_dur

        is_last = (sn == n_scenes)
        record_alloc = scene_dur if is_last else scene_dur + TRANSITION_MS
        delta = record_alloc - engine_actual

        print("{:>6} {:>6} {:>6} {:>12} {:>12} {:>12} {:>12} {:>+10}".format(
            sn, n_lines, n_steps, audio_dur, step_sum,
            f"{step_sum}+{STEP_GAP_MS*n_steps}+{TRANSITION_MS}={engine_actual}",
            scene_dur, delta))

    record_total = total_scene_dur + TRANSITION_MS * (n_scenes - 1)
    audio_total = total_audio + SCENE_GAP_MS * (n_scenes - 1)

    print("-" * 100)
    print(f"  音频总时长 (含scene_gap):  {audio_total:>8}ms = {audio_total/1000:.1f}s")
    print(f"  视频总时长 (record.js):    {record_total:>8}ms = {record_total/1000:.1f}s")
    print(f"  差值:                      {record_total - audio_total:>+8}ms")

    if audio_path and os.path.exists(audio_path):
        actual_audio_ms = get_wav_duration_ms(audio_path)
        print(f"  实际音频文件时长:          {actual_audio_ms:>8}ms = {actual_audio_ms/1000:.1f}s")
        print(f"  音频文件 vs 视频:          {actual_audio_ms - record_total:>+8}ms")

    ok = abs(record_total - audio_total) < 100
    print(f"\n  {'✅ 时长对齐正常' if ok else '❌ 时长不对齐！需要修复'}")
    print("=" * 100 + "\n")
    return ok


# ══════════════════════════════════════════════════════════════════════
#  主流程
# ══════════════════════════════════════════════════════════════════════

def run(
    manifest_path: str,
    html_path: str,
    srt_output: str,
    mapping_path: Optional[str] = None,
    dry_run: bool = False,
    audio_path: Optional[str] = None,
):
    """主执行函数。"""
    # ── 1. 读取输入 ──
    with open(manifest_path) as f:
        manifest = json.load(f)

    with open(html_path) as f:
        html = f.read()

    step_config, _, _ = extract_json_block(html, 'stepConfig')
    timeline_config, _, _ = extract_json_block(html, 'timelineConfig')

    custom_mapping = None
    if mapping_path and os.path.exists(mapping_path):
        custom_mapping = load_mapping_file(mapping_path)
        print(f"📋 已加载自定义映射: {mapping_path}")

    # ── 2. 诊断当前状态 ──
    print("📊 当前状态诊断:")
    diagnose(manifest, step_config, timeline_config, audio_path)

    # ── 3. 计算新的 step durations 和 scene durations ──
    scenes = manifest['scenes']
    new_scene_durations = {}

    print("🔧 计算新时间轴:")
    print("-" * 90)
    print("{:>6} {:>6} {:>6} {:>14} {:>14} {:>14} {:>14}".format(
        "Scene", "Lines", "Steps", "Audio(ms)", "NewSceneDur", "OldSceneDur", "Delta"))
    print("-" * 90)

    for scene in scenes:
        sn = scene['scene_number']
        scene_id = scene['scene_id']
        slide_key = f"slide-{sn}"
        lines = scene['lines']
        n_lines = len(lines)

        steps = step_config.get(slide_key, [])
        n_steps = len(steps)

        audio_dur = compute_audio_scene_duration(lines)

        if n_steps == 0:
            new_scene_durations[sn] = audio_dur
            old_sd = next((s['duration'] for s in timeline_config['scenes'] if s['scene'] == sn), 0)
            print("{:>6} {:>6} {:>6} {:>14} {:>14} {:>14} {:>+14}".format(
                sn, n_lines, 0, audio_dur, audio_dur, old_sd, audio_dur - old_sd))
            continue

        # 确定映射
        if custom_mapping and scene_id in custom_mapping:
            step_line_map = custom_mapping[scene_id]
        elif n_lines == n_steps:
            # 新默认：1:1 映射（字幕段数 == step 数时天然对齐）
            step_line_map = [[i] for i in range(n_lines)]
        else:
            # fallback：均匀分配（兼容旧格式或段数不匹配的情况）
            step_line_map = distribute_lines_to_steps(n_lines, n_steps)

        # 验证映射完整性
        all_mapped = sorted([idx for group in step_line_map for idx in group])
        if all_mapped != list(range(n_lines)):
            print(f"  ⚠️  Scene {sn}: 映射不完整! 回退到均匀分配", file=sys.stderr)
            step_line_map = distribute_lines_to_steps(n_lines, n_steps)

        # 计算调整后的 step durations
        adjusted_step_durs = compute_adjusted_step_durations(lines, step_line_map)

        for i, step in enumerate(steps):
            step['duration'] = adjusted_step_durs[i]

        new_sd = compute_scene_duration_for_video(adjusted_step_durs)
        new_scene_durations[sn] = new_sd

        old_sd = next((s['duration'] for s in timeline_config['scenes'] if s['scene'] == sn), 0)
        print("{:>6} {:>6} {:>6} {:>14} {:>14} {:>14} {:>+14}".format(
            sn, n_lines, n_steps, audio_dur, new_sd, old_sd, new_sd - old_sd))

    # 更新 timelineConfig
    for scene_info in timeline_config['scenes']:
        sn = scene_info['scene']
        if sn in new_scene_durations:
            scene_info['duration'] = new_scene_durations[sn]

    print("-" * 90)

    # ── 4. 生成 SRT ──
    srt_content = generate_srt(manifest)
    srt_total_ms = sum(
        compute_audio_scene_duration(s['lines']) for s in scenes
    ) + SCENE_GAP_MS * (len(scenes) - 1)
    print(f"\n📝 SRT 总时长: {srt_total_ms}ms = {srt_total_ms/1000:.1f}s")

    # ── 5. 验证新配置 ──
    print("\n📊 修改后状态诊断:")
    ok = diagnose(manifest, step_config, timeline_config, audio_path)

    if dry_run:
        print("🔍 [DRY RUN] 不写入文件")
        return ok

    # ── 6. 写入文件 ──
    with open(srt_output, 'w', encoding='utf-8') as f:
        f.write(srt_content)
    print(f"✅ SRT 已写入: {srt_output}")

    new_html = rewrite_html(html, step_config, timeline_config)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_html)
    print(f"✅ HTML 已更新: {html_path}")

    return ok


# ══════════════════════════════════════════════════════════════════════
#  CLI
# ══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='字幕生成 + HTML 时间轴同步',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--project-dir', help='项目目录（自动查找 manifest/html/srt）')
    parser.add_argument('--manifest', help='tts-manifest.json 路径')
    parser.add_argument('--html', help='HTML 文件路径')
    parser.add_argument('--srt-output', help='SRT 输出路径')
    parser.add_argument('--mapping', help='自定义 step↔line 映射 JSON 文件')
    parser.add_argument('--audio', help='full-audio.wav 路径（用于校验）')
    parser.add_argument('--dry-run', action='store_true', help='仅诊断，不修改文件')

    args = parser.parse_args()

    # 自动解析路径
    if args.project_dir:
        proj = args.project_dir
        manifest_path = args.manifest or os.path.join(proj, 'tts-manifest.json')
        srt_output = args.srt_output or os.path.join(proj, 'subtitles.srt')
        audio_path = args.audio or os.path.join(proj, 'video', 'full-audio.wav')

        if not args.html:
            with open(manifest_path) as f:
                m = json.load(f)
            html_path = m.get('html_path', '')
            if not os.path.isabs(html_path):
                workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(proj)))
                candidate = os.path.join(workspace_root, html_path)
                if os.path.exists(candidate):
                    html_path = candidate
                else:
                    for fname in os.listdir(proj):
                        if fname.endswith('.html'):
                            html_path = os.path.join(proj, fname)
                            break
        else:
            html_path = args.html
    else:
        manifest_path = args.manifest
        html_path = args.html
        srt_output = args.srt_output
        audio_path = args.audio

    if not manifest_path or not html_path:
        parser.error('需要 --project-dir 或同时指定 --manifest 和 --html')

    if not os.path.exists(manifest_path):
        print(f"❌ 找不到 manifest: {manifest_path}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(html_path):
        print(f"❌ 找不到 HTML: {html_path}", file=sys.stderr)
        sys.exit(1)

    ok = run(
        manifest_path=manifest_path,
        html_path=html_path,
        srt_output=srt_output or 'subtitles.srt',
        mapping_path=args.mapping,
        dry_run=args.dry_run,
        audio_path=audio_path,
    )

    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
