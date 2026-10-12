import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import elk from 'cytoscape-elk';

export const GRAPH_LAYOUT_TYPES = Object.freeze({
  SPREAD: 'spread',
  HIERARCHY: 'hierarchy',
});

export const HIERARCHY_PREDICATES = new Set([
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

// Dev-only knob so layout variants can be compared with the benchmark without rebuilding.
function layoutOverrides() {
  return (import.meta.env.DEV && typeof window !== 'undefined' && window.__ideaViewerLayoutOverrides) || {};
}

// fcose is synchronous and draws its initial positions from Math.random, so seeding it for the
// duration of the run makes the same graph always lay out the same way.
function withSeededRandom(run) {
  const original = Math.random;
  let state = 0x9e3779b9;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    run();
  } finally {
    Math.random = original;
  }
}

// Dense graphs need stronger repulsion and softer edges to stop nodes piling up (benchmark: Wine RDF
// went from 59% to ~4% overlapping nodes), but sparse graphs look better kept tight. Blend by size.
function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function spreadOptions(nodeCount, averageNodeSize) {
  const density = Math.min(1, Math.max(0, (nodeCount - 80) / 420));
  // Few but large nodes (e.g. collapsed clusters) need spacing relative to their size, not their count.
  const sizeScale = Math.max(1, averageNodeSize / 100);
  return {
    name: 'fcose',
    quality: layoutOverrides().spreadQuality ?? 'default',
    randomize: true,
    animate: false,
    fit: false,
    nodeDimensionsIncludeLabels: true,
    uniformNodeDimensions: false,
    packComponents: true,
    tile: true,
    idealEdgeLength: lerp(180, 240, density) * sizeScale,
    nodeRepulsion: lerp(18000, 36000, density) * sizeScale * sizeScale,
    edgeElasticity: lerp(0.35, 0.1, density),
    nodeSeparation: 90,
    gravity: 0.25,
    numIter: 2500,
    ...layoutOverrides().spread,
  };
}

// Interactive strategies take layers, ordering and cycle breaking from the nodes' current positions,
// so expanding or collapsing a node inserts nodes without reshuffling the rest of the layout.
const INCREMENTAL_ELK_OPTIONS = {
  'elk.layered.layering.strategy': 'INTERACTIVE',
  'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
  'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
};

function hierarchyOptions(incremental) {
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
      ...(incremental && layoutOverrides().incremental !== false ? INCREMENTAL_ELK_OPTIONS : {}),
      ...layoutOverrides().elk,
    },
  };
}

// Layout units, not screen pixels: at the default zoom (~0.6) these are roughly 50 x 36 px on screen,
// enough to keep a short edge label readable between two neighbours.
const NODE_GAP_X = 84;
const NODE_GAP_Y = 60;
const MAX_SEPARATION_PASSES = 80;

/**
 * Pushes overlapping nodes apart until every pair has at least NODE_GAP_X / NODE_GAP_Y of clear space
 * (force layouts only treat node size approximately, which left boxes touching). Deterministic: nodes are
 * visited in id order and each pair is pushed apart along the axis it overlaps least. Pinned nodes stay put.
 */
export function separateOverlaps(nodes, pinnedIds = new Set()) {
  const items = nodes
    .filter((node) => !node.isParent())
    .map((node) => ({
      node,
      id: node.id(),
      pinned: pinnedIds.has(node.id()),
      x: node.position('x'),
      y: node.position('y'),
      halfW: node.width() / 2 + NODE_GAP_X / 2,
      halfH: node.height() / 2 + NODE_GAP_Y / 2,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (items.length < 2) {
    return;
  }
  const cell = Math.max(...items.map((item) => Math.max(item.halfW, item.halfH))) * 2;

  for (let pass = 0; pass < MAX_SEPARATION_PASSES; pass += 1) {
    const grid = new Map();
    items.forEach((item, index) => {
      const key = `${Math.floor(item.x / cell)},${Math.floor(item.y / cell)}`;
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key).push(index);
    });
    const shiftX = new Float64Array(items.length);
    const shiftY = new Float64Array(items.length);
    let moved = false;

    items.forEach((a, i) => {
      const cx = Math.floor(a.x / cell);
      const cy = Math.floor(a.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
        for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
          (grid.get(`${gx},${gy}`) ?? []).forEach((j) => {
            if (j <= i) {
              return;
            }
            const b = items[j];
            const overlapX = a.halfW + b.halfW - Math.abs(a.x - b.x);
            const overlapY = a.halfH + b.halfH - Math.abs(a.y - b.y);
            if (overlapX <= 0 || overlapY <= 0 || (a.pinned && b.pinned)) {
              return;
            }
            moved = true;
            const shareA = a.pinned ? 0 : b.pinned ? 1 : 0.5;
            const shareB = 1 - shareA;
            // equal positions have no direction: separate sideways, ordered by id
            if (overlapX < overlapY) {
              const direction = a.x === b.x ? -1 : Math.sign(a.x - b.x);
              shiftX[i] += direction * overlapX * shareA;
              shiftX[j] -= direction * overlapX * shareB;
            } else {
              const direction = a.y === b.y ? -1 : Math.sign(a.y - b.y);
              shiftY[i] += direction * overlapY * shareA;
              shiftY[j] -= direction * overlapY * shareB;
            }
          });
        }
      }
    });

    if (!moved) {
      break;
    }
    items.forEach((item, index) => {
      item.x += shiftX[index];
      item.y += shiftY[index];
    });
  }

  items.forEach((item) => {
    if (!item.pinned) {
      item.node.position({ x: item.x, y: item.y });
    }
  });
}

// Isolated nodes carry no structure, but force/layered layouts spend most of their time on them
// (CSO: 14,950 isolated of 15,012 nodes took 68 s). Above this count they are gridded instead.
const ISOLATED_GRID_THRESHOLD = 40;
const GRID_GAP = 28;
const GRID_MARGIN_TOP = 140;

function placeInGrid(nodes, origin) {
  const count = nodes.length;
  if (count === 0) {
    return;
  }
  const cellWidth = Math.max(...nodes.map((node) => node.width())) + GRID_GAP;
  const cellHeight = Math.max(...nodes.map((node) => node.height())) + GRID_GAP;
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)));
  nodes.forEach((node, index) => {
    node.position({
      x: origin.x + (index % columns) * cellWidth + cellWidth / 2,
      y: origin.y + Math.floor(index / columns) * cellHeight + cellHeight / 2,
    });
  });
}

function splitIsolated(nodes, edges) {
  const connectedIds = new Set();
  edges.forEach((edge) => {
    connectedIds.add(edge.source().id());
    connectedIds.add(edge.target().id());
  });
  const isolated = nodes.filter((node) => !connectedIds.has(node.id()) && !node.isParent());
  return isolated.length > ISOLATED_GRID_THRESHOLD ? isolated : null;
}

/**
 * Lays out `nodes`/`edges` in place. Resolves once all node positions are final.
 */
export function runGraphLayout(cy, { type, nodes: allNodes, edges, incremental = false, fixedNodes = null }) {
  registerLayouts();
  const isolated = incremental ? null : splitIsolated(allNodes, edges);
  const nodes = isolated ? allNodes.difference(isolated) : allNodes;
  const finish = () => {
    if (type !== GRAPH_LAYOUT_TYPES.HIERARCHY) {
      separateOverlaps(nodes, new Set(fixedNodes ? fixedNodes.map((node) => node.id()) : []));
    }
    if (!isolated) {
      return;
    }
    const bounds = nodes.nonempty() ? nodes.boundingBox() : null;
    placeInGrid(isolated, bounds ? { x: bounds.x1, y: bounds.y2 + GRID_MARGIN_TOP } : { x: 0, y: 0 });
  };
  if (nodes.length === 0) {
    finish();
    return Promise.resolve();
  }
  const isHierarchy = type === GRAPH_LAYOUT_TYPES.HIERARCHY;
  // All edges feed the layering: ranking by taxonomy edges alone left property edges very long
  // (benchmark: ~2x median edge length and ~3-10x more crossings). 'taxonomy' remains as an override.
  const layoutEdges =
    isHierarchy && layoutOverrides().hierarchyEdges === 'taxonomy'
      ? edges.filter((edge) => HIERARCHY_PREDICATES.has(edge.data('predicate')))
      : edges;
  const elements = nodes.union(layoutEdges);
  const averageNodeSize = nodes.length
    ? nodes.reduce((sum, node) => sum + Math.max(node.width(), node.height()), 0) / nodes.length
    : 100;
  const options = isHierarchy ? hierarchyOptions(incremental) : spreadOptions(nodes.length, averageNodeSize);
  if (!isHierarchy && incremental) {
    // Relax from the current positions instead of re-randomising, keeping already-placed nodes pinned.
    Object.assign(options, {
      randomize: false,
      packComponents: false,
      tile: false,
      numIter: 1200,
      fixedNodeConstraint: fixedNodes
        ? fixedNodes.map((node) => ({ nodeId: node.id(), position: { ...node.position() } }))
        : undefined,
    });
  }

  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    try {
      const layout = elements.layout(options);
      layout.one('layoutstop', () => {
        // Exposed for the layout benchmark / UI checks.
        cy.scratch('_layoutStats', {
          runs: (cy.scratch('_layoutStats')?.runs ?? 0) + 1,
          ms: performance.now() - startedAt,
          type,
        });
        finish();
        resolve();
      });
      if (isHierarchy) {
        layout.run();
      } else {
        withSeededRandom(() => layout.run());
      }
    } catch (error) {
      reject(error);
    }
  });
}

const NEW_NODE_LAYER_GAP = 130;
const NEW_NODE_SIBLING_GAP = 24;

// Drops newly revealed nodes in a row just below `anchor`, so an incremental layout starts from a
// sensible spot for them instead of wherever they were last seen.
export function placeNodesBelow(anchor, newNodes) {
  const count = newNodes.length;
  if (count === 0) {
    return;
  }
  const widths = newNodes.map((node) => node.width());
  const total = widths.reduce((sum, width) => sum + width, 0) + NEW_NODE_SIBLING_GAP * (count - 1);
  const origin = anchor.position();
  let cursor = origin.x - total / 2;
  newNodes.forEach((node, index) => {
    node.position({ x: cursor + widths[index] / 2, y: origin.y + NEW_NODE_LAYER_GAP });
    cursor += widths[index] + NEW_NODE_SIBLING_GAP;
  });
}
