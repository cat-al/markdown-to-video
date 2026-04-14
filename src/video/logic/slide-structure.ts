import type {SlideStructure} from '../types';
import {stripMarkdownSyntax} from '../utils';

export const parseSlideStructure = (markdown: string): SlideStructure => {
  const lines = markdown.split('\n');
  const bulletItems: string[] = [];
  const orderedItems: string[] = [];
  const paragraphs: string[] = [];
  const strongPhrases = Array.from(markdown.matchAll(/\*\*([^*]+)\*\*/g), (match) => stripMarkdownSyntax(match[1]));

  let inCodeBlock = false;
  let codeLanguage = '';
  const codeLines: string[] = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.replace(/```/, '').trim();
        return;
      }

      inCodeBlock = false;
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!line || line.startsWith('<!--')) {
      return;
    }

    if (/^#{1,6}\s+/.test(line)) {
      return;
    }

    if (/^\|/.test(line)) {
      return;
    }

    if (/^[-*+]\s+/.test(line)) {
      bulletItems.push(stripMarkdownSyntax(line));
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      orderedItems.push(stripMarkdownSyntax(line));
      return;
    }

    paragraphs.push(stripMarkdownSyntax(line));
  });

  return {
    bulletItems,
    orderedItems,
    paragraphs,
    codeBlock: codeLines.join('\n').trim() || undefined,
    codeLanguage: codeLanguage || undefined,
    strongPhrases,
    hasTable: /^\|.+\|/m.test(markdown),
  };
};
