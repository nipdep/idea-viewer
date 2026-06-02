import { buildFocusedSubset, compactIri, DEFAULT_VIEW_OPTIONS, getNodeStatementBuckets, getTermId } from './rdf';

export const GRAPH_VIEW_MODES = Object.freeze({
  OWL: 'owl',
  RDF: 'rdf',
});

const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment';
const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';
const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const RDFS_SUBPROPERTY_OF = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
const RDF_SEQ = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Seq';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_ALL_VALUES_FROM = 'http://www.w3.org/2002/07/owl#allValuesFrom';
const OWL_ANNOTATION_PROPERTY = 'http://www.w3.org/2002/07/owl#AnnotationProperty';
const OWL_IMPORTS = 'http://www.w3.org/2002/07/owl#imports';
const OWL_COMPLEMENT_OF = 'http://www.w3.org/2002/07/owl#complementOf';
const OWL_CARDINALITY = 'http://www.w3.org/2002/07/owl#cardinality';
const OWL_DATATYPE_PROPERTY = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_DIFFERENT_FROM = 'http://www.w3.org/2002/07/owl#differentFrom';
const OWL_DISJOINT_WITH = 'http://www.w3.org/2002/07/owl#disjointWith';
const OWL_DISJOINT_UNION_OF = 'http://www.w3.org/2002/07/owl#disjointUnionOf';
const OWL_EQUIVALENT_CLASS = 'http://www.w3.org/2002/07/owl#equivalentClass';
const OWL_EQUIVALENT_PROPERTY = 'http://www.w3.org/2002/07/owl#equivalentProperty';
const OWL_FUNCTIONAL_PROPERTY = 'http://www.w3.org/2002/07/owl#FunctionalProperty';
const OWL_ASYMMETRIC_PROPERTY = 'http://www.w3.org/2002/07/owl#AsymmetricProperty';
const OWL_IRREFLEXIVE_PROPERTY = 'http://www.w3.org/2002/07/owl#IrreflexiveProperty';
const OWL_HAS_SELF = 'http://www.w3.org/2002/07/owl#hasSelf';
const OWL_HAS_KEY = 'http://www.w3.org/2002/07/owl#hasKey';
const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';
const OWL_INVERSE_OF = 'http://www.w3.org/2002/07/owl#inverseOf';
const OWL_INVERSE_FUNCTIONAL_PROPERTY = 'http://www.w3.org/2002/07/owl#InverseFunctionalProperty';
const OWL_INTERSECTION_OF = 'http://www.w3.org/2002/07/owl#intersectionOf';
const OWL_MAX_CARDINALITY = 'http://www.w3.org/2002/07/owl#maxCardinality';
const OWL_MAX_QUALIFIED_CARDINALITY = 'http://www.w3.org/2002/07/owl#maxQualifiedCardinality';
const OWL_MIN_CARDINALITY = 'http://www.w3.org/2002/07/owl#minCardinality';
const OWL_MIN_QUALIFIED_CARDINALITY = 'http://www.w3.org/2002/07/owl#minQualifiedCardinality';
const OWL_ONE_OF = 'http://www.w3.org/2002/07/owl#oneOf';
const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_ON_CLASS = 'http://www.w3.org/2002/07/owl#onClass';
const OWL_ON_DATA_RANGE = 'http://www.w3.org/2002/07/owl#onDataRange';
const OWL_ON_DATATYPE = 'http://www.w3.org/2002/07/owl#onDatatype';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_QUALIFIED_CARDINALITY = 'http://www.w3.org/2002/07/owl#qualifiedCardinality';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ALL_DIFFERENT = 'http://www.w3.org/2002/07/owl#AllDifferent';
const OWL_ALL_DISJOINT_CLASSES = 'http://www.w3.org/2002/07/owl#AllDisjointClasses';
const OWL_AXIOM = 'http://www.w3.org/2002/07/owl#Axiom';
const OWL_ANNOTATED_SOURCE = 'http://www.w3.org/2002/07/owl#annotatedSource';
const OWL_ANNOTATED_PROPERTY = 'http://www.w3.org/2002/07/owl#annotatedProperty';
const OWL_ANNOTATED_TARGET = 'http://www.w3.org/2002/07/owl#annotatedTarget';
const OWL_DISTINCT_MEMBERS = 'http://www.w3.org/2002/07/owl#distinctMembers';
const OWL_MEMBERS = 'http://www.w3.org/2002/07/owl#members';
const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs';
const OWL_SOME_VALUES_FROM = 'http://www.w3.org/2002/07/owl#someValuesFrom';
const OWL_REFLEXIVE_PROPERTY = 'http://www.w3.org/2002/07/owl#ReflexiveProperty';
const OWL_SYMMETRIC_PROPERTY = 'http://www.w3.org/2002/07/owl#SymmetricProperty';
const OWL_TRANSITIVE_PROPERTY = 'http://www.w3.org/2002/07/owl#TransitiveProperty';
const OWL_UNION_OF = 'http://www.w3.org/2002/07/owl#unionOf';
const OWL_VERSION_IRI = 'http://www.w3.org/2002/07/owl#versionIRI';
const OWL_VERSION_INFO = 'http://www.w3.org/2002/07/owl#versionInfo';
const OWL_WITH_RESTRICTIONS = 'http://www.w3.org/2002/07/owl#withRestrictions';
const PROV_WAS_DERIVED_FROM = 'http://www.w3.org/ns/prov#wasDerivedFrom';
const DCT_SOURCE = 'http://purl.org/dc/terms/source';
const RDF_STATEMENT = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Statement';
const RDF_SUBJECT = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#subject';
const RDF_PREDICATE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate';
const RDF_OBJECT = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#object';

const METADATA_PREDICATES = new Set([
  RDFS_LABEL,
  RDFS_COMMENT,
  'http://www.w3.org/2004/02/skos/core#prefLabel',
  'http://schema.org/name',
  'http://xmlns.com/foaf/0.1/name',
  OWL_IMPORTS,
  OWL_VERSION_IRI,
  OWL_VERSION_INFO,
  PROV_WAS_DERIVED_FROM,
  DCT_SOURCE,
]);

const PROPERTY_CHARACTERISTIC_PREFIXES = new Map([
  [OWL_FUNCTIONAL_PROPERTY, 'F'],
  [OWL_INVERSE_FUNCTIONAL_PROPERTY, 'IF'],
  [OWL_TRANSITIVE_PROPERTY, 'T'],
  [OWL_SYMMETRIC_PROPERTY, 'S'],
  [OWL_ASYMMETRIC_PROPERTY, 'AS'],
  [OWL_IRREFLEXIVE_PROPERTY, 'IR'],
  [OWL_REFLEXIVE_PROPERTY, 'R'],
]);

const PROPERTY_CHARACTERISTIC_CLASS_IDS = new Set([
  OWL_FUNCTIONAL_PROPERTY,
  OWL_INVERSE_FUNCTIONAL_PROPERTY,
  OWL_IRREFLEXIVE_PROPERTY,
  OWL_REFLEXIVE_PROPERTY,
  OWL_TRANSITIVE_PROPERTY,
  OWL_SYMMETRIC_PROPERTY,
]);

const RESTRICTION_VALUE_PREDICATES = new Set([
  OWL_SOME_VALUES_FROM,
  OWL_ALL_VALUES_FROM,
  OWL_HAS_VALUE,
  OWL_ON_CLASS,
  OWL_ON_DATA_RANGE,
]);

const RESTRICTION_CARDINALITY_PREDICATES = new Set([
  OWL_MIN_CARDINALITY,
  OWL_MAX_CARDINALITY,
  OWL_CARDINALITY,
  OWL_MIN_QUALIFIED_CARDINALITY,
  OWL_MAX_QUALIFIED_CARDINALITY,
  OWL_QUALIFIED_CARDINALITY,
]);

const EXPRESSION_PREDICATES = new Set([OWL_INTERSECTION_OF, OWL_UNION_OF, OWL_ONE_OF, OWL_COMPLEMENT_OF]);

function cloneElement(element) {
  return {
    ...element,
    data: {
      ...element.data,
    },
  };
}

function suppressMetadataEdges(elements) {
  return elements.filter((element) => {
    const predicate = element?.data?.predicate;
    return !predicate || !METADATA_PREDICATES.has(predicate);
  });
}

function relationPaletteCategory(predicate) {
  if (
    predicate &&
    (predicate.startsWith(RDF_NS) || predicate.startsWith('http://www.w3.org/2000/01/rdf-schema#') || predicate.startsWith('http://www.w3.org/2002/07/owl#'))
  ) {
    return 'base';
  }
  return 'property';
}

function applyRelationPalette(elements) {
  return elements.map((element) => {
    const data = element?.data;
    if (!data?.source || !data.predicate) {
      return element;
    }
    const next = cloneElement(element);
    next.data.paletteCategory = relationPaletteCategory(data.predicate);
    return next;
  });
}

function applyRdfLabels(elements) {
  return elements.map((element) => {
    if (element?.data?.source) {
      return element;
    }

    const next = cloneElement(element);
    const { data } = next;
    if (data.termType === 'Literal') {
      const literalLabel = data.literalValue || data.fullLabel || data.label || '';
      data.label = literalLabel;
      data.fullLabel = literalLabel;
      return next;
    }

    if (data.termType === 'NamedNode') {
      const compact = compactIri(data.iri || data.id || '');
      if (compact) {
        data.label = compact;
        data.fullLabel = compact;
      }
    }

    return next;
  });
}

function computeSelfLoopStepSize(node) {
  const width = Number(node?.nodeWidth ?? 0);
  const height = Number(node?.nodeHeight ?? 0);
  if (!width && !height) {
    return 42;
  }

  const widthDriven = width * 0.4;
  const heightDriven = height * 0.2;
  return Math.max(42, Math.min(110, Math.round(Math.max(widthDriven, heightDriven))));
}

function applySelfLoopGeometry(graphData, elements) {
  return elements.map((element) => {
    const data = element?.data;
    if (!data?.source || (data.isSelfLoop !== 1 && data.source !== data.target)) {
      return element;
    }

    const sourceNode = graphData?.nodeMap?.get(data.source);
    const next = cloneElement(element);
    next.data.isSelfLoop = 1;
    next.data.selfLoopStepSize = computeSelfLoopStepSize(sourceNode);
    return next;
  });
}

function connectorHoverLabel(data) {
  const statementText = String(data?.connectorAxiomText || '').trim();
  if (statementText) {
    return statementText;
  }

  const blankExpressionType = String(data?.blankExpressionType || '');
  if (blankExpressionType === 'Intersection') {
    return 'Intersection';
  }
  if (blankExpressionType === 'Union') {
    return 'Union';
  }
  if (blankExpressionType === 'Complement') {
    return 'Complement';
  }
  if (blankExpressionType === 'OneOf') {
    return 'Enumeration';
  }
  if (data?.entityCategory === 'all-different' && data?.label === '≠') {
    return 'AllDifferent';
  }
  if (data?.entityCategory === 'all-different' && data?.label === '≢') {
    return 'AllDisjointClasses';
  }
  if (data?.entityCategory === 'all-different' && data?.label === '⊎') {
    return 'DisjointUnion';
  }
  return data?.fullLabel || data?.label || '';
}

function findProcessedStatements(graphData, nodeIds, predicateFilter = null, textIncludes = []) {
  const seen = new Set();
  const rows = [];

  for (const nodeId of nodeIds) {
    const buckets = getNodeStatementBuckets(graphData, nodeId);
    for (const row of buckets.processed) {
      if (seen.has(row.id)) {
        continue;
      }
      if (predicateFilter && !predicateFilter.has(row.predicateId)) {
        continue;
      }
      if (textIncludes.length > 0 && !textIncludes.every((needle) => row.manchester.includes(needle))) {
        continue;
      }
      seen.add(row.id);
      rows.push(row.manchester);
    }
  }

  return rows;
}

function manchesterNodeText(graphData, nodeId) {
  const node = graphData?.nodeMap?.get(nodeId);
  if (!node) {
    return compactIri(nodeId);
  }
  return compactIri(node.iri || node.id || node.fullLabel || node.label || nodeId);
}

function relationManchesterKeyword(predicate) {
  if (predicate === RDFS_SUBCLASS_OF) {
    return 'SubClassOf';
  }
  if (predicate === OWL_EQUIVALENT_CLASS) {
    return 'EquivalentTo';
  }
  if (predicate === OWL_DISJOINT_WITH) {
    return 'DisjointWith';
  }
  return compactIri(predicate);
}

function expressionMembersManchester(graphData, memberIds, operator) {
  return memberIds.map((memberId) => manchesterNodeText(graphData, memberId)).join(` ${operator} `);
}

function edgeHoverText(graphData, data) {
  const defaultText = data?.predicateLabel || compactIri(data?.predicate) || '';
  if (!data?.source) {
    return defaultText;
  }

  const compactPredicate = compactIri(data.predicate);
  const sourceBuckets = getNodeStatementBuckets(graphData, data.source);
  const predicateBuckets = getNodeStatementBuckets(graphData, data.predicate);

  if (data.axiomKind === 'Restriction' || data.axiomKind === 'ClassExpressionRestriction') {
    const matches = sourceBuckets.processed.filter(
      (row) =>
        row.predicateId !== RDFS_DOMAIN &&
        row.predicateId !== RDFS_RANGE &&
        (row.predicateId === data.predicate || row.manchester.includes(compactPredicate)),
    );
    if (matches.length > 0) {
      return matches.map((row) => row.manchester).join('\n');
    }
  }

  const directSourceMatches = sourceBuckets.processed.filter(
    (row) =>
      row.predicateId === data.predicate &&
      (!data.target || !row.targetId || row.targetId === data.target),
  );
  if (directSourceMatches.length > 0) {
    return directSourceMatches.map((row) => row.manchester).join('\n');
  }

  const directPredicateMatches = predicateBuckets.processed.filter(
    (row) =>
      row.predicateId !== RDFS_DOMAIN &&
      row.predicateId !== RDFS_RANGE &&
      (!data.target || !row.targetId || row.targetId === data.target),
  );
  if (directPredicateMatches.length > 0) {
    return directPredicateMatches.map((row) => row.manchester).join('\n');
  }

  return defaultText;
}

function applyHoverMetadata(graphData, elements) {
  return elements.map((element) => {
    const data = element?.data;
    if (!data) {
      return element;
    }

    const next = cloneElement(element);
    if (data.source) {
      next.data.hoverText = edgeHoverText(graphData, data);
      return next;
    }

    if (data.owlExpressionNode || data.entityCategory === 'all-different') {
      next.data.hoverText = connectorHoverLabel(data);
      return next;
    }

    const buckets = getNodeStatementBuckets(graphData, data.id);
    const hoverStatements =
      data.ontologyKind === 'object-property' || data.ontologyKind === 'data-property' || data.ontologyKind === 'annotation-property'
        ? buckets.processed.filter((row) => row.predicateId !== RDFS_DOMAIN && row.predicateId !== RDFS_RANGE)
        : buckets.processed;
    if (hoverStatements.length > 0) {
      next.data.hoverText = hoverStatements.map((row) => row.manchester).join('\n');
    } else {
      next.data.hoverText = data.fullLabel || data.label || '';
    }
    return next;
  });
}

function collectPropertyDeclarations(graphData) {
  const declarations = new Map();
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);

  for (const node of graphData?.nodes ?? []) {
    if (
      node.ontologyKind !== 'object-property' &&
      node.ontologyKind !== 'data-property' &&
      node.ontologyKind !== 'annotation-property'
    ) {
      continue;
    }

    declarations.set(node.id, {
      propertyId: node.id,
      propertyKind: node.ontologyKind,
      label: node.fullLabel || compactIri(node.iri || node.id),
      domains: new Set(),
      ranges: new Set(),
      characteristics: [],
    });
  }

  for (const edge of graphData?.objectEdges ?? []) {
    const declaration = declarations.get(edge.source);
    if (!declaration) {
      continue;
    }

    if (edge.predicate === RDFS_DOMAIN) {
      declaration.domains.add(edge.target);
    } else if (edge.predicate === RDFS_RANGE) {
      declaration.ranges.add(edge.target);
    }
  }

  for (const declaration of declarations.values()) {
    const outgoing = outgoingBySource.get(declaration.propertyId) ?? [];
    const characteristicTokens = [];
    for (const edge of outgoing) {
      if (edge.predicate !== RDF_TYPE) {
        continue;
      }
      const token = PROPERTY_CHARACTERISTIC_PREFIXES.get(edge.target);
      if (token && !characteristicTokens.includes(token)) {
        characteristicTokens.push(token);
      }
    }
    declaration.characteristics = characteristicTokens;
  }

  return declarations;
}

function makeHelperNodeData(id) {
  return {
    id,
    label: '',
    fullLabel: '',
    iri: '',
    baseIri: '',
    kind: 'blank',
    ontologyKind: '',
    entityCategory: 'owl-helper',
    blankExpressionType: '',
    restrictionKind: '',
    restrictionTooltip: '',
    graphRole: 'owl-helper',
    isInstanceNode: 0,
    isOntologyNode: 0,
    mixedMode: 0,
    termType: 'BlankNode',
    literalValue: '',
    literalDatatype: '',
    literalLanguage: '',
    labelLength: 0,
    nodeWidth: 8,
    nodeHeight: 8,
    textMaxWidth: 8,
    hasClass: 0,
    classCount: 0,
    classBadge: '',
    badgeSvg: '',
    badgeWidth: 0,
    classTooltip: '',
    lightOntologyView: 0,
    owlHelper: 1,
  };
}

function makeEdgeAnchorNodeData(id) {
  return {
    ...makeHelperNodeData(id),
    entityCategory: 'edge-anchor',
    graphRole: 'edge-anchor',
    edgeAnchor: 1,
    anchoredEdgeId: '',
    anchoredSourceId: '',
    anchoredTargetId: '',
  };
}

function makeNodeElementFromGraphNode(node) {
  if (!node) {
    return null;
  }

  return {
    data: {
      ...node,
      id: node.id,
      label: node.displayLabel,
      fullLabel: node.fullLabel,
      iri: node.iri,
      baseIri: node.baseIri ?? '',
      kind: node.kind,
      ontologyKind: node.ontologyKind ?? '',
      entityCategory: node.entityCategory ?? '',
      blankExpressionType: node.blankExpressionType ?? '',
      restrictionKind: node.restrictionKind ?? '',
      restrictionTooltip: node.restrictionTooltip ?? '',
      graphRole: node.graphRole ?? '',
      isInstanceNode: node.isInstanceNode ?? 0,
      isOntologyNode: node.isOntologyNode ?? 0,
      mixedMode: node.mixedMode ?? 0,
      termType: node.termType,
      literalValue: node.literalValue ?? '',
      literalDatatype: node.literalDatatype ?? '',
      literalLanguage: node.literalLanguage ?? '',
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
  };
}

function makeExpressionNodeData(id, label, expressionKind) {
  return {
    id,
    label,
    fullLabel: label,
    iri: '',
    baseIri: '',
    kind: 'blank',
    ontologyKind: '',
    entityCategory: 'owl-expression',
    blankExpressionType: expressionKind,
    restrictionKind: '',
    restrictionTooltip: '',
    graphRole: 'owl-expression',
    isInstanceNode: 0,
    isOntologyNode: 0,
    mixedMode: 0,
    termType: 'BlankNode',
    literalValue: '',
    literalDatatype: '',
    literalLanguage: '',
    labelLength: Math.max(label.length, 1),
    nodeWidth: expressionKind === 'Complement' ? 34 : 30,
    nodeHeight: expressionKind === 'Complement' ? 34 : 30,
    textMaxWidth: 28,
    hasClass: 0,
    classCount: 0,
    classBadge: '',
    badgeSvg: '',
    badgeWidth: 0,
    classTooltip: '',
    lightOntologyView: 0,
    owlExpressionNode: 1,
  };
}

function makeGroupNodeData(id, label, groupKind, size = 2) {
  return {
    id,
    label,
    fullLabel: label,
    iri: '',
    baseIri: '',
    kind: 'blank',
    ontologyKind: '',
    entityCategory: 'owl-group',
    blankExpressionType: groupKind,
    restrictionKind: '',
    restrictionTooltip: '',
    graphRole: 'owl-group',
    isInstanceNode: 0,
    isOntologyNode: 0,
    mixedMode: 0,
    termType: 'BlankNode',
    literalValue: '',
    literalDatatype: '',
    literalLanguage: '',
    labelLength: Math.max(label.length, 1),
    nodeWidth: Math.max(120, 82 + size * 18),
    nodeHeight: Math.max(70, 48 + size * 12),
    textMaxWidth: 180,
    hasClass: 0,
    classCount: 0,
    classBadge: '',
    badgeSvg: '',
    badgeWidth: 0,
    classTooltip: '',
    lightOntologyView: 0,
    owlGroupNode: 1,
  };
}

function makeNamedGroupNodeData(id, label, groupKind, size = 2) {
  return {
    ...makeGroupNodeData(id, label, groupKind, size),
    owlNamedGroupNode: 1,
    nodeWidth: Math.max(130, 90 + size * 18),
    nodeHeight: Math.max(78, 56 + size * 12),
  };
}

function makeAxiomMarkerNodeData(id, label) {
  return {
    ...makeExpressionNodeData(id, label, 'AxiomMarker'),
    entityCategory: 'all-different',
    graphRole: 'owl-axiom-marker',
    nodeWidth: 42,
    nodeHeight: 42,
    textMaxWidth: 36,
  };
}

function buildOutgoingEdgeIndex(graphData) {
  const outgoing = new Map();

  for (const edge of graphData?.objectEdges ?? []) {
    const rows = outgoing.get(edge.source) ?? [];
    rows.push(edge);
    outgoing.set(edge.source, rows);
  }

  return outgoing;
}

function readListMembers(startId, outgoingBySource) {
  if (!startId || startId === RDF_NIL) {
    return [];
  }

  const members = [];
  const visited = new Set();
  let currentId = startId;

  while (currentId && currentId !== RDF_NIL && !visited.has(currentId)) {
    visited.add(currentId);
    const edges = outgoingBySource.get(currentId) ?? [];
    const firstEdge = edges.find((edge) => edge.predicate === RDF_FIRST);
    if (firstEdge) {
      members.push(firstEdge.target);
    }
    const restEdge = edges.find((edge) => edge.predicate === RDF_REST);
    if (!restEdge) {
      break;
    }
    currentId = restEdge.target;
  }

  return members;
}

function buildIncomingEdgeIndex(graphData) {
  const incoming = new Map();

  for (const edge of graphData?.objectEdges ?? []) {
    const rows = incoming.get(edge.target) ?? [];
    rows.push(edge);
    incoming.set(edge.target, rows);
  }

  return incoming;
}

function buildOutgoingAllEdgeIndex(graphData) {
  const outgoing = new Map();

  for (const edge of [...(graphData?.objectEdges ?? []), ...(graphData?.literalEdges ?? [])]) {
    const rows = outgoing.get(edge.source) ?? [];
    rows.push(edge);
    outgoing.set(edge.source, rows);
  }

  return outgoing;
}

function buildOutgoingLiteralEdgeIndex(graphData) {
  const outgoing = new Map();

  for (const edge of graphData?.literalEdges ?? []) {
    const rows = outgoing.get(edge.source) ?? [];
    rows.push(edge);
    outgoing.set(edge.source, rows);
  }

  return outgoing;
}

function formatPropertyLabelWithCharacteristics(baseLabel, declaration) {
  const suffixes = declaration?.characteristics ?? [];
  if (suffixes.length === 0) {
    return baseLabel;
  }
  return `${baseLabel} [${suffixes.join(',')}]`;
}

function nodeLabel(graphData, nodeId) {
  const node = graphData?.nodeMap?.get(nodeId);
  return node?.fullLabel || compactIri(nodeId);
}

function summarizeRestrictionFacetNode(graphData, facetNodeId, outgoingAllBySource) {
  const outgoing = outgoingAllBySource.get(facetNodeId) ?? [];
  return outgoing
    .map((edge) => `${compactIri(edge.predicate)}=${graphData.nodeMap.get(edge.target)?.fullLabel || compactIri(edge.target)}`)
    .join(', ');
}

function toCardinalityMarker(predicate, value) {
  const numeric = String(value || '').trim();
  if (!numeric) {
    return '';
  }
  if (predicate === OWL_MIN_CARDINALITY || predicate === OWL_MIN_QUALIFIED_CARDINALITY) {
    return `${numeric}..*`;
  }
  if (predicate === OWL_MAX_CARDINALITY || predicate === OWL_MAX_QUALIFIED_CARDINALITY) {
    return `0..${numeric}`;
  }
  if (predicate === OWL_CARDINALITY || predicate === OWL_QUALIFIED_CARDINALITY) {
    return numeric;
  }
  return '';
}

function isTruthyBooleanLiteral(graphData, nodeId) {
  const node = graphData?.nodeMap?.get(nodeId);
  if (!node || node.termType !== 'Literal') {
    return false;
  }
  const rawValue = String(node.literalValue || node.fullLabel || node.label || '').trim().toLowerCase();
  return rawValue === 'true' || rawValue === '1';
}

function restrictionPredicatePrefix(predicate) {
  if (predicate === OWL_SOME_VALUES_FROM) {
    return '(some) ';
  }
  if (predicate === OWL_ALL_VALUES_FROM) {
    return '(all) ';
  }
  return '';
}

function restrictionPredicateSuffix(predicate) {
  return '';
}

function stripRelationDecorationSuffixes(label) {
  return String(label || '').replace(/(?:\*|\.\.)+$/u, '').trimEnd();
}

function decorateRelationLabel(label, { isRestriction = false, hasDetailRows = false } = {}) {
  const baseLabel = stripRelationDecorationSuffixes(label);
  return `${baseLabel}${isRestriction ? '*' : ''}${hasDetailRows ? '..' : ''}`;
}

function buildRestrictionTargetSpecs(graphData, restrictionNodeId, visibleNodeIds, propertyDeclarations) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const outgoingAllBySource = buildOutgoingAllEdgeIndex(graphData);
  const outgoingLiteralBySource = buildOutgoingLiteralEdgeIndex(graphData);
  const outgoing = outgoingBySource.get(restrictionNodeId) ?? [];
  const outgoingLiteral = outgoingLiteralBySource.get(restrictionNodeId) ?? [];
  const onPropertyEdge = outgoing.find((edge) => edge.predicate === OWL_ON_PROPERTY);
  if (!onPropertyEdge) {
    return null;
  }

  const propertyDeclaration = propertyDeclarations.get(onPropertyEdge.target);
  const propertyBaseLabel =
    formatPropertyLabelWithCharacteristics(
      propertyDeclaration?.label || graphData.nodeMap.get(onPropertyEdge.target)?.fullLabel || compactIri(onPropertyEdge.target),
      propertyDeclaration,
    );

  const targetObjectEdges = outgoing.filter((edge) => RESTRICTION_VALUE_PREDICATES.has(edge.predicate));
  const targetLiteralEdges = outgoingLiteral.filter((edge) => RESTRICTION_CARDINALITY_PREDICATES.has(edge.predicate));
  const hasSelfEdge = outgoingLiteral.find((edge) => edge.predicate === OWL_HAS_SELF);
  const cardinalityMarkers = targetLiteralEdges
    .map((edge) => {
      const literalNode = graphData.nodeMap.get(edge.target);
      return toCardinalityMarker(edge.predicate, literalNode?.fullLabel || literalNode?.literalValue || '');
    })
    .filter(Boolean);
  const combinedCardinality = cardinalityMarkers[0] ?? '';

  const targetSpecs = [];
  const hiddenNodeIds = new Set();
  const supplementalNodes = [];
  const supplementalNodeIds = new Set();
  for (const edge of targetObjectEdges) {
    const targetNode = graphData.nodeMap.get(edge.target);
    const targetOutgoing = outgoingAllBySource.get(edge.target) ?? [];
    const onDatatypeEdge = targetOutgoing.find((row) => row.predicate === OWL_ON_DATATYPE);
    const withRestrictionsEdge = targetOutgoing.find((row) => row.predicate === OWL_WITH_RESTRICTIONS);
    if (targetNode?.termType === 'BlankNode' && onDatatypeEdge) {
      hiddenNodeIds.add(edge.target);
      const restrictionMembers = withRestrictionsEdge
        ? readListMembers(withRestrictionsEdge.target, outgoingBySource).map((id) => summarizeRestrictionFacetNode(graphData, id, outgoingAllBySource))
        : [];
      const datatypeTargetId = onDatatypeEdge.target;
      if (!visibleNodeIds.has(datatypeTargetId)) {
        const datatypeNode = graphData.nodeMap.get(datatypeTargetId);
        const datatypeElement = datatypeNode
          ? {
              data: {
                ...makeNodeElementFromGraphNode(datatypeNode)?.data,
                entityCategory: 'datatype',
                ontologyKind: 'datatype',
              },
            }
          : null;
        if (datatypeElement) {
          supplementalNodes.push(datatypeElement);
          supplementalNodeIds.add(datatypeTargetId);
        }
      }
      targetSpecs.push({
        targetId: datatypeTargetId,
        predicate: edge.predicate,
        sourceCardinality: combinedCardinality,
        forceStarSuffix: true,
        projectedMetadataRows:
          restrictionMembers.length > 0
            ? [
                {
                  key: 'owl:withRestrictions',
                  value: `(${restrictionMembers.join(' ; ')})`,
                },
              ]
            : [],
      });
      continue;
    }

    targetSpecs.push({
      targetId: edge.target,
      predicate: edge.predicate,
      sourceCardinality: combinedCardinality,
      projectedMetadataRows: [],
    });
  }
  if (targetObjectEdges.length === 0 && combinedCardinality && propertyDeclaration?.ranges?.size > 0) {
    const inferredRangeTargets = Array.from(propertyDeclaration.ranges).filter((targetId) => visibleNodeIds.has(targetId));
    for (const targetId of inferredRangeTargets) {
      targetSpecs.push({
        targetId,
        predicate: targetLiteralEdges[0]?.predicate || OWL_CARDINALITY,
        sourceCardinality: combinedCardinality,
        projectedMetadataRows: [],
      });
    }
  }
  if (hasSelfEdge && isTruthyBooleanLiteral(graphData, hasSelfEdge.target)) {
    targetSpecs.push({
      targetId: '__self__',
      predicate: OWL_HAS_SELF,
      sourceCardinality: '',
      isSelfLoop: true,
      projectedMetadataRows: [],
    });
  }

  return {
    onPropertyId: onPropertyEdge.target,
    propertyKind: propertyDeclaration?.propertyKind ?? 'object-property',
    propertyBaseLabel,
    restrictionKind: graphData.nodeMap.get(restrictionNodeId)?.restrictionKind || '',
    targetSpecs,
    hiddenNodeIds,
    supplementalNodes,
    supplementalNodeIds,
  };
}

function synthesizeRestrictionProjection(graphData, visibleNodeIds, propertyDeclarations) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const incomingByTarget = buildIncomingEdgeIndex(graphData);
  const outgoingLiteralBySource = buildOutgoingLiteralEdgeIndex(graphData);
  const synthesizedEdges = [];
  const synthesizedNodes = [];
  const hiddenNodeIds = new Set();

  for (const node of graphData?.nodes ?? []) {
    const isRestrictionNode =
      node.termType === 'BlankNode' &&
      (node.blankExpressionType === 'Restriction' || node.restrictionKind || node.iri === OWL_RESTRICTION);
    if (!isRestrictionNode) {
      continue;
    }

    const outgoing = outgoingBySource.get(node.id) ?? [];
    const outgoingLiteral = outgoingLiteralBySource.get(node.id) ?? [];
    const incoming = incomingByTarget.get(node.id) ?? [];
    const onPropertyEdge = outgoing.find((edge) => edge.predicate === OWL_ON_PROPERTY);
    if (!onPropertyEdge) {
      continue;
    }

    hiddenNodeIds.add(node.id);
    const propertyDeclaration = propertyDeclarations.get(onPropertyEdge.target);
    const anchorEdges = incoming.filter(
      (edge) =>
        edge.predicate === RDFS_SUBCLASS_OF ||
        edge.predicate === OWL_EQUIVALENT_CLASS ||
        edge.predicate === OWL_DISJOINT_WITH,
    );

    const restrictionProjection = buildRestrictionTargetSpecs(graphData, node.id, visibleNodeIds, propertyDeclarations);
    if (!restrictionProjection) {
      continue;
    }
    const { propertyBaseLabel, targetSpecs, hiddenNodeIds: restrictionHiddenNodeIds, supplementalNodes, supplementalNodeIds } =
      restrictionProjection;
    for (const hiddenNodeId of restrictionHiddenNodeIds) {
      hiddenNodeIds.add(hiddenNodeId);
    }
    synthesizedNodes.push(...supplementalNodes);
    const targetLiteralEdges = outgoingLiteral.filter((edge) => RESTRICTION_CARDINALITY_PREDICATES.has(edge.predicate));
    if (targetSpecs.length === 0) {
      for (const edge of targetLiteralEdges) {
        const literalNode = graphData.nodeMap.get(edge.target);
        const sourceCardinality = toCardinalityMarker(edge.predicate, literalNode?.fullLabel || literalNode?.literalValue || '');
        const helperId = `owl-card:${node.id}:${edge.id}`;
        synthesizedNodes.push({
          data: makeHelperNodeData(helperId),
        });
        targetSpecs.push({
          targetId: helperId,
          predicate: edge.predicate,
          sourceCardinality,
          projectedMetadataRows: [],
        });
        hiddenNodeIds.add(edge.target);
      }
    }

    for (const anchorEdge of anchorEdges) {
      if (!visibleNodeIds.has(anchorEdge.source)) {
        continue;
      }
      for (const targetSpec of targetSpecs) {
        const resolvedTargetId = targetSpec.targetId === '__self__' ? anchorEdge.source : targetSpec.targetId;
        if (
          !visibleNodeIds.has(resolvedTargetId) &&
          !supplementalNodeIds.has(resolvedTargetId) &&
          !String(resolvedTargetId).startsWith('owl-card:')
        ) {
          continue;
        }
        const basePredicateLabel = targetSpec.forceStarSuffix
          ? propertyBaseLabel
          : `${restrictionPredicatePrefix(targetSpec.predicate)}${propertyBaseLabel}${restrictionPredicateSuffix(targetSpec.predicate)}`;
        const predicateLabel = decorateRelationLabel(basePredicateLabel, {
          isRestriction: true,
          hasDetailRows: Array.isArray(targetSpec.projectedMetadataRows) && targetSpec.projectedMetadataRows.length > 0,
        });
        synthesizedEdges.push({
          data: {
            id: `owl-restr:${node.id}:${anchorEdge.id}:${resolvedTargetId}:${targetSpec.predicate}`,
            source: anchorEdge.source,
            target: resolvedTargetId,
            predicate: onPropertyEdge.target,
            predicateLabel,
            category: propertyDeclaration?.propertyKind === 'data-property' ? 'data' : 'object',
            axiomKind: 'Restriction',
            restrictionKind: graphData.nodeMap.get(node.id)?.restrictionKind || compactIri(targetSpec.predicate),
            sourceCardinality: targetSpec.sourceCardinality,
            showSourceCardinality: targetSpec.sourceCardinality ? 1 : 0,
            owlSynthesized: 1,
            owlEdgeStyle: propertyDeclaration?.propertyKind === 'data-property' ? 'dashed' : 'straight',
            isSelfLoop: resolvedTargetId === anchorEdge.source || targetSpec.isSelfLoop ? 1 : 0,
            projectedMetadataRows: targetSpec.projectedMetadataRows,
          },
        });
      }
    }
  }

  return {
    synthesizedNodes,
    synthesizedEdges,
    hiddenNodeIds,
  };
}

function synthesizeCollectionProjection(graphData, visibleNodeIds) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const synthesizedNodes = [];
  const synthesizedEdges = [];
  const hiddenNodeIds = new Set();

  for (const edge of graphData?.objectEdges ?? []) {
    if (EXPRESSION_PREDICATES.has(edge.predicate) || edge.predicate === OWL_DISJOINT_UNION_OF) {
      continue;
    }
    if (!visibleNodeIds.has(edge.source)) {
      continue;
    }
    const targetNode = graphData.nodeMap.get(edge.target);
    if (!targetNode || targetNode.termType !== 'BlankNode' || targetNode.blankExpressionType !== 'List') {
      continue;
    }

    const members = readListMembers(edge.target, outgoingBySource).filter((id) => visibleNodeIds.has(id));
    if (members.length === 0) {
      continue;
    }

    hiddenNodeIds.add(edge.target);
    const groupId = `owl-list:${edge.source}:${edge.target}:${edge.predicate}`;
    synthesizedNodes.push({
      data: makeNamedGroupNodeData(groupId, compactIri(edge.predicate), 'RdfListGroup', members.length),
    });
    synthesizedEdges.push({
      data: {
        id: `${groupId}:source`,
        source: edge.source,
        target: groupId,
        predicate: edge.predicate,
        predicateLabel: compactIri(edge.predicate),
        category: 'object',
        axiomKind: 'Collection',
        owlEdgeStyle: 'dotted',
        owlSynthesized: 1,
      },
    });
    for (const memberId of members) {
      synthesizedEdges.push({
        data: {
          id: `${groupId}:member:${memberId}`,
          source: groupId,
          target: memberId,
          predicate: edge.predicate,
          predicateLabel: '',
          category: 'object',
          axiomKind: 'Collection',
          owlEdgeStyle: 'dotted',
          owlSynthesized: 1,
        },
      });
    }
  }

  const seqNodes = (graphData?.nodes ?? []).filter((node) => node.termType === 'NamedNode' && node.classes?.includes?.(RDF_SEQ));
  const sequencePredicatePattern = new RegExp(`^${RDF_NS}_[0-9]+$`);
  for (const seqNode of seqNodes) {
    if (!visibleNodeIds.has(seqNode.id)) {
      continue;
    }
    const outgoing = outgoingBySource.get(seqNode.id) ?? [];
    const itemEdges = outgoing.filter((edge) => sequencePredicatePattern.test(edge.predicate));
    if (itemEdges.length === 0) {
      continue;
    }
    const groupId = `owl-seq:${seqNode.id}`;
    synthesizedNodes.push({
      data: makeNamedGroupNodeData(groupId, seqNode.fullLabel || compactIri(seqNode.id), 'RdfSeqGroup', itemEdges.length),
    });
    hiddenNodeIds.add(seqNode.id);
    for (const itemEdge of itemEdges) {
      if (!visibleNodeIds.has(itemEdge.target)) {
        continue;
      }
      synthesizedEdges.push({
        data: {
          id: `${groupId}:member:${itemEdge.target}:${itemEdge.predicate}`,
          source: groupId,
          target: itemEdge.target,
          predicate: itemEdge.predicate,
          predicateLabel: compactIri(itemEdge.predicate),
          category: 'object',
          axiomKind: 'Sequence',
          owlEdgeStyle: 'dotted',
          owlSynthesized: 1,
        },
      });
    }
  }

  return {
    synthesizedNodes,
    synthesizedEdges,
    hiddenNodeIds,
  };
}

function synthesizeDisjointAxiomProjection(graphData, visibleNodeIds) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const synthesizedNodes = [];
  const synthesizedEdges = [];
  const hiddenNodeIds = new Set();

  for (const quad of graphData?.quads ?? []) {
    const subjectIsEntity = quad.subject.termType === 'NamedNode' || quad.subject.termType === 'BlankNode';
    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_ALL_DIFFERENT &&
      subjectIsEntity
    ) {
      const sourceId = getTermId(quad.subject);
      const membersEdge = (outgoingBySource.get(sourceId) ?? []).find((row) => row.predicate === OWL_DISTINCT_MEMBERS);
      if (!membersEdge) {
        continue;
      }
      const members = readListMembers(membersEdge.target, outgoingBySource).filter((id) => visibleNodeIds.has(id));
      if (members.length === 0) {
        continue;
      }

      hiddenNodeIds.add(sourceId);
      hiddenNodeIds.add(membersEdge.target);
      const markerId = `owl-all-different:${sourceId}`;
      const markerData = makeAxiomMarkerNodeData(markerId, '≠');
      markerData.connectorAxiomText = `DifferentIndividuals(${members
        .map((memberId) => manchesterNodeText(graphData, memberId))
        .join(', ')})`;
      synthesizedNodes.push({
        data: markerData,
      });
      for (const memberId of members) {
        synthesizedEdges.push({
          data: {
            id: `${markerId}:member:${memberId}`,
            source: memberId,
            target: markerId,
            predicate: OWL_DISTINCT_MEMBERS,
            predicateLabel: '',
            category: 'individual-identity',
            axiomKind: 'AllDifferent',
            owlEdgeStyle: 'dotted',
            owlSynthesized: 1,
          },
        });
      }
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_ALL_DISJOINT_CLASSES &&
      subjectIsEntity
    ) {
      const sourceId = getTermId(quad.subject);
      const membersEdge = (outgoingBySource.get(sourceId) ?? []).find((row) => row.predicate === OWL_MEMBERS);
      if (!membersEdge) {
        continue;
      }
      const members = readListMembers(membersEdge.target, outgoingBySource).filter((id) => visibleNodeIds.has(id));
      if (members.length === 0) {
        continue;
      }

      hiddenNodeIds.add(sourceId);
      hiddenNodeIds.add(membersEdge.target);
      const markerId = `owl-all-disjoint-classes:${sourceId}`;
      const markerData = makeAxiomMarkerNodeData(markerId, '≢');
      markerData.connectorAxiomText = `DisjointClasses(${members
        .map((memberId) => manchesterNodeText(graphData, memberId))
        .join(', ')})`;
      synthesizedNodes.push({
        data: markerData,
      });
      for (const memberId of members) {
        synthesizedEdges.push({
          data: {
            id: `${markerId}:member:${memberId}`,
            source: memberId,
            target: markerId,
            predicate: OWL_MEMBERS,
            predicateLabel: '',
            category: 'class-axiom',
            axiomKind: 'AllDisjointClasses',
            owlEdgeStyle: 'dotted',
            owlSynthesized: 1,
          },
        });
      }
    }
  }

  for (const edge of graphData?.objectEdges ?? []) {
    if (edge.predicate !== OWL_DISJOINT_UNION_OF || !visibleNodeIds.has(edge.source)) {
      continue;
    }

    const members = readListMembers(edge.target, outgoingBySource).filter((id) => visibleNodeIds.has(id));
    if (members.length === 0) {
      continue;
    }

    hiddenNodeIds.add(edge.target);
    const markerId = `owl-disjoint-union:${edge.source}:${edge.target}`;
    const markerData = makeAxiomMarkerNodeData(markerId, '⊎');
    markerData.connectorAxiomText = `${manchesterNodeText(graphData, edge.source)} DisjointUnionOf ${expressionMembersManchester(
      graphData,
      members,
      'or',
    )}`;
    synthesizedNodes.push({
      data: markerData,
    });
    synthesizedEdges.push({
      data: {
        id: `${markerId}:source`,
        source: edge.source,
        target: markerId,
        predicate: OWL_DISJOINT_UNION_OF,
        predicateLabel: '',
        category: 'class-axiom',
        axiomKind: 'DisjointUnion',
        owlEdgeStyle: 'dotted',
        owlSynthesized: 1,
      },
    });
    for (const memberId of members) {
      synthesizedEdges.push({
        data: {
          id: `${markerId}:member:${memberId}`,
          source: markerId,
          target: memberId,
          predicate: OWL_DISJOINT_UNION_OF,
          predicateLabel: '',
          category: 'class-axiom',
          axiomKind: 'DisjointUnion',
          owlEdgeStyle: 'dotted',
          owlSynthesized: 1,
        },
      });
    }
  }

  return {
    synthesizedNodes,
    synthesizedEdges,
    hiddenNodeIds,
  };
}

function synthesizeClassExpressionProjection(graphData, visibleNodeIds, propertyDeclarations) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const incomingByTarget = buildIncomingEdgeIndex(graphData);
  const synthesizedNodes = [];
  const synthesizedEdges = [];
  const hiddenNodeIds = new Set();

  const expressionConfig = new Map([
    [OWL_INTERSECTION_OF, { label: '∩', kind: 'Intersection' }],
    [OWL_UNION_OF, { label: '∪', kind: 'Union' }],
    [OWL_ONE_OF, { label: '{}', kind: 'OneOf' }],
    [OWL_COMPLEMENT_OF, { label: '¬', kind: 'Complement' }],
  ]);

  for (const edge of graphData?.objectEdges ?? []) {
    const config = expressionConfig.get(edge.predicate);
    if (!config) {
      continue;
    }

    const sourceNode = graphData?.nodeMap?.get(edge.source);
    const anchorDescriptors = visibleNodeIds.has(edge.source)
      ? [
          {
            sourceId: edge.source,
            relationPredicate: OWL_EQUIVALENT_CLASS,
          },
        ]
      : sourceNode?.termType === 'BlankNode'
        ? (incomingByTarget.get(edge.source) ?? [])
            .filter(
              (incomingEdge) =>
                visibleNodeIds.has(incomingEdge.source) &&
                (incomingEdge.predicate === OWL_EQUIVALENT_CLASS ||
                  incomingEdge.predicate === RDFS_SUBCLASS_OF ||
                  incomingEdge.predicate === OWL_DISJOINT_WITH),
            )
            .map((incomingEdge) => ({
              sourceId: incomingEdge.source,
              relationPredicate: incomingEdge.predicate,
            }))
        : [];

    if (anchorDescriptors.length === 0) {
      continue;
    }

    if (edge.predicate !== OWL_COMPLEMENT_OF) {
      hiddenNodeIds.add(edge.target);
    }
    if (sourceNode?.termType === 'BlankNode') {
      hiddenNodeIds.add(edge.source);
    }

    let memberIds = [];
    if (edge.predicate === OWL_COMPLEMENT_OF) {
      memberIds = [edge.target];
    } else {
      memberIds = readListMembers(edge.target, outgoingBySource);
    }

    if (memberIds.length === 0) {
      continue;
    }

    const projectedMembers = memberIds
      .map((memberId) => {
        const memberNode = graphData?.nodeMap?.get(memberId);
        if (visibleNodeIds.has(memberId)) {
          return {
            kind: 'node',
            targetId: memberId,
          };
        }
        const isRestrictionNode =
          memberNode?.termType === 'BlankNode' &&
          (memberNode.blankExpressionType === 'Restriction' || memberNode.restrictionKind || memberNode.iri === OWL_RESTRICTION);
        if (!isRestrictionNode) {
          return null;
        }
        hiddenNodeIds.add(memberId);
        const restrictionProjection = buildRestrictionTargetSpecs(graphData, memberId, visibleNodeIds, propertyDeclarations);
        if (!restrictionProjection || restrictionProjection.targetSpecs.length === 0) {
          return null;
        }
        return {
          kind: 'restriction',
          ...restrictionProjection,
        };
      })
      .filter(Boolean);

    if (projectedMembers.length === 0) {
      continue;
    }
    for (const member of projectedMembers) {
      if (member.kind === 'restriction' && Array.isArray(member.supplementalNodes) && member.supplementalNodes.length > 0) {
        synthesizedNodes.push(...member.supplementalNodes);
      }
    }

    for (const anchorDescriptor of anchorDescriptors) {
      const anchorSourceId = anchorDescriptor.sourceId;
      const helperNodeId = `owl-expr:${config.kind}:${anchorSourceId}:${edge.source}:${edge.target}`;
      const expressionNodeData = makeExpressionNodeData(helperNodeId, config.label, config.kind);
      const relationKeyword = relationManchesterKeyword(anchorDescriptor.relationPredicate);
      const sourceText = manchesterNodeText(graphData, anchorSourceId);
      if (config.kind === 'Intersection') {
        expressionNodeData.connectorAxiomText = `${sourceText} ${relationKeyword} ${expressionMembersManchester(
          graphData,
          memberIds,
          'and',
        )}`;
      } else if (config.kind === 'Union') {
        expressionNodeData.connectorAxiomText = `${sourceText} ${relationKeyword} ${expressionMembersManchester(
          graphData,
          memberIds,
          'or',
        )}`;
      } else if (config.kind === 'Complement') {
        expressionNodeData.connectorAxiomText = `${sourceText} ${relationKeyword} not ${expressionMembersManchester(
          graphData,
          memberIds,
          'or',
        )}`;
      } else if (config.kind === 'OneOf') {
        expressionNodeData.connectorAxiomText = `${sourceText} ${relationKeyword} { ${memberIds
          .map((memberId) => manchesterNodeText(graphData, memberId))
          .join(', ')} }`;
      }
      synthesizedNodes.push({
        data: expressionNodeData,
      });
      synthesizedEdges.push({
        data: {
          id: `${helperNodeId}:source`,
          source: anchorSourceId,
          target: helperNodeId,
          predicate: edge.predicate,
          predicateLabel: '',
          category: 'object',
          axiomKind: 'ClassExpression',
          owlEdgeStyle: 'dotted',
          owlSynthesized: 1,
        },
      });
      for (const member of projectedMembers) {
        if (member.kind === 'node') {
          synthesizedEdges.push({
            data: {
              id: `${helperNodeId}:member:${member.targetId}`,
              source: helperNodeId,
              target: member.targetId,
              predicate: RDFS_SUBCLASS_OF,
              predicateLabel: '',
              category: 'object',
              axiomKind: 'SubClassOf',
              owlEdgeStyle: 'dotted',
              owlSynthesized: 1,
            },
          });
          continue;
        }

        for (const targetSpec of member.targetSpecs) {
          const resolvedTargetId = targetSpec.targetId === '__self__' ? helperNodeId : targetSpec.targetId;
          if (
            !visibleNodeIds.has(resolvedTargetId) &&
            !member.supplementalNodeIds?.has?.(resolvedTargetId) &&
            resolvedTargetId !== helperNodeId
          ) {
            continue;
          }
          synthesizedEdges.push({
            data: {
              id: `${helperNodeId}:member-restr:${member.onPropertyId}:${resolvedTargetId}:${targetSpec.predicate}`,
              source: helperNodeId,
              target: resolvedTargetId,
              predicate: member.onPropertyId,
              predicateLabel: decorateRelationLabel(
                targetSpec.forceStarSuffix
                  ? member.propertyBaseLabel
                  : `${restrictionPredicatePrefix(targetSpec.predicate)}${member.propertyBaseLabel}${restrictionPredicateSuffix(targetSpec.predicate)}`,
                {
                  isRestriction: true,
                  hasDetailRows:
                    Array.isArray(targetSpec.projectedMetadataRows) && targetSpec.projectedMetadataRows.length > 0,
                },
              ),
              category: member.propertyKind === 'data-property' ? 'data' : 'object',
              axiomKind: 'ClassExpressionRestriction',
              restrictionKind: member.restrictionKind || compactIri(targetSpec.predicate),
              sourceCardinality: targetSpec.sourceCardinality,
              showSourceCardinality: targetSpec.sourceCardinality ? 1 : 0,
              owlEdgeStyle: 'dotted',
              owlSynthesized: 1,
              isSelfLoop: resolvedTargetId === helperNodeId || targetSpec.isSelfLoop ? 1 : 0,
              projectedMetadataRows: targetSpec.projectedMetadataRows,
            },
          });
        }
      }
    }
  }

  return {
    synthesizedNodes,
    synthesizedEdges,
    hiddenNodeIds,
  };
}

function synthesizeOwlPropertyProjection(graphData, visibleNodeIds) {
  const declarations = collectPropertyDeclarations(graphData);
  const synthesizedEdges = [];

  for (const declaration of declarations.values()) {
    if (declaration.propertyKind === 'annotation-property') {
      continue;
    }

    if (declaration.domains.size === 0 || declaration.ranges.size === 0) {
      continue;
    }

    for (const domainId of declaration.domains) {
      for (const rangeId of declaration.ranges) {
        if (!visibleNodeIds.has(domainId) || !visibleNodeIds.has(rangeId)) {
          continue;
        }
        synthesizedEdges.push({
          id: `owl-synth:${declaration.propertyId}:${domainId}:${rangeId}`,
          source: domainId,
          target: rangeId,
          predicate: declaration.propertyId,
          predicateLabel: formatPropertyLabelWithCharacteristics(declaration.label, declaration),
          category: declaration.propertyKind === 'data-property' ? 'data' : 'object',
          axiomKind: 'PropertyProjection',
          restrictionKind: '',
          owlSynthesized: 1,
          owlEdgeStyle: declaration.propertyKind === 'data-property' ? 'dashed' : 'straight',
          isSelfLoop: domainId === rangeId ? 1 : 0,
        });
      }
    }
  }

  return {
    synthesizedNodes: [],
    synthesizedEdges,
    helperIdsByPropertyId: new Map(),
  };
}

function synthesizePropertyRelationEdges(graphData, helperIdsByPropertyId) {
  return [];
}

function ensureEdgeAnchor(edgeElement, anchorNodes, anchorEdges, anchorByEdgeId) {
  const edgeId = edgeElement?.data?.id;
  if (!edgeId) {
    return null;
  }

  const existing = anchorByEdgeId.get(edgeId);
  if (existing) {
    return existing;
  }

  const anchorId = `edge-anchor:${edgeId}`;
  anchorByEdgeId.set(edgeId, anchorId);
  const anchorNodeData = makeEdgeAnchorNodeData(anchorId);
  anchorNodeData.anchoredEdgeId = edgeId;
  anchorNodeData.anchoredSourceId = edgeElement.data.source;
  anchorNodeData.anchoredTargetId = edgeElement.data.target;
  anchorNodes.push({
    data: anchorNodeData,
  });
  anchorEdges.push({
    data: {
      id: `${anchorId}:source`,
      source: edgeElement.data.source,
      target: anchorId,
      predicate: edgeElement.data.predicate,
      predicateLabel: '',
      category: edgeElement.data.category ?? 'object',
      axiomKind: edgeElement.data.axiomKind ?? '',
      restrictionKind: edgeElement.data.restrictionKind ?? '',
      edgeAnchorTether: 1,
      owlEdgeStyle: 'straight',
    },
  });
  anchorEdges.push({
    data: {
      id: `${anchorId}:target`,
      source: anchorId,
      target: edgeElement.data.target,
      predicate: edgeElement.data.predicate,
      predicateLabel: '',
      category: edgeElement.data.category ?? 'object',
      axiomKind: edgeElement.data.axiomKind ?? '',
      restrictionKind: edgeElement.data.restrictionKind ?? '',
      edgeAnchorTether: 1,
      owlEdgeStyle: 'straight',
    },
  });
  return anchorId;
}

function buildReificationDescriptors(graphData) {
  const objectOutgoing = buildOutgoingEdgeIndex(graphData);
  const literalOutgoing = buildOutgoingLiteralEdgeIndex(graphData);
  const descriptors = [];

  for (const node of graphData?.nodes ?? []) {
    const outgoing = objectOutgoing.get(node.id) ?? [];
    const outgoingLiteral = literalOutgoing.get(node.id) ?? [];

    const rdfSubject = outgoing.find((edge) => edge.predicate === RDF_SUBJECT)?.target;
    const rdfPredicate = outgoing.find((edge) => edge.predicate === RDF_PREDICATE)?.target;
    const rdfObjectNode = outgoing.find((edge) => edge.predicate === RDF_OBJECT)?.target;
    const rdfObjectLiteral = outgoingLiteral.find((edge) => edge.predicate === RDF_OBJECT)?.target;
    if (rdfSubject && rdfPredicate && (rdfObjectNode || rdfObjectLiteral)) {
      descriptors.push({
        kind: 'reification',
        reifierId: node.id,
        source: rdfSubject,
        predicate: rdfPredicate,
        target: rdfObjectNode || rdfObjectLiteral,
        label: 'rdf:reifies',
        structuralPredicates: new Set([RDF_SUBJECT, RDF_PREDICATE, RDF_OBJECT]),
        metadataRows: [],
      });
    }

    const annotatedSource = outgoing.find((edge) => edge.predicate === OWL_ANNOTATED_SOURCE)?.target;
    const annotatedPredicate = outgoing.find((edge) => edge.predicate === OWL_ANNOTATED_PROPERTY)?.target;
    const annotatedTarget = outgoing.find((edge) => edge.predicate === OWL_ANNOTATED_TARGET)?.target;
    if (annotatedSource && annotatedPredicate && annotatedTarget) {
      const metadataRows = [
        ...outgoing
          .filter((edge) => ![RDF_TYPE, OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_PROPERTY, OWL_ANNOTATED_TARGET].includes(edge.predicate))
          .map((edge) => ({
            key: compactIri(edge.predicate),
            value: graphData.nodeMap.get(edge.target)?.fullLabel || compactIri(edge.target),
          })),
        ...outgoingLiteral
          .filter((edge) => ![RDF_TYPE, OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_PROPERTY, OWL_ANNOTATED_TARGET].includes(edge.predicate))
          .map((edge) => ({
            key: compactIri(edge.predicate),
            value: graphData.nodeMap.get(edge.target)?.fullLabel || graphData.nodeMap.get(edge.target)?.literalValue || edge.target,
          })),
      ];
      descriptors.push({
        kind: 'axiom-annotation',
        reifierId: node.id,
        source: annotatedSource,
        predicate: annotatedPredicate,
        target: annotatedTarget,
        label: 'owl:annotates',
        structuralPredicates: new Set([OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_PROPERTY, OWL_ANNOTATED_TARGET]),
        metadataRows,
      });
    }
  }

  return descriptors;
}

function decorateEdgeAttachedStructures(graphData, elements, mode) {
  const descriptors = buildReificationDescriptors(graphData);
  const structuralPredicatesByReifier = new Map(
    descriptors.map((descriptor) => [descriptor.reifierId, descriptor.structuralPredicates]),
  );

  const filteredElements = elements.filter((element) => {
    const data = element?.data;
    if (!data?.source) {
      return true;
    }
    const structuralPredicates = structuralPredicatesByReifier.get(data.source);
    if (structuralPredicates?.has(data.predicate)) {
      return false;
    }
    return true;
  });

  const nodeIds = new Set(filteredElements.filter((element) => !element?.data?.source).map((element) => element.data.id));
  const edgeElements = filteredElements.filter((element) => element?.data?.source);
  const edgeLookup = new Map();

  for (const edgeElement of edgeElements) {
    const data = edgeElement.data;
    const key = `${data.source}|${data.predicate}|${data.target}`;
    const bucket = edgeLookup.get(key) ?? [];
    bucket.push(edgeElement);
    edgeLookup.set(key, bucket);
  }

  const anchorNodes = [];
  const anchorEdges = [];
  const relationEdges = [];
  const anchorByEdgeId = new Map();
  const addedEdgeIds = new Set(edgeElements.map((element) => element.data.id));
  const addedNodeIds = new Set(nodeIds);
  const annotatedEdgeIds = new Set();

  const ensureNodeVisible = (nodeId) => {
    if (addedNodeIds.has(nodeId)) {
      return;
    }
    const node = graphData?.nodeMap?.get(nodeId);
    const nodeElement = makeNodeElementFromGraphNode(node);
    if (!nodeElement) {
      return;
    }
    anchorNodes.push(nodeElement);
    addedNodeIds.add(nodeId);
  };

  for (const descriptor of descriptors) {
    const matchingEdges = edgeLookup.get(`${descriptor.source}|${descriptor.predicate}|${descriptor.target}`) ?? [];
    if (matchingEdges.length === 0) {
      continue;
    }

    if (descriptor.kind === 'axiom-annotation') {
      for (const matchingEdge of matchingEdges) {
        annotatedEdgeIds.add(matchingEdge.data.id);
        matchingEdge.data.hasAxiomAnnotation = 1;
        if (Array.isArray(descriptor.metadataRows) && descriptor.metadataRows.length > 0) {
          const existingRows = Array.isArray(matchingEdge.data.projectedMetadataRows)
            ? matchingEdge.data.projectedMetadataRows
            : [];
          matchingEdge.data.projectedMetadataRows = [...existingRows, ...descriptor.metadataRows];
        }
      }
      continue;
    }

    ensureNodeVisible(descriptor.reifierId);

    for (const matchingEdge of matchingEdges) {
      const anchorId = ensureEdgeAnchor(matchingEdge, anchorNodes, anchorEdges, anchorByEdgeId);
      const relationId = `edge-attach:${descriptor.reifierId}:${matchingEdge.data.id}:${descriptor.label}`;
      if (addedEdgeIds.has(relationId)) {
        continue;
      }
      addedEdgeIds.add(relationId);
      relationEdges.push({
        data: {
          id: relationId,
          source: descriptor.reifierId,
          target: anchorId,
          predicate: descriptor.label,
          predicateLabel: descriptor.label,
          category: 'object',
          axiomKind: descriptor.label === 'owl:annotates' ? 'AxiomAnnotation' : 'Reification',
          restrictionKind: '',
          edgeAttachedConnector: 1,
          owlEdgeStyle: 'straight',
        },
      });
    }
  }

  if (mode === GRAPH_VIEW_MODES.OWL) {
    const propertyProjectionEdgesByPredicate = new Map();
    for (const edgeElement of edgeElements) {
      const data = edgeElement.data;
      if (data.axiomKind !== 'PropertyProjection') {
        continue;
      }
      const bucket = propertyProjectionEdgesByPredicate.get(data.predicate) ?? [];
      bucket.push(edgeElement);
      propertyProjectionEdgesByPredicate.set(data.predicate, bucket);
    }

    for (const edge of graphData?.objectEdges ?? []) {
      if (
        edge.predicate !== RDFS_SUBPROPERTY_OF &&
        edge.predicate !== OWL_EQUIVALENT_PROPERTY &&
        edge.predicate !== OWL_INVERSE_OF
      ) {
        continue;
      }

      const sourcePropertyEdges = propertyProjectionEdgesByPredicate.get(edge.source) ?? [];
      const targetPropertyEdges = propertyProjectionEdgesByPredicate.get(edge.target) ?? [];
      for (const sourceEdge of sourcePropertyEdges) {
        for (const targetEdge of targetPropertyEdges) {
          const sourceAnchorId = ensureEdgeAnchor(sourceEdge, anchorNodes, anchorEdges, anchorByEdgeId);
          const targetAnchorId = ensureEdgeAnchor(targetEdge, anchorNodes, anchorEdges, anchorByEdgeId);
          const relationId = `owl-prop-rel:${edge.predicate}:${sourceEdge.data.id}:${targetEdge.data.id}`;
          if (addedEdgeIds.has(relationId)) {
            continue;
          }
          addedEdgeIds.add(relationId);
          relationEdges.push({
            data: {
              id: relationId,
              source: sourceAnchorId,
              target: targetAnchorId,
              predicate: edge.predicate,
              predicateLabel:
                edge.predicate === RDFS_SUBPROPERTY_OF
                  ? 'subPropertyOf'
                  : edge.predicate === OWL_INVERSE_OF
                    ? 'inverseOf'
                    : 'equivalentProperty',
              category: 'object',
              axiomKind: edge.axiomKind || 'PropertyAxiom',
              restrictionKind: '',
              owlEdgeStyle: 'dotted',
              owlRelationConnector: 1,
              edgeAttachedConnector: 1,
            },
          });
        }
      }
    }
  }

  const decoratedElements = filteredElements.map((element) => {
    const data = element?.data;
    if (!data?.source || !annotatedEdgeIds.has(data.id)) {
      return element;
    }

    const next = cloneElement(element);
    next.data.hasAxiomAnnotation = 1;
    if (Array.isArray(data.projectedMetadataRows)) {
      next.data.projectedMetadataRows = data.projectedMetadataRows;
    }
    next.data.predicateLabel = decorateRelationLabel(next.data.predicateLabel || '', {
      isRestriction: data.axiomKind === 'Restriction' || data.axiomKind === 'ClassExpressionRestriction',
      hasDetailRows: Array.isArray(next.data.projectedMetadataRows) && next.data.projectedMetadataRows.length > 0,
    });
    return next;
  });

  return [...decoratedElements, ...anchorNodes, ...anchorEdges, ...relationEdges];
}

function applyOwlProjection(graphData, elements) {
  const visibleNodeIds = new Set(
    elements.filter((element) => !element?.data?.source).map((element) => element.data.id),
  );
  const propertyDeclarations = collectPropertyDeclarations(graphData);
  const propertyNodeIds = new Set(
    elements
      .filter(
        (element) =>
          !element?.data?.source &&
          ['object-property', 'data-property', 'annotation-property'].includes(element.data.ontologyKind),
      )
      .map((element) => element.data.id),
  );
  const renderableNodeIds = new Set(
    Array.from(visibleNodeIds).filter((id) => !propertyNodeIds.has(id)),
  );
  const { synthesizedNodes: classExpressionNodes, synthesizedEdges: classExpressionEdges, hiddenNodeIds: classExpressionHiddenNodeIds } =
    synthesizeClassExpressionProjection(graphData, visibleNodeIds, propertyDeclarations);
  const { synthesizedNodes: restrictionNodes, synthesizedEdges: restrictionEdges, hiddenNodeIds: restrictionHiddenNodeIds } =
    synthesizeRestrictionProjection(graphData, visibleNodeIds, propertyDeclarations);
  const { synthesizedNodes: collectionNodes, synthesizedEdges: collectionEdges, hiddenNodeIds: collectionHiddenNodeIds } =
    synthesizeCollectionProjection(graphData, renderableNodeIds);
  const { synthesizedNodes: disjointAxiomNodes, synthesizedEdges: disjointAxiomEdges, hiddenNodeIds: disjointAxiomHiddenNodeIds } =
    synthesizeDisjointAxiomProjection(graphData, renderableNodeIds);
  const hiddenNodeIds = new Set([
    ...classExpressionHiddenNodeIds,
    ...restrictionHiddenNodeIds,
    ...collectionHiddenNodeIds,
    ...disjointAxiomHiddenNodeIds,
    ...PROPERTY_CHARACTERISTIC_CLASS_IDS,
  ]);

  const filteredElements = elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }

    if (data.source) {
      return (
        !propertyNodeIds.has(data.source) &&
        !propertyNodeIds.has(data.target) &&
        !hiddenNodeIds.has(data.source) &&
        !hiddenNodeIds.has(data.target)
      );
    }

    return !propertyNodeIds.has(data.id) && !hiddenNodeIds.has(data.id);
  });

  const { synthesizedNodes, synthesizedEdges, helperIdsByPropertyId } = synthesizeOwlPropertyProjection(
    graphData,
    visibleNodeIds,
  );
  const synthesizedEdgeElements = synthesizedEdges.map((edge) => ({
    data: edge,
  }));
  const relationConnectorEdges = synthesizePropertyRelationEdges(graphData, helperIdsByPropertyId);

  const projectedElements = [
    ...filteredElements,
    ...classExpressionNodes,
    ...classExpressionEdges,
    ...restrictionNodes,
    ...restrictionEdges,
    ...collectionNodes,
    ...collectionEdges,
    ...disjointAxiomNodes,
    ...disjointAxiomEdges,
    ...synthesizedNodes,
    ...synthesizedEdgeElements,
    ...relationConnectorEdges,
  ].map((element) => {
    const data = element?.data;
    if (!data || !data.source) {
      return element;
    }

    const next = cloneElement(element);
    const sourceNode = graphData?.nodeMap?.get(data.source);
    const targetNode = graphData?.nodeMap?.get(data.target);
    const propertyDeclaration = propertyDeclarations.get(data.predicate);
    const isClassMembership =
      data.predicate === RDF_TYPE &&
      sourceNode?.entityCategory === 'individual' &&
      targetNode?.entityCategory === 'class';

    if (data.predicate === RDFS_SUBCLASS_OF || isClassMembership) {
      next.data.predicateLabel = '';
    }

    if (data.predicate === OWL_EQUIVALENT_CLASS) {
      next.data.predicateLabel = '≡';
    } else if (data.predicate === OWL_DISJOINT_WITH) {
      next.data.predicateLabel = '≢';
    } else if (data.predicate === OWL_SAME_AS || data.predicate === OWL_DIFFERENT_FROM) {
      next.data.owlEdgeStyle = 'dotted';
    }

    if (
      propertyDeclaration &&
      next.data.predicateLabel &&
      (data.axiomKind === 'PropertyAssertion' || data.axiomKind === 'PropertyProjection')
    ) {
      next.data.predicateLabel = formatPropertyLabelWithCharacteristics(
        propertyDeclaration.label,
        propertyDeclaration,
      );
    }

    if (!next.data.owlEdgeStyle) {
      if (next.data.category === 'data') {
        next.data.owlEdgeStyle = 'dashed';
      } else {
        next.data.owlEdgeStyle = 'straight';
      }
    }

    return next;
  });

  const restrictionLikeEdgeKeys = new Set(
    projectedElements
      .filter((element) => {
        const data = element?.data;
        return data?.source && (data.axiomKind === 'Restriction' || data.axiomKind === 'ClassExpressionRestriction');
      })
      .map((element) => `${element.data.source}|${element.data.target}|${element.data.predicate}`),
  );

  const dedupedProjectedElements = projectedElements.filter((element) => {
    const data = element?.data;
    if (!data?.source || data.axiomKind !== 'PropertyProjection') {
      return true;
    }
    return !restrictionLikeEdgeKeys.has(`${data.source}|${data.target}|${data.predicate}`);
  });

  const projectedNodeIds = new Set(
    dedupedProjectedElements
      .filter((element) => !element?.data?.source)
      .map((element) => element.data.id),
  );
  const safeProjectedElements = dedupedProjectedElements.filter((element) => {
    const data = element?.data;
    if (!data?.source) {
      return true;
    }
    return projectedNodeIds.has(data.source) && projectedNodeIds.has(data.target);
  });

  const visibleGraphNodes = safeProjectedElements.filter(
    (element) => !element?.data?.source && !element?.data?.owlHelper,
  );
  if (visibleGraphNodes.length === 0) {
    return elements;
  }

  return safeProjectedElements;
}

export function normalizeGraphViewMode(mode) {
  if (mode === GRAPH_VIEW_MODES.RDF || mode === 'kg') {
    return GRAPH_VIEW_MODES.RDF;
  }
  return GRAPH_VIEW_MODES.OWL;
}

export function createViewOptions(mode, flags = {}) {
  return {
    ...DEFAULT_VIEW_OPTIONS,
    ...flags,
    projectionMode: normalizeGraphViewMode(mode),
  };
}

export function buildRdfViewProjection(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  const elements = buildFocusedSubset(graphData, focusedNodeIds, {
    ...viewOptions,
    projectionMode: GRAPH_VIEW_MODES.RDF,
  });

  return applyHoverMetadata(
    graphData,
    applySelfLoopGeometry(
      graphData,
      applyRelationPalette(
        decorateEdgeAttachedStructures(
          graphData,
          applyRdfLabels(suppressMetadataEdges(elements)),
          GRAPH_VIEW_MODES.RDF,
        ),
      ),
    ),
  );
}

export function buildOwlViewProjection(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  const elements = buildFocusedSubset(graphData, focusedNodeIds, {
    ...viewOptions,
    projectionMode: GRAPH_VIEW_MODES.RDF,
  });

  const baseElements = suppressMetadataEdges(elements);

  try {
    return applyHoverMetadata(
      graphData,
      applySelfLoopGeometry(
        graphData,
        applyRelationPalette(
          decorateEdgeAttachedStructures(
            graphData,
            applyOwlProjection(graphData, baseElements),
            GRAPH_VIEW_MODES.OWL,
          ),
        ),
      ),
    );
  } catch (error) {
    console.error('OWL projection failed; falling back to base ontology graph.', error);
    return applyHoverMetadata(graphData, applySelfLoopGeometry(graphData, applyRelationPalette(baseElements)));
  }
}

export function buildProjectedElements(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  const normalizedMode = normalizeGraphViewMode(viewOptions?.projectionMode);

  try {
    if (normalizedMode === GRAPH_VIEW_MODES.RDF) {
      return buildRdfViewProjection(graphData, focusedNodeIds, viewOptions);
    }
    return buildOwlViewProjection(graphData, focusedNodeIds, viewOptions);
  } catch (error) {
    console.error('Graph projection failed; falling back to RDF-style base graph.', error);
    return buildRdfViewProjection(graphData, focusedNodeIds, {
      ...viewOptions,
      projectionMode: GRAPH_VIEW_MODES.RDF,
    });
  }
}

export function getProjectedNodeMetadataRows(graphData, nodeId, mode) {
  if (!graphData || !nodeId || normalizeGraphViewMode(mode) !== GRAPH_VIEW_MODES.OWL) {
    return [];
  }

  const declarations = collectPropertyDeclarations(graphData);
  const rows = [];
  const propertyLabelById = new Map(Array.from(declarations.values()).map((entry) => [entry.propertyId, entry.label]));
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const outgoingLiteralBySource = buildOutgoingLiteralEdgeIndex(graphData);
  const outgoingAllBySource = buildOutgoingAllEdgeIndex(graphData);
  const incomingByTarget = buildIncomingEdgeIndex(graphData);

  for (const declaration of declarations.values()) {
    if (declaration.propertyKind === 'annotation-property') {
      continue;
    }

    const isDomain = declaration.domains.has(nodeId);
    const isRange = declaration.ranges.has(nodeId);
    if (!isDomain && !isRange) {
      continue;
    }

    const domainLabels = Array.from(declaration.domains)
      .map((id) => graphData.nodeMap.get(id)?.fullLabel || propertyLabelById.get(id) || compactIri(id))
      .filter(Boolean)
      .join(', ');
    const rangeLabels = Array.from(declaration.ranges)
      .map((id) => graphData.nodeMap.get(id)?.fullLabel || propertyLabelById.get(id) || compactIri(id))
      .filter(Boolean)
      .join(', ');

    rows.push({
      predicate: declaration.propertyId,
      predicateLabel: isDomain && isRange ? 'OWL property (domain/range)' : isDomain ? 'OWL property (domain)' : 'OWL property (range)',
      value: `${declaration.label} [${declaration.propertyKind}] :: domain=${domainLabels || 'n/a'} ; range=${rangeLabels || 'n/a'}`,
    });
  }

  for (const edge of graphData.objectEdges ?? []) {
    if (
      edge.predicate !== RDFS_SUBPROPERTY_OF &&
      edge.predicate !== OWL_EQUIVALENT_PROPERTY &&
      edge.predicate !== OWL_INVERSE_OF
    ) {
      continue;
    }

    const sourceDeclaration = declarations.get(edge.source);
    const targetDeclaration = declarations.get(edge.target);
    if (!sourceDeclaration || !targetDeclaration) {
      continue;
    }

    const sourceTouchesNode = sourceDeclaration.domains.has(nodeId) || sourceDeclaration.ranges.has(nodeId);
    const targetTouchesNode = targetDeclaration.domains.has(nodeId) || targetDeclaration.ranges.has(nodeId);
    if (!sourceTouchesNode && !targetTouchesNode) {
      continue;
    }

    const relationLabel =
      edge.predicate === RDFS_SUBPROPERTY_OF
        ? 'subPropertyOf'
        : edge.predicate === OWL_INVERSE_OF
          ? 'inverseOf'
          : 'equivalentProperty';

    rows.push({
      predicate: edge.predicate,
      predicateLabel: 'OWL property relation',
      value: `${sourceDeclaration.label} <<${relationLabel}>> ${targetDeclaration.label}`,
    });
  }

  for (const edge of graphData.objectEdges ?? []) {
    if (edge.source !== nodeId && edge.target !== nodeId) {
      continue;
    }
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const otherNode = graphData.nodeMap.get(otherId);
    if (!otherNode || otherNode.termType !== 'BlankNode') {
      continue;
    }

    const isUnresolvedBlank =
      otherNode.blankExpressionType === 'List' ||
      otherNode.blankExpressionType === 'ClassExpression' ||
      otherNode.blankExpressionType === 'Restriction' ||
      Boolean(otherNode.restrictionKind);
    if (!isUnresolvedBlank) {
      continue;
    }

    const outgoing = outgoingBySource.get(otherId) ?? [];
    const outgoingLiteral = outgoingLiteralBySource.get(otherId) ?? [];
    const objectSummary = outgoing
      .filter((row) => row.target !== nodeId)
      .map((row) => `${compactIri(row.predicate)} -> ${graphData.nodeMap.get(row.target)?.fullLabel || compactIri(row.target)}`)
      .slice(0, 4);
    const literalSummary = outgoingLiteral
      .map((row) => `${compactIri(row.predicate)} -> ${graphData.nodeMap.get(row.target)?.fullLabel || row.target}`)
      .slice(0, 4);

    rows.push({
      predicate: edge.predicate,
      predicateLabel: 'OWL unresolved pattern',
      value: `${otherNode.blankExpressionType || otherNode.restrictionKind || 'blank structure'} :: ${
        [...objectSummary, ...literalSummary].join(' ; ') || 'No expanded summary available'
      }`,
    });
  }

  for (const edge of graphData.objectEdges ?? []) {
    if (edge.predicate !== OWL_HAS_KEY || edge.source !== nodeId) {
      continue;
    }
    const keyMembers = readListMembers(edge.target, outgoingBySource).map((id) => propertyLabelById.get(id) || nodeLabel(graphData, id));
    rows.push({
      predicate: edge.predicate,
      predicateLabel: 'OWL keys',
      value: keyMembers.length > 0 ? keyMembers.join(', ') : 'Key list present but could not be expanded',
    });
  }

  for (const node of graphData.nodes ?? []) {
    if (node.termType !== 'BlankNode') {
      continue;
    }
    const outgoing = outgoingBySource.get(node.id) ?? [];
    const rdfTypes = outgoing.filter((edge) => edge.predicate === RDF_TYPE).map((edge) => edge.target);
    if (rdfTypes.includes(OWL_ALL_DIFFERENT)) {
      const distinctEdge = outgoing.find((edge) => edge.predicate === OWL_DISTINCT_MEMBERS);
      const members = distinctEdge ? readListMembers(distinctEdge.target, outgoingBySource) : [];
      if (members.includes(nodeId)) {
        rows.push({
          predicate: OWL_ALL_DIFFERENT,
          predicateLabel: 'OWL allDifferent',
          value: members.map((id) => nodeLabel(graphData, id)).join(', '),
        });
      }
    }
    if (rdfTypes.includes(OWL_ALL_DISJOINT_CLASSES)) {
      const membersEdge = outgoing.find((edge) => edge.predicate === OWL_MEMBERS);
      const members = membersEdge ? readListMembers(membersEdge.target, outgoingBySource) : [];
      if (members.includes(nodeId)) {
        rows.push({
          predicate: OWL_ALL_DISJOINT_CLASSES,
          predicateLabel: 'OWL allDisjointClasses',
          value: members.map((id) => nodeLabel(graphData, id)).join(', '),
        });
      }
    }
    if (rdfTypes.includes(OWL_AXIOM)) {
      const src = outgoing.find((e) => e.predicate === OWL_ANNOTATED_SOURCE)?.target || '';
      const target = outgoing.find((e) => e.predicate === OWL_ANNOTATED_TARGET)?.target || '';
      const predicateId = outgoing.find((e) => e.predicate === OWL_ANNOTATED_PROPERTY)?.target || '';
      if (src === nodeId || target === nodeId) {
        const notes = [
          ...outgoing.filter((e) => ![RDF_TYPE, OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_TARGET, OWL_ANNOTATED_PROPERTY].includes(e.predicate)),
          ...(outgoingLiteralBySource.get(node.id) ?? []).filter(
            (e) => ![RDF_TYPE, OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_TARGET, OWL_ANNOTATED_PROPERTY].includes(e.predicate),
          ),
        ];
        rows.push({
          predicate: OWL_AXIOM,
          predicateLabel: 'OWL axiom annotation',
          value: `${nodeLabel(graphData, src)} -- ${compactIri(predicateId)} -> ${nodeLabel(graphData, target)}${
            notes.length > 0
              ? ` :: ${notes
                  .map((entry) => `${compactIri(entry.predicate)}=${graphData.nodeMap.get(entry.target)?.fullLabel || compactIri(entry.target)}`)
                  .join(' ; ')}`
              : ''
          }`,
        });
      }
    }
    if (rdfTypes.includes(RDF_STATEMENT)) {
      const src = outgoing.find((e) => e.predicate === RDF_SUBJECT)?.target || '';
      const target = outgoing.find((e) => e.predicate === RDF_OBJECT)?.target || '';
      const predicateId = outgoing.find((e) => e.predicate === RDF_PREDICATE)?.target || '';
      if (src === nodeId || target === nodeId) {
        const notes = [
          ...outgoing.filter((e) => ![RDF_TYPE, RDF_SUBJECT, RDF_PREDICATE, RDF_OBJECT].includes(e.predicate)),
          ...(outgoingLiteralBySource.get(node.id) ?? []).filter(
            (e) => ![RDF_TYPE, RDF_SUBJECT, RDF_PREDICATE, RDF_OBJECT].includes(e.predicate),
          ),
        ];
        rows.push({
          predicate: RDF_STATEMENT,
          predicateLabel: 'RDF reification',
          value: `${nodeLabel(graphData, src)} -- ${compactIri(predicateId)} -> ${nodeLabel(graphData, target)}${
            notes.length > 0
              ? ` :: ${notes
                  .map((entry) => `${compactIri(entry.predicate)}=${graphData.nodeMap.get(entry.target)?.fullLabel || compactIri(entry.target)}`)
                  .join(' ; ')}`
              : ''
          }`,
        });
      }
    }
  }

  for (const edge of graphData.objectEdges ?? []) {
    if (edge.predicate !== OWL_EQUIVALENT_CLASS && edge.predicate !== RDFS_SUBCLASS_OF) {
      continue;
    }
    if (edge.source !== nodeId && edge.target !== nodeId) {
      continue;
    }
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const otherNode = graphData.nodeMap.get(otherId);
    if (!otherNode || otherNode.termType !== 'BlankNode') {
      continue;
    }
    const outgoing = outgoingAllBySource.get(otherId) ?? [];
    const onDatatypeEdge = outgoing.find((row) => row.predicate === OWL_ON_DATATYPE);
    const withRestrictionsEdge = outgoing.find((row) => row.predicate === OWL_WITH_RESTRICTIONS);
    if (!onDatatypeEdge && !withRestrictionsEdge) {
      continue;
    }
    const restrictionMembers = withRestrictionsEdge
      ? readListMembers(withRestrictionsEdge.target, outgoingBySource).map((id) => summarizeRestrictionFacetNode(graphData, id, outgoingAllBySource))
      : [];
    rows.push({
      predicate: onDatatypeEdge?.predicate || OWL_WITH_RESTRICTIONS,
      predicateLabel: 'OWL datatype restriction',
      value: `${onDatatypeEdge ? nodeLabel(graphData, onDatatypeEdge.target) : 'datatype'}${
        restrictionMembers.length > 0 ? ` :: ${restrictionMembers.join(' ; ')}` : ''
      }`,
    });
  }

  return rows;
}
