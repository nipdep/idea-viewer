import { DataFactory, Parser, Store } from 'n3';

export const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
export const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
export const RDFS_SUBPROPERTY_OF = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const RDF_DESCRIPTION = `${RDF_NS}Description`;
const RDF_FIRST = `${RDF_NS}first`;
const RDF_REST = `${RDF_NS}rest`;
const RDF_NIL = `${RDF_NS}nil`;
const RDFS_CLASS = `${RDFS_NS}Class`;
const RDFS_DOMAIN = `${RDFS_NS}domain`;
const RDFS_RANGE = `${RDFS_NS}range`;
const OWL_CLASS = `${OWL_NS}Class`;
const OWL_OBJECT_PROPERTY = `${OWL_NS}ObjectProperty`;
const OWL_DATATYPE_PROPERTY = `${OWL_NS}DatatypeProperty`;
const OWL_ANNOTATION_PROPERTY = `${OWL_NS}AnnotationProperty`;
const OWL_NAMED_INDIVIDUAL = `${OWL_NS}NamedIndividual`;
const OWL_ONTOLOGY = `${OWL_NS}Ontology`;

const CLASS_TYPE_IRIS = new Set([RDFS_CLASS, OWL_CLASS]);
const HIDDEN_BACKGROUND_CLASS_IRIS = new Set([
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
  OWL_CLASS,
  RDFS_CLASS,
]);
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
  showObjectProperties: true,
  showNamedIndividuals: false,
  showTypeLinks: false,
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

  // For HTTP(S) IRIs, derive a single ontology-root base in the form:
  // <some-url>/<ontology-acronym>
  // (no trailing slash), so deeper paths collapse under that base.
  try {
    const url = new URL(iri);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length === 0) {
        return url.origin;
      }

      const stopWords = new Set([
        'ontology',
        'ontologies',
        'resource',
        'resources',
        'class',
        'classes',
        'individual',
        'individuals',
        'instance',
        'instances',
        'entity',
        'entities',
        'vocabulary',
        'schema',
        'model',
        'data',
      ]);

      const isLikelyOntologyAcronym = (segment) => {
        if (!segment || segment.length > 24 || /^\d+$/.test(segment)) {
          return false;
        }

        const lower = segment.toLowerCase();
        if (stopWords.has(lower)) {
          return false;
        }

        const compact = segment.replace(/[-_]/g, '');
        if (!/[a-zA-Z]/.test(compact) || compact.length < 2 || compact.length > 12) {
          return false;
        }

        const hasUpper = /[A-Z]/.test(compact);
        const isShortLowercaseToken = compact.length <= 5;
        return hasUpper || isShortLowercaseToken;
      };

      let ontologyIndex = pathSegments.findIndex((segment) => isLikelyOntologyAcronym(segment));
      if (ontologyIndex === -1) {
        ontologyIndex = 0;
      }

      const basePath = pathSegments.slice(0, ontologyIndex + 1).join('/');
      return `${url.origin}/${basePath}`;
    }
  } catch {
    // Ignore URL parse failures and continue with generic fallbacks.
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

const NODE_TEXT_LINE_LENGTH = 26;
const NODE_TEXT_TRUNCATE_AT = 220;
const NODE_TEXT_MAX_LINES = 12;

export function makeDisplayLabel(label, maxLineLength = NODE_TEXT_LINE_LENGTH, truncateAt = NODE_TEXT_TRUNCATE_AT) {
  if (!label) {
    return '';
  }

  const sanitized = label.replace(/\s+/g, ' ').trim();
  if (!sanitized) {
    return '';
  }

  const shouldTruncate = sanitized.length > truncateAt;
  const sourceText = shouldTruncate ? `${sanitized.slice(0, truncateAt).trimEnd()}…` : sanitized;
  const words = sourceText.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current) {
      const next = `${current} ${word}`;
      if (next.length <= maxLineLength) {
        current = next;
        continue;
      }

      lines.push(current);
      current = '';
      if (lines.length >= NODE_TEXT_MAX_LINES) {
        break;
      }
    }

    if (word.length <= maxLineLength) {
      current = word;
      continue;
    }

    let remainder = word;
    while (remainder.length > maxLineLength && lines.length < NODE_TEXT_MAX_LINES) {
      lines.push(remainder.slice(0, maxLineLength));
      remainder = remainder.slice(maxLineLength);
    }

    if (lines.length >= NODE_TEXT_MAX_LINES) {
      current = '';
      break;
    }

    current = remainder;
  }

  if (lines.length < NODE_TEXT_MAX_LINES && current) {
    lines.push(current);
  }

  if (lines.length > NODE_TEXT_MAX_LINES) {
    lines.length = NODE_TEXT_MAX_LINES;
  }

  if (shouldTruncate && lines.length > 0 && !lines[lines.length - 1].endsWith('…')) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/…+$/, '').trimEnd()}…`;
  }

  return lines.join('\n');
}

function computeNodeMetrics(displayLabel) {
  const lines = (displayLabel || '').split('\n').filter((line) => line.length > 0);
  const lineCount = Math.max(lines.length, 1);
  let maxLineLength = 1;

  for (const line of lines) {
    if (line.length > maxLineLength) {
      maxLineLength = line.length;
    }
  }

  const nodeWidth = Math.max(64, Math.min(214, Math.round(maxLineLength * 6.2 + 26)));
  const nodeHeight = Math.max(34, Math.min(176, Math.round(lineCount * 16 + 14)));
  const textMaxWidth = Math.max(48, nodeWidth - 16);

  return {
    nodeWidth,
    nodeHeight,
    textMaxWidth,
    lineCount,
    maxLineLength,
  };
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toClassBadge(label, hasMore = false) {
  if (!label) {
    return '';
  }

  const suffix = hasMore ? ' +' : '';
  const maxCoreLength = hasMore ? 11 : 14;
  const compact = label
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!compact) {
    return '';
  }

  if (compact.length <= maxCoreLength) {
    return `${compact}${suffix}`;
  }

  const words = compact.split(' ');
  if (words.length > 1) {
    const candidate = `${words[0]} ${words[1]}`;
    if (candidate.length <= maxCoreLength) {
      return `${candidate}${suffix}`;
    }
  }

  return `${compact.slice(0, Math.max(1, maxCoreLength - 1))}…${suffix}`;
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

  const displayLabel = makeDisplayLabel(fullLabel);
  const metrics = computeNodeMetrics(displayLabel);

  return {
    id,
    iri: term.value,
    baseIri: termType === 'NamedNode' ? getBaseIri(term.value) : '',
    termType,
    kind: termType === 'Literal' ? 'literal' : termType === 'BlankNode' ? 'blank' : 'entity',
    ontologyKind: '',
    graphRole: '',
    fullLabel,
    displayLabel,
    labelLength: Math.min(Math.max(metrics.maxLineLength * metrics.lineCount, 4), 120),
    nodeWidth: metrics.nodeWidth,
    nodeHeight: metrics.nodeHeight,
    textMaxWidth: metrics.textMaxWidth,
    classes: [],
  };
}

function detectPredicateCategory(predicateIri, objectTermType, objectPropertyIris, annotationPropertyIris) {
  if (predicateIri === RDFS_SUBCLASS_OF) {
    return 'subclass';
  }

  if (predicateIri === RDFS_SUBPROPERTY_OF) {
    return 'subproperty';
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

function isHiddenBackgroundClassIri(iri) {
  return HIDDEN_BACKGROUND_CLASS_IRIS.has(iri);
}

export function extractOntologyModel(quads) {
  const classIds = new Set();
  const objectPropertyIds = new Set();
  const dataPropertyIds = new Set();
  const annotationPropertyIds = new Set();
  const namedIndividualIds = new Set();

  for (const quad of quads) {
    if (!isEntityTerm(quad.subject)) {
      continue;
    }
    if (quad.subject.termType === 'NamedNode' && isHiddenBackgroundClassIri(quad.subject.value)) {
      continue;
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_OBJECT_PROPERTY
    ) {
      objectPropertyIds.add(getTermId(quad.subject));
      continue;
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_DATATYPE_PROPERTY
    ) {
      dataPropertyIds.add(getTermId(quad.subject));
      continue;
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_ANNOTATION_PROPERTY
    ) {
      annotationPropertyIds.add(getTermId(quad.subject));
      continue;
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_NAMED_INDIVIDUAL
    ) {
      namedIndividualIds.add(getTermId(quad.subject));
    }
  }

  for (const quad of quads) {
    if (!isEntityTerm(quad.subject)) {
      continue;
    }
    if (quad.subject.termType === 'NamedNode' && isHiddenBackgroundClassIri(quad.subject.value)) {
      continue;
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      CLASS_TYPE_IRIS.has(quad.object.value)
    ) {
      classIds.add(getTermId(quad.subject));
    }

    if (quad.predicate.value === RDFS_SUBCLASS_OF && isEntityTerm(quad.object)) {
      classIds.add(getTermId(quad.subject));
      if (!(quad.object.termType === 'NamedNode' && isHiddenBackgroundClassIri(quad.object.value))) {
        classIds.add(getTermId(quad.object));
      }
    }

    if (quad.predicate.value === RDFS_SUBPROPERTY_OF && isEntityTerm(quad.object)) {
      objectPropertyIds.add(getTermId(quad.subject));
      objectPropertyIds.add(getTermId(quad.object));
    }

    if (
      quad.predicate.value === RDFS_DOMAIN &&
      quad.subject.termType === 'NamedNode' &&
      quad.object.termType === 'NamedNode'
    ) {
      const subjectId = getTermId(quad.subject);
      const objectId = getTermId(quad.object);
      if (objectPropertyIds.has(subjectId)) {
        classIds.add(objectId);
      } else if (dataPropertyIds.has(subjectId)) {
        classIds.add(objectId);
      }
    }

    if (
      quad.predicate.value === RDFS_RANGE &&
      quad.subject.termType === 'NamedNode' &&
      quad.object.termType === 'NamedNode' &&
      objectPropertyIds.has(getTermId(quad.subject))
    ) {
      classIds.add(getTermId(quad.object));
    }
  }

  return {
    classIds,
    objectPropertyIds,
    dataPropertyIds,
    annotationPropertyIds,
    namedIndividualIds,
  };
}

export function extractOntologyClassIds(quads) {
  return extractOntologyModel(quads).classIds;
}

export function buildGraphData(quads, options = {}) {
  const store = new Store(quads);
  const labelIndex = buildLabelIndex(quads);
  const hasOntology = Boolean(options.hasOntology);
  const hasKg = Boolean(options.hasKg);
  const ontologyModel = options.ontologyModel ?? {};
  const ontologyClassIds = ontologyModel.classIds instanceof Set ? ontologyModel.classIds : new Set();
  const ontologyObjectPropertyNodeIds =
    ontologyModel.objectPropertyIds instanceof Set ? ontologyModel.objectPropertyIds : new Set();
  const ontologyDataPropertyNodeIds =
    ontologyModel.dataPropertyIds instanceof Set ? ontologyModel.dataPropertyIds : new Set();
  const ontologyAnnotationPropertyNodeIds =
    ontologyModel.annotationPropertyIds instanceof Set ? ontologyModel.annotationPropertyIds : new Set();

  const nodeMap = new Map();
  const edgeMap = new Map();
  const objectEdges = [];
  const literalEdges = [];
  const classMap = new Map();
  const classAssignments = new Map();
  const dataProperties = new Map();
  const baseIriCounts = new Map();
  const classNodeIds = new Set();
  const namedIndividualNodeIds = new Set();
  const objectPropertyIris = new Set();
  const annotationPropertyIris = new Set(BUILTIN_ANNOTATION_PREDICATES);

  for (const quad of quads) {
    if (quad.predicate.value === RDF_TYPE && quad.subject.termType === 'NamedNode' && quad.object.termType === 'NamedNode') {
      if (quad.object.value === OWL_OBJECT_PROPERTY) {
        objectPropertyIris.add(quad.subject.value);
      } else if (quad.object.value === OWL_ANNOTATION_PROPERTY) {
        annotationPropertyIris.add(quad.subject.value);
      } else if (quad.object.value === OWL_NAMED_INDIVIDUAL) {
        namedIndividualNodeIds.add(getTermId(quad.subject));
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
    if (quad.subject.termType === 'NamedNode' && isHiddenBackgroundClassIri(quad.subject.value)) {
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
      if (quad.object.termType === 'NamedNode' && isHiddenBackgroundClassIri(quad.object.value)) {
        continue;
      }

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

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      !isHiddenBackgroundClassIri(quad.object.value) &&
      quad.object.value !== OWL_NAMED_INDIVIDUAL
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
    const hasMultipleClasses = node.classes.length > 1;
    const hasOntologyMappedClass =
      hasOntology && node.classes.some((classIri) => ontologyClassIds.has(classIri));
    const classLabelList = node.classes
      .map((classIri) => labelIndex.get(classIri) ?? compactIri(classIri))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    node.primaryClassLabel = primaryClassLabel;
    node.classBadge = hasOntologyMappedClass ? '' : toClassBadge(primaryClassLabel, !hasOntology && hasMultipleClasses);
    const badge = makeBadgeDataUri(node.classBadge);
    node.badgeSvg = badge.uri;
    node.badgeWidth = badge.width;
    node.hasClass = hasOntologyMappedClass ? 0 : node.classes.length;
    node.classCount = node.classes.length;
    node.classTooltip = !hasOntology && hasMultipleClasses ? classLabelList.join('\n') : '';

    for (const classIri of classes) {
      const classEntry = classMap.get(classIri);
      if (classEntry) {
        classEntry.count += 1;
      }
    }
  }

  if (hasOntology) {
    classNodeIds.clear();
    for (const ontologyClassId of ontologyClassIds) {
      classNodeIds.add(ontologyClassId);
    }
  } else {
    for (const classIri of classMap.keys()) {
      classNodeIds.add(classIri);
    }
  }

  for (const node of nodeMap.values()) {
    if (node.termType !== 'NamedNode') {
      continue;
    }

    if (ontologyDataPropertyNodeIds.has(node.id)) {
      node.ontologyKind = 'data-property';
    } else if (ontologyObjectPropertyNodeIds.has(node.id)) {
      node.ontologyKind = 'object-property';
    } else if (ontologyAnnotationPropertyNodeIds.has(node.id)) {
      node.ontologyKind = 'annotation-property';
    } else if (ontologyClassIds.has(node.id)) {
      node.ontologyKind = 'class';
    } else if (namedIndividualNodeIds.has(node.id)) {
      node.ontologyKind = 'individual';
    }

    if (hasOntology && hasKg) {
      if (ontologyClassIds.has(node.id)) {
        node.graphRole = 'ontology-class';
      } else if (node.classes.length > 0 || namedIndividualNodeIds.has(node.id)) {
        node.graphRole = 'kg-instance';
      }
    }

    node.isOntologyNode = node.ontologyKind ? 1 : 0;
    node.mixedMode = hasOntology && hasKg ? 1 : 0;
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
      node.classCount = 0;
      node.classTooltip = '';
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
    namedIndividualNodeIds,
    hasOntology,
    hasKg,
    ontologyClassIds,
    ontologyObjectPropertyNodeIds,
    ontologyDataPropertyNodeIds,
    ontologyAnnotationPropertyNodeIds,
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
        ontologyKind: node.ontologyKind ?? '',
        graphRole: node.graphRole ?? '',
        isOntologyNode: node.isOntologyNode ?? 0,
        mixedMode: node.mixedMode ?? 0,
        termType: node.termType,
        labelLength: node.labelLength,
        nodeWidth: node.nodeWidth ?? 96,
        nodeHeight: node.nodeHeight ?? 52,
        textMaxWidth: node.textMaxWidth ?? 78,
        hasClass: node.hasClass,
        classCount: node.classCount ?? 0,
        classBadge: node.classBadge,
        badgeSvg: node.badgeSvg,
        badgeWidth: node.badgeWidth,
        classTooltip: node.classTooltip ?? '',
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
    showNamedIndividuals: Boolean(viewOptions?.showNamedIndividuals),
    showTypeLinks: Boolean(viewOptions?.showTypeLinks),
  };
}

function shouldIncludeObjectEdge(edge, options) {
  if (edge.category === 'subclass') {
    return true;
  }

  if (edge.category === 'subproperty') {
    return options.showObjectProperties;
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

function shouldIncludeOntologyObjectEdgeByNodeKinds(graphData, edge, options) {
  if (!graphData.hasOntology) {
    return true;
  }

  const sourceKind = graphData.nodeMap.get(edge.source)?.ontologyKind ?? '';
  const targetKind = graphData.nodeMap.get(edge.target)?.ontologyKind ?? '';

  const touchesDataProperty =
    sourceKind === 'data-property' || targetKind === 'data-property';
  if (touchesDataProperty && !options.showDataProperties) {
    return false;
  }

  const touchesAnnotationProperty =
    sourceKind === 'annotation-property' || targetKind === 'annotation-property';
  if (touchesAnnotationProperty && !options.showAnnotationProperties) {
    return false;
  }

  const touchesObjectProperty =
    sourceKind === 'object-property' || targetKind === 'object-property';
  if (touchesObjectProperty && !options.showObjectProperties) {
    return false;
  }

  return true;
}

function shouldIncludeStandaloneNode(node, graphData, options, kgClassNodeIds = null) {
  if (!node || node.termType === 'Literal' || node.termType === 'BlankNode') {
    return false;
  }

  if (!graphData.hasOntology) {
    // In KG-only mode, do not render class target nodes from `<entity> rdf:type <Class>`.
    // Class information is represented on instance nodes as badges.
    if (kgClassNodeIds?.has(node.id)) {
      return false;
    }
    return true;
  }

  if (node.ontologyKind === 'class') {
    return true;
  }

  if (node.ontologyKind === 'individual') {
    return options.showNamedIndividuals;
  }

  if (node.ontologyKind === 'object-property') {
    return options.showObjectProperties;
  }

  if (node.ontologyKind === 'data-property') {
    return options.showDataProperties;
  }

  if (node.ontologyKind === 'annotation-property') {
    return options.showAnnotationProperties;
  }

  // KG instances and other named nodes should stay visible even without edges.
  return true;
}

export function buildFocusedSubset(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  if (!graphData) {
    return [];
  }

  if (focusedNodeIds && focusedNodeIds.size === 0) {
    return [];
  }

  const effectiveFocusedNodeIds =
    focusedNodeIds && graphData.hasOntology && graphData.hasKg
      ? (() => {
          const combined = new Set(focusedNodeIds);
          for (const node of graphData.nodes) {
            if (node.isOntologyNode) {
              combined.add(node.id);
            }
          }
          return combined;
        })()
      : focusedNodeIds;

  const options = normalizeViewOptions(viewOptions);
  const kgClassNodeIds = graphData.hasOntology ? null : new Set((graphData.classes ?? []).map((entry) => entry.id));
  const classStructureOnly =
    !options.showDataProperties && !options.showAnnotationProperties && !options.showObjectProperties;
  const visibleNodeIds = new Set();
  const visibleEdges = [];
  const isOntologyStructuralNodeHidden = (nodeId) => {
    if (!graphData.hasOntology) {
      return false;
    }

    const node = graphData.nodeMap.get(nodeId);
    if (!node) {
      return false;
    }

    if (node.termType === 'BlankNode') {
      return true;
    }

    return node.termType === 'NamedNode' && node.iri === RDF_NIL;
  };
  const isNamedIndividualVisible = (nodeId) =>
    options.showNamedIndividuals || !graphData.namedIndividualNodeIds.has(nodeId);
  const isOntologyObjectPropertyNodeVisible = (nodeId) =>
    !(graphData.hasOntology && graphData.hasKg && graphData.ontologyObjectPropertyNodeIds.has(nodeId));

  for (const edge of graphData.objectEdges) {
    if (graphData.hasOntology && (edge.predicate === RDF_FIRST || edge.predicate === RDF_REST)) {
      continue;
    }

    if (edge.category === 'type') {
      if (!options.showTypeLinks || !graphData.ontologyClassIds.has(edge.target)) {
        continue;
      }
    } else if (!shouldIncludeObjectEdge(edge, options)) {
      continue;
    }

    if (!shouldIncludeOntologyObjectEdgeByNodeKinds(graphData, edge, options)) {
      continue;
    }

    if (isOntologyStructuralNodeHidden(edge.source) || isOntologyStructuralNodeHidden(edge.target)) {
      continue;
    }

    if (!isNamedIndividualVisible(edge.source) || !isNamedIndividualVisible(edge.target)) {
      continue;
    }
    if (!isOntologyObjectPropertyNodeVisible(edge.source) || !isOntologyObjectPropertyNodeVisible(edge.target)) {
      continue;
    }

    if (
      edge.category === 'subclass' &&
      (!graphData.classNodeIds.has(edge.source) || !graphData.classNodeIds.has(edge.target))
    ) {
      continue;
    }

    if (
      edge.category === 'subproperty' &&
      graphData.hasOntology &&
      (!graphData.ontologyObjectPropertyNodeIds.has(edge.source) ||
        !graphData.ontologyObjectPropertyNodeIds.has(edge.target))
    ) {
      continue;
    }

    if (effectiveFocusedNodeIds && (!effectiveFocusedNodeIds.has(edge.source) || !effectiveFocusedNodeIds.has(edge.target))) {
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
    if (isOntologyStructuralNodeHidden(edge.source) || isOntologyStructuralNodeHidden(edge.target)) {
      continue;
    }
    if (!isNamedIndividualVisible(edge.source) || !isNamedIndividualVisible(edge.target)) {
      continue;
    }
    if (!isOntologyObjectPropertyNodeVisible(edge.source) || !isOntologyObjectPropertyNodeVisible(edge.target)) {
      continue;
    }

    if (effectiveFocusedNodeIds && !effectiveFocusedNodeIds.has(edge.source)) {
      continue;
    }

    visibleEdges.push(edge);
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }

  if (graphData.hasOntology && (!effectiveFocusedNodeIds || classStructureOnly)) {
    for (const classNodeId of graphData.classNodeIds) {
      if (isOntologyStructuralNodeHidden(classNodeId)) {
        continue;
      }
      if (!effectiveFocusedNodeIds || effectiveFocusedNodeIds.has(classNodeId)) {
        visibleNodeIds.add(classNodeId);
      }
    }
  }

  const candidateNodes = effectiveFocusedNodeIds
    ? graphData.nodes.filter((node) => effectiveFocusedNodeIds.has(node.id))
    : graphData.nodes;

  for (const node of candidateNodes) {
    if (isOntologyStructuralNodeHidden(node.id)) {
      continue;
    }
    if (!isNamedIndividualVisible(node.id)) {
      continue;
    }
    if (!isOntologyObjectPropertyNodeVisible(node.id)) {
      continue;
    }
    if (!shouldIncludeStandaloneNode(node, graphData, options, kgClassNodeIds)) {
      continue;
    }
    visibleNodeIds.add(node.id);
  }

  const nodes = graphData.nodes.filter(
    (node) =>
      visibleNodeIds.has(node.id) &&
      isOntologyObjectPropertyNodeVisible(node.id) &&
      !isOntologyStructuralNodeHidden(node.id),
  );
  return toElements(nodes, visibleEdges);
}
