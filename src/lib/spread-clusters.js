// Clusters for the spread layout: Louvain communities become compound nodes that
// cytoscape-expand-collapse can fold away, so a large graph opens as a handful of clusters.
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

import { AUTO_COLLAPSE_NODE_THRESHOLD } from './hierarchy-collapse.js';

export const CLUSTER_NODE_THRESHOLD = AUTO_COLLAPSE_NODE_THRESHOLD;
export const MIN_CLUSTER_SIZE = 4;
export const CLUSTER_ID_PREFIX = 'cluster:';

// Deterministic: nodes and edges are added in sorted order and Louvain gets a seeded rng.
function seededRng(seed = 0x2545f491) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string[]} nodeIds
 * @param {{source: string, target: string}[]} edges
 * @returns {Map<string, string[]>} cluster id -> member node ids (only clusters >= minSize)
 */
export function computeClusters(nodeIds, edges, { minSize = MIN_CLUSTER_SIZE, resolution = 1 } = {}) {
  const graph = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false });
  [...new Set(nodeIds)].sort().forEach((id) => graph.addNode(id));
  [...edges]
    .filter(({ source, target }) => source !== target && graph.hasNode(source) && graph.hasNode(target))
    .sort((a, b) => (a.source + a.target < b.source + b.target ? -1 : 1))
    .forEach(({ source, target }) => {
      if (!graph.hasEdge(source, target)) {
        graph.addEdge(source, target);
      }
    });

  const assignment = louvain(graph, { resolution, rng: seededRng(), getEdgeWeight: null });
  const byCommunity = new Map();
  Object.entries(assignment).forEach(([id, community]) => {
    if (!byCommunity.has(community)) {
      byCommunity.set(community, []);
    }
    byCommunity.get(community).push(id);
  });

  const clusters = new Map();
  [...byCommunity.values()]
    .filter((members) => members.length >= minSize)
    .sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1))
    .forEach((members, index) => clusters.set(`${CLUSTER_ID_PREFIX}${index}`, members.sort()));
  return clusters;
}
