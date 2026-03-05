import { Parser, Store } from 'n3';

export const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const LABEL_PREDICATES = new Set([
  'http://www.w3.org/2000/01/rdf-schema#label',
  'http://www.w3.org/2004/02/skos/core#prefLabel',
  'http://schema.org/name',
  'http://xmlns.com/foaf/0.1/name',
]);

function hashText(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

function isEntityTerm(term) {
  return term && (term.termType === 'NamedNode' || term.termType === 'BlankNode');
}

export function getTermId(term) {
  if (!term) {
    return '';
  }

  if (term.termType === 'NamedNode') {
    return term.value;
  }

  if (term.termType === 'BlankNode') {
    return `_:${term.value}`;
  }

  if (term.termType === 'Literal') {
    return `lit:${hashText(`${term.value}|${term.datatype?.value ?? ''}|${term.language ?? ''}`)}`;
  }

  return `term:${hashText(term.value ?? '')}`;
}

export function compactIri(iri) {
  if (!iri) {
    return '';
  }

  const hashIndex = iri.lastIndexOf('#');
  if (hashIndex >= 0 && hashIndex < iri.length - 1) {
    return decodeURIComponent(iri.slice(hashIndex + 1));
  }

  const slashIndex = iri.lastIndexOf('/');
  if (slashIndex >= 0 && slashIndex < iri.length - 1) {
    return decodeURIComponent(iri.slice(slashIndex + 1));
  }

  return iri;
}

export function makeDisplayLabel(label, maxLineLength = 24, maxLines = 3) {
  if (!label) {
    return '';
  }

  const sanitized = label.replace(/\s+/g, ' ').trim();
  if (!sanitized) {
    return '';
  }

  const words = sanitized.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxLineLength));
      current = word.slice(maxLineLength);
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const needsEllipsis =
    lines.length === maxLines &&
    (words.join(' ').length > lines.join(' ').length || lines[maxLines - 1].length > maxLineLength);

  if (needsEllipsis) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(maxLineLength - 1, 1)).trimEnd()}…`;
  }

  return lines.join('\n');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toClassBadge(label) {
  if (!label) {
    return '';
  }

  const compact = label
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!compact) {
    return '';
  }

  if (compact.length <= 14) {
    return compact;
  }

  const words = compact.split(' ');
  if (words.length > 1) {
    const candidate = `${words[0]} ${words[1]}`;
    if (candidate.length <= 14) {
      return candidate;
    }
  }

  return `${compact.slice(0, 13)}…`;
}

function makeBadgeDataUri(text) {
  if (!text) {
    return { uri: '', width: 0 };
  }

  const width = Math.max(50, Math.min(140, Math.ceil(text.length * 7.2 + 18)));
  const escaped = escapeXml(text);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='24' viewBox='0 0 ${width} 24'><rect x='1' y='1' rx='10' ry='10' width='${width - 2}' height='22' fill='#c95f3a' stroke='#b05332' stroke-width='1'/><text x='${Math.floor(width / 2)}' y='16' text-anchor='middle' font-family='Avenir Next,Segoe UI,Arial,sans-serif' font-size='11' font-weight='700' fill='#fff8f2'>${escaped}</text></svg>`;
  return {
    uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    width,
  };
}

function detectFormat(fileName, text) {
  if (/<rdf:RDF[\s>]/i.test(text.slice(0, 4000))) {
    return 'RDFXML';
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.nt')) {
    return 'N-Triples';
  }

  if (lower.endsWith('.nq')) {
    return 'N-Quads';
  }

  if (lower.endsWith('.trig')) {
    return 'TriG';
  }

  if (lower.endsWith('.ttl') || lower.endsWith('.owl') || lower.endsWith('.rdf') || lower.endsWith('.n3')) {
    return 'Turtle';
  }

  return 'Turtle';
}

export function parseRdfText(text, fileName) {
  const format = detectFormat(fileName, text);
  if (format === 'RDFXML') {
    throw new Error(
      `File ${fileName} looks like RDF/XML. This build currently parses Turtle-family syntaxes with N3.`,
    );
  }

  const parser = new Parser({ format });
  return parser.parse(text);
}

function buildLabelIndex(quads) {
  const labels = new Map();

  for (const quad of quads) {
    if (!LABEL_PREDICATES.has(quad.predicate.value)) {
      continue;
    }

    if (quad.subject.termType !== 'NamedNode' && quad.subject.termType !== 'BlankNode') {
      continue;
    }

    if (quad.object.termType !== 'Literal') {
      continue;
    }

    const key = getTermId(quad.subject);
    if (!labels.has(key)) {
      labels.set(key, quad.object.value);
    }
  }

  return labels;
}

function makeNodeData(term, labelIndex) {
  const id = getTermId(term);
  const termType = term.termType;

  let fullLabel = '';
  if (termType === 'Literal') {
    fullLabel = term.value;
  } else if (labelIndex.has(id)) {
    fullLabel = labelIndex.get(id);
  } else if (termType === 'NamedNode') {
    fullLabel = compactIri(term.value);
  } else {
    fullLabel = `[Blank ${term.value}]`;
  }

  return {
    id,
    iri: term.value,
    termType,
    kind: termType === 'Literal' ? 'literal' : termType === 'BlankNode' ? 'blank' : 'entity',
    fullLabel,
    displayLabel: makeDisplayLabel(fullLabel),
    labelLength: Math.min(Math.max(fullLabel.length, 4), 120),
    classes: [],
  };
}

export function buildGraphData(quads) {
  const store = new Store(quads);
  const labelIndex = buildLabelIndex(quads);

  const nodeMap = new Map();
  const edgeMap = new Map();
  const classMap = new Map();
  const classAssignments = new Map();
  const dataProperties = new Map();

  let edgeCounter = 0;
  for (const quad of quads) {
    if (!isEntityTerm(quad.subject)) {
      continue;
    }

    const sourceId = getTermId(quad.subject);
    if (!nodeMap.has(sourceId)) {
      nodeMap.set(sourceId, makeNodeData(quad.subject, labelIndex));
    }

    if (isEntityTerm(quad.object)) {
      const targetId = getTermId(quad.object);
      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, makeNodeData(quad.object, labelIndex));
      }

      const predicateLabel = compactIri(quad.predicate.value);
      const edgeId = `e${edgeCounter}`;

      edgeMap.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        predicate: quad.predicate.value,
        predicateLabel,
      });
      edgeCounter += 1;
    } else if (quad.object.termType === 'Literal') {
      const rows = dataProperties.get(sourceId) ?? [];
      rows.push({
        predicate: quad.predicate.value,
        predicateLabel: compactIri(quad.predicate.value),
        value: quad.object.value,
        language: quad.object.language || '',
        datatype: quad.object.datatype?.value || '',
      });
      dataProperties.set(sourceId, rows);
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode'
    ) {
      const subjectClasses = classAssignments.get(sourceId) ?? new Set();
      subjectClasses.add(quad.object.value);
      classAssignments.set(sourceId, subjectClasses);

      if (!classMap.has(quad.object.value)) {
        classMap.set(quad.object.value, {
          id: quad.object.value,
          label: labelIndex.get(quad.object.value) ?? compactIri(quad.object.value),
          count: 0,
        });
      }
    }
  }

  for (const [nodeId, classes] of classAssignments.entries()) {
    const node = nodeMap.get(nodeId);
    if (!node) {
      continue;
    }

    node.classes = Array.from(classes);
    const primaryClass = node.classes[0] ?? '';
    const primaryClassLabel = primaryClass
      ? labelIndex.get(primaryClass) ?? compactIri(primaryClass)
      : '';
    node.primaryClassLabel = primaryClassLabel;
    node.classBadge = toClassBadge(primaryClassLabel);
    const badge = makeBadgeDataUri(node.classBadge);
    node.badgeSvg = badge.uri;
    node.badgeWidth = badge.width;
    node.hasClass = node.classes.length;

    for (const classIri of classes) {
      const classEntry = classMap.get(classIri);
      if (classEntry) {
        classEntry.count += 1;
      }
    }
  }

  for (const node of nodeMap.values()) {
    if (typeof node.hasClass !== 'number') {
      node.hasClass = 0;
      node.classBadge = '';
      node.badgeSvg = '';
      node.badgeWidth = 0;
      node.primaryClassLabel = '';
    }
  }

  const nodes = Array.from(nodeMap.values());
  const edges = Array.from(edgeMap.values());
  const classes = Array.from(classMap.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    store,
    nodes,
    edges,
    classes,
    dataProperties,
    nodeMap,
    edgeMap,
    elements: toElements(nodes, edges),
  };
}

export function toElements(nodes, edges) {
  return [
    ...nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.displayLabel,
        fullLabel: node.fullLabel,
        iri: node.iri,
        kind: node.kind,
        termType: node.termType,
        labelLength: node.labelLength,
        hasClass: node.hasClass,
        classBadge: node.classBadge,
        badgeSvg: node.badgeSvg,
        badgeWidth: node.badgeWidth,
      },
    })),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        predicate: edge.predicate,
        predicateLabel: edge.predicateLabel,
      },
    })),
  ];
}

export function buildFocusedSubset(graphData, focusedNodeIds) {
  if (!focusedNodeIds) {
    return graphData.elements;
  }
  if (focusedNodeIds.size === 0) {
    return [];
  }

  const visibleEdges = [];

  for (const edge of graphData.edges) {
    if (focusedNodeIds.has(edge.source) && focusedNodeIds.has(edge.target)) {
      visibleEdges.push(edge);
    }
  }

  const nodes = graphData.nodes.filter((node) => focusedNodeIds.has(node.id));
  return toElements(nodes, visibleEdges);
}
