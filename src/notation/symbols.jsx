// Notation symbols drawn as SVG with the same colours and shapes the graph uses.
// The legend and the documentation page both draw from here so they cannot drift apart.
import React from 'react';

export const NOTATION_COLORS = {
  fill: '#f6f0e8',
  stroke: '#7e6f60',
  ontologyStroke: '#8f6f52',
  literalFill: '#f0e4d7',
  literalStroke: '#9b7458',
  datatypeFill: '#eee5da',
  datatypeStroke: '#8e7560',
  connectorFill: '#fcfaf6',
  connectorStroke: '#9aa0a4',
  enumStroke: '#8d6b4c',
  base: '#bdb5aa',
  property: '#9f7a57',
  ink: '#1e1b16',
};

const NODE_W = 44;
const NODE_H = 26;

function NodeShape({ kind, label }) {
  const c = NOTATION_COLORS;
  switch (kind) {
    case 'class':
      return <rect x="3" y="4" width="38" height="18" fill={c.fill} stroke={c.stroke} strokeWidth="1.2" />;
    case 'individual':
      return <rect x="3" y="4" width="38" height="18" rx="6" fill={c.fill} stroke={c.ontologyStroke} strokeWidth="1.6" />;
    case 'thing':
      return <ellipse cx="22" cy="13" rx="19" ry="9" fill={c.fill} stroke={c.stroke} strokeWidth="1.2" />;
    case 'literal':
      return <rect x="3" y="4" width="38" height="18" fill={c.literalFill} stroke={c.literalStroke} strokeWidth="1.2" />;
    case 'datatype':
      return <polygon points="22,2 41,23 3,23" fill={c.datatypeFill} stroke={c.datatypeStroke} strokeWidth="1.2" />;
    case 'enumeration':
      return (
        <rect x="3" y="3" width="38" height="20" fill="#fffdf9" fillOpacity="0.6" stroke={c.enumStroke} strokeWidth="1.6" strokeDasharray="4 3" />
      );
    case 'connector':
      return (
        <>
          <circle cx="22" cy="13" r="10" fill={c.connectorFill} stroke={c.connectorStroke} strokeWidth="1.3" />
          <text x="22" y="17.4" textAnchor="middle" fontSize="13" fontWeight="700" fill="#334047">
            {label}
          </text>
        </>
      );
    case 'blank':
      return <circle cx="22" cy="13" r="7" fill={c.connectorFill} stroke={c.connectorStroke} strokeWidth="1.3" />;
    case 'group':
      return (
        <rect x="3" y="3" width="38" height="20" rx="4" fill="none" stroke="#a9adb1" strokeWidth="1.6" strokeDasharray="4 3" />
      );
    default:
      return null;
  }
}

export function NodeSymbol({ kind, label = '', title }) {
  return (
    <svg className="notation-node-symbol" viewBox={`0 0 ${NODE_W} ${NODE_H}`} width={NODE_W} height={NODE_H} role="img" aria-label={title ?? kind}>
      <NodeShape kind={kind} label={label} />
    </svg>
  );
}

const EDGE_W = 56;
const EDGE_H = 22;

// line: solid | dashed | dotted; arrow: filled | hollow | membership | none; tone: base | property
export function EdgeSymbol({ line = 'solid', arrow = 'filled', tone = 'base', mark = '', title }) {
  const color = tone === 'property' ? NOTATION_COLORS.property : NOTATION_COLORS.base;
  const dash = line === 'dashed' ? '5 3' : line === 'dotted' ? '1.5 3' : undefined;
  const x2 = arrow === 'none' ? 52 : 44;
  let head = null;
  if (arrow === 'filled' || arrow === 'membership') {
    head = <polygon points="53,11 44,6.5 44,15.5" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />;
  } else if (arrow === 'hollow') {
    head = <polygon points="53,11 44,6.5 44,15.5" fill="#fffaf2" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />;
  }
  return (
    <svg className="notation-edge-symbol" viewBox={`0 0 ${EDGE_W} ${EDGE_H}`} width={EDGE_W} height={EDGE_H} role="img" aria-label={title ?? `${line} ${arrow} edge`}>
      <line x1="3" y1="11" x2={x2} y2="11" stroke={color} strokeWidth="1.9" strokeDasharray={dash} strokeLinecap="round" />
      {head}
      {mark ? (
        <text x="24" y="8" textAnchor="middle" fontSize="10" fontWeight="700" fill={color === NOTATION_COLORS.base ? '#7a736b' : '#684c32'}>
          {mark}
        </text>
      ) : null}
    </svg>
  );
}

export function MarkSymbol({ text }) {
  return <span className="notation-mark">{text}</span>;
}
