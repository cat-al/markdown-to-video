import type {SlideVariant, SlideStructure, MarkdownSlide} from '../types';
import {stripMarkdownSyntax} from '../utils';

export const getSlideVariant = ({
  slide,
  slideIndex,
  totalSlides,
  structure,
}: {
  slide: MarkdownSlide;
  slideIndex: number;
  totalSlides: number;
  structure: SlideStructure;
}): SlideVariant => {
  if (slide.layout) {
    return slide.layout;
  }

  const listItems = [...structure.orderedItems, ...structure.bulletItems];
  const totalListItems = listItems.length;
  const heading = stripMarkdownSyntax(slide.heading).toLowerCase();
  const narrative = stripMarkdownSyntax([structure.paragraphs[0] ?? '', slide.narration].join(' ')).toLowerCase();
  const hasBlockquote = /^>\s+/m.test(slide.markdown);
  const isWhySlide = /为什么|为何|why|适合交给/.test(heading);
  const isSceneSlide = /场景|应用|场合|用例|适合很多场景|use case|scenario/.test(heading)
    || (/团队|研究|课程|竞品|旅行|读书|规划/.test(narrative) && totalListItems >= 4);
  const isFrameworkSlide = /提醒|模式|框架|最后的提醒|工作框架/.test(heading)
    || (/不是一套固定产品方案|不是固定产品方案|工作框架|持续增值/.test(narrative) && totalListItems >= 3);
  const isSummarySlide = /一句话总结|总结|结论|closing|takeaway/.test(heading)
    || hasBlockquote
    || (slideIndex >= totalSlides - 1 && (/更像|核心洞见|运行中产物/.test(narrative) || structure.strongPhrases.length > 0));
  const isCompareSlide = /对比|比较|区别|不同|vs|versus|差异/.test(heading);
  const isDataSlide = /数据|数字|统计|百分|percent|data|stat|指标|研究/.test(heading);
  const isStepSlide = /步骤|流程|方法|做法|step|how to|怎么做/.test(heading);
  const isListSlide = /清单|规则|原则|事项|准则|注意|checklist|rule/.test(heading);
  const isQuoteSlide = /引用|原话|说过|曾说|quote|金句/.test(heading);
  const paragraphCount = structure.paragraphs.length;
  const narrationLen = slide.narration.length;

  if (structure.codeBlock) {
    return 'code';
  }

  if (slideIndex === 0) {
    return 'hero';
  }

  if (isSummarySlide) {
    return slideIndex % 2 === 0 ? 'quote' : 'centered';
  }

  if (isCompareSlide && totalListItems >= 2) {
    return totalListItems === 2 ? 'duo' : 'compare';
  }

  if (isDataSlide && totalListItems >= 2) {
    return totalListItems >= 4 ? 'stat-cards' : 'stat-cards';
  }

  if (isListSlide && totalListItems >= 3) {
    return 'checklist';
  }

  if (isQuoteSlide) {
    return 'split-quote';
  }

  if (isFrameworkSlide && totalListItems >= 3) {
    return slideIndex % 2 === 0 ? 'manifesto' : 'kanban';
  }

  if (isWhySlide && totalListItems >= 4) {
    return slideIndex % 2 === 0 ? 'argument' : 'radar';
  }

  if (isSceneSlide && structure.bulletItems.length >= 4) {
    return slideIndex % 2 === 0 ? 'mosaic' : 'waterfall';
  }

  if (isStepSlide && structure.orderedItems.length >= 3) {
    return slideIndex % 2 === 0 ? 'timeline' : 'filmstrip';
  }

  if (structure.orderedItems.length >= 3) {
    return slideIndex % 3 === 0 ? 'timeline' : slideIndex % 3 === 1 ? 'filmstrip' : 'stack';
  }

  if (totalListItems === 3) {
    return slideIndex % 3 === 0 ? 'triptych' : slideIndex % 3 === 1 ? 'kanban' : 'orbit';
  }

  if (slideIndex === totalSlides - 1) {
    if (totalListItems >= 3) {
      return 'triptych';
    }

    return structure.strongPhrases.length > 0 ? 'accent-bar' : 'minimal';
  }

  if (structure.bulletItems.length >= 5) {
    return slideIndex % 2 === 0 ? 'mosaic' : 'waterfall';
  }

  if (structure.orderedItems.length >= 3 || structure.bulletItems.length >= 4) {
    return slideIndex % 3 === 0 ? 'grid' : slideIndex % 3 === 1 ? 'magazine' : 'stat-cards';
  }

  if (structure.bulletItems.length === 2) {
    return slideIndex % 3 === 0 ? 'split-list' : slideIndex % 3 === 1 ? 'duo' : 'compare';
  }

  if (structure.bulletItems.length >= 2) {
    return slideIndex % 2 === 0 ? 'split-list' : 'sidebar-note';
  }

  if (structure.strongPhrases.length > 0) {
    return slideIndex % 3 === 0 ? 'spotlight' : slideIndex % 3 === 1 ? 'accent-bar' : 'centered';
  }

  if (narrationLen <= 60) {
    return slideIndex % 2 === 0 ? 'minimal' : 'headline';
  }

  if (paragraphCount >= 2 && totalListItems === 0) {
    return slideIndex % 3 === 0 ? 'spotlight' : slideIndex % 3 === 1 ? 'split-quote' : 'sidebar-note';
  }

  const fallbackVariants: SlideVariant[] = ['panel', 'centered', 'headline', 'minimal', 'accent-bar', 'sidebar-note'];
  return fallbackVariants[slideIndex % fallbackVariants.length];
};
