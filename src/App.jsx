import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { QueryEngine } from '@comunica/query-sparql';
import { buildFocusedSubset, buildGraphData, compactIri, extractOntologyModel, getTermId, parseRdfText } from './lib/rdf';
import './styles.css';

const RDF_TYPE_IRI = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_ONTOLOGY_IRI = 'http://www.w3.org/2002/07/owl#Ontology';
const KNOWN_NAMESPACE_PREFIXES = {
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf',
  'http://www.w3.org/2000/01/rdf-schema#': 'rdfs',
  'http://www.w3.org/2002/07/owl#': 'owl',
  'http://www.w3.org/2001/XMLSchema#': 'xsd',
  'http://www.w3.org/ns/prov#': 'prov',
  'http://www.w3.org/2004/02/skos/core#': 'skos',
};

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

async function runClassFilter(engine, store, classIris) {
  if (classIris.length === 0) {
    return new Set();
  }

  const values = classIris.map((classIri) => `<${classIri}>`).join(' ');
  const query = `
    SELECT DISTINCT ?entity
    WHERE {
      VALUES ?class { ${values} }
      ?entity a ?class .
    }
  `;

  const bindingsStream = await engine.queryBindings(query, { sources: [store] });
  return collectEntityIds(bindingsStream);
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

const ONTOLOGY_VIEW_MODES = {
  CLASS_ONLY: 'class-only',
  CLASS_AND_OBJECT: 'class-and-object',
  CLASS_OBJECT_DATA: 'class-object-data',
  FULL: 'full',
};

function toViewOptions(mode) {
  switch (mode) {
    case ONTOLOGY_VIEW_MODES.CLASS_ONLY:
      return {
        showDataProperties: false,
        showAnnotationProperties: false,
        showObjectProperties: false,
        showNamedIndividuals: false,
      };
    case ONTOLOGY_VIEW_MODES.CLASS_OBJECT_DATA:
      return {
        showDataProperties: true,
        showAnnotationProperties: false,
        showObjectProperties: true,
        showNamedIndividuals: false,
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
        showNamedIndividuals: false,
      };
  }
}

function modelHasOntologySchema(model) {
  if (!model) {
    return false;
  }

  return (
    (model.classIds?.size ?? 0) > 0 ||
    (model.objectPropertyIds?.size ?? 0) > 0 ||
    (model.dataPropertyIds?.size ?? 0) > 0 ||
    (model.annotationPropertyIds?.size ?? 0) > 0
  );
}

export default function App() {
  const graphContainerRef = useRef(null);
  const cyRef = useRef(null);
  const previousFocusedNodeIdRef = useRef(null);
  const queryEngineRef = useRef(new QueryEngine());
  const leftFlyoutTimerRef = useRef(null);
  const rightFlyoutTimerRef = useRef(null);

  const [kgFiles, setKgFiles] = useState([]);
  const [ontologyFiles, setOntologyFiles] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [visibleElements, setVisibleElements] = useState([]);

  const [selectedClassIris, setSelectedClassIris] = useState([]);
  const [selectedBaseIris, setSelectedBaseIris] = useState([]);
  const [sparqlDraft, setSparqlDraft] = useState('');
  const [sparqlQuery, setSparqlQuery] = useState('');
  const [ontologyViewMode, setOntologyViewMode] = useState(ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [focusedNodeId, setFocusedNodeId] = useState(null);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftSectionOpen, setLeftSectionOpen] = useState({
    source: true,
    filters: true,
    sparql: true,
  });
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [leftFlyoutOpen, setLeftFlyoutOpen] = useState(false);
  const [rightFlyoutOpen, setRightFlyoutOpen] = useState(false);

  const [status, setStatus] = useState('Upload KG and/or ontology files to initialize the graph.');
  const [loadError, setLoadError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [ontologyMetadataRows, setOntologyMetadataRows] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const selectedNode = useMemo(
    () => (selectedNodeId && graphData ? graphData.nodeMap.get(selectedNodeId) : null),
    [selectedNodeId, graphData],
  );

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

  const neighborRows = useMemo(
    () => buildNeighborRows(selectedNodeId, visibleElements, graphData),
    [selectedNodeId, visibleElements, graphData],
  );

  const allClassIris = useMemo(() => graphData?.classes.map((entry) => entry.id) ?? [], [graphData]);
  const allBaseIris = useMemo(() => graphData?.baseIris.map((entry) => entry.id) ?? [], [graphData]);

  const isAllClassesSelected =
    allClassIris.length === 0 ||
    (selectedClassIris.length === allClassIris.length && allClassIris.every((iri) => selectedClassIris.includes(iri)));
  const isAllBaseIrisSelected =
    allBaseIris.length === 0 ||
    (selectedBaseIris.length === allBaseIris.length && allBaseIris.every((iri) => selectedBaseIris.includes(iri)));

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
          selector: 'node[hasClass > 0]',
          style: {
            'background-image': 'data(badgeSvg)',
            'background-image-opacity': 1,
            'background-image-containment': 'over',
            'background-width': 'data(badgeWidth)',
            'background-height': 24,
            'background-position-x': '100%',
            'background-position-y': '0%',
            'background-offset-x': 26,
            'background-offset-y': -14,
            'background-repeat': 'no-repeat',
            'background-fit': 'none',
            'background-clip': 'none',
            'bounds-expansion': 36,
          },
        },
        {
          selector: 'node[ontologyKind = "class"]',
          style: {
            shape: 'ellipse',
          },
        },
        {
          selector: 'node[ontologyKind = "individual"]',
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
          selector: 'node[ontologyKind = "data-property"]',
          style: {
            shape: 'diamond',
            'background-color': '#f0e7db',
            'border-color': '#9b7f66',
            color: '#1e1b16',
          },
        },
        {
          selector: 'node[ontologyKind = "object-property"]',
          style: {
            shape: 'hexagon',
            'background-color': '#efe4d7',
            'border-color': '#9f7a57',
            color: '#1e1b16',
          },
        },
        {
          selector: 'node[ontologyKind = "annotation-property"]',
          style: {
            shape: 'round-rectangle',
            'background-color': '#efe6dd',
            'border-color': '#9e846b',
            'border-style': 'dashed',
            color: '#1e1b16',
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
      ],
      layout: {
        name: 'cose',
        animate: false,
        fit: true,
        padding: 28,
      },
    });

    cy.on('tap', 'node', (event) => {
      const nodeId = event.target.id();
      setSelectedNodeId(nodeId);
      setFocusedNodeId(nodeId);
    });

    cy.on('tap', (event) => {
      if (event.target === cy) {
        setSelectedNodeId(null);
        setFocusedNodeId(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cyRef.current = null;
      cy.destroy();
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.batch(() => {
      cy.elements().remove();
      if (visibleElements.length > 0) {
        cy.add(visibleElements);
      }
    });

    if (visibleElements.length > 0) {
      cy.layout({
        name: 'cose',
        animate: false,
        fit: true,
        padding: 42,
        idealEdgeLength: 110,
        edgeElasticity: 80,
        nodeRepulsion: 20000,
      }).run();
    }
  }, [visibleElements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const wasFocused = Boolean(previousFocusedNodeIdRef.current);

    cy.batch(() => {
      cy.elements().removeClass('faded focus-node focus-neighbor focus-edge');

      if (!focusedNodeId) {
        return;
      }

      const focusNode = cy.$id(focusedNodeId);
      if (focusNode.empty()) {
        return;
      }

      const neighborhood = focusNode.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass('faded');
      focusNode.addClass('focus-node');
      focusNode.neighborhood('node').addClass('focus-neighbor');
      focusNode.connectedEdges().addClass('focus-edge');
    });

    if (focusedNodeId) {
      const focusNode = cy.$id(focusedNodeId);
      if (!focusNode.empty()) {
        cy.animate({
          fit: {
            eles: focusNode.closedNeighborhood(),
            padding: 76,
          },
          duration: 250,
        });
      }
    } else if (wasFocused) {
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

    previousFocusedNodeIdRef.current = focusedNodeId;
  }, [focusedNodeId, visibleElements]);

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
        const viewOptions = {
          ...toViewOptions(ontologyViewMode),
          showTypeLinks: graphData.hasOntology && graphData.hasKg,
        };
        const classFilterActive =
          graphData.classes.length > 0 && selectedClassIris.length !== graphData.classes.length;
        const baseIriFilterActive =
          graphData.baseIris.length > 0 && selectedBaseIris.length !== graphData.baseIris.length;
        const sparqlActive = sparqlQuery.trim().length > 0;

        if (!classFilterActive && !baseIriFilterActive && !sparqlActive) {
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
          const classMatches = await runClassFilter(engine, graphData.store, selectedClassIris);
          selectedEntities = selectedEntities ? intersectSets(selectedEntities, classMatches) : classMatches;
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
            buildFocusedSubset(graphData, null, {
              ...toViewOptions(ontologyViewMode),
              showTypeLinks: graphData.hasOntology && graphData.hasKg,
            }),
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
    sparqlQuery,
    ontologyViewMode,
  ]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const hasSelectedNode = visibleElements.some((entry) => !entry.data.source && entry.data.id === selectedNodeId);
    if (!hasSelectedNode) {
      setSelectedNodeId(null);
      setFocusedNodeId(null);
    }
  }, [visibleElements, selectedNodeId]);

  async function handleLoadGraph() {
    if (kgFiles.length === 0 && ontologyFiles.length === 0) {
      return;
    }

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

      setGraphData(nextGraphData);
      setSelectedClassIris(nextGraphData.classes.map((entry) => entry.id));
      setSelectedBaseIris(nextGraphData.baseIris.map((entry) => entry.id));
      setSparqlDraft('');
      setSparqlQuery('');
      setSelectedNodeId(null);
      setFocusedNodeId(null);
      setOntologyMetadataRows(metadataRows);

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
      setLoadError(error.message || 'Unable to parse one of the uploaded files.');
      setOntologyMetadataRows([]);
    } finally {
      setIsLoading(false);
    }
  }

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

  function applySparqlFilter() {
    setSparqlQuery(sparqlDraft.trim());
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
    '--left-panel-width': isGraphFullscreen ? '0px' : leftCollapsed ? '0px' : 'var(--left-panel-open-width, 320px)',
    '--right-panel-width':
      isGraphFullscreen ? '0px' : rightCollapsed ? '0px' : 'var(--right-panel-open-width, 350px)',
    '--left-gap': isGraphFullscreen ? '0px' : leftCollapsed ? '0px' : '18px',
    '--right-gap': isGraphFullscreen ? '0px' : rightCollapsed ? '0px' : '18px',
  };
  const fullscreenButtonLabel = isGraphFullscreen ? 'Exit full screen (Esc)' : 'Enter full screen';

  return (
    <div className={`page-shell ${isGraphFullscreen ? 'fullscreen-mode' : ''}`}>
      <header className="app-header">
        <div>
          <h1 className="brand-title">
            IDEA<span className="brand-star">*</span> VIEWER
          </h1>
          <p className="brand-subtitle">Argument discourse visualization in scientific knowledge graphs.</p>
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
            >
              {leftCollapsed ? '>' : '<'}
            </button>
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
                </div>

                {leftSectionOpen.source && (
                  <div className="section-body">
                    <label className="file-control">
                      <span>KG files (optional: .ttl/.n3/.nt/.nq/.trig)</span>
                      <input
                        type="file"
                        accept=".ttl,.n3,.nt,.nq,.trig"
                        multiple
                        onChange={(event) => setKgFiles(Array.from(event.target.files ?? []))}
                      />
                      <small>{formatSelectedFiles(kgFiles, 'No KG files selected')}</small>
                    </label>

                    <label className="file-control">
                      <span>Ontology files (optional: .owl/.rdf/.ttl)</span>
                      <input
                        type="file"
                        accept=".ttl,.owl,.rdf,.n3,.nt,.nq,.trig"
                        multiple
                        onChange={(event) => setOntologyFiles(Array.from(event.target.files ?? []))}
                      />
                      <small>{formatSelectedFiles(ontologyFiles, 'No ontology files selected')}</small>
                    </label>

                    <button
                      type="button"
                      className="primary"
                      disabled={(kgFiles.length === 0 && ontologyFiles.length === 0) || isLoading}
                      onClick={handleLoadGraph}
                    >
                      {isLoading ? 'Parsing...' : 'Build graph'}
                    </button>
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
                    <h3 className="filter-group-title">Ontology view</h3>
                    <div className="option-list">
                      <label className="option-item">
                        <input
                          type="radio"
                          name="ontology-view-mode"
                          checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.CLASS_ONLY}
                          onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.CLASS_ONLY)}
                        />
                        <span>Class structure only (`rdfs:subClassOf`)</span>
                      </label>

                      <label className="option-item">
                        <input
                          type="radio"
                          name="ontology-view-mode"
                          checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT}
                          onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.CLASS_AND_OBJECT)}
                        />
                        <span>Classes with object properties (default)</span>
                      </label>

                      <label className="option-item">
                        <input
                          type="radio"
                          name="ontology-view-mode"
                          checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.CLASS_OBJECT_DATA}
                          onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.CLASS_OBJECT_DATA)}
                        />
                        <span>Class structure + object + data properties</span>
                      </label>

                      <label className="option-item">
                        <input
                          type="radio"
                          name="ontology-view-mode"
                          checked={ontologyViewMode === ONTOLOGY_VIEW_MODES.FULL}
                          onChange={() => setOntologyViewMode(ONTOLOGY_VIEW_MODES.FULL)}
                        />
                        <span>Class structure + object + data + annotation properties</span>
                      </label>
                    </div>

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
                    <textarea
                      value={sparqlDraft}
                      onChange={(event) => setSparqlDraft(event.target.value)}
                      placeholder={
                        'SELECT DISTINCT ?entity WHERE { ?entity ?p ?o . FILTER(CONTAINS(LCASE(STR(?o)), "argument")) }'
                      }
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
                    <p className="muted">Return `?entity` (or any node variable) from your query.</p>
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

          <div className="graph-tools">
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
          </div>

          <div ref={graphContainerRef} className="graph-canvas" />

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
            >
              {rightCollapsed ? '<' : '>'}
            </button>
          )}

          {showRightPanelContent && (
            <div className="panel-content">
              <section className="panel-section details-card">
                <h2>Entity Inspector</h2>

                {!selectedNode && ontologyMetadataRows.length === 0 && (
                  <p className="muted">Click a node to inspect properties and neighbors.</p>
                )}

                {!selectedNode && ontologyMetadataRows.length > 0 && (
                  <>
                    <h4>Ontology header metadata ({ontologyMetadataRows.length})</h4>
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

                {selectedNode && (
                  <>
                    <h3 className="entity-title">{selectedNode.fullLabel}</h3>

                    <dl className="entity-meta">
                      <dt>Type</dt>
                      <dd>{selectedNode.termType}</dd>

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

                    <div className="mini-actions">
                      <button type="button" onClick={() => setFocusedNodeId(selectedNode.id)}>
                        Focus here
                      </button>
                      <button type="button" onClick={() => setFocusedNodeId(null)} disabled={!focusedNodeId}>
                        Clear focus
                      </button>
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
                            setSelectedNodeId(row.neighborId);
                            setFocusedNodeId(row.neighborId);
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
    </div>
  );
}
