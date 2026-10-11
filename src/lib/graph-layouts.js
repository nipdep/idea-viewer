import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import elk from 'cytoscape-elk';

export const GRAPH_LAYOUT_TYPES = Object.freeze({
  SPREAD: 'spread',
  HIERARCHY: 'hierarchy',
});

const HIERARCHY_PREDICATES = new Set([
  'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
]);

export const GRAPH_LAYOUT_LABELS = Object.freeze({
  [GRAPH_LAYOUT_TYPES.SPREAD]: 'Spread layout (force-directed)',
  [GRAPH_LAYOUT_TYPES.HIERARCHY]: 'Hierarchy layout (layered)',
});

let registered = false;
function registerLayouts() {
  if (registered) {
    return;
  }
  cytoscape.use(fcose);
  cytoscape.use(elk);
  registered = true;
}

const LARGE_GRAPH_NODE_COUNT = 400;

function spreadOptions(nodeCount) {
  return {
    name: 'fcose',
    // 'draft' skips the expensive final refinement pass, which matters on large graphs.
    quality: nodeCount > LARGE_GRAPH_NODE_COUNT ? 'draft' : 'default',
    randomize: true,
    animate: false,
    fit: false,
    nodeDimensionsIncludeLabels: true,
    uniformNodeDimensions: false,
    packComponents: true,
    tile: true,
    idealEdgeLength: 140,
    nodeRepulsion: 12000,
    edgeElasticity: 0.35,
    nodeSeparation: 90,
    gravity: 0.25,
    numIter: nodeCount > LARGE_GRAPH_NODE_COUNT ? 1500 : 2500,
  };
}

function hierarchyOptions() {
  return {
    name: 'elk',
    animate: false,
    fit: false,
    nodeDimensionsIncludeLabels: true,
    elk: {
      algorithm: 'layered',
      // Edges point child -> parent (rdfs:subClassOf), so flow upwards to put parents on top.
      'elk.direction': 'UP',
      'elk.spacing.nodeNode': 48,
      'elk.layered.spacing.nodeNodeBetweenLayers': 110,
      'elk.spacing.componentComponent': 80,
      'elk.separateConnectedComponents': true,
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.cycleBreaking.strategy': 'GREEDY',
      'elk.edgeRouting': 'POLYLINE',
    },
  };
}

/**
 * Lays out `nodes`/`edges` in place. Resolves once all node positions are final.
 */
export function runGraphLayout(cy, { type, nodes, edges }) {
  registerLayouts();
  const isHierarchy = type === GRAPH_LAYOUT_TYPES.HIERARCHY;
  // Layering is driven by the taxonomy edges only; other relations are still drawn but do not rank nodes.
  const layoutEdges = isHierarchy
    ? edges.filter((edge) => HIERARCHY_PREDICATES.has(edge.data('predicate')))
    : edges;
  const elements = nodes.union(layoutEdges);
  const options = isHierarchy ? hierarchyOptions() : spreadOptions(nodes.length);

  return new Promise((resolve, reject) => {
    try {
      const layout = elements.layout(options);
      layout.one('layoutstop', () => resolve());
      layout.run();
    } catch (error) {
      reject(error);
    }
  });
}
