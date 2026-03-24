import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { QueryEngine } from '@comunica/query-sparql';
import { DataFactory, Writer } from 'n3';
import { buildFocusedSubset, buildGraphData, compactIri, extractOntologyModel, getTermId, parseRdfText } from './lib/rdf';
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
const DEFAULT_STATUS = 'Upload KG and/or ontology files to initialize the graph.';
const GRAPH_PROJECTION_MODES = {
  ONTOLOGY: 'ontology',
  KG: 'kg',
};
const PROJECTION_MODE_LABELS = {
  [GRAPH_PROJECTION_MODES.ONTOLOGY]: 'Ontology Full Detailed View',
  [GRAPH_PROJECTION_MODES.KG]: 'KG View',
};
const ONTOLOGY_VIEW_MODES = {
  CLASS_ONLY: 'class-only',
  CLASS_AND_OBJECT: 'class-and-object',
  CLASS_OBJECT_DATA: 'class-object-data',
  FULL: 'full',
};
const RDFS_LABEL_IRI = 'http://www.w3.org/2000/01/rdf-schema#label';
const XSD_BOOLEAN_IRI = 'http://www.w3.org/2001/XMLSchema#boolean';
const XSD_DECIMAL_IRI = 'http://www.w3.org/2001/XMLSchema#decimal';
const VIEW_EXPORT_NS = 'https://idea-viewer.local/view#';
const CYTOSCAPE_CDN_URL = 'https://unpkg.com/cytoscape@3.30.0/dist/cytoscape.min.js';
const GITHUB_ISSUES_URL = 'https://github.com/nipdep/idea-viewer/issues';

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

function getCurrentViewKey(projectionMode, isLightOntologyViewActive) {
  if (projectionMode === GRAPH_PROJECTION_MODES.KG) {
    return 'kg-view';
  }
  return isLightOntologyViewActive ? 'ontology-light-view' : 'ontology-full-view';
}

function getCurrentViewLabel(projectionMode, isLightOntologyViewActive) {
  if (projectionMode === GRAPH_PROJECTION_MODES.KG) {
    return 'KG view';
  }
  return isLightOntologyViewActive ? 'Ontology light view' : 'Ontology full detailed view';
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
    if (node.entityCategory !== 'individual') {
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
    if (node.entityCategory !== 'individual') {
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

function normalizeSearchText(value) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
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
    const displayLabel = (node.displayLabel || '').replace(/\n/g, ' ');
    const fields = [
      node.fullLabel || '',
      displayLabel,
      node.classBadge || '',
      node.primaryClassLabel || '',
      node.iri || '',
    ];

    if (fields.some((field) => normalizeSearchText(field).includes(needle))) {
      matchedNodeIds.add(node.id);
    }
  }

  return matchedNodeIds;
}

function buildNeighborRows(selectedNodeId, visibleElements, graphData) {
  if (!selectedNodeId || !graphData) {
    return [];
  }

  const rows = [];
  for (const element of visibleElements) {
    if (!element.data.source) {
      continue;
    }

    const { source, target, predicateLabel } = element.data;
    if (source !== selectedNodeId && target !== selectedNodeId) {
      continue;
    }

    const neighborId = source === selectedNodeId ? target : source;
    const neighborNode = graphData.nodeMap.get(neighborId);
    rows.push({
      edgeId: element.data.id,
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

function toViewFlags(filterMode) {
  switch (filterMode) {
    case ONTOLOGY_VIEW_MODES.CLASS_ONLY:
      return {
        showDataProperties: false,
        showAnnotationProperties: false,
        showObjectProperties: false,
        showNamedIndividuals: true,
      };
    case ONTOLOGY_VIEW_MODES.CLASS_OBJECT_DATA:
      return {
        showDataProperties: true,
        showAnnotationProperties: false,
        showObjectProperties: true,
        showNamedIndividuals: true,
      };
    case ONTOLOGY_VIEW_MODES.FULL:
      return {
        showDataProperties: true,
        showAnnotationProperties: true,
        showObjectProperties: true,
        showNamedIndividuals: true,
      };
    case ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT:
    default:
      return {
        showDataProperties: false,
        showAnnotationProperties: false,
        showObjectProperties: true,
        showNamedIndividuals: true,
      };
  }
}

function toViewOptions(projectionMode, filterMode, graphData, lightOntologyMode = false) {
  const flags = toViewFlags(filterMode);
  if (projectionMode === GRAPH_PROJECTION_MODES.KG) {
    return {
      projectionMode: GRAPH_PROJECTION_MODES.KG,
      ...flags,
      showTypeLinks: Boolean(graphData?.hasOntology),
      lightOntologyMode: false,
    };
  }

  return {
    projectionMode: GRAPH_PROJECTION_MODES.ONTOLOGY,
    ...flags,
    showTypeLinks: Boolean(graphData?.hasOntology),
    lightOntologyMode: Boolean(lightOntologyMode),
  };
}

function modelHasOntologySchema(model) {
  if (!model) {
    return false;
  }

  return (
    (model.classIds?.size ?? 0) > 0 ||
    (model.objectPropertyIds?.size ?? 0) > 0 ||
    (model.dataPropertyIds?.size ?? 0) > 0 ||
    (model.annotationPropertyIds?.size ?? 0) > 0 ||
    (model.datatypeIds?.size ?? 0) > 0
  );
}

export default function App() {
  const graphContainerRef = useRef(null);
  const cyRef = useRef(null);
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
  const groupDragStateRef = useRef(null);
  const groupDragArmRef = useRef(null);
  const shouldFitAfterFocusClearRef = useRef(false);
  const detachedPanModeRef = useRef(false);
  const detachedPanLastMouseRef = useRef(null);
  const suppressNextTapRef = useRef(false);

  const [kgFiles, setKgFiles] = useState([]);
  const [ontologyFiles, setOntologyFiles] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [visibleElements, setVisibleElements] = useState([]);

  const [selectedClassIris, setSelectedClassIris] = useState([]);
  const [selectedBaseIris, setSelectedBaseIris] = useState([]);
  const [nodeNameQuery, setNodeNameQuery] = useState('');
  const [sparqlDraft, setSparqlDraft] = useState('');
  const [sparqlQuery, setSparqlQuery] = useState('');
  const [sparqlPrefixes, setSparqlPrefixes] = useState([]);
  const [graphProjectionMode, setGraphProjectionMode] = useState(GRAPH_PROJECTION_MODES.ONTOLOGY);
  const [ontologyViewMode, setOntologyViewMode] = useState(ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT);

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
  const [isLightOntologyView, setIsLightOntologyView] = useState(false);

  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [loadError, setLoadError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [ontologyMetadataRows, setOntologyMetadataRows] = useState([]);
  const [multiClassBadgeTooltip, setMultiClassBadgeTooltip] = useState(null);
  const [restrictionNodeTooltip, setRestrictionNodeTooltip] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const selectedNode = useMemo(
    () => (selectedNodeId && graphData ? graphData.nodeMap.get(selectedNodeId) : null),
    [selectedNodeId, graphData],
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

  function captureCurrentViewSnapshot() {
    const cy = cyRef.current;
    if (!cy) {
      return null;
    }

    const modeLabel = getCurrentViewLabel(graphProjectionMode, isLightOntologyViewActive);
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
        viewKey: getCurrentViewKey(graphProjectionMode, isLightOntologyViewActive),
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
    const visibleElementsForFit = cy.elements(':visible');
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
    const mixedMode = Number(node.data('mixedMode') ?? 0);
    const tooltipText = String(node.data('classTooltip') ?? '');
    const badgeWidth = Number(node.data('badgeWidth') ?? 0);

    if (mixedMode !== 0 || classCount < 2 || !tooltipText || badgeWidth <= 0) {
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

  const selectedNodeDataProperties = useMemo(
    () => (selectedNodeId && graphData ? graphData.dataProperties.get(selectedNodeId) ?? [] : []),
    [selectedNodeId, graphData],
  );
  const selectedNodeClasses = useMemo(() => {
    if (!selectedNode || !graphData || selectedNode.classes.length === 0) {
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
  const selectedNodeMetadataRows = useMemo(
    () => (selectedNodeId && graphData ? graphData.nodeMetadata.get(selectedNodeId) ?? [] : []),
    [selectedNodeId, graphData],
  );
  const selectedEdgeMetadataRows = useMemo(() => {
    if (!selectedEdgeId || !graphData) {
      return [];
    }

    const baseRows = graphData.edgeMetadata.get(selectedEdgeId) ?? [];
    const edge = selectedEdge ?? graphData.edgeMap.get(selectedEdgeId);
    if (!edge) {
      return baseRows;
    }

    const predicateMetadata = graphData.nodeMetadata.get(edge.predicate) ?? [];
    const predicateRows = predicateMetadata.map((row) => ({
      key: `Predicate ${row.predicateLabel}`,
      value: row.value,
    }));

    return [...baseRows, ...predicateRows];
  }, [selectedEdgeId, graphData, selectedEdge]);

  const neighborRows = useMemo(
    () => buildNeighborRows(selectedNodeId, visibleElements, graphData),
    [selectedNodeId, visibleElements, graphData],
  );

  const allClassIris = useMemo(() => graphData?.classes.map((entry) => entry.id) ?? [], [graphData]);
  const allBaseIris = useMemo(() => graphData?.baseIris.map((entry) => entry.id) ?? [], [graphData]);
  const isOntologyOnlyDataset = Boolean(graphData?.hasOntology) && !graphData?.hasKg;
  const hasOntologyUploads = ontologyFiles.length > 0 || Boolean(graphData?.hasOntology);
  const hasNamedIndividuals = Boolean(
    graphData?.nodes?.some((node) => node.entityCategory === 'individual'),
  );
  const showViewFiltering = hasOntologyUploads;
  const showClassTypeFilter = hasNamedIndividuals && allClassIris.length > 0;
  const isLightOntologyViewActive =
    isLightOntologyView && isOntologyOnlyDataset && graphProjectionMode === GRAPH_PROJECTION_MODES.ONTOLOGY;

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
      wheelSensitivity: 0.2,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            shape: 'round-rectangle',
            'background-color': '#f6f0e8',
            color: '#1e1b16',
            'font-size': 10,
            'font-weight': 600,
            'text-wrap': 'wrap',
            'text-max-width': 'data(textMaxWidth)',
            'text-justification': 'center',
            'text-valign': 'center',
            'border-width': 0.4,
            'border-color': '#7e6f60',
            width: 'data(nodeWidth)',
            height: 'data(nodeHeight)',
            padding: '6px',
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
          selector: 'node[lightOntologyView = 1]',
          style: {
            shape: 'rectangle',
            'background-image': 'none',
            'background-width': 0,
            'background-height': 0,
            'background-repeat': 'no-repeat',
            'bounds-expansion': 6,
            'border-width': 1.25,
            color: '#2a231d',
          },
        },
        {
          selector: 'node[lightOntologyView = 1][entityCategory = "class"]',
          style: {
            'background-color': '#d9c4ab',
            'border-color': '#8d6b4c',
          },
        },
        {
          selector: 'node[lightOntologyView = 1][entityCategory = "object-property"]',
          style: {
            'background-color': '#d4e2f2',
            'border-color': '#5d7fa8',
          },
        },
        {
          selector: 'node[lightOntologyView = 1][entityCategory = "data-property"]',
          style: {
            'background-color': '#d6ebd9',
            'border-color': '#5f9067',
          },
        },
        {
          selector: 'node[lightOntologyView = 1][entityCategory = "annotation-property"]',
          style: {
            'background-color': '#f0d9e4',
            'border-color': '#ab6f8a',
            'border-style': 'solid',
          },
        },
        {
          selector: 'node[lightOntologyView = 1][entityCategory = "individual"]',
          style: {
            'background-color': '#dfdfdf',
            'border-color': '#7f7f7f',
          },
        },
        {
          selector: 'node[lightOntologyView = 1][kind = "literal"]',
          style: {
            'background-color': '#f5ebbe',
            'border-color': '#b9a14f',
          },
        },
        {
          selector: 'node[lightOntologyView = 1][entityCategory = "datatype"]',
          style: {
            'background-color': '#d6ebd9',
            'border-color': '#5f9067',
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
            'background-color': '#ece7e1',
            'border-color': '#c6bbae',
            color: '#6b6157',
            shape: 'hexagon',
          },
        },
        {
          selector: 'edge',
          style: {
            label: 'data(predicateLabel)',
            color: '#5a524a',
            'font-size': 10,
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
            width: 1.4,
            'line-color': '#c8bfb4',
            'target-arrow-color': '#c8bfb4',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            opacity: 0.76,
          },
        },
        {
          selector: 'edge[lightOntologyView = 1]',
          style: {
            width: 1.6,
            'line-color': '#b8afa5',
            'target-arrow-color': '#b8afa5',
            color: '#5a524a',
            'text-max-width': 180,
          },
        },
        {
          selector: 'edge[lightOntologyView = 1][lightRestrictionEdge = 1]',
          style: {
            width: 2,
            'line-color': '#3f8f86',
            'target-arrow-color': '#3f8f86',
            color: '#3d665f',
            'text-background-color': '#f8f5ef',
            'text-border-color': '#d2cbc2',
            'text-max-width': 220,
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
            'border-color': '#1e6b6a',
            'background-color': '#d8eeeb',
            color: '#1e1b16',
          },
        },
        {
          selector: '.focus-neighbor',
          style: {
            'border-width': 3,
            'border-color': '#3a8f86',
          },
        },
        {
          selector: '.focus-edge',
          style: {
            width: 3,
            'line-color': '#3a8f86',
            'target-arrow-color': '#3a8f86',
            opacity: 1,
          },
        },
        {
          selector: '.selected-relation',
          style: {
            width: 3.2,
            'line-color': '#1e6b6a',
            'target-arrow-color': '#1e6b6a',
            'text-background-color': '#f0fff8',
            'text-border-color': '#9fd5cb',
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
      if (suppressNextTapRef.current) {
        suppressNextTapRef.current = false;
        return;
      }
      groupDragArmRef.current = null;
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
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
      if (event.target === cy) {
        clearFocusState();
      }
    });

    cy.on('mousedown', 'node', (event) => {
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
      const dragState = groupDragStateRef.current;
      if (!dragState || event.target.id() !== dragState.grabbedNodeId) {
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
    });

    cy.on('free', 'node', (event) => {
      if (groupDragStateRef.current?.grabbedNodeId === event.target.id()) {
        groupDragStateRef.current = null;
      }

      const cache = layoutPositionCacheRef.current;
      const releasedNode = event.target;
      cache.set(releasedNode.id(), {
        x: releasedNode.position('x'),
        y: releasedNode.position('y'),
      });
    });

    const updateNodeHoverTooltips = (event) => {
      setMultiClassBadgeTooltip(buildClassBadgeTooltipPayload(event));
      setRestrictionNodeTooltip(buildRestrictionTooltipPayload(event));
    };

    cy.on('mouseover', 'node', updateNodeHoverTooltips);
    cy.on('mousemove', 'node', updateNodeHoverTooltips);
    cy.on('mouseout', 'node', () => {
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
    });
    cy.on('pan zoom', () => {
      setMultiClassBadgeTooltip(null);
      setRestrictionNodeTooltip(null);
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

    container.addEventListener('mousedown', onMouseDownCapture, true);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
    container.addEventListener('contextmenu', onContextMenu);

    cyRef.current = cy;

    return () => {
      container.removeEventListener('mousedown', onMouseDownCapture, true);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('contextmenu', onContextMenu);
      groupDragStateRef.current = null;
      groupDragArmRef.current = null;
      shouldFitAfterFocusClearRef.current = false;
      layoutPositionCacheRef.current.clear();
      detachedPanModeRef.current = false;
      detachedPanLastMouseRef.current = null;
      suppressNextTapRef.current = false;
      cyRef.current = null;
      cy.destroy();
    };
  }, []);

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
    layoutPositionCacheRef.current.clear();
  }, [graphData]);

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
      return;
    }

    const positionCache = layoutPositionCacheRef.current;
    const previousPan = cy.pan();
    const previousViewport = {
      zoom: cy.zoom(),
      pan: { x: previousPan.x, y: previousPan.y },
    };
    cy.nodes().forEach((node) => {
      positionCache.set(node.id(), {
        x: node.position('x'),
        y: node.position('y'),
      });
    });
    const isInitialLayout = !hasAppliedInitialLayoutRef.current;

    cy.batch(() => {
      cy.elements().remove();
      if (visibleElements.length > 0) {
        cy.add(visibleElements);
      }
    });

    if (visibleElements.length === 0) {
      return;
    }

    if (isInitialLayout) {
      cy.layout({
        name: 'cose',
        animate: false,
        fit: true,
        padding: 42,
        idealEdgeLength: 110,
        edgeElasticity: 80,
        nodeRepulsion: 20000,
      }).run();
      if (isLightOntologyViewActive) {
        nudgeNodesTowardLandscape(cy, 1.5);
      }
      cy.nodes().forEach((node) => {
        positionCache.set(node.id(), {
          x: node.position('x'),
          y: node.position('y'),
        });
      });
      hasAppliedInitialLayoutRef.current = true;
      return;
    }

    const nodes = cy.nodes();
    let hasUnpositionedNodes = false;
    cy.batch(() => {
      nodes.forEach((node) => {
        const position = positionCache.get(node.id());
        if (position) {
          node.position(position);
        } else {
          hasUnpositionedNodes = true;
        }
      });
    });

    if (hasUnpositionedNodes) {
      const lockedNodes = nodes.filter((node) => positionCache.has(node.id()));
      lockedNodes.lock();
      cy.layout({
        name: 'cose',
        animate: false,
        fit: false,
        randomize: false,
        idealEdgeLength: 110,
        edgeElasticity: 80,
        nodeRepulsion: 20000,
      }).run();
      lockedNodes.unlock();
    }

    if (isLightOntologyViewActive) {
      nudgeNodesTowardLandscape(cy, 1.5);
    }

    cy.nodes().forEach((node) => {
      positionCache.set(node.id(), {
        x: node.position('x'),
        y: node.position('y'),
      });
    });

    cy.zoom(previousViewport.zoom);
    cy.pan(previousViewport.pan);
  }, [visibleElements, isLightOntologyViewActive]);

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
      return;
    }

    const edge = cy.$id(selectedEdgeId);
    if (!edge.empty()) {
      edge.addClass('selected-relation');
    }
  }, [selectedEdgeId, visibleElements]);

  useEffect(() => {
    if (!graphData) {
      setVisibleElements([]);
      return;
    }

    let cancelled = false;

    const applyFilters = async () => {
      setIsFiltering(true);
      setFilterError('');

      try {
        const viewOptions = toViewOptions(graphProjectionMode, ontologyViewMode, graphData, isLightOntologyViewActive);
        const classFilterActive =
          showClassTypeFilter &&
          graphData.classes.length > 0 &&
          selectedClassIris.length !== graphData.classes.length;
        const baseIriFilterActive =
          graphData.baseIris.length > 0 && selectedBaseIris.length !== graphData.baseIris.length;
        const nodeNameFilterActive = nodeNameQuery.trim().length > 0;
        const sparqlActive = sparqlQuery.trim().length > 0;

        if (!classFilterActive && !baseIriFilterActive && !nodeNameFilterActive && !sparqlActive) {
          if (!cancelled) {
            setVisibleElements(buildFocusedSubset(graphData, null, viewOptions));
          }
          return;
        }

        const engine = queryEngineRef.current;
        let selectedEntities = null;

        if (baseIriFilterActive) {
          selectedEntities = runBaseIriFilter(graphData, selectedBaseIris);
        }

        if (classFilterActive) {
          const classMatches = expandClassFilterMatches(
            graphData,
            runClassFilter(graphData, selectedClassIris),
          );
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, classMatches) : classMatches;
        }

        if (nodeNameFilterActive) {
          const nameMatches = runNodeNameFilter(graphData, nodeNameQuery);
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, nameMatches) : nameMatches;
        }

        if (sparqlActive) {
          const sparqlResult = await runSparqlFilter(engine, graphData.store, sparqlQuery);
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, sparqlResult) : sparqlResult;
        }

        if (!cancelled) {
          setVisibleElements(buildFocusedSubset(graphData, selectedEntities, viewOptions));
        }
      } catch (error) {
        if (!cancelled) {
          setFilterError(error.message || 'SPARQL filter failed.');
          setVisibleElements(
            buildFocusedSubset(graphData, null, toViewOptions(graphProjectionMode, ontologyViewMode, graphData, isLightOntologyViewActive)),
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
    selectedClassIris,
    selectedBaseIris,
    nodeNameQuery,
    sparqlQuery,
    graphProjectionMode,
    ontologyViewMode,
    isOntologyOnlyDataset,
    isLightOntologyViewActive,
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

  function clearLoadedGraph() {
    setKgFiles([]);
    setOntologyFiles([]);
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
    setOntologyViewMode(ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT);
    setIsLightOntologyView(false);
    setIsExportMenuOpen(false);
    setOntologyMetadataRows([]);
    setLoadError('');
    setFilterError('');
    setStatus(DEFAULT_STATUS);
  }

  function handleKgFileSelection(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    if (kgFiles.length === 0 && ontologyFiles.length === 0) {
      setGraphProjectionMode(GRAPH_PROJECTION_MODES.KG);
    }

    setKgFiles((current) => mergeSelectedFiles(current, files));
  }

  function handleOntologyFileSelection(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    if (kgFiles.length === 0 && ontologyFiles.length === 0) {
      setGraphProjectionMode(GRAPH_PROJECTION_MODES.ONTOLOGY);
    }

    setOntologyFiles((current) => mergeSelectedFiles(current, files));
  }

  useEffect(() => {
    if (kgFiles.length === 0 && ontologyFiles.length === 0) {
      setGraphData(null);
      setVisibleElements([]);
      setSelectedClassIris([]);
      setSelectedBaseIris([]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setFocusedNodeId(null);
      setFocusedNodeIds([]);
      setOntologyMetadataRows([]);
      setIsLightOntologyView(false);
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

      try {
        const kgQuadGroups = await Promise.all(
          kgFiles.map(async (file) => {
            const text = await file.text();
            return parseRdfText(text, file.name);
          }),
        );
        const ontologyParsedFiles = await Promise.all(
          ontologyFiles.map(async (file) => {
            const text = await file.text();
            const quads = await parseRdfText(text, file.name);
            const { headerQuads, contentQuads } = partitionOntologyHeaderQuads(quads);
            const model = extractOntologyModel(contentQuads);
            const hasSchema = modelHasOntologySchema(model);
            return { fileName: file.name, headerQuads, contentQuads, hasSchema };
          }),
        );

        if (cancelled) {
          return;
        }

        const kgQuads = kgQuadGroups.flat();
        const schemaOntologyQuads = [];
        const instanceOntologyQuads = [];
        let schemaOntologyFileCount = 0;
        let instanceOntologyFileCount = 0;
        const metadataRows = [];

        for (const parsed of ontologyParsedFiles) {
          parsed.headerQuads.forEach((quad, index) => {
            metadataRows.push({
              id: `${parsed.fileName}-${index}-${getTermId(quad.subject)}-${getTermId(quad.object)}`,
              fileName: parsed.fileName,
              subject: formatTermForInspector(quad.subject),
              predicate: formatTermForInspector(quad.predicate),
              value: formatTermForInspector(quad.object),
            });
          });

          if (parsed.hasSchema) {
            schemaOntologyQuads.push(...parsed.contentQuads);
            schemaOntologyFileCount += 1;
          } else {
            instanceOntologyQuads.push(...parsed.contentQuads);
            instanceOntologyFileCount += 1;
          }
        }

        const effectiveKgQuads = [...kgQuads, ...instanceOntologyQuads];
        const mergedQuads = [...effectiveKgQuads, ...schemaOntologyQuads];
        const ontologyModel = extractOntologyModel(schemaOntologyQuads);
        const hasOntology = modelHasOntologySchema(ontologyModel) && schemaOntologyQuads.length > 0;
        const hasKg = effectiveKgQuads.length > 0;
        const nextGraphData = buildGraphData(mergedQuads, {
          hasKg,
          hasOntology,
          ontologyModel,
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
        setNodeNameQuery('');
        setSparqlDraft('');
        setSparqlQuery('');
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setFocusedNodeId(null);
        setFocusedNodeIds([]);
        setOntologyMetadataRows([...metadataRows, ...derivedPrefixRows]);

        setStatus(
          `Loaded ${nextGraphData.nodes.length} nodes and ${nextGraphData.edges.length} edges from ${
            kgFiles.length + instanceOntologyFileCount
          } KG file${kgFiles.length + instanceOntologyFileCount === 1 ? '' : 's'}${
            schemaOntologyFileCount > 0
              ? ` + ${schemaOntologyFileCount} ontology file${schemaOntologyFileCount === 1 ? '' : 's'}`
              : ''
          }`,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
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
  }, [kgFiles, ontologyFiles]);

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

  useEffect(() => {
    if (!isLightOntologyView) {
      return;
    }
    if (!isOntologyOnlyDataset || graphProjectionMode !== GRAPH_PROJECTION_MODES.ONTOLOGY) {
      setIsLightOntologyView(false);
    }
  }, [isLightOntologyView, isOntologyOnlyDataset, graphProjectionMode]);

  const showLeftPanelContent = isGraphFullscreen ? leftFlyoutOpen : !leftCollapsed;
  const showRightPanelContent = isGraphFullscreen ? rightFlyoutOpen : !rightCollapsed;

  const appShellStyle = {
    '--left-panel-open-width': `${leftPanelWidth}px`,
    '--right-panel-open-width': `${rightPanelWidth}px`,
    '--left-panel-width': isGraphFullscreen ? '0px' : leftCollapsed ? '0px' : `${leftPanelWidth}px`,
    '--right-panel-width': isGraphFullscreen ? '0px' : rightCollapsed ? '0px' : `${rightPanelWidth}px`,
    '--left-gap': isGraphFullscreen ? '0px' : leftCollapsed ? '0px' : '18px',
    '--right-gap': isGraphFullscreen ? '0px' : rightCollapsed ? '0px' : '18px',
  };
  const fullscreenButtonLabel = isGraphFullscreen ? 'Exit full screen (Esc)' : 'Enter full screen';
  const legendButtonLabel = isLegendOpen ? 'Hide graph legend' : 'Show graph legend';
  const lightOntologyButtonLabel = isLightOntologyViewActive ? 'Exit light ontology view' : 'Enter light ontology view';
  const exportButtonLabel = isExportMenuOpen ? 'Hide export options' : 'Show export options';
  const showLightOntologyLegend = isLightOntologyViewActive;
  const hasExportableGraph = visibleElements.length > 0;

  return (
    <div
      className={`page-shell ${isGraphFullscreen ? 'fullscreen-mode' : ''} ${isPanelResizing ? 'resizing' : ''} ${
        isDetachedPanMode ? 'detached-pan' : ''
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
        </div>
      </header>

      <div className={`app-shell ${isGraphFullscreen ? 'fullscreen' : ''}`} style={appShellStyle}>
        <aside
          className={`panel left ${!isGraphFullscreen && leftCollapsed ? 'collapsed' : ''} ${
            isGraphFullscreen ? 'floating' : ''
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
                  <h2>Source File</h2>
                  <button
                    type="button"
                    className="section-clear"
                    onClick={clearLoadedGraph}
                    disabled={kgFiles.length === 0 && ontologyFiles.length === 0}
                    aria-label="Clear all uploaded files and graph"
                    title="Clear graph"
                  >
                    Clear
                  </button>
                </div>

                {leftSectionOpen.source && (
                  <div className="section-body">
                    <label className="file-control">
                      <span>KG files (optional: .ttl/.rdf/.n3/.nt/.nq/.trig)</span>
                      <input
                        type="file"
                        accept=".ttl,.rdf,.n3,.nt,.nq,.trig"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          handleKgFileSelection(files);
                          event.target.value = '';
                        }}
                      />
                      <small>{formatSelectedFiles(kgFiles, 'No KG files selected')}</small>
                    </label>

                    <label className="file-control">
                      <span>Ontology files (optional: .owl/.rdf/.ttl)</span>
                      <input
                        type="file"
                        accept=".ttl,.owl,.rdf,.n3,.nt,.nq,.trig"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          handleOntologyFileSelection(files);
                          event.target.value = '';
                        }}
                      />
                      <small>{formatSelectedFiles(ontologyFiles, 'No ontology files selected')}</small>
                    </label>
                    <small className="muted">{isLoading ? 'Parsing and merging graph...' : 'Graph updates automatically when files are added.'}</small>
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
                    <p className="muted">
                      Active view:{' '}
                      {graphProjectionMode === GRAPH_PROJECTION_MODES.ONTOLOGY
                        ? isLightOntologyViewActive
                          ? 'Ontology light view'
                          : 'Ontology full detailed view'
                        : 'KG view'}
                    </p>

                    {showViewFiltering && (
                      <>
                        <h3 className="filter-group-title">View filtering</h3>
                        <div className="option-list">
                          <label className="option-item">
                            <input
                              type="radio"
                              name="ontology-view-mode"
                              checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.CLASS_ONLY}
                              onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.CLASS_ONLY)}
                            />
                            <span>Class hierarchy</span>
                          </label>

                          <label className="option-item">
                            <input
                              type="radio"
                              name="ontology-view-mode"
                              checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT}
                              onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT)}
                            />
                            <span>Classes with object properties</span>
                          </label>

                          <label className="option-item">
                            <input
                              type="radio"
                              name="ontology-view-mode"
                              checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.CLASS_OBJECT_DATA}
                              onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.CLASS_OBJECT_DATA)}
                            />
                            <span>Classes + object properties + data properties</span>
                          </label>

                          <label className="option-item">
                            <input
                              type="radio"
                              name="ontology-view-mode"
                              checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.FULL}
                              onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.FULL)}
                            />
                            <span>All</span>
                          </label>
                        </div>
                      </>
                    )}
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

                    <h3 className="filter-group-title">Base IRI (ontology)</h3>
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
                      {!graphData && <p className="muted">Load data to list ontology IRIs.</p>}
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
          className="graph-area"
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
            <div
              className={`projection-toggle theme-switch ${
                graphProjectionMode === GRAPH_PROJECTION_MODES.KG ? 'mode-kg' : 'mode-ontology'
              }`}
              role="tablist"
              aria-label="Graph projection mode"
            >
              <span className="projection-switch-thumb" aria-hidden="true" />
              <button
                type="button"
                className={`projection-toggle-button ${
                  graphProjectionMode === GRAPH_PROJECTION_MODES.ONTOLOGY ? 'active' : ''
                }`}
                onClick={() => setGraphProjectionMode(GRAPH_PROJECTION_MODES.ONTOLOGY)}
                aria-pressed={graphProjectionMode === GRAPH_PROJECTION_MODES.ONTOLOGY}
                aria-label={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.ONTOLOGY]}
                title={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.ONTOLOGY]}
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
                className={`projection-toggle-button ${
                  graphProjectionMode === GRAPH_PROJECTION_MODES.KG ? 'active' : ''
                }`}
                onClick={() => setGraphProjectionMode(GRAPH_PROJECTION_MODES.KG)}
                aria-pressed={graphProjectionMode === GRAPH_PROJECTION_MODES.KG}
                aria-label={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.KG]}
                title={PROJECTION_MODE_LABELS[GRAPH_PROJECTION_MODES.KG]}
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
          </div>

          <div className="graph-tools graph-tools-right">
            {isOntologyOnlyDataset && (
              <button
                type="button"
                className={`graph-tool-button icon-only ${isLightOntologyViewActive ? 'active' : ''}`}
                onClick={() => {
                  const next = !isLightOntologyViewActive;
                  setIsLightOntologyView(next);
                  if (next) {
                    setGraphProjectionMode(GRAPH_PROJECTION_MODES.ONTOLOGY);
                  }
                }}
                aria-label={lightOntologyButtonLabel}
                title={lightOntologyButtonLabel}
                aria-pressed={isLightOntologyViewActive}
              >
                <svg className="graph-tool-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2.4" y="3.4" width="11.2" height="8.2" rx="1.1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4.2 12.8H11.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M5.2 6.2H10.8M5.2 8.6H8.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            )}

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
                    <button type="button" className="graph-export-action" onClick={() => handleExport('csv')}>
                      CSV
                    </button>
                    <button type="button" className="graph-export-action" onClick={() => handleExport('ttl')}>
                      TTL
                    </button>
                    <button type="button" className="graph-export-action" onClick={() => handleExport('png')}>
                      PNG
                    </button>
                    <button type="button" className="graph-export-action" onClick={() => handleExport('html')}>
                      HTML
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isLegendOpen && (
              <div className="graph-legend-popover" role="dialog" aria-label="Graph legend">
                <div className="graph-legend-title">{showLightOntologyLegend ? 'Light Ontology Legend' : 'Legend'}</div>
                <div className="graph-legend-list">
                  {showLightOntologyLegend ? (
                    <>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-light-class" />
                        <span>Class</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-light-object-property" />
                        <span>Object property</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-light-data-property" />
                        <span>Data property</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-light-annotation-property" />
                        <span>Annotation property</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-light-individual" />
                        <span>Named individual</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-light-literal" />
                        <span>Literal value</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-light-datatype" />
                        <span>Datatype</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-edge-marker marker-light-edge" />
                        <span>Labeled relation edge</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-edge-marker marker-light-restriction-edge" />
                        <span>Restriction bridge edge</span>
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
                        <span className="graph-legend-marker marker-object-property" />
                        <span>Object property</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-data-property" />
                        <span>Data property</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-annotation-property" />
                        <span>Annotation property</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-marker marker-class-expression" />
                        <span>Restriction or class expression (hover for details)</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-edge-marker" />
                        <span>Labeled relation edge</span>
                      </div>
                    </>
                  )}
                </div>
                {showLightOntologyLegend && (
                  <p className="graph-legend-note">Restriction nodes are collapsed and shown as labeled bridge edges.</p>
                )}
              </div>
            )}
          </div>

          <div ref={graphContainerRef} className={`graph-canvas ${isDetachedPanMode ? 'detached-pan-mode' : ''}`} />

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
          className={`panel right ${!isGraphFullscreen && rightCollapsed ? 'collapsed' : ''} ${
            isGraphFullscreen ? 'floating' : ''
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
                    <h4>Ontology metadata ({ontologyMetadataRows.length})</h4>
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

                    <dl className="entity-meta">
                      <dt>Type</dt>
                      <dd>{selectedNode.termType}</dd>

                      <dt>Category</dt>
                      <dd>{selectedNode.entityCategory || selectedNode.ontologyKind || selectedNode.kind}</dd>

                      <dt>ID</dt>
                      <dd>
                        <div className="copy-row">
                          <textarea className="copy-field mono" rows={3} readOnly value={selectedNode.id} />
                          <button
                            type="button"
                            className="copy-action"
                            onClick={() => navigator.clipboard?.writeText(selectedNode.id)}
                          >
                            Copy
                          </button>
                        </div>
                      </dd>

                      {selectedNodeBaseOntology && (
                        <>
                          <dt>Base ontology</dt>
                          <dd className="breakable base-ontology-row">
                            <span className="prefix-chip mono">{selectedNodeBaseOntology.prefix}</span>
                            <span>{selectedNodeBaseOntology.iri}</span>
                          </dd>
                        </>
                      )}

                      {selectedNodeClasses.length > 0 && (
                        <>
                          <dt>Classes</dt>
                          <dd>
                            <ol className="class-chain">
                              {selectedNodeClasses.map((entry) => (
                                <li key={entry.iri} title={entry.iri}>
                                  {entry.prefixed}
                                </li>
                              ))}
                            </ol>
                          </dd>
                        </>
                      )}
                    </dl>

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
                      {neighborRows.length === 0 && <p className="muted">No visible edges for this node.</p>}
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
