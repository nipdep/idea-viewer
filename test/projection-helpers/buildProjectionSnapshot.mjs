import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildGraphData, compactIri, extractOntologyModel, parseRdfText } from '../../src/lib/rdf.js';
import { buildOwlViewProjection, buildRdfViewProjection, createViewOptions, GRAPH_VIEW_MODES } from '../../src/lib/view-projections.js';

function helperIdHint(data) {
  if (!data) {
    return '';
  }

  if (data.entityCategory === 'enumeration-set') {
    return 'helper:enumeration';
  }
  if (data.entityCategory === 'class-expression-connector') {
    return 'helper:restriction';
  }
  if (data.entityCategory === 'owl-expression') {
    const kind = String(data.blankExpressionType || '').toLowerCase() || 'expression';
    return `helper:${kind}`;
  }
  if (data.entityCategory === 'owl-group') {
    return `helper:${String(data.blankExpressionType || 'group').toLowerCase()}`;
  }
  if (data.entityCategory === 'all-different') {
    return 'helper:all-different';
  }
  if (data.entityCategory === 'owl-collection-connector') {
    return 'helper:collection';
  }
  if (data.entityCategory === 'owl-helper') {
    return 'helper:generic';
  }
  if (data.entityCategory === 'edge-anchor') {
    return 'helper:edge-anchor';
  }
  return compactIri(data.iri || data.id || '');
}

function normalizeNode(element) {
  const data = element.data;
  return {
    idHint: helperIdHint(data),
    label: data.label || '',
    entityCategory: data.entityCategory || '',
    ontologyKind: data.ontologyKind || '',
    blankExpressionType: data.blankExpressionType || '',
    graphRole: data.graphRole || '',
    termType: data.termType || '',
  };
}

function normalizeEdge(element, nodeById) {
  const data = element.data;
  const sourceNode = nodeById.get(data.source);
  const targetNode = nodeById.get(data.target);
  return {
    sourceHint: sourceNode ? helperIdHint(sourceNode.data) : compactIri(data.source || ''),
    targetHint: targetNode ? helperIdHint(targetNode.data) : compactIri(data.target || ''),
    predicate: compactIri(data.predicate || ''),
    predicateLabel: data.predicateLabel || '',
    category: data.category || '',
    axiomKind: data.axiomKind || '',
    owlEdgeStyle: data.owlEdgeStyle || '',
    sourceCardinality: data.sourceCardinality || '',
    isSelfLoop: Boolean(data.isSelfLoop),
  };
}

function canonicalBlankBase(node) {
  const kind = String(node.blankExpressionType || node.entityCategory || 'blank').trim().toLowerCase() || 'blank';
  return `blank:${kind}`;
}

function canonicalizeBlankNodeHints(snapshot) {
  const rawBlankNodes = snapshot.nodes
    .filter((node) => node.termType === 'BlankNode' && !String(node.idHint || '').startsWith('helper:'))
    .sort((left, right) => {
      const leftKey = JSON.stringify({
        blankExpressionType: left.blankExpressionType,
        entityCategory: left.entityCategory,
        graphRole: left.graphRole,
        label: left.label,
        idHint: left.idHint,
      });
      const rightKey = JSON.stringify({
        blankExpressionType: right.blankExpressionType,
        entityCategory: right.entityCategory,
        graphRole: right.graphRole,
        label: right.label,
        idHint: right.idHint,
      });
      return leftKey.localeCompare(rightKey);
    });

  const countsByBase = new Map();
  const replacementByRawHint = new Map();
  for (const node of rawBlankNodes) {
    const base = canonicalBlankBase(node);
    const nextIndex = (countsByBase.get(base) || 0) + 1;
    countsByBase.set(base, nextIndex);
    replacementByRawHint.set(node.idHint, nextIndex === 1 ? base : `${base}:${nextIndex}`);
  }

  const rewriteHint = (hint) => replacementByRawHint.get(hint) || hint;

  return {
    nodes: snapshot.nodes.map((node) => ({
      ...node,
      idHint: rewriteHint(node.idHint),
    })),
    edges: snapshot.edges.map((edge) => ({
      ...edge,
      sourceHint: rewriteHint(edge.sourceHint),
      targetHint: rewriteHint(edge.targetHint),
    })),
  };
}

function sortByJson(value) {
  return [...value].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export async function buildProjectionSnapshot({ fixturePath, mode = GRAPH_VIEW_MODES.OWL, viewOptions = {} }) {
  const rdfText = await readFile(fixturePath, 'utf8');
  const quads = parseRdfText(rdfText, path.basename(fixturePath));
  const ontologyModel = extractOntologyModel(quads);
  const graphData = buildGraphData(quads, {
    hasOntology: true,
    hasKg: false,
    ontologyModel,
  });

  const normalizedMode = mode === GRAPH_VIEW_MODES.RDF ? GRAPH_VIEW_MODES.RDF : GRAPH_VIEW_MODES.OWL;
  const options = createViewOptions(normalizedMode, {
    showDataProperties: true,
    showAnnotationProperties: false,
    showObjectProperties: true,
    showNamedIndividuals: false,
    showTypeLinks: true,
    owlProjectionLevel: 'ontology',
    rdfProjectionLevel: 'all',
    ...viewOptions,
  });

  const elements = normalizedMode === GRAPH_VIEW_MODES.RDF
    ? buildRdfViewProjection(graphData, null, options)
    : buildOwlViewProjection(graphData, null, options);

  const nodeElements = elements.filter((element) => !element?.data?.source);
  const edgeElements = elements.filter((element) => element?.data?.source);
  const nodeById = new Map(nodeElements.map((element) => [element.data.id, element]));

  const snapshot = {
    nodes: nodeElements.map(normalizeNode),
    edges: edgeElements.map((element) => normalizeEdge(element, nodeById)),
  };
  const canonicalSnapshot = canonicalizeBlankNodeHints(snapshot);

  return {
    nodes: sortByJson(canonicalSnapshot.nodes),
    edges: sortByJson(canonicalSnapshot.edges),
  };
}
