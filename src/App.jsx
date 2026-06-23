import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { QueryEngine } from '@comunica/query-sparql';
import { DataFactory, Writer } from 'n3';
import { buildGraphData, compactIri, extractOntologyModel, getNodeStatementBuckets, getTermId, parseRdfText } from './lib/rdf';
import {
  buildProjectedElements,
  createViewOptions,
  getProjectedNodeMetadataRows,
  GRAPH_VIEW_MODES,
} from './lib/view-projections';
import { applyLayoutPositions, IncrementalGraphLayout } from './lib/incremental-graph-layout';
import { NgraphIncrementalLayout } from './lib/ngraph-incremental-layout';
import { persistAndRotateTelemetrySession, telemetry } from './telemetry';
import './styles.css';

const RDF_TYPE_IRI = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_ONTOLOGY_IRI = 'http://www.w3.org/2002/07/owl#Ontology';
const LEFT_PANEL_MIN_WIDTH = 220;
const RIGHT_PANEL_MIN_WIDTH = 240;
const PANEL_MAX_WIDTH_RATIO = 0.55;
const KNOWN_NAMESPACE_PREFIXES = {
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf',
  'http://www.w3.org/2000/01/rdf-schema#': 'rdfs',
  'http://www.w3.org/2002/07/owl#': 'owl',
  'http://www.w3.org/2001/XMLSchema#': 'xsd',
  'http://www.w3.org/ns/prov#': 'prov',
  'http://www.w3.org/2004/02/skos/core#': 'skos',
  'http://schema.org/': 'schema',
  'http://xmlns.com/foaf/0.1/': 'foaf',
  'http://purl.org/dc/terms/': 'dct',
};
const FIXED_SPARQL_PREFIXES = Object.freeze([
  { id: 'fixed-rdf', prefix: 'rdf', iri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
  { id: 'fixed-rdfs', prefix: 'rdfs', iri: 'http://www.w3.org/2000/01/rdf-schema#' },
  { id: 'fixed-xsd', prefix: 'xsd', iri: 'http://www.w3.org/2001/XMLSchema#' },
  { id: 'fixed-owl', prefix: 'owl', iri: 'http://www.w3.org/2002/07/owl#' },
  { id: 'fixed-prov', prefix: 'prov', iri: 'http://www.w3.org/ns/prov#' },
  { id: 'fixed-skos', prefix: 'skos', iri: 'http://www.w3.org/2004/02/skos/core#' },
  { id: 'fixed-schema', prefix: 'schema', iri: 'http://schema.org/' },
  { id: 'fixed-foaf', prefix: 'foaf', iri: 'http://xmlns.com/foaf/0.1/' },
  { id: 'fixed-dct', prefix: 'dct', iri: 'http://purl.org/dc/terms/' },
]);
const DEFAULT_STATUS = 'Upload RDF/OWL files to initialize the graph.';
const GRAPH_PROJECTION_MODES = {
  OWL: GRAPH_VIEW_MODES.OWL,
  RDF: GRAPH_VIEW_MODES.RDF,
};
const OWL_PROJECTION_LEVELS = {
  TAXONOMY: 'taxonomy',
  SCHEMA: 'schema',
  ONTOLOGY: 'ontology',
  KG: 'kg',
};
const RDF_PROJECTION_LEVELS = {
  OBJECT: 'object',
  ALL: 'all',
};
const GRAPH_FILTER_AXES = {
  ALL: 'all',
  TBOX: 't-box',
  ABOX: 'a-box',
};
const PROJECTION_MODE_LABELS = {
  [GRAPH_PROJECTION_MODES.OWL]: 'OWL View',
  [GRAPH_PROJECTION_MODES.RDF]: 'RDF View',
};
const GRAPH_THEME_MODES = Object.freeze({
  CLASSIC: 'classic',
  HIGH_CONTRAST: 'high-contrast',
});
const MIN_GRAPH_ZOOM_SPEED = 0.02;
const DEFAULT_GRAPH_ZOOM_SPEED = 0.12;
const MAX_GRAPH_ZOOM_SPEED = 0.85;
const MIN_GRAPH_FONT_SIZE = 8;
const DEFAULT_GRAPH_FONT_SIZE = 12;
const MAX_GRAPH_FONT_SIZE = 20;
const LARGE_OWL_LAYOUT_NODE_THRESHOLD = 260;
const LARGE_OWL_LAYOUT_EDGE_THRESHOLD = 700;
const RDFS_LABEL_IRI = 'http://www.w3.org/2000/01/rdf-schema#label';
const XSD_BOOLEAN_IRI = 'http://www.w3.org/2001/XMLSchema#boolean';
const XSD_DECIMAL_IRI = 'http://www.w3.org/2001/XMLSchema#decimal';
const VIEW_EXPORT_NS = 'https://idea-viewer.local/view#';
const CYTOSCAPE_CDN_URL = 'https://unpkg.com/cytoscape@3.30.0/dist/cytoscape.min.js';
const GITHUB_ISSUES_URL = 'https://github.com/nipdep/idea-viewer/issues';
const TBOX_ONTOLOGY_KINDS = new Set(['class', 'object-property', 'data-property', 'annotation-property', 'datatype']);
const TBOX_ENTITY_CATEGORIES = new Set([
  'class',
  'data-property',
  'object-property',
  'annotation-property',
  'datatype',
  'class-expression',
]);
const ABOX_ENTITY_CATEGORIES = new Set(['individual', 'thing', 'literal']);
const GRAPH_AXIS_HELPER_CATEGORIES = new Set([
  'owl-helper',
  'owl-expression',
  'owl-group',
  'owl-collection-connector',
  'all-different',
  'edge-anchor',
  'class-expression-connector',
  'rdf-connector',
]);
const CANONICAL_LAYOUT_BACKEND = 'ngraph';

const { blankNode, literal, namedNode, quad } = DataFactory;

function sanitizeFilenameSegment(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'view';
}

function formatExportTimestamp(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ];
  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function escapeCsvCell(value) {
  const text = Array.isArray(value) ? value.join(' | ') : value == null ? '' : String(value);
  const normalized = text.replace(/\r?\n/g, ' ');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function toInlineJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function getCurrentViewKey(projectionMode) {
  if (projectionMode === GRAPH_PROJECTION_MODES.RDF) {
    return 'rdf-view';
  }
  return 'owl-view';
}

function getCurrentViewLabel(projectionMode) {
  if (projectionMode === GRAPH_PROJECTION_MODES.RDF) {
    return 'RDF view';
  }
  return 'OWL view';
}

function normalizeFocusedNodeIds(nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    return [];
  }
  return Array.from(new Set(nodeIds.filter(Boolean)));
}

function getFocusSignature(nodeIds) {
  return normalizeFocusedNodeIds(nodeIds).sort().join('|');
}

function collectFocusRoots(cy, nodeIds) {
  const focusIds = normalizeFocusedNodeIds(nodeIds);
  let roots = cy.collection();
  for (const nodeId of focusIds) {
    const node = cy.$id(nodeId);
    if (!node.empty()) {
      roots = roots.union(node);
    }
  }
  return roots;
}

function snapshotNodeToTerm(nodeData) {
  if (!nodeData) {
    return null;
  }

  if (nodeData.termType === 'NamedNode') {
    return namedNode(nodeData.iri || nodeData.id);
  }

  if (nodeData.termType === 'BlankNode') {
    return blankNode(String(nodeData.id || '').replace(/^_:/, ''));
  }

  if (nodeData.termType === 'Literal') {
    const literalValue = nodeData.literalValue ?? nodeData.iri ?? nodeData.fullLabel ?? '';
    if (nodeData.literalLanguage) {
      return literal(literalValue, nodeData.literalLanguage);
    }
    if (nodeData.literalDatatype) {
      return literal(literalValue, namedNode(nodeData.literalDatatype));
    }
    return literal(literalValue);
  }

  return null;
}

function buildCsvExport(snapshot) {
  const rows = [];
  const nodeById = new Map(snapshot.nodes.map((node) => [node.data.id, node]));
  const header = [
    'row_type',
    'id',
    'label',
    'full_label',
    'term_type',
    'entity_category',
    'ontology_kind',
    'graph_role',
    'iri',
    'base_iri',
    'class_iris',
    'position_x',
    'position_y',
    'cy_classes',
    'source',
    'target',
    'source_label',
    'target_label',
    'predicate',
    'predicate_label',
    'edge_category',
    'axiom_kind',
    'restriction_kind',
    'literal_language',
    'literal_datatype',
  ];
  rows.push(header.join(','));

  for (const node of snapshot.nodes) {
    rows.push(
      [
        'node',
        node.data.id,
        node.data.label,
        node.data.fullLabel,
        node.data.termType,
        node.data.entityCategory,
        node.data.ontologyKind,
        node.data.graphRole,
        node.data.iri,
        node.data.baseIri,
        node.data.classes ?? [],
        Number(node.position.x).toFixed(3),
        Number(node.position.y).toFixed(3),
        node.classes,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        node.data.literalLanguage,
        node.data.literalDatatype,
      ].map(escapeCsvCell).join(','),
    );
  }

  for (const edge of snapshot.edges) {
    const sourceNode = nodeById.get(edge.data.source);
    const targetNode = nodeById.get(edge.data.target);
    rows.push(
      [
        'edge',
        edge.data.id,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        edge.classes,
        edge.data.source,
        edge.data.target,
        sourceNode?.data.fullLabel ?? sourceNode?.data.label ?? '',
        targetNode?.data.fullLabel ?? targetNode?.data.label ?? '',
        edge.data.predicate,
        edge.data.predicateLabel,
        edge.data.category,
        edge.data.axiomKind,
        edge.data.restrictionKind,
        '',
        '',
      ].map(escapeCsvCell).join(','),
    );
  }

  return rows.join('\n');
}

function buildHtmlExport(snapshot) {
  const elements = [
    ...snapshot.nodes.map((node) => ({
      data: node.data,
      position: node.position,
      classes: node.classes,
    })),
    ...snapshot.edges.map((edge) => ({
      data: edge.data,
      classes: edge.classes,
    })),
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${snapshot.metadata.title}</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at top left, #f8e6d6 0%, #fef6ee 40%, #f3f5f4 100%);
        color: #1e1b16;
        font-family: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
      }
      .export-shell {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        width: 100%;
        height: 100%;
      }
      .export-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        padding: 18px 22px 10px;
      }
      .export-title {
        margin: 0;
        font-size: 1.3rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .export-subtitle,
      .export-meta {
        margin: 4px 0 0;
        color: #6b6157;
        font-size: 0.92rem;
      }
      #cy {
        min-height: 0;
        margin: 0 18px 18px;
        border: 1px solid #e0d6cb;
        border-radius: 12px;
        background: linear-gradient(180deg, #fcfaf6 0%, #f8f3ec 100%);
        overflow: hidden;
      }
    </style>
    <script src="${CYTOSCAPE_CDN_URL}"></script>
  </head>
  <body>
    <div class="export-shell">
      <div class="export-header">
        <div>
          <h1 class="export-title">${snapshot.metadata.title}</h1>
          <p class="export-subtitle">${snapshot.metadata.viewLabel}</p>
        </div>
        <p class="export-meta">${snapshot.metadata.exportedAtLabel}</p>
      </div>
      <div id="cy"></div>
    </div>
    <script>
      const snapshot = ${toInlineJson({
    elements,
    style: snapshot.style,
    viewport: snapshot.viewport,
  })};
      const cy = cytoscape({
        container: document.getElementById('cy'),
        elements: snapshot.elements,
        style: snapshot.style,
        layout: { name: 'preset', fit: false },
        wheelSensitivity: 0.2,
        boxSelectionEnabled: false,
      });
      cy.ready(() => {
        cy.zoom(snapshot.viewport.zoom);
        cy.pan(snapshot.viewport.pan);
      });
    </script>
  </body>
</html>`;
}

async function buildTurtleExport(snapshot) {
  const writer = new Writer({
    prefixes: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      view: VIEW_EXPORT_NS,
    },
  });

  const nodeById = new Map(snapshot.nodes.map((node) => [node.data.id, node]));
  const decimalDatatype = namedNode(XSD_DECIMAL_IRI);
  const booleanDatatype = namedNode(XSD_BOOLEAN_IRI);

  for (const edge of snapshot.edges) {
    const sourceNode = nodeById.get(edge.data.source);
    const targetNode = nodeById.get(edge.data.target);
    const sourceTerm = snapshotNodeToTerm(sourceNode?.data);
    const targetTerm = snapshotNodeToTerm(targetNode?.data);
    if (!sourceTerm || !targetTerm || !edge.data.predicate) {
      continue;
    }
    writer.addQuad(quad(sourceTerm, namedNode(edge.data.predicate), targetTerm));
  }

  for (const node of snapshot.nodes) {
    const subject = snapshotNodeToTerm(node.data);
    if (!subject || subject.termType === 'Literal') {
      continue;
    }

    writer.addQuad(quad(subject, namedNode(`${VIEW_EXPORT_NS}visibleNode`), literal('true', booleanDatatype)));
    writer.addQuad(quad(subject, namedNode(`${VIEW_EXPORT_NS}x`), literal(String(Number(node.position.x).toFixed(3)), decimalDatatype)));
    writer.addQuad(quad(subject, namedNode(`${VIEW_EXPORT_NS}y`), literal(String(Number(node.position.y).toFixed(3)), decimalDatatype)));

    if (node.data.fullLabel) {
      writer.addQuad(quad(subject, namedNode(RDFS_LABEL_IRI), literal(node.data.fullLabel)));
    }
    if (node.data.entityCategory) {
      writer.addQuad(quad(subject, namedNode(`${VIEW_EXPORT_NS}entityCategory`), literal(node.data.entityCategory)));
    }
    if (node.data.ontologyKind) {
      writer.addQuad(quad(subject, namedNode(`${VIEW_EXPORT_NS}ontologyKind`), literal(node.data.ontologyKind)));
    }
    if (node.data.baseIri) {
      writer.addQuad(quad(subject, namedNode(`${VIEW_EXPORT_NS}baseIri`), literal(node.data.baseIri)));
    }
    if (Array.isArray(node.data.classes)) {
      for (const classIri of node.data.classes) {
        if (typeof classIri === 'string' && /^https?:/.test(classIri)) {
          writer.addQuad(quad(subject, namedNode(`${VIEW_EXPORT_NS}class`), namedNode(classIri)));
        }
      }
    }
  }

  return new Promise((resolve, reject) => {
    writer.end((error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

function isEntityTerm(term) {
  return term && (term.termType === 'NamedNode' || term.termType === 'BlankNode');
}

function intersectSets(left, right) {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  const output = new Set();
  for (const value of smaller) {
    if (larger.has(value)) {
      output.add(value);
    }
  }
  return output;
}

function extractEntityId(binding) {
  for (const [variable, term] of binding) {
    if ((variable.value === 'entity' || variable.value === 's' || variable.value === 'node') && isEntityTerm(term)) {
      return getTermId(term);
    }
  }

  for (const [, term] of binding) {
    if (isEntityTerm(term)) {
      return getTermId(term);
    }
  }

  return null;
}

async function collectEntityIds(bindingsStream) {
  const entityIds = new Set();
  for await (const binding of bindingsStream) {
    const entityId = extractEntityId(binding);
    if (entityId) {
      entityIds.add(entityId);
    }
  }
  return entityIds;
}

function runClassFilter(graphData, classIris) {
  const matchedEntityIds = new Set();
  if (!graphData || classIris.length === 0) {
    return matchedEntityIds;
  }

  const selectedClassSet = new Set(classIris);
  for (const node of graphData.nodes) {
    if (!node.isInstanceNode) {
      continue;
    }

    const nodeClasses = Array.isArray(node.classes) ? node.classes : [];
    if (nodeClasses.some((classIri) => selectedClassSet.has(classIri))) {
      matchedEntityIds.add(node.id);
    }
  }

  return matchedEntityIds;
}

function expandClassFilterMatches(graphData, matchedInstanceIds) {
  const expandedIds = new Set(matchedInstanceIds);
  if (!graphData) {
    return expandedIds;
  }

  for (const node of graphData.nodes) {
    if (!node.isInstanceNode) {
      expandedIds.add(node.id);
    }
  }

  return expandedIds;
}

async function runSparqlFilter(engine, store, query) {
  const bindingsStream = await engine.queryBindings(query, { sources: [store] });
  return collectEntityIds(bindingsStream);
}

function runBaseIriFilter(graphData, baseIris) {
  if (!graphData || baseIris.length === 0) {
    return new Set();
  }

  const allowedBaseIris = new Set(baseIris);
  const matchedNodeIds = new Set();

  for (const node of graphData.nodes) {
    if (node.baseIri && allowedBaseIris.has(node.baseIri)) {
      matchedNodeIds.add(node.id);
    }
  }

  return matchedNodeIds;
}

function getGraphAxisForNode(node) {
  if (!node) {
    return GRAPH_FILTER_AXES.ALL;
  }

  const ontologyKind = node.ontologyKind ?? '';
  const entityCategory = node.entityCategory ?? '';

  if (node.termType === 'Literal' || entityCategory === 'literal') {
    return GRAPH_FILTER_AXES.ABOX;
  }

  if (TBOX_ONTOLOGY_KINDS.has(ontologyKind) || TBOX_ENTITY_CATEGORIES.has(entityCategory) || node.isOntologyNode) {
    return GRAPH_FILTER_AXES.TBOX;
  }

  if (ontologyKind === 'individual' || ABOX_ENTITY_CATEGORIES.has(entityCategory) || node.isInstanceNode) {
    return GRAPH_FILTER_AXES.ABOX;
  }

  if (entityCategory === 'blank') {
    return GRAPH_FILTER_AXES.ABOX;
  }

  return GRAPH_FILTER_AXES.TBOX;
}

function runGraphAxisFilter(graphData, graphFilterAxis) {
  if (!graphData || graphFilterAxis === GRAPH_FILTER_AXES.ALL) {
    return null;
  }

  const matchedNodeIds = new Set();
  for (const node of graphData.nodes) {
    if (getGraphAxisForNode(node) === graphFilterAxis) {
      matchedNodeIds.add(node.id);
    }
  }

  return matchedNodeIds;
}

function filterProjectedElementsByGraphAxis(elements, graphFilterAxis) {
  if (!Array.isArray(elements) || graphFilterAxis === GRAPH_FILTER_AXES.ALL) {
    return elements;
  }

  const nodeElements = elements.filter((element) => !element?.data?.source);
  const edgeElements = elements.filter((element) => element?.data?.source);
  const nodeElementsById = new Map(nodeElements.map((element) => [element.data.id, element]));
  const retainedNodeIds = new Set();

  for (const element of nodeElements) {
    const data = element?.data;
    if (!data || GRAPH_AXIS_HELPER_CATEGORIES.has(data.entityCategory ?? '')) {
      continue;
    }

    if (getGraphAxisForNode(data) === graphFilterAxis) {
      retainedNodeIds.add(data.id);
    }
  }

  let addedHelperNode = true;
  while (addedHelperNode) {
    addedHelperNode = false;
    for (const edge of edgeElements) {
      const data = edge?.data;
      if (!data) {
        continue;
      }

      const sourceNode = nodeElementsById.get(data.source)?.data;
      const targetNode = nodeElementsById.get(data.target)?.data;
      const sourceRetained = retainedNodeIds.has(data.source);
      const targetRetained = retainedNodeIds.has(data.target);

      if (sourceNode && GRAPH_AXIS_HELPER_CATEGORIES.has(sourceNode.entityCategory ?? '') && targetRetained && !sourceRetained) {
        retainedNodeIds.add(data.source);
        addedHelperNode = true;
      }

      if (targetNode && GRAPH_AXIS_HELPER_CATEGORIES.has(targetNode.entityCategory ?? '') && sourceRetained && !targetRetained) {
        retainedNodeIds.add(data.target);
        addedHelperNode = true;
      }
    }
  }

  return elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return false;
    }
    if (!data.source) {
      return retainedNodeIds.has(data.id);
    }
    return retainedNodeIds.has(data.source) && retainedNodeIds.has(data.target);
  });
}

function normalizeSearchText(value) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getNodeSearchFields(node) {
  const displayLabel = (node?.displayLabel || '').replace(/\n/g, ' ');
  return [
    node?.fullLabel || '',
    displayLabel,
    node?.classBadge || '',
    node?.primaryClassLabel || '',
    node?.iri || '',
  ];
}

function doesNodeMatchSearchQuery(node, queryText) {
  const needle = normalizeSearchText(queryText);
  if (!needle) {
    return false;
  }

  return getNodeSearchFields(node).some((field) => normalizeSearchText(field).includes(needle));
}

function runNodeNameFilter(graphData, queryText) {
  if (!graphData) {
    return new Set();
  }

  const needle = normalizeSearchText(queryText);
  if (!needle) {
    return new Set();
  }

  const matchedNodeIds = new Set();
  for (const node of graphData.nodes) {
    if (doesNodeMatchSearchQuery(node, needle)) {
      matchedNodeIds.add(node.id);
    }
  }

  return matchedNodeIds;
}

function buildNeighborRows(selectedNodeId, graphData, visibleElements) {
  if (!selectedNodeId || !graphData) {
    return [];
  }

  const visibleEdgeIds = new Set(
    (visibleElements ?? [])
      .filter((element) => element?.data?.source)
      .map((element) => element.data.id),
  );
  const rows = [];
  for (const edge of graphData.objectEdges ?? []) {
    if (edge.category === 'type') {
      continue;
    }
    if (visibleEdgeIds.size > 0 && !visibleEdgeIds.has(edge.id)) {
      continue;
    }

    const { source, target, predicateLabel } = edge;
    if (source !== selectedNodeId && target !== selectedNodeId) {
      continue;
    }

    const neighborId = source === selectedNodeId ? target : source;
    const neighborNode = graphData.nodeMap.get(neighborId);
    rows.push({
      edgeId: edge.id,
      direction: source === selectedNodeId ? 'outgoing' : 'incoming',
      predicateLabel,
      neighborId,
      neighborLabel: neighborNode?.fullLabel ?? neighborId,
    });
  }

  return rows;
}

function formatSelectedFiles(files, emptyLabel) {
  if (files.length === 0) {
    return emptyLabel;
  }

  if (files.length <= 2) {
    return files.map((file) => file.name).join(', ');
  }

  const shown = files.slice(0, 2).map((file) => file.name).join(', ');
  return `${files.length} files selected (${shown} +${files.length - 2} more)`;
}

function mergeSelectedFiles(currentFiles, incomingFiles) {
  if (incomingFiles.length === 0) {
    return currentFiles;
  }

  const deduped = new Map(currentFiles.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
  for (const file of incomingFiles) {
    deduped.set(`${file.name}-${file.size}-${file.lastModified}`, file);
  }

  return Array.from(deduped.values());
}

function getNamespaceIri(iri) {
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

  return '';
}

function getPrefixFromBaseIri(baseIri) {
  if (!baseIri) {
    return 'ns';
  }

  if (KNOWN_NAMESPACE_PREFIXES[baseIri]) {
    return KNOWN_NAMESPACE_PREFIXES[baseIri];
  }

  const cleaned = baseIri.replace(/[\/#]+$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  const token = (parts[parts.length - 1] || 'ns')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toLowerCase();
  return token || 'ns';
}

function toPrefixedName(iri) {
  if (!iri) {
    return '';
  }

  const namespace = getNamespaceIri(iri);
  const prefix = getPrefixFromBaseIri(namespace);
  const local = compactIri(iri);
  return `${prefix}:${local}`;
}

function normalizePrefixName(prefix, fallback = 'ns') {
  const cleaned = (prefix || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^[^A-Za-z_]+/, '');
  return cleaned || fallback;
}

function normalizePrefixIri(iri) {
  return (iri || '').trim().replace(/^<|>$/g, '');
}

function makeDefaultSparqlPrefixes(baseIris) {
  const fixedIris = new Set(FIXED_SPARQL_PREFIXES.map((entry) => normalizePrefixIri(entry.iri)));
  const uniqueIris = Array.from(
    new Set(baseIris.map((entry) => normalizePrefixIri(entry)).filter((iri) => iri && !fixedIris.has(iri))),
  );
  const used = new Set(FIXED_SPARQL_PREFIXES.map((entry) => normalizePrefixName(entry.prefix)));

  return uniqueIris.map((iri, index) => {
    const namespace = getNamespaceIri(iri) || iri;
    const basePrefix = normalizePrefixName(getPrefixFromBaseIri(namespace), `ns${index + 1}`);
    let prefix = basePrefix;
    let dedupeCounter = 2;
    while (used.has(prefix)) {
      prefix = `${basePrefix}${dedupeCounter}`;
      dedupeCounter += 1;
    }
    used.add(prefix);

    return {
      id: `prefix-${index}-${prefix}`,
      prefix,
      iri,
    };
  });
}

function buildExecutableSparqlQuery(coreQuery, prefixRows, fixedPrefixRows = FIXED_SPARQL_PREFIXES) {
  const queryCore = coreQuery
    .replace(/^\s*PREFIX\s+[A-Za-z_][A-Za-z0-9_-]*:\s*<[^>]+>\s*$/gim, '')
    .trim();
  if (!queryCore) {
    return '';
  }

  const used = new Set();
  const usedIris = new Set();
  const prefixLines = [];

  for (let index = 0; index < fixedPrefixRows.length; index += 1) {
    const row = fixedPrefixRows[index];
    const iri = normalizePrefixIri(row.iri);
    if (!iri || usedIris.has(iri)) {
      continue;
    }
    const prefix = normalizePrefixName(row.prefix, `fixed${index + 1}`);
    if (used.has(prefix)) {
      continue;
    }
    used.add(prefix);
    usedIris.add(iri);
    prefixLines.push(`PREFIX ${prefix}: <${iri}>`);
  }

  for (let index = 0; index < prefixRows.length; index += 1) {
    const row = prefixRows[index];
    const iri = normalizePrefixIri(row.iri);
    if (!iri || usedIris.has(iri)) {
      continue;
    }

    const basePrefix = normalizePrefixName(row.prefix, `ns${index + 1}`);
    let prefix = basePrefix;
    let dedupeCounter = 2;
    while (used.has(prefix)) {
      prefix = `${basePrefix}${dedupeCounter}`;
      dedupeCounter += 1;
    }
    used.add(prefix);
    usedIris.add(iri);
    prefixLines.push(`PREFIX ${prefix}: <${iri}>`);
  }

  if (prefixLines.length === 0) {
    return queryCore;
  }

  return `${prefixLines.join('\n')}\n${queryCore}`;
}

function partitionOntologyHeaderQuads(quads) {
  if (!quads || quads.length === 0) {
    return {
      headerQuads: [],
      contentQuads: [],
    };
  }

  const ontologySubjectIds = new Set();
  for (const quad of quads) {
    if (
      quad.predicate.value === RDF_TYPE_IRI &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_ONTOLOGY_IRI
    ) {
      ontologySubjectIds.add(getTermId(quad.subject));
    }
  }

  if (ontologySubjectIds.size === 0) {
    return {
      headerQuads: [],
      contentQuads: quads,
    };
  }

  const headerQuads = [];
  const contentQuads = [];
  for (const quad of quads) {
    if (ontologySubjectIds.has(getTermId(quad.subject))) {
      headerQuads.push(quad);
    } else {
      contentQuads.push(quad);
    }
  }

  return {
    headerQuads,
    contentQuads,
  };
}

function formatTermForInspector(term) {
  if (!term) {
    return '';
  }

  if (term.termType === 'NamedNode') {
    return toPrefixedName(term.value);
  }

  if (term.termType === 'BlankNode') {
    return `[Blank ${term.value}]`;
  }

  if (term.termType === 'Literal') {
    return term.value;
  }

  return term.value || '';
}

function orderClassesSubToSuper(classIris, graphData) {
  if (!graphData || classIris.length <= 1) {
    return classIris;
  }

  const classSet = new Set(classIris);
  const parentMap = new Map();

  for (const edge of graphData.objectEdges) {
    if (edge.category !== 'subclass') {
      continue;
    }
    if (!classSet.has(edge.source) || !classSet.has(edge.target)) {
      continue;
    }
    const parents = parentMap.get(edge.source) ?? [];
    parents.push(edge.target);
    parentMap.set(edge.source, parents);
  }

  const depthMemo = new Map();
  const visiting = new Set();

  const depth = (classIri) => {
    if (depthMemo.has(classIri)) {
      return depthMemo.get(classIri);
    }

    if (visiting.has(classIri)) {
      return 0;
    }
    visiting.add(classIri);

    const parents = parentMap.get(classIri) ?? [];
    let value = 0;
    for (const parent of parents) {
      value = Math.max(value, depth(parent) + 1);
    }

    visiting.delete(classIri);
    depthMemo.set(classIri, value);
    return value;
  };

  return [...classIris].sort((left, right) => {
    const depthDiff = depth(right) - depth(left);
    if (depthDiff !== 0) {
      return depthDiff;
    }
    return toPrefixedName(left).localeCompare(toPrefixedName(right));
  });
}

function applyEdgeCurveOverrides(elements, edgeCurveOverrides) {
  if (!edgeCurveOverrides || edgeCurveOverrides.size === 0) {
    return elements;
  }

  return elements.map((element) => {
    const data = element?.data;
    if (!data?.source) {
      return element;
    }

    const override = edgeCurveOverrides.get(data.id);
    if (!override) {
      return element;
    }

    return {
      ...element,
      data: {
        ...data,
        customCurve: 1,
        curveStyle: 'round-segments',
        segmentWeights: String(override.weight),
        segmentDistances: String(override.distance),
      },
    };
  });
}

const EDGE_BEND_DISTANCE_GAIN = 1.35;
const EDGE_BEND_HANDLE_RENDER_SIZE = 10;
const EDGE_BEND_HANDLE_GLYPH = '✥';
const EDGE_BEND_HANDLE_CENTER_OFFSET = 12;

function toViewFlags(projectionMode, owlProjectionLevel, rdfProjectionLevel) {
  if (projectionMode === GRAPH_PROJECTION_MODES.RDF) {
    if (rdfProjectionLevel === RDF_PROJECTION_LEVELS.OBJECT) {
      return {
        showDataProperties: false,
        showAnnotationProperties: false,
        showObjectProperties: true,
        showNamedIndividuals: true,
        showTypeLinks: false,
      };
    }

    return {
      showDataProperties: true,
      showAnnotationProperties: true,
      showObjectProperties: true,
      showNamedIndividuals: true,
      showTypeLinks: true,
    };
  }

  if (projectionMode === GRAPH_PROJECTION_MODES.OWL) {
    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.TAXONOMY) {
      return {
        showDataProperties: false,
        showAnnotationProperties: false,
        showObjectProperties: false,
        showNamedIndividuals: false,
        showTypeLinks: false,
      };
    }

    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.SCHEMA) {
      return {
        showDataProperties: true,
        showAnnotationProperties: true,
        showObjectProperties: true,
        showNamedIndividuals: false,
        showTypeLinks: true,
      };
    }

    if (owlProjectionLevel === OWL_PROJECTION_LEVELS.ONTOLOGY) {
      return {
        showDataProperties: true,
        showAnnotationProperties: false,
        showObjectProperties: true,
        showNamedIndividuals: false,
        showTypeLinks: true,
      };
    }
  }

  return {
    showDataProperties: true,
    showAnnotationProperties: false,
    showObjectProperties: true,
    showNamedIndividuals: true,
    showTypeLinks: true,
  };
}

function toViewOptions(projectionMode, graphData, owlProjectionLevel, rdfProjectionLevel) {
  const flags = toViewFlags(projectionMode, owlProjectionLevel, rdfProjectionLevel);
  if (projectionMode === GRAPH_PROJECTION_MODES.RDF) {
    return createViewOptions(GRAPH_PROJECTION_MODES.RDF, {
      ...flags,
      showTypeLinks: flags.showTypeLinks && Boolean(graphData?.hasOntology),
      owlProjectionLevel,
      rdfProjectionLevel,
    });
  }

  return createViewOptions(GRAPH_PROJECTION_MODES.OWL, {
    ...flags,
    showTypeLinks: flags.showTypeLinks && Boolean(graphData?.hasOntology),
    owlProjectionLevel,
  });
}

export default function App() {
  const graphContainerRef = useRef(null);
  const cyRef = useRef(null);
  const graphSearchInputRef = useRef(null);
  const previousFocusedNodeIdRef = useRef(null);
  const previousFocusedNodeIdsRef = useRef([]);
  const focusedNodeIdRef = useRef(null);
  const focusedNodeIdsRef = useRef([]);
  const preFocusViewportRef = useRef(null);
  const queryEngineRef = useRef(new QueryEngine());
  const leftFlyoutTimerRef = useRef(null);
  const rightFlyoutTimerRef = useRef(null);
  const resizeStateRef = useRef(null);
  const hasAppliedInitialLayoutRef = useRef(false);
  const layoutPositionCacheRef = useRef(new Map());
  const projectedElementsCacheRef = useRef(new Map());
  const canonicalLayoutEngineRef = useRef(null);
  const groupDragStateRef = useRef(null);
  const groupDragArmRef = useRef(null);
  const shouldFitAfterFocusClearRef = useRef(false);
  const detachedPanModeRef = useRef(false);
  const detachedPanLastMouseRef = useRef(null);
  const suppressNextTapRef = useRef(false);
  const edgeCurveOverridesRef = useRef(new Map());
  const initialGraphStyleJsonRef = useRef(null);
  const graphSearchSessionRef = useRef(null);
  const pendingRenderSpanRef = useRef(null);
  const pendingFirstViewSpanRef = useRef(null);
  const layoutSpanRef = useRef(null);
  const settleSpanRef = useRef(null);
  const graphSearchInputAtRef = useRef(0);
  const graphSearchTelemetrySignatureRef = useRef('');
  const graphSearchMetricsRef = useRef({
    durationMs: 0,
    matchCount: 0,
    queryLength: 0,
  });
  const zoomInteractionRef = useRef(null);
  const telemetryContextRef = useRef({});
  const firstVisualizationRecordedRef = useRef(false);
  const previousFilterRunRef = useRef(null);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [visibleElements, setVisibleElements] = useState([]);

  const [selectedClassIris, setSelectedClassIris] = useState([]);
  const [selectedBaseIris, setSelectedBaseIris] = useState([]);
  const [graphFilterAxis, setGraphFilterAxis] = useState(GRAPH_FILTER_AXES.ALL);
  const [nodeNameQuery, setNodeNameQuery] = useState('');
  const [sparqlDraft, setSparqlDraft] = useState('');
  const [sparqlQuery, setSparqlQuery] = useState('');
  const [sparqlPrefixes, setSparqlPrefixes] = useState([]);
  const [graphProjectionMode, setGraphProjectionMode] = useState(GRAPH_PROJECTION_MODES.OWL);
  const [owlProjectionLevel, setOwlProjectionLevel] = useState(OWL_PROJECTION_LEVELS.ONTOLOGY);
  const [rdfProjectionLevel, setRdfProjectionLevel] = useState(RDF_PROJECTION_LEVELS.ALL);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [focusedNodeIds, setFocusedNodeIds] = useState([]);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(350);
  const [isPanelResizing, setIsPanelResizing] = useState(false);
  const [leftSectionOpen, setLeftSectionOpen] = useState({
    source: true,
    filters: true,
    sparql: true,
  });
  const [sparqlPrefixSectionOpen, setSparqlPrefixSectionOpen] = useState({
    fixed: true,
    custom: true,
  });
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [leftFlyoutOpen, setLeftFlyoutOpen] = useState(false);
  const [rightFlyoutOpen, setRightFlyoutOpen] = useState(false);
  const [isDetachedPanMode, setIsDetachedPanMode] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGraphSearchOpen, setIsGraphSearchOpen] = useState(false);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const [debouncedGraphSearchQuery, setDebouncedGraphSearchQuery] = useState('');
  const [graphSearchActiveIndex, setGraphSearchActiveIndex] = useState(0);
  const [graphZoomSpeed, setGraphZoomSpeed] = useState(DEFAULT_GRAPH_ZOOM_SPEED);
  const [graphFontSize, setGraphFontSize] = useState(DEFAULT_GRAPH_FONT_SIZE);
  const [graphThemeMode, setGraphThemeMode] = useState(GRAPH_THEME_MODES.CLASSIC);
  const [showDottedEdgeLabels, setShowDottedEdgeLabels] = useState(true);

  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [loadError, setLoadError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [ontologyMetadataRows, setOntologyMetadataRows] = useState([]);
  const [multiClassBadgeTooltip, setMultiClassBadgeTooltip] = useState(null);
  const [restrictionNodeTooltip, setRestrictionNodeTooltip] = useState(null);
  const [hoverTooltip, setHoverTooltip] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [isLayouting, setIsLayouting] = useState(false);

  const selectedNode = useMemo(
    () => {
      if (!selectedNodeId) {
        return null;
      }

      const mappedNode = graphData?.nodeMap.get(selectedNodeId);
      if (mappedNode) {
        return mappedNode;
      }

      const nodeElement = visibleElements.find((entry) => !entry.data.source && entry.data.id === selectedNodeId);
      return nodeElement?.data ?? null;
    },
    [selectedNodeId, graphData, visibleElements],
  );
  const selectedEdge = useMemo(
    () => {
      if (!selectedEdgeId || !graphData) {
        return null;
      }

      const mappedEdge = graphData.edgeMap.get(selectedEdgeId);
      if (mappedEdge) {
        return mappedEdge;
      }

      const edgeElement = visibleElements.find((entry) => entry.data.source && entry.data.id === selectedEdgeId);
      if (!edgeElement) {
        return null;
      }

      const data = edgeElement.data;
      return {
        id: data.id,
        source: data.source,
        target: data.target,
        predicate: data.predicate,
        predicateLabel: data.predicateLabel,
        category: data.category ?? 'object',
        axiomKind: data.axiomKind ?? '',
        restrictionKind: data.restrictionKind ?? '',
      };
    },
    [selectedEdgeId, graphData, visibleElements],
  );
  const isHighContrastGraph = graphThemeMode === GRAPH_THEME_MODES.HIGH_CONTRAST;
  const graphSearchMatches = useMemo(() => {
    const startedAt = performance.now();
    const normalizedQuery = normalizeSearchText(debouncedGraphSearchQuery);
    if (!normalizedQuery) {
      graphSearchMetricsRef.current = {
        durationMs: 0,
        matchCount: 0,
        queryLength: 0,
      };
      return [];
    }

    const searchableNodeIds = new Set(
      visibleElements
        .filter((entry) => !entry?.data?.source)
        .map((entry) => entry.data.id),
    );

    const matches = (graphData?.nodes ?? []).filter((node) => {
      if (!searchableNodeIds.has(node.id)) {
        return false;
      }
      if (GRAPH_AXIS_HELPER_CATEGORIES.has(node.entityCategory ?? '')) {
        return false;
      }
      if (node.edgeAnchor || node.edgeBendHandle) {
        return false;
      }
      return doesNodeMatchSearchQuery(node, normalizedQuery);
    });
    graphSearchMetricsRef.current = {
      durationMs: Number((performance.now() - startedAt).toFixed(3)),
      matchCount: matches.length,
      queryLength: debouncedGraphSearchQuery.trim().length,
    };
    return matches;
  }, [debouncedGraphSearchQuery, graphData, visibleElements]);
  const activeGraphSearchMatch =
    graphSearchMatches.length > 0 ? graphSearchMatches[graphSearchActiveIndex] ?? graphSearchMatches[0] : null;

  const buildProjectionCacheKey = (projectionMode, projectionLevel) => `${projectionMode}:${projectionLevel}`;
  const buildFilterSelectionSignature = () => JSON.stringify({
    selectedClassIris: [...selectedClassIris].sort(),
    selectedBaseIris: [...selectedBaseIris].sort(),
    graphFilterAxis,
    nodeNameQuery: nodeNameQuery.trim(),
    sparqlQuery: sparqlQuery.trim(),
    graphProjectionMode,
    owlProjectionLevel,
    rdfProjectionLevel,
    showClassTypeFilter,
  });
  const countRenderableElements = (elements) => {
    const renderedNodeCount = elements.filter(
      (entry) => !entry?.data?.source && entry?.data?.edgeAnchor !== 1 && entry?.data?.edgeBendHandle !== 1,
    ).length;
    const renderedEdgeCount = elements.filter(
      (entry) => entry?.data?.source && entry?.data?.edgeAnchorTether !== 1,
    ).length;
    return {
      renderedNodeCount,
      renderedEdgeCount,
    };
  };
  const buildTelemetryContext = (elements = visibleElements, extra = {}) => ({
    projectionMode: graphProjectionMode,
    projectionLevel:
      graphProjectionMode === GRAPH_PROJECTION_MODES.RDF ? rdfProjectionLevel : owlProjectionLevel,
    datasetTripletCount: graphData?.store?.size ?? 0,
    visibleTripletCount: graphData?.store?.size ?? 0,
    graphFilterAxis,
    ...countRenderableElements(elements),
    ...extra,
  });
  telemetryContextRef.current = buildTelemetryContext();
  const getPositionedProjectionElements = (rawElements) => {
    if (!Array.isArray(rawElements)) {
      return [];
    }
    return applyLayoutPositions(rawElements, canonicalLayoutEngineRef.current);
  };

  function openGraphSearch() {
    if (!graphSearchSessionRef.current) {
      graphSearchSessionRef.current = {
        selectedNodeId,
        selectedEdgeId,
        focusedNodeId,
        focusedNodeIds: [...focusedNodeIds],
      };
    }
    setIsGraphSearchOpen(true);
    setGraphSearchActiveIndex(0);
  }

  function restoreGraphSearchSessionFocus(snapshot) {
    if (!snapshot) {
      clearFocusState();
      return;
    }

    setSelectedNodeId(snapshot.selectedNodeId ?? null);
    setSelectedEdgeId(snapshot.selectedEdgeId ?? null);
    setFocusedNodeId(snapshot.focusedNodeId ?? null);
    setFocusedNodeIds(Array.isArray(snapshot.focusedNodeIds) ? snapshot.focusedNodeIds : []);
  }

  function closeGraphSearch({ restoreFocus = true } = {}) {
    const sessionSnapshot = graphSearchSessionRef.current;
    graphSearchSessionRef.current = null;
    setIsGraphSearchOpen(false);
    setGraphSearchQuery('');
    setDebouncedGraphSearchQuery('');
    setGraphSearchActiveIndex(0);
    if (restoreFocus) {
      restoreGraphSearchSessionFocus(sessionSnapshot);
    }
  }

  function moveGraphSearchMatch(step) {
    if (graphSearchMatches.length === 0) {
      return;
    }
    setGraphSearchActiveIndex((current) => {
      const nextIndex = (current + step + graphSearchMatches.length) % graphSearchMatches.length;
      return nextIndex;
    });
  }

  function setSingleFocusedNode(nodeId) {
    setSelectedEdgeId(null);
    setSelectedNodeId(nodeId);
    setFocusedNodeId(nodeId);
    setFocusedNodeIds(nodeId ? [nodeId] : []);
  }

  function extendFocusedNodes(nodeId) {
    if (!nodeId) {
      return;
    }
    setSelectedEdgeId(null);
    setFocusedNodeIds((current) => {
      if (current.includes(nodeId)) {
        const nextFocusedNodeIds = current.filter((id) => id !== nodeId);
        const activeFocusedNodeId = focusedNodeIdRef.current;
        const nextPrimaryNodeId =
          nextFocusedNodeIds.length === 0
            ? null
            : activeFocusedNodeId && activeFocusedNodeId !== nodeId && nextFocusedNodeIds.includes(activeFocusedNodeId)
              ? activeFocusedNodeId
              : nextFocusedNodeIds[nextFocusedNodeIds.length - 1];
        setSelectedNodeId(nextPrimaryNodeId);
        setFocusedNodeId(nextPrimaryNodeId);
        return nextFocusedNodeIds;
      }
      setSelectedNodeId(nodeId);
      setFocusedNodeId(nodeId);
      return [...current, nodeId];
    });
  }

  function clearFocusState() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFocusedNodeId(null);
    setFocusedNodeIds([]);
  }

  function handleGraphZoomSpeedChange(nextValue) {
    const parsedValue = Number.parseFloat(nextValue);
    if (!Number.isFinite(parsedValue)) {
      return;
    }
    const clampedValue = Math.min(MAX_GRAPH_ZOOM_SPEED, Math.max(MIN_GRAPH_ZOOM_SPEED, parsedValue));
    setGraphZoomSpeed(Number(clampedValue.toFixed(2)));
  }

  function stepGraphFontSize(direction) {
    setGraphFontSize((current) => {
      const nextValue = current + direction;
      return Math.min(MAX_GRAPH_FONT_SIZE, Math.max(MIN_GRAPH_FONT_SIZE, nextValue));
    });
  }

  function captureCurrentViewSnapshot() {
    const cy = cyRef.current;
    if (!cy) {
      return null;
    }

    const modeLabel = getCurrentViewLabel(graphProjectionMode);
    const exportTimestamp = new Date();
    const nodes = cy.nodes().map((node) => {
      const modelNode = graphData?.nodeMap.get(node.id());
      const nodeData = {
        ...node.data(),
        baseIri: modelNode?.baseIri ?? node.data('baseIri') ?? '',
        classes: Array.isArray(modelNode?.classes) ? [...modelNode.classes] : [],
        literalValue: modelNode?.literalValue ?? node.data('literalValue') ?? '',
        literalDatatype: modelNode?.literalDatatype ?? node.data('literalDatatype') ?? '',
        literalLanguage: modelNode?.literalLanguage ?? node.data('literalLanguage') ?? '',
      };
      return {
        data: nodeData,
        position: { x: node.position('x'), y: node.position('y') },
        classes: node.classes(),
      };
    });
    const edges = cy.edges().map((edge) => {
      const modelEdge = graphData?.edgeMap.get(edge.id());
      return {
        data: {
          ...edge.data(),
          axiomKind: modelEdge?.axiomKind ?? edge.data('axiomKind') ?? '',
          restrictionKind: modelEdge?.restrictionKind ?? edge.data('restrictionKind') ?? '',
        },
        classes: edge.classes(),
      };
    });

    return {
      nodes,
      edges,
      viewport: {
        zoom: cy.zoom(),
        pan: cy.pan(),
      },
      style: typeof cy.style().json === 'function' ? cy.style().json() : [],
      metadata: {
        title: 'IDEA* Viewer export',
        viewLabel: modeLabel,
        viewKey: getCurrentViewKey(graphProjectionMode),
        exportedAtIso: exportTimestamp.toISOString(),
        exportedAtLabel: exportTimestamp.toLocaleString(),
      },
    };
  }

  async function handleExport(format) {
    const snapshot = captureCurrentViewSnapshot();
    if (!snapshot) {
      setStatus('Export is unavailable until a graph is rendered.');
      return;
    }

    try {
      const fileBase = `idea-viewer-${sanitizeFilenameSegment(snapshot.metadata.viewKey)}-${formatExportTimestamp()}`;

      if (format === 'png') {
        const cy = cyRef.current;
        const pngDataUrl = cy?.png({
          full: false,
          scale: 2,
          bg: '#fcfaf6',
        });
        if (!pngDataUrl) {
          throw new Error('PNG export could not be generated.');
        }
        downloadDataUrl(`${fileBase}.png`, pngDataUrl);
      } else if (format === 'csv') {
        const csvText = buildCsvExport(snapshot);
        downloadBlob(`${fileBase}.csv`, new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
      } else if (format === 'ttl') {
        const ttlText = await buildTurtleExport(snapshot);
        downloadBlob(`${fileBase}.ttl`, new Blob([ttlText], { type: 'text/turtle;charset=utf-8' }));
      } else if (format === 'html') {
        const htmlText = buildHtmlExport(snapshot);
        downloadBlob(`${fileBase}.html`, new Blob([htmlText], { type: 'text/html;charset=utf-8' }));
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      setStatus(`Exported ${format.toUpperCase()} for the current ${snapshot.metadata.viewLabel.toLowerCase()}.`);
      setIsExportMenuOpen(false);
    } catch (error) {
      setStatus(`Export failed: ${error.message || 'Unexpected export error.'}`);
    }
  }

  function fitCurrentGraphViewport(cy, duration = 250) {
    const visibleElementsForFit = cy
      .elements(':visible')
      .not('[edgeAnchor = 1]')
      .not('[edgeBendHandle = 1]')
      .not('[edgeAnchorTether = 1]');
    if (visibleElementsForFit.length === 0) {
      return;
    }
    cy.animate({
      fit: {
        eles: visibleElementsForFit,
        padding: 42,
      },
      duration,
    });
  }

  function shouldUseMagneticInitialLayout() {
    return true;
  }

  function hasFiniteNodePositions(cy) {
    return cy.nodes().not('[edgeAnchor = 1]').every((node) => {
      const position = node.position();
      return Number.isFinite(position.x) && Number.isFinite(position.y);
    });
  }

  function synchronizeEdgeAnchorPositions(cy) {
    const anchorNodes = cy.nodes('[edgeAnchor = 1]');
    if (anchorNodes.empty()) {
      return;
    }

    cy.batch(() => {
      anchorNodes.forEach((anchorNode) => {
        const anchoredEdgeId = anchorNode.data('anchoredEdgeId');
        if (anchoredEdgeId) {
          const anchoredEdge = cy.$id(anchoredEdgeId);
          if (!anchoredEdge.empty()) {
            const midpoint = anchoredEdge.midpoint?.();
            if (midpoint && Number.isFinite(midpoint.x) && Number.isFinite(midpoint.y)) {
              anchorNode.position(midpoint);
              return;
            }
          }
        }

        const sourceId = anchorNode.data('anchoredSourceId');
        const targetId = anchorNode.data('anchoredTargetId');
        if (!sourceId || !targetId) {
          return;
        }

        const sourceNode = cy.$id(sourceId);
        const targetNode = cy.$id(targetId);
        if (sourceNode.empty() || targetNode.empty()) {
          return;
        }

        const sourcePosition = sourceNode.position();
        const targetPosition = targetNode.position();
        if (
          !Number.isFinite(sourcePosition.x) ||
          !Number.isFinite(sourcePosition.y) ||
          !Number.isFinite(targetPosition.x) ||
          !Number.isFinite(targetPosition.y)
        ) {
          return;
        }

        anchorNode.position({
          x: (sourcePosition.x + targetPosition.x) / 2,
          y: (sourcePosition.y + targetPosition.y) / 2,
        });
      });
    });
  }

  function isEditableCurveEdge(edge) {
    if (!edge || edge.empty()) {
      return false;
    }

    if (
      edge.data('edgeAnchorTether') === 1 ||
      edge.data('edgeAttachedConnector') === 1 ||
      edge.data('owlRelationConnector') === 1
    ) {
      return false;
    }

    return edge.source().id() !== edge.target().id();
  }

  function computeCurveOverrideFromPoint(edge, point) {
    const sourcePosition = edge.source().position();
    const targetPosition = edge.target().position();
    const dx = targetPosition.x - sourcePosition.x;
    const dy = targetPosition.y - sourcePosition.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 0.0001) {
      return null;
    }

    const length = Math.sqrt(lengthSquared);
    const px = point.x - sourcePosition.x;
    const py = point.y - sourcePosition.y;
    const rawWeight = (px * dx + py * dy) / lengthSquared;
    const weight = Math.max(0.08, Math.min(0.92, rawWeight));
    const distance = ((px * dy - py * dx) / length) * -EDGE_BEND_DISTANCE_GAIN;
    return {
      weight: Number(weight.toFixed(4)),
      distance: Number(distance.toFixed(2)),
    };
  }

  function computeCurveHandlePosition(edge) {
    const sourcePosition = edge.source().position();
    const targetPosition = edge.target().position();
    const dx = targetPosition.x - sourcePosition.x;
    const dy = targetPosition.y - sourcePosition.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 0.0001) {
      return edge.midpoint?.() ?? {
        x: (sourcePosition.x + targetPosition.x) / 2,
        y: (sourcePosition.y + targetPosition.y) / 2,
      };
    }

    const midpoint = edge.midpoint?.() ?? {
      x: (sourcePosition.x + targetPosition.x) / 2,
      y: (sourcePosition.y + targetPosition.y) / 2,
    };
    const length = Math.sqrt(lengthSquared);
    const normalX = -dy / length;
    const normalY = dx / length;
    return {
      x: midpoint.x + normalX * EDGE_BEND_HANDLE_CENTER_OFFSET,
      y: midpoint.y + normalY * EDGE_BEND_HANDLE_CENTER_OFFSET,
    };
  }

  function applyCurveOverrideToEdge(cy, edgeId, override) {
    const edge = cy.$id(edgeId);
    if (edge.empty()) {
      return;
    }

    if (override) {
      edgeCurveOverridesRef.current.set(edgeId, override);
      edge.data({
        customCurve: 1,
        curveStyle: 'round-segments',
        segmentWeights: String(override.weight),
        segmentDistances: String(override.distance),
      });
    } else {
      edgeCurveOverridesRef.current.delete(edgeId);
      edge.removeData('customCurve');
      edge.removeData('curveStyle');
      edge.removeData('segmentWeights');
      edge.removeData('segmentDistances');
    }
  }

  function synchronizeEdgeBendHandle(cy, activeEdgeId = selectedEdgeId) {
    const handleId = '__edge-bend-handle__';
    const existingHandle = cy.$id(handleId);
    if (!activeEdgeId) {
      if (!existingHandle.empty()) {
        existingHandle.remove();
      }
      return;
    }

    const edge = cy.$id(activeEdgeId);
    if (edge.empty() || !isEditableCurveEdge(edge)) {
      if (!existingHandle.empty()) {
        existingHandle.remove();
      }
      return;
    }

    const position = computeCurveHandlePosition(edge);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      if (!existingHandle.empty()) {
        existingHandle.remove();
      }
      return;
    }

    if (existingHandle.empty()) {
      cy.add({
        group: 'nodes',
        data: {
          id: handleId,
          label: EDGE_BEND_HANDLE_GLYPH,
          edgeBendHandle: 1,
          ownerEdgeId: activeEdgeId,
        },
        position,
      });
      return;
    }

    existingHandle.data('ownerEdgeId', activeEdgeId);
    existingHandle.position(position);
  }

  function applySpiralSeedLayout(cy, options = {}) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length === 0) {
      return false;
    }
    const compactness = Number.isFinite(options.compactness) ? options.compactness : 1;
    const degreeById = buildVisibleIncidentEdgeCounts(cy, nodes);

    const nodeEntries = nodes
      .map((node) => ({
        id: node.id(),
        node,
        degree: degreeById.get(node.id()) ?? 0,
        span: Math.max(node.width(), node.height()),
      }))
      .sort((left, right) => right.degree - left.degree || left.id.localeCompare(right.id));
    const normalizeRank = buildMinMaxRankNormalizer(nodeEntries.map((entry) => entry.degree));
    nodeEntries.forEach((entry) => {
      entry.rank = normalizeRank(entry.degree);
    });
    const spacing = Math.max(
      Math.round(52 * compactness),
      Math.round((nodeEntries.reduce((span, entry) => Math.max(span, entry.span), 80) + 28) * compactness),
    );
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    cy.batch(() => {
      nodeEntries.forEach((entry, index) => {
        if (index === 0) {
          entry.node.position({ x: 0, y: 0 });
          return;
        }

        const angle = index * goldenAngle;
        const radius = spacing * Math.sqrt(index) * (0.82 + (1 - entry.rank) * 0.42);
        entry.node.position({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      });
    });

    return true;
  }

  function buildVisibleIncidentEdgeCounts(cy, nodes = cy.nodes(':visible').not('[edgeAnchor = 1]')) {
    const degreeById = new Map();
    nodes.forEach((node) => {
      degreeById.set(node.id(), 0);
    });

    cy.edges(':visible')
      .not('[edgeAnchorTether = 1]')
      .not('[edgeAttachedConnector = 1]')
      .not('[owlRelationConnector = 1]')
      .forEach((edge) => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        if (degreeById.has(sourceId)) {
          degreeById.set(sourceId, (degreeById.get(sourceId) ?? 0) + 1);
        }
        if (degreeById.has(targetId) && targetId !== sourceId) {
          degreeById.set(targetId, (degreeById.get(targetId) ?? 0) + 1);
        }
      });

    return degreeById;
  }

  function buildMinMaxRankNormalizer(values) {
    const numericValues = Array.from(values).filter((value) => Number.isFinite(value));
    const minValue = numericValues.length > 0 ? Math.min(...numericValues) : 0;
    const maxValue = numericValues.length > 0 ? Math.max(...numericValues) : 0;
    const span = maxValue - minValue;

    if (!Number.isFinite(span) || span <= 0) {
      return () => 0;
    }

    return (value) => Math.max(0, Math.min(1, (value - minValue) / span));
  }

  function applyMagneticInitialLayout(cy, options = {}) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length < 2) {
      return false;
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const preserveCurrentPositions = Boolean(options.preserveCurrentPositions);
    const compactness = Number.isFinite(options.compactness) ? options.compactness : 1;
    const iterationBoost = Number.isFinite(options.iterationBoost) ? options.iterationBoost : 1;

    const edges = cy
      .edges(':visible')
      .not('[edgeAnchorTether = 1]')
      .not('[edgeAttachedConnector = 1]')
      .not('[owlRelationConnector = 1]');
    const adjacency = new Map();
    const nodeMetrics = [];
    let maxNodeSpan = 80;

    nodes.forEach((node) => {
      adjacency.set(node.id(), new Set());
      const width = Math.max(36, Number(node.width()) || 36);
      const height = Math.max(24, Number(node.height()) || 24);
      maxNodeSpan = Math.max(maxNodeSpan, width, height);
      nodeMetrics.push({
        id: node.id(),
        node,
        width,
        height,
        degree: 0,
        rank: 0,
        repulsionStrength: 1,
        attractionStrength: 1,
        mass: 1,
        mobility: 1,
      });
    });

    const edgeCountById = new Map();
    nodes.forEach((node) => {
      edgeCountById.set(node.id(), 0);
    });

    edges.forEach((edge) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      if (!adjacency.has(sourceId) || !adjacency.has(targetId)) {
        return;
      }
      adjacency.get(sourceId)?.add(targetId);
      adjacency.get(targetId)?.add(sourceId);
      edgeCountById.set(sourceId, (edgeCountById.get(sourceId) ?? 0) + 1);
      if (targetId !== sourceId) {
        edgeCountById.set(targetId, (edgeCountById.get(targetId) ?? 0) + 1);
      }
    });

    nodeMetrics.forEach((entry) => {
      entry.degree = edgeCountById.get(entry.id) ?? 0;
    });

    const normalizeRank = buildMinMaxRankNormalizer(nodeMetrics.map((entry) => entry.degree));
    nodeMetrics.forEach((entry) => {
      const normalizedRank = clamp(normalizeRank(entry.degree), 0, 1);
      entry.rank = normalizedRank;
      entry.repulsionStrength = 1.2 + normalizedRank * 2.35;
      entry.attractionStrength = 1.18 - normalizedRank * 0.9;
      entry.mass = 1.05 + normalizedRank * 2.35;
      entry.mobility = 1 / entry.mass;
      entry.completelyRepulsiveRadius = Math.max(
        44,
        Math.max(entry.width, entry.height) * 0.62 + 0.25 * normalizedRank * maxNodeSpan,
      );
    });

    nodeMetrics.sort((left, right) => {
      const degreeDiff = right.degree - left.degree;
      if (degreeDiff !== 0) {
        return degreeDiff;
      }
      return left.id.localeCompare(right.id);
    });
    const nodeMetricById = new Map(nodeMetrics.map((entry) => [entry.id, entry]));

    const baseSpacing = Math.max(92, Math.round(maxNodeSpan + 36));
    const idealEdgeLength = Math.max(48, Math.round(baseSpacing * 0.58 * compactness));
    const repulsionRadius = Math.max(
      baseSpacing * 0.9,
      maxNodeSpan * 1.2,
      ...nodeMetrics.map((entry) => entry.completelyRepulsiveRadius * 2 + maxNodeSpan * 0.85),
    );
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const positions = new Map();

    nodeMetrics.forEach((entry, index) => {
      if (preserveCurrentPositions) {
        const currentPosition = entry.node.position();
        if (Number.isFinite(currentPosition.x) && Number.isFinite(currentPosition.y)) {
          positions.set(entry.id, { x: currentPosition.x, y: currentPosition.y });
          return;
        }
      }

      if (index === 0) {
        positions.set(entry.id, { x: 0, y: 0 });
        return;
      }

      const radius = baseSpacing * Math.sqrt(index);
      const angle = index * goldenAngle;
      positions.set(entry.id, {
        x: Math.cos(angle) * radius * (0.72 + (1 - entry.rank) * 0.56),
        y: Math.sin(angle) * radius * (0.72 + (1 - entry.rank) * 0.56),
      });
    });

    const iterationCount = Math.max(40, Math.round((nodes.length > 160 ? 85 : 115) * iterationBoost));
    const bucketSize = repulsionRadius;

    for (let iteration = 0; iteration < iterationCount; iteration += 1) {
      const forceById = new Map(nodeMetrics.map((entry) => [entry.id, { x: 0, y: 0 }]));
      const buckets = new Map();

      nodeMetrics.forEach((entry) => {
        const position = positions.get(entry.id);
        const bucketX = Math.floor(position.x / bucketSize);
        const bucketY = Math.floor(position.y / bucketSize);
        const bucketKey = `${bucketX}:${bucketY}`;
        const bucket = buckets.get(bucketKey);
        if (bucket) {
          bucket.push(entry);
        } else {
          buckets.set(bucketKey, [entry]);
        }
      });

      for (const entry of nodeMetrics) {
        const position = positions.get(entry.id);
        const bucketX = Math.floor(position.x / bucketSize);
        const bucketY = Math.floor(position.y / bucketSize);

        for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
          for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
            const bucket = buckets.get(`${bucketX + deltaX}:${bucketY + deltaY}`);
            if (!bucket) {
              continue;
            }

            for (const other of bucket) {
              if (other.id <= entry.id) {
                continue;
              }

              const otherPosition = positions.get(other.id);
              let dx = otherPosition.x - position.x;
              let dy = otherPosition.y - position.y;
              let distance = Math.hypot(dx, dy);
              if (distance < 0.001) {
                dx = 0.01;
                dy = 0.01;
                distance = Math.hypot(dx, dy);
              }

              const completeRepulsionDistance =
                entry.completelyRepulsiveRadius + other.completelyRepulsiveRadius;
              const repulsionStartDistance = Math.max(completeRepulsionDistance + 1, completeRepulsionDistance + maxNodeSpan * 0.1);

              if (distance > repulsionRadius) {
                continue;
              }

              const overlapDistance =
                Math.max(entry.width, entry.height) / 2 + Math.max(other.width, other.height) / 2 + 12;
              const closeness = Math.max(
                0,
                (repulsionRadius - Math.max(distance, repulsionStartDistance)) /
                Math.max(1, repulsionRadius - repulsionStartDistance),
              );
              const rankCrowdingBoost = 1 + Math.max(entry.rank, other.rank) * 0.95;
              const exclusionIntrusion = Math.max(0, completeRepulsionDistance - distance);
              const exclusionBoost =
                exclusionIntrusion > 0
                  ? 3.8 + exclusionIntrusion / Math.max(1, completeRepulsionDistance * 0.22)
                  : 0;
              const overlapBoost =
                distance < overlapDistance
                  ? 1.7 + (overlapDistance - distance) / overlapDistance + rankCrowdingBoost * 0.2
                  : 0.55 + rankCrowdingBoost * 0.12;
              const pairRepulsionScale =
                ((entry.repulsionStrength + other.repulsionStrength) / 2) *
                (1 + ((entry.rank + other.rank) / 2) * 0.95);
              const distanceFromRepulsionStart = Math.max(0, distance - repulsionStartDistance);
              const repulsion =
                (closeness * closeness * 9.5 * overlapBoost + exclusionBoost + 1 / (1 + distanceFromRepulsionStart * 0.018)) *
                pairRepulsionScale;
              const unitX = dx / distance;
              const unitY = dy / distance;
              const entryForce = forceById.get(entry.id);
              const otherForce = forceById.get(other.id);
              entryForce.x -= unitX * repulsion;
              entryForce.y -= unitY * repulsion;
              otherForce.x += unitX * repulsion;
              otherForce.y += unitY * repulsion;
            }
          }
        }
      }

      edges.forEach((edge) => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        const sourcePosition = positions.get(sourceId);
        const targetPosition = positions.get(targetId);
        if (!sourcePosition || !targetPosition) {
          return;
        }
        let dx = targetPosition.x - sourcePosition.x;
        let dy = targetPosition.y - sourcePosition.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          dx = 0.01;
          dy = 0.01;
          distance = Math.hypot(dx, dy);
        }

        const unitX = dx / distance;
        const unitY = dy / distance;
        const sourceEntry = nodeMetricById.get(sourceId);
        const targetEntry = nodeMetricById.get(targetId);
        const targetEdgeLength = idealEdgeLength * (0.92 + ((sourceEntry?.rank ?? 0) + (targetEntry?.rank ?? 0)) * 0.18);
        const stretch = distance - targetEdgeLength;
        const attractionScale = ((sourceEntry?.attractionStrength ?? 1) + (targetEntry?.attractionStrength ?? 1)) / 2;
        const attraction = stretch * 0.16 * attractionScale;
        const sourceForce = forceById.get(sourceId);
        const targetForce = forceById.get(targetId);
        if (!sourceForce || !targetForce) {
          return;
        }
        sourceForce.x += unitX * attraction;
        sourceForce.y += unitY * attraction;
        targetForce.x -= unitX * attraction;
        targetForce.y -= unitY * attraction;
      });

      let centroidX = 0;
      let centroidY = 0;
      nodeMetrics.forEach((entry) => {
        const position = positions.get(entry.id);
        centroidX += position.x;
        centroidY += position.y;
      });
      centroidX /= nodeMetrics.length;
      centroidY /= nodeMetrics.length;

      const cooling = 0.45 + (1 - iteration / iterationCount) * 1.45;
      nodeMetrics.forEach((entry) => {
        const position = positions.get(entry.id);
        const force = forceById.get(entry.id);
        if (!position || !force) {
          return;
        }
        const gravity = 0.0012 + (1 - entry.rank) * 0.0018;
        position.x += (force.x * entry.mobility - (position.x - centroidX) * gravity) * cooling;
        position.y += (force.y * entry.mobility - (position.y - centroidY) * gravity) * cooling;
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          const index = nodeMetrics.findIndex((candidate) => candidate.id === entry.id);
          const radius = baseSpacing * Math.sqrt(Math.max(1, index));
          const angle = Math.max(1, index) * goldenAngle;
          position.x = Math.cos(angle) * radius;
          position.y = Math.sin(angle) * radius;
        }
      });
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    nodeMetrics.forEach((entry) => {
      const position = positions.get(entry.id);
      if (position.x < minX) minX = position.x;
      if (position.x > maxX) maxX = position.x;
      if (position.y < minY) minY = position.y;
      if (position.y > maxY) maxY = position.y;
    });

    const offsetX = Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) / 2 : 0;
    const offsetY = Number.isFinite(minY) && Number.isFinite(maxY) ? (minY + maxY) / 2 : 0;

    cy.batch(() => {
      nodeMetrics.forEach((entry) => {
        const position = positions.get(entry.id);
        if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          return;
        }
        entry.node.position({
          x: position.x - offsetX,
          y: position.y - offsetY,
        });
      });
    });

    return hasFiniteNodePositions(cy);
  }

  function resolveNodeOverlaps(cy, maxPasses = 16, spacing = 18) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length < 2) {
      return false;
    }

    let movedAny = false;
    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const degreeById = buildVisibleIncidentEdgeCounts(cy, nodes);
    const normalizeRank = buildMinMaxRankNormalizer(degreeById.values());

    for (let pass = 0; pass < maxPasses; pass += 1) {
      let movedThisPass = false;
      const nodeEntries = nodes.map((node) => ({
        id: node.id(),
        node,
        x: node.position('x'),
        y: node.position('y'),
        halfWidth: Math.max(20, node.width() / 2) + spacing / 2,
        halfHeight: Math.max(16, node.height() / 2) + spacing / 2,
        rank: clamp01(normalizeRank(degreeById.get(node.id()) ?? 0)),
      }));

      cy.batch(() => {
        for (let index = 0; index < nodeEntries.length; index += 1) {
          const current = nodeEntries[index];

          for (let otherIndex = index + 1; otherIndex < nodeEntries.length; otherIndex += 1) {
            const other = nodeEntries[otherIndex];
            let dx = other.x - current.x;
            let dy = other.y - current.y;
            const overlapX = current.halfWidth + other.halfWidth - Math.abs(dx);
            const overlapY = current.halfHeight + other.halfHeight - Math.abs(dy);

            if (overlapX <= 0 || overlapY <= 0) {
              continue;
            }

            movedThisPass = true;
            movedAny = true;

            if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
              dx = 0.01;
              dy = 0.01;
            }

            if (overlapX < overlapY) {
              const shift = overlapX / 2 + 1.5;
              const direction = dx >= 0 ? 1 : -1;
              const currentMobility = 1 - current.rank * 0.55;
              const otherMobility = 1 - other.rank * 0.55;
              const mobilityTotal = currentMobility + otherMobility || 1;
              current.x -= direction * shift * (currentMobility / mobilityTotal);
              other.x += direction * shift * (otherMobility / mobilityTotal);
            } else {
              const shift = overlapY / 2 + 1.5;
              const direction = dy >= 0 ? 1 : -1;
              const currentMobility = 1 - current.rank * 0.55;
              const otherMobility = 1 - other.rank * 0.55;
              const mobilityTotal = currentMobility + otherMobility || 1;
              current.y -= direction * shift * (currentMobility / mobilityTotal);
              other.y += direction * shift * (otherMobility / mobilityTotal);
            }
          }
        }

        nodeEntries.forEach((entry) => {
          entry.node.position({
            x: entry.x,
            y: entry.y,
          });
        });
      });

      if (!movedThisPass) {
        break;
      }
    }

    return movedAny;
  }

  function applySimpleRdfForceLayout(cy, options = {}) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length < 2) {
      return false;
    }

    const edges = cy
      .edges(':visible')
      .not('[edgeAnchorTether = 1]')
      .not('[edgeAttachedConnector = 1]')
      .not('[owlRelationConnector = 1]');

    const iterations = Number.isFinite(options.iterations) ? options.iterations : 80;
    const attractionStrength = Number.isFinite(options.attractionStrength) ? options.attractionStrength : 0.015;
    const repulsionStrength = Number.isFinite(options.repulsionStrength) ? options.repulsionStrength : 12000;
    const targetEdgeLength = Number.isFinite(options.targetEdgeLength) ? options.targetEdgeLength : 110;
    const maxStep = Number.isFinite(options.maxStep) ? options.maxStep : 18;
    const centeringStrength = Number.isFinite(options.centeringStrength) ? options.centeringStrength : 0.003;

    const nodeEntries = nodes.map((node) => ({
      id: node.id(),
      node,
      width: Math.max(36, Number(node.width()) || 36),
      height: Math.max(24, Number(node.height()) || 24),
      degree: 0,
    }));
    const nodeById = new Map(nodeEntries.map((entry) => [entry.id, entry]));

    edges.forEach((edge) => {
      const sourceEntry = nodeById.get(edge.source().id());
      const targetEntry = nodeById.get(edge.target().id());
      if (sourceEntry) {
        sourceEntry.degree += 1;
      }
      if (targetEntry && targetEntry !== sourceEntry) {
        targetEntry.degree += 1;
      }
    });

    const positions = new Map(
      nodeEntries.map((entry) => {
        const position = entry.node.position();
        return [
          entry.id,
          {
            x: Number.isFinite(position.x) ? position.x : 0,
            y: Number.isFinite(position.y) ? position.y : 0,
          },
        ];
      }),
    );
    const snapshot = new Map(
      Array.from(positions.entries()).map(([id, position]) => [id, { x: position.x, y: position.y }]),
    );

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const cooling = 1 - iteration / iterations;
      const forceById = new Map(nodeEntries.map((entry) => [entry.id, { x: 0, y: 0 }]));

      for (let index = 0; index < nodeEntries.length; index += 1) {
        const current = nodeEntries[index];
        const currentPosition = positions.get(current.id);
        for (let otherIndex = index + 1; otherIndex < nodeEntries.length; otherIndex += 1) {
          const other = nodeEntries[otherIndex];
          const otherPosition = positions.get(other.id);
          let dx = otherPosition.x - currentPosition.x;
          let dy = otherPosition.y - currentPosition.y;
          let distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < 0.01) {
            dx = 0.1;
            dy = 0.1;
            distanceSquared = dx * dx + dy * dy;
          }

          const distance = Math.sqrt(distanceSquared);
          const minDistance =
            Math.max(current.width, current.height) / 2 +
            Math.max(other.width, other.height) / 2 +
            10;
          const overlapBoost = distance < minDistance ? 3 + (minDistance - distance) / Math.max(1, minDistance) : 1;
          const repulsion = (repulsionStrength / distanceSquared) * overlapBoost;
          const unitX = dx / distance;
          const unitY = dy / distance;

          const currentForce = forceById.get(current.id);
          const otherForce = forceById.get(other.id);
          currentForce.x -= unitX * repulsion;
          currentForce.y -= unitY * repulsion;
          otherForce.x += unitX * repulsion;
          otherForce.y += unitY * repulsion;
        }
      }

      edges.forEach((edge) => {
        const sourceId = edge.source().id();
        const targetId = edge.target().id();
        const sourcePosition = positions.get(sourceId);
        const targetPosition = positions.get(targetId);
        if (!sourcePosition || !targetPosition) {
          return;
        }

        let dx = targetPosition.x - sourcePosition.x;
        let dy = targetPosition.y - sourcePosition.y;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 0.01) {
          dx = 0.1;
          dy = 0.1;
          distanceSquared = dx * dx + dy * dy;
        }

        const distance = Math.sqrt(distanceSquared);
        const stretch = distance - targetEdgeLength;
        const attraction = stretch * attractionStrength;
        const unitX = dx / distance;
        const unitY = dy / distance;
        const sourceForce = forceById.get(sourceId);
        const targetForce = forceById.get(targetId);
        if (!sourceForce || !targetForce) {
          return;
        }
        sourceForce.x += unitX * attraction;
        sourceForce.y += unitY * attraction;
        targetForce.x -= unitX * attraction;
        targetForce.y -= unitY * attraction;
      });

      let centroidX = 0;
      let centroidY = 0;
      nodeEntries.forEach((entry) => {
        const position = positions.get(entry.id);
        centroidX += position.x;
        centroidY += position.y;
      });
      centroidX /= nodeEntries.length;
      centroidY /= nodeEntries.length;

      nodeEntries.forEach((entry) => {
        const position = positions.get(entry.id);
        const force = forceById.get(entry.id);
        const degreeDamping = 1 / Math.max(1, 1 + entry.degree * 0.08);
        const stepX = Math.max(-maxStep, Math.min(maxStep, force.x * cooling * degreeDamping));
        const stepY = Math.max(-maxStep, Math.min(maxStep, force.y * cooling * degreeDamping));
        position.x += stepX - (position.x - centroidX) * centeringStrength;
        position.y += stepY - (position.y - centroidY) * centeringStrength;
      });
    }

    cy.batch(() => {
      nodeEntries.forEach((entry) => {
        const position = positions.get(entry.id);
        if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
          return;
        }
        entry.node.position(position);
      });
    });

    if (!hasFiniteNodePositions(cy)) {
      cy.batch(() => {
        nodeEntries.forEach((entry) => {
          const position = snapshot.get(entry.id);
          if (position) {
            entry.node.position(position);
          }
        });
      });
      return false;
    }

    return true;
  }

  function hasNodeOverlap(cy, spacing = 0) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length < 2) {
      return false;
    }

    const nodeEntries = nodes.map((node) => ({
      id: node.id(),
      x: node.position('x'),
      y: node.position('y'),
      halfWidth: Math.max(20, node.width() / 2) + spacing / 2,
      halfHeight: Math.max(16, node.height() / 2) + spacing / 2,
    }));

    for (let index = 0; index < nodeEntries.length; index += 1) {
      const current = nodeEntries[index];
      for (let otherIndex = index + 1; otherIndex < nodeEntries.length; otherIndex += 1) {
        const other = nodeEntries[otherIndex];
        const overlapX = current.halfWidth + other.halfWidth - Math.abs(other.x - current.x);
        const overlapY = current.halfHeight + other.halfHeight - Math.abs(other.y - current.y);
        if (overlapX > 0 && overlapY > 0) {
          return true;
        }
      }
    }

    return false;
  }

  function compactLayoutUntilNoOverlapBoundary(cy, options = {}) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length < 2) {
      return false;
    }

    const passes = Number.isFinite(options.passes) ? options.passes : 16;
    const scaleStep = Number.isFinite(options.scaleStep) ? options.scaleStep : 0.94;
    const spacing = Number.isFinite(options.spacing) ? options.spacing : 6;
    const resolvePasses = Number.isFinite(options.resolvePasses) ? options.resolvePasses : 16;
    let compacted = false;

    for (let pass = 0; pass < passes; pass += 1) {
      const snapshot = new Map(
        nodes.map((node) => [
          node.id(),
          {
            x: node.position('x'),
            y: node.position('y'),
          },
        ]),
      );

      let centroidX = 0;
      let centroidY = 0;
      nodes.forEach((node) => {
        centroidX += node.position('x');
        centroidY += node.position('y');
      });
      centroidX /= nodes.length;
      centroidY /= nodes.length;

      cy.batch(() => {
        nodes.forEach((node) => {
          const position = snapshot.get(node.id());
          node.position({
            x: centroidX + (position.x - centroidX) * scaleStep,
            y: centroidY + (position.y - centroidY) * scaleStep,
          });
        });
      });

      resolveNodeOverlaps(cy, resolvePasses, spacing);

      if (!hasFiniteNodePositions(cy) || hasNodeOverlap(cy, Math.max(0, spacing - 1))) {
        cy.batch(() => {
          nodes.forEach((node) => {
            const position = snapshot.get(node.id());
            node.position(position);
          });
        });
        break;
      }

      compacted = true;
    }

    return compacted;
  }

  function enforceRankAwareSpacing(cy, maxPasses = 10, basePadding = 14) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length < 2) {
      return false;
    }

    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const degreeById = buildVisibleIncidentEdgeCounts(cy, nodes);
    const normalizeRank = buildMinMaxRankNormalizer(degreeById.values());
    const maxNodeSpan = nodes.reduce((largest, node) => Math.max(largest, Math.max(node.width(), node.height())), 44);

    let movedAny = false;

    for (let pass = 0; pass < maxPasses; pass += 1) {
      let movedThisPass = false;
      const nodeEntries = nodes.map((node) => ({
        id: node.id(),
        node,
        x: node.position('x'),
        y: node.position('y'),
        halfWidth: Math.max(20, node.width() / 2),
        halfHeight: Math.max(16, node.height() / 2),
        rank: clamp01(normalizeRank(degreeById.get(node.id()) ?? 0)),
        completelyRepulsiveRadius:
          Math.max(
            44,
            Math.max(node.width(), node.height()) * 0.62 + clamp01(normalizeRank(degreeById.get(node.id()) ?? 0)) * maxNodeSpan,
          ),
      }));

      cy.batch(() => {
        for (let index = 0; index < nodeEntries.length; index += 1) {
          const current = nodeEntries[index];

          for (let otherIndex = index + 1; otherIndex < nodeEntries.length; otherIndex += 1) {
            const other = nodeEntries[otherIndex];
            let dx = other.x - current.x;
            let dy = other.y - current.y;
            let distance = Math.hypot(dx, dy);
            if (distance < 0.001) {
              dx = 0.01;
              dy = 0.01;
              distance = Math.hypot(dx, dy);
            }

            const pairRank = Math.max(current.rank, other.rank);
            const desiredDistance =
              Math.max(
                current.completelyRepulsiveRadius + other.completelyRepulsiveRadius,
                Math.max(current.halfWidth + other.halfWidth, current.halfHeight + other.halfHeight) +
                basePadding +
                pairRank * 42,
              );
            if (distance >= desiredDistance) {
              continue;
            }

            movedThisPass = true;
            movedAny = true;
            const unitX = dx / distance;
            const unitY = dy / distance;
            const shift = (desiredDistance - distance) / 2;
            const currentMobility = 1 - current.rank * 0.65;
            const otherMobility = 1 - other.rank * 0.65;
            const mobilityTotal = currentMobility + otherMobility || 1;
            current.x -= unitX * shift * (currentMobility / mobilityTotal);
            current.y -= unitY * shift * (currentMobility / mobilityTotal);
            other.x += unitX * shift * (otherMobility / mobilityTotal);
            other.y += unitY * shift * (otherMobility / mobilityTotal);
          }
        }

        nodeEntries.forEach((entry) => {
          entry.node.position({
            x: entry.x,
            y: entry.y,
          });
        });
      });

      if (!movedThisPass) {
        break;
      }
    }

    return movedAny;
  }

  function expandHighRankCore(cy, options = {}) {
    const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]');
    if (nodes.length < 4) {
      return false;
    }

    const degreeById = buildVisibleIncidentEdgeCounts(cy, nodes);
    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const normalizeRank = buildMinMaxRankNormalizer(degreeById.values());
    const maxNodes = Number.isFinite(options.maxNodes) ? options.maxNodes : 8;
    const rankThreshold = Number.isFinite(options.rankThreshold) ? options.rankThreshold : 0.72;
    const blend = Number.isFinite(options.blend) ? options.blend : 0.42;
    const minSpacing = Number.isFinite(options.minSpacing) ? options.minSpacing : 124;

    const ranked = nodes
      .map((node) => {
        const degree = degreeById.get(node.id()) ?? 0;
        const rank = clamp01(normalizeRank(degree));
        return {
          id: node.id(),
          node,
          degree,
          rank,
          x: node.position('x'),
          y: node.position('y'),
          span: Math.max(node.width(), node.height()),
        };
      })
      .sort((left, right) => right.degree - left.degree || left.id.localeCompare(right.id));

    const topNodes = ranked
      .filter((entry, index) => entry.rank >= rankThreshold || index < Math.min(maxNodes, 5))
      .slice(0, maxNodes);

    if (topNodes.length < 3) {
      return false;
    }

    let centroidX = 0;
    let centroidY = 0;
    topNodes.forEach((entry) => {
      centroidX += entry.x;
      centroidY += entry.y;
    });
    centroidX /= topNodes.length;
    centroidY /= topNodes.length;

    const maxSpan = Math.max(...topNodes.map((entry) => entry.span));
    const ringRadius = Math.max(
      140,
      (topNodes.length * minSpacing) / (2 * Math.PI),
      maxSpan * 1.15,
    );

    const withAngles = topNodes.map((entry, index) => {
      const dx = entry.x - centroidX;
      const dy = entry.y - centroidY;
      const angle = Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 ? (index / topNodes.length) * Math.PI * 2 : Math.atan2(dy, dx);
      return {
        ...entry,
        angle,
      };
    });

    withAngles.sort((left, right) => left.angle - right.angle);

    let movedAny = false;
    cy.batch(() => {
      withAngles.forEach((entry, index) => {
        const targetAngle = (index / withAngles.length) * Math.PI * 2;
        const targetRadius = ringRadius * (0.96 + entry.rank * 0.28);
        const targetX = centroidX + Math.cos(targetAngle) * targetRadius;
        const targetY = centroidY + Math.sin(targetAngle) * targetRadius;
        const nextX = entry.x + (targetX - entry.x) * blend;
        const nextY = entry.y + (targetY - entry.y) * blend;
        if (Math.abs(nextX - entry.x) > 0.5 || Math.abs(nextY - entry.y) > 0.5) {
          movedAny = true;
        }
        entry.node.position({
          x: nextX,
          y: nextY,
        });
      });
    });

    return movedAny;
  }

  function nudgeNodesTowardLandscape(cy, targetRatio = 1.5) {
    const nodes = cy.nodes(':visible');
    if (nodes.length < 2) {
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
      const x = node.position('x');
      const y = node.position('y');
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (!Number.isFinite(spanX) || !Number.isFinite(spanY) || spanX <= 1 || spanY <= 1) {
      return;
    }

    const currentRatio = spanX / spanY;
    if (currentRatio >= targetRatio) {
      return;
    }

    const scaleY = Math.max(0.35, currentRatio / targetRatio);
    const centerY = (minY + maxY) / 2;

    cy.batch(() => {
      nodes.forEach((node) => {
        const position = node.position();
        node.position({
          x: position.x,
          y: centerY + (position.y - centerY) * scaleY,
        });
      });
    });
  }

  function buildClassBadgeTooltipPayload(event) {
    const node = event.target;
    if (!node || !event.renderedPosition) {
      return null;
    }

    const classCount = Number(node.data('classCount') ?? node.data('hasClass') ?? 0);
    const tooltipText = String(node.data('classTooltip') ?? '');
    const badgeWidth = Number(node.data('badgeWidth') ?? 0);

    if (classCount < 2 || !tooltipText || badgeWidth <= 0) {
      return null;
    }

    const center = node.renderedPosition();
    const nodeWidth = node.renderedWidth();
    const nodeHeight = node.renderedHeight();
    const badgeRight = center.x + nodeWidth / 2 + 26;
    const badgeLeft = badgeRight - badgeWidth;
    const badgeTop = center.y - nodeHeight / 2 - 7;
    const badgeBottom = badgeTop + 24;

    const cursor = event.renderedPosition;
    const isOverBadge =
      cursor.x >= badgeLeft - 4 &&
      cursor.x <= badgeRight + 4 &&
      cursor.y >= badgeTop - 4 &&
      cursor.y <= badgeBottom + 4;

    if (!isOverBadge) {
      return null;
    }

    const classes = tooltipText
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (classes.length === 0) {
      return null;
    }

    const container = graphContainerRef.current;
    const maxWidth = container?.clientWidth ?? 1200;
    const maxHeight = container?.clientHeight ?? 800;
    const fanWidth = 260;
    const fanHeight = Math.min(360, 52 + classes.length * 26);
    const left = Math.min(Math.max(8, badgeRight + 10), Math.max(8, maxWidth - fanWidth - 8));
    const top = Math.min(Math.max(8, badgeTop - 4), Math.max(8, maxHeight - fanHeight - 8));

    return {
      left,
      top,
      classes,
      count: classCount,
    };
  }

  function buildRestrictionTooltipPayload(event) {
    const node = event.target;
    if (!node || !event.renderedPosition) {
      return null;
    }

    const blankExpressionType = String(node.data('blankExpressionType') ?? '');
    const tooltipText = String(node.data('restrictionTooltip') ?? '').trim();
    if (blankExpressionType !== 'Restriction' || !tooltipText) {
      return null;
    }

    const cursor = event.renderedPosition;
    const container = graphContainerRef.current;
    const maxWidth = container?.clientWidth ?? 1200;
    const maxHeight = container?.clientHeight ?? 800;
    const tooltipWidth = Math.min(440, Math.max(260, Math.round(Math.min(tooltipText.length, 180) * 4.4)));
    const left = Math.min(Math.max(8, cursor.x + 14), Math.max(8, maxWidth - tooltipWidth - 8));
    const top = Math.min(Math.max(8, cursor.y + 12), Math.max(8, maxHeight - 120));

    return {
      left,
      top,
      text: tooltipText,
      width: tooltipWidth,
    };
  }

  function buildHoverTooltipPayload(event) {
    const target = event.target;
    if (!target || !event.renderedPosition) {
      return null;
    }

    const text = String(target.data('hoverText') ?? '').trim();
    if (!text) {
      return null;
    }

    const cursor = event.renderedPosition;
    const container = graphContainerRef.current;
    const maxWidth = container?.clientWidth ?? 1200;
    const maxHeight = container?.clientHeight ?? 800;
    const tooltipWidth = Math.min(520, Math.max(180, Math.round(Math.min(text.length, 220) * 4.6)));
    const lineCount = text.split('\n').length;
    const tooltipHeight = Math.min(360, Math.max(44, 24 + lineCount * 18));
    const left = Math.min(Math.max(8, cursor.x + 14), Math.max(8, maxWidth - tooltipWidth - 8));
    const top = Math.min(Math.max(8, cursor.y + 12), Math.max(8, maxHeight - tooltipHeight - 8));

    return {
      left,
      top,
      text,
      width: tooltipWidth,
    };
  }

  const selectedNodeAllLiteralProperties = useMemo(
    () => (selectedNodeId && graphData ? graphData.dataProperties.get(selectedNodeId) ?? [] : []),
    [selectedNodeId, graphData],
  );
  const selectedNodeMetadataRows = useMemo(() => {
    if (!selectedNodeId || !graphData) {
      return [];
    }

    const baseRows = graphData.nodeMetadata.get(selectedNodeId) ?? [];
    const projectedRows = getProjectedNodeMetadataRows(graphData, selectedNodeId, graphProjectionMode);

    const mergedRows = [...baseRows, ...projectedRows];
    const dedupedRows = [];
    const seen = new Set();
    for (const row of mergedRows) {
      const key = `${row.predicate}||${row.value}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      dedupedRows.push(row);
    }
    return dedupedRows;
  }, [selectedNodeId, graphData, graphProjectionMode]);
  const selectedNodeAnnotationProperties = useMemo(
    () => selectedNodeAllLiteralProperties.filter((row) => row.category === 'annotation'),
    [selectedNodeAllLiteralProperties],
  );
  const selectedNodeDataProperties = useMemo(
    () => selectedNodeAllLiteralProperties.filter((row) => row.category !== 'annotation'),
    [selectedNodeAllLiteralProperties],
  );
  const selectedNodeStatements = useMemo(
    () => (selectedNodeId && graphData ? getNodeStatementBuckets(graphData, selectedNodeId) : { processed: [], unprocessed: [] }),
    [selectedNodeId, graphData],
  );
  const selectedNodeClasses = useMemo(() => {
    if (!selectedNode || !graphData || !Array.isArray(selectedNode.classes) || selectedNode.classes.length === 0) {
      return [];
    }

    return orderClassesSubToSuper(selectedNode.classes, graphData).map((classIri) => ({
      iri: classIri,
      prefixed: toPrefixedName(classIri),
    }));
  }, [selectedNode, graphData]);
  const selectedNodeBaseOntology = useMemo(() => {
    if (!selectedNode?.baseIri) {
      return null;
    }

    return {
      prefix: `${getPrefixFromBaseIri(selectedNode.baseIri)}:`,
      iri: selectedNode.baseIri,
    };
  }, [selectedNode]);
  const selectedEdgeMetadataRows = useMemo(() => {
    if (!selectedEdgeId || !graphData) {
      return [];
    }

    const baseRows = graphData.edgeMetadata.get(selectedEdgeId) ?? [];
    const edge = selectedEdge ?? graphData.edgeMap.get(selectedEdgeId);
    if (!edge) {
      return baseRows;
    }
    const projectedRows = Array.isArray(edge.projectedMetadataRows)
      ? edge.projectedMetadataRows.map((row) => ({
        key: row.key,
        value: row.value,
      }))
      : [];

    const predicateMetadata = graphData.nodeMetadata.get(edge.predicate) ?? [];
    const predicateRows = predicateMetadata.map((row) => ({
      key: `Predicate ${row.predicateLabel}`,
      value: row.value,
    }));

    return [...baseRows, ...projectedRows, ...predicateRows];
  }, [selectedEdgeId, graphData, selectedEdge]);

  const neighborRows = useMemo(
    () => buildNeighborRows(selectedNodeId, graphData, visibleElements),
    [selectedNodeId, graphData, visibleElements],
  );

  const allClassIris = useMemo(() => graphData?.classes.map((entry) => entry.id) ?? [], [graphData]);
  const allBaseIris = useMemo(() => graphData?.baseIris.map((entry) => entry.id) ?? [], [graphData]);
  const hasNamedIndividuals = Boolean(
    graphData?.nodes?.some((node) => node.isInstanceNode),
  );
  const showClassTypeFilter = hasNamedIndividuals && allClassIris.length > 0;

  const isAllClassesSelected =
    allClassIris.length === 0 ||
    (selectedClassIris.length === allClassIris.length && allClassIris.every((iri) => selectedClassIris.includes(iri)));
  const isAllBaseIrisSelected =
    allBaseIris.length === 0 ||
    (selectedBaseIris.length === allBaseIris.length && allBaseIris.every((iri) => selectedBaseIris.includes(iri)));

  useEffect(() => {
    if (!graphData) {
      setSparqlPrefixes([]);
      return;
    }

    const defaults = makeDefaultSparqlPrefixes(graphData.baseIris.map((entry) => entry.id));
    setSparqlPrefixes((current) => {
      const existingByIri = new Map(current.map((row) => [row.iri, row]));
      return defaults.map((row) => {
        const existing = existingByIri.get(row.iri);
        if (!existing) {
          return row;
        }
        return {
          ...row,
          prefix: existing.prefix,
          iri: existing.iri,
        };
      });
    });
  }, [graphData]);

  useEffect(() => {
    if (!graphContainerRef.current) {
      return undefined;
    }

    const cy = cytoscape({
      container: graphContainerRef.current,
      elements: [],
      wheelSensitivity: DEFAULT_GRAPH_ZOOM_SPEED,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            shape: 'round-rectangle',
            'background-color': '#f6f0e8',
            color: '#1e1b16',
            'font-size': DEFAULT_GRAPH_FONT_SIZE,
            'font-weight': 600,
            'text-wrap': 'wrap',
            'text-max-width': 'data(textMaxWidth)',
            'text-justification': 'center',
            'text-valign': 'center',
            'border-width': 0.4,
            'border-color': '#7e6f60',
            width: 'data(nodeWidth)',
            height: 'data(nodeHeight)',
            padding: '4px',
          },
        },
        {
          selector: 'node[hasClass > 0][entityCategory != "class-expression"]',
          style: {
            'background-image': 'data(badgeSvg)',
            'background-image-opacity': 1,
            'background-image-containment': 'over',
            'background-width': 'data(badgeWidth)',
            'background-height': 24,
            'background-position-x': '100%',
            'background-position-y': '0%',
            'background-offset-x': 26,
            'background-offset-y': -7,
            'background-repeat': 'no-repeat',
            'background-fit': 'none',
            'background-clip': 'none',
            'bounds-expansion': 36,
          },
        },
        {
          selector: 'node[entityCategory = "class"]',
          style: {
            shape: 'rectangle',
          },
        },
        {
          selector: 'node[entityCategory = "thing"]',
          style: {
            shape: 'ellipse',
          },
        },
        {
          selector: 'node[entityCategory = "individual"]',
          style: {
            shape: 'round-rectangle',
          },
        },
        {
          selector:
            'node[isOntologyNode = 1], node[entityCategory = "individual"]',
          style: {
            'border-color': '#8f6f52',
            'border-width': 1.1,
          },
        },
        {
          selector: 'node[kind = "literal"]',
          style: {
            'background-color': '#f0e4d7',
            'border-color': '#9b7458',
            color: '#1e1b16',
            shape: 'rectangle',
          },
        },
        {
          selector: 'node[entityCategory = "datatype"]',
          style: {
            shape: 'triangle',
            'background-color': '#eee5da',
            'border-color': '#8e7560',
            color: '#1e1b16',
          },
        },
        {
          selector: 'node[entityCategory = "datatype"][rdfDatatypeDefinedSubtype = 1]',
          style: {
            'border-width': 2.2,
            'background-color': '#f7f2ea',
          },
        },
        {
          selector: 'node[entityCategory = "rdf-connector"]',
          style: {
            shape: 'ellipse',
            width: 42,
            height: 42,
            'background-color': '#fcfaf6',
            'border-color': '#9aa0a4',
            'border-width': 1.2,
            color: '#5c4a39',
            'font-size': 15,
            'font-weight': 700,
            'text-max-width': 34,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'none',
          },
        },
        {
          selector: 'node[entityCategory = "data-property"]',
          style: {
            shape: 'diamond',
            'background-color': '#f0e7db',
            'border-color': '#9b7f66',
            color: '#1e1b16',
          },
        },
        {
          selector: 'node[entityCategory = "object-property"]',
          style: {
            shape: 'hexagon',
            'background-color': '#efe4d7',
            'border-color': '#9f7a57',
            color: '#1e1b16',
          },
        },
        {
          selector: 'node[entityCategory = "annotation-property"]',
          style: {
            shape: 'round-diamond',
            'background-color': '#efe6dd',
            'border-color': '#9e846b',
            'border-style': 'dashed',
            color: '#1e1b16',
          },
        },
        {
          selector: 'node[entityCategory = "class-expression"]',
          style: {
            shape: 'hexagon',
            'background-color': '#e8f2ef',
            'border-color': '#2f8a81',
            'border-width': 2.2,
            color: '#1f4f4c',
          },
        },
        {
          selector: 'node[entityCategory = "class-expression-connector"], node[entityCategory = "all-different"]',
          style: {
            shape: 'ellipse',
            width: 38,
            height: 38,
            'background-color': '#eef3f1',
            'border-color': '#9aa0a4',
            'border-width': 1.4,
            color: '#334047',
            'font-size': 17,
            'font-weight': 800,
            'text-max-width': 32,
          },
        },
        {
          selector: 'node[entityCategory = "enumeration-set"]',
          style: {
            shape: 'rectangle',
            'background-color': '#fffdf9',
            'background-opacity': 0.55,
            'border-color': '#8d6b4c',
            'border-style': 'dashed',
            'border-width': 2,
            color: '#5a3d24',
          },
        },
        {
          selector: 'node[mixedMode = 1][isOntologyNode = 1]',
          style: {
            'background-color': '#e5d5c4',
            'border-color': '#86684f',
            color: '#2d2218',
          },
        },
        {
          selector: 'node[kind = "blank"]',
          style: {
            'background-color': '#fcfaf6',
            'border-color': '#9aa0a4',
            'border-width': 1.2,
            color: '#5c4a39',
            shape: 'hexagon',
          },
        },
        {
          selector: 'node[kind = "blank"][blankExpressionType != ""]',
          style: {
            'background-color': '#fcfaf6',
            'border-color': '#9aa0a4',
            'border-width': 1.2,
            color: '#5c4a39',
          },
        },
        {
          selector: 'node[owlHelper = 1]',
          style: {
            label: '',
            width: 8,
            height: 8,
            'background-opacity': 0,
            'border-width': 0,
            'events': 'no',
          },
        },
        {
          selector: 'node[edgeAnchor = 1]',
          style: {
            label: '',
            width: 1,
            height: 1,
            'background-opacity': 0,
            'border-width': 0,
            opacity: 0,
            'events': 'no',
          },
        },
        {
          selector: 'node[edgeBendHandle = 1]',
          style: {
            label: 'data(label)',
            shape: 'round-rectangle',
            width: `${EDGE_BEND_HANDLE_RENDER_SIZE}px`,
            height: `${EDGE_BEND_HANDLE_RENDER_SIZE}px`,
            'background-color': '#fffdf9',
            'background-opacity': 0.72,
            'border-width': 0.8,
            'border-color': '#d7d2ca',
            color: '#1c1814',
            'font-size': 11,
            'font-family': '"Avenir Next", "Segoe UI Symbol", "Arial Unicode MS", sans-serif',
            'font-weight': 700,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-margin-x': 0,
            'text-margin-y': 0,
            opacity: 1,
            'overlay-opacity': 0,
            'z-index-compare': 'manual',
            'z-compound-depth': 'top',
            'z-index': 999,
          },
        },
        {
          selector: 'node[owlExpressionNode = 1]',
          style: {
            shape: 'ellipse',
            width: 38,
            height: 38,
            'background-color': '#fcfaf6',
            'border-color': '#9aa0a4',
            'border-width': 1.2,
            color: '#5c4a39',
            'font-size': 17,
            'font-weight': 700,
            'text-max-width': 32,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'none',
          },
        },
        {
          selector: 'node[owlGroupNode = 1]',
          style: {
            shape: 'round-rectangle',
            'background-opacity': 0,
            'border-style': 'dashed',
            'border-width': 1.6,
            'border-color': '#a9adb1',
            color: '#7b6148',
            'font-size': 11,
            'font-weight': 600,
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -20,
            padding: '16px',
          },
        },
        {
          selector: 'node[owlCollectionConnector = 1]',
          style: {
            shape: 'ellipse',
            width: 42,
            height: 42,
            'background-color': '#fcfaf6',
            'border-color': '#9aa0a4',
            'border-width': 1.2,
            color: '#5c4a39',
            'font-size': 16,
            'font-weight': 700,
            'text-max-width': 34,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'none',
          },
        },
        {
          selector:
            'node[rdfBlankNode = 1], node[rdfConnectorNode = 1], node[rdfStructuralBlankNode = 1]',
          style: {
            shape: 'ellipse',
          },
        },
        {
          selector: 'node[rdfBlankNode = 1]',
          style: {
            label: '',
            width: 28,
            height: 28,
            'text-opacity': 0,
          },
        },
        {
          selector: 'edge',
          style: {
            label: 'data(predicateLabel)',
            'source-label': 'data(sourceCardinality)',
            color: '#5a524a',
            'font-size': DEFAULT_GRAPH_FONT_SIZE,
            'font-family': 'Avenir Next, Nunito Sans, Segoe UI, sans-serif',
            'text-wrap': 'wrap',
            'text-max-width': 110,
            'text-background-opacity': 1,
            'text-background-color': '#fffaf2',
            'text-background-padding': 2,
            'text-border-width': 0.5,
            'text-border-color': '#e2d8cb',
            'text-border-opacity': 1,
            'text-rotation': 'autorotate',
            'source-text-offset': 18,
            'source-text-margin-y': -12,
            'source-text-rotation': 'autorotate',
            width: 1.4,
            'line-color': '#c8bfb4',
            'target-arrow-color': '#c8bfb4',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            opacity: 0.76,
          },
        },
        {
          selector: 'edge[customCurve = 1]',
          style: {
            'curve-style': 'round-segments',
            'segment-weights': 'data(segmentWeights)',
            'segment-distances': 'data(segmentDistances)',
          },
        },
        {
          selector: 'edge[showSourceCardinality = 1]',
          style: {
            'source-text-background-opacity': 1,
            'source-text-background-color': '#fffaf2',
            'source-text-background-padding': 2,
            'source-text-border-width': 0.5,
            'source-text-border-color': '#e2d8cb',
            'source-text-border-opacity': 1,
            'source-font-size': DEFAULT_GRAPH_FONT_SIZE,
            'source-font-weight': 700,
            'source-color': '#6c5340',
          },
        },
        {
          selector: 'edge[axiomKind = "SubClassOf"]',
          style: {
            'target-arrow-shape': 'hollow-triangle',
            'target-arrow-fill': 'hollow',
            'arrow-scale': 1.3,
            width: 1.8,
          },
        },
        {
          selector: 'edge[category = "subproperty"], edge[axiomKind = "SubPropertyOf"]',
          style: {
            'target-arrow-shape': 'hollow-triangle',
            'target-arrow-fill': 'hollow',
            'arrow-scale': 1.3,
            width: 1.8,
          },
        },
        {
          selector: 'edge[category = "type"], edge[axiomKind = "ClassAssertion"]',
          style: {
            label: '',
            'target-arrow-shape': 'triangle-backcurve',
            'arrow-scale': 1.15,
          },
        },
        {
          selector: 'edge[category = "data"]',
          style: {
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge[owlEdgeStyle = "straight"]',
          style: {
            'line-style': 'solid',
          },
        },
        {
          selector: 'edge[owlEdgeStyle = "dashed"]',
          style: {
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge[owlEdgeStyle = "dotted"]',
          style: {
            'line-style': 'dotted',
          },
        },
        {
          selector: 'edge[edgeAnchorTether = 1]',
          style: {
            label: '',
            opacity: 0,
            width: 0.1,
            'target-arrow-shape': 'none',
            'events': 'no',
          },
        },
        {
          selector:
            'edge[category = "class-axiom"], edge[category = "individual-identity"], edge[category = "type"], edge[edgeStyle = "owl-rdf"], edge[owlRelationConnector = 1], edge[owlSynthesized = 1][owlEdgeStyle = "dotted"]',
          style: {
            width: 1.6,
          },
        },
        {
          selector: 'edge[owlSynthesized = 1][owlEdgeStyle = "dotted"]',
          style: {
            label: 'data(predicateLabel)',
            'source-label': 'data(sourceCardinality)',
          },
        },
        {
          selector: 'edge[owlSynthesized = 1][owlEdgeStyle = "straight"], edge[owlSynthesized = 1][owlEdgeStyle = "dashed"]',
          style: {
            width: 1.9,
            opacity: 0.9,
            'text-background-color': '#fbf4ec',
            'text-border-color': '#dfc7b2',
          },
        },
        {
          selector: 'edge[owlSynthesized = 1][owlEdgeStyle = "dashed"]',
          style: {
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge[isSelfLoop = 1]',
          style: {
            'curve-style': 'bezier',
            'source-endpoint': '180deg',
            'target-endpoint': '-90deg',
            'control-point-step-size': 'data(selfLoopStepSize)',
            'loop-direction': '-135deg',
            'loop-sweep': '34deg',
            'text-rotation': 'none',
            'text-margin-y': -12,
          },
        },
        {
          selector: 'edge[lightOntologyView = 1]',
          style: {
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge[edgeStyle = "dotted"]',
          style: {
            'line-style': 'dotted',
            'target-arrow-shape': 'none',
          },
        },
        {
          selector: 'edge[edgeStyle = "subclass"]',
          style: {
            'target-arrow-shape': 'triangle',
            'target-arrow-fill': 'hollow',
          },
        },
        {
          selector: 'edge[category = "object-property"], edge[category = "data-property"], edge[category = "restriction"]',
          style: {
            width: 1.8,
            'curve-style': 'straight',
          },
        },
        {
          selector: 'edge[paletteCategory = "base"]',
          style: {
            'line-color': '#bdb5aa',
            'target-arrow-color': '#bdb5aa',
            color: '#7a736b',
          },
        },
        {
          selector: 'edge[paletteCategory = "property"]',
          style: {
            'line-color': '#9f7a57',
            'target-arrow-color': '#9f7a57',
            color: '#684c32',
          },
        },
        {
          selector: '.faded',
          style: {
            opacity: 0.12,
          },
        },
        {
          selector: '.focus-node',
          style: {
            'border-width': 4,
            'border-color': '#4d8f78',
            'background-color': '#edf7f1',
            color: '#1e1b16',
          },
        },
        {
          selector: '.focus-neighbor',
          style: {
            'border-width': 3,
            'border-color': '#7eb49e',
          },
        },
        {
          selector: '.focus-edge',
          style: {
            width: 3,
            'line-color': '#4d8f78',
            'target-arrow-color': '#4d8f78',
            opacity: 1,
          },
        },
        {
          selector: '.selected-relation',
          style: {
            width: 3.2,
            'line-color': '#4d8f78',
            'target-arrow-color': '#4d8f78',
            'text-background-color': '#eef8f3',
            'text-border-color': '#b8d8c9',
            opacity: 1,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        fit: true,
        padding: 28,
      },
    });

    cy.on('tap', 'node', (event) => {
      if (event.target.data('edgeBendHandle') === 1) {
        return;
      }
      if (suppressNextTapRef.current) {
        suppressNextTapRef.current = false;
        return;
      }
      groupDragArmRef.current = null;
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
      setHoverTooltip(null);
      const nodeId = event.target.id();
      if (event.originalEvent instanceof MouseEvent && event.originalEvent.shiftKey) {
        extendFocusedNodes(nodeId);
        return;
      }
      setSingleFocusedNode(nodeId);
    });

    cy.on('tap', 'edge', (event) => {
      if (suppressNextTapRef.current) {
        suppressNextTapRef.current = false;
        return;
      }
      groupDragArmRef.current = null;
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
      setHoverTooltip(null);
      const edgeId = event.target.id();
      setSelectedNodeId(null);
      setFocusedNodeId(null);
      setFocusedNodeIds([]);
      setSelectedEdgeId(edgeId);
    });

    cy.on('tap', (event) => {
      if (suppressNextTapRef.current) {
        suppressNextTapRef.current = false;
        return;
      }
      groupDragArmRef.current = null;
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
      setHoverTooltip(null);
      if (event.target === cy) {
        clearFocusState();
      }
    });

    cy.on('mousedown', 'node', (event) => {
      if (event.target.data('edgeBendHandle') === 1) {
        return;
      }
      const originalEvent = event.originalEvent;
      if (!(originalEvent instanceof MouseEvent) || originalEvent.button !== 0) {
        return;
      }

      const activeFocusedNodeIds = focusedNodeIdsRef.current;
      const downNode = event.target;

      if (activeFocusedNodeIds.length === 0) {
        groupDragArmRef.current = null;
        return;
      }

      const focusRoots = collectFocusRoots(cy, activeFocusedNodeIds);
      if (focusRoots.empty()) {
        groupDragArmRef.current = null;
        return;
      }

      const groupNodes = focusRoots.closedNeighborhood().nodes();
      if (!groupNodes.has(downNode)) {
        groupDragArmRef.current = null;
        return;
      }

      if (originalEvent.ctrlKey) {
        originalEvent.preventDefault();
        groupDragArmRef.current = {
          nodeId: downNode.id(),
          focusedSignature: getFocusSignature(activeFocusedNodeIds),
        };
        return;
      }

      groupDragArmRef.current = null;
    });

    cy.on('dbltap', (event) => {
      if (event.target !== cy) {
        return;
      }
      if (event.originalEvent instanceof MouseEvent && event.originalEvent.button !== 0) {
        return;
      }
      groupDragArmRef.current = null;

      const activeFocusedNodeIds = focusedNodeIdsRef.current;
      if (activeFocusedNodeIds.length > 0) {
        shouldFitAfterFocusClearRef.current = true;
        clearFocusState();
        return;
      }

      fitCurrentGraphViewport(cy);
    });

    cy.on('grab', 'node', (event) => {
      if (event.target.data('edgeBendHandle') === 1) {
        return;
      }
      const activeFocusedNodeIds = focusedNodeIdsRef.current;
      const grabbedNode = event.target;
      if (activeFocusedNodeIds.length === 0) {
        groupDragStateRef.current = null;
        groupDragArmRef.current = null;
        return;
      }

      const focusRoots = collectFocusRoots(cy, activeFocusedNodeIds);
      if (focusRoots.empty()) {
        groupDragStateRef.current = null;
        groupDragArmRef.current = null;
        return;
      }

      const groupNodes = focusRoots.closedNeighborhood().nodes();
      if (!groupNodes.has(grabbedNode)) {
        groupDragStateRef.current = null;
        groupDragArmRef.current = null;
        return;
      }

      const arm = groupDragArmRef.current;
      const shouldUseGroupDrag =
        Boolean(arm) &&
        arm.nodeId === grabbedNode.id() &&
        arm.focusedSignature === getFocusSignature(activeFocusedNodeIds);
      if (!shouldUseGroupDrag) {
        groupDragStateRef.current = null;
        return;
      }
      groupDragArmRef.current = null;

      const followerIds = [];
      const followerStartPositions = new Map();
      groupNodes.forEach((node) => {
        if (node.id() === grabbedNode.id()) {
          return;
        }
        followerIds.push(node.id());
        followerStartPositions.set(node.id(), {
          x: node.position('x'),
          y: node.position('y'),
        });
      });

      groupDragStateRef.current = {
        grabbedNodeId: grabbedNode.id(),
        grabbedStartPosition: {
          x: grabbedNode.position('x'),
          y: grabbedNode.position('y'),
        },
        followerIds,
        followerStartPositions,
      };
    });

    cy.on('drag', 'node', (event) => {
      if (event.target.data('edgeBendHandle') === 1) {
        const ownerEdgeId = event.target.data('ownerEdgeId');
        if (ownerEdgeId) {
          const ownerEdge = cy.$id(ownerEdgeId);
          if (!ownerEdge.empty() && isEditableCurveEdge(ownerEdge)) {
            const override = computeCurveOverrideFromPoint(ownerEdge, event.target.position());
            if (override) {
              applyCurveOverrideToEdge(cy, ownerEdgeId, override);
              synchronizeEdgeAnchorPositions(cy);
            }
          }
        }
        return;
      }
      const dragState = groupDragStateRef.current;
      if (!dragState || event.target.id() !== dragState.grabbedNodeId) {
        synchronizeEdgeAnchorPositions(cy);
        synchronizeEdgeBendHandle(cy);
        return;
      }

      const draggedPosition = event.target.position();
      const dx = draggedPosition.x - dragState.grabbedStartPosition.x;
      const dy = draggedPosition.y - dragState.grabbedStartPosition.y;

      cy.batch(() => {
        for (const followerId of dragState.followerIds) {
          const follower = cy.$id(followerId);
          const startPosition = dragState.followerStartPositions.get(followerId);
          if (follower.empty() || !startPosition) {
            continue;
          }
          follower.position({
            x: startPosition.x + dx,
            y: startPosition.y + dy,
          });
        }
      });
      synchronizeEdgeAnchorPositions(cy);
      synchronizeEdgeBendHandle(cy);
    });

    cy.on('free', 'node', (event) => {
      if (event.target.data('edgeBendHandle') === 1) {
        synchronizeEdgeBendHandle(cy, event.target.data('ownerEdgeId'));
        return;
      }
      if (groupDragStateRef.current?.grabbedNodeId === event.target.id()) {
        groupDragStateRef.current = null;
      }

      synchronizeEdgeAnchorPositions(cy);
      synchronizeEdgeBendHandle(cy);
      const cache = layoutPositionCacheRef.current;
      const releasedNode = event.target;
      const syncNodePosition = (node) => {
        const position = {
          x: node.position('x'),
          y: node.position('y'),
        };
        cache.set(node.id(), position);
        canonicalLayoutEngineRef.current?.updateNodePosition(node.id(), position.x, position.y);
      };
      syncNodePosition(releasedNode);
      const dragState = groupDragStateRef.current;
      if (dragState?.followerIds?.length) {
        for (const followerId of dragState.followerIds) {
          const follower = cy.$id(followerId);
          if (!follower.empty()) {
            syncNodePosition(follower);
          }
        }
      }
    });

    const updateNodeHoverTooltips = (event) => {
      setMultiClassBadgeTooltip(buildClassBadgeTooltipPayload(event));
      setRestrictionNodeTooltip(buildRestrictionTooltipPayload(event));
      setHoverTooltip(buildHoverTooltipPayload(event));
    };

    cy.on('mouseover', 'node', updateNodeHoverTooltips);
    cy.on('mousemove', 'node', updateNodeHoverTooltips);
    cy.on('mouseover', 'edge', (event) => {
      setHoverTooltip(buildHoverTooltipPayload(event));
    });
    cy.on('mousemove', 'edge', (event) => {
      setHoverTooltip(buildHoverTooltipPayload(event));
    });
    cy.on('mouseout', 'node', () => {
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
      setHoverTooltip(null);
    });
    cy.on('mouseout', 'edge', () => {
      setHoverTooltip(null);
    });
    cy.on('pan zoom', () => {
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
      setHoverTooltip(null);
      const activeZoomInteraction = zoomInteractionRef.current;
      if (activeZoomInteraction) {
        activeZoomInteraction.lastZoom = cy.zoom();
        if (activeZoomInteraction.timeoutId !== null) {
          window.clearTimeout(activeZoomInteraction.timeoutId);
        }
        activeZoomInteraction.timeoutId = window.setTimeout(() => {
          activeZoomInteraction.span.end({
            context: {
              ...telemetryContextRef.current,
              fromZoom: activeZoomInteraction.fromZoom,
              toZoom: activeZoomInteraction.lastZoom,
              zoomDelta: Number((activeZoomInteraction.lastZoom - activeZoomInteraction.fromZoom).toFixed(4)),
            },
          });
          zoomInteractionRef.current = null;
        }, 80);
      }
    });

    const container = cy.container();
    const enterDetachedPanMode = (event) => {
      detachedPanModeRef.current = true;
      detachedPanLastMouseRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      setIsDetachedPanMode(true);
    };
    const exitDetachedPanMode = () => {
      detachedPanModeRef.current = false;
      detachedPanLastMouseRef.current = null;
      setIsDetachedPanMode(false);
    };

    const onMouseDownCapture = (event) => {
      const isLeftOrRightClick = event.button === 0 || event.button === 2;
      const bothPressed = (event.buttons & 1) !== 0 && (event.buttons & 2) !== 0;

      if (detachedPanModeRef.current) {
        if (isLeftOrRightClick) {
          suppressNextTapRef.current = event.button === 0;
          exitDetachedPanMode();
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (bothPressed) {
        enterDetachedPanMode(event);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onMouseMove = (event) => {
      if (!detachedPanModeRef.current) {
        return;
      }

      const lastMouse = detachedPanLastMouseRef.current;
      if (!lastMouse) {
        detachedPanLastMouseRef.current = { x: event.clientX, y: event.clientY };
        return;
      }

      const dx = event.clientX - lastMouse.x;
      const dy = event.clientY - lastMouse.y;
      detachedPanLastMouseRef.current = { x: event.clientX, y: event.clientY };
      if (dx !== 0 || dy !== 0) {
        cy.panBy({ x: dx, y: dy });
      }
      event.preventDefault();
    };

    const onMouseLeave = () => {
      if (detachedPanModeRef.current) {
        detachedPanLastMouseRef.current = null;
      }
    };

    const onContextMenu = (event) => {
      const bothPressed = (event.buttons & 1) !== 0 && (event.buttons & 2) !== 0;
      if (detachedPanModeRef.current || bothPressed || event.ctrlKey) {
        event.preventDefault();
      }
    };
    const onWheel = () => {
      if (zoomInteractionRef.current) {
        return;
      }
      zoomInteractionRef.current = {
        fromZoom: cy.zoom(),
        lastZoom: cy.zoom(),
        timeoutId: null,
        span: telemetry.startSpan('interaction.zoom.latency', telemetryContextRef.current),
      };
    };

    container.addEventListener('mousedown', onMouseDownCapture, true);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
    container.addEventListener('contextmenu', onContextMenu);
    container.addEventListener('wheel', onWheel, { passive: true });

    cyRef.current = cy;
    if (!initialGraphStyleJsonRef.current && typeof cy.style().json === 'function') {
      initialGraphStyleJsonRef.current = cy.style().json();
    }

    return () => {
      container.removeEventListener('mousedown', onMouseDownCapture, true);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('wheel', onWheel);
      groupDragStateRef.current = null;
      groupDragArmRef.current = null;
      shouldFitAfterFocusClearRef.current = false;
      layoutPositionCacheRef.current.clear();
      detachedPanModeRef.current = false;
      detachedPanLastMouseRef.current = null;
      suppressNextTapRef.current = false;
      if (zoomInteractionRef.current?.timeoutId !== null) {
        window.clearTimeout(zoomInteractionRef.current.timeoutId);
      }
      zoomInteractionRef.current?.span.fail(new Error('Zoom interaction cancelled'));
      zoomInteractionRef.current = null;
      cyRef.current = null;
      cy.destroy();
    };
  }, []);

  useEffect(() => {
    if (!isGraphSearchOpen) {
      setDebouncedGraphSearchQuery('');
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedGraphSearchQuery(graphSearchQuery);
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isGraphSearchOpen, graphSearchQuery]);

  useEffect(() => {
    if (!isGraphSearchOpen || !debouncedGraphSearchQuery.trim()) {
      graphSearchTelemetrySignatureRef.current = '';
      return;
    }

    const signature = `${debouncedGraphSearchQuery}|${graphSearchActiveIndex}|${graphSearchMatches.length}`;
    if (graphSearchTelemetrySignatureRef.current === signature) {
      return;
    }
    graphSearchTelemetrySignatureRef.current = signature;

    const perceivedLatencyMs =
      graphSearchInputAtRef.current > 0 ? Number((performance.now() - graphSearchInputAtRef.current).toFixed(3)) : 0;
    telemetry.recordEvent('search.latency', {
      searchKind: 'graph-search',
      queryLength: graphSearchMetricsRef.current.queryLength,
      matchCount: graphSearchMetricsRef.current.matchCount,
      computeDurationMs: graphSearchMetricsRef.current.durationMs,
      perceivedLatencyMs,
      latencyMs: perceivedLatencyMs,
      ...buildTelemetryContext(),
    });
  }, [isGraphSearchOpen, debouncedGraphSearchQuery, graphSearchMatches, graphSearchActiveIndex]);

  useEffect(() => {
    if (!isGraphSearchOpen) {
      return;
    }

    graphSearchInputRef.current?.focus();
    graphSearchInputRef.current?.select();
  }, [isGraphSearchOpen]);

  useEffect(() => {
    if (!isGraphSearchOpen) {
      return;
    }

    if (!debouncedGraphSearchQuery.trim()) {
      restoreGraphSearchSessionFocus(graphSearchSessionRef.current);
      return;
    }

    if (graphSearchMatches.length === 0) {
      setSelectedEdgeId(null);
      setSelectedNodeId(null);
      setFocusedNodeId(null);
      setFocusedNodeIds([]);
      return;
    }

    const safeIndex = Math.min(graphSearchActiveIndex, graphSearchMatches.length - 1);
    if (safeIndex !== graphSearchActiveIndex) {
      setGraphSearchActiveIndex(safeIndex);
      return;
    }

    const nextNodeId = graphSearchMatches[safeIndex]?.id ?? null;
    if (nextNodeId) {
      setSingleFocusedNode(nextNodeId);
    }
  }, [isGraphSearchOpen, debouncedGraphSearchQuery, graphSearchMatches, graphSearchActiveIndex]);

  useEffect(() => {
    if (!isGraphSearchOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      if (isFindShortcut) {
        event.preventDefault();
        openGraphSearch();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeGraphSearch();
        return;
      }

      if (event.key !== 'Enter') {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.graph-search-panel')) {
        return;
      }

      event.preventDefault();
      moveGraphSearchMatch(event.shiftKey ? -1 : 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGraphSearchOpen, graphSearchMatches.length]);

  useEffect(() => {
    if (isGraphSearchOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      if (!isFindShortcut) {
        return;
      }

      event.preventDefault();
      openGraphSearch();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGraphSearchOpen, selectedNodeId, selectedEdgeId, focusedNodeId, focusedNodeIds]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest('.header-settings-menu')) {
        setIsSettingsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const clampedZoomSpeed = Math.min(MAX_GRAPH_ZOOM_SPEED, Math.max(MIN_GRAPH_ZOOM_SPEED, graphZoomSpeed));
    const clampedFontSize = Math.min(MAX_GRAPH_FONT_SIZE, Math.max(MIN_GRAPH_FONT_SIZE, graphFontSize));
    const isHighContrast = graphThemeMode === GRAPH_THEME_MODES.HIGH_CONTRAST;

    if (cy._private?.options) {
      cy._private.options.wheelSensitivity = clampedZoomSpeed;
    }
    const renderer = typeof cy.renderer === 'function' ? cy.renderer() : null;
    if (renderer && typeof renderer === 'object') {
      renderer.wheelSensitivity = clampedZoomSpeed;
    }

    const styleBuilder = cy.style();

    if (isHighContrast) {
      styleBuilder
        .selector('node')
        .style({
          'background-color': '#ffffff',
          color: '#000000',
          'border-color': '#000000',
          'border-width': 1.4,
          'border-style': 'solid',
        })
        .selector('node[hasClass > 0][entityCategory != "class-expression"]')
        .style({
          'background-image': 'none',
          'background-image-opacity': 0,
          'background-width': 0,
          'background-height': 0,
          'background-offset-x': 0,
          'background-offset-y': 0,
          'bounds-expansion': 8,
        })
        .selector('node[entityCategory = "annotation-property"]')
        .style({
          'border-style': 'dashed',
        })
        .selector('node[entityCategory = "class-expression"]')
        .style({
          'background-color': '#ffffff',
          color: '#000000',
          'border-color': '#000000',
          'border-width': 1.8,
        })
        .selector('node[mixedMode = 1][isOntologyNode = 1]')
        .style({
          'background-color': '#ffffff',
          'border-color': '#000000',
          color: '#000000',
        })
        .selector('node[kind = "blank"]')
        .style({
          'background-color': '#ffffff',
          'border-color': '#000000',
          color: '#000000',
        })
        .selector('node[reifiedStatement = 1]')
        .style({
          'background-color': '#ffffff',
          'border-color': '#000000',
          color: '#ffffff',
        })
        .selector('edge')
        .style({
          color: '#000000',
          'text-background-color': '#ffffff',
          'text-border-color': '#000000',
          'text-border-width': 0.8,
          'line-color': '#000000',
          'target-arrow-color': '#000000',
          width: 1.6,
          opacity: 0.96,
        })
        .selector('edge[category = "reification"]')
        .style({
          'line-color': '#000000',
          'target-arrow-color': '#000000',
          color: '#000000',
        })
        .selector('edge[reifiedOnly = 1]')
        .style({
          'line-style': 'dashed',
          opacity: 0.9,
        })
        .selector('edge[lightOntologyView = 1]')
        .style({
          'line-color': '#000000',
          'target-arrow-color': '#000000',
          color: '#000000',
        })
        .selector('edge[lightOntologyView = 1][lightRestrictionEdge = 1]')
        .style({
          'line-color': '#000000',
          'target-arrow-color': '#000000',
          color: '#000000',
          'text-background-color': '#ffffff',
          'text-border-color': '#000000',
        })
        .selector('.focus-node')
        .style({
          'border-color': '#000000',
          'background-color': '#ffffff',
          color: '#000000',
        })
        .selector('.focus-neighbor')
        .style({
          'border-color': '#000000',
        })
        .selector('.focus-edge')
        .style({
          'line-color': '#000000',
          'target-arrow-color': '#000000',
        })
        .selector('.selected-relation')
        .style({
          'line-color': '#000000',
          'target-arrow-color': '#000000',
          'text-background-color': '#ffffff',
          'text-border-color': '#000000',
        })
        .selector('.faded')
        .style({
          opacity: 0.16,
        });
    } else {
      if (initialGraphStyleJsonRef.current && typeof styleBuilder.fromJson === 'function') {
        styleBuilder.fromJson(initialGraphStyleJsonRef.current);
      }
    }

    styleBuilder
      .selector('node')
      .style('font-size', clampedFontSize)
      .selector('edge')
      .style('font-size', clampedFontSize)
      .selector('edge[owlSynthesized = 1][owlEdgeStyle = "dotted"]')
      .style({
        label: showDottedEdgeLabels ? 'data(predicateLabel)' : '',
        'source-label': showDottedEdgeLabels ? 'data(sourceCardinality)' : '',
      })
      .selector('edge[showSourceCardinality = 1]')
      .style('source-font-size', clampedFontSize)
      .update();
  }, [graphZoomSpeed, graphFontSize, graphThemeMode, graphProjectionMode, showDottedEdgeLabels]);

  useEffect(() => {
    focusedNodeIdRef.current = focusedNodeId;
    focusedNodeIdsRef.current = focusedNodeIds;
    if (focusedNodeIds.length === 0) {
      groupDragStateRef.current = null;
      groupDragArmRef.current = null;
      return;
    }
    if (groupDragArmRef.current?.focusedSignature !== getFocusSignature(focusedNodeIds)) {
      groupDragArmRef.current = null;
    }
  }, [focusedNodeId, focusedNodeIds]);

  useEffect(() => {
    hasAppliedInitialLayoutRef.current = false;
    firstVisualizationRecordedRef.current = false;
    layoutPositionCacheRef.current.clear();
    projectedElementsCacheRef.current.clear();
    canonicalLayoutEngineRef.current = null;
    setLayoutRevision((current) => current + 1);
    setIsLayouting(false);
    layoutSpanRef.current = null;
    settleSpanRef.current = null;

    if (!graphData) {
      return undefined;
    }

    const LayoutEngine = CANONICAL_LAYOUT_BACKEND === 'ngraph' ? NgraphIncrementalLayout : IncrementalGraphLayout;
    const engine = new LayoutEngine({
      nodes: graphData.nodes,
      edges: graphData.edges,
    });
    canonicalLayoutEngineRef.current = engine;
    setIsLayouting(true);
    layoutSpanRef.current = telemetry.startSpan('layout.compute.total', buildTelemetryContext([], {
      datasetTripletCount: graphData.store?.size ?? 0,
      layoutBackend: CANONICAL_LAYOUT_BACKEND,
    }));
    settleSpanRef.current = telemetry.startSpan('view.settle.total', buildTelemetryContext([], {
      datasetTripletCount: graphData.store?.size ?? 0,
      layoutBackend: CANONICAL_LAYOUT_BACKEND,
    }));

    let cancelled = false;
    let timeoutId = null;

    const scheduleNextStep = () => {
      timeoutId = window.setTimeout(runStep, 0);
    };

    const runStep = () => {
      if (cancelled || canonicalLayoutEngineRef.current !== engine) {
        return;
      }

      const start = performance.now();
      let steps = 0;
      let changed = false;

      while (!engine.isComplete() && steps < 2 && performance.now() - start < 12) {
        const result = engine.computeNextBatch();
        changed = changed || result.changed;
        steps += 1;
      }

      if (changed || steps > 0) {
        setLayoutRevision((current) => current + 1);
      }

      if (engine.isComplete()) {
        setIsLayouting(false);
        const layoutSpan = layoutSpanRef.current;
        layoutSpanRef.current = null;
        layoutSpan?.end(buildTelemetryContext(visibleElements, {
          layoutBackend: CANONICAL_LAYOUT_BACKEND,
        }));
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (cancelled) {
              return;
            }
            const settleSpan = settleSpanRef.current;
            settleSpanRef.current = null;
            settleSpan?.end(buildTelemetryContext(visibleElements, {
              layoutBackend: CANONICAL_LAYOUT_BACKEND,
            }));
            void telemetry.captureMemory({
              phase: 'post-layout-settle',
              ...buildTelemetryContext(visibleElements, {
                layoutBackend: CANONICAL_LAYOUT_BACKEND,
              }),
            });
          });
        });
        return;
      }

      scheduleNextStep();
    };

    runStep();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      layoutSpanRef.current?.fail(new Error('Layout cancelled'));
      settleSpanRef.current?.fail(new Error('Settle cancelled'));
      layoutSpanRef.current = null;
      settleSpanRef.current = null;
    };
  }, [graphData]);

  useEffect(() => {
    hasAppliedInitialLayoutRef.current = false;
    layoutPositionCacheRef.current.clear();
  }, [graphProjectionMode]);

  useEffect(() => {
    groupDragStateRef.current = null;
    groupDragArmRef.current = null;
    setMultiClassBadgeTooltip(null);
    setRestrictionNodeTooltip(null);
    setIsExportMenuOpen(false);
  }, [visibleElements]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest('.graph-export-menu')) {
        setIsExportMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return undefined;
    }

    const positionCache = layoutPositionCacheRef.current;
    cy.stop(true, true);
    cy.batch(() => {
      cy.elements().remove();
      if (visibleElements.length > 0) {
        cy.add(visibleElements);
      }
    });
    cy.style().update();

    if (visibleElements.length === 0) {
      positionCache.clear();
      hasAppliedInitialLayoutRef.current = false;
      return undefined;
    }

    const cacheCurrentPositions = () => {
      positionCache.clear();
      cy.nodes().not('[edgeAnchor = 1]').forEach((node) => {
        positionCache.set(node.id(), {
          x: node.position('x'),
          y: node.position('y'),
        });
      });
    };

    const fitGraph = (duration = 0) => {
      if (cy.destroyed() || cy.elements().empty()) {
        return;
      }
      cy.resize();
      if (duration > 0) {
        fitCurrentGraphViewport(cy, duration);
      } else {
        cy.fit(cy.nodes(), 42);
      }
    };

    const timeoutIds = [
      setTimeout(() => {
        if (cy.destroyed()) {
          return;
        }
        synchronizeEdgeAnchorPositions(cy);
        synchronizeEdgeBendHandle(cy);
        if (!hasAppliedInitialLayoutRef.current) {
          fitGraph(0);
        }
        cacheCurrentPositions();
        hasAppliedInitialLayoutRef.current = true;
        const renderSpan = pendingRenderSpanRef.current;
        pendingRenderSpanRef.current = null;
        renderSpan?.end(buildTelemetryContext(visibleElements));
        const firstViewSpan = pendingFirstViewSpanRef.current;
        pendingFirstViewSpanRef.current = null;
        firstViewSpan?.end(buildTelemetryContext(visibleElements));
        if (firstViewSpan) {
          firstVisualizationRecordedRef.current = true;
        }
      }, 0),
      setTimeout(() => {
        if (cy.destroyed()) {
          return;
        }
        synchronizeEdgeAnchorPositions(cy);
        synchronizeEdgeBendHandle(cy);
        cacheCurrentPositions();
      }, 80),
    ];

    return () => {
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [visibleElements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    if (visibleElements.length === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      if (!cy.destroyed()) {
        cy.resize();
        cy.fit(
          cy
            .nodes()
            .not('[edgeAnchor = 1]')
            .not('[edgeBendHandle = 1]'),
          42,
        );
        synchronizeEdgeBendHandle(cy);
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth, isGraphFullscreen, visibleElements.length]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const wasFocused = previousFocusedNodeIdsRef.current.length > 0;

    if (focusedNodeIds.length > 0 && !wasFocused) {
      const pan = cy.pan();
      preFocusViewportRef.current = {
        zoom: cy.zoom(),
        pan: { x: pan.x, y: pan.y },
      };
    }

    cy.batch(() => {
      cy.elements().removeClass('faded focus-node focus-neighbor focus-edge');

      if (focusedNodeIds.length === 0) {
        return;
      }

      const focusRoots = collectFocusRoots(cy, focusedNodeIds);
      if (focusRoots.empty()) {
        return;
      }

      const neighborhood = focusRoots.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass('faded');
      focusRoots.addClass('focus-node');
      neighborhood.nodes().difference(focusRoots).addClass('focus-neighbor');
      focusRoots.connectedEdges().addClass('focus-edge');
    });

    if (focusedNodeIds.length > 0) {
      const focusRoots = collectFocusRoots(cy, focusedNodeIds);
      if (!focusRoots.empty()) {
        cy.animate({
          fit: {
            eles: focusRoots.closedNeighborhood(),
            padding: 76,
          },
          duration: 250,
        });
      }
    } else if (wasFocused) {
      if (shouldFitAfterFocusClearRef.current) {
        shouldFitAfterFocusClearRef.current = false;
        fitCurrentGraphViewport(cy, 220);
        preFocusViewportRef.current = null;
        previousFocusedNodeIdRef.current = focusedNodeId;
        previousFocusedNodeIdsRef.current = focusedNodeIds;
        return;
      }

      const savedViewport = preFocusViewportRef.current;
      if (
        savedViewport &&
        Number.isFinite(savedViewport.zoom) &&
        Number.isFinite(savedViewport.pan?.x) &&
        Number.isFinite(savedViewport.pan?.y)
      ) {
        cy.animate({
          zoom: savedViewport.zoom,
          pan: savedViewport.pan,
          duration: 220,
        });
      } else {
        const visibleNodes = cy.nodes();
        if (visibleNodes.length > 0) {
          cy.animate({
            fit: {
              eles: cy.elements(),
              padding: 42,
            },
            duration: 250,
          });
        }
      }
      preFocusViewportRef.current = null;
    }

    previousFocusedNodeIdRef.current = focusedNodeId;
    previousFocusedNodeIdsRef.current = focusedNodeIds;
  }, [focusedNodeId, focusedNodeIds, visibleElements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.edges().removeClass('selected-relation');
    if (!selectedEdgeId) {
      synchronizeEdgeBendHandle(cy, null);
      return;
    }

    const edge = cy.$id(selectedEdgeId);
    if (!edge.empty()) {
      edge.addClass('selected-relation');
    }
    synchronizeEdgeBendHandle(cy, selectedEdgeId);
  }, [selectedEdgeId, visibleElements]);

  useEffect(() => {
    edgeCurveOverridesRef.current = new Map();
  }, [graphData]);

  useEffect(() => {
    if (!graphData) {
      setVisibleElements([]);
      return;
    }

    let cancelled = false;

    const applyFilters = async () => {
      setIsFiltering(true);
      setFilterError('');
      const graphDataKey = `${graphData?.store?.size ?? 0}:${graphData?.nodes?.length ?? 0}:${graphData?.edges?.length ?? 0}`;
      const filterSelectionSignature = buildFilterSelectionSignature();
      const previousFilterRun = previousFilterRunRef.current;
      let filterTrigger = 'filter-change';
      if (!previousFilterRun || previousFilterRun.graphDataKey !== graphDataKey) {
        filterTrigger = 'dataset-load';
      } else if (
        previousFilterRun.filterSelectionSignature === filterSelectionSignature &&
        previousFilterRun.layoutRevision !== layoutRevision
      ) {
        filterTrigger = 'layout-sync';
      } else if (
        previousFilterRun.graphProjectionMode !== graphProjectionMode ||
        previousFilterRun.owlProjectionLevel !== owlProjectionLevel ||
        previousFilterRun.rdfProjectionLevel !== rdfProjectionLevel
      ) {
        filterTrigger = 'projection-change';
      }
      previousFilterRunRef.current = {
        graphDataKey,
        filterSelectionSignature,
        layoutRevision,
        graphProjectionMode,
        owlProjectionLevel,
        rdfProjectionLevel,
      };
      const projectionChangeSpan =
        filterTrigger === 'projection-change'
          ? telemetry.startSpan('projection.change.total', buildTelemetryContext([], {
            filterTrigger,
          }))
          : null;
      const filterSpan = telemetry.startSpan('filter.apply.total', buildTelemetryContext([], {
        filterTrigger,
        hasClassFilter: selectedClassIris.length > 0,
        hasBaseIriFilter: selectedBaseIris.length > 0,
        hasGraphAxisFilter: graphFilterAxis !== GRAPH_FILTER_AXES.ALL,
        hasNodeNameFilter: nodeNameQuery.trim().length > 0,
        hasSparqlFilter: sparqlQuery.trim().length > 0,
      }));

      try {
        const currentProjectionLevel =
          graphProjectionMode === GRAPH_PROJECTION_MODES.RDF ? rdfProjectionLevel : owlProjectionLevel;
        const viewOptions = toViewOptions(graphProjectionMode, graphData, owlProjectionLevel, rdfProjectionLevel);
        const currentProjectionCacheKey = buildProjectionCacheKey(graphProjectionMode, currentProjectionLevel);
        const projectElements = (focusedNodeIds = null) => {
          const projectionSpan = telemetry.startSpan('view.projection.build', buildTelemetryContext([], {
            focusedNodeCount: Array.isArray(focusedNodeIds) ? focusedNodeIds.length : 0,
          }));
          let rawProjected;
          if (!focusedNodeIds) {
            const cachedProjected = projectedElementsCacheRef.current.get(currentProjectionCacheKey);
            if (cachedProjected) {
              rawProjected = cachedProjected;
            }
          }

          if (!rawProjected) {
            rawProjected = buildProjectedElements(graphData, focusedNodeIds, viewOptions);
            if (
              graphProjectionMode === GRAPH_PROJECTION_MODES.RDF &&
              rawProjected.length === 0 &&
              graphData.nodes.length > 0
            ) {
              rawProjected = buildProjectedElements(graphData, null, viewOptions);
            }
            if (!focusedNodeIds) {
              projectedElementsCacheRef.current.set(currentProjectionCacheKey, rawProjected);
            }
          }

          const projected = getPositionedProjectionElements(rawProjected);
          const filteredProjection = filterProjectedElementsByGraphAxis(projected, graphFilterAxis);
          projectionSpan.end(buildTelemetryContext(filteredProjection, {
            focusedNodeCount: Array.isArray(focusedNodeIds) ? focusedNodeIds.length : 0,
          }));
          return filteredProjection;
        };
        const classFilterActive =
          showClassTypeFilter &&
          graphData.classes.length > 0 &&
          selectedClassIris.length !== graphData.classes.length;
        const baseIriFilterActive =
          graphData.baseIris.length > 0 && selectedBaseIris.length !== graphData.baseIris.length;
        const graphAxisActive = graphFilterAxis !== GRAPH_FILTER_AXES.ALL;
        const nodeNameFilterActive = nodeNameQuery.trim().length > 0;
        const sparqlActive = sparqlQuery.trim().length > 0;

        if (!classFilterActive && !baseIriFilterActive && !graphAxisActive && !nodeNameFilterActive && !sparqlActive) {
          if (!cancelled) {
            const nextVisibleElements = applyEdgeCurveOverrides(
              projectElements(null),
              edgeCurveOverridesRef.current,
            );
            pendingRenderSpanRef.current = telemetry.startSpan('view.render.apply', buildTelemetryContext(nextVisibleElements));
            if (!pendingFirstViewSpanRef.current && !firstVisualizationRecordedRef.current) {
              pendingFirstViewSpanRef.current = telemetry.startSpan('view.first_render.total', buildTelemetryContext(nextVisibleElements));
            }
            setVisibleElements(nextVisibleElements);
            const successContext = buildTelemetryContext(nextVisibleElements, {
              resultEntityCount: 0,
            });
            filterSpan.end({
              context: successContext,
            });
            projectionChangeSpan?.end({
              context: successContext,
            });
          }
          return;
        }

        const engine = queryEngineRef.current;
        let selectedEntities = null;

        if (baseIriFilterActive) {
          const baseFilterSpan = telemetry.startSpan('filter.baseIri', buildTelemetryContext());
          selectedEntities = runBaseIriFilter(graphData, selectedBaseIris);
          baseFilterSpan.end({
            context: {
              resultEntityCount: selectedEntities.size,
            },
          });
        }

        if (graphAxisActive) {
          const axisFilterSpan = telemetry.startSpan('filter.graphAxis', buildTelemetryContext());
          const axisMatches = runGraphAxisFilter(graphData, graphFilterAxis);
          axisFilterSpan.end({
            context: {
              resultEntityCount: axisMatches.size,
            },
          });
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, axisMatches) : axisMatches;
        }

        if (classFilterActive) {
          const classFilterSpan = telemetry.startSpan('filter.class', buildTelemetryContext());
          const classMatches = expandClassFilterMatches(
            graphData,
            runClassFilter(graphData, selectedClassIris),
          );
          classFilterSpan.end({
            context: {
              resultEntityCount: classMatches.size,
            },
          });
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, classMatches) : classMatches;
        }

        if (nodeNameFilterActive) {
          const nodeNameFilterSpan = telemetry.startSpan('filter.nodeName', buildTelemetryContext());
          const nameMatches = runNodeNameFilter(graphData, nodeNameQuery);
          nodeNameFilterSpan.end({
            context: {
              resultEntityCount: nameMatches.size,
            },
          });
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, nameMatches) : nameMatches;
        }

        if (sparqlActive) {
          const sparqlFilterSpan = telemetry.startSpan('filter.sparql.total', buildTelemetryContext([], {
            queryLength: sparqlQuery.trim().length,
          }));
          const sparqlResult = await runSparqlFilter(engine, graphData.store, sparqlQuery);
          sparqlFilterSpan.end({
            context: {
              resultEntityCount: sparqlResult.size,
              queryLength: sparqlQuery.trim().length,
            },
          });
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, sparqlResult) : sparqlResult;
        }

        if (!cancelled) {
          const nextVisibleElements = applyEdgeCurveOverrides(
            projectElements(selectedEntities),
            edgeCurveOverridesRef.current,
          );
          pendingRenderSpanRef.current = telemetry.startSpan('view.render.apply', buildTelemetryContext(nextVisibleElements));
          if (!pendingFirstViewSpanRef.current && !hasAppliedInitialLayoutRef.current) {
            pendingFirstViewSpanRef.current = telemetry.startSpan('view.first_render.total', buildTelemetryContext(nextVisibleElements));
          }
          setVisibleElements(nextVisibleElements);
          const successContext = buildTelemetryContext(nextVisibleElements, {
            resultEntityCount: selectedEntities?.size ?? 0,
          });
          filterSpan.end({
            context: successContext,
          });
          projectionChangeSpan?.end({
            context: successContext,
          });
        }
      } catch (error) {
        if (!cancelled) {
          const failureContext = buildTelemetryContext();
          filterSpan.fail(error, {
            context: failureContext,
          });
          projectionChangeSpan?.fail(error, {
            context: failureContext,
          });
          setFilterError(error.message || 'SPARQL filter failed.');
          setVisibleElements(
            applyEdgeCurveOverrides(
              getPositionedProjectionElements(
                buildProjectedElements(
                  graphData,
                  null,
                  toViewOptions(graphProjectionMode, graphData, owlProjectionLevel, rdfProjectionLevel),
                ),
              ),
              edgeCurveOverridesRef.current,
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsFiltering(false);
        }
      }
    };

    applyFilters();

    return () => {
      cancelled = true;
    };
  }, [
    graphData,
    layoutRevision,
    selectedClassIris,
    selectedBaseIris,
    graphFilterAxis,
    nodeNameQuery,
    sparqlQuery,
    graphProjectionMode,
    owlProjectionLevel,
    rdfProjectionLevel,
    showClassTypeFilter,
  ]);

  useEffect(() => {
    const visibleNodeIds = new Set(
      visibleElements.filter((entry) => !entry.data.source).map((entry) => entry.data.id),
    );

    if (focusedNodeIdsRef.current.length > 0) {
      const nextFocusedNodeIds = focusedNodeIdsRef.current.filter((nodeId) => visibleNodeIds.has(nodeId));
      if (nextFocusedNodeIds.length !== focusedNodeIdsRef.current.length) {
        setFocusedNodeIds(nextFocusedNodeIds);
        setFocusedNodeId(nextFocusedNodeIds.length > 0 ? nextFocusedNodeIds[nextFocusedNodeIds.length - 1] : null);
      }
    }

    if (!selectedNodeId) {
      if (!selectedEdgeId) {
        return;
      }
      const hasSelectedEdge = visibleElements.some((entry) => entry.data.source && entry.data.id === selectedEdgeId);
      if (!hasSelectedEdge) {
        setSelectedEdgeId(null);
      }
      return;
    }

    const hasSelectedNode = visibleElements.some((entry) => !entry.data.source && entry.data.id === selectedNodeId);
    if (!hasSelectedNode) {
      setSelectedNodeId(null);
      setFocusedNodeId(null);
      setFocusedNodeIds([]);
    }
  }, [visibleElements, selectedNodeId, selectedEdgeId]);

  async function clearLoadedGraph() {
    let nextStatus = DEFAULT_STATUS;
    try {
      const result = await persistAndRotateTelemetrySession({
        reason: 'clear',
        context: buildTelemetryContext(),
      });
      if (!result?.skipped && result?.logPath && result?.statsPath) {
        nextStatus = `Telemetry saved to ${result.logPath} and ${result.statsPath}.`;
      }
    } catch (error) {
      nextStatus = `Telemetry persistence failed: ${error.message || 'Unexpected error.'}`;
    }

    edgeCurveOverridesRef.current = new Map();
    previousFilterRunRef.current = null;
    firstVisualizationRecordedRef.current = false;
    setUploadedFiles([]);
    setGraphData(null);
    setVisibleElements([]);
    setSelectedClassIris([]);
    setSelectedBaseIris([]);
    setNodeNameQuery('');
    setSparqlDraft('');
    setSparqlQuery('');
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setFocusedNodeId(null);
    setFocusedNodeIds([]);
    setIsExportMenuOpen(false);
    setOntologyMetadataRows([]);
    setLoadError('');
    setFilterError('');
    setStatus(nextStatus);
    setOwlProjectionLevel(OWL_PROJECTION_LEVELS.ONTOLOGY);
  }

  function handleFileSelection(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    if (uploadedFiles.length === 0) {
      setGraphProjectionMode(GRAPH_PROJECTION_MODES.OWL);
      setOwlProjectionLevel(OWL_PROJECTION_LEVELS.ONTOLOGY);
    }

    setUploadedFiles((current) => mergeSelectedFiles(current, files));
  }

  useEffect(() => {
    if (uploadedFiles.length === 0) {
      setGraphData(null);
      setVisibleElements([]);
      setSelectedClassIris([]);
      setSelectedBaseIris([]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setFocusedNodeId(null);
      setFocusedNodeIds([]);
      setOntologyMetadataRows([]);
      setLoadError('');
      setFilterError('');
      setIsLoading(false);
      setStatus(DEFAULT_STATUS);
      return;
    }

    let cancelled = false;

    const loadGraph = async () => {
      setIsLoading(true);
      setLoadError('');
      setFilterError('');
      setOntologyMetadataRows([]);
      const loadSpan = telemetry.startSpan('dataset.load.total', {
        uploadedFileCount: uploadedFiles.length,
        fileSizes: uploadedFiles.map((file) => file.size),
      });

      try {
        const readSpan = telemetry.startSpan('dataset.read_and_parse', {
          uploadedFileCount: uploadedFiles.length,
        });
        const parsedFiles = await Promise.all(
          uploadedFiles.map(async (file) => {
            const text = await file.text();
            const quads = await parseRdfText(text, file.name);
            const { headerQuads, contentQuads } = partitionOntologyHeaderQuads(quads);
            return { fileName: file.name, headerQuads, contentQuads };
          }),
        );
        readSpan.end();

        if (cancelled) {
          return;
        }

        const mergedQuads = [];
        const metadataRows = [];

        for (const parsed of parsedFiles) {
          mergedQuads.push(...parsed.contentQuads);

          parsed.headerQuads.forEach((quad, index) => {
            metadataRows.push({
              id: `${parsed.fileName}-${index}-${getTermId(quad.subject)}-${getTermId(quad.object)}`,
              fileName: parsed.fileName,
              subject: formatTermForInspector(quad.subject),
              predicate: formatTermForInspector(quad.predicate),
              value: formatTermForInspector(quad.object),
            });
          });
        }

        const modelSpan = telemetry.startSpan('dataset.model.extract', {
          datasetTripletCount: mergedQuads.length,
        });
        const ontologyModel = extractOntologyModel(mergedQuads);
        modelSpan.end();
        const graphBuildSpan = telemetry.startSpan('dataset.graph.build', {
          datasetTripletCount: mergedQuads.length,
        });
        const nextGraphData = buildGraphData(mergedQuads, {
          // Stop classifying uploads as "ontology" vs "KG".
          // We always render uploaded data through the ontology-style path,
          // while still extracting declarations from the triples themselves.
          hasKg: false,
          hasOntology: true,
          ontologyModel,
        });
        graphBuildSpan.end({
          context: {
            datasetTripletCount: mergedQuads.length,
            nodeCount: nextGraphData.nodes.length,
            edgeCount: nextGraphData.edges.length,
          },
        });
        const derivedPrefixRows = nextGraphData.baseIris.map((entry, index) => {
          const prefix = getPrefixFromBaseIri(entry.id);
          return {
            id: `derived-prefix-${index}-${entry.id}`,
            fileName: 'Derived prefixes',
            subject: 'dataset',
            predicate: 'prefix',
            value: `${prefix}: <${entry.id}>`,
          };
        });

        if (cancelled) {
          return;
        }

        setGraphData(nextGraphData);
        setSelectedClassIris(nextGraphData.classes.map((entry) => entry.id));
        setSelectedBaseIris(nextGraphData.baseIris.map((entry) => entry.id));
        setGraphFilterAxis(GRAPH_FILTER_AXES.ALL);
        setNodeNameQuery('');
        setSparqlDraft('');
        setSparqlQuery('');
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setFocusedNodeId(null);
        setFocusedNodeIds([]);
        setGraphProjectionMode(GRAPH_PROJECTION_MODES.OWL);
        setOwlProjectionLevel(OWL_PROJECTION_LEVELS.ONTOLOGY);
        setOntologyMetadataRows([...metadataRows, ...derivedPrefixRows]);

        setStatus(
          `Loaded ${nextGraphData.nodes.length} nodes and ${nextGraphData.edges.length} edges from ${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'}`,
        );
        loadSpan.end({
          context: {
            datasetTripletCount: mergedQuads.length,
            nodeCount: nextGraphData.nodes.length,
            edgeCount: nextGraphData.edges.length,
          },
        });
        void telemetry.captureMemory({
          phase: 'post-dataset-load',
          datasetTripletCount: mergedQuads.length,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        loadSpan.fail(error, {
          context: {
            uploadedFileCount: uploadedFiles.length,
          },
        });
        setLoadError(error.message || 'Unable to parse one of the uploaded files.');
        setOntologyMetadataRows([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, [uploadedFiles]);

  function toggleClass(classIri) {
    setSelectedClassIris((current) => {
      if (current.includes(classIri)) {
        return current.filter((entry) => entry !== classIri);
      }
      return [...current, classIri];
    });
  }

  function selectAllClasses() {
    setSelectedClassIris(allClassIris);
  }

  function clearClassSelection() {
    setSelectedClassIris([]);
  }

  function toggleBaseIri(baseIri) {
    setSelectedBaseIris((current) => {
      if (current.includes(baseIri)) {
        return current.filter((entry) => entry !== baseIri);
      }
      return [...current, baseIri];
    });
  }

  function selectAllBaseIris() {
    setSelectedBaseIris(allBaseIris);
  }

  function clearBaseIris() {
    setSelectedBaseIris([]);
  }

  function updateSparqlPrefixName(rowId, prefix) {
    setSparqlPrefixes((current) =>
      current.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        return {
          ...row,
          prefix,
        };
      }),
    );
  }

  function updateSparqlPrefixIri(rowId, iri) {
    setSparqlPrefixes((current) =>
      current.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        return {
          ...row,
          iri,
        };
      }),
    );
  }

  function addSparqlPrefixRow() {
    setSparqlPrefixes((current) => {
      const usedPrefixes = new Set(
        [...FIXED_SPARQL_PREFIXES, ...current]
          .map((row) => normalizePrefixName(row.prefix))
          .filter(Boolean),
      );

      let counter = 1;
      let prefix = `ns${counter}`;
      while (usedPrefixes.has(prefix)) {
        counter += 1;
        prefix = `ns${counter}`;
      }

      return [
        ...current,
        {
          id: `prefix-custom-${Date.now()}-${current.length + 1}`,
          prefix,
          iri: '',
        },
      ];
    });
  }

  function removeSparqlPrefixRow(rowId) {
    setSparqlPrefixes((current) => current.filter((row) => row.id !== rowId));
  }

  function applySparqlFilter() {
    setSparqlQuery(buildExecutableSparqlQuery(sparqlDraft, sparqlPrefixes, FIXED_SPARQL_PREFIXES));
  }

  function clearSparqlFilter() {
    setSparqlDraft('');
    setSparqlQuery('');
  }

  function toggleLeftSection(sectionKey) {
    setLeftSectionOpen((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  function toggleSparqlPrefixSection(sectionKey) {
    setSparqlPrefixSectionOpen((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  function startPanelResize(side, event) {
    if (event.button !== 0 || isGraphFullscreen) {
      return;
    }

    event.preventDefault();
    resizeStateRef.current = {
      side,
      startX: event.clientX,
      startWidth: side === 'left' ? leftPanelWidth : rightPanelWidth,
    };
    setIsPanelResizing(true);
  }

  useEffect(() => {
    if (!isPanelResizing) {
      return undefined;
    }

    const onPointerMove = (event) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }

      const maxWidth = Math.max(340, Math.round(window.innerWidth * PANEL_MAX_WIDTH_RATIO));
      if (state.side === 'left') {
        const next = Math.min(maxWidth, Math.max(LEFT_PANEL_MIN_WIDTH, state.startWidth + (event.clientX - state.startX)));
        setLeftPanelWidth(next);
      } else {
        const next = Math.min(maxWidth, Math.max(RIGHT_PANEL_MIN_WIDTH, state.startWidth + (state.startX - event.clientX)));
        setRightPanelWidth(next);
      }
    };

    const onPointerUp = () => {
      resizeStateRef.current = null;
      setIsPanelResizing(false);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [isPanelResizing]);

  function clearLeftFlyoutTimer() {
    if (leftFlyoutTimerRef.current) {
      clearTimeout(leftFlyoutTimerRef.current);
      leftFlyoutTimerRef.current = null;
    }
  }

  function clearRightFlyoutTimer() {
    if (rightFlyoutTimerRef.current) {
      clearTimeout(rightFlyoutTimerRef.current);
      rightFlyoutTimerRef.current = null;
    }
  }

  function scheduleLeftFlyoutOpen(delay = 240) {
    clearLeftFlyoutTimer();
    leftFlyoutTimerRef.current = setTimeout(() => {
      setLeftFlyoutOpen(true);
      leftFlyoutTimerRef.current = null;
    }, delay);
  }

  function scheduleRightFlyoutOpen(delay = 240) {
    clearRightFlyoutTimer();
    rightFlyoutTimerRef.current = setTimeout(() => {
      setRightFlyoutOpen(true);
      rightFlyoutTimerRef.current = null;
    }, delay);
  }

  function scheduleLeftFlyoutClose(delay = 120) {
    clearLeftFlyoutTimer();
    leftFlyoutTimerRef.current = setTimeout(() => {
      setLeftFlyoutOpen(false);
      leftFlyoutTimerRef.current = null;
    }, delay);
  }

  function scheduleRightFlyoutClose(delay = 120) {
    clearRightFlyoutTimer();
    rightFlyoutTimerRef.current = setTimeout(() => {
      setRightFlyoutOpen(false);
      rightFlyoutTimerRef.current = null;
    }, delay);
  }

  function closeFloatingPanels(delay = 100) {
    scheduleLeftFlyoutClose(delay);
    scheduleRightFlyoutClose(delay);
  }

  useEffect(
    () => () => {
      clearLeftFlyoutTimer();
      clearRightFlyoutTimer();
    },
    [],
  );

  useEffect(() => {
    if (!isGraphFullscreen) {
      setLeftFlyoutOpen(false);
      setRightFlyoutOpen(false);
      clearLeftFlyoutTimer();
      clearRightFlyoutTimer();
    }
  }, [isGraphFullscreen]);

  useEffect(() => {
    if (!isGraphFullscreen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsGraphFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isGraphFullscreen]);

  const showLeftPanelContent = isGraphFullscreen ? leftFlyoutOpen : !leftCollapsed;
  const showRightPanelContent = isGraphFullscreen ? rightFlyoutOpen : !rightCollapsed;

  const appShellStyle = {
    '--left-panel-open-width': `${leftPanelWidth}px`,
    '--right-panel-open-width': `${rightPanelWidth}px`,
    '--left-panel-width': isGraphFullscreen ? '0px' : leftCollapsed ? '0px' : `${leftPanelWidth}px`,
    '--right-panel-width': isGraphFullscreen ? '0px' : rightCollapsed ? '0px' : `${rightPanelWidth}px`,
    '--left-gap': isGraphFullscreen ? '0px' : leftCollapsed ? '0px' : '10px',
    '--right-gap': isGraphFullscreen ? '0px' : rightCollapsed ? '0px' : '5px',
  };
  const fullscreenButtonLabel = isGraphFullscreen ? 'Exit full screen (Esc)' : 'Enter full screen';
  const legendButtonLabel = isLegendOpen ? 'Hide graph legend' : 'Show graph legend';
  const exportButtonLabel = isExportMenuOpen ? 'Hide export options' : 'Show export options';
  const settingsButtonLabel = isSettingsOpen ? 'Hide graph settings' : 'Show graph settings';
  const hasExportableGraph = visibleElements.length > 0;
  const graphSearchMatchCount = graphSearchMatches.length;
  const graphSearchCounterLabel =
    graphSearchMatchCount > 0 && activeGraphSearchMatch
      ? `${graphSearchActiveIndex + 1}/${graphSearchMatchCount}`
      : graphSearchQuery.trim()
        ? '0/0'
        : 'Find';

  return (
    <div
      className={`page-shell ${isGraphFullscreen ? 'fullscreen-mode' : ''} ${isPanelResizing ? 'resizing' : ''} ${isDetachedPanMode ? 'detached-pan' : ''
        }`}
    >
      <header className="app-header">
        <div>
          <h1 className="brand-title">
            <span className="brand-lockup">
              <span className="brand-word">IDEA</span>
              <span className="brand-star" aria-hidden="true">
                *
              </span>
            </span>
            <span className="brand-word brand-word-viewer">VIEWER</span>
          </h1>
        </div>
        <div className="header-actions">
          <a
            className="header-icon-link"
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Report a bug or suggest a feature on GitHub"
            title="Report a bug or suggest a feature"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.08 3.29 9.39 7.86 10.91.57.11.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.87-1.35-3.87-1.35-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.71.08-.71 1.15.08 1.75 1.18 1.75 1.18 1.02 1.76 2.68 1.25 3.33.96.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.14 1.18a10.9 10.9 0 0 1 5.72 0c2.17-1.49 3.13-1.18 3.13-1.18.63 1.59.24 2.77.12 3.06.74.8 1.18 1.83 1.18 3.09 0 4.43-2.68 5.41-5.24 5.69.41.35.77 1.03.77 2.08 0 1.5-.01 2.71-.01 3.08 0 .3.21.67.79.55A11.52 11.52 0 0 0 23.5 12C23.5 5.66 18.35.5 12 .5Z" />
            </svg>
          </a>
          <div className="header-settings-menu">
            <button
              type="button"
              className={`header-icon-button ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => setIsSettingsOpen((value) => !value)}
              aria-label={settingsButtonLabel}
              title={settingsButtonLabel}
              aria-pressed={isSettingsOpen}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'none' }}>
                <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {isSettingsOpen && (
              <div className="header-settings-popover" role="dialog" aria-label="Graph settings">
                <div className="header-settings-title">Graph settings</div>

                <div className="header-setting-row">
                  <div className="header-setting-label-row">
                    <span>Graph theme</span>
                    <span>{isHighContrastGraph ? 'Legacy B/W' : 'Classic'}</span>
                  </div>
                  <div
                    className={`header-theme-toggle ${isHighContrastGraph ? 'mode-high-contrast' : 'mode-classic'}`}
                    role="tablist"
                    aria-label="Graph render theme"
                  >
                    <span className="header-theme-toggle-thumb" aria-hidden="true" />
                    <button
                      type="button"
                      className={`header-theme-toggle-button ${!isHighContrastGraph ? 'active' : ''}`}
                      onClick={() => setGraphThemeMode(GRAPH_THEME_MODES.CLASSIC)}
                      aria-label="Use classic graph theme"
                      title="Classic graph theme"
                      aria-pressed={!isHighContrastGraph}
                    >
                      Classic
                    </button>
                    <button
                      type="button"
                      className={`header-theme-toggle-button ${isHighContrastGraph ? 'active' : ''}`}
                      onClick={() => setGraphThemeMode(GRAPH_THEME_MODES.HIGH_CONTRAST)}
                      aria-label="Use legacy black-and-white graph theme"
                      title="Legacy black-and-white graph theme"
                      aria-pressed={isHighContrastGraph}
                    >
                      Legacy B/W
                    </button>
                  </div>
                </div>

                <div className="header-setting-row">
                  <div className="header-setting-label-row">
                    <span>Zoom speed</span>
                    <span>{graphZoomSpeed.toFixed(2)}</span>
                  </div>
                  <input
                    className="header-setting-slider"
                    type="range"
                    min={MIN_GRAPH_ZOOM_SPEED}
                    max={MAX_GRAPH_ZOOM_SPEED}
                    step={0.02}
                    value={graphZoomSpeed}
                    onChange={(event) => handleGraphZoomSpeedChange(event.target.value)}
                  />
                </div>

                <div className="header-setting-row">
                  <div className="header-setting-label-row">
                    <span>Font size</span>
                    <span>{graphFontSize}px</span>
                  </div>
                  <div className="header-setting-stepper">
                    <button
                      type="button"
                      className="header-stepper-button"
                      onClick={() => stepGraphFontSize(-1)}
                      disabled={graphFontSize <= MIN_GRAPH_FONT_SIZE}
                      aria-label="Decrease graph font size"
                    >
                      -
                    </button>
                    <div className="header-stepper-value">{graphFontSize}</div>
                    <button
                      type="button"
                      className="header-stepper-button"
                      onClick={() => stepGraphFontSize(1)}
                      disabled={graphFontSize >= MAX_GRAPH_FONT_SIZE}
                      aria-label="Increase graph font size"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="header-setting-row">
                  <div className="header-setting-label-row">
                    <span>Dotted edge labels</span>
                    <span>{showDottedEdgeLabels ? 'On' : 'Off'}</span>
                  </div>
                  <label className="header-setting-checkbox">
                    <input
                      type="checkbox"
                      checked={showDottedEdgeLabels}
                      onChange={(event) => setShowDottedEdgeLabels(event.target.checked)}
                    />
                    <span>Show labels on synthesized dotted OWL edges</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={`app-shell ${isGraphFullscreen ? 'fullscreen' : ''}`} style={appShellStyle}>
        <aside
          className={`panel left ${!isGraphFullscreen && leftCollapsed ? 'collapsed' : ''} ${isGraphFullscreen ? 'floating' : ''
            } ${isGraphFullscreen && leftFlyoutOpen ? 'floating-open' : ''}`}
          onMouseEnter={
            isGraphFullscreen
              ? () => {
                clearLeftFlyoutTimer();
                setLeftFlyoutOpen(true);
              }
              : undefined
          }
          onMouseLeave={isGraphFullscreen ? () => scheduleLeftFlyoutClose(120) : undefined}
        >
          {!isGraphFullscreen && (
            <button
              className="panel-toggle"
              type="button"
              onClick={() => setLeftCollapsed((value) => !value)}
              aria-label={leftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
              title={leftCollapsed ? 'Expand panel' : 'Collapse panel (drag panel edge to resize)'}
            >
              {leftCollapsed ? '>' : '<'}
            </button>
          )}
          {!isGraphFullscreen && !leftCollapsed && (
            <div className="panel-resize-handle right" onMouseDown={(event) => startPanelResize('left', event)} />
          )}

          {showLeftPanelContent && (
            <div className="panel-content">
              <section className={`panel-section ${leftSectionOpen.source ? '' : 'collapsed-section'}`}>
                <div className="section-header">
                  <button
                    type="button"
                    className="section-toggle"
                    onClick={() => toggleLeftSection('source')}
                    aria-label={leftSectionOpen.source ? 'Minimize Source File section' : 'Expand Source File section'}
                    title={leftSectionOpen.source ? 'Minimize' : 'Expand'}
                  >
                    {leftSectionOpen.source ? '-' : '+'}
                  </button>
                  <h2>Upload File</h2>
                  <button
                    type="button"
                    className="section-clear"
                    onClick={() => { void clearLoadedGraph(); }}
                    disabled={uploadedFiles.length === 0}
                    aria-label="Clear all uploaded files and graph"
                    title="Clear graph"
                  >
                    Clear
                  </button>
                </div>

                {leftSectionOpen.source && (
                  <div className="section-body">
                    <label className="file-control">
                      <span>Upload file (.ttl/.rdf/.owl/.n3/.nt/.nq/.trig)</span>
                      <input
                        type="file"
                        accept=".ttl,.rdf,.owl,.n3,.nt,.nq,.trig"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          handleFileSelection(files);
                          event.target.value = '';
                        }}
                      />
                      <small>{formatSelectedFiles(uploadedFiles, 'No files selected')}</small>
                    </label>
                    <small className="muted">{isLoading ? 'Parsing uploaded triples and refreshing both views...' : 'Graph updates automatically when files are added.'}</small>
                  </div>
                )}
              </section>

              <section className={`panel-section ${leftSectionOpen.filters ? '' : 'collapsed-section'}`}>
                <div className="section-header">
                  <button
                    type="button"
                    className="section-toggle"
                    onClick={() => toggleLeftSection('filters')}
                    aria-label={leftSectionOpen.filters ? 'Minimize Graph Filters section' : 'Expand Graph Filters section'}
                    title={leftSectionOpen.filters ? 'Minimize' : 'Expand'}
                  >
                    {leftSectionOpen.filters ? '-' : '+'}
                  </button>
                  <h2>Graph Filters</h2>
                </div>

                {leftSectionOpen.filters && (
                  <div className="section-body">
                    <h3 className="filter-group-title">Projection</h3>
                    {graphProjectionMode === GRAPH_PROJECTION_MODES.OWL ? (
                      <div className="option-list" role="radiogroup" aria-label="OWL projection level">
                        <label className="option-item">
                          <input
                            type="radio"
                            name="owl-projection-level"
                            checked={owlProjectionLevel === OWL_PROJECTION_LEVELS.TAXONOMY}
                            onChange={() => setOwlProjectionLevel(OWL_PROJECTION_LEVELS.TAXONOMY)}
                          />
                          <span>Taxonomy</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="owl-projection-level"
                            checked={owlProjectionLevel === OWL_PROJECTION_LEVELS.SCHEMA}
                            onChange={() => setOwlProjectionLevel(OWL_PROJECTION_LEVELS.SCHEMA)}
                          />
                          <span>Schema</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="owl-projection-level"
                            checked={owlProjectionLevel === OWL_PROJECTION_LEVELS.ONTOLOGY}
                            onChange={() => setOwlProjectionLevel(OWL_PROJECTION_LEVELS.ONTOLOGY)}
                          />
                          <span>Ontology</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="owl-projection-level"
                            checked={owlProjectionLevel === OWL_PROJECTION_LEVELS.KG}
                            onChange={() => setOwlProjectionLevel(OWL_PROJECTION_LEVELS.KG)}
                          />
                          <span>KG</span>
                        </label>
                      </div>
                    ) : graphProjectionMode === GRAPH_PROJECTION_MODES.RDF ? (
                      <div className="option-list" role="radiogroup" aria-label="RDF projection level">
                        <label className="option-item">
                          <input
                            type="radio"
                            name="rdf-projection-level"
                            checked={rdfProjectionLevel === RDF_PROJECTION_LEVELS.OBJECT}
                            onChange={() => setRdfProjectionLevel(RDF_PROJECTION_LEVELS.OBJECT)}
                          />
                          <span>Object</span>
                        </label>
                        <label className="option-item">
                          <input
                            type="radio"
                            name="rdf-projection-level"
                            checked={rdfProjectionLevel === RDF_PROJECTION_LEVELS.ALL}
                            onChange={() => setRdfProjectionLevel(RDF_PROJECTION_LEVELS.ALL)}
                          />
                          <span>All</span>
                        </label>
                      </div>
                    ) : (
                      <p className="muted">Use the graph toolbar toggle to switch between OWL and RDF views.</p>
                    )}

                    <h3 className="filter-group-title">Axis</h3>
                    <div className="option-list" role="radiogroup" aria-label="Graph filtering axis">
                      <label className="option-item">
                        <input
                          type="radio"
                          name="graph-filter-axis"
                          checked={graphFilterAxis === GRAPH_FILTER_AXES.ALL}
                          onChange={() => setGraphFilterAxis(GRAPH_FILTER_AXES.ALL)}
                        />
                        <span>all</span>
                      </label>
                      <label className="option-item">
                        <input
                          type="radio"
                          name="graph-filter-axis"
                          checked={graphFilterAxis === GRAPH_FILTER_AXES.TBOX}
                          onChange={() => setGraphFilterAxis(GRAPH_FILTER_AXES.TBOX)}
                        />
                        <span>T-box</span>
                      </label>
                      <label className="option-item">
                        <input
                          type="radio"
                          name="graph-filter-axis"
                          checked={graphFilterAxis === GRAPH_FILTER_AXES.ABOX}
                          onChange={() => setGraphFilterAxis(GRAPH_FILTER_AXES.ABOX)}
                        />
                        <span>A-Box</span>
                      </label>
                    </div>

                    {showClassTypeFilter && (
                      <>
                        <h3 className="filter-group-title">Class type</h3>
                        <div className="mini-actions">
                          <button type="button" onClick={selectAllClasses} disabled={!graphData || isAllClassesSelected}>
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={clearClassSelection}
                            disabled={!graphData || selectedClassIris.length === 0}
                          >
                            Clear
                          </button>
                        </div>

                        <div className="class-list">
                          {!graphData && <p className="muted">Load data to list class types.</p>}
                          {graphData && graphData.classes.length === 0 && (
                            <p className="muted">No explicit `rdf:type` triples detected.</p>
                          )}
                          {graphData &&
                            graphData.classes.map((entry) => (
                              <label key={entry.id} className="class-item">
                                <input
                                  type="checkbox"
                                  checked={selectedClassIris.includes(entry.id)}
                                  onChange={() => toggleClass(entry.id)}
                                />
                                <span className="class-label" title={entry.id}>
                                  {entry.label}
                                </span>
                                <small>{entry.count}</small>
                              </label>
                            ))}
                        </div>
                      </>
                    )}
                    <h3 className="filter-group-title">Node name</h3>
                    <div className="node-search-row">
                      <input
                        type="text"
                        value={nodeNameQuery}
                        onChange={(event) => setNodeNameQuery(event.target.value)}
                        placeholder="Search visible node labels..."
                        aria-label="Search by node name"
                      />
                      <button type="button" onClick={() => setNodeNameQuery('')} disabled={!nodeNameQuery.trim()}>
                        Clear
                      </button>
                    </div>

                    <h3 className="filter-group-title">Base IRI</h3>
                    <div className="mini-actions">
                      <button type="button" onClick={selectAllBaseIris} disabled={!graphData || isAllBaseIrisSelected}>
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={clearBaseIris}
                        disabled={!graphData || selectedBaseIris.length === 0}
                      >
                        Clear
                      </button>
                    </div>

                    <div className="class-list">
                      {!graphData && <p className="muted">Load data to list dataset IRIs.</p>}
                      {graphData && graphData.baseIris.length === 0 && (
                        <p className="muted">No named-node IRIs available for base extraction.</p>
                      )}
                      {graphData &&
                        graphData.baseIris.map((entry) => (
                          <label key={entry.id} className="class-item">
                            <input
                              type="checkbox"
                              checked={selectedBaseIris.includes(entry.id)}
                              onChange={() => toggleBaseIri(entry.id)}
                            />
                            <span className="class-label" title={entry.id}>
                              {entry.label}
                            </span>
                            <small>{entry.count}</small>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </section>

              <section className={`panel-section ${leftSectionOpen.sparql ? '' : 'collapsed-section'}`}>
                <div className="section-header">
                  <button
                    type="button"
                    className="section-toggle"
                    onClick={() => toggleLeftSection('sparql')}
                    aria-label={leftSectionOpen.sparql ? 'Minimize SPARQL Filter section' : 'Expand SPARQL Filter section'}
                    title={leftSectionOpen.sparql ? 'Minimize' : 'Expand'}
                  >
                    {leftSectionOpen.sparql ? '-' : '+'}
                  </button>
                  <h2>SPARQL Filter</h2>
                </div>

                {leftSectionOpen.sparql && (
                  <div className="section-body">
                    <div className="sparql-prefixes">
                      <div className="sparql-prefix-group">
                        <div className="sparql-prefix-group-header">
                          <button
                            type="button"
                            className="section-toggle"
                            onClick={() => toggleSparqlPrefixSection('fixed')}
                            aria-label={sparqlPrefixSectionOpen.fixed ? 'Collapse general prefixes' : 'Expand general prefixes'}
                            title={sparqlPrefixSectionOpen.fixed ? 'Minimize' : 'Expand'}
                          >
                            {sparqlPrefixSectionOpen.fixed ? '-' : '+'}
                          </button>
                          <h4>General prefixes (built-in)</h4>
                        </div>
                        {sparqlPrefixSectionOpen.fixed && (
                          <div className="sparql-prefix-list sparql-prefix-list-readonly">
                            {FIXED_SPARQL_PREFIXES.map((row) => (
                              <div key={row.id} className="sparql-prefix-row sparql-prefix-row-readonly">
                                <input type="text" value={row.prefix} readOnly aria-label="Built-in SPARQL prefix name" />
                                <input type="text" value={row.iri} readOnly aria-label="Built-in SPARQL prefix IRI" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sparql-prefix-group">
                        <div className="sparql-prefix-group-header">
                          <button
                            type="button"
                            className="section-toggle"
                            onClick={() => toggleSparqlPrefixSection('custom')}
                            aria-label={sparqlPrefixSectionOpen.custom ? 'Collapse custom prefixes' : 'Expand custom prefixes'}
                            title={sparqlPrefixSectionOpen.custom ? 'Minimize' : 'Expand'}
                          >
                            {sparqlPrefixSectionOpen.custom ? '-' : '+'}
                          </button>
                          <h4>Custom prefixes (editable)</h4>
                          <button
                            type="button"
                            className="prefix-add-button"
                            onClick={addSparqlPrefixRow}
                            aria-label="Add custom prefix row"
                            title="Add prefix"
                          >
                            + Add
                          </button>
                        </div>
                        {sparqlPrefixSectionOpen.custom && (
                          <>
                            {sparqlPrefixes.length === 0 && (
                              <p className="muted">Load data to auto-generate base IRI prefixes, or add one manually.</p>
                            )}
                            {sparqlPrefixes.length > 0 && (
                              <div className="sparql-prefix-list">
                                {sparqlPrefixes.map((row) => (
                                  <div key={row.id} className="sparql-prefix-row sparql-prefix-row-editable">
                                    <input
                                      type="text"
                                      value={row.prefix}
                                      onChange={(event) => updateSparqlPrefixName(row.id, event.target.value)}
                                      aria-label="SPARQL prefix name"
                                      className="sparql-prefix-name"
                                    />
                                    <input
                                      type="text"
                                      value={row.iri}
                                      onChange={(event) => updateSparqlPrefixIri(row.id, event.target.value)}
                                      aria-label="SPARQL prefix IRI"
                                      className="sparql-prefix-iri"
                                    />
                                    <button
                                      type="button"
                                      className="prefix-remove-button"
                                      onClick={() => removeSparqlPrefixRow(row.id)}
                                      aria-label={`Remove custom prefix ${row.prefix || row.id}`}
                                      title="Remove prefix"
                                    >
                                      <svg className="prefix-remove-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                        <path
                                          d="M5.5 2.5H10.5M3.5 4H12.5M6.5 4V12M9.5 4V12M4.5 4.5V12.5C4.5 13.1 4.9 13.5 5.5 13.5H10.5C11.1 13.5 11.5 13.1 11.5 12.5V4.5"
                                          stroke="currentColor"
                                          strokeWidth="1.3"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={sparqlDraft}
                      onChange={(event) => setSparqlDraft(event.target.value)}
                      placeholder={'SELECT DISTINCT ?entity WHERE { ?entity a ns1:Argument . }'}
                      rows={5}
                    />

                    <div className="mini-actions">
                      <button type="button" onClick={applySparqlFilter} disabled={!graphData || !sparqlDraft.trim()}>
                        Apply
                      </button>
                      <button type="button" onClick={clearSparqlFilter} disabled={!sparqlQuery && !sparqlDraft}>
                        Clear
                      </button>
                    </div>
                    <p className="muted">Write core query only. Prefix lines are prepended automatically at runtime.</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </aside>

        <main
          className={`graph-area ${(loadError || filterError) ? 'has-graph-errors' : ''}`}
          onMouseEnter={
            isGraphFullscreen
              ? () => {
                closeFloatingPanels(100);
              }
              : undefined
          }
        >
          {(loadError || filterError) && (
            <div className="error-stack">
              {loadError && <div className="error">Load error: {loadError}</div>}
              {filterError && <div className="error">Filter error: {filterError}</div>}
            </div>
          )}

          <div className="graph-tools graph-tools-left">
            <div className="graph-tools-left-stack">
              <div
                className={`projection-toggle theme-switch ${graphProjectionMode === GRAPH_PROJECTION_MODES.RDF ? 'mode-rdf' : 'mode-ontology'
                  }`}
                role="tablist"
                aria-label="Graph projection mode"
              >
                <span className="projection-switch-thumb" aria-hidden="true" />
                <button
                  type="button"
                  className={`projection-toggle-button ${graphProjectionMode === GRAPH_PROJECTION_MODES.OWL ? 'active' : ''
                    }`}
                  onClick={() => setGraphProjectionMode(GRAPH_PROJECTION_MODES.OWL)}
                  aria-pressed={graphProjectionMode === GRAPH_PROJECTION_MODES.OWL}
                  aria-label={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.OWL]}
                  title={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.OWL]}
                >
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="8" cy="3.2" r="1.2" fill="currentColor" />
                    <circle cx="12.2" cy="5" r="1.1" fill="currentColor" />
                    <circle cx="12" cy="10.8" r="1.1" fill="currentColor" />
                    <circle cx="4" cy="10.8" r="1.1" fill="currentColor" />
                    <circle cx="3.8" cy="5" r="1.1" fill="currentColor" />
                    <path
                      d="M8 5.2V6.1M10.2 6.2L9.3 6.9M10 9.9L9.2 9.2M6.8 9.2L6 9.9M6.7 6.9L5.8 6.2"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`projection-toggle-button ${graphProjectionMode === GRAPH_PROJECTION_MODES.RDF ? 'active' : ''
                    }`}
                  onClick={() => setGraphProjectionMode(GRAPH_PROJECTION_MODES.RDF)}
                  aria-pressed={graphProjectionMode === GRAPH_PROJECTION_MODES.RDF}
                  aria-label={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.RDF]}
                  title={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.RDF]}
                >
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="3.5" cy="4" r="1.5" fill="currentColor" />
                    <circle cx="12.5" cy="4" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="12" r="1.8" fill="currentColor" />
                    <path
                      d="M4.9 4.9L7.1 10.1M11.1 4.9L8.9 10.1M5.1 4H10.9"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className={`graph-search-panel ${isGraphSearchOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className={`graph-search-launch ${isGraphSearchOpen ? 'active' : ''}`}
                  onClick={() => {
                    if (isGraphSearchOpen) {
                      closeGraphSearch();
                    } else {
                      openGraphSearch();
                    }
                  }}
                  aria-label={isGraphSearchOpen ? 'Close graph search' : 'Find nodes in graph'}
                  title={isGraphSearchOpen ? 'Close search (Esc)' : 'Find nodes (Ctrl+F)'}
                >
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="3.9" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M10.2 10.2L13.4 13.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span>{graphSearchCounterLabel}</span>
                </button>

                {isGraphSearchOpen && (
                  <div className="graph-search-fields">
                    <input
                      ref={graphSearchInputRef}
                      type="text"
                      value={graphSearchQuery}
                      onChange={(event) => {
                        graphSearchInputAtRef.current = performance.now();
                        setGraphSearchQuery(event.target.value);
                        setGraphSearchActiveIndex(0);
                      }}
                      placeholder="Find visible nodes by name..."
                      aria-label="Find visible nodes by name"
                    />
                    <button
                      type="button"
                      className="graph-search-nav"
                      onClick={() => moveGraphSearchMatch(-1)}
                      disabled={graphSearchMatchCount === 0}
                      aria-label="Previous match"
                      title="Previous match (Shift+Enter)"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      className="graph-search-nav"
                      onClick={() => moveGraphSearchMatch(1)}
                      disabled={graphSearchMatchCount === 0}
                      aria-label="Next match"
                      title="Next match (Enter)"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                    <button
                      type="button"
                      className="graph-search-close"
                      onClick={() => closeGraphSearch()}
                      aria-label="Close graph search"
                      title="Close search (Esc)"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="graph-tools graph-tools-right">
            <button
              type="button"
              className={`graph-tool-button icon-only ${isLegendOpen ? 'active' : ''}`}
              onClick={() => setIsLegendOpen((value) => !value)}
              aria-label={legendButtonLabel}
              title={legendButtonLabel}
              aria-pressed={isLegendOpen}
            >
              <svg className="graph-tool-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2.5" y="3.2" width="11" height="1.4" rx="0.7" fill="currentColor" />
                <rect x="2.5" y="7.3" width="7.6" height="1.4" rx="0.7" fill="currentColor" />
                <rect x="2.5" y="11.4" width="9.6" height="1.4" rx="0.7" fill="currentColor" />
                <circle cx="12.3" cy="8" r="1.2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            <button
              type="button"
              className="graph-tool-button icon-only"
              onClick={() => {
                setIsGraphFullscreen((value) => !value);
              }}
              aria-label={fullscreenButtonLabel}
              title={fullscreenButtonLabel}
            >
              <svg className="graph-tool-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                {isGraphFullscreen ? (
                  <path
                    d="M2 2L6 6 M4 6H6V4 M14 2L10 6 M10 4V6H12 M2 14L6 10 M4 10H6V12 M14 14L10 10 M10 12V10H12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M6 2H2V6 M10 2H14V6 M2 10V14H6 M14 10V14H10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>

            <div className="graph-export-menu">
              <button
                type="button"
                className={`graph-tool-button icon-only ${isExportMenuOpen ? 'active' : ''}`}
                onClick={() => setIsExportMenuOpen((value) => !value)}
                aria-label={exportButtonLabel}
                title={exportButtonLabel}
                aria-pressed={isExportMenuOpen}
                disabled={!hasExportableGraph}
              >
                <svg className="graph-tool-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 2.4V9.1M8 9.1L5.4 6.5M8 9.1L10.6 6.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.1 10.8V12.2C3.1 12.86 3.64 13.4 4.3 13.4H11.7C12.36 13.4 12.9 12.86 12.9 12.2V10.8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {isExportMenuOpen && hasExportableGraph && (
                <div className="graph-export-popover" role="dialog" aria-label="Export current view">
                  <div className="graph-export-title">Export current view</div>
                  <div className="graph-export-actions">
                    <button type="button" className="graph-export-action" onClick={() => handleExport('csv')} disabled={!hasExportableGraph}>
                      CSV
                    </button>
                    <button type="button" className="graph-export-action" onClick={() => handleExport('ttl')} disabled={!hasExportableGraph}>
                      TTL
                    </button>
                    <button type="button" className="graph-export-action" onClick={() => handleExport('png')} disabled={!hasExportableGraph}>
                      PNG
                    </button>
                    <button type="button" className="graph-export-action" onClick={() => handleExport('html')} disabled={!hasExportableGraph}>
                      HTML
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isLegendOpen && (
              <div className="graph-legend-popover" role="dialog" aria-label="Graph legend">
                <div className="graph-legend-title">Legend</div>
                <div className="graph-legend-list">
                  {graphProjectionMode === GRAPH_PROJECTION_MODES.RDF ? (
                    <>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-class" />
                        <span>Class or named resource</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-individual" />
                        <span>Named individual or KG instance</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-literal" />
                        <span>Literal value</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-rdf-syntax" />
                        <span>Blank RDF / OWL syntax node</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-edge-marker edge-marker-base" />
                        <span>`rdf:` / `rdfs:` relation</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-edge-marker edge-marker-property" />
                        <span>Other relation, including `owl:`</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-edge-marker edge-marker-dotted" />
                        <span>Added connector edge</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-class" />
                        <span>Class</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-individual" />
                        <span>Named individual or KG instance</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-literal" />
                        <span>Literal value</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-datatype" />
                        <span>Datatype</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-class-expression" />
                        <span>OWL connector or set</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-edge-marker" />
                        <span>Labeled relation edge</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            ref={graphContainerRef}
            className={`graph-canvas ${isDetachedPanMode ? 'detached-pan-mode' : ''} ${isHighContrastGraph ? 'mode-high-contrast' : ''}`}
          />

          {multiClassBadgeTooltip && (
            <div className="badge-fanout" style={{ left: multiClassBadgeTooltip.left, top: multiClassBadgeTooltip.top }}>
              <div className="badge-fanout-count">{multiClassBadgeTooltip.count} classes</div>
              <div className="badge-fanout-stack" style={{ '--fan-count': multiClassBadgeTooltip.classes.length }}>
                {multiClassBadgeTooltip.classes.map((entry, index) => (
                  <div
                    key={`${entry}-${index}`}
                    className="badge-fanout-chip"
                    style={{ '--chip-index': index }}
                  >
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}

          {restrictionNodeTooltip && (
            <div
              className="restriction-tooltip"
              style={{ left: restrictionNodeTooltip.left, top: restrictionNodeTooltip.top, maxWidth: restrictionNodeTooltip.width }}
            >
              {restrictionNodeTooltip.text}
            </div>
          )}

          {hoverTooltip && (
            <div
              className="restriction-tooltip hover-tooltip"
              style={{ left: hoverTooltip.left, top: hoverTooltip.top, maxWidth: hoverTooltip.width, whiteSpace: 'pre-wrap' }}
            >
              {hoverTooltip.text}
            </div>
          )}

          <div className="status-bar overlay">
            <span>{status}</span>
            <span>
              {isFiltering
                ? 'Applying filters...'
                : `${visibleElements.filter((entry) => !entry.data.source).length} nodes visible`}
            </span>
          </div>
        </main>

        <aside
          className={`panel right ${!isGraphFullscreen && rightCollapsed ? 'collapsed' : ''} ${isGraphFullscreen ? 'floating' : ''
            } ${isGraphFullscreen && rightFlyoutOpen ? 'floating-open' : ''}`}
          onMouseEnter={
            isGraphFullscreen
              ? () => {
                clearRightFlyoutTimer();
                setRightFlyoutOpen(true);
              }
              : undefined
          }
          onMouseLeave={isGraphFullscreen ? () => scheduleRightFlyoutClose(120) : undefined}
        >
          {!isGraphFullscreen && (
            <button
              className="panel-toggle"
              type="button"
              onClick={() => setRightCollapsed((value) => !value)}
              aria-label={rightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
              title={rightCollapsed ? 'Expand panel' : 'Collapse panel (drag panel edge to resize)'}
            >
              {rightCollapsed ? '<' : '>'}
            </button>
          )}
          {!isGraphFullscreen && !rightCollapsed && (
            <div className="panel-resize-handle left" onMouseDown={(event) => startPanelResize('right', event)} />
          )}

          {showRightPanelContent && (
            <div className="panel-content">
              <section className="panel-section details-card">
                <h2>Entity Inspector</h2>

                {!selectedNode && !selectedEdge && ontologyMetadataRows.length === 0 && (
                  <p className="muted">Click a node or relation to inspect metadata and provenance.</p>
                )}

                {!selectedNode && !selectedEdge && ontologyMetadataRows.length > 0 && (
                  <>
                    <h4>Dataset metadata ({ontologyMetadataRows.length})</h4>
                    <div className="property-list">
                      {ontologyMetadataRows.map((row) => (
                        <div key={row.id} className="property-row" title={row.fileName}>
                          <div className="property-name">{row.predicate}</div>
                          <div className="property-meta breakable">{row.subject}</div>
                          <div className="property-value breakable">{row.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selectedEdge && (
                  <>
                    <h3 className="entity-title">{selectedEdge.predicateLabel}</h3>

                    <dl className="entity-meta">
                      <dt>Axiom</dt>
                      <dd>{selectedEdge.axiomKind || 'Axiom'}</dd>

                      {selectedEdge.restrictionKind && (
                        <>
                          <dt>Restriction</dt>
                          <dd>{selectedEdge.restrictionKind}</dd>
                        </>
                      )}

                      <dt>Category</dt>
                      <dd>{selectedEdge.category}</dd>

                      <dt>Predicate IRI</dt>
                      <dd className="breakable mono">{selectedEdge.predicate}</dd>

                      <dt>Source</dt>
                      <dd>
                        <button
                          type="button"
                          className="neighbor-row inspector-link"
                          onClick={() => {
                            setSingleFocusedNode(selectedEdge.source);
                          }}
                        >
                          {graphData?.nodeMap.get(selectedEdge.source)?.fullLabel ?? selectedEdge.source}
                        </button>
                      </dd>

                      <dt>Target</dt>
                      <dd>
                        <button
                          type="button"
                          className="neighbor-row inspector-link"
                          onClick={() => {
                            setSingleFocusedNode(selectedEdge.target);
                          }}
                        >
                          {graphData?.nodeMap.get(selectedEdge.target)?.fullLabel ?? selectedEdge.target}
                        </button>
                      </dd>
                    </dl>

                    <h4>Relation metadata ({selectedEdgeMetadataRows.length})</h4>
                    <div className="property-list">
                      {selectedEdgeMetadataRows.length === 0 && <p className="muted">No additional metadata available.</p>}
                      {selectedEdgeMetadataRows.map((row, index) => (
                        <div key={`${row.key}-${index}`} className="property-row">
                          <div className="property-name">{row.key}</div>
                          <div className="property-value breakable">{row.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selectedNode && (
                  <>
                    <h3 className="entity-title">{selectedNode.fullLabel}</h3>

                    <div className="entity-meta-stacked">
                      <div className="entity-meta-block">
                        <div className="entity-meta-label">Category</div>
                        <div className="entity-meta-value">
                          {selectedNode.entityCategory || selectedNode.ontologyKind || selectedNode.kind}
                        </div>
                      </div>

                      <div className="entity-meta-block">
                        <div className="entity-meta-label">ID</div>
                        <div className="copy-panel">
                          <button
                            type="button"
                            className="copy-icon-action"
                            aria-label="Copy node ID"
                            title="Copy ID"
                            onClick={() => navigator.clipboard?.writeText(selectedNode.id)}
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path
                                d="M6 2.5H3.75A1.25 1.25 0 0 0 2.5 3.75v7.5A1.25 1.25 0 0 0 3.75 12.5h7.5a1.25 1.25 0 0 0 1.25-1.25V9"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M6.75 3.5h5.5A1.25 1.25 0 0 1 13.5 4.75v5.5a1.25 1.25 0 0 1-1.25 1.25h-5.5A1.25 1.25 0 0 1 5.5 10.25v-5.5A1.25 1.25 0 0 1 6.75 3.5Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div className="copy-code-block mono breakable">{selectedNode.id}</div>
                        </div>
                      </div>

                      {selectedNodeBaseOntology && (
                        <div className="entity-meta-block">
                          <div className="entity-meta-label">Base ontology</div>
                          <div className="entity-meta-value breakable base-ontology-row">
                            <span className="prefix-chip mono">{selectedNodeBaseOntology.prefix}</span>
                            <span>{selectedNodeBaseOntology.iri}</span>
                          </div>
                        </div>
                      )}

                      {selectedNodeClasses.length > 0 && (
                        <div className="entity-meta-block">
                          <div className="entity-meta-label">Classes</div>
                          <div className="entity-meta-value">
                            <ol className="class-chain">
                              {selectedNodeClasses.map((entry) => (
                                <li key={entry.iri} title={entry.iri}>
                                  {entry.prefixed}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      )}
                    </div>

                    <h4>Metadata / provenance ({selectedNodeMetadataRows.length})</h4>
                    <div className="property-list">
                      {selectedNodeMetadataRows.length === 0 && <p className="muted">No metadata rows available for this node.</p>}
                      {selectedNodeMetadataRows.map((row, index) => (
                        <div
                          key={`${row.predicate}-${row.value}-${index}`}
                          className="property-row"
                          title={row.predicate}
                        >
                          <div className="property-name">{row.predicateLabel}</div>
                          <div className="property-value breakable">{row.value}</div>
                        </div>
                      ))}
                    </div>

                    <h4>Annotation properties ({selectedNodeAnnotationProperties.length})</h4>
                    <div className="property-list">
                      {selectedNodeAnnotationProperties.length === 0 && (
                        <p className="muted">No annotation properties available for this node.</p>
                      )}
                      {selectedNodeAnnotationProperties.map((property, index) => (
                        <div
                          key={`${property.predicate}-${property.value.slice(0, 18)}-${index}`}
                          className="property-row"
                          title={property.predicate}
                        >
                          <div className="property-name">{property.predicateLabel}</div>
                          <div className="property-value breakable">{property.value}</div>
                        </div>
                      ))}
                    </div>

                    <h4>Processed statements ({selectedNodeStatements.processed.length})</h4>
                    <div className="property-list">
                      {selectedNodeStatements.processed.length === 0 && (
                        <p className="muted">No processed OWL statements available for this node.</p>
                      )}
                      {selectedNodeStatements.processed.map((row) => (
                        <div key={row.id} className="property-row">
                          <div className="property-name">Manchester</div>
                          <div className="property-value breakable">{row.manchester}</div>
                        </div>
                      ))}
                    </div>

                    <h4>Couldn&apos;t process ({selectedNodeStatements.unprocessed.length})</h4>
                    <div className="property-list">
                      {selectedNodeStatements.unprocessed.length === 0 && (
                        <p className="muted">No unprocessed source/property statements for this node.</p>
                      )}
                      {selectedNodeStatements.unprocessed.map((row) => (
                        <div key={row.id} className="property-row">
                          <div className="property-name">Statement</div>
                          <div className="property-value breakable">{row.statement}</div>
                        </div>
                      ))}
                    </div>

                    <h4>Data properties ({selectedNodeDataProperties.length})</h4>
                    <div className="property-list">
                      {selectedNodeDataProperties.length === 0 && (
                        <p className="muted">No literal properties available for this node.</p>
                      )}
                      {selectedNodeDataProperties.map((property, index) => (
                        <div
                          key={`${property.predicate}-${property.value.slice(0, 18)}-${index}`}
                          className="property-row"
                          title={property.predicate}
                        >
                          <div className="property-name">{property.predicateLabel}</div>
                          <div className="property-value breakable">{property.value}</div>
                        </div>
                      ))}
                    </div>

                    <h4>Object connections ({neighborRows.length})</h4>
                    <div className="neighbors">
                      {neighborRows.length === 0 && <p className="muted">No object connections available for this node.</p>}
                      {neighborRows.map((row) => (
                        <button
                          key={row.edgeId}
                          className="neighbor-row"
                          type="button"
                          onClick={() => {
                            setSingleFocusedNode(row.neighborId);
                          }}
                          title={row.neighborLabel}
                        >
                          <span className="badge">{row.direction}</span>
                          <span className="neighbor-text">
                            {row.predicateLabel} → {row.neighborLabel}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </aside>

        {isGraphFullscreen && (
          <>
            <div
              className="flyout-hover-zone left"
              onMouseEnter={() => scheduleLeftFlyoutOpen(260)}
              onMouseLeave={() => scheduleLeftFlyoutClose(180)}
            />
            <div
              className="flyout-hover-zone right"
              onMouseEnter={() => scheduleRightFlyoutOpen(260)}
              onMouseLeave={() => scheduleRightFlyoutClose(180)}
            />
          </>
        )}
      </div>

      <footer className="app-footer">
        Copyright © 2026 Rensselaer Polytechnic Institute | Tetherless World Constellation
      </footer>
    </div>
  );
}
