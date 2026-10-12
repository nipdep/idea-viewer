// Sizing node boxes from their text.
//
// Box width used to be estimated as "characters x 5.75px", but the labels are 12px bold, which averages roughly
// 7px per character, so most boxes were narrower than their text (no side padding, text overflowing, and
// Cytoscape re-wrapping the text a second time and chunking words). Here the label is wrapped and measured with
// the same font that Cytoscape draws, and the box is the measured text plus padding.

export const NODE_FONT_FAMILY = 'Helvetica Neue, Helvetica, sans-serif';
export const NODE_FONT_SIZE = 12;
export const NODE_FONT_WEIGHT = 600;
export const NODE_PADDING_X = 10;
export const NODE_PADDING_Y = 6;
export const NODE_LINE_HEIGHT = 15;
export const MIN_NODE_WIDTH = 46;
export const MIN_NODE_HEIGHT = 26;
// Rough average advance of the label font, used to turn the old "characters per line" settings into pixels.
export const AVERAGE_CHAR_WIDTH = 7.7;

let context;
const widthCache = new Map();

function getContext() {
  if (context !== undefined) {
    return context;
  }
  context = null;
  try {
    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1)
        : typeof document !== 'undefined'
          ? document.createElement('canvas')
          : null;
    const ctx = canvas?.getContext('2d') ?? null;
    if (ctx) {
      ctx.font = `${NODE_FONT_WEIGHT} ${NODE_FONT_SIZE}px ${NODE_FONT_FAMILY}`;
      context = ctx;
    }
  } catch {
    context = null;
  }
  return context;
}

// Per-glyph advance (in em) of a bold sans-serif, for environments without a canvas (tests, SSR).
function estimateWidth(text) {
  let em = 0;
  for (const char of text) {
    if (char === ' ') {
      em += 0.28;
    } else if ('iljI.,;:\'|!'.includes(char)) {
      em += 0.3;
    } else if ('mwMW@%'.includes(char)) {
      em += 0.9;
    } else if (char >= 'A' && char <= 'Z') {
      em += 0.72;
    } else if (char.charCodeAt(0) > 0x2e80) {
      em += 1; // CJK and other full-width glyphs
    } else {
      em += 0.6;
    }
  }
  return em * NODE_FONT_SIZE;
}

export function measureTextWidth(text) {
  if (!text) {
    return 0;
  }
  const cached = widthCache.get(text);
  if (cached !== undefined) {
    return cached;
  }
  const ctx = getContext();
  const width = ctx ? ctx.measureText(text).width : estimateWidth(text);
  if (widthCache.size > 20000) {
    widthCache.clear();
  }
  widthCache.set(text, width);
  return width;
}

const isLower = (char) => char >= 'a' && char <= 'z';
const isUpper = (char) => char >= 'A' && char <= 'Z';
const isDigit = (char) => char >= '0' && char <= '9';
const SEPARATORS = '-_./:#';

/**
 * Natural places to break an over-long word: after separators and at camelCase boundaries
 * ("UnsatisfiedPolicyAssessment" -> "Unsatisfied", "Policy", "Assessment"; "HTMLParser" -> "HTML", "Parser").
 */
export function splitBreakable(word) {
  const segments = [];
  let current = '';
  for (let index = 0; index < word.length; index += 1) {
    const char = word[index];
    const previous = word[index - 1];
    const next = word[index + 1];
    const startsWord =
      previous !== undefined &&
      isUpper(char) &&
      (isLower(previous) || isDigit(previous) || (isUpper(previous) && next !== undefined && isLower(next)));
    if (current && startsWord) {
      segments.push(current);
      current = '';
    }
    current += char;
    if (SEPARATORS.includes(char) && next !== undefined) {
      segments.push(current);
      current = '';
    }
  }
  if (current) {
    segments.push(current);
  }
  return segments;
}

// Last resort for a single run with no natural break point that is still wider than the line.
function splitByWidth(text, maxWidth) {
  const pieces = [];
  let current = '';
  for (const char of text) {
    if (current && measureTextWidth(current + char) > maxWidth) {
      pieces.push(current);
      current = '';
    }
    current += char;
  }
  if (current) {
    pieces.push(current);
  }
  return pieces;
}

/** Greedy word wrap by measured width. Words that do not fit are broken at natural points, never mid-word if avoidable. */
export function wrapToWidth(text, maxWidth, maxLines = Infinity) {
  const lines = [];
  let current = '';

  const flush = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };
  const addPiece = (piece) => {
    if (current && measureTextWidth(current + piece) > maxWidth) {
      flush();
    }
    if (measureTextWidth(piece) > maxWidth) {
      splitByWidth(piece, maxWidth).forEach((part) => {
        if (current && measureTextWidth(current + part) > maxWidth) {
          flush();
        }
        current += part;
      });
      return;
    }
    current += piece;
  };

  for (const word of text.split(' ').filter(Boolean)) {
    if (lines.length >= maxLines) {
      break;
    }
    if (current && measureTextWidth(`${current} ${word}`) <= maxWidth) {
      current += ` ${word}`;
      continue;
    }
    flush();
    if (measureTextWidth(word) <= maxWidth) {
      current = word;
    } else {
      splitBreakable(word).forEach(addPiece);
    }
  }
  flush();
  return lines.slice(0, maxLines);
}

/** Box size for already wrapped lines: measured text plus padding, with a floor so tiny labels stay clickable. */
export function computeTextBox(lines) {
  const texts = lines.length > 0 ? lines : [''];
  const textWidth = Math.max(...texts.map((line) => measureTextWidth(line)));
  const nodeWidth = Math.max(MIN_NODE_WIDTH, Math.ceil(textWidth) + 2 * NODE_PADDING_X);
  const nodeHeight = Math.max(MIN_NODE_HEIGHT, texts.length * NODE_LINE_HEIGHT + 2 * NODE_PADDING_Y);
  return {
    nodeWidth,
    nodeHeight,
    // Generous on purpose: Cytoscape wraps again at this width, and the lines are already wrapped.
    textMaxWidth: nodeWidth,
    lineCount: texts.length,
    textWidth,
  };
}

/** Nodes whose box is derived from their text: not connectors (fixed circles), edge anchors or cluster boxes. */
export function isTextBoxData(data) {
  return Boolean(data) && data.kind !== 'blank' && data.edgeAnchor !== 1 && data.clusterNode !== 1 && Boolean(data.label);
}

/**
 * The font-size setting changes the text but not the box, so boxes are scaled by the same factor (text width is
 * linear in font size, and the lines are already wrapped). The 12px sizes are kept in base* so rescaling never compounds.
 */
export function scaledBoxPatch(data, scale) {
  const baseNodeWidth = data.baseNodeWidth ?? data.nodeWidth;
  const baseNodeHeight = data.baseNodeHeight ?? data.nodeHeight;
  const baseTextMaxWidth = data.baseTextMaxWidth ?? data.textMaxWidth;
  return {
    baseNodeWidth,
    baseNodeHeight,
    baseTextMaxWidth,
    nodeWidth: Math.round(baseNodeWidth * scale),
    nodeHeight: Math.round(baseNodeHeight * scale),
    textMaxWidth: Math.round(baseTextMaxWidth * scale),
  };
}
