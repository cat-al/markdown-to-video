/**
 * 终端进度条 — 三阶段各有独立样式
 *
 * 用法：
 *   const bar = createProgressBar({ stage: 'record', total: 1500 });
 *   bar.update(600, { memory: '1.1GB' });
 *   bar.finish();
 */

'use strict';

const BAR_WIDTH = 30;

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m${String(s).padStart(2, '0')}s`;
}

function renderBar(ratio) {
  const filled = Math.round(ratio * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

class ProgressBar {
  constructor({ stage, total, label, icon }) {
    this.stage = stage;
    this.total = total;
    this.label = label || stage;
    this.icon = icon || '⏳';
    this.current = 0;
    this.startTime = Date.now();
    this._lastRender = 0;
  }

  update(current, extra = {}) {
    this.current = current;

    // 节流：至少 100ms 渲染一次
    const now = Date.now();
    if (now - this._lastRender < 100 && current < this.total) return;
    this._lastRender = now;

    const ratio = Math.min(this.current / this.total, 1);
    const pct = Math.round(ratio * 100);
    const bar = renderBar(ratio);

    const elapsed = (now - this.startTime) / 1000;
    const remaining = ratio > 0 ? (elapsed / ratio) * (1 - ratio) : 0;

    let line = `${this.icon} ${this.label} [${bar}] ${pct}%`;

    if (this.stage === 'record') {
      const mem = extra.memory || '--';
      line += ` | 帧 ${this.current}/${this.total} | 内存 ${mem} | 剩余 ~${formatTime(remaining)}`;
    } else if (this.stage === 'audio') {
      line += ` | 场景 ${this.current}/${this.total} | 已用 ${formatTime(elapsed)}`;
    } else if (this.stage === 'compose') {
      line += ` | 已用 ${formatTime(elapsed)} | 剩余 ~${formatTime(remaining)}`;
    }

    // 覆盖当前行
    process.stderr.write(`\r${line.padEnd(100)}`);
  }

  increment(extra = {}) {
    this.update(this.current + 1, extra);
  }

  finish() {
    this.update(this.total);
    process.stderr.write('\n');
  }
}

function createProgressBar(opts) {
  const defaults = {
    record:  { label: '录制中',   icon: '🎬' },
    audio:   { label: '音频拼接', icon: '🔊' },
    compose: { label: '合成中',   icon: '🎞️' },
  };
  const d = defaults[opts.stage] || {};
  return new ProgressBar({
    stage: opts.stage,
    total: opts.total,
    label: opts.label || d.label,
    icon: opts.icon || d.icon,
  });
}

module.exports = { createProgressBar, ProgressBar, formatTime };
