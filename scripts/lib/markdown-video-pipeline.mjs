import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const DEFAULT_FPS = 30;
export const AUDIO_TAIL_SECONDS = 0.45;
export const MIN_SLIDE_SECONDS = 3;
export const MAX_SLIDE_SECONDS = 9;
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

  const localVenvPython = join(process.cwd(), '.venv-qwen', 'bin', 'python');
  return existsSync(localVenvPython) ? localVenvPython : 'python3';
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

const resolveTtsConfig = ({meta, markdownText, availableVoices = []}) => {
  const provider = normalizeTtsProvider(process.env.TTS_PROVIDER ?? meta.ttsProvider ?? 'qwen-local');
  const language = normalizeTtsLanguage(process.env.TTS_LANGUAGE ?? meta.ttsLanguage ?? 'auto', markdownText);
  const requestedVoice = process.env.TTS_VOICE ?? meta.ttsVoice ?? (provider === 'qwen-local' ? process.env.QWEN_TTS_VOICE ?? 'Vivian' : undefined);
  const instruction = process.env.TTS_INSTRUCTION ?? meta.ttsInstruction;
  const rate = getTtsRate(meta, markdownText);

  if (provider === 'qwen-local') {
    const requestedModel = process.env.QWEN_TTS_MODEL ?? meta.ttsModel ?? 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice';
    const model = resolveLocalQwenModelPath(requestedModel);

    return {
      provider,
      language,
      requestedVoice,
      voice: requestedVoice,
      rate,
      instruction: instruction ?? (inferQwenMode(requestedModel, requestedVoice) === 'voice-design' ? getDefaultQwenInstruction(language) : ''),
      model,
      mode: inferQwenMode(requestedModel, requestedVoice),
      pythonCommand: resolveDefaultQwenPython(),
      device: process.env.QWEN_TTS_DEVICE ?? (process.platform === 'darwin' ? 'cpu' : 'auto'),
      dtype: process.env.QWEN_TTS_DTYPE ?? (process.platform === 'darwin' ? 'float32' : 'auto'),
      attnImplementation: process.env.QWEN_TTS_ATTENTION ?? process.env.QWEN_TTS_ATTN_IMPLEMENTATION ?? 'auto',
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

export const checkQwenLocalEnvironment = ({pythonCommand = process.env.QWEN_PYTHON ?? 'python3'} = {}) => {
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
    throw new Error('当前 `qwen-local` provider 暂不支持 Base/VoiceClone 模式，请先使用 VoiceDesign 或 CustomVoice 模型。');
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

  const result = runQwenWorker({
    pythonCommand: ttsConfig.pythonCommand,
    payload: {
      model: ttsConfig.model,
      mode: ttsConfig.mode,
      device: ttsConfig.device,
      dtype: ttsConfig.dtype,
      attnImplementation: ttsConfig.attnImplementation,
      items,
    },
  });

  if (result.status !== 0) {
    const parsed = parseWorkerJson(result.stdout) ?? parseWorkerJson(result.stderr);
    const message = parsed?.error ?? result.stderr ?? result.stdout ?? 'Qwen3-TTS worker 执行失败';
    throw new Error(`${message}\n\n可先执行: \`npm run qwen:doctor\` 检查本地 Python / qwen-tts 环境。`);
  }
};

export const getAudioDurationInSeconds = (audioPath) => {
  const ffprobeResult = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath],
    {encoding: 'utf8'},
  );

  if (ffprobeResult.status === 0) {
    const duration = Number(ffprobeResult.stdout.trim());
    if (Number.isFinite(duration)) {
      return duration;
    }
  }

  const afinfoResult = spawnSync('afinfo', [audioPath], {encoding: 'utf8'});
  const match = afinfoResult.stdout.match(/estimated duration:\s*([\d.]+)/i);

  if (match) {
    return Number(match[1]);
  }

  throw new Error(`无法识别音频时长: ${audioPath}`);
};

export const createPresentationAssets = ({markdownText, fps, assetDir, assetPrefix, availableVoices}) => {
  const {body, meta} = parseFrontmatter(markdownText);
  const rawSlides = body.split(/\n-{3,}\n/g).filter((slide) => slide.trim().length > 0);
  const slidesSource = rawSlides.length > 0 ? rawSlides : [body];
  const ttsConfig = resolveTtsConfig({meta, markdownText, availableVoices});

  mkdirSync(assetDir, {recursive: true});

  const slideDrafts = slidesSource.map((slideSource, index) => {
    const cleanedMarkdown = stripControlComments(slideSource);
    const {voiceoverText} = extractVoiceover(slideSource);
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
      audioOutputPath,
      relativeAudioPath,
    };
  });

  if (ttsConfig.provider === 'qwen-local') {
    generateSpeechWithQwen({slides: slideDrafts, ttsConfig});
  } else {
    slideDrafts.forEach((slide) => {
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
    },
    slides,
    totalFrames,
  };
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
