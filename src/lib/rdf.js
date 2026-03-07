import { DataFactory, Parser, Store } from 'n3';

export const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
export const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const RDF_DESCRIPTION = `${RDF_NS}Description`;
const RDF_FIRST = `${RDF_NS}first`;
const RDF_REST = `${RDF_NS}rest`;
const RDF_NIL = `${RDF_NS}nil`;
const RDFS_CLASS = `${RDFS_NS}Class`;
const OWL_CLASS = `${OWL_NS}Class`;
const OWL_OBJECT_PROPERTY = `${OWL_NS}ObjectProperty`;
const OWL_ANNOTATION_PROPERTY = `${OWL_NS}AnnotationProperty`;

const CLASS_TYPE_IRIS = new Set([RDFS_CLASS, OWL_CLASS]);
const BUILTIN_ANNOTATION_PREDICATES = new Set([
  `${RDFS_NS}label`,
  `${RDFS_NS}comment`,
  `${RDFS_NS}seeAlso`,
  `${RDFS_NS}isDefinedBy`,
  `${OWL_NS}versionInfo`,
  `${OWL_NS}priorVersion`,
  `${OWL_NS}backwardCompatibleWith`,
  `${OWL_NS}incompatibleWith`,
  `${OWL_NS}deprecated`,
]);

export const DEFAULT_VIEW_OPTIONS = Object.freeze({
  showDataProperties: false,
  showAnnotationProperties: false,
  showObjectProperties: false,
});

const { namedNode, literal, quad, blankNode } = DataFactory;

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

function getBaseIri(iri) {
  if (!iri) {
    return '';
  }

  const hashIndex = iri.lastIndexOf('#');
  if (hashIndex >= 0) {
    return iri.slice(0, hashIndex + 1);
  }

  const slashIndex = iri.lastIndexOf('/');
  if (slashIndex >= 0) {
    return iri.slice(0, slashIndex + 1);
  }

  const colonIndex = iri.lastIndexOf(':');
  if (colonIndex >= 0) {
    return iri.slice(0, colonIndex + 1);
  }

  return iri;
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
  const sample = text.slice(0, 4000);

  if (
    /<\?xml[\s>]/i.test(sample) ||
    /<rdf:RDF[\s>]/i.test(sample) ||
    /xmlns:rdf\s*=\s*["']http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#["']/i.test(sample)
  ) {
    return 'RDFXML';
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.rdf') && /^\s*</.test(sample)) {
    return 'RDFXML';
  }

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

function isElementNode(node) {
  return node?.nodeType === 1;
}

function splitAttributes(attributes) {
  const propertyAttrs = [];

  for (const attr of Array.from(attributes)) {
    const isXmlns = attr.name === 'xmlns' || attr.prefix === 'xmlns';
    if (isXmlns) {
      continue;
    }

    if (attr.namespaceURI === RDF_NS) {
      continue;
    }

    if (attr.namespaceURI === XML_NS) {
      continue;
    }

    propertyAttrs.push(attr);
  }

  return { propertyAttrs };
}

function resolveIri(value, baseIri) {
  if (!value) {
    return '';
  }

  try {
    return new URL(value, baseIri).toString();
  } catch {
    return value;
  }
}

function literalFromText(text, datatypeIri, lang) {
  if (datatypeIri) {
    return literal(text, namedNode(datatypeIri));
  }

  if (lang) {
    return literal(text, lang);
  }

  return literal(text);
}

function parseRdfXml(text, fileName) {
  if (typeof DOMParser === 'undefined') {
    throw new Error(`File ${fileName} is RDF/XML but no XML parser is available in this runtime.`);
  }

  const document = new DOMParser().parseFromString(text, 'application/xml');
  const parserErrors = document.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    const message = parserErrors[0].textContent?.trim() || 'Invalid XML content.';
    throw new Error(`Failed to parse RDF/XML in ${fileName}: ${message}`);
  }

  const fallbackBase = `https://idea-viewer.local/${encodeURIComponent(fileName)}`;
  const root = document.documentElement;
  const docBase = resolveIri(root.getAttributeNS(XML_NS, 'base') || fallbackBase, fallbackBase);
  const docLang = root.getAttributeNS(XML_NS, 'lang') || '';
  const quads = [];
  const nodeIdMap = new Map();

  function getNodeIdBlank(nodeId) {
    const existing = nodeIdMap.get(nodeId);
    if (existing) {
      return existing;
    }

    const next = blankNode();
    nodeIdMap.set(nodeId, next);
    return next;
  }

  function collectElementChildren(node) {
    return Array.from(node.childNodes).filter(isElementNode);
  }

  function collectText(node) {
    let output = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3 || child.nodeType === 4) {
        output += child.textContent || '';
      }
    }
    return output.trim();
  }

  function serializeChildrenXml(node) {
    const serializer = new XMLSerializer();
    let output = '';
    for (const child of node.childNodes) {
      output += serializer.serializeToString(child);
    }
    return output;
  }

  function getElementIri(element) {
    if (!element.namespaceURI || !element.localName) {
      throw new Error(`Unsupported RDF/XML element in ${fileName}: missing namespace/local name.`);
    }
    return `${element.namespaceURI}${element.localName}`;
  }

  function subjectFromNodeElement(nodeElement, baseIri) {
    const about = nodeElement.getAttributeNS(RDF_NS, 'about');
    if (about) {
      return namedNode(resolveIri(about, baseIri));
    }

    const id = nodeElement.getAttributeNS(RDF_NS, 'ID');
    if (id) {
      return namedNode(resolveIri(`#${id}`, baseIri));
    }

    const nodeId = nodeElement.getAttributeNS(RDF_NS, 'nodeID');
    if (nodeId) {
      return getNodeIdBlank(nodeId);
    }

    return blankNode();
  }

  function parseNodeElement(nodeElement, baseIri, lang) {
    const elementBase = resolveIri(nodeElement.getAttributeNS(XML_NS, 'base') || baseIri, baseIri);
    const elementLang = nodeElement.getAttributeNS(XML_NS, 'lang') || lang;
    const subject = subjectFromNodeElement(nodeElement, elementBase);
    const nodeTypeIri = getElementIri(nodeElement);

    if (nodeTypeIri !== RDF_DESCRIPTION) {
      quads.push(quad(subject, namedNode(RDF_TYPE), namedNode(nodeTypeIri)));
    }

    const { propertyAttrs } = splitAttributes(nodeElement.attributes);
    for (const attr of propertyAttrs) {
      if (!attr.namespaceURI || !attr.localName) {
        continue;
      }

      quads.push(
        quad(
          subject,
          namedNode(`${attr.namespaceURI}${attr.localName}`),
          literalFromText(attr.value, '', elementLang),
        ),
      );
    }

    for (const propertyElement of collectElementChildren(nodeElement)) {
      parsePropertyElement(subject, propertyElement, elementBase, elementLang);
    }

    return subject;
  }

  function parseCollection(subject, predicate, propertyElement, baseIri, lang) {
    const itemElements = collectElementChildren(propertyElement);
    if (itemElements.length === 0) {
      quads.push(quad(subject, predicate, namedNode(RDF_NIL)));
      return;
    }

    const listNodes = itemElements.map(() => blankNode());
    quads.push(quad(subject, predicate, listNodes[0]));

    for (let index = 0; index < itemElements.length; index += 1) {
      const itemTerm = parseNodeElement(itemElements[index], baseIri, lang);
      quads.push(quad(listNodes[index], namedNode(RDF_FIRST), itemTerm));
      quads.push(
        quad(
          listNodes[index],
          namedNode(RDF_REST),
          index + 1 < listNodes.length ? listNodes[index + 1] : namedNode(RDF_NIL),
        ),
      );
    }
  }

  function parsePropertyElement(subject, propertyElement, baseIri, lang) {
    const propertyBase = resolveIri(propertyElement.getAttributeNS(XML_NS, 'base') || baseIri, baseIri);
    const propertyLang = propertyElement.getAttributeNS(XML_NS, 'lang') || lang;
    const predicate = namedNode(getElementIri(propertyElement));
    const resource = propertyElement.getAttributeNS(RDF_NS, 'resource');
    const nodeId = propertyElement.getAttributeNS(RDF_NS, 'nodeID');
    const parseType = propertyElement.getAttributeNS(RDF_NS, 'parseType');
    const datatype = propertyElement.getAttributeNS(RDF_NS, 'datatype');

    if (resource) {
      quads.push(quad(subject, predicate, namedNode(resolveIri(resource, propertyBase))));
      return;
    }

    if (nodeId) {
      quads.push(quad(subject, predicate, getNodeIdBlank(nodeId)));
      return;
    }

    if (parseType === 'Collection') {
      parseCollection(subject, predicate, propertyElement, propertyBase, propertyLang);
      return;
    }

    if (parseType === 'Resource') {
      const object = blankNode();
      quads.push(quad(subject, predicate, object));
      for (const childProperty of collectElementChildren(propertyElement)) {
        parsePropertyElement(object, childProperty, propertyBase, propertyLang);
      }
      return;
    }

    if (parseType === 'Literal') {
      const literalValue = serializeChildrenXml(propertyElement);
      quads.push(quad(subject, predicate, literalFromText(literalValue, datatype, propertyLang)));
      return;
    }

    const childElements = collectElementChildren(propertyElement);
    const textValue = collectText(propertyElement);

    if (childElements.length > 0) {
      const object = parseNodeElement(childElements[0], propertyBase, propertyLang);
      quads.push(quad(subject, predicate, object));
      return;
    }

    quads.push(quad(subject, predicate, literalFromText(textValue, datatype, propertyLang)));
  }

  const rootIri = root.namespaceURI && root.localName ? `${root.namespaceURI}${root.localName}` : '';
  if (rootIri === `${RDF_NS}RDF`) {
    for (const child of collectElementChildren(root)) {
      parseNodeElement(child, docBase, docLang);
    }
  } else {
    parseNodeElement(root, docBase, docLang);
  }

  return quads;
}

export function parseRdfText(text, fileName) {
  const format = detectFormat(fileName, text);
  if (format === 'RDFXML') {
    return parseRdfXml(text, fileName);
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
    baseIri: termType === 'NamedNode' ? getBaseIri(term.value) : '',
    termType,
    kind: termType === 'Literal' ? 'literal' : termType === 'BlankNode' ? 'blank' : 'entity',
    fullLabel,
    displayLabel: makeDisplayLabel(fullLabel),
    labelLength: Math.min(Math.max(fullLabel.length, 4), 120),
    classes: [],
  };
}

function detectPredicateCategory(predicateIri, objectTermType, objectPropertyIris, annotationPropertyIris) {
  if (predicateIri === RDFS_SUBCLASS_OF) {
    return 'subclass';
  }

  if (predicateIri === RDF_TYPE) {
    return 'type';
  }

  if (annotationPropertyIris.has(predicateIri)) {
    return 'annotation';
  }

  if (objectTermType === 'Literal') {
    return 'data';
  }

  if (objectTermType === 'NamedNode' || objectTermType === 'BlankNode') {
    if (objectPropertyIris.has(predicateIri)) {
      return 'object';
    }
    return 'object';
  }

  return 'other';
}

export function buildGraphData(quads) {
  const store = new Store(quads);
  const labelIndex = buildLabelIndex(quads);

  const nodeMap = new Map();
  const edgeMap = new Map();
  const objectEdges = [];
  const literalEdges = [];
  const classMap = new Map();
  const classAssignments = new Map();
  const dataProperties = new Map();
  const baseIriCounts = new Map();
  const classNodeIds = new Set();
  const objectPropertyIris = new Set();
  const annotationPropertyIris = new Set(BUILTIN_ANNOTATION_PREDICATES);

  for (const quad of quads) {
    if (quad.predicate.value === RDF_TYPE && quad.subject.termType === 'NamedNode' && quad.object.termType === 'NamedNode') {
      if (quad.object.value === OWL_OBJECT_PROPERTY) {
        objectPropertyIris.add(quad.subject.value);
      } else if (quad.object.value === OWL_ANNOTATION_PROPERTY) {
        annotationPropertyIris.add(quad.subject.value);
      } else if (CLASS_TYPE_IRIS.has(quad.object.value)) {
        classNodeIds.add(getTermId(quad.subject));
      }

      if (CLASS_TYPE_IRIS.has(quad.object.value)) {
        classNodeIds.add(getTermId(quad.object));
      }
    }

    if (quad.predicate.value === RDFS_SUBCLASS_OF && isEntityTerm(quad.subject) && isEntityTerm(quad.object)) {
      classNodeIds.add(getTermId(quad.subject));
      classNodeIds.add(getTermId(quad.object));
    }
  }

  let objectEdgeCounter = 0;
  let literalEdgeCounter = 0;
  for (const quad of quads) {
    if (!isEntityTerm(quad.subject)) {
      continue;
    }

    const sourceId = getTermId(quad.subject);
    if (!nodeMap.has(sourceId)) {
      nodeMap.set(sourceId, makeNodeData(quad.subject, labelIndex));
    }

    const category = detectPredicateCategory(
      quad.predicate.value,
      quad.object.termType,
      objectPropertyIris,
      annotationPropertyIris,
    );

    if (isEntityTerm(quad.object)) {
      const targetId = getTermId(quad.object);
      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, makeNodeData(quad.object, labelIndex));
      }

      if (quad.predicate.value === RDFS_SUBCLASS_OF) {
        classNodeIds.add(sourceId);
        classNodeIds.add(targetId);
      }

      const predicateLabel = compactIri(quad.predicate.value);
      const edgeId = `e${objectEdgeCounter}`;
      const edge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        predicate: quad.predicate.value,
        predicateLabel,
        category,
      };
      objectEdges.push(edge);
      edgeMap.set(edgeId, edge);
      objectEdgeCounter += 1;
    } else if (quad.object.termType === 'Literal') {
      const literalId = getTermId(quad.object);
      if (!nodeMap.has(literalId)) {
        nodeMap.set(literalId, makeNodeData(quad.object, labelIndex));
      }

      const literalCategory = category === 'annotation' ? 'annotation' : 'data';
      const edgeId = `l${literalEdgeCounter}`;
      const literalEdge = {
        id: edgeId,
        source: sourceId,
        target: literalId,
        predicate: quad.predicate.value,
        predicateLabel: compactIri(quad.predicate.value),
        category: literalCategory,
      };
      literalEdges.push(literalEdge);
      edgeMap.set(edgeId, literalEdge);
      literalEdgeCounter += 1;

      const rows = dataProperties.get(sourceId) ?? [];
      rows.push({
        predicate: quad.predicate.value,
        predicateLabel: compactIri(quad.predicate.value),
        value: quad.object.value,
        language: quad.object.language || '',
        datatype: quad.object.datatype?.value || '',
        category: literalCategory,
      });
      dataProperties.set(sourceId, rows);
    }

    if (quad.predicate.value === RDF_TYPE && quad.object.termType === 'NamedNode') {
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

      if (CLASS_TYPE_IRIS.has(quad.object.value)) {
        classNodeIds.add(sourceId);
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

  for (const classIri of classMap.keys()) {
    classNodeIds.add(classIri);
  }

  for (const node of nodeMap.values()) {
    if (node.baseIri) {
      baseIriCounts.set(node.baseIri, (baseIriCounts.get(node.baseIri) ?? 0) + 1);
    }

    if (typeof node.hasClass !== 'number') {
      node.hasClass = 0;
      node.classBadge = '';
      node.badgeSvg = '';
      node.badgeWidth = 0;
      node.primaryClassLabel = '';
    }
  }

  const nodes = Array.from(nodeMap.values());
  const edges = [...objectEdges, ...literalEdges];
  const classes = Array.from(classMap.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const baseIris = Array.from(baseIriCounts.entries())
    .map(([id, count]) => ({ id, label: id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  const graphData = {
    store,
    nodes,
    edges,
    objectEdges,
    literalEdges,
    classes,
    baseIris,
    classNodeIds,
    dataProperties,
    nodeMap,
    edgeMap,
    elements: [],
  };

  graphData.elements = buildFocusedSubset(graphData, null, DEFAULT_VIEW_OPTIONS);
  return graphData;
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
        category: edge.category ?? 'object',
      },
    })),
  ];
}

function normalizeViewOptions(viewOptions) {
  return {
    showDataProperties: Boolean(viewOptions?.showDataProperties),
    showAnnotationProperties: Boolean(viewOptions?.showAnnotationProperties),
    showObjectProperties: Boolean(viewOptions?.showObjectProperties),
  };
}

function shouldIncludeObjectEdge(edge, options) {
  if (edge.category === 'subclass') {
    return true;
  }

  if (edge.category === 'annotation') {
    return options.showAnnotationProperties;
  }

  if (edge.category === 'object') {
    return options.showObjectProperties;
  }

  return false;
}

function shouldIncludeLiteralEdge(edge, options) {
  if (edge.category === 'annotation') {
    return options.showAnnotationProperties;
  }

  if (edge.category === 'data') {
    return options.showDataProperties;
  }

  return false;
}

export function buildFocusedSubset(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  if (!graphData) {
    return [];
  }

  if (focusedNodeIds && focusedNodeIds.size === 0) {
    return [];
  }

  const options = normalizeViewOptions(viewOptions);
  const classStructureOnly =
    !options.showDataProperties && !options.showAnnotationProperties && !options.showObjectProperties;
  const visibleNodeIds = new Set();
  const visibleEdges = [];

  for (const edge of graphData.objectEdges) {
    if (!shouldIncludeObjectEdge(edge, options)) {
      continue;
    }

    if (
      edge.category === 'subclass' &&
      (!graphData.classNodeIds.has(edge.source) || !graphData.classNodeIds.has(edge.target))
    ) {
      continue;
    }

    if (focusedNodeIds && (!focusedNodeIds.has(edge.source) || !focusedNodeIds.has(edge.target))) {
      continue;
    }

    visibleEdges.push(edge);
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }

  for (const edge of graphData.literalEdges) {
    if (!shouldIncludeLiteralEdge(edge, options)) {
      continue;
    }

    if (focusedNodeIds && !focusedNodeIds.has(edge.source)) {
      continue;
    }

    visibleEdges.push(edge);
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }

  if (classStructureOnly) {
    for (const classNodeId of graphData.classNodeIds) {
      if (!focusedNodeIds || focusedNodeIds.has(classNodeId)) {
        visibleNodeIds.add(classNodeId);
      }
    }
  }

  const nodes = graphData.nodes.filter((node) => visibleNodeIds.has(node.id));
  return toElements(nodes, visibleEdges);
}
