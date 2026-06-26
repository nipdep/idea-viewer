import { buildFocusedSubset, compactIri, DEFAULT_VIEW_OPTIONS, getNodeStatementBuckets, getTermId } from './rdf';

export const GRAPH_VIEW_MODES = Object.freeze({
  OWL: 'owl',
  RDF: 'rdf',
});
const RDF_PROJECTION_LEVELS = Object.freeze({
  OBJECT: 'object',
  ALL: 'all',
});
const OWL_PROJECTION_LEVELS = Object.freeze({
  TAXONOMY: 'taxonomy',
  SCHEMA: 'schema',
  ONTOLOGY: 'ontology',
  KG: 'kg',
});

const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment';
const RDFS_DATATYPE = 'http://www.w3.org/2000/01/rdf-schema#Datatype';
const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_MEMBER = 'http://www.w3.org/2000/01/rdf-schema#member';
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';
const RDFS_RESOURCE = 'http://www.w3.org/2000/01/rdf-schema#Resource';
const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const RDFS_SUBPROPERTY_OF = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf';
const RDFS_CONTAINER = 'http://www.w3.org/2000/01/rdf-schema#Container';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDF_ALT = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Alt';
const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
const RDF_BAG = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Bag';
const RDF_HTML = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const RDF_LIST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#List';
const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
const RDF_PROPERTY = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property';
const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
const RDF_SEQ = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Seq';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_VALUE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value';
const RDF_XML_LITERAL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral';
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
const OWL_NAMED_INDIVIDUAL = 'http://www.w3.org/2002/07/owl#NamedIndividual';
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
const PROV_NS = 'http://www.w3.org/ns/prov#';
const PROV_WAS_DERIVED_FROM = 'http://www.w3.org/ns/prov#wasDerivedFrom';
const DCT_SOURCE = 'http://purl.org/dc/terms/source';
const RDF_STATEMENT = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Statement';
const RDF_SUBJECT = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#subject';
const RDF_PREDICATE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate';
const RDF_OBJECT = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#object';
const SKOS_PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel';
const SKOS_DEFINITION = 'http://www.w3.org/2004/02/skos/core#definition';
const SCHEMA_NAME = 'http://schema.org/name';
const FOAF_NAME = 'http://xmlns.com/foaf/0.1/name';
const XSD_MIN_INCLUSIVE = 'http://www.w3.org/2001/XMLSchema#minInclusive';
const XSD_MAX_INCLUSIVE = 'http://www.w3.org/2001/XMLSchema#maxInclusive';
const XSD_MIN_EXCLUSIVE = 'http://www.w3.org/2001/XMLSchema#minExclusive';
const XSD_MAX_EXCLUSIVE = 'http://www.w3.org/2001/XMLSchema#maxExclusive';

const METADATA_PREDICATES = new Set([
  RDFS_LABEL,
  RDFS_COMMENT,
  'http://www.w3.org/2004/02/skos/core#prefLabel',
  'http://schema.org/name',
  'http://xmlns.com/foaf/0.1/name',
  RDF_VALUE,
  OWL_IMPORTS,
  OWL_VERSION_IRI,
  OWL_VERSION_INFO,
  PROV_WAS_DERIVED_FROM,
  DCT_SOURCE,
  SKOS_DEFINITION,
]);

const DISPLAY_ONLY_NODE_IDS = new Set([
  RDFS_LABEL,
  SKOS_PREF_LABEL,
  SCHEMA_NAME,
  FOAF_NAME,
]);

const INFRASTRUCTURE_NODE_IDS = new Set([
  RDF_PROPERTY,
  RDF_SEQ,
  RDF_STATEMENT,
  OWL_AXIOM,
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

function buildProjectedEdgeEquivalenceIndex(edgeElements) {
  const edgesByTarget = new Map();
  const edgesBySource = new Map();
  const equivalenceByPair = new Map();

  const equivalenceKeyForEdge = (edgeData) => {
    if (!edgeData?.source) {
      return '';
    }
    if (edgeData.axiomKind === 'Restriction' || edgeData.axiomKind === 'ClassExpressionRestriction') {
      return `restriction|${edgeData.predicate}`;
    }
    if (
      edgeData.axiomKind === 'SubClassOf' ||
      edgeData.axiomKind === 'ClassExpression' ||
      edgeData.predicate === RDFS_SUBCLASS_OF ||
      edgeData.predicate === OWL_EQUIVALENT_CLASS
    ) {
      return 'hierarchy';
    }
    return `${edgeData.predicate}|${edgeData.axiomKind || ''}`;
  };

  for (const edgeElement of edgeElements) {
    const edgeData = edgeElement?.data;
    if (!edgeData?.source) {
      continue;
    }

    const incoming = edgesByTarget.get(edgeData.target) ?? [];
    incoming.push(edgeElement);
    edgesByTarget.set(edgeData.target, incoming);

    const outgoing = edgesBySource.get(edgeData.source) ?? [];
    outgoing.push(edgeElement);
    edgesBySource.set(edgeData.source, outgoing);

    const pairKey = `${edgeData.source}|${edgeData.target}`;
    const equivalenceKeys = equivalenceByPair.get(pairKey) ?? new Set();
    equivalenceKeys.add(equivalenceKeyForEdge(edgeData));
    equivalenceByPair.set(pairKey, equivalenceKeys);
  }

  return {
    edgesByTarget,
    edgesBySource,
    equivalenceByPair,
    equivalenceKeyForEdge,
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
    (
      predicate.startsWith(RDF_NS) ||
      predicate.startsWith('http://www.w3.org/2000/01/rdf-schema#') ||
      predicate.startsWith('rdf:') ||
      predicate.startsWith('rdfs:')
    )
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
      const existingDisplay = data.displayLabel || data.label || '';
      const existingFull = data.fullLabel || '';
      const compact = compactIri(data.iri || data.id || '');
      data.label = existingDisplay || existingFull || compact;
      if (!data.fullLabel && compact) {
        data.fullLabel = compact;
      }
    }

    return next;
  });
}

function filterRdfProjectionByLevel(elements, rdfProjectionLevel) {
  if (!rdfProjectionLevel || rdfProjectionLevel === RDF_PROJECTION_LEVELS.ALL) {
    return elements;
  }

  const nodeElementsById = new Map(
    elements
      .filter((element) => !element?.data?.source)
      .map((element) => [element.data.id, element]),
  );
  const allowedEdgeIds = new Set();
  const referencedNodeIds = new Set();

  const isIndividualLikeNode = (data) =>
    Boolean(
      data &&
        (data.entityCategory === 'individual' ||
          data.graphRole === 'kg-instance' ||
          data.ontologyKind === 'individual'),
    );

  const isConnectorLikeNode = (data) =>
    Boolean(
      data &&
        (data.entityCategory === 'rdf-connector' ||
          data.entityCategory === 'edge-anchor' ||
          data.edgeAnchor ||
          data.rdfConnectorKind),
    );

  const isAllowedObjectProjectionNode = (data) => isIndividualLikeNode(data) || isConnectorLikeNode(data);

  for (const element of elements) {
    const data = element?.data;
    if (!data?.source || data.category !== 'object') {
      continue;
    }

    const sourceNode = nodeElementsById.get(data.source)?.data;
    const targetNode = nodeElementsById.get(data.target)?.data;
    if (!isAllowedObjectProjectionNode(sourceNode) || !isAllowedObjectProjectionNode(targetNode)) {
      continue;
    }

    allowedEdgeIds.add(data.id);
    referencedNodeIds.add(data.source);
    referencedNodeIds.add(data.target);
  }

  return elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }

    if (data.source) {
      return allowedEdgeIds.has(data.id);
    }

    if (isIndividualLikeNode(data)) {
      return referencedNodeIds.has(data.id);
    }

    return isConnectorLikeNode(data) && referencedNodeIds.has(data.id);
  });
}

function isProvIri(iri) {
  return Boolean(iri) && String(iri).startsWith(PROV_NS);
}

function isProvNode(node) {
  if (!node || node.termType !== 'NamedNode') {
    return false;
  }

  if (isProvIri(node.iri || node.id)) {
    return true;
  }

  return Array.isArray(node.classes) && node.classes.some((classIri) => isProvIri(classIri));
}

function isGraphSuppressedNode(graphData, nodeId) {
  if (!nodeId) {
    return false;
  }
  return isProvNode(graphData?.nodeMap?.get(nodeId));
}

function isContainerMembershipPredicate(predicate) {
  return predicate === RDFS_MEMBER || /^http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#_\d+$/.test(String(predicate || ''));
}

function rdfContainerSymbol(typeIri) {
  if (typeIri === RDF_SEQ) {
    return '()';
  }
  if (typeIri === RDF_BAG) {
    return 'Bag';
  }
  if (typeIri === RDF_ALT) {
    return 'Alt';
  }
  return '□';
}

function ordinalLabel(index) {
  if (index === 0) {
    return '1st';
  }
  if (index === 1) {
    return '2nd';
  }
  if (index === 2) {
    return '3rd';
  }
  return `${index + 1}th`;
}

function formatNodeLabel(graphData, nodeId) {
  const node = graphData?.nodeMap?.get(nodeId);
  return node?.fullLabel || compactIri(nodeId);
}

function summarizeHiddenNode(graphData, nodeId) {
  const node = graphData?.nodeMap?.get(nodeId);
  if (!node) {
    return compactIri(nodeId);
  }

  const parts = [];
  const dataRows = graphData?.dataProperties?.get(nodeId) ?? [];
  for (const row of dataRows) {
    if (!row?.predicateLabel || row.value == null) {
      continue;
    }
    parts.push(`${row.predicateLabel}=${row.value}`);
  }

  for (const edge of graphData?.objectEdges ?? []) {
    if (edge.source !== nodeId || edge.predicate === RDF_TYPE) {
      continue;
    }
    parts.push(`${compactIri(edge.predicate)}=${formatNodeLabel(graphData, edge.target)}`);
  }

  const label = node.fullLabel || compactIri(nodeId);
  return parts.length > 0 ? `${label} (${parts.join('; ')})` : label;
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
  if (data?.entityCategory === 'owl-collection-connector' && data?.label === '[]') {
    return 'RDF List';
  }
  if (data?.entityCategory === 'owl-collection-connector' && data?.label === '()') {
    return 'RDF Seq';
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

  if (data.predicate === OWL_COMPLEMENT_OF) {
    return 'complement Of';
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

function suppressDisplayOnlyNodes(elements) {
  return elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }

    if (!data.source) {
      return !DISPLAY_ONLY_NODE_IDS.has(data.id);
    }

    return !DISPLAY_ONLY_NODE_IDS.has(data.source) && !DISPLAY_ONLY_NODE_IDS.has(data.target);
  });
}

function annotateRdfNodePresentation(elements) {
  return elements.map((element) => {
    const data = element?.data;
    if (!data || data.source) {
      return element;
    }

    const isBlankNode = data.kind === 'blank';
    const isConnectorNode =
      data.entityCategory === 'rdf-connector' ||
      data.entityCategory === 'class-expression-connector' ||
      data.owlCollectionConnector === 1 ||
      data.owlExpressionNode === 1;
    const isStructuralBlankNode =
      isBlankNode &&
      Boolean(
        data.blankExpressionType ||
          data.restrictionKind ||
          data.rdfConnectorKind ||
          data.entityCategory === 'class-expression-connector',
      );

    if (!isBlankNode && !isConnectorNode && !isStructuralBlankNode) {
      return element;
    }

    const next = cloneElement(element);
    if (isBlankNode) {
      next.data.rdfBlankNode = 1;
      next.data.label = '';
      next.data.fullLabel = '';
      next.data.nodeWidth = 28;
      next.data.nodeHeight = 28;
      next.data.textMaxWidth = 1;
      next.data.labelLength = 1;
    }
    if (isConnectorNode) {
      next.data.rdfConnectorNode = 1;
    }
    if (isStructuralBlankNode) {
      next.data.rdfStructuralBlankNode = 1;
    }
    return next;
  });
}

function stripNodeBadges(elements) {
  return elements.map((element) => {
    const data = element?.data;
    if (!data || data.source) {
      return element;
    }

    if (
      !data.hasClass &&
      !data.classCount &&
      !data.classBadge &&
      !data.badgeSvg &&
      !data.badgeWidth &&
      !data.classTooltip
    ) {
      return element;
    }

    const next = cloneElement(element);
    next.data.hasClass = 0;
    next.data.classCount = 0;
    next.data.classBadge = '';
    next.data.badgeSvg = '';
    next.data.badgeWidth = 0;
    next.data.classTooltip = '';
    return next;
  });
}

function isAnnotationLikePredicate(graphData, predicateIri) {
  if (!predicateIri) {
    return false;
  }

  if (METADATA_PREDICATES.has(predicateIri)) {
    return true;
  }

  const predicateNode = graphData?.nodeMap?.get(predicateIri);
  return predicateNode?.ontologyKind === 'annotation-property' || predicateNode?.entityCategory === 'annotation-property';
}

function suppressInfrastructureNodes(graphData, elements) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const incomingByTarget = buildIncomingEdgeIndex(graphData);
  const hiddenNodeIds = new Set();

  for (const element of elements) {
    const data = element?.data;
    if (!data || data.source) {
      continue;
    }

    if (INFRASTRUCTURE_NODE_IDS.has(data.id)) {
      hiddenNodeIds.add(data.id);
      continue;
    }

    const incoming = incomingByTarget.get(data.id) ?? [];
    const outgoing = outgoingBySource.get(data.id) ?? [];
    const hasIncoming = incoming.length > 0;
    const hasOutgoing = outgoing.length > 0;
    if (
      hasIncoming &&
      !hasOutgoing &&
      incoming.every((edge) => isAnnotationLikePredicate(graphData, edge.predicate) || isProvIri(edge.predicate))
    ) {
      hiddenNodeIds.add(data.id);
    }
  }

  if (hiddenNodeIds.size === 0) {
    return elements;
  }

  return elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }
    if (!data.source) {
      return !hiddenNodeIds.has(data.id);
    }
    return !hiddenNodeIds.has(data.source) && !hiddenNodeIds.has(data.target);
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

function measureFallbackNode(label) {
  const normalized = String(label || '').trim() || '?';
  const lines = normalized.split('\n').filter(Boolean);
  const lineCount = Math.max(lines.length, 1);
  const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 1);

  return {
    nodeWidth: Math.max(46, Math.min(192, Math.round(maxLineLength * 5.75 + 8))),
    nodeHeight: Math.max(24, Math.min(154, Math.round(lineCount * 14 + 4))),
    textMaxWidth: Math.max(38, Math.min(188, Math.round(maxLineLength * 5.75 + 4))),
    labelLength: Math.min(Math.max(maxLineLength * lineCount, 4), 120),
  };
}

function makeFallbackNodeElement(term) {
  if (!term) {
    return null;
  }

  const id = getTermId(term);
  let fullLabel = '';
  let kind = 'entity';
  let entityCategory = 'named-entity';
  let literalValue = '';
  let literalDatatype = '';
  let literalLanguage = '';
  let iri = '';
  let termType = term.termType;

  if (term.termType === 'Literal') {
    fullLabel = term.value || '';
    kind = 'literal';
    entityCategory = 'literal';
    literalValue = term.value || '';
    literalDatatype = term.datatype?.value || '';
    literalLanguage = term.language || '';
  } else if (term.termType === 'BlankNode') {
    fullLabel = `[Blank ${term.value}]`;
    kind = 'blank';
    entityCategory = 'blank';
    iri = term.value || '';
  } else {
    fullLabel = compactIri(term.value || '');
    iri = term.value || '';
  }

  const metrics = measureFallbackNode(fullLabel);
  return {
    data: {
      id,
      label: fullLabel,
      fullLabel,
      iri,
      baseIri: '',
      kind,
      ontologyKind: '',
      entityCategory,
      blankExpressionType: '',
      restrictionKind: '',
      restrictionTooltip: '',
      graphRole: '',
      isInstanceNode: 0,
      isOntologyNode: 0,
      mixedMode: 0,
      termType,
      literalValue,
      literalDatatype,
      literalLanguage,
      labelLength: metrics.labelLength,
      nodeWidth: metrics.nodeWidth,
      nodeHeight: metrics.nodeHeight,
      textMaxWidth: metrics.textMaxWidth,
      hasClass: 0,
      classCount: 0,
      classBadge: '',
      badgeSvg: '',
      badgeWidth: 0,
      classTooltip: '',
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

function makeRestrictionConnectorNodeData(id, label, restrictionKind = 'Restriction') {
  const compactLabel = String(label || restrictionKind || 'Restriction').trim() || 'Restriction';
  return {
    id,
    label: '',
    fullLabel: '',
    iri: '',
    baseIri: '',
    kind: 'blank',
    ontologyKind: '',
    entityCategory: 'class-expression-connector',
    blankExpressionType: 'Restriction',
    restrictionKind,
    restrictionTooltip: compactLabel,
    graphRole: 'class-expression-connector',
    isInstanceNode: 0,
    isOntologyNode: 0,
    mixedMode: 0,
    termType: 'BlankNode',
    literalValue: '',
    literalDatatype: '',
    literalLanguage: '',
    labelLength: 1,
    nodeWidth: 18,
    nodeHeight: 18,
    textMaxWidth: 18,
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

function makeCollectionConnectorNodeData(id, label, kind, size = 2) {
  return {
    id,
    label,
    fullLabel: label,
    iri: '',
    baseIri: '',
    kind: 'blank',
    ontologyKind: '',
    entityCategory: 'owl-collection-connector',
    blankExpressionType: kind,
    restrictionKind: '',
    restrictionTooltip: '',
    graphRole: 'owl-collection-connector',
    isInstanceNode: 0,
    isOntologyNode: 0,
    mixedMode: 0,
    termType: 'BlankNode',
    literalValue: '',
    literalDatatype: '',
    literalLanguage: '',
    labelLength: Math.max(label.length, 1),
    nodeWidth: Math.max(42, 36 + size * 2),
    nodeHeight: Math.max(42, 36 + size * 2),
    textMaxWidth: 34,
    hasClass: 0,
    classCount: 0,
    classBadge: '',
    badgeSvg: '',
    badgeWidth: 0,
    classTooltip: '',
    lightOntologyView: 0,
    owlCollectionConnector: 1,
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

function collectListCellIds(startId, outgoingBySource) {
  if (!startId || startId === RDF_NIL) {
    return [];
  }

  const cellIds = [];
  const visited = new Set();
  let currentId = startId;

  while (currentId && currentId !== RDF_NIL && !visited.has(currentId)) {
    visited.add(currentId);
    cellIds.push(currentId);
    const edges = outgoingBySource.get(currentId) ?? [];
    const restEdge = edges.find((edge) => edge.predicate === RDF_REST);
    if (!restEdge) {
      break;
    }
    currentId = restEdge.target;
  }

  return cellIds;
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

function shouldIncludeRawRdfEdge(category, options) {
  if (category === 'type') {
    return options.showTypeLinks;
  }
  if (category === 'annotation') {
    return options.showAnnotationProperties;
  }
  if (category === 'data') {
    return options.showDataProperties;
  }
  if (category === 'subclass') {
    return true;
  }
  if (category === 'subproperty' || category === 'object') {
    return options.showObjectProperties;
  }
  return true;
}

function detectRawRdfCategory(predicateIri, objectTermType) {
  if (predicateIri === RDFS_SUBCLASS_OF) {
    return 'subclass';
  }
  if (predicateIri === RDFS_SUBPROPERTY_OF) {
    return 'subproperty';
  }
  if (predicateIri === RDF_TYPE) {
    return 'type';
  }
  if (METADATA_PREDICATES.has(predicateIri)) {
    return 'annotation';
  }
  if (objectTermType === 'Literal') {
    return 'data';
  }
  return 'object';
}

function detectRawRdfAxiomKind(predicateIri, category) {
  if (predicateIri === RDFS_SUBCLASS_OF) {
    return 'SubClassOf';
  }
  if (predicateIri === RDFS_SUBPROPERTY_OF) {
    return 'SubPropertyOf';
  }
  if (predicateIri === RDF_TYPE) {
    return 'ClassAssertion';
  }
  if (predicateIri === RDFS_DOMAIN) {
    return 'Domain';
  }
  if (predicateIri === RDFS_RANGE) {
    return 'Range';
  }
  if (
    predicateIri === OWL_EQUIVALENT_CLASS ||
    predicateIri === OWL_DISJOINT_WITH ||
    predicateIri === OWL_DISJOINT_UNION_OF ||
    predicateIri === OWL_EQUIVALENT_PROPERTY ||
    predicateIri === OWL_INVERSE_OF ||
    predicateIri === OWL_SAME_AS ||
    predicateIri === OWL_DIFFERENT_FROM ||
    predicateIri === OWL_HAS_KEY
  ) {
    return compactIri(predicateIri);
  }
  if (EXPRESSION_PREDICATES.has(predicateIri)) {
    return 'ClassExpression';
  }
  if (RESTRICTION_VALUE_PREDICATES.has(predicateIri) || RESTRICTION_CARDINALITY_PREDICATES.has(predicateIri) || predicateIri === OWL_ON_PROPERTY || predicateIri === OWL_HAS_SELF) {
    return 'Restriction';
  }
  if (category === 'annotation') {
    return 'AnnotationAssertion';
  }
  if (category === 'data' || category === 'object') {
    return 'PropertyAssertion';
  }
  return 'Axiom';
}

function buildRawRdfProjectionElements(graphData, focusedNodeIds, options) {
  const nodeElementsById = new Map();
  const edgeElements = [];
  const typeTargetNodeIds = new Set();
  let edgeCounter = 0;

  const isDisplayOnlyNodeId = (nodeId) => DISPLAY_ONLY_NODE_IDS.has(nodeId);
  const isSuppressedRdfMetaclassNodeId = (nodeId) =>
    nodeId === OWL_ASYMMETRIC_PROPERTY || PROPERTY_CHARACTERISTIC_CLASS_IDS.has(nodeId);
  const isPropertyLikeNode = (node) =>
    Boolean(
      node &&
        (
          node.ontologyKind === 'object-property' ||
          node.ontologyKind === 'data-property' ||
          node.ontologyKind === 'annotation-property' ||
          node.entityCategory === 'object-property' ||
          node.entityCategory === 'data-property' ||
          node.entityCategory === 'annotation-property'
        ),
    );

  const ensureNodeElement = (term) => {
    if (!term) {
      return null;
    }
    const id = getTermId(term);
    if (isDisplayOnlyNodeId(id)) {
      return null;
    }
    if (isSuppressedRdfMetaclassNodeId(id)) {
      return null;
    }
    const existingNode = graphData?.nodeMap?.get(id);
    if (isPropertyLikeNode(existingNode)) {
      return null;
    }
    if (nodeElementsById.has(id)) {
      return nodeElementsById.get(id);
    }

    const element = makeNodeElementFromGraphNode(existingNode) || makeFallbackNodeElement(term);
    if (!element) {
      return null;
    }

    nodeElementsById.set(id, element);
    return element;
  };

  const includeByFocus = (subjectTerm, objectTerm) => {
    if (!(focusedNodeIds instanceof Set)) {
      return true;
    }

    const subjectVisible = subjectTerm && focusedNodeIds.has(getTermId(subjectTerm));
    if (!objectTerm) {
      return subjectVisible;
    }
    const objectVisible = focusedNodeIds.has(getTermId(objectTerm));
    return subjectVisible || objectVisible;
  };

  for (const quad of graphData?.quads ?? []) {
    if (!quad?.subject || !quad?.predicate || !quad?.object) {
      continue;
    }
    if (!matchesNamedGraphSelection(getQuadGraphFilterId(quad), options.selectedNamedGraphIds)) {
      continue;
    }
    if (isProvIri(quad.predicate.value)) {
      continue;
    }

    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_NAMED_INDIVIDUAL
    ) {
      continue;
    }

    const objectIsNode =
      quad.object.termType === 'NamedNode' ||
      quad.object.termType === 'BlankNode';
    const objectIsLiteral = quad.object.termType === 'Literal';
    if (!objectIsNode && !objectIsLiteral) {
      continue;
    }

    if (!includeByFocus(quad.subject, objectIsNode || objectIsLiteral ? quad.object : null)) {
      continue;
    }

    const category = detectRawRdfCategory(quad.predicate.value, quad.object.termType);
    if (!shouldIncludeRawRdfEdge(category, options)) {
      continue;
    }
    if (quad.predicate.value === RDF_TYPE && quad.object.termType === 'NamedNode') {
      typeTargetNodeIds.add(getTermId(quad.object));
    }

    const sourceNode = graphData?.nodeMap?.get(getTermId(quad.subject));
    const targetNode = graphData?.nodeMap?.get(getTermId(quad.object));
    if (isPropertyLikeNode(sourceNode) || isPropertyLikeNode(targetNode)) {
      continue;
    }
    if (isProvNode(sourceNode) || isProvNode(targetNode)) {
      continue;
    }

    const sourceElement = ensureNodeElement(quad.subject);
    const targetElement = ensureNodeElement(quad.object);
    if (!sourceElement || !targetElement) {
      continue;
    }

    edgeElements.push({
      data: {
        id: `rdf-raw:${edgeCounter}`,
        source: sourceElement.data.id,
        target: targetElement.data.id,
        predicate: quad.predicate.value,
        predicateLabel:
          quad.predicate.value === RDF_TYPE || quad.predicate.value === RDFS_SUBCLASS_OF
            ? ''
            : compactIri(quad.predicate.value),
        category,
        axiomKind: detectRawRdfAxiomKind(quad.predicate.value, category),
        restrictionKind: '',
        cardinalityLabel: '',
        owlEdgeStyle: 'straight',
        rdfViewEdge: 1,
        isSelfLoop: sourceElement.data.id === targetElement.data.id ? 1 : 0,
      },
    });
    edgeCounter += 1;
  }

  const candidateNodes = focusedNodeIds instanceof Set
    ? graphData?.nodes?.filter((node) => focusedNodeIds.has(node.id)) ?? []
    : graphData?.nodes ?? [];

  for (const node of candidateNodes) {
    if (!matchesNamedGraphSelection(node?.namedGraphIds, options.selectedNamedGraphIds)) {
      continue;
    }
    if (node?.termType === 'Literal') {
      continue;
    }
    if (isProvNode(node)) {
      continue;
    }
    if (isDisplayOnlyNodeId(node.id)) {
      continue;
    }
    if (isSuppressedRdfMetaclassNodeId(node.id)) {
      continue;
    }
    if (isPropertyLikeNode(node)) {
      continue;
    }
    ensureNodeElement({
      termType: node.termType,
      value: node.termType === 'BlankNode' ? node.id.replace(/^_:/, '') : node.iri || node.id,
      datatype: { value: node.literalDatatype || '' },
      language: node.literalLanguage || '',
    });
  }

  for (const [nodeId, nodeElement] of nodeElementsById.entries()) {
    if (!typeTargetNodeIds.has(nodeId)) {
      continue;
    }
    const data = nodeElement?.data;
    if (!data || data.termType !== 'NamedNode') {
      continue;
    }
    if (
      data.ontologyKind === 'object-property' ||
      data.ontologyKind === 'data-property' ||
      data.ontologyKind === 'annotation-property' ||
      data.ontologyKind === 'datatype'
    ) {
      continue;
    }
    data.ontologyKind = 'class';
    data.entityCategory = 'class';
  }

  return [...nodeElementsById.values(), ...edgeElements];
}

function applyRdfSpecProjection(graphData, elements) {
  const nodeElements = elements.filter((element) => !element?.data?.source);
  const edgeElements = elements.filter((element) => element?.data?.source);
  const nodeElementsById = new Map(nodeElements.map((element) => [element.data.id, cloneElement(element)]));
  const hiddenNodeIds = new Set();
  const hiddenEdgeIds = new Set();
  const addedEdges = [];
  const addedEdgeIds = new Set(edgeElements.map((element) => element.data.id));
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const incomingByTarget = buildIncomingEdgeIndex(graphData);
  const typeEdgesBySource = new Map();

  for (const edge of graphData?.objectEdges ?? []) {
    if (edge.predicate !== RDF_TYPE) {
      continue;
    }
    const rows = typeEdgesBySource.get(edge.source) ?? [];
    rows.push(edge);
    typeEdgesBySource.set(edge.source, rows);
  }

  const ensureNodeVisible = (nodeId, overrides = {}) => {
    if (!nodeId) {
      return null;
    }
    const existing = nodeElementsById.get(nodeId);
    if (existing) {
      Object.assign(existing.data, overrides);
      return existing;
    }
    const sourceNode = graphData?.nodeMap?.get(nodeId);
    const nodeElement = makeNodeElementFromGraphNode(sourceNode);
    if (!nodeElement) {
      return null;
    }
    Object.assign(nodeElement.data, overrides);
    nodeElementsById.set(nodeId, nodeElement);
    return nodeElement;
  };

  const addSyntheticEdge = (data) => {
    if (!data?.id || addedEdgeIds.has(data.id)) {
      return;
    }
    addedEdgeIds.add(data.id);
    addedEdges.push({ data });
  };

  for (const nodeElement of nodeElementsById.values()) {
    const nodeData = nodeElement.data;
    if (nodeData.entityCategory !== 'datatype') {
      continue;
    }
    if (nodeData.id === RDFS_DATATYPE) {
      nodeData.rdfDatatypeRoot = 1;
    }
    if ([RDF_LANG_STRING, RDF_HTML, RDF_XML_LITERAL].includes(nodeData.id)) {
      nodeData.rdfDatatypeDefinedSubtype = 1;
    }
  }

  const handledListHeads = new Set();

  for (const [sourceId, typeEdges] of typeEdgesBySource.entries()) {
    const typeTargets = new Set(typeEdges.map((edge) => edge.target));
    const isAllDifferent = typeTargets.has(OWL_ALL_DIFFERENT);
    const isAllDisjointClasses = typeTargets.has(OWL_ALL_DISJOINT_CLASSES);
    if (!isAllDifferent && !isAllDisjointClasses) {
      continue;
    }

    const memberPredicate = isAllDifferent ? OWL_DISTINCT_MEMBERS : OWL_MEMBERS;
    const listEdge = (graphData.objectEdges ?? []).find(
      (edge) => edge.source === sourceId && edge.predicate === memberPredicate,
    );
    if (!listEdge) {
      continue;
    }

    const memberIds = readListMembers(listEdge.target, outgoingBySource);
    if (memberIds.length === 0) {
      continue;
    }

    handledListHeads.add(listEdge.target);
    hiddenNodeIds.add(sourceId);

    const connectorId = `rdf-owl-collection:${sourceId}`;
    if (!nodeElementsById.has(connectorId)) {
      nodeElementsById.set(connectorId, {
        data: {
          ...makeAxiomMarkerNodeData(connectorId, isAllDifferent ? '!=' : '≢'),
          entityCategory: 'rdf-connector',
          rdfConnectorKind: isAllDifferent ? 'all-different' : 'all-disjoint-classes',
        },
      });
    }

    for (const rawEdge of edgeElements) {
      if (
        (rawEdge.data.source === sourceId && rawEdge.data.predicate === RDF_TYPE && typeTargets.has(rawEdge.data.target)) ||
        (rawEdge.data.source === sourceId && rawEdge.data.predicate === memberPredicate && rawEdge.data.target === listEdge.target)
      ) {
        hiddenEdgeIds.add(rawEdge.data.id);
      }
      if (rawEdge.data.target === sourceId) {
        hiddenEdgeIds.add(rawEdge.data.id);
        addSyntheticEdge({
          ...rawEdge.data,
          id: `${rawEdge.data.id}:owl-collection-target`,
          target: connectorId,
          rdfViewEdge: 1,
        });
      }
    }

    let cursorId = listEdge.target;
    const visited = new Set();
    while (cursorId && cursorId !== RDF_NIL && !visited.has(cursorId)) {
      visited.add(cursorId);
      hiddenNodeIds.add(cursorId);
      for (const rawEdge of edgeElements) {
        if (
          (rawEdge.data.source === cursorId && (rawEdge.data.predicate === RDF_FIRST || rawEdge.data.predicate === RDF_REST)) ||
          (rawEdge.data.source === cursorId && rawEdge.data.predicate === RDF_TYPE && rawEdge.data.target === RDF_LIST)
        ) {
          hiddenEdgeIds.add(rawEdge.data.id);
        }
      }
      const restEdge = (outgoingBySource.get(cursorId) ?? []).find((edge) => edge.predicate === RDF_REST);
      cursorId = restEdge?.target ?? '';
    }

    memberIds.forEach((memberId, index) => {
      ensureNodeVisible(memberId);
      addSyntheticEdge({
        id: `${connectorId}:member:${index}`,
        source: connectorId,
        target: memberId,
        predicate: memberPredicate,
        predicateLabel: '',
        category: 'object',
        axiomKind: isAllDifferent ? 'AllDifferent' : 'AllDisjointClasses',
        restrictionKind: '',
        owlEdgeStyle: 'straight',
        rdfViewEdge: 1,
      });
    });
  }

  const declarations = collectPropertyDeclarations(graphData);
  for (const declaration of declarations.values()) {
    if (declaration.propertyKind === 'annotation-property') {
      continue;
    }
    for (const edgeElement of edgeElements) {
      if (
        edgeElement.data.source === declaration.propertyId &&
        (edgeElement.data.predicate === RDFS_DOMAIN || edgeElement.data.predicate === RDFS_RANGE)
      ) {
        hiddenEdgeIds.add(edgeElement.data.id);
      }
    }
    if (declaration.domains.size === 0 || declaration.ranges.size === 0) {
      continue;
    }
    for (const rangeId of declaration.ranges) {
      for (const domainId of declaration.domains) {
        if (!ensureNodeVisible(rangeId) || !ensureNodeVisible(domainId)) {
          continue;
        }
        addSyntheticEdge({
          id: `rdf-prop:${declaration.propertyId}:${rangeId}:${domainId}`,
          source: rangeId,
          target: domainId,
          predicate: declaration.propertyId,
          predicateLabel: declaration.label,
          category: declaration.propertyKind === 'data-property' ? 'data' : 'object',
          axiomKind: 'PropertyProjection',
          restrictionKind: '',
          owlEdgeStyle: declaration.propertyKind === 'data-property' ? 'dashed' : 'straight',
          rdfViewEdge: 1,
          rdfPropertyProjection: 1,
          isSelfLoop: rangeId === domainId ? 1 : 0,
        });
      }
    }
  }

  for (const [nodeId, typeEdges] of typeEdgesBySource.entries()) {
    const visibleNode = nodeElementsById.get(nodeId);
    if (!visibleNode) {
      continue;
    }
    const containerTypeEdge = typeEdges.find((edge) => [RDFS_CONTAINER, RDF_BAG, RDF_SEQ, RDF_ALT].includes(edge.target));
    if (containerTypeEdge) {
      const memberEdges = (graphData.objectEdges ?? [])
        .filter((edge) => edge.source === nodeId && isContainerMembershipPredicate(edge.predicate))
        .sort((left, right) => {
          const leftMatch = left.predicate.match(/_(\d+)$/);
          const rightMatch = right.predicate.match(/_(\d+)$/);
          return Number(leftMatch?.[1] ?? 0) - Number(rightMatch?.[1] ?? 0);
        });
      if (memberEdges.length > 0) {
        const connectorId = `rdf-container:${nodeId}`;
        if (!nodeElementsById.has(connectorId)) {
          const connector = {
            data: {
              ...makeCollectionConnectorNodeData(connectorId, rdfContainerSymbol(containerTypeEdge.target), 'RdfContainerConnector', memberEdges.length),
              entityCategory: 'rdf-connector',
              rdfConnectorKind: 'container',
            },
          };
          nodeElementsById.set(connectorId, connector);
        }
        addSyntheticEdge({
          id: `${connectorId}:owner`,
          source: nodeId,
          target: connectorId,
          predicate: containerTypeEdge.target,
          predicateLabel: '',
          category: 'object',
          axiomKind: 'Container',
          restrictionKind: '',
          owlEdgeStyle: 'straight',
          rdfViewEdge: 1,
        });
        for (const memberEdge of memberEdges) {
          ensureNodeVisible(memberEdge.target);
          addSyntheticEdge({
            id: `${connectorId}:member:${memberEdge.id}`,
            source: connectorId,
            target: memberEdge.target,
            predicate: RDFS_MEMBER,
            predicateLabel: 'member',
            category: 'object',
            axiomKind: 'ContainerMember',
            restrictionKind: '',
            owlEdgeStyle: 'straight',
            rdfViewEdge: 1,
          });
          for (const rawEdge of edgeElements) {
            if (rawEdge.data.source === memberEdge.source && rawEdge.data.target === memberEdge.target && rawEdge.data.predicate === memberEdge.predicate) {
              hiddenEdgeIds.add(rawEdge.data.id);
            }
          }
        }
      }
      for (const rawEdge of edgeElements) {
        if (rawEdge.data.source === nodeId && rawEdge.data.predicate === RDF_TYPE && rawEdge.data.target === containerTypeEdge.target) {
          hiddenEdgeIds.add(rawEdge.data.id);
        }
      }
    }
  }

  for (const [nodeId, nodeElement] of nodeElementsById.entries()) {
    const nodeData = nodeElement.data;
    const typeTargets = new Set((typeEdgesBySource.get(nodeId) ?? []).map((edge) => edge.target));
    const isListCell = nodeData.blankExpressionType === 'List' || typeTargets.has(RDF_LIST);
    const hasIncomingRest = (incomingByTarget.get(nodeId) ?? []).some((edge) => edge.predicate === RDF_REST);
    if (!isListCell || handledListHeads.has(nodeId) || hasIncomingRest) {
      continue;
    }

    const memberIds = readListMembers(nodeId, outgoingBySource);
    if (memberIds.length === 0) {
      continue;
    }

    const connectorId = `rdf-list:${nodeId}`;
    if (!nodeElementsById.has(connectorId)) {
      nodeElementsById.set(connectorId, {
        data: {
          ...makeCollectionConnectorNodeData(connectorId, '[]', 'RdfListConnector', memberIds.length),
          entityCategory: 'rdf-connector',
          rdfConnectorKind: 'list',
        },
      });
    }

    hiddenNodeIds.add(nodeId);

    const incomingToHead = edgeElements.filter(
      (edge) => edge.data.target === nodeId && edge.data.predicate !== RDF_FIRST && edge.data.predicate !== RDF_REST,
    );
    for (const incomingEdge of incomingToHead) {
      hiddenEdgeIds.add(incomingEdge.data.id);
      addSyntheticEdge({
        ...incomingEdge.data,
        id: `${incomingEdge.data.id}:list-target`,
        target: connectorId,
        rdfViewEdge: 1,
      });
    }

    let cursorId = nodeId;
    const visited = new Set();
    while (cursorId && cursorId !== RDF_NIL && !visited.has(cursorId)) {
      visited.add(cursorId);
      hiddenNodeIds.add(cursorId);
      for (const edge of edgeElements) {
        if (
          (edge.data.source === cursorId && (edge.data.predicate === RDF_FIRST || edge.data.predicate === RDF_REST)) ||
          (edge.data.source === cursorId && edge.data.predicate === RDF_TYPE && edge.data.target === RDF_LIST)
        ) {
          hiddenEdgeIds.add(edge.data.id);
        }
      }
      const restEdge = (outgoingBySource.get(cursorId) ?? []).find((edge) => edge.predicate === RDF_REST);
      cursorId = restEdge?.target ?? '';
    }

    memberIds.forEach((memberId, index) => {
      ensureNodeVisible(memberId);
      addSyntheticEdge({
        id: `${connectorId}:member:${index}`,
        source: connectorId,
        target: memberId,
        predicate: RDF_LIST,
        predicateLabel: ordinalLabel(index),
        category: 'object',
        axiomKind: 'ListMember',
        restrictionKind: '',
        owlEdgeStyle: 'straight',
        rdfViewEdge: 1,
      });
    });
  }

  const filteredNodes = Array.from(nodeElementsById.values()).filter((element) => !hiddenNodeIds.has(element.data.id));
  const filteredEdges = edgeElements.filter((element) => !hiddenEdgeIds.has(element.data.id));
  return [...filteredNodes, ...filteredEdges, ...addedEdges];
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

function buildDatatypeFacetInterval(graphData, facetNodeIds, outgoingAllBySource) {
  const bounds = {
    minInclusive: '',
    maxInclusive: '',
    minExclusive: '',
    maxExclusive: '',
  };

  for (const facetNodeId of facetNodeIds) {
    const outgoing = outgoingAllBySource.get(facetNodeId) ?? [];
    for (const edge of outgoing) {
      const targetNode = graphData.nodeMap.get(edge.target);
      const value = String(targetNode?.literalValue || targetNode?.fullLabel || '').trim();
      if (!value) {
        continue;
      }
      if (edge.predicate === XSD_MIN_INCLUSIVE) {
        bounds.minInclusive = value;
      } else if (edge.predicate === XSD_MAX_INCLUSIVE) {
        bounds.maxInclusive = value;
      } else if (edge.predicate === XSD_MIN_EXCLUSIVE) {
        bounds.minExclusive = value;
      } else if (edge.predicate === XSD_MAX_EXCLUSIVE) {
        bounds.maxExclusive = value;
      }
    }
  }

  const leftValue = bounds.minInclusive || bounds.minExclusive;
  const rightValue = bounds.maxInclusive || bounds.maxExclusive;
  if (!leftValue && !rightValue) {
    return '';
  }

  const leftBracket = bounds.minExclusive ? '(' : '[';
  const rightBracket = bounds.maxExclusive ? ')' : ']';
  if (leftValue && rightValue) {
    return `${leftBracket}${leftValue}, ${rightValue}${rightBracket} in`;
  }
  if (leftValue) {
    return `${leftBracket}${leftValue}, ... in`;
  }
  return `..., ${rightValue}${rightBracket} in`;
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

function mergeCardinalityMarkers(...values) {
  const markers = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (text && !markers.includes(text)) {
      markers.push(text);
    }
  }
  if (markers.length === 0) {
    return '';
  }
  if (markers.length === 1) {
    return markers[0];
  }
  return markers.join(' + ');
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

function shouldDecorateRestrictionEdge(predicate) {
  return predicate !== OWL_HAS_VALUE;
}

function makeSupplementalTargetNodeElement(graphData, targetId) {
  const targetNode = graphData?.nodeMap?.get(targetId);
  if (!targetNode) {
    return null;
  }

  return makeNodeElementFromGraphNode(targetNode);
}

function buildProjectedRestrictionTargetNode(
  graphData,
  targetNodeId,
  visibleNodeIds,
  propertyDeclarations,
  indexes,
  contextKey,
  seen = new Set(),
) {
  if (!targetNodeId || seen.has(targetNodeId)) {
    return null;
  }

  const targetNode = graphData.nodeMap.get(targetNodeId);
  if (!targetNode || targetNode.termType !== 'BlankNode') {
    return null;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(targetNodeId);
  const { outgoingBySource } = indexes;
  const outgoing = outgoingBySource.get(targetNodeId) ?? [];

  const restrictionProjection = buildRestrictionTargetSpecs(
    graphData,
    targetNodeId,
    visibleNodeIds,
    propertyDeclarations,
    indexes,
    `${contextKey}:restriction`,
    nextSeen,
  );
  if (restrictionProjection && restrictionProjection.targetSpecs.length > 0) {
    const connectorId = `owl-target-restr:${contextKey}:${targetNodeId}`;
    const restrictionKind = targetNode.restrictionKind || restrictionProjection.restrictionKind || 'Restriction';
    const connectorNodeData = makeRestrictionConnectorNodeData(
      connectorId,
      restrictionKind,
      restrictionKind,
    );
    connectorNodeData.connectorAxiomText = targetNode.restrictionTooltip || restrictionKind;

    const nestedEdges = [];
    for (const targetSpec of restrictionProjection.targetSpecs) {
      const resolvedTargetId = targetSpec.targetId === '__self__' ? connectorId : targetSpec.targetId;
      if (
        !visibleNodeIds.has(resolvedTargetId) &&
        !restrictionProjection.supplementalNodeIds.has(resolvedTargetId) &&
        !String(resolvedTargetId).startsWith('owl-card:')
      ) {
        continue;
      }

      const basePredicateLabel = targetSpec.forceStarSuffix
        ? restrictionProjection.propertyBaseLabel
        : `${restrictionPredicatePrefix(targetSpec.predicate)}${restrictionProjection.propertyBaseLabel}${restrictionPredicateSuffix(targetSpec.predicate)}`;
      nestedEdges.push({
        data: {
          id: `${connectorId}:nested:${resolvedTargetId}:${targetSpec.predicate}`,
          source: connectorId,
          target: resolvedTargetId,
          predicate: restrictionProjection.onPropertyId,
          predicateLabel: decorateRelationLabel(basePredicateLabel, {
            isRestriction: shouldDecorateRestrictionEdge(targetSpec.predicate),
            hasDetailRows:
              Array.isArray(targetSpec.projectedMetadataRows) && targetSpec.projectedMetadataRows.length > 0,
          }),
          category: restrictionProjection.propertyKind === 'data-property' ? 'data' : 'object',
          axiomKind: 'ClassExpressionRestriction',
          restrictionKind: restrictionProjection.restrictionKind || compactIri(targetSpec.predicate),
          sourceCardinality: targetSpec.sourceCardinality,
          showSourceCardinality: targetSpec.sourceCardinality ? 1 : 0,
          owlEdgeStyle: 'dotted',
          owlSynthesized: 1,
          isSelfLoop: resolvedTargetId === connectorId || targetSpec.isSelfLoop ? 1 : 0,
          projectedMetadataRows: targetSpec.projectedMetadataRows,
        },
      });
    }

    if (nestedEdges.length === 0) {
      return null;
    }

    return {
      rootTargetId: connectorId,
      synthesizedNodes: [{ data: connectorNodeData }, ...restrictionProjection.supplementalNodes],
      synthesizedEdges: [...restrictionProjection.supplementalEdges, ...nestedEdges],
      hiddenNodeIds: new Set([targetNodeId, ...restrictionProjection.hiddenNodeIds]),
      supplementalNodeIds: new Set([connectorId, ...restrictionProjection.supplementalNodeIds]),
    };
  }

  const expressionConfig = new Map([
    [OWL_INTERSECTION_OF, { label: '∩', kind: 'Intersection', joiner: 'and' }],
    [OWL_UNION_OF, { label: '∪', kind: 'Union', joiner: 'or' }],
    [OWL_ONE_OF, { label: '{}', kind: 'OneOf', joiner: ', ' }],
    [OWL_COMPLEMENT_OF, { label: '¬', kind: 'Complement', joiner: 'or' }],
  ]);
  const expressionEdge = outgoing.find((edge) => expressionConfig.has(edge.predicate));
  if (!expressionEdge) {
    return null;
  }

  const config = expressionConfig.get(expressionEdge.predicate);
  const connectorId = `owl-target-expr:${contextKey}:${config.kind}:${targetNodeId}`;
  const connectorNodeData = makeExpressionNodeData(connectorId, config.label, config.kind);
  const memberIds =
    expressionEdge.predicate === OWL_COMPLEMENT_OF
      ? [expressionEdge.target]
      : readListMembers(expressionEdge.target, outgoingBySource);
  const synthesizedNodes = [{ data: connectorNodeData }];
  const synthesizedEdges = [];
  const hiddenNodeIds = new Set([targetNodeId]);
  const supplementalNodeIds = new Set([connectorId]);

  if (expressionEdge.target && expressionEdge.predicate !== OWL_COMPLEMENT_OF) {
    hiddenNodeIds.add(expressionEdge.target);
  }

  const connectorTexts = [];
  for (const memberId of memberIds) {
    let resolvedTargetId = memberId;
    let nestedProjection = null;
    if (!visibleNodeIds.has(memberId)) {
      nestedProjection = buildProjectedRestrictionTargetNode(
        graphData,
        memberId,
        visibleNodeIds,
        propertyDeclarations,
        indexes,
        `${contextKey}:${memberId}`,
        nextSeen,
      );
      if (!nestedProjection) {
        continue;
      }
      resolvedTargetId = nestedProjection.rootTargetId;
      synthesizedNodes.push(...nestedProjection.synthesizedNodes);
      synthesizedEdges.push(...nestedProjection.synthesizedEdges);
      for (const hiddenNodeId of nestedProjection.hiddenNodeIds) {
        hiddenNodeIds.add(hiddenNodeId);
      }
      for (const supplementalNodeId of nestedProjection.supplementalNodeIds) {
        supplementalNodeIds.add(supplementalNodeId);
      }
    }

    connectorTexts.push(manchesterNodeText(graphData, memberId));
    synthesizedEdges.push({
      data: {
        id: `${connectorId}:member:${resolvedTargetId}:${memberId}`,
        source: connectorId,
        target: resolvedTargetId,
        predicate: expressionEdge.predicate,
        predicateLabel: '',
        category: 'object',
        axiomKind: 'ClassExpression',
        owlEdgeStyle: 'dotted',
        owlSynthesized: 1,
      },
    });
  }

  if (connectorTexts.length === 0) {
    return null;
  }

  if (config.kind === 'Complement') {
    connectorNodeData.connectorAxiomText = `not ${connectorTexts.join(' or ')}`;
  } else if (config.kind === 'OneOf') {
    connectorNodeData.connectorAxiomText = `{ ${connectorTexts.join(', ')} }`;
  } else {
    connectorNodeData.connectorAxiomText = connectorTexts.join(` ${config.joiner} `);
  }

  return {
    rootTargetId: connectorId,
    synthesizedNodes,
    synthesizedEdges,
    hiddenNodeIds,
    supplementalNodeIds,
  };
}

function buildRestrictionTargetSpecs(
  graphData,
  restrictionNodeId,
  visibleNodeIds,
  propertyDeclarations,
  indexes = null,
  contextKey = restrictionNodeId,
  seen = new Set(),
) {
  const effectiveIndexes = indexes ?? {
    outgoingBySource: buildOutgoingEdgeIndex(graphData),
    outgoingAllBySource: buildOutgoingAllEdgeIndex(graphData),
    outgoingLiteralBySource: buildOutgoingLiteralEdgeIndex(graphData),
  };
  const { outgoingBySource, outgoingAllBySource, outgoingLiteralBySource } = effectiveIndexes;
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
  const supplementalEdges = [];
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
        sourceCardinality:
          buildDatatypeFacetInterval(
            graphData,
            withRestrictionsEdge ? readListMembers(withRestrictionsEdge.target, outgoingBySource) : [],
            outgoingAllBySource,
          ) || combinedCardinality,
        forceStarSuffix: true,
        forcePlainLabel: true,
        suppressRestrictionDecoration: true,
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

    if (targetNode?.termType === 'BlankNode') {
      const nestedProjection = buildProjectedRestrictionTargetNode(
        graphData,
        edge.target,
        visibleNodeIds,
        propertyDeclarations,
        effectiveIndexes,
        `${contextKey}:${edge.id}`,
        seen,
      );
      if (nestedProjection) {
        hiddenNodeIds.add(edge.target);
        for (const hiddenNodeId of nestedProjection.hiddenNodeIds) {
          hiddenNodeIds.add(hiddenNodeId);
        }
        supplementalNodes.push(...nestedProjection.synthesizedNodes);
        supplementalEdges.push(...nestedProjection.synthesizedEdges);
        for (const supplementalNodeId of nestedProjection.supplementalNodeIds) {
          supplementalNodeIds.add(supplementalNodeId);
        }
        targetSpecs.push({
          targetId: nestedProjection.rootTargetId,
          predicate: edge.predicate,
          sourceCardinality: combinedCardinality,
          projectedMetadataRows: [],
        });
        continue;
      }
    }

    if (!visibleNodeIds.has(edge.target)) {
      const supplementalTargetNode = makeSupplementalTargetNodeElement(graphData, edge.target);
      if (supplementalTargetNode) {
        supplementalNodes.push(supplementalTargetNode);
        supplementalNodeIds.add(edge.target);
      }
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
    supplementalEdges,
    supplementalNodeIds,
  };
}

function synthesizeRestrictionProjection(graphData, visibleNodeIds, propertyDeclarations) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const incomingByTarget = buildIncomingEdgeIndex(graphData);
  const outgoingLiteralBySource = buildOutgoingLiteralEdgeIndex(graphData);
  const outgoingAllBySource = buildOutgoingAllEdgeIndex(graphData);
  const indexes = {
    outgoingBySource,
    outgoingAllBySource,
    outgoingLiteralBySource,
  };
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

    const restrictionProjection = buildRestrictionTargetSpecs(
      graphData,
      node.id,
      visibleNodeIds,
      propertyDeclarations,
      indexes,
      node.id,
    );
    if (!restrictionProjection) {
      continue;
    }
    const {
      propertyBaseLabel,
      targetSpecs,
      hiddenNodeIds: restrictionHiddenNodeIds,
      supplementalNodes,
      supplementalEdges,
      supplementalNodeIds,
    } =
      restrictionProjection;
    for (const hiddenNodeId of restrictionHiddenNodeIds) {
      hiddenNodeIds.add(hiddenNodeId);
    }
    synthesizedNodes.push(...supplementalNodes);
    synthesizedEdges.push(...supplementalEdges);
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
        const basePredicateLabel = targetSpec.forcePlainLabel
          ? propertyBaseLabel
          : targetSpec.forceStarSuffix
          ? propertyBaseLabel
          : `${restrictionPredicatePrefix(targetSpec.predicate)}${propertyBaseLabel}${restrictionPredicateSuffix(targetSpec.predicate)}`;
        const restrictionLabelMarker =
          anchorEdge.predicate === OWL_EQUIVALENT_CLASS
            ? '**'
            : anchorEdge.predicate === RDFS_SUBCLASS_OF
              ? '*'
              : '*';
        const predicateLabel = decorateRelationLabel(basePredicateLabel, {
          isRestriction: targetSpec.suppressRestrictionDecoration ? false : shouldDecorateRestrictionEdge(targetSpec.predicate),
          restrictionMarker: restrictionLabelMarker,
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
            restrictionLabelMarker,
            owlSynthesized: 1,
            owlEdgeStyle: propertyDeclaration?.propertyKind === 'data-property' ? 'dashed' : 'straight',
            isSelfLoop: resolvedTargetId === anchorEdge.source || targetSpec.isSelfLoop ? 1 : 0,
            projectedMetadataRows: targetSpec.projectedMetadataRows,
          },
        });
      }
    }
  }

  const helperEdgeIdsToRemove = new Set();
  const helperNodeIdsToRemove = new Set();

  for (const edgeElement of synthesizedEdges) {
    const edgeData = edgeElement?.data;
    if (!edgeData?.source || !String(edgeData.target || '').startsWith('owl-card:')) {
      continue;
    }

    const matchingTargetEdges = synthesizedEdges.filter((candidateElement) => {
      const candidate = candidateElement?.data;
      if (!candidate?.source) {
        return false;
      }
      if (candidate.id === edgeData.id) {
        return false;
      }
      if (candidate.source !== edgeData.source || candidate.predicate !== edgeData.predicate) {
        return false;
      }
      return !String(candidate.target || '').startsWith('owl-card:');
    });

    if (matchingTargetEdges.length === 0) {
      continue;
    }

    for (const candidateElement of matchingTargetEdges) {
      const candidate = candidateElement.data;
      candidate.sourceCardinality = mergeCardinalityMarkers(candidate.sourceCardinality, edgeData.sourceCardinality);
      candidate.showSourceCardinality = candidate.sourceCardinality ? 1 : 0;
    }

    helperEdgeIdsToRemove.add(edgeData.id);
    helperNodeIdsToRemove.add(edgeData.target);
  }

  const mergedSynthesizedEdges =
    helperEdgeIdsToRemove.size === 0
      ? synthesizedEdges
      : synthesizedEdges.filter((edgeElement) => !helperEdgeIdsToRemove.has(edgeElement?.data?.id));

  const mergedSynthesizedNodes =
    helperNodeIdsToRemove.size === 0
      ? synthesizedNodes
      : synthesizedNodes.filter((nodeElement) => !helperNodeIdsToRemove.has(nodeElement?.data?.id));

  return {
    synthesizedNodes: mergedSynthesizedNodes,
    synthesizedEdges: mergedSynthesizedEdges,
    hiddenNodeIds,
  };
}

function synthesizeDatatypeDefinitionProjection(graphData, visibleNodeIds) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const outgoingAllBySource = buildOutgoingAllEdgeIndex(graphData);
  const synthesizedNodes = [];
  const synthesizedEdges = [];
  const addedNodeIds = new Set();

  for (const edge of graphData?.objectEdges ?? []) {
    if (edge.predicate !== OWL_EQUIVALENT_CLASS && edge.predicate !== RDFS_SUBCLASS_OF) {
      continue;
    }

    const sourceNode = graphData?.nodeMap?.get(edge.source);
    const targetNode = graphData?.nodeMap?.get(edge.target);
    if (sourceNode?.entityCategory !== 'datatype' || targetNode?.termType !== 'BlankNode') {
      continue;
    }

    const targetOutgoing = outgoingAllBySource.get(edge.target) ?? [];
    const onDatatypeEdge = targetOutgoing.find((row) => row.predicate === OWL_ON_DATATYPE);
    const withRestrictionsEdge = targetOutgoing.find((row) => row.predicate === OWL_WITH_RESTRICTIONS);
    if (!onDatatypeEdge) {
      continue;
    }

    const datatypeTargetId = onDatatypeEdge.target;
    if (!visibleNodeIds.has(datatypeTargetId) && !addedNodeIds.has(datatypeTargetId)) {
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
        synthesizedNodes.push(datatypeElement);
        addedNodeIds.add(datatypeTargetId);
      }
    }

    const intervalLabel = buildDatatypeFacetInterval(
      graphData,
      withRestrictionsEdge ? readListMembers(withRestrictionsEdge.target, outgoingBySource) : [],
      outgoingAllBySource,
    );
    const restrictionMembers = withRestrictionsEdge
      ? readListMembers(withRestrictionsEdge.target, outgoingBySource).map((id) => summarizeRestrictionFacetNode(graphData, id, outgoingAllBySource))
      : [];

    synthesizedEdges.push({
      data: {
        id: `owl-datatype-def:${edge.source}:${edge.target}:${datatypeTargetId}:${edge.predicate}`,
        source: edge.source,
        target: datatypeTargetId,
        predicate: edge.predicate,
        predicateLabel: edge.predicate === OWL_EQUIVALENT_CLASS ? '=' : 'subDatatypeOf',
        category: 'object',
        axiomKind: 'DatatypeDefinition',
        restrictionKind: '',
        sourceCardinality: intervalLabel,
        showSourceCardinality: intervalLabel ? 1 : 0,
        owlSynthesized: 1,
        owlEdgeStyle: 'straight',
        projectedMetadataRows:
          restrictionMembers.length > 0
            ? [
                {
                  key: 'owl:withRestrictions',
                  value: `(${restrictionMembers.join(' ; ')})`,
                },
              ]
            : [],
      },
    });
  }

  return {
    synthesizedNodes,
    synthesizedEdges,
  };
}

function synthesizeCollectionProjection(graphData, visibleNodeIds) {
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const synthesizedNodes = [];
  const synthesizedEdges = [];
  const hiddenNodeIds = new Set();
  const allDifferentIds = new Set(
    (graphData?.nodes ?? [])
      .filter((node) => Array.isArray(node.classes) && node.classes.includes(OWL_ALL_DIFFERENT))
      .map((node) => node.id),
  );
  const allDisjointClassIds = new Set(
    (graphData?.nodes ?? [])
      .filter((node) => Array.isArray(node.classes) && node.classes.includes(OWL_ALL_DISJOINT_CLASSES))
      .map((node) => node.id),
  );

  for (const edge of graphData?.objectEdges ?? []) {
    if (EXPRESSION_PREDICATES.has(edge.predicate) || edge.predicate === OWL_DISJOINT_UNION_OF) {
      continue;
    }
    if (
      (edge.predicate === OWL_DISTINCT_MEMBERS && allDifferentIds.has(edge.source)) ||
      (edge.predicate === OWL_MEMBERS && allDisjointClassIds.has(edge.source))
    ) {
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

    for (const cellId of collectListCellIds(edge.target, outgoingBySource)) {
      hiddenNodeIds.add(cellId);
    }
    const groupId = `owl-list:${edge.source}:${edge.target}:${edge.predicate}`;
    synthesizedNodes.push({
      data: makeCollectionConnectorNodeData(groupId, '[]', 'RdfListConnector', members.length),
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
      data: makeCollectionConnectorNodeData(groupId, '()', 'RdfSeqConnector', itemEdges.length),
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
      for (const cellId of collectListCellIds(membersEdge.target, outgoingBySource)) {
        hiddenNodeIds.add(cellId);
      }
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
      for (const cellId of collectListCellIds(membersEdge.target, outgoingBySource)) {
        hiddenNodeIds.add(cellId);
      }
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

    for (const cellId of collectListCellIds(edge.target, outgoingBySource)) {
      hiddenNodeIds.add(cellId);
    }
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
  const outgoingAllBySource = buildOutgoingAllEdgeIndex(graphData);
  const outgoingLiteralBySource = buildOutgoingLiteralEdgeIndex(graphData);
  const indexes = {
    outgoingBySource,
    outgoingAllBySource,
    outgoingLiteralBySource,
  };
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
        if (memberNode?.termType !== 'BlankNode') {
          const supplementalTargetNode = makeSupplementalTargetNodeElement(graphData, memberId);
          if (!supplementalTargetNode) {
            return null;
          }
          return {
            kind: 'node',
            targetId: memberId,
            synthesizedNodes: [supplementalTargetNode],
            synthesizedEdges: [],
            hiddenNodeIds: new Set(),
            supplementalNodeIds: new Set([memberId]),
          };
        }

        const nestedProjection = buildProjectedRestrictionTargetNode(
          graphData,
          memberId,
          visibleNodeIds,
          propertyDeclarations,
          indexes,
          `${edge.source}:${memberId}`,
        );
        if (!nestedProjection) {
          return null;
        }
        return {
          kind: 'node',
          targetId: nestedProjection.rootTargetId,
          synthesizedNodes: nestedProjection.synthesizedNodes,
          synthesizedEdges: nestedProjection.synthesizedEdges,
          hiddenNodeIds: nestedProjection.hiddenNodeIds,
          supplementalNodeIds: nestedProjection.supplementalNodeIds,
        };
      })
      .filter(Boolean);

    if (projectedMembers.length === 0) {
      continue;
    }
    for (const member of projectedMembers) {
      if (Array.isArray(member.synthesizedNodes) && member.synthesizedNodes.length > 0) {
        synthesizedNodes.push(...member.synthesizedNodes);
      }
      if (Array.isArray(member.synthesizedEdges) && member.synthesizedEdges.length > 0) {
        synthesizedEdges.push(...member.synthesizedEdges);
      }
      if (member.hiddenNodeIds instanceof Set) {
        for (const hiddenNodeId of member.hiddenNodeIds) {
          hiddenNodeIds.add(hiddenNodeId);
        }
      }
    }

    for (const anchorDescriptor of anchorDescriptors) {
      const anchorSourceId = anchorDescriptor.sourceId;
      if (config.kind === 'Complement') {
        for (const member of projectedMembers) {
          synthesizedEdges.push({
            data: {
              id: `owl-complement:${anchorSourceId}:${edge.source}:${member.targetId}`,
              source: anchorSourceId,
              target: member.targetId,
              predicate: OWL_COMPLEMENT_OF,
              predicateLabel: '¬',
              category: 'object',
              axiomKind: 'ClassExpression',
              owlEdgeStyle: 'dotted',
              owlSynthesized: 1,
            },
          });
        }
        continue;
      }
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
      const metadataRows = outgoing
        .filter((edge) => ![RDF_TYPE, RDF_SUBJECT, RDF_PREDICATE, RDF_OBJECT].includes(edge.predicate))
        .filter((edge) => !graphData.nodeMap.get(edge.target)?.classes?.includes(RDF_STATEMENT))
        .map((edge) => ({
          key: compactIri(edge.predicate),
          value: summarizeHiddenNode(graphData, edge.target),
        }));
      descriptors.push({
        kind: 'reification',
        reifierId: node.id,
        source: rdfSubject,
        predicate: rdfPredicate,
        target: rdfObjectNode || rdfObjectLiteral,
        label: 'rdf:reifies',
        structuralPredicates: new Set([RDF_SUBJECT, RDF_PREDICATE, RDF_OBJECT]),
        metadataRows,
        statementTargets: new Set(
          outgoing
            .filter((edge) => ![RDF_TYPE, RDF_SUBJECT, RDF_PREDICATE, RDF_OBJECT].includes(edge.predicate))
            .filter((edge) => graphData.nodeMap.get(edge.target)?.classes?.includes(RDF_STATEMENT))
            .map((edge) => edge.target),
        ),
      });
    }

    const annotatedSource = outgoing.find((edge) => edge.predicate === OWL_ANNOTATED_SOURCE)?.target;
    const annotatedPredicate = outgoing.find((edge) => edge.predicate === OWL_ANNOTATED_PROPERTY)?.target;
    const annotatedTargetNode = outgoing.find((edge) => edge.predicate === OWL_ANNOTATED_TARGET)?.target;
    const annotatedTargetLiteral = outgoingLiteral.find((edge) => edge.predicate === OWL_ANNOTATED_TARGET)?.target;
    const annotatedTarget = annotatedTargetNode || annotatedTargetLiteral;
    if (annotatedSource && annotatedPredicate && annotatedTarget) {
      const metadataRows = [
        ...outgoing
          .filter((edge) => ![RDF_TYPE, OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_PROPERTY, OWL_ANNOTATED_TARGET].includes(edge.predicate))
          .map((edge) => ({
            key: compactIri(edge.predicate),
            value: summarizeHiddenNode(graphData, edge.target),
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
        attachmentObjectEdges: outgoing.filter(
          (edge) =>
            ![RDF_TYPE, OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_PROPERTY, OWL_ANNOTATED_TARGET].includes(edge.predicate) &&
            !isAnnotationLikePredicate(graphData, edge.predicate),
        ),
        attachmentLiteralEdges: outgoingLiteral.filter(
          (edge) => ![RDF_TYPE, OWL_ANNOTATED_SOURCE, OWL_ANNOTATED_PROPERTY, OWL_ANNOTATED_TARGET].includes(edge.predicate),
        ),
      });
    }
  }

  return descriptors;
}

function decorateEdgeAttachedStructures(graphData, elements, mode) {
  const descriptors = buildReificationDescriptors(graphData).filter(
    (descriptor) => mode !== GRAPH_VIEW_MODES.RDF || descriptor.kind !== 'axiom-annotation',
  );
  const descriptorsByReifier = new Map(descriptors.map((descriptor) => [descriptor.reifierId, descriptor]));
  const reificationIds = new Set(
    descriptors.filter((descriptor) => descriptor.kind === 'reification').map((descriptor) => descriptor.reifierId),
  );
  const structuralPredicatesByReifier = new Map(
    descriptors.map((descriptor) => [descriptor.reifierId, descriptor.structuralPredicates]),
  );

  const filteredElements = elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }
    if (!data.source) {
      const descriptor = descriptorsByReifier.get(data.id);
      if (descriptor?.kind === 'axiom-annotation') {
        return false;
      }
      return true;
    }

    const descriptor = descriptorsByReifier.get(data.source);
    const structuralPredicates = structuralPredicatesByReifier.get(data.source);
    if (structuralPredicates?.has(data.predicate)) {
      return false;
    }
    if (data.predicate && isProvIri(data.predicate)) {
      return false;
    }
    if (isGraphSuppressedNode(graphData, data.source) || isGraphSuppressedNode(graphData, data.target)) {
      return false;
    }
    if (descriptor?.kind === 'axiom-annotation') {
      return false;
    }
    if (descriptor?.kind === 'reification') {
      return data.category === 'object' && reificationIds.has(data.target);
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

        const anchorId = ensureEdgeAnchor(matchingEdge, anchorNodes, anchorEdges, anchorByEdgeId);
        for (const attachmentEdge of descriptor.attachmentObjectEdges ?? []) {
          if (attachmentEdge.target && isGraphSuppressedNode(graphData, attachmentEdge.target)) {
            continue;
          }
          ensureNodeVisible(attachmentEdge.target);
          const attachmentId = `edge-annot:${matchingEdge.data.id}:obj:${attachmentEdge.id}`;
          if (addedEdgeIds.has(attachmentId)) {
            continue;
          }
          addedEdgeIds.add(attachmentId);
          relationEdges.push({
            data: {
              id: attachmentId,
              source: anchorId,
              target: attachmentEdge.target,
              predicate: attachmentEdge.predicate,
              predicateLabel: compactIri(attachmentEdge.predicate),
              category: attachmentEdge.category ?? 'object',
              axiomKind: 'AxiomAnnotation',
              restrictionKind: '',
              edgeAttachedConnector: 1,
              rdfViewEdge: mode === GRAPH_VIEW_MODES.RDF ? 1 : 0,
              owlEdgeStyle: attachmentEdge.category === 'data' ? 'dashed' : 'straight',
            },
          });
        }
        for (const attachmentEdge of descriptor.attachmentLiteralEdges ?? []) {
          ensureNodeVisible(attachmentEdge.target);
          const attachmentId = `edge-annot:${matchingEdge.data.id}:lit:${attachmentEdge.id}`;
          if (addedEdgeIds.has(attachmentId)) {
            continue;
          }
          addedEdgeIds.add(attachmentId);
          relationEdges.push({
            data: {
              id: attachmentId,
              source: anchorId,
              target: attachmentEdge.target,
              predicate: attachmentEdge.predicate,
              predicateLabel: compactIri(attachmentEdge.predicate),
              category: attachmentEdge.category ?? 'data',
              axiomKind: 'AxiomAnnotation',
              restrictionKind: '',
              edgeAttachedConnector: 1,
              rdfViewEdge: mode === GRAPH_VIEW_MODES.RDF ? 1 : 0,
              owlEdgeStyle: 'dashed',
            },
          });
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
          rdfViewEdge: mode === GRAPH_VIEW_MODES.RDF ? 1 : 0,
          owlEdgeStyle: mode === GRAPH_VIEW_MODES.RDF ? 'dotted' : 'straight',
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

  const combinedElements = [...decoratedElements, ...anchorNodes, ...anchorEdges, ...relationEdges];
  const referencedNodeIds = new Set();
  for (const element of combinedElements) {
    const data = element?.data;
    if (!data?.source) {
      continue;
    }
    referencedNodeIds.add(data.source);
    referencedNodeIds.add(data.target);
  }

  return combinedElements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }
    if (data.source) {
      return true;
    }
    if (data.termType === 'Literal') {
      return referencedNodeIds.has(data.id);
    }
    if (isGraphSuppressedNode(graphData, data.id)) {
      return false;
    }
    if (data.graphRole === 'edge-anchor' || data.edgeAnchor) {
      return referencedNodeIds.has(data.id);
    }
    return true;
  });
}

function applyOwlProjection(graphData, elements) {
  const visibleNodeIds = new Set(
    elements.filter((element) => !element?.data?.source).map((element) => element.data.id),
  );
  const propertyDeclarations = collectPropertyDeclarations(graphData);
  const outgoingBySource = buildOutgoingEdgeIndex(graphData);
  const outgoingAllBySource = buildOutgoingAllEdgeIndex(graphData);
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
  const { synthesizedNodes: datatypeDefinitionNodes, synthesizedEdges: datatypeDefinitionEdges } =
    synthesizeDatatypeDefinitionProjection(graphData, visibleNodeIds);
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

  const datatypeDefinitionBlankNodeIds = new Set();
  const markDatatypeDefinitionBlankSubtree = (nodeId, seen = new Set()) => {
    if (!nodeId || seen.has(nodeId)) {
      return;
    }
    seen.add(nodeId);
    datatypeDefinitionBlankNodeIds.add(nodeId);

    for (const edge of outgoingAllBySource.get(nodeId) ?? []) {
      const targetNode = graphData?.nodeMap?.get(edge.target);
      if (targetNode?.termType === 'BlankNode') {
        markDatatypeDefinitionBlankSubtree(edge.target, seen);
      }
    }
  };

  for (const edge of graphData?.objectEdges ?? []) {
    if (edge.predicate !== OWL_EQUIVALENT_CLASS && edge.predicate !== RDFS_SUBCLASS_OF) {
      continue;
    }
    const sourceNode = graphData?.nodeMap?.get(edge.source);
    const targetNode = graphData?.nodeMap?.get(edge.target);
    if (
      sourceNode?.entityCategory !== 'datatype' ||
      targetNode?.termType !== 'BlankNode'
    ) {
      continue;
    }

    const targetOutgoing = outgoingBySource.get(edge.target) ?? [];
    const hasDatatypeDefinition =
      targetOutgoing.some((row) => row.predicate === OWL_ON_DATATYPE) ||
      targetOutgoing.some((row) => row.predicate === OWL_WITH_RESTRICTIONS);
    if (!hasDatatypeDefinition) {
      continue;
    }

    markDatatypeDefinitionBlankSubtree(edge.target);
  }

  for (const nodeId of datatypeDefinitionBlankNodeIds) {
    hiddenNodeIds.add(nodeId);
  }

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
    ...datatypeDefinitionNodes,
    ...datatypeDefinitionEdges,
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

  const isRestrictionRelayNode = (nodeData) =>
    Boolean(
      nodeData?.id &&
        (String(nodeData.id).startsWith('owl-target-restr:') ||
          nodeData.entityCategory === 'class-expression-connector'),
    );

  const isExpressionHelperNode = (nodeData) =>
    Boolean(nodeData?.id && String(nodeData.id).startsWith('owl-expr:'));

  let compactedProjectedElements = dedupedProjectedElements;
  let removedHelperNodes = true;
  while (removedHelperNodes) {
    removedHelperNodes = false;
    const currentNodes = compactedProjectedElements.filter((element) => !element?.data?.source);
    const currentEdges = compactedProjectedElements.filter((element) => element?.data?.source);
    const {
      edgesByTarget,
      edgesBySource,
      equivalenceByPair,
      equivalenceKeyForEdge,
    } = buildProjectedEdgeEquivalenceIndex(currentEdges);
    const redundantHelperNodeIds = new Set();

    for (const nodeElement of currentNodes) {
      const nodeData = nodeElement?.data;
      if (!nodeData?.id || !isExpressionHelperNode(nodeData)) {
        continue;
      }

      const incomingEdges = edgesByTarget.get(nodeData.id) ?? [];
      const outgoingEdges = edgesBySource.get(nodeData.id) ?? [];
      if (incomingEdges.length !== 1 || outgoingEdges.length === 0) {
        continue;
      }

      const anchorSourceId = incomingEdges[0].data.source;
      const hasAllDirectAnchorEdges = outgoingEdges.every((edgeElement) => {
        const pairKeys = equivalenceByPair.get(`${anchorSourceId}|${edgeElement.data.target}`);
        return pairKeys?.has(equivalenceKeyForEdge(edgeElement.data)) ?? false;
      });

      if (hasAllDirectAnchorEdges) {
        redundantHelperNodeIds.add(nodeData.id);
      }
    }

    for (const nodeElement of currentNodes) {
      const nodeData = nodeElement?.data;
      if (!nodeData?.id || !isRestrictionRelayNode(nodeData)) {
        continue;
      }

      const incomingEdges = edgesByTarget.get(nodeData.id) ?? [];
      const outgoingEdges = edgesBySource.get(nodeData.id) ?? [];

      if (incomingEdges.length === 0 || outgoingEdges.length === 0) {
        redundantHelperNodeIds.add(nodeData.id);
        continue;
      }

      const restrictionIncomingEdges = incomingEdges.filter(
        (edgeElement) =>
          edgeElement.data.axiomKind === 'Restriction' || edgeElement.data.axiomKind === 'ClassExpressionRestriction',
      );
      const restrictionOutgoingEdges = outgoingEdges.filter(
        (edgeElement) =>
          edgeElement.data.axiomKind === 'Restriction' || edgeElement.data.axiomKind === 'ClassExpressionRestriction',
      );
      if (
        restrictionIncomingEdges.length !== incomingEdges.length ||
        restrictionOutgoingEdges.length !== outgoingEdges.length
      ) {
        continue;
      }

      const isPureRelay = restrictionIncomingEdges.every((incomingEdge) =>
        restrictionOutgoingEdges.every((outgoingEdge) => {
          const pairKeys = equivalenceByPair.get(`${incomingEdge.data.source}|${outgoingEdge.data.target}`);
          return pairKeys?.has(equivalenceKeyForEdge(outgoingEdge.data)) ?? false;
        }),
      );

      if (isPureRelay) {
        redundantHelperNodeIds.add(nodeData.id);
      }
    }

    if (redundantHelperNodeIds.size > 0) {
      compactedProjectedElements = compactedProjectedElements.filter((element) => {
        const data = element?.data;
        if (!data) {
          return false;
        }
        if (!data.source) {
          return !redundantHelperNodeIds.has(data.id);
        }
        return !redundantHelperNodeIds.has(data.source) && !redundantHelperNodeIds.has(data.target);
      });
      removedHelperNodes = true;
    }
  }

  const projectedNodeIds = new Set(
    compactedProjectedElements
      .filter((element) => !element?.data?.source)
      .map((element) => element.data.id),
  );
  const safeProjectedElements = compactedProjectedElements.filter((element) => {
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

function filterOwlProjectionByLevel(elements, owlProjectionLevel) {
  if (owlProjectionLevel === OWL_PROJECTION_LEVELS.KG || !owlProjectionLevel) {
    return elements;
  }

  const helperLikeNodeCategories = new Set([
    'owl-helper',
    'owl-expression',
    'owl-group',
    'owl-collection-connector',
    'all-different',
    'edge-anchor',
    'class-expression-connector',
  ]);
  const allowedNodeIds = new Set();
  const excludedNodeIds = new Set();
  const deferredIndividualNodeIds = new Set();
  const nodeDataById = new Map(
    elements
      .filter((element) => !element?.data?.source)
      .map((element) => [element.data.id, element.data]),
  );

  const isSchemaNode = (data) =>
    Boolean(
      data &&
        data.termType !== 'Literal' &&
        data.entityCategory !== 'literal' &&
        (
          data.ontologyKind === 'class' ||
          data.ontologyKind === 'object-property' ||
          data.ontologyKind === 'data-property' ||
          data.ontologyKind === 'datatype' ||
          data.entityCategory === 'datatype'
        ),
    );

  if (owlProjectionLevel === OWL_PROJECTION_LEVELS.TAXONOMY) {
    const taxonomyEdges = [];
    const taxonomyNodeIds = new Set();

    for (const element of elements) {
      const data = element?.data;
      if (!data?.source) {
        continue;
      }

      const sourceNode = nodeDataById.get(data.source);
      const targetNode = nodeDataById.get(data.target);
      const keepEdge =
        data.predicate === RDFS_SUBCLASS_OF &&
        sourceNode?.ontologyKind === 'class' &&
        targetNode?.ontologyKind === 'class';

      if (!keepEdge) {
        continue;
      }

      taxonomyEdges.push(element);
      taxonomyNodeIds.add(data.source);
      taxonomyNodeIds.add(data.target);
    }

    return elements.filter((element) => {
      const data = element?.data;
      if (!data) {
        return false;
      }
      if (!data.source) {
        return taxonomyNodeIds.has(data.id);
      }
      return taxonomyEdges.includes(element);
    });
  }

  for (const element of elements) {
    const data = element?.data;
    if (!data || data.source) {
      continue;
    }

    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.ONTOLOGY) {
      if (data.entityCategory === 'literal' || data.termType === 'Literal') {
        excludedNodeIds.add(data.id);
        continue;
      }
      if (data.entityCategory === 'individual') {
        deferredIndividualNodeIds.add(data.id);
        continue;
      }
      allowedNodeIds.add(data.id);
      continue;
    }

    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.SCHEMA) {
      if (isSchemaNode(data)) {
        allowedNodeIds.add(data.id);
      }
      continue;
    }

  }

  if (owlProjectionLevel === OWL_PROJECTION_LEVELS.ONTOLOGY && deferredIndividualNodeIds.size > 0) {
    for (const element of elements) {
      const data = element?.data;
      if (!data?.source) {
        continue;
      }

      const sourceIsDeferredIndividual = deferredIndividualNodeIds.has(data.source);
      const targetIsDeferredIndividual = deferredIndividualNodeIds.has(data.target);
      if (!sourceIsDeferredIndividual && !targetIsDeferredIndividual) {
        continue;
      }

      const individualNodeId = sourceIsDeferredIndividual ? data.source : data.target;
      const neighborNodeId = sourceIsDeferredIndividual ? data.target : data.source;
      const neighborNode = nodeDataById.get(neighborNodeId);
      if (!neighborNode) {
        continue;
      }

      const connectedViaClassConstruct =
        data.owlSynthesized === 1 &&
        (
          data.axiomKind === 'Restriction' ||
          data.axiomKind === 'ClassExpressionRestriction' ||
          helperLikeNodeCategories.has(neighborNode.entityCategory) ||
          neighborNode.entityCategory === 'class-expression' ||
          neighborNode.blankExpressionType === 'OneOf' ||
          neighborNode.owlExpressionNode === 1
        );

      if (connectedViaClassConstruct) {
        allowedNodeIds.add(individualNodeId);
        excludedNodeIds.delete(individualNodeId);
      }
    }

    for (const deferredIndividualNodeId of deferredIndividualNodeIds) {
      if (!allowedNodeIds.has(deferredIndividualNodeId)) {
        excludedNodeIds.add(deferredIndividualNodeId);
      }
    }
  }

  if (owlProjectionLevel === OWL_PROJECTION_LEVELS.ONTOLOGY && excludedNodeIds.size > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const element of elements) {
        const data = element?.data;
        if (!data?.source) {
          continue;
        }

        const sourceExcluded = excludedNodeIds.has(data.source);
        const targetExcluded = excludedNodeIds.has(data.target);
        if (!sourceExcluded && !targetExcluded) {
          continue;
        }

        const neighborId = sourceExcluded ? data.target : data.source;
        if (excludedNodeIds.has(neighborId)) {
          continue;
        }

        const neighborNode = nodeDataById.get(neighborId);
        if (!neighborNode) {
          continue;
        }

        if (helperLikeNodeCategories.has(neighborNode.entityCategory) || neighborNode.owlHelper) {
          excludedNodeIds.add(neighborId);
          allowedNodeIds.delete(neighborId);
          changed = true;
        }
      }
    }
  }

  return elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }

    if (!data.source) {
      return allowedNodeIds.has(data.id) && !excludedNodeIds.has(data.id);
    }

    if (
      !allowedNodeIds.has(data.source) ||
      !allowedNodeIds.has(data.target) ||
      excludedNodeIds.has(data.source) ||
      excludedNodeIds.has(data.target)
    ) {
      return false;
    }

    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.ONTOLOGY) {
      return true;
    }

    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.TAXONOMY) {
      return false;
    }

    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.SCHEMA) {
      const sourceNode = nodeDataById.get(data.source);
      const targetNode = nodeDataById.get(data.target);
      if (!isSchemaNode(sourceNode) || !isSchemaNode(targetNode)) {
        return false;
      }

      return (
        data.predicate === RDFS_SUBCLASS_OF ||
        data.predicate === RDFS_DOMAIN ||
        data.predicate === RDFS_RANGE ||
        data.predicate === RDFS_SUBPROPERTY_OF ||
        data.axiomKind === 'PropertyProjection'
      );
    }

    return false;
  });
}

export function normalizeGraphViewMode(mode) {
  if (mode === GRAPH_VIEW_MODES.RDF || mode === 'kg') {
    return GRAPH_VIEW_MODES.RDF;
  }
  return GRAPH_VIEW_MODES.OWL;
}

function normalizeProjectionFlags(viewOptions = DEFAULT_VIEW_OPTIONS) {
  return {
    projectionMode: normalizeGraphViewMode(viewOptions?.projectionMode),
    showDataProperties: Boolean(viewOptions?.showDataProperties),
    showAnnotationProperties: Boolean(viewOptions?.showAnnotationProperties),
    showObjectProperties: Boolean(viewOptions?.showObjectProperties),
    showNamedIndividuals: Boolean(viewOptions?.showNamedIndividuals),
    showTypeLinks: Boolean(viewOptions?.showTypeLinks),
    selectedNamedGraphIds: Array.isArray(viewOptions?.selectedNamedGraphIds)
      ? viewOptions.selectedNamedGraphIds.filter(Boolean)
      : [],
  };
}

function getQuadGraphFilterId(quad) {
  if (!quad?.graph || quad.graph.termType === 'DefaultGraph') {
    return '__default_graph__';
  }
  return getTermId(quad.graph);
}

function matchesNamedGraphSelection(graphIds, selectedNamedGraphIds) {
  if (!Array.isArray(selectedNamedGraphIds) || selectedNamedGraphIds.length === 0) {
    return true;
  }

  const candidateIds = Array.isArray(graphIds) ? graphIds : graphIds ? [graphIds] : [];
  if (candidateIds.length === 0) {
    return false;
  }

  return candidateIds.some((graphId) => selectedNamedGraphIds.includes(graphId));
}

export function createViewOptions(mode, flags = {}) {
  return {
    ...DEFAULT_VIEW_OPTIONS,
    ...flags,
    projectionMode: normalizeGraphViewMode(mode),
  };
}

export function buildRdfViewProjection(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  const rdfProjectionLevel = viewOptions?.rdfProjectionLevel ?? RDF_PROJECTION_LEVELS.ALL;
  const options = normalizeProjectionFlags({
    ...viewOptions,
    projectionMode: GRAPH_VIEW_MODES.RDF,
  });
  const effectiveFocusedNodeIds =
    focusedNodeIds && graphData?.hasOntology && graphData?.hasKg && options.selectedNamedGraphIds.length === 0
      ? (() => {
          const combined = new Set(focusedNodeIds);
          for (const node of graphData?.nodes ?? []) {
            if (node.isOntologyNode) {
              combined.add(node.id);
            }
          }
          return combined;
        })()
      : focusedNodeIds;
  const elements = buildRawRdfProjectionElements(graphData, effectiveFocusedNodeIds, options);

  const projectedElements = applySelfLoopGeometry(
    graphData,
    filterRdfProjectionByLevel(
      applyRelationPalette(
        decorateEdgeAttachedStructures(
          graphData,
          annotateRdfNodePresentation(
            applyRdfSpecProjection(graphData, applyRdfLabels(suppressMetadataEdges(elements))),
          ),
          GRAPH_VIEW_MODES.RDF,
        ),
      ),
      rdfProjectionLevel,
    ),
  );

  return suppressInfrastructureNodes(
    graphData,
    suppressDisplayOnlyNodes(
      rdfProjectionLevel === RDF_PROJECTION_LEVELS.ALL ? stripNodeBadges(projectedElements) : projectedElements,
    ),
  );
}

export function buildSchemaViewProjection(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  return buildOwlViewProjection(graphData, focusedNodeIds, {
    ...viewOptions,
    owlProjectionLevel: OWL_PROJECTION_LEVELS.SCHEMA,
  });
}

export function buildOwlViewProjection(graphData, focusedNodeIds, viewOptions = DEFAULT_VIEW_OPTIONS) {
  const owlProjectionLevel = viewOptions?.owlProjectionLevel ?? OWL_PROJECTION_LEVELS.KG;
  const baseOwlViewOptions =
    owlProjectionLevel === OWL_PROJECTION_LEVELS.TAXONOMY || owlProjectionLevel === OWL_PROJECTION_LEVELS.SCHEMA
      ? {
          ...viewOptions,
          showDataProperties: true,
          showAnnotationProperties: false,
          showObjectProperties: true,
          showNamedIndividuals: false,
          showTypeLinks: true,
        }
      : viewOptions;

  const elements = buildFocusedSubset(graphData, focusedNodeIds, {
    ...baseOwlViewOptions,
    projectionMode: GRAPH_VIEW_MODES.RDF,
  });

  const baseElements = suppressMetadataEdges(elements);

  try {
    const projectedElements = applyHoverMetadata(
      graphData,
      filterOwlProjectionByLevel(
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
        owlProjectionLevel,
      ),
    );
    return suppressInfrastructureNodes(
      graphData,
      stripNodeBadges(projectedElements),
    );
  } catch (error) {
    console.error('OWL projection failed; falling back to base ontology graph.', error);
    return stripNodeBadges(
      applyHoverMetadata(graphData, applySelfLoopGeometry(graphData, applyRelationPalette(baseElements))),
    );
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
  if (!graphData || !nodeId) {
    return [];
  }

  const descriptors = buildReificationDescriptors(graphData);
  const reificationDescriptor = descriptors.find(
    (descriptor) => descriptor.kind === 'reification' && descriptor.reifierId === nodeId,
  );
  if (reificationDescriptor) {
    return reificationDescriptor.metadataRows.map((row) => ({
      predicate: row.key,
      predicateLabel: row.key,
      value: row.value,
    }));
  }

  if (normalizeGraphViewMode(mode) !== GRAPH_VIEW_MODES.OWL) {
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
