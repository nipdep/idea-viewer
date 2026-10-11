// Cluster collapse for the spread layout, built on cytoscape-expand-collapse.
// Louvain clusters (see spread-clusters.js) become compound nodes that start collapsed.
// Collapsing never needs a re-layout; expanding pins every other node so only the new members move.
import cytoscape from 'cytoscape';
import expandCollapse from 'cytoscape-expand-collapse';
import { computeClusters } from './spread-clusters';
import { COLLAPSE_HIDDEN_CLASS } from './hierarchy-collapse';

const EXPAND_COLLAPSE_INIT_KEY = '_expandCollapseInitialised';
let registered = false;

function getApi(cy) {
  if (!registered) {
    cytoscape.use(expandCollapse);
    registered = true;
  }
  if (!cy.scratch(EXPAND_COLLAPSE_INIT_KEY)) {
    cy.expandCollapse({
      layoutBy: null, // we run our own incremental layout
      animate: false,
      fisheye: false,
      undoable: false,
      cueEnabled: false,
      groupEdgesOfSameTypeOnCollapse: false,
    });
    cy.scratch(EXPAND_COLLAPSE_INIT_KEY, true);
  }
  return cy.expandCollapse('get');
}

export function isClusterNode(node) {
  return node.nonempty() && node.data('clusterNode') === 1;
}

// The cluster a node belongs to: itself when it is the cluster node, or its parent when it is a member.
export function getCluster(cy, nodeId) {
  const node = cy.getElementById(nodeId);
  if (node.empty()) {
    return null;
  }
  if (isClusterNode(node)) {
    return node;
  }
  const parent = node.parent();
  return parent.nonempty() && isClusterNode(parent) ? parent : null;
}

// Edge-anchor helper nodes dangle once their endpoints are folded into a cluster; hide them until both are back.
export function syncAnchorVisibility(cy) {
  cy.batch(() => {
    cy.nodes('[edgeAnchor = 1]').forEach((anchor) => {
      const source = cy.getElementById(anchor.data('anchoredSourceId'));
      const target = cy.getElementById(anchor.data('anchoredTargetId'));
      anchor.toggleClass(COLLAPSE_HIDDEN_CLASS, source.empty() || target.empty());
    });
  });
}

const PRIMARY_EDGE_CLASS = 'cluster-edge-primary';
const DUPLICATE_EDGE_CLASS = 'cluster-edge-duplicate';

// Parallel edges between the same pair (at least one end a cluster) are shown as one edge with a count.
// cytoscape-expand-collapse's own edge merging skips the meta-edges it creates, so this is done here:
// the duplicates are only hidden, and the library removes them again when the cluster expands.
function groupParallelClusterEdges(cy) {
  // Not `:visible` and not inside a batch: styles of freshly moved meta-edges are not computed yet there.
  cy.edges(`.${DUPLICATE_EDGE_CLASS}`).removeClass(`${DUPLICATE_EDGE_CLASS} ${COLLAPSE_HIDDEN_CLASS}`);
  cy.edges(`.${PRIMARY_EDGE_CLASS}`).removeClass(PRIMARY_EDGE_CLASS).data('collapsedCountLabel', '');

  const groups = new Map();
  cy.edges().forEach((edge) => {
    if (edge.hasClass(COLLAPSE_HIDDEN_CLASS)) {
      return;
    }
    const source = edge.source();
    const target = edge.target();
    if (!isClusterNode(source) && !isClusterNode(target)) {
      return;
    }
    const key = [source.id(), target.id()].sort().join('||');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(edge);
  });
  cy.batch(() => {
    groups.forEach((edges) => {
      if (edges.length < 2) {
        return;
      }
      const [primary, ...duplicates] = edges;
      primary.addClass(PRIMARY_EDGE_CLASS);
      primary.data('collapsedCountLabel', `\u00d7${edges.length}`);
      duplicates.forEach((edge) => edge.addClass(`${DUPLICATE_EDGE_CLASS} ${COLLAPSE_HIDDEN_CLASS}`));
    });
  });
}

function clusterTitle(members, size) {
  const hub = members.reduce((best, node) => (node.degree() > best.degree() ? node : best), members[0]);
  const name = String(hub.data('label') ?? '').split('\n')[0].trim();
  // Blank nodes have no label; fall back to a neutral name rather than a bare count.
  return `${name || 'Group'} +${size - 1}`;
}

/**
 * Groups layout nodes into compound cluster nodes and collapses them all.
 * @returns {number} the number of clusters created
 */
export function applySpreadClusters(cy, layoutNodes, layoutEdges) {
  const clusters = computeClusters(
    layoutNodes.map((node) => node.id()),
    layoutEdges.map((edge) => ({ source: edge.source().id(), target: edge.target().id() })),
  );
  if (clusters.size === 0) {
    return 0;
  }
  const api = getApi(cy);

  cy.batch(() => {
    clusters.forEach((memberIds, clusterId) => {
      const members = memberIds.map((id) => cy.getElementById(id));
      const title = clusterTitle(members, memberIds.length);
      cy.add({
        group: 'nodes',
        data: {
          id: clusterId,
          label: title,
          clusterTitle: title,
          clusterNode: 1,
          clusterSize: memberIds.length,
          nodeWidth: 150,
          nodeHeight: 56,
          textMaxWidth: 132,
        },
      });
      members.forEach((member) => member.move({ parent: clusterId }));
    });
  });
  api.collapse(cy.nodes('[clusterNode = 1]'));
  syncAnchorVisibility(cy);
  groupParallelClusterEdges(cy);
  return clusters.size;
}

const SEED_RING_GAP = 90;

// Places the members of a freshly expanded cluster on a spiral around its centre.
function seedMembers(members, center) {
  members.forEach((member, index) => {
    const angle = index * 2.399963; // golden angle keeps neighbours apart
    const radius = SEED_RING_GAP * Math.sqrt(index + 1) * 0.55;
    member.position({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  });
}

/**
 * Toggles the cluster containing `nodeId`.
 * `relayout(fixedNodes)` must re-run the layout with `fixedNodes` pinned and resolve when done.
 * @returns {Promise<object|null>} the cluster node, once any layout has finished
 */
export async function toggleCluster(cy, nodeId, relayout) {
  const cluster = getCluster(cy, nodeId);
  if (!cluster) {
    return null;
  }
  const api = getApi(cy);
  const clusterId = cluster.id();

  // Un-hide merged edges first so the cluster is toggled with its full edge set.
  cy.edges(`.${DUPLICATE_EDGE_CLASS}`).removeClass(`${DUPLICATE_EDGE_CLASS} ${COLLAPSE_HIDDEN_CLASS}`);

  if (api.isCollapsible(cluster)) {
    api.collapse(cluster);
    syncAnchorVisibility(cy);
    groupParallelClusterEdges(cy);
    return cy.getElementById(clusterId);
  }

  const center = { ...cluster.position() };
  const shownBefore = new Set(cy.nodes(':visible').map((node) => node.id()));
  api.expand(cluster);
  syncAnchorVisibility(cy);
  const expanded = cy.getElementById(clusterId);
  const members = expanded.children().not('[edgeAnchor = 1]');
  seedMembers(members, center);
  const memberIds = new Set(members.map((node) => node.id()));
  const fixedNodes = cy
    .nodes(':visible')
    .filter((node) => shownBefore.has(node.id()) && !memberIds.has(node.id()) && !node.isParent())
    .not('[edgeAnchor = 1]');
  await relayout(fixedNodes);
  groupParallelClusterEdges(cy);
  return expanded;
}
