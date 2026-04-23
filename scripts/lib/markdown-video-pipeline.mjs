import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Load .env file from project root (if exists) for MIMO_API_KEY and other config
const loadDotEnv = () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {}
};
loadDotEnv();

export const DEFAULT_FPS = 30;
export const AUDIO_TAIL_SECONDS = 0.45;
export const MIN_SLIDE_SECONDS = 3;
export const MAX_SLIDE_SECONDS = 9;
export const SLIDE_LAYOUT_NAMES = [
  'hero',
  'split-list',
  'timeline',
  'grid',
  'mosaic',
  'argument',
  'triptych',
  'manifesto',
  'spotlight',
  'quote',
  'code',
  'panel',
  'centered',
  'waterfall',
  'radar',
  'compare',
  'pyramid',
  'stat-cards',
  'headline',
  'sidebar-note',
  'filmstrip',
  'duo',
  'orbit',
  'kanban',
  'stack',
  'accent-bar',
  'split-quote',
  'checklist',
  'minimal',
  'magazine',
];
const SLIDE_LAYOUT_NAME_SET = new Set(SLIDE_LAYOUT_NAMES);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const QWEN_WORKER_PATH = join(__dirname, '..', 'qwen_tts_worker.py');

export const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

export const sanitizeFileSegment = (value) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '');
};

export const normalize = (markdownText) => markdownText.replace(/\r\n/g, '\n').trim();

export const readMarkdownFile = (filePath) => readFileSync(filePath, 'utf8');

export const parseNumericValue = (value) => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBooleanValue = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
};

const isRemoteAsset = (value) => /^(https?:)?\/\//i.test(String(value ?? '').trim()) || String(value ?? '').trim().startsWith('data:');

const createReferenceAudioFingerprint = (referenceAudio) => {
  const normalized = String(referenceAudio ?? '').trim();

  if (!normalized) {
    return '';
  }

  if (isRemoteAsset(normalized) || !existsSync(normalized)) {
    return normalized;
  }

  try {
    const stat = statSync(normalized);
    return {
      path: normalized,
      size: stat.size,
      mtimeMs: Math.round(stat.mtimeMs),
    };
  } catch {
    return normalized;
  }
};

const AUDIO_MANIFEST_VERSION = 1;

const readAudioManifest = (manifestPath) => {
  if (!existsSync(manifestPath)) {
    return {version: AUDIO_MANIFEST_VERSION, entries: {}};
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return {
      version: parsed?.version ?? AUDIO_MANIFEST_VERSION,
      entries: parsed?.entries && typeof parsed.entries === 'object' ? parsed.entries : {},
    };
  } catch {
    return {version: AUDIO_MANIFEST_VERSION, entries: {}};
  }
};

const createAudioCacheKey = ({narration, ttsConfig}) => {
  return createHash('sha1')
    .update(JSON.stringify({
      provider: ttsConfig.provider,
      voice: ttsConfig.voice,
      rate: ttsConfig.rate,
      language: ttsConfig.language,
      instruction: ttsConfig.instruction,
      model: ttsConfig.model,
      mode: ttsConfig.mode,
      device: ttsConfig.device,
      dtype: ttsConfig.dtype,
      attnImplementation: ttsConfig.attnImplementation,
      referenceAudio: createReferenceAudioFingerprint(ttsConfig.referenceAudio),
      referenceText: ttsConfig.referenceText,
      xVectorOnlyMode: ttsConfig.xVectorOnlyMode,
      narration,
    }))
    .digest('hex');
};

const shouldReuseAudio = ({slide, manifestEntries}) => {
  if (!slide.narration) {
    return false;
  }

  if (!existsSync(slide.audioOutputPath)) {
    return false;
  }

  return manifestEntries[slide.fileName]?.cacheKey === slide.audioCacheKey;
};

export const parseFrontmatter = (markdownText) => {
  const normalizedMarkdown = normalize(markdownText);

  if (!normalizedMarkdown.startsWith('---\n')) {
    return {body: normalizedMarkdown, meta: {}};
  }

  const closingIndex = normalizedMarkdown.indexOf('\n---\n', 4);

  if (closingIndex === -1) {
    return {body: normalizedMarkdown, meta: {}};
  }

  const rawMeta = normalizedMarkdown.slice(4, closingIndex);
  const body = normalizedMarkdown.slice(closingIndex + 5).trim();
  const meta = {};

  rawMeta.split('\n').forEach((line) => {
    const match = line.match(/^([a-zA-Z][\w-]*):\s*(.+)$/);

    if (!match) {
      return;
    }

    const [, key, rawValue] = match;
    const normalizedKey = key.toLowerCase();
    const value = rawValue.trim();

    if (normalizedKey === 'title') meta.title = value;
    if (normalizedKey === 'subtitle') meta.subtitle = value;
    if (normalizedKey === 'themecolor' || normalizedKey === 'theme-color') meta.themeColor = value;
    if (normalizedKey === 'ttsvoice' || normalizedKey === 'tts-voice') meta.ttsVoice = value;
    if (normalizedKey === 'ttsrate' || normalizedKey === 'tts-rate') meta.ttsRate = parseNumericValue(value);
    if (normalizedKey === 'ttsprovider' || normalizedKey === 'tts-provider') meta.ttsProvider = value;
    if (normalizedKey === 'ttsmodel' || normalizedKey === 'tts-model') meta.ttsModel = value;
    if (normalizedKey === 'ttslanguage' || normalizedKey === 'tts-language') meta.ttsLanguage = value;
    if (normalizedKey === 'ttsinstruction' || normalizedKey === 'tts-instruction') meta.ttsInstruction = value;
    if (normalizedKey === 'ttsreferenceaudio' || normalizedKey === 'tts-reference-audio' || normalizedKey === 'ttsrefaudio' || normalizedKey === 'tts-ref-audio') meta.ttsReferenceAudio = value;
    if (normalizedKey === 'ttsreferencetext' || normalizedKey === 'tts-reference-text' || normalizedKey === 'ttsreftext' || normalizedKey === 'tts-ref-text') meta.ttsReferenceText = value;
    if (normalizedKey === 'ttsxvectoronlymode' || normalizedKey === 'tts-x-vector-only-mode' || normalizedKey === 'ttsxvectoronly' || normalizedKey === 'tts-x-vector-only') meta.ttsXVectorOnlyMode = parseBooleanValue(value);
    if (normalizedKey === 'ttsapikey' || normalizedKey === 'tts-api-key') meta.ttsApiKey = value;
    if (normalizedKey === 'ttsbaseurl' || normalizedKey === 'tts-base-url') meta.ttsBaseUrl = value;
    if (normalizedKey === 'renderer') {
      const v = value.toLowerCase();
      if (v === 'html-ppt' || v === 'native') meta.renderer = v;
    }
    if (normalizedKey === 'theme') meta.theme = value;
    if (normalizedKey === 'template') meta.template = value;
  });

  return {body, meta};
};

export const extractDurationInFrames = (markdownText, fps) => {
  const match = markdownText.match(/<!--\s*duration:\s*(\d+(?:\.\d+)?)\s*-->/i);

  if (!match) {
    return null;
  }

  return Math.max(Math.round(Number(match[1]) * fps), fps);
};

export const extractSlideDirectives = (markdownText) => {
  const layoutMatch = markdownText.match(/<!--\s*(?:layout|variant):\s*([a-z-]+)\s*-->/i);
  const accentMatch = markdownText.match(/<!--\s*(?:accent|accent-color|theme-color):\s*([\s\S]*?)\s*-->/i);
  const rawLayout = layoutMatch?.[1]?.trim().toLowerCase();
  const rawAccentColor = accentMatch?.[1]?.trim();

  return {
    layout: rawLayout && SLIDE_LAYOUT_NAME_SET.has(rawLayout) ? rawLayout : undefined,
    accentColor: rawAccentColor || undefined,
  };
};

export const extractVoiceover = (markdownText) => {
  const parts = [];

  const withoutBlockVoiceover = markdownText.replace(
    /<!--\s*(?:voiceover|narration)\s*\n([\s\S]*?)-->/gi,
    (_match, text) => {
      const trimmed = text.trim();
      if (trimmed) parts.push(trimmed);
      return '';
    },
  );

  const withoutInlineVoiceover = withoutBlockVoiceover.replace(
    /<!--\s*(?:voiceover|narration):\s*([\s\S]*?)\s*-->/gi,
    (_match, text) => {
      const trimmed = text.trim();
      if (trimmed) parts.push(trimmed);
      return '';
    },
  );

  return {
    markdownWithoutVoiceover: withoutInlineVoiceover.trim(),
    voiceoverText: parts.join('\n\n').trim(),
  };
};

export const stripControlComments = (markdownText) => {
  const {markdownWithoutVoiceover} = extractVoiceover(markdownText);

  return markdownWithoutVoiceover
    .replace(/<!--\s*duration:\s*\d+(?:\.\d+)?\s*-->/gi, '')
    .replace(/<!--\s*(?:layout|variant):\s*[a-z-]+\s*-->/gi, '')
    .replace(/<!--\s*(?:accent|accent-color|theme-color):\s*[\s\S]*?\s*-->/gi, '')
    .trim();
};

export const markdownToPlainText = (markdownText) => {
  return markdownText
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[>*_~|]/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const getWordCount = (markdownText) => {
  const latinWords = markdownText.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const chineseCharacters = markdownText.match(/[\u4E00-\u9FFF]/g)?.length ?? 0;
  return latinWords + Math.ceil(chineseCharacters / 2);
};

export const getHeading = (markdownText, index) => {
  const match = markdownText.match(/^#{1,3}\s+(.+)$/m);
  return match?.[1]?.trim() ?? `第 ${index + 1} 页`;
};

export const splitCaptionSegments = (text) => {
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (!normalizedText) {
    return [];
  }

  const sentenceLikeParts = normalizedText.match(/[^。！？!?；;：:]+[。！？!?；;：:]?/g) ?? [normalizedText];

  return sentenceLikeParts
    .flatMap((part) => {
      const trimmed = part.trim();
      if (!trimmed) return [];
      if (trimmed.length <= 26) return [trimmed];

      const commaParts = trimmed
        .split(/(?<=[，,、])/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (commaParts.length > 1) {
        return commaParts;
      }

      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length <= 8) return [trimmed];

      const chunks = [];
      for (let index = 0; index < words.length; index += 8) {
        chunks.push(words.slice(index, index + 8).join(' '));
      }

      return chunks;
    })
    .filter(Boolean);
};

export const buildCaptionCues = (text, durationInFrames, fps) => {
  const segments = splitCaptionSegments(text);

  if (segments.length === 0) {
    return [];
  }

  const minimumFrames = Math.max(Math.round(fps * 0.9), 12);
  const weights = segments.map((segment) => Math.max(segment.replace(/\s+/g, '').length, 2));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const cues = [];
  let cursor = 0;

  segments.forEach((segment, index) => {
    const remainingSegments = segments.length - index;
    const remainingFrames = durationInFrames - cursor;
    const remainingMinimum = minimumFrames * (remainingSegments - 1);
    const proportionalFrames = Math.round((durationInFrames * weights[index]) / totalWeight);
    const allocatedFrames =
      index === segments.length - 1
        ? remainingFrames
        : clamp(proportionalFrames, minimumFrames, Math.max(minimumFrames, remainingFrames - remainingMinimum));
    const safeEndFrame = Math.min(durationInFrames, cursor + allocatedFrames);

    cues.push({
      id: `cue-${index + 1}`,
      text: segment,
      startFrame: cursor,
      endFrame: Math.max(cursor + 1, safeEndFrame),
    });

    cursor = safeEndFrame;
  });

  return cues;
};

export const getAvailableVoices = () => {
  const result = spawnSync('say', ['-v', '?'], {encoding: 'utf8'});

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s{2,}|\t+/)[0])
    .filter(Boolean);
};

const normalizeTtsProvider = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized || normalized === 'system' || normalized === 'say' || normalized === 'macos') {
    return 'system';
  }

  if (normalized === 'qwen' || normalized === 'qwen-local' || normalized === 'qwen3' || normalized === 'qwen3-local') {
    return 'qwen-local';
  }

  if (normalized === 'mimo' || normalized === 'mimo-v2' || normalized === 'mimo-tts' || normalized === 'mimo-v2-tts' || normalized === 'xiaomi') {
    return 'mimo';
  }

  return normalized;
};

const normalizeTtsLanguage = (value, markdownText) => {
  const raw = String(value ?? '').trim().toLowerCase();

  if (!raw || raw === 'auto') {
    return /[\u4E00-\u9FFF]/.test(markdownText) ? 'Chinese' : 'English';
  }

  if (['zh', 'zh-cn', 'zh-hans', 'cn', 'chinese', 'mandarin'].includes(raw)) {
    return 'Chinese';
  }

  if (['en', 'en-us', 'en-gb', 'english'].includes(raw)) {
    return 'English';
  }

  return value;
};

const inferQwenMode = (model, voice) => {
  const normalized = String(model ?? '').toLowerCase();

  if (normalized.includes('voicedesign')) {
    return 'voice-design';
  }

  if (normalized.includes('customvoice')) {
    return 'custom-voice';
  }

  if (normalized.includes('base')) {
    return 'base';
  }

  return voice ? 'custom-voice' : 'voice-design';
};

const getDefaultQwenInstruction = (language) => {
  return language === 'Chinese'
    ? '自然、清晰、专业的中文视频讲解音色，语速稳定，适合技术教程和产品介绍。'
    : 'A clear, natural and professional narrator voice for tutorial videos.';
};

export const pickVoice = ({requestedVoice, availableVoices, markdownText}) => {
  if (requestedVoice && availableVoices.includes(requestedVoice)) {
    return requestedVoice;
  }

  const hasChinese = /[\u4E00-\u9FFF]/.test(markdownText);
  const preferredVoices = hasChinese
    ? ['Tingting', 'Meijia', 'Sin-ji', 'Yu-shu', 'Samantha']
    : ['Samantha', 'Daniel', 'Alex', 'Tingting'];

  return preferredVoices.find((voice) => availableVoices.includes(voice)) ?? availableVoices[0] ?? 'Samantha';
};

export const getTtsRate = (meta, markdownText) => {
  const envRate = parseNumericValue(process.env.TTS_RATE ?? '');
  if (envRate) return envRate;
  if (meta.ttsRate) return meta.ttsRate;
  return /[\u4E00-\u9FFF]/.test(markdownText) ? 185 : 175;
};

const resolveDefaultQwenPython = () => {
  if (process.env.QWEN_PYTHON) {
    return process.env.QWEN_PYTHON;
  }

  const isWindows = process.platform === 'win32';
  const localVenvPython = isWindows
    ? join(process.cwd(), '.venv-qwen', 'Scripts', 'python.exe')
    : join(process.cwd(), '.venv-qwen', 'bin', 'python');
  if (existsSync(localVenvPython)) {
    return localVenvPython;
  }

  return isWindows ? 'python' : 'python3';
};

const resolveLocalQwenModelPath = (modelName) => {
  const normalized = String(modelName ?? '').trim();

  if (!normalized || normalized.startsWith('.') || normalized.startsWith('/') || normalized.includes('\\')) {
    return normalized;
  }

  const repoName = normalized.split('/').pop();
  if (!repoName) {
    return normalized;
  }

  const localMirrorDir = join(process.cwd(), '.models', repoName);
  return existsSync(localMirrorDir) ? localMirrorDir : normalized;
};

const resolveReferenceAudioPath = (referenceAudio, markdownFilePath) => {
  const normalized = String(referenceAudio ?? '').trim();

  if (!normalized || isRemoteAsset(normalized)) {
    return normalized;
  }

  const baseDir = markdownFilePath ? dirname(markdownFilePath) : process.cwd();
  return resolve(baseDir, normalized);
};

const inferMimoVoice = (requestedVoice, language) => {
  const normalized = String(requestedVoice ?? '').trim().toLowerCase();
  const validVoices = ['mimo_default', 'default_zh', 'default_en'];

  if (validVoices.includes(normalized)) {
    return normalized;
  }

  return language === 'Chinese' ? 'default_zh' : 'default_en';
};

const resolveTtsConfig = ({meta, markdownText, markdownFilePath, availableVoices = []}) => {
  const provider = normalizeTtsProvider(process.env.TTS_PROVIDER ?? meta.ttsProvider ?? 'qwen-local');
  const language = normalizeTtsLanguage(process.env.TTS_LANGUAGE ?? meta.ttsLanguage ?? 'auto', markdownText);
  const requestedVoice = process.env.TTS_VOICE ?? meta.ttsVoice ?? (provider === 'qwen-local' ? process.env.QWEN_TTS_VOICE ?? 'Vivian' : undefined);
  const instruction = process.env.TTS_INSTRUCTION ?? meta.ttsInstruction;
  const rate = getTtsRate(meta, markdownText);

  if (provider === 'qwen-local') {
    const requestedModel = process.env.QWEN_TTS_MODEL ?? meta.ttsModel ?? 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice';
    const mode = inferQwenMode(requestedModel, requestedVoice);
    const model = resolveLocalQwenModelPath(requestedModel);
    const rawReferenceAudio = process.env.QWEN_TTS_REFERENCE_AUDIO ?? meta.ttsReferenceAudio ?? '';
    const referenceAudio = resolveReferenceAudioPath(rawReferenceAudio, markdownFilePath);
    const referenceText = process.env.QWEN_TTS_REFERENCE_TEXT ?? meta.ttsReferenceText ?? '';
    const xVectorOnlyMode = parseBooleanValue(
      process.env.QWEN_TTS_X_VECTOR_ONLY_MODE ?? process.env.QWEN_TTS_X_VECTOR_ONLY ?? meta.ttsXVectorOnlyMode ?? '',
    ) ?? false;

    return {
      provider,
      language,
      requestedVoice,
      voice: requestedVoice,
      rate,
      instruction: instruction ?? (mode === 'voice-design' ? getDefaultQwenInstruction(language) : ''),
      model,
      mode,
      referenceAudio,
      referenceText,
      xVectorOnlyMode,
      pythonCommand: resolveDefaultQwenPython(),
      device: process.env.QWEN_TTS_DEVICE ?? (process.platform === 'darwin' ? 'cpu' : 'auto'),
      dtype: process.env.QWEN_TTS_DTYPE ?? (process.platform === 'darwin' ? 'float32' : 'auto'),
      attnImplementation: process.env.QWEN_TTS_ATTENTION ?? process.env.QWEN_TTS_ATTN_IMPLEMENTATION ?? 'auto',
    };
  }

  if (provider === 'mimo') {
    const apiKey = process.env.MIMO_API_KEY ?? meta.ttsApiKey ?? '';
    const baseUrl = process.env.MIMO_BASE_URL ?? meta.ttsBaseUrl ?? 'https://api.xiaomimimo.com/v1';
    const model = process.env.MIMO_TTS_MODEL ?? meta.ttsModel ?? 'mimo-v2-tts';
    const voice = inferMimoVoice(requestedVoice, language);
    const speed = meta.ttsRate ? meta.ttsRate / 175 : 1.0;

    return {
      provider,
      language,
      requestedVoice,
      voice,
      rate,
      instruction,
      model,
      apiKey,
      baseUrl,
      speed: clamp(speed, 0.25, 4.0),
    };
  }

  return {
    provider: 'system',
    language,
    requestedVoice,
    voice: pickVoice({requestedVoice, availableVoices, markdownText}),
    rate,
    instruction,
  };
};

export const generateSpeech = ({text, voice, rate, outputPath}) => {
  const tempAiffPath = outputPath.replace(/\.wav$/, '.aiff');

  rmSync(outputPath, {force: true});
  rmSync(tempAiffPath, {force: true});

  const sayResult = spawnSync('say', ['-v', voice, '-r', String(rate), '-o', tempAiffPath, text], {
    encoding: 'utf8',
  });

  if (sayResult.status !== 0) {
    throw new Error(sayResult.stderr || sayResult.stdout || 'say 执行失败');
  }

  const convertResult = spawnSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', tempAiffPath, outputPath], {
    encoding: 'utf8',
  });

  unlinkSync(tempAiffPath);

  if (convertResult.status !== 0) {
    throw new Error(convertResult.stderr || convertResult.stdout || 'afconvert 执行失败');
  }
};

const runQwenWorker = ({pythonCommand, args = [], payload}) => {
  const result = spawnSync(pythonCommand, [QWEN_WORKER_PATH, ...args], {
    encoding: 'utf8',
    input: payload ? JSON.stringify(payload) : undefined,
    maxBuffer: 10 * 1024 * 1024,
  });

  return result;
};

const parseWorkerJson = (text) => {
  const trimmed = String(text ?? '').trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();

    for (const line of lines) {
      try {
        return JSON.parse(line);
      } catch {
        // continue searching the last JSON line in mixed stdout/stderr output
      }
    }

    return null;
  }
};

export const checkQwenLocalEnvironment = ({pythonCommand = resolveDefaultQwenPython()} = {}) => {
  const result = runQwenWorker({pythonCommand, args: ['--check']});
  const parsed = parseWorkerJson(result.stdout) ?? parseWorkerJson(result.stderr);

  return {
    ok: result.status === 0 && Boolean(parsed?.ok),
    pythonCommand,
    details: parsed,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const generateSpeechWithQwen = ({slides, ttsConfig}) => {
  if (ttsConfig.mode === 'base') {
    if (!ttsConfig.referenceAudio) {
      throw new Error(
        'Qwen3-TTS Base / VoiceClone 模式需要参考音频。请在 Markdown frontmatter 中配置 `ttsReferenceAudio`，或设置环境变量 `QWEN_TTS_REFERENCE_AUDIO`。',
      );
    }

    if (!ttsConfig.xVectorOnlyMode && !ttsConfig.referenceText) {
      throw new Error(
        'Qwen3-TTS Base / VoiceClone 模式需要参考音频对应的逐字转写。请配置 `ttsReferenceText`，或显式设置 `ttsXVectorOnlyMode: true`（效果通常会差一些）。',
      );
    }
  }

  const items = slides
    .filter((slide) => slide.narration)
    .map((slide) => ({
      text: slide.narration,
      outputPath: slide.audioOutputPath,
      language: ttsConfig.language,
      speaker: ttsConfig.voice,
      instruct: ttsConfig.instruction,
    }));

  if (items.length === 0) {
    return;
  }

  console.log(`[qwen-local] using model: ${ttsConfig.model}`);
  if (ttsConfig.mode === 'base') {
    console.log(`[qwen-local] voice clone reference: ${ttsConfig.referenceAudio}`);
  }

  const result = runQwenWorker({
    pythonCommand: ttsConfig.pythonCommand,
    payload: {
      model: ttsConfig.model,
      mode: ttsConfig.mode,
      device: ttsConfig.device,
      dtype: ttsConfig.dtype,
      attnImplementation: ttsConfig.attnImplementation,
      referenceAudio: ttsConfig.referenceAudio,
      referenceText: ttsConfig.referenceText,
      xVectorOnlyMode: ttsConfig.xVectorOnlyMode,
      items,
    },
  });

  if (result.status !== 0) {
    const parsed = parseWorkerJson(result.stdout) ?? parseWorkerJson(result.stderr);
    const errorMsg = parsed?.error ?? 'Qwen3-TTS worker 执行失败';
    const tb = parsed?.traceback ?? '';
    const stderr = result.stderr ?? '';
    const detail = [errorMsg, tb, stderr].filter(Boolean).join('\n');
    throw new Error(`${detail}\n\n可先执行: \`npm run qwen:doctor\` 检查本地 Python / qwen-tts 环境。`);
  }
};

const generateSpeechWithMimo = ({slides, ttsConfig}) => {
  const items = slides
    .filter((slide) => slide.narration)
    .map((slide) => ({
      text: slide.narration,
      outputPath: slide.audioOutputPath,
    }));

  if (items.length === 0) {
    return;
  }

  if (!ttsConfig.apiKey) {
    throw new Error(
      'MiMo-V2-TTS 需要 API Key。请通过以下任一方式提供：\n' +
      '  1. 环境变量: MIMO_API_KEY=your_key\n' +
      '  2. Markdown frontmatter: ttsApiKey: your_key\n' +
      '  3. .env 文件: MIMO_API_KEY=your_key\n' +
      '获取 API Key: https://platform.xiaomimimo.com/',
    );
  }

  const baseUrl = ttsConfig.baseUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;

  console.log(`[mimo] using model: ${ttsConfig.model}, voice: ${ttsConfig.voice}`);
  console.log(`[mimo] endpoint: ${endpoint}`);
  console.log(`[mimo] generating ${items.length} audio file(s) ...`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const contentText = ttsConfig.instruction
      ? `<style>${ttsConfig.instruction}</style>${item.text}`
      : item.text;

    const payload = JSON.stringify({
      model: ttsConfig.model,
      audio: {
        format: 'wav',
        voice: ttsConfig.voice,
      },
      messages: [
        {
          role: 'assistant',
          content: contentText,
        },
      ],
    });

    mkdirSync(dirname(item.outputPath), {recursive: true});

    // Write payload to a temp file to avoid shell escaping issues
    const payloadTmpPath = `${item.outputPath}.req.json`;
    writeFileSync(payloadTmpPath, payload, 'utf8');

    const curlArgs = [
      '-s', '-S', '--fail-with-body',
      '-X', 'POST', endpoint,
      '-H', 'Content-Type: application/json',
      '-H', `api-key: ${ttsConfig.apiKey}`,
      '-d', `@${payloadTmpPath}`,
      '--max-time', '120',
    ];

    const result = spawnSync('curl', curlArgs, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    // Clean up temp file
    try { unlinkSync(payloadTmpPath); } catch {}

    if (result.status !== 0) {
      const stderr = result.stderr ?? '';
      const stdout = result.stdout ?? '';
      const errorDetail = stderr.includes('401') || stdout.includes('401')
        ? 'API Key 无效或已过期，请检查 MIMO_API_KEY'
        : stderr.includes('429') || stdout.includes('429')
          ? 'API 请求过于频繁，请稍后重试'
          : stderr || stdout || 'MiMo-V2-TTS API 调用失败';
      throw new Error(`[mimo] slide ${i + 1} 音频生成失败: ${errorDetail}`);
    }

    // Parse JSON response and extract base64 audio data
    const responseText = result.stdout ?? '';
    let audioBase64;
    try {
      const parsed = JSON.parse(responseText);
      audioBase64 = parsed?.choices?.[0]?.message?.audio?.data;
      if (!audioBase64) {
        const errMsg = parsed?.error?.message ?? JSON.stringify(parsed).slice(0, 200);
        throw new Error(`API 响应中无音频数据: ${errMsg}`);
      }
    } catch (parseErr) {
      if (parseErr.message.includes('API 响应')) throw parseErr;
      throw new Error(`[mimo] slide ${i + 1} 响应解析失败: ${responseText.slice(0, 300)}`);
    }

    // Decode base64 and write wav file
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    writeFileSync(item.outputPath, audioBuffer);

    if (!existsSync(item.outputPath)) {
      throw new Error(`[mimo] slide ${i + 1} 音频文件未生成: ${item.outputPath}`);
    }

    console.log(`[mimo] slide ${i + 1}/${items.length} done`);
  }
};

export const getAudioDurationInSeconds = (audioPath) => {
  // Method 1: ffprobe (cross-platform, preferred)
  const ffprobeResult = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
    {encoding: 'utf8'},
  );

  if (ffprobeResult.status === 0 && ffprobeResult.stdout) {
    const duration = Number(ffprobeResult.stdout.trim());
    if (Number.isFinite(duration)) {
      return duration;
    }
  }

  // Method 2: afinfo (macOS only)
  if (process.platform === 'darwin') {
    const afinfoResult = spawnSync('afinfo', [audioPath], {encoding: 'utf8'});
    const match = afinfoResult.stdout?.match(/estimated duration:\s*([\d.]+)/i);
    if (match) {
      return Number(match[1]);
    }
  }

  // Method 3: Python soundfile fallback (works on all platforms)
  const pythonCmd = process.platform === 'win32'
    ? (process.env.QWEN_PYTHON || 'python')
    : (process.env.QWEN_PYTHON || 'python3');
  const pyResult = spawnSync(
    pythonCmd,
    ['-c', `import soundfile as sf; d=sf.info(r"${audioPath}"); print(d.duration)`],
    {encoding: 'utf8'},
  );

  if (pyResult.status === 0 && pyResult.stdout) {
    const duration = Number(pyResult.stdout.trim());
    if (Number.isFinite(duration)) {
      return duration;
    }
  }

  throw new Error(`无法识别音频时长: ${audioPath}\n请安装 ffprobe (https://ffmpeg.org) 或确保 Python soundfile 可用。`);
};

export const createPresentationAssets = ({markdownText, markdownFilePath, fps, assetDir, assetPrefix, availableVoices}) => {
  const {body, meta} = parseFrontmatter(markdownText);
  const rawSlides = body.split(/\n-{3,}\n/g).filter((slide) => slide.trim().length > 0);
  const slidesSource = rawSlides.length > 0 ? rawSlides : [body];
  const ttsConfig = resolveTtsConfig({meta, markdownText, markdownFilePath, availableVoices});

  mkdirSync(assetDir, {recursive: true});

  const manifestPath = join(assetDir, 'tts-manifest.json');
  const audioManifest = readAudioManifest(manifestPath);

  const slideDrafts = slidesSource.map((slideSource, index) => {
    const cleanedMarkdown = stripControlComments(slideSource);
    const {voiceoverText} = extractVoiceover(slideSource);
    const directives = extractSlideDirectives(slideSource);
    const narration = voiceoverText || markdownToPlainText(cleanedMarkdown);
    const wordCount = getWordCount(cleanedMarkdown);
    const explicitDurationInFrames = extractDurationInFrames(slideSource, fps);
    const estimatedSeconds = 2.5 + getWordCount(narration || cleanedMarkdown) * 0.2;
    const estimatedDurationInFrames = Math.round(clamp(estimatedSeconds, MIN_SLIDE_SECONDS, MAX_SLIDE_SECONDS) * fps);
    const fileName = `slide-${String(index + 1).padStart(2, '0')}.wav`;
    const audioOutputPath = join(assetDir, fileName);
    const relativeAudioPath = `${assetPrefix}/${fileName}`;

    return {
      id: `slide-${index + 1}`,
      heading: getHeading(cleanedMarkdown, index),
      markdown: cleanedMarkdown,
      narration,
      wordCount,
      explicitDurationInFrames,
      estimatedDurationInFrames,
      fileName,
      audioOutputPath,
      relativeAudioPath,
      layout: directives.layout,
      accentColor: directives.accentColor,
      audioCacheKey: createAudioCacheKey({narration, ttsConfig}),
    };
  });

  const slidesNeedingAudio = slideDrafts.filter((slide) => !shouldReuseAudio({slide, manifestEntries: audioManifest.entries}));
  const reusedAudioCount = slideDrafts.filter((slide) => slide.narration).length - slidesNeedingAudio.filter((slide) => slide.narration).length;

  if (reusedAudioCount > 0) {
    console.log(`[tts-cache] 复用已有音频 ${reusedAudioCount} 条`);
  }

  if (ttsConfig.provider === 'qwen-local') {
    generateSpeechWithQwen({slides: slidesNeedingAudio, ttsConfig});
  } else if (ttsConfig.provider === 'mimo') {
    generateSpeechWithMimo({slides: slidesNeedingAudio, ttsConfig});
  } else {
    slidesNeedingAudio.forEach((slide) => {
      if (!slide.narration) {
        return;
      }

      generateSpeech({
        text: slide.narration,
        voice: ttsConfig.voice,
        rate: ttsConfig.rate,
        outputPath: slide.audioOutputPath,
      });
    });
  }

  const nextManifest = {
    version: AUDIO_MANIFEST_VERSION,
    entries: Object.fromEntries(
      slideDrafts
        .filter((slide) => slide.narration)
        .map((slide) => [slide.fileName, {cacheKey: slide.audioCacheKey}]),
    ),
  };

  writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2), 'utf8');

  const slides = slideDrafts.map((slide) => {
    const audioDurationInFrames = slide.narration
      ? Math.max(1, Math.round(getAudioDurationInSeconds(slide.audioOutputPath) * fps))
      : undefined;
    const durationInFrames = Math.max(
      slide.explicitDurationInFrames ?? 0,
      slide.estimatedDurationInFrames,
      audioDurationInFrames ? audioDurationInFrames + Math.round(AUDIO_TAIL_SECONDS * fps) : 0,
    );
    const cueDurationInFrames = audioDurationInFrames ?? durationInFrames;

    return {
      id: slide.id,
      heading: slide.heading,
      markdown: slide.markdown,
      narration: slide.narration,
      wordCount: slide.wordCount,
      durationInFrames,
      captionCues: buildCaptionCues(slide.narration, cueDurationInFrames, fps),
      layout: slide.layout,
      accentColor: slide.accentColor,
      audioSrc: slide.narration ? slide.relativeAudioPath : undefined,
      audioDurationInFrames,
    };
  });

  const totalFrames = slides.reduce((sum, slide) => sum + slide.durationInFrames, 0);

  return {
    meta: {
      ...meta,
      ttsProvider: ttsConfig.provider,
      ttsVoice: ttsConfig.voice,
      ttsRate: ttsConfig.rate,
      ttsModel: ttsConfig.model,
      ttsLanguage: ttsConfig.language,
      ttsInstruction: ttsConfig.instruction,
      ttsReferenceAudio: ttsConfig.referenceAudio,
      ttsReferenceText: ttsConfig.referenceText,
      ttsXVectorOnlyMode: ttsConfig.xVectorOnlyMode,
    },
    slides,
    totalFrames,
    slidesSource,
  };
};

/**
 * Generate HTML slides and record them to video (html-ppt mode).
 * This is an async add-on step that runs AFTER createPresentationAssets.
 *
 * Mutates presentation.slides[].htmlVideoSrc in-place.
 */
export const createHtmlPptAssets = async ({presentation, slidesSource, assetDir, assetPrefix, fps}) => {
  const {generateHtmlSlides} = await import('./html-slide-generator.mjs');
  const {recordHtmlVideos} = await import('./html-video-recorder.mjs');
  const {startHtmlServer} = await import('./html-server.mjs');

  const projectRoot = resolve(__dirname, '..', '..');
  const vendorDir = join(projectRoot, 'vendor', 'html-ppt');
  const theme = presentation.meta.theme || 'tokyo-night';

  // 1. Generate HTML slide files
  const htmlOutputDir = join(assetDir, 'html-slides');
  console.log(`[html-ppt] Generating HTML slides (theme: ${theme})...`);
  const htmlPaths = generateHtmlSlides({
    presentation,
    slideMarkdownSources: slidesSource,
    outputDir: htmlOutputDir,
    theme,
    assetsBasePath: join(vendorDir, 'assets'),
  });
  console.log(`[html-ppt] Generated ${htmlPaths.length} HTML files`);

  // 2. Start local HTTP server (serves the whole project root so vendor/ paths work)
  const server = await startHtmlServer({rootDir: projectRoot, port: 0});
  console.log(`[html-ppt] HTTP server started at ${server.url}`);

  try {
    // 3. Record each slide to video
    const durations = presentation.slides.map((s) => s.durationInFrames / fps);
    const mp4Paths = await recordHtmlVideos({
      htmlPaths,
      durations,
      outputDir: join(projectRoot, 'public', 'generated', assetPrefix.split('/').filter(Boolean).join('/')),
      baseUrl: server.url,
      htmlDir: projectRoot,
      viewport: {width: 1920, height: 1080},
    });

    // 4. Write htmlVideoSrc into each slide
    presentation.slides.forEach((slide, i) => {
      if (mp4Paths[i]) {
        const relativeMp4 = mp4Paths[i].slice(join(projectRoot, 'public').length + 1);
        slide.htmlVideoSrc = relativeMp4;
      }
    });

    console.log(`[html-ppt] Recorded ${mp4Paths.filter(Boolean).length}/${mp4Paths.length} video clips`);
  } finally {
    await server.close();
  }
};

export const formatSrtTime = (totalSeconds) => {
  const milliseconds = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const remainder = milliseconds % 1000;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':') + `,${String(remainder).padStart(3, '0')}`;
};

export const buildSrt = (presentation, fps) => {
  const entries = [];
  let slideOffset = 0;
  let index = 1;

  presentation.slides.forEach((slide) => {
    slide.captionCues.forEach((cue) => {
      const startFrame = slideOffset + cue.startFrame;
      const endFrame = slideOffset + cue.endFrame;
      entries.push(`${index}\n${formatSrtTime(startFrame / fps)} --> ${formatSrtTime(endFrame / fps)}\n${cue.text}\n`);
      index += 1;
    });

    slideOffset += slide.durationInFrames;
  });

  return entries.join('\n');
};

export const writeTextFile = (filePath, content) => {
  writeFileSync(filePath, content, 'utf8');
};

export const writePreviewModule = ({targetPath, markdownText, presentation}) => {
  const moduleContent = `import type {MarkdownPresentation} from '../markdown';\n\nexport const previewMarkdown = ${JSON.stringify(markdownText)};\n\nexport const previewPresentation: MarkdownPresentation = ${JSON.stringify(presentation, null, 2)};\n`;
  writeFileSync(targetPath, moduleContent, 'utf8');
};
