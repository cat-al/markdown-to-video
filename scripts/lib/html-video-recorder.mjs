/**
 * html-video-recorder.mjs — Record HTML slides to video using Playwright.
 *
 * For each HTML slide file, opens it in a headless Chromium browser,
 * waits for animations / Canvas FX to initialize, records video for
 * the required duration, then converts the .webm output to H.264 .mp4
 * compatible with Remotion's <OffthreadVideo>.
 */
import {existsSync, mkdirSync, unlinkSync} from 'node:fs';
import {join, basename, dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const FX_INIT_WAIT_MS = 600;
const FONT_WAIT_EXTRA_MS = 300;

/**
 * Record video for each HTML slide.
 *
 * @param {object} options
 * @param {string[]} options.htmlPaths — Array of HTML file paths to record
 * @param {number[]} options.durations — Duration per slide in seconds
 * @param {string} options.outputDir — Directory to write .mp4 files
 * @param {string} options.baseUrl — HTTP server base URL (e.g. http://127.0.0.1:3456)
 * @param {string} options.htmlDir — Root directory served by HTTP server (to compute relative URLs)
 * @param {object} [options.viewport] — {width, height}
 * @returns {Promise<string[]>} — Array of output .mp4 file paths
 */
export const recordHtmlVideos = async ({
  htmlPaths,
  durations,
  outputDir,
  baseUrl,
  htmlDir,
  viewport = {width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT},
}) => {
  // Dynamic import playwright to avoid issues if not installed
  const {chromium} = await import('playwright');

  mkdirSync(outputDir, {recursive: true});

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-gpu-sandbox',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=Vulkan',
      '--use-gl=angle',
      '--disable-frame-rate-limit',
    ],
  });

  const outputPaths = [];

  try {
    for (let i = 0; i < htmlPaths.length; i++) {
      const htmlPath = htmlPaths[i];
      const durationSec = durations[i] || 5;
      const slideNum = String(i + 1).padStart(2, '0');
      const webmPath = join(outputDir, `slide-${slideNum}.webm`);
      const mp4Path = join(outputDir, `html-slide-${slideNum}.mp4`);

      console.log(`[html-recorder] Recording slide ${i + 1}/${htmlPaths.length} (${durationSec.toFixed(1)}s)...`);

      // Compute URL relative to the served directory
      const resolvedHtml = resolve(htmlPath);
      const resolvedHtmlDir = resolve(htmlDir);
      const relativePath = resolvedHtml.slice(resolvedHtmlDir.length).replace(/\\/g, '/');
      const slideUrl = `${baseUrl.replace(/\/+$/, '')}${relativePath}`;

      // Create context with video recording
      const context = await browser.newContext({
        viewport,
        recordVideo: {
          dir: outputDir,
          size: viewport,
        },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();

      try {
        // Navigate and wait for load
        await page.goto(slideUrl, {waitUntil: 'domcontentloaded', timeout: 15000});

        // Wait for fonts
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(FONT_WAIT_EXTRA_MS);

        // Check if page has Canvas FX and wait for initialization
        const hasFx = await page.evaluate(() => !!document.querySelector('[data-fx]'));
        if (hasFx) {
          await page.waitForTimeout(FX_INIT_WAIT_MS);
        }

        // Wait for the specified duration to let animations play
        const recordMs = Math.max(1000, Math.round(durationSec * 1000));
        await page.waitForTimeout(recordMs);
      } catch (err) {
        console.warn(`[html-recorder] Warning: slide ${i + 1} page error: ${err.message}`);
      }

      // Close context to finalize video recording
      await context.close();

      // Find the recorded video file (Playwright saves with a generated name)
      const video = page.video();
      if (video) {
        const videoPath = await video.path();
        if (videoPath && existsSync(videoPath)) {
          // Convert webm to H.264 mp4 for Remotion compatibility
          const convertResult = spawnSync('ffmpeg', [
            '-y',
            '-i', videoPath,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '18',
            '-an', // no audio
            '-movflags', '+faststart',
            mp4Path,
          ], {encoding: 'utf8', timeout: 60000});

          if (convertResult.status !== 0) {
            console.warn(`[html-recorder] ffmpeg convert failed for slide ${i + 1}: ${convertResult.stderr?.slice(0, 200)}`);
            outputPaths.push(null);
          } else {
            // Clean up webm
            try { unlinkSync(videoPath); } catch {}
            outputPaths.push(mp4Path);
            console.log(`[html-recorder] slide ${i + 1} → ${basename(mp4Path)}`);
          }
        } else {
          console.warn(`[html-recorder] No video file found for slide ${i + 1}`);
          outputPaths.push(null);
        }
      } else {
        console.warn(`[html-recorder] No video handle for slide ${i + 1}`);
        outputPaths.push(null);
      }
    }
  } finally {
    await browser.close();
  }

  return outputPaths;
};
