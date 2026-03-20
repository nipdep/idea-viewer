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
const RDFS_COMMENT = `${RDFS_NS}comment`;
const RDFS_DATATYPE = `${RDFS_NS}Datatype`;
const RDFS_DOMAIN = `${RDFS_NS}domain`;
const RDFS_RANGE = `${RDFS_NS}range`;
const OWL_CLASS = `${OWL_NS}Class`;
const OWL_DATATYPE = `${OWL_NS}Datatype`;
const OWL_OBJECT_PROPERTY = `${OWL_NS}ObjectProperty`;
const OWL_DATATYPE_PROPERTY = `${OWL_NS}DatatypeProperty`;
const OWL_ANNOTATION_PROPERTY = `${OWL_NS}AnnotationProperty`;
const OWL_NAMED_INDIVIDUAL = `${OWL_NS}NamedIndividual`;
const OWL_ONTOLOGY = `${OWL_NS}Ontology`;
const OWL_IMPORTS = `${OWL_NS}imports`;
const OWL_VERSION_IRI = `${OWL_NS}versionIRI`;
const OWL_VERSION_INFO = `${OWL_NS}versionInfo`;
const OWL_EQUIVALENT_CLASS = `${OWL_NS}equivalentClass`;
const OWL_DISJOINT_WITH = `${OWL_NS}disjointWith`;
const OWL_EQUIVALENT_PROPERTY = `${OWL_NS}equivalentProperty`;
const OWL_INVERSE_OF = `${OWL_NS}inverseOf`;
const OWL_SAME_AS = `${OWL_NS}sameAs`;
const OWL_DIFFERENT_FROM = `${OWL_NS}differentFrom`;
const OWL_HAS_KEY = `${OWL_NS}hasKey`;
const OWL_INTERSECTION_OF = `${OWL_NS}intersectionOf`;
const OWL_UNION_OF = `${OWL_NS}unionOf`;
const OWL_COMPLEMENT_OF = `${OWL_NS}complementOf`;
const OWL_ONE_OF = `${OWL_NS}oneOf`;
const OWL_RESTRICTION = `${OWL_NS}Restriction`;
const OWL_ON_PROPERTY = `${OWL_NS}onProperty`;
const OWL_SOME_VALUES_FROM = `${OWL_NS}someValuesFrom`;
const OWL_ALL_VALUES_FROM = `${OWL_NS}allValuesFrom`;
const OWL_HAS_VALUE = `${OWL_NS}hasValue`;
const OWL_MIN_CARDINALITY = `${OWL_NS}minCardinality`;
const OWL_MAX_CARDINALITY = `${OWL_NS}maxCardinality`;
const OWL_CARDINALITY = `${OWL_NS}cardinality`;
const OWL_MIN_QUALIFIED_CARDINALITY = `${OWL_NS}minQualifiedCardinality`;
const OWL_MAX_QUALIFIED_CARDINALITY = `${OWL_NS}maxQualifiedCardinality`;
const OWL_QUALIFIED_CARDINALITY = `${OWL_NS}qualifiedCardinality`;
const OWL_ON_CLASS = `${OWL_NS}onClass`;
const OWL_ON_DATA_RANGE = `${OWL_NS}onDataRange`;
const OWL_HAS_SELF = `${OWL_NS}hasSelf`;
const OWL_WITH_RESTRICTIONS = `${OWL_NS}withRestrictions`;
const PROV_WAS_DERIVED_FROM = 'http://www.w3.org/ns/prov#wasDerivedFrom';
const DCT_SOURCE = 'http://purl.org/dc/terms/source';

const CLASS_TYPE_IRIS = new Set([RDFS_CLASS, OWL_CLASS]);
const DATATYPE_TYPE_IRIS = new Set([RDFS_DATATYPE, OWL_DATATYPE]);
const HIDDEN_BACKGROUND_CLASS_IRIS = new Set([
  OWL_DATATYPE_PROPERTY,
  OWL_OBJECT_PROPERTY,
  OWL_ONTOLOGY,
  OWL_CLASS,
  RDFS_CLASS,
]);
const BUILTIN_ANNOTATION_PREDICATES = new Set([
  `${RDFS_NS}label`,
  RDFS_COMMENT,
  `${RDFS_NS}seeAlso`,
  `${RDFS_NS}isDefinedBy`,
  OWL_VERSION_INFO,
  `${OWL_NS}priorVersion`,
  `${OWL_NS}backwardCompatibleWith`,
  `${OWL_NS}incompatibleWith`,
  `${OWL_NS}deprecated`,
]);

const EXPRESSION_NODE_PREDICATE_LABELS = new Map([
  [OWL_INTERSECTION_OF, 'Intersection'],
  [OWL_UNION_OF, 'Union'],
  [OWL_COMPLEMENT_OF, 'Complement'],
  [OWL_ONE_OF, 'OneOf'],
  [OWL_WITH_RESTRICTIONS, 'DataRange'],
  [OWL_ON_CLASS, 'NamedClass'],
  [OWL_ON_DATA_RANGE, 'DataRange'],
]);

const RESTRICTION_PREDICATE_LABELS = new Map([
  [OWL_ON_PROPERTY, 'onProperty'],
  [OWL_SOME_VALUES_FROM, 'someValuesFrom'],
  [OWL_ALL_VALUES_FROM, 'allValuesFrom'],
  [OWL_HAS_VALUE, 'hasValue'],
  [OWL_MIN_CARDINALITY, 'minCardinality'],
  [OWL_MAX_CARDINALITY, 'maxCardinality'],
  [OWL_CARDINALITY, 'exactCardinality'],
  [OWL_MIN_QUALIFIED_CARDINALITY, 'minQualifiedCardinality'],
  [OWL_MAX_QUALIFIED_CARDINALITY, 'maxQualifiedCardinality'],
  [OWL_QUALIFIED_CARDINALITY, 'qualifiedCardinality'],
  [OWL_HAS_SELF, 'hasSelf'],
]);

const AXIOM_KIND_BY_PREDICATE = new Map([
  [RDFS_SUBCLASS_OF, 'SubClassOf'],
  [OWL_EQUIVALENT_CLASS, 'EquivalentClasses'],
  [OWL_DISJOINT_WITH, 'DisjointClasses'],
  [RDF_TYPE, 'ClassAssertion'],
  [RDFS_DOMAIN, 'Domain'],
  [RDFS_RANGE, 'Range'],
  [RDFS_SUBPROPERTY_OF, 'SubPropertyOf'],
  [OWL_EQUIVALENT_PROPERTY, 'EquivalentProperty'],
  [OWL_INVERSE_OF, 'InverseProperties'],
  [OWL_SAME_AS, 'SameIndividual'],
  [OWL_DIFFERENT_FROM, 'DifferentIndividuals'],
  [OWL_HAS_KEY, 'Keys'],
  [OWL_IMPORTS, 'Imports'],
]);

export const DEFAULT_VIEW_OPTIONS = Object.freeze({
  projectionMode: 'ontology',
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

const METADATA_PREDICATES = new Set([
  ...LABEL_PREDICATES,
  RDFS_COMMENT,
  OWL_IMPORTS,
  OWL_VERSION_IRI,
  OWL_VERSION_INFO,
  PROV_WAS_DERIVED_FROM,
  DCT_SOURCE,
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

function applyNodeDisplayLabel(node, fullLabel) {
  const displayLabel = makeDisplayLabel(fullLabel);
  const metrics = computeNodeMetrics(displayLabel);
  node.fullLabel = fullLabel;
  node.displayLabel = displayLabel;
  node.labelLength = Math.min(Math.max(metrics.maxLineLength * metrics.lineCount, 4), 120);
  node.nodeWidth = metrics.nodeWidth;
  node.nodeHeight = metrics.nodeHeight;
  node.textMaxWidth = metrics.textMaxWidth;
}

function makeNodeData(term, labelIndex, options = {}) {
  const id = getTermId(term);
  const termType = term.termType;
  const blankLabel = options.blankLabelById?.get(id) ?? '';

  let fullLabel = '';
  if (termType === 'Literal') {
    fullLabel = term.value;
  } else if (labelIndex.has(id)) {
    fullLabel = labelIndex.get(id);
  } else if (termType === 'NamedNode') {
    fullLabel = compactIri(term.value);
  } else if (blankLabel) {
    fullLabel = blankLabel;
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
    entityCategory: termType === 'Literal' ? 'literal' : termType === 'BlankNode' ? 'blank' : 'entity',
    blankExpressionType: '',
    restrictionKind: '',
    restrictionTooltip: '',
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

function detectPredicateCategory(predicateIri, objectTermType, objectPropertyIris, dataPropertyIris, annotationPropertyIris) {
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

  if (dataPropertyIris.has(predicateIri)) {
    return 'data';
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

function getRestrictionKind(predicateIri) {
  if (predicateIri === RDF_TYPE) {
    return '';
  }

  if (RESTRICTION_PREDICATE_LABELS.has(predicateIri)) {
    return RESTRICTION_PREDICATE_LABELS.get(predicateIri);
  }

  return '';
}

function getAxiomKind(quad, category, objectPropertyIris, dataPropertyIris, annotationPropertyIris) {
  if (AXIOM_KIND_BY_PREDICATE.has(quad.predicate.value)) {
    return AXIOM_KIND_BY_PREDICATE.get(quad.predicate.value);
  }

  if (EXPRESSION_NODE_PREDICATE_LABELS.has(quad.predicate.value)) {
    return 'ClassExpression';
  }

  const restrictionKind = getRestrictionKind(quad.predicate.value);
  if (restrictionKind) {
    return 'Restriction';
  }

  if (category === 'annotation' || annotationPropertyIris.has(quad.predicate.value)) {
    return 'AnnotationAssertion';
  }

  if (category === 'data' || dataPropertyIris.has(quad.predicate.value)) {
    return 'PropertyAssertion';
  }

  if (category === 'object' || objectPropertyIris.has(quad.predicate.value)) {
    return 'PropertyAssertion';
  }

  return 'Axiom';
}

function termToMetadataValue(term) {
  if (!term) {
    return '';
  }

  if (term.termType === 'Literal') {
    const base = term.value;
    if (term.language) {
      return `${base} (@${term.language})`;
    }
    const datatype = term.datatype?.value;
    if (datatype && datatype !== 'http://www.w3.org/2001/XMLSchema#string') {
      return `${base}^^${compactIri(datatype)}`;
    }
    return base;
  }

  if (term.termType === 'NamedNode') {
    return term.value;
  }

  if (term.termType === 'BlankNode') {
    return `_:${term.value}`;
  }

  return term.value ?? '';
}

function compactTermForRestriction(term) {
  if (!term) {
    return '';
  }

  if (term.termType === 'NamedNode') {
    return compactIri(term.value);
  }

  if (term.termType === 'BlankNode') {
    return `[Blank ${term.value}]`;
  }

  if (term.termType === 'Literal') {
    if (term.language) {
      return `"${term.value}"@${term.language}`;
    }
    return `"${term.value}"`;
  }

  return term.value ?? '';
}

function buildBlankExpressionIndex(quads) {
  const blankRoles = new Map();
  const restrictionTermsById = new Map();

  const registerRole = (blankId, role, priority) => {
    if (!blankId || !role) {
      return;
    }

    const previous = blankRoles.get(blankId);
    if (!previous || priority > previous.priority) {
      blankRoles.set(blankId, { role, priority });
    }
  };

  const registerRestrictionTerm = (blankId, predicateIri, term) => {
    if (!blankId || !predicateIri || !term) {
      return;
    }

    let predicateTerms = restrictionTermsById.get(blankId);
    if (!predicateTerms) {
      predicateTerms = new Map();
      restrictionTermsById.set(blankId, predicateTerms);
    }

    const values = predicateTerms.get(predicateIri) ?? [];
    values.push(term);
    predicateTerms.set(predicateIri, values);
  };

  for (const quad of quads) {
    if (quad.subject.termType === 'BlankNode') {
      const subjectId = getTermId(quad.subject);
      if (
        quad.predicate.value === RDF_TYPE &&
        quad.object.termType === 'NamedNode' &&
        quad.object.value === OWL_RESTRICTION
      ) {
        registerRole(subjectId, 'Restriction', 90);
      }

      const restrictionKind = getRestrictionKind(quad.predicate.value);
      if (restrictionKind) {
        registerRole(subjectId, `Restriction:${restrictionKind}`, 100);
        registerRestrictionTerm(subjectId, quad.predicate.value, quad.object);
      }

      if (EXPRESSION_NODE_PREDICATE_LABELS.has(quad.predicate.value)) {
        registerRole(subjectId, EXPRESSION_NODE_PREDICATE_LABELS.get(quad.predicate.value), 80);
      }

      if (quad.predicate.value === RDF_FIRST || quad.predicate.value === RDF_REST) {
        registerRole(subjectId, 'List', 40);
      }
    }

    if (quad.object.termType === 'BlankNode') {
      const objectId = getTermId(quad.object);

      if (quad.predicate.value === RDF_FIRST || quad.predicate.value === RDF_REST) {
        registerRole(objectId, 'List', 40);
      }

      if (
        quad.predicate.value === RDFS_SUBCLASS_OF ||
        quad.predicate.value === OWL_EQUIVALENT_CLASS ||
        quad.predicate.value === OWL_DISJOINT_WITH
      ) {
        registerRole(objectId, 'ClassExpression', 70);
      }

      if (
        quad.predicate.value === OWL_ON_PROPERTY ||
        quad.predicate.value === OWL_ON_CLASS ||
        quad.predicate.value === OWL_ON_DATA_RANGE ||
        quad.predicate.value === OWL_SOME_VALUES_FROM ||
        quad.predicate.value === OWL_ALL_VALUES_FROM ||
        quad.predicate.value === OWL_HAS_VALUE ||
        quad.predicate.value === OWL_MIN_CARDINALITY ||
        quad.predicate.value === OWL_MAX_CARDINALITY ||
        quad.predicate.value === OWL_CARDINALITY ||
        quad.predicate.value === OWL_MIN_QUALIFIED_CARDINALITY ||
        quad.predicate.value === OWL_MAX_QUALIFIED_CARDINALITY ||
        quad.predicate.value === OWL_QUALIFIED_CARDINALITY ||
        quad.predicate.value === OWL_HAS_SELF ||
        quad.predicate.value === OWL_INTERSECTION_OF ||
        quad.predicate.value === OWL_UNION_OF ||
        quad.predicate.value === OWL_COMPLEMENT_OF ||
        quad.predicate.value === OWL_ONE_OF ||
        quad.predicate.value === OWL_WITH_RESTRICTIONS
      ) {
        registerRole(objectId, 'ClassExpression', 65);
      }
    }
  }

  const blankLabelById = new Map();
  const restrictionTooltipById = new Map();
  for (const [blankId, info] of blankRoles.entries()) {
    if (info.role.startsWith('Restriction:')) {
      blankLabelById.set(blankId, info.role.slice('Restriction:'.length) || 'Restriction');
    } else {
      blankLabelById.set(blankId, info.role);
    }
  }

  const restrictionOrder = [
    OWL_ON_PROPERTY,
    OWL_ON_CLASS,
    OWL_ON_DATA_RANGE,
    OWL_SOME_VALUES_FROM,
    OWL_ALL_VALUES_FROM,
    OWL_HAS_VALUE,
    OWL_MIN_CARDINALITY,
    OWL_MAX_CARDINALITY,
    OWL_CARDINALITY,
    OWL_MIN_QUALIFIED_CARDINALITY,
    OWL_MAX_QUALIFIED_CARDINALITY,
    OWL_QUALIFIED_CARDINALITY,
    OWL_HAS_SELF,
  ];
  for (const [blankId, predicateTerms] of restrictionTermsById.entries()) {
    const parts = [];
    for (const predicate of restrictionOrder) {
      const terms = predicateTerms.get(predicate);
      if (!terms || terms.length === 0) {
        continue;
      }
      const label = RESTRICTION_PREDICATE_LABELS.get(predicate) ?? compactIri(predicate);
      for (const term of terms) {
        parts.push(`${label} ${compactTermForRestriction(term)}`);
      }
    }

    if (parts.length > 0) {
      restrictionTooltipById.set(blankId, `Restriction(${parts.join('; ')})`);
    } else if (blankRoles.get(blankId)?.role?.startsWith('Restriction')) {
      restrictionTooltipById.set(blankId, 'Restriction');
    }
  }

  return {
    blankRoles,
    blankLabelById,
    restrictionTooltipById,
  };
}

function annotationObjectToLiteralValue(term) {
  if (!term) {
    return '';
  }

  if (term.termType === 'Literal') {
    return term.value;
  }

  if (term.termType === 'NamedNode') {
    return term.value;
  }

  if (term.termType === 'BlankNode') {
    return `_:${term.value}`;
  }

  return term.value ?? '';
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
  const datatypeIds = new Set();

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

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      DATATYPE_TYPE_IRIS.has(quad.object.value)
    ) {
      datatypeIds.add(getTermId(quad.subject));
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

    if (
      quad.predicate.value === RDFS_RANGE &&
      quad.subject.termType === 'NamedNode' &&
      quad.object.termType === 'NamedNode' &&
      dataPropertyIds.has(getTermId(quad.subject))
    ) {
      datatypeIds.add(getTermId(quad.object));
    }
  }

  return {
    classIds,
    objectPropertyIds,
    dataPropertyIds,
    annotationPropertyIds,
    namedIndividualIds,
    datatypeIds,
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
  const ontologyDatatypeNodeIds = ontologyModel.datatypeIds instanceof Set ? ontologyModel.datatypeIds : new Set();
  const { blankRoles, blankLabelById, restrictionTooltipById } = buildBlankExpressionIndex(quads);

  const nodeMap = new Map();
  const edgeMap = new Map();
  const objectEdges = [];
  const literalEdges = [];
  const classMap = new Map();
  const classAssignments = new Map();
  const dataProperties = new Map();
  const nodeMetadata = new Map();
  const edgeMetadata = new Map();
  const baseIriCounts = new Map();
  const classNodeIds = new Set();
  const badgeClassNodeIds = new Set();
  const namedIndividualNodeIds = new Set();
  const datatypeNodeIds = new Set();
  const objectPropertyIris = new Set(ontologyObjectPropertyNodeIds);
  const dataPropertyIris = new Set(ontologyDataPropertyNodeIds);
  const annotationPropertyIris = new Set([...BUILTIN_ANNOTATION_PREDICATES, ...ontologyAnnotationPropertyNodeIds]);

  const ensureNode = (term) => {
    const nodeId = getTermId(term);
    if (!nodeMap.has(nodeId)) {
      nodeMap.set(nodeId, makeNodeData(term, labelIndex, { blankLabelById }));
    }
    return nodeMap.get(nodeId);
  };

  const addNodeMetadataRow = (nodeId, row) => {
    const rows = nodeMetadata.get(nodeId) ?? [];
    rows.push(row);
    nodeMetadata.set(nodeId, rows);
  };

  const registerEdgeMetadata = (edgeId, edge, quad, category, axiomKind, restrictionKind) => {
    edgeMetadata.set(edgeId, [
      {
        key: 'Axiom',
        value: axiomKind,
      },
      {
        key: 'Category',
        value: category,
      },
      ...(restrictionKind
        ? [
            {
              key: 'Restriction',
              value: restrictionKind,
            },
          ]
        : []),
      {
        key: 'Predicate',
        value: edge.predicate,
      },
      {
        key: 'Subject',
        value: termToMetadataValue(quad.subject),
      },
      {
        key: 'Object',
        value: termToMetadataValue(quad.object),
      },
    ]);
  };

  for (const quad of quads) {
    if (quad.predicate.value === RDF_TYPE && quad.subject.termType === 'NamedNode' && quad.object.termType === 'NamedNode') {
      if (quad.object.value === OWL_OBJECT_PROPERTY) {
        objectPropertyIris.add(quad.subject.value);
      } else if (quad.object.value === OWL_DATATYPE_PROPERTY) {
        dataPropertyIris.add(quad.subject.value);
      } else if (quad.object.value === OWL_ANNOTATION_PROPERTY) {
        annotationPropertyIris.add(quad.subject.value);
      } else if (quad.object.value === OWL_NAMED_INDIVIDUAL) {
        namedIndividualNodeIds.add(getTermId(quad.subject));
      } else if (CLASS_TYPE_IRIS.has(quad.object.value)) {
        classNodeIds.add(getTermId(quad.subject));
      } else if (DATATYPE_TYPE_IRIS.has(quad.object.value)) {
        datatypeNodeIds.add(getTermId(quad.subject));
      }

      if (CLASS_TYPE_IRIS.has(quad.object.value)) {
        classNodeIds.add(getTermId(quad.object));
      }
    }

    if (
      quad.predicate.value === RDFS_SUBPROPERTY_OF &&
      quad.subject.termType === 'NamedNode' &&
      quad.object.termType === 'NamedNode'
    ) {
      objectPropertyIris.add(quad.subject.value);
      objectPropertyIris.add(quad.object.value);
    }

    if (
      quad.predicate.value === RDFS_RANGE &&
      quad.subject.termType === 'NamedNode' &&
      quad.object.termType === 'NamedNode' &&
      dataPropertyIris.has(quad.subject.value)
    ) {
      datatypeNodeIds.add(getTermId(quad.object));
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
      ensureNode(quad.subject);
    }

    if (METADATA_PREDICATES.has(quad.predicate.value)) {
      addNodeMetadataRow(sourceId, {
        predicate: quad.predicate.value,
        predicateLabel: compactIri(quad.predicate.value),
        value: termToMetadataValue(quad.object),
      });
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_ONTOLOGY
    ) {
      addNodeMetadataRow(sourceId, {
        predicate: quad.predicate.value,
        predicateLabel: 'source ontology',
        value: quad.subject.value,
      });
    }

    const category = detectPredicateCategory(
      quad.predicate.value,
      quad.object.termType,
      objectPropertyIris,
      dataPropertyIris,
      annotationPropertyIris,
    );
    const axiomKind = getAxiomKind(quad, category, objectPropertyIris, dataPropertyIris, annotationPropertyIris);
    const restrictionKind = getRestrictionKind(quad.predicate.value);

    if (category === 'annotation') {
      const annotationValue = annotationObjectToLiteralValue(quad.object);
      const annotationLiteral = literal(annotationValue);
      const literalId = getTermId(annotationLiteral);
      if (!nodeMap.has(literalId)) {
        ensureNode(annotationLiteral);
      }

      const edgeId = `l${literalEdgeCounter}`;
      const literalEdge = {
        id: edgeId,
        source: sourceId,
        target: literalId,
        predicate: quad.predicate.value,
        predicateLabel: compactIri(quad.predicate.value),
        category: 'annotation',
        axiomKind,
        restrictionKind,
      };
      literalEdges.push(literalEdge);
      edgeMap.set(edgeId, literalEdge);
      registerEdgeMetadata(edgeId, literalEdge, quad, 'annotation', axiomKind, restrictionKind);
      literalEdgeCounter += 1;

      const rows = dataProperties.get(sourceId) ?? [];
      rows.push({
        predicate: quad.predicate.value,
        predicateLabel: compactIri(quad.predicate.value),
        value: annotationValue,
        language: '',
        datatype: '',
        category: 'annotation',
      });
      dataProperties.set(sourceId, rows);
      continue;
    }

    if (isEntityTerm(quad.object)) {
      if (quad.object.termType === 'NamedNode' && isHiddenBackgroundClassIri(quad.object.value)) {
        continue;
      }

      const targetId = getTermId(quad.object);
      if (!nodeMap.has(targetId)) {
        ensureNode(quad.object);
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
        axiomKind,
        restrictionKind,
      };
      objectEdges.push(edge);
      edgeMap.set(edgeId, edge);
      registerEdgeMetadata(edgeId, edge, quad, category, axiomKind, restrictionKind);
      objectEdgeCounter += 1;
    } else if (quad.object.termType === 'Literal') {
      const literalId = getTermId(quad.object);
      if (!nodeMap.has(literalId)) {
        ensureNode(quad.object);
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
        axiomKind,
        restrictionKind,
      };
      literalEdges.push(literalEdge);
      edgeMap.set(edgeId, literalEdge);
      registerEdgeMetadata(edgeId, literalEdge, quad, literalCategory, axiomKind, restrictionKind);
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

    if (node.hasClass > 0 && node.termType === 'NamedNode') {
      for (const classIri of classes) {
        badgeClassNodeIds.add(classIri);
      }
    }

    for (const classIri of classes) {
      const classEntry = classMap.get(classIri);
      if (classEntry) {
        classEntry.count += 1;
      }
    }
  }

  if (hasOntology) {
    for (const ontologyClassId of ontologyClassIds) {
      classNodeIds.add(ontologyClassId);
    }
  }
  for (const classIri of classMap.keys()) {
    classNodeIds.add(classIri);
  }

  for (const datatypeId of ontologyDatatypeNodeIds) {
    datatypeNodeIds.add(datatypeId);
  }

  const ontologyObjectPropertyIds = new Set([
    ...Array.from(ontologyObjectPropertyNodeIds),
    ...Array.from(objectPropertyIris.values()),
  ]);
  const ontologyDataPropertyIds = new Set([
    ...Array.from(ontologyDataPropertyNodeIds),
    ...Array.from(dataPropertyIris.values()),
  ]);
  const ontologyAnnotationPropertyIds = new Set([
    ...Array.from(ontologyAnnotationPropertyNodeIds),
    ...Array.from(annotationPropertyIris.values()),
  ]);

  for (const node of nodeMap.values()) {
    if (node.termType === 'BlankNode') {
      const role = blankRoles.get(node.id)?.role ?? '';
      if (role) {
        if (role.startsWith('Restriction:')) {
          node.blankExpressionType = 'Restriction';
          node.restrictionKind = role.slice('Restriction:'.length) || 'Restriction';
        } else {
          node.blankExpressionType = role;
        }
        node.restrictionTooltip = restrictionTooltipById.get(node.id) ?? '';
        node.entityCategory = 'class-expression';
        applyNodeDisplayLabel(node, blankLabelById.get(node.id) ?? role);
        node.hasClass = 0;
        node.classBadge = '';
        node.badgeSvg = '';
        node.badgeWidth = 0;
        node.classCount = 0;
        node.classTooltip = '';
      }
      continue;
    }

    if (node.termType === 'Literal') {
      node.entityCategory = 'literal';
      continue;
    }

    if (node.termType !== 'NamedNode') {
      continue;
    }

    if (ontologyDataPropertyIds.has(node.id) || dataPropertyIris.has(node.id)) {
      node.ontologyKind = 'data-property';
      node.entityCategory = 'data-property';
    } else if (ontologyObjectPropertyIds.has(node.id) || objectPropertyIris.has(node.id)) {
      node.ontologyKind = 'object-property';
      node.entityCategory = 'object-property';
    } else if (ontologyAnnotationPropertyIds.has(node.id) || annotationPropertyIris.has(node.id)) {
      node.ontologyKind = 'annotation-property';
      node.entityCategory = 'annotation-property';
    } else if (ontologyClassIds.has(node.id)) {
      node.ontologyKind = 'class';
      node.entityCategory = 'class';
    } else if (classNodeIds.has(node.id)) {
      node.ontologyKind = 'class';
      node.entityCategory = 'class';
    } else if (namedIndividualNodeIds.has(node.id)) {
      node.ontologyKind = 'individual';
      node.entityCategory = 'individual';
    } else if (datatypeNodeIds.has(node.id)) {
      node.ontologyKind = 'datatype';
      node.entityCategory = 'datatype';
    } else {
      node.entityCategory = 'named-entity';
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
    badgeClassNodeIds,
    namedIndividualNodeIds,
    datatypeNodeIds,
    hasOntology,
    hasKg,
    ontologyClassIds,
    ontologyObjectPropertyNodeIds: ontologyObjectPropertyIds,
    ontologyDataPropertyNodeIds: ontologyDataPropertyIds,
    ontologyAnnotationPropertyNodeIds: ontologyAnnotationPropertyIds,
    ontologyDatatypeNodeIds,
    blankExpressionNodeIds: new Set(
      Array.from(blankRoles.entries())
        .filter(([, info]) => Boolean(info?.role))
        .map(([id]) => id),
    ),
    dataProperties,
    nodeMetadata,
    edgeMetadata,
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
        entityCategory: node.entityCategory ?? '',
        blankExpressionType: node.blankExpressionType ?? '',
        restrictionKind: node.restrictionKind ?? '',
        restrictionTooltip: node.restrictionTooltip ?? '',
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
        axiomKind: edge.axiomKind ?? '',
        restrictionKind: edge.restrictionKind ?? '',
      },
    })),
  ];
}

function normalizeViewOptions(viewOptions) {
  return {
    projectionMode: viewOptions?.projectionMode === 'kg' ? 'kg' : 'ontology',
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

function shouldIncludeStandaloneNode(node, graphData, options) {
  if (!node) {
    return false;
  }

  // Literal nodes should only appear through visible literal edges, never as standalone nodes.
  if (node.termType === 'Literal') {
    return false;
  }

  if (node.termType === 'BlankNode') {
    return false;
  }

  // Do not duplicate class representation: if a class is already rendered as a badge on
  // instance nodes, hide the standalone class node in all projections.
  if (graphData.badgeClassNodeIds?.has(node.id)) {
    return false;
  }

  if (options.projectionMode === 'kg') {
    if (
      node.entityCategory === 'object-property' ||
      node.entityCategory === 'data-property' ||
      node.entityCategory === 'annotation-property'
    ) {
      return false;
    }
    return true;
  }

  if (!graphData.hasOntology) {
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

  if (node.ontologyKind === 'datatype' || node.entityCategory === 'datatype') {
    return true;
  }

  // KG instances and other named nodes should stay visible even without edges.
  return true;
}

function buildKgProjectionSubset(graphData, focusedNodeIds, options) {
  const visibleNodeIds = new Set();
  const visibleEdges = [];

  const isVisibleKgEntityNode = (nodeId) => {
    const node = graphData.nodeMap.get(nodeId);
    if (!node) {
      return false;
    }

    if (node.termType === 'BlankNode') {
      return false;
    }

    if (
      node.entityCategory === 'object-property' ||
      node.entityCategory === 'data-property' ||
      node.entityCategory === 'annotation-property'
    ) {
      return false;
    }

    if (node.termType === 'Literal') {
      return false;
    }

    if (graphData.badgeClassNodeIds?.has(node.id)) {
      return false;
    }

    return true;
  };

  const isVisibleKgLiteralNode = (nodeId) => {
    const node = graphData.nodeMap.get(nodeId);
    if (!node || node.termType !== 'Literal') {
      return false;
    }

    return options.showDataProperties || options.showAnnotationProperties;
  };

  for (const edge of graphData.objectEdges) {
    if (!shouldIncludeObjectEdge(edge, options)) {
      continue;
    }

    if (edge.predicate === RDF_FIRST || edge.predicate === RDF_REST) {
      continue;
    }

    if (focusedNodeIds && (!focusedNodeIds.has(edge.source) || !focusedNodeIds.has(edge.target))) {
      continue;
    }

    if (!isVisibleKgEntityNode(edge.source) || !isVisibleKgEntityNode(edge.target)) {
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

    if (!isVisibleKgEntityNode(edge.source) || !isVisibleKgLiteralNode(edge.target)) {
      continue;
    }

    visibleEdges.push(edge);
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }

  const candidateNodes = focusedNodeIds
    ? graphData.nodes.filter((node) => focusedNodeIds.has(node.id))
    : graphData.nodes;

  for (const node of candidateNodes) {
    if (!isVisibleKgEntityNode(node.id)) {
      continue;
    }
    visibleNodeIds.add(node.id);
  }

  const nodes = graphData.nodes.filter((node) => visibleNodeIds.has(node.id));
  return toElements(nodes, visibleEdges);
}

export function buildFocusedSubset(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  if (!graphData) {
    return [];
  }

  if (focusedNodeIds && focusedNodeIds.size === 0) {
    return [];
  }

  const options = normalizeViewOptions(viewOptions);
  const effectiveFocusedNodeIds =
    focusedNodeIds && graphData.hasOntology && graphData.hasKg && options.projectionMode === 'kg'
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

  if (options.projectionMode === 'kg') {
    return buildKgProjectionSubset(graphData, effectiveFocusedNodeIds, options);
  }

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
      return node.entityCategory !== 'class-expression';
    }

    return node.termType === 'NamedNode' && node.iri === RDF_NIL;
  };
  const isNamedIndividualVisible = (nodeId) =>
    options.showNamedIndividuals || !graphData.namedIndividualNodeIds.has(nodeId);
  const isOntologyObjectPropertyNodeVisible = (nodeId) => {
    const node = graphData.nodeMap.get(nodeId);
    if (!node) {
      return false;
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

    return true;
  };

  for (const edge of graphData.objectEdges) {
    if (graphData.badgeClassNodeIds?.has(edge.source) || graphData.badgeClassNodeIds?.has(edge.target)) {
      continue;
    }

    if (edge.category === 'type') {
      if (!options.showTypeLinks) {
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

    const sourceIsClassLike =
      graphData.classNodeIds.has(edge.source) || graphData.blankExpressionNodeIds?.has(edge.source);
    const targetIsClassLike =
      graphData.classNodeIds.has(edge.target) || graphData.blankExpressionNodeIds?.has(edge.target);

    if (edge.category === 'subclass' && (!sourceIsClassLike || !targetIsClassLike)) {
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
    if (graphData.badgeClassNodeIds?.has(edge.source) || graphData.badgeClassNodeIds?.has(edge.target)) {
      continue;
    }

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
      if (graphData.badgeClassNodeIds?.has(classNodeId)) {
        continue;
      }
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
    if (!shouldIncludeStandaloneNode(node, graphData, options)) {
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
