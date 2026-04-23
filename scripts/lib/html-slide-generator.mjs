/**
 * html-slide-generator.mjs — Markdown slides → standalone HTML files (html-ppt style).
 *
 * Takes a parsed MarkdownPresentation (slides array) and generates one HTML file
 * per slide, using the html-ppt design system (base.css, themes, animations, Canvas FX).
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const VENDOR_DIR = join(PROJECT_ROOT, 'vendor', 'html-ppt');

// ─────────────────── variant → html-ppt layout mapping ───────────────────
const VARIANT_TO_LAYOUT = {
  'hero': 'cover',
  'split-list': 'two-column',
  'timeline': 'timeline',
  'grid': 'kpi-grid',
  'mosaic': 'kpi-grid',
  'argument': 'bullets',
  'triptych': 'three-column',
  'manifesto': 'bullets',
  'spotlight': 'section-divider',
  'quote': 'big-quote',
  'code': 'code',
  'panel': 'two-column',
  'centered': 'section-divider',
  'waterfall': 'bullets',
  'radar': 'kpi-grid',
  'compare': 'two-column',
  'pyramid': 'bullets',
  'stat-cards': 'kpi-grid',
  'headline': 'section-divider',
  'sidebar-note': 'two-column',
  'filmstrip': 'timeline',
  'duo': 'two-column',
  'orbit': 'three-column',
  'kanban': 'three-column',
  'stack': 'bullets',
  'accent-bar': 'section-divider',
  'split-quote': 'big-quote',
  'checklist': 'bullets',
  'minimal': 'thanks',
  'magazine': 'two-column',
};

// ─────────────────── animation selection ───────────────────
const CONTENT_ANIMS = [
  'fade-up', 'fade-left', 'fade-right', 'rise-in', 'zoom-pop',
  'blur-in', 'stagger-list', 'shimmer-sweep',
];

const pickAnim = (index) => CONTENT_ANIMS[index % CONTENT_ANIMS.length];

// ─────────────────── helpers ───────────────────
const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stripMarkdownSyntax = (text) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1');

const extractStrong = (text) => {
  const matches = [];
  text.replace(/\*\*(.+?)\*\*/g, (_, m) => { matches.push(m); return m; });
  return matches;
};

const markdownInlineToHtml = (text) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

// Parse a single slide markdown to extract structure (mirrors slide-structure.ts)
const parseSlideStructure = (markdown) => {
  const lines = markdown.split('\n');
  const bulletItems = [];
  const orderedItems = [];
  const paragraphs = [];
  let codeBlock = null;
  let codeLanguage = '';
  let inCode = false;
  const codeLines = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLanguage = line.slice(3).trim();
      } else {
        inCode = false;
        codeBlock = codeLines.join('\n');
        codeLines.length = 0;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (/^#{1,6}\s/.test(line)) continue; // skip headings
    if (/^<!--/.test(line)) continue; // skip comments

    const bulletMatch = line.match(/^\s*[-*+]\s+(.+)/);
    if (bulletMatch) { bulletItems.push(bulletMatch[1].trim()); continue; }
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)/);
    if (orderedMatch) { orderedItems.push(orderedMatch[1].trim()); continue; }
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('<!--') && !trimmed.startsWith('-->')) {
      paragraphs.push(trimmed);
    }
  }

  return {bulletItems, orderedItems, paragraphs, codeBlock, codeLanguage};
};

// ─────────────────── Layout renderers ───────────────────

const renderCover = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const subtitle = structure.paragraphs[0] ? `<p class="lede">${markdownInlineToHtml(structure.paragraphs[0])}</p>` : '';
  const pills = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const pillsHtml = pills.length
    ? `<div class="row wrap mt-l">${pills.map((p, i) => `<span class="pill${i === 0 ? ' pill-accent' : ''}">${escapeHtml(stripMarkdownSyntax(p))}</span>`).join('')}</div>`
    : '';

  return `
    <div class="anim-stagger-list">
      <p class="kicker">Slide ${slide.id.split('-')[1] ?? '1'}</p>
      <h1 class="h1 anim-fade-up" data-anim="fade-up">${heading}</h1>
      ${subtitle}
      ${pillsHtml}
    </div>
    ${fxHtml}`;
};

const renderBullets = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const items = [...structure.orderedItems, ...structure.bulletItems];
  const subtitle = structure.paragraphs[0] ? `<p class="lede mb-l">${markdownInlineToHtml(structure.paragraphs[0])}</p>` : '';
  const isOrdered = structure.orderedItems.length > 0;

  const listHtml = items.length
    ? `<ul class="grid g1 anim-stagger-list" style="list-style:none;padding:0;margin:0;gap:14px" data-anim-target>
        ${items.map((item, i) => {
          const prefix = isOrdered ? `${i + 1}. ` : '';
          return `<li class="card card-accent"><h4>${prefix}${markdownInlineToHtml(item)}</h4></li>`;
        }).join('\n        ')}
      </ul>`
    : structure.paragraphs.slice(1).map(p => `<p class="lede">${markdownInlineToHtml(p)}</p>`).join('\n');

  return `
    <p class="kicker">Slide ${slide.id.split('-')[1] ?? ''}</p>
    <h2 class="h2">${heading}</h2>
    ${subtitle}
    ${listHtml}
    ${fxHtml}`;
};

const renderTwoColumn = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const items = [...structure.bulletItems, ...structure.orderedItems];
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);

  const leftContent = leftItems.length
    ? `<ul class="mt-m">${leftItems.map(i => `<li>— ${markdownInlineToHtml(i)}</li>`).join('')}</ul>`
    : structure.paragraphs.slice(0, 2).map(p => `<p class="dim">${markdownInlineToHtml(p)}</p>`).join('');

  const rightContent = rightItems.length
    ? `<ul class="mt-m">${rightItems.map(i => `<li>— ${markdownInlineToHtml(i)}</li>`).join('')}</ul>`
    : structure.paragraphs.slice(2).map(p => `<p class="dim">${markdownInlineToHtml(p)}</p>`).join('');

  return `
    <p class="kicker">Slide ${slide.id.split('-')[1] ?? ''}</p>
    <h2 class="h2">${heading}</h2>
    <div class="grid g2 mt-l" style="align-items:start">
      <div class="card anim-fade-left" data-anim="fade-left">
        ${leftContent || `<p class="dim">左栏内容</p>`}
      </div>
      <div class="card anim-fade-right" data-anim="fade-right">
        ${rightContent || `<p class="dim">右栏内容</p>`}
      </div>
    </div>
    ${fxHtml}`;
};

const renderThreeColumn = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const items = [...structure.bulletItems, ...structure.orderedItems];
  const cols = [items.slice(0, Math.ceil(items.length / 3)), items.slice(Math.ceil(items.length / 3), Math.ceil(items.length * 2 / 3)), items.slice(Math.ceil(items.length * 2 / 3))];
  const emojis = ['🔹', '🔸', '🔻'];

  return `
    <p class="kicker">Slide ${slide.id.split('-')[1] ?? ''}</p>
    <h2 class="h2">${heading}</h2>
    <div class="grid g3 mt-l anim-stagger-list" data-anim-target>
      ${cols.map((col, ci) => `
      <div class="card">
        <div style="font-size:40px">${emojis[ci]}</div>
        ${col.map(item => `<h4 class="mt-s">${markdownInlineToHtml(item)}</h4>`).join('')}
      </div>`).join('')}
    </div>
    ${fxHtml}`;
};

const renderTimeline = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 5);

  const timelineStyle = `
<style>
.tl{position:relative;margin-top:40px}
.tl::before{content:"";position:absolute;left:0;right:0;top:48px;height:2px;background:var(--border)}
.tl .row{display:grid;grid-template-columns:repeat(${items.length},1fr);gap:22px;align-items:start}
.tl .item{position:relative;padding-top:80px;text-align:center}
.tl .dot{position:absolute;top:36px;left:50%;transform:translateX(-50%);width:24px;height:24px;border-radius:50%;background:var(--accent);border:4px solid var(--bg);box-shadow:0 0 0 2px var(--accent)}
.tl .year{font-size:14px;color:var(--text-3);letter-spacing:.12em;text-transform:uppercase;position:absolute;top:0;left:0;right:0;font-weight:600}
.tl h4{font-size:18px}
.tl p{font-size:13px;color:var(--text-2)}
</style>`;

  return `
    ${timelineStyle}
    <p class="kicker">Slide ${slide.id.split('-')[1] ?? ''}</p>
    <h2 class="h2">${heading}</h2>
    <div class="tl">
      <div class="row anim-stagger-list" data-anim-target>
        ${items.map((item, i) => `
        <div class="item">
          <div class="year">Step ${i + 1}</div>
          <div class="dot"></div>
          <h4>${markdownInlineToHtml(item)}</h4>
        </div>`).join('')}
      </div>
    </div>
    ${fxHtml}`;
};

const renderBigQuote = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const quoteText = structure.paragraphs[0] || slide.heading;
  const author = structure.paragraphs[1] || '';

  return `
    <div style="max-width:1040px;margin:0 auto;text-align:center">
      <div class="serif" style="font-size:140px;line-height:.9;color:var(--accent);opacity:.6">"</div>
      <blockquote class="serif anim-fade-up" data-anim="fade-up" style="font-size:48px;line-height:1.25;margin:-40px 0 24px;font-style:italic;font-weight:600">
        ${markdownInlineToHtml(quoteText)}
      </blockquote>
      ${author ? `<p class="dim" style="font-size:20px;letter-spacing:.08em">— ${escapeHtml(stripMarkdownSyntax(author))}</p>` : ''}
    </div>
    ${fxHtml}`;
};

const renderCode = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const code = structure.codeBlock || '';
  const lang = structure.codeLanguage || 'text';

  return `
    <p class="kicker">Code · ${escapeHtml(lang)}</p>
    <h2 class="h2">${heading}</h2>
    <pre class="card mt-m" style="padding:24px;overflow:auto"><code>${escapeHtml(code)}</code></pre>
    ${fxHtml}`;
};

const renderKpiGrid = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 4);

  if (items.length === 0) {
    return renderBullets(slide, structure, anim, fxHtml);
  }

  const cols = items.length <= 2 ? 'g2' : items.length === 3 ? 'g3' : 'g4';

  return `
    <p class="kicker">Slide ${slide.id.split('-')[1] ?? ''}</p>
    <h2 class="h2">${heading}</h2>
    <div class="grid ${cols} mt-l anim-stagger-list" data-anim-target>
      ${items.map((item) => {
        const strong = extractStrong(item);
        const mainText = strong[0] || stripMarkdownSyntax(item).slice(0, 20);
        const subText = stripMarkdownSyntax(item).replace(mainText, '').trim();
        return `
      <div class="card">
        <div style="font-size:36px;font-weight:800;color:var(--accent)">${escapeHtml(mainText)}</div>
        <p class="dim mt-s">${escapeHtml(subText || mainText)}</p>
      </div>`;
      }).join('')}
    </div>
    ${fxHtml}`;
};

const renderSectionDivider = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const subtitle = structure.paragraphs[0] ? `<p class="lede" style="margin:16px auto 0">${markdownInlineToHtml(structure.paragraphs[0])}</p>` : '';

  return `
    <div style="max-width:780px;margin:0 auto;text-align:center">
      <h1 class="h1 anim-rise-in" data-anim="rise-in" style="font-size:88px">${heading}</h1>
      <div class="divider-accent" style="margin:24px auto"></div>
      ${subtitle}
    </div>
    ${fxHtml}`;
};

const renderThanks = (slide, structure, anim, fxHtml) => {
  const heading = escapeHtml(slide.heading);
  const subtitle = structure.paragraphs[0] || '';

  return `
    <div style="text-align:center">
      <h1 class="h1 anim-fade-up" data-anim="fade-up" style="font-size:120px;line-height:1"><span class="gradient-text">${heading}</span></h1>
      ${subtitle ? `<p class="lede" style="margin:18px auto 0">${markdownInlineToHtml(subtitle)}</p>` : ''}
    </div>
    ${fxHtml}`;
};

// Layout dispatcher
const LAYOUT_RENDERERS = {
  'cover': renderCover,
  'bullets': renderBullets,
  'two-column': renderTwoColumn,
  'three-column': renderThreeColumn,
  'timeline': renderTimeline,
  'big-quote': renderBigQuote,
  'code': renderCode,
  'kpi-grid': renderKpiGrid,
  'section-divider': renderSectionDivider,
  'thanks': renderThanks,
};

// ─────────────────── FX extraction ───────────────────
const extractFx = (originalMarkdown) => {
  const match = originalMarkdown?.match(/<!--\s*fx:\s*([\w-]+)\s*-->/i);
  return match?.[1] ?? null;
};

// ─────────────────── Main HTML generation ───────────────────

/**
 * Generate standalone HTML files for each slide.
 *
 * @param {object} options
 * @param {object} options.presentation — Parsed MarkdownPresentation
 * @param {string[]} options.slideMarkdownSources — Raw markdown per slide (before stripping)
 * @param {string} options.outputDir — Directory to write HTML files
 * @param {string} [options.theme='tokyo-night'] — Theme name
 * @param {string} [options.assetsBasePath] — Relative/absolute path to vendor/html-ppt/assets
 * @returns {string[]} — List of generated HTML file paths
 */
export const generateHtmlSlides = ({
  presentation,
  slideMarkdownSources,
  outputDir,
  theme = 'tokyo-night',
  assetsBasePath,
}) => {
  mkdirSync(outputDir, {recursive: true});

  // Resolve assets path: prefer absolute from vendor
  const assetsDir = assetsBasePath || join(VENDOR_DIR, 'assets');
  const generatedPaths = [];

  presentation.slides.forEach((slide, index) => {
    const structure = parseSlideStructure(slide.markdown);
    const variant = slide.layout || 'panel';
    const layoutName = VARIANT_TO_LAYOUT[variant] || 'bullets';
    const renderer = LAYOUT_RENDERERS[layoutName] || renderBullets;
    const anim = pickAnim(index);

    // Extract fx directive from original markdown source
    const originalSource = slideMarkdownSources?.[index] ?? '';
    const fx = extractFx(originalSource);
    const fxHtml = fx
      ? `<div data-fx="${escapeHtml(fx)}" style="position:absolute;inset:0;pointer-events:none;z-index:0"></div>`
      : '';
    const hasFx = Boolean(fx);

    // Compute relative path from outputDir to assetsDir
    const relAssets = relative(outputDir, assetsDir).replace(/\\/g, '/');

    // Center flag for certain layouts
    const centerClass = ['section-divider', 'big-quote', 'thanks'].includes(layoutName) ? ' center tc' : '';

    // Render slide content
    const content = renderer(slide, structure, anim, fxHtml);

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920,height=1080,initial-scale=1">
<title>${escapeHtml(slide.heading)}</title>
<link rel="stylesheet" href="${relAssets}/fonts.css">
<link rel="stylesheet" href="${relAssets}/base.css">
<link rel="stylesheet" id="theme-link" href="${relAssets}/themes/${escapeHtml(theme)}.css">
<link rel="stylesheet" href="${relAssets}/animations/animations.css">
</head>
<body class="single">
<div class="deck">
  <section class="slide is-active${centerClass}" data-title="${escapeHtml(slide.heading)}">
    ${content}
  </section>
</div>
<script src="${relAssets}/runtime.js"><\/script>
${hasFx ? `<script src="${relAssets}/animations/fx-runtime.js"><\/script>` : ''}
</body>
</html>
`;

    const fileName = `slide-${String(index + 1).padStart(2, '0')}.html`;
    const filePath = join(outputDir, fileName);
    writeFileSync(filePath, html, 'utf8');
    generatedPaths.push(filePath);
  });

  return generatedPaths;
};
