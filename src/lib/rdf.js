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

  let edgeCounter = 0;
  for (const quad of quads) {
    const sourceId = getTermId(quad.subject);
    const targetId = getTermId(quad.object);

    if (!nodeMap.has(sourceId)) {
      nodeMap.set(sourceId, makeNodeData(quad.subject, labelIndex));
    }
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

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.subject.termType !== 'Literal' &&
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
    for (const classIri of classes) {
      const classEntry = classMap.get(classIri);
      if (classEntry) {
        classEntry.count += 1;
      }
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

  const visibleNodes = new Set(focusedNodeIds);
  const visibleEdges = [];

  for (const edge of graphData.edges) {
    if (focusedNodeIds.has(edge.source) || focusedNodeIds.has(edge.target)) {
      visibleEdges.push(edge);
      visibleNodes.add(edge.source);
      visibleNodes.add(edge.target);
    }
  }

  const nodes = graphData.nodes.filter((node) => visibleNodes.has(node.id));
  return toElements(nodes, visibleEdges);
}
