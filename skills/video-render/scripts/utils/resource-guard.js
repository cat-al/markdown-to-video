/**
 * 资源守卫 — 内存监控 + GC 触发
 *
 * 每 N 帧检查一次 process.memoryUsage()，
 * 超过阈值主动暂停等待 GC，连续超标则降低截图质量。
 */

'use strict';

const DEFAULT_CHECK_INTERVAL = 100;        // 每 100 帧检查一次
const DEFAULT_HEAP_THRESHOLD = 450 * 1024 * 1024;  // Node 进程 heap 阈值 450MB（留余量）
const DEFAULT_RSS_THRESHOLD = 500 * 1024 * 1024;   // RSS 阈值 500MB
const GC_WAIT_MS = 200;                    // 等待 GC 的时间
const MAX_CONSECUTIVE_OVER = 3;            // 连续超标次数，超过后降级

class ResourceGuard {
  constructor(opts = {}) {
    this.checkInterval = opts.checkInterval || DEFAULT_CHECK_INTERVAL;
    this.heapThreshold = opts.heapThreshold || DEFAULT_HEAP_THRESHOLD;
    this.rssThreshold = opts.rssThreshold || DEFAULT_RSS_THRESHOLD;
    this.frameCount = 0;
    this.consecutiveOver = 0;
    this.degraded = false;        // 是否已降级
    this.jpegQuality = opts.jpegQuality || 95;
  }

  /**
   * 每帧调用，返回 { shouldWait, quality }
   */
  async check() {
    this.frameCount++;

    if (this.frameCount % this.checkInterval !== 0) {
      return { shouldWait: false, quality: this.jpegQuality };
    }

    const mem = process.memoryUsage();
    const heapUsed = mem.heapUsed;
    const rss = mem.rss;

    const overThreshold = heapUsed > this.heapThreshold || rss > this.rssThreshold;

    if (overThreshold) {
      this.consecutiveOver++;

      // 尝试触发 GC（需要 --expose-gc 启动参数）
      if (global.gc) {
        global.gc();
      }

      // 等待一段时间让 GC 生效
      await sleep(GC_WAIT_MS);

      // 连续超标，降低截图质量
      if (this.consecutiveOver >= MAX_CONSECUTIVE_OVER && !this.degraded) {
        this.degraded = true;
        this.jpegQuality = Math.max(70, this.jpegQuality - 15);
        console.warn(
          `⚠️  内存连续超标 ${this.consecutiveOver} 次，降低截图质量至 ${this.jpegQuality}`
        );
      }

      return { shouldWait: true, quality: this.jpegQuality };
    }

    // 恢复计数
    this.consecutiveOver = 0;
    return { shouldWait: false, quality: this.jpegQuality };
  }

  /** 获取当前内存摘要字符串 */
  getMemoryString() {
    const mem = process.memoryUsage();
    const rss = (mem.rss / 1024 / 1024).toFixed(0);
    const heap = (mem.heapUsed / 1024 / 1024).toFixed(0);
    return `${rss}MB(rss) ${heap}MB(heap)`;
  }

  /** 获取格式化的内存用量（简短版，用于进度条） */
  getMemoryShort() {
    const mem = process.memoryUsage();
    const rss = (mem.rss / 1024 / 1024 / 1024).toFixed(1);
    return `${rss}GB`;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { ResourceGuard, sleep };
