// Collapse/expand state for hierarchy layouts over forests of DAGs.
//
// Edges point child -> parent (rdfs:subClassOf, rdf:type, ...). A node is visible when it is
// reachable from a root through expanded nodes only, so a node with several parents stays
// visible while any one of them is expanded. State is the set of *expanded* nodes: anything not
// in it is collapsed, which makes expanding a node reveal exactly one more level.

export const DEFAULT_VISIBLE_NODE_BUDGET = 120;
export const DEFAULT_MAX_LEVEL_WIDTH = 24;

export function buildHierarchyIndex(nodeIds, edges, otherEdges = []) {
  const ids = [...new Set(nodeIds)];
  const known = new Set(ids);
  const parents = new Map(ids.map((id) => [id, new Set()]));
  const children = new Map(ids.map((id) => [id, new Set()]));

  edges.forEach(({ source, target }) => {
    if (source === target || !known.has(source) || !known.has(target)) {
      return;
    }
    parents.get(source).add(target);
    children.get(target).add(source);
  });

  // Satellites are nodes with no hierarchy edge at all (literals, individuals linked by properties).
  // They are shown only while some neighbor is shown, so they never float free of a collapsed node.
  const neighbors = new Map(ids.map((id) => [id, new Set()]));
  [...edges, ...otherEdges].forEach(({ source, target }) => {
    if (source === target || !known.has(source) || !known.has(target)) {
      return;
    }
    neighbors.get(source).add(target);
    neighbors.get(target).add(source);
  });
  const isSatellite = (id) => parents.get(id).size === 0 && children.get(id).size === 0;
  const satellites = new Set(ids.filter(isSatellite));

  // Nodes in a cycle (or hanging off one) have no parent-free ancestor, so pick fallback roots.
  const roots = ids.filter((id) => parents.get(id).size === 0);
  // (satellites are filtered out of the returned roots below)
  const reached = new Set();
  const markReachable = (start) => {
    const stack = [start];
    while (stack.length > 0) {
      const id = stack.pop();
      if (reached.has(id)) {
        continue;
      }
      reached.add(id);
      children.get(id).forEach((child) => stack.push(child));
    }
  };
  roots.forEach(markReachable);
  [...ids]
    .sort((a, b) => children.get(b).size - children.get(a).size || (a < b ? -1 : 1))
    .forEach((id) => {
      if (!reached.has(id)) {
        roots.push(id);
        markReachable(id);
      }
    });

  // A satellite component with no hierarchy node in it has nothing to collapse into: keep it shown.
  const freeSatellites = new Set();
  const seenSatellites = new Set();
  satellites.forEach((start) => {
    if (seenSatellites.has(start)) {
      return;
    }
    const component = [];
    let anchored = false;
    const stack = [start];
    seenSatellites.add(start);
    while (stack.length > 0) {
      const id = stack.pop();
      component.push(id);
      neighbors.get(id).forEach((next) => {
        if (!satellites.has(next)) {
          anchored = true;
        } else if (!seenSatellites.has(next)) {
          seenSatellites.add(next);
          stack.push(next);
        }
      });
    }
    if (!anchored) {
      component.forEach((id) => freeSatellites.add(id));
    }
  });

  return { ids, parents, children, roots: roots.filter((id) => !satellites.has(id)), neighbors, satellites, freeSatellites };
}

export function hasHierarchyChildren(index, id) {
  return (index.children.get(id)?.size ?? 0) > 0;
}

export function computeVisibleNodes(index, expanded) {
  const visible = new Set();
  const stack = [...index.roots];
  while (stack.length > 0) {
    const id = stack.pop();
    if (visible.has(id)) {
      continue;
    }
    visible.add(id);
    if (expanded.has(id)) {
      index.children.get(id).forEach((child) => stack.push(child));
    }
  }

  // Satellites follow their neighbors: visible if linked (directly or via other satellites) to a visible node.
  index.freeSatellites.forEach((id) => visible.add(id));
  const queue = [...visible];
  for (let head = 0; head < queue.length; head += 1) {
    index.neighbors.get(queue[head]).forEach((next) => {
      if (index.satellites.has(next) && !visible.has(next)) {
        visible.add(next);
        queue.push(next);
      }
    });
  }
  return visible;
}

// A node's visual cost: itself plus the satellites (literals, property-linked leaves) hanging off it.
function nodeWeight(index, id) {
  let weight = 1;
  index.neighbors.get(id).forEach((other) => {
    if (index.satellites.has(other)) {
      weight += 1;
    }
  });
  return weight;
}

// Expands breadth-first from the roots while both the total weight budget and the width of each
// level (a layered layout gets unreadably wide otherwise) stay within their limits.
export function autoExpand(index, { budget = DEFAULT_VISIBLE_NODE_BUDGET, maxLevelWidth = DEFAULT_MAX_LEVEL_WIDTH } = {}) {
  const expanded = new Set();
  const depthOf = new Map(index.roots.map((id) => [id, 0]));
  const rootWeight = index.roots.reduce((sum, id) => sum + nodeWeight(index, id), 0);
  const levelSizes = [rootWeight];
  let visibleWeight = rootWeight + index.freeSatellites.size;
  const queue = [...index.roots];
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head];
    const revealed = [...index.children.get(id)].filter((child) => !depthOf.has(child));
    if (revealed.length === 0) {
      if (index.children.get(id).size > 0) {
        expanded.add(id);
      }
      continue;
    }
    const depth = depthOf.get(id) + 1;
    const levelSize = levelSizes[depth] ?? 0;
    const cost = revealed.reduce((sum, child) => sum + nodeWeight(index, child), 0);
    if (visibleWeight + cost > budget || levelSize + cost > maxLevelWidth) {
      continue;
    }
    expanded.add(id);
    levelSizes[depth] = levelSize + cost;
    visibleWeight += cost;
    revealed.forEach((child) => {
      depthOf.set(child, depth);
      queue.push(child);
    });
  }
  return expanded;
}

// For each visible collapsed node: how many hidden nodes sit behind it. The walk stops at nodes
// that are already visible (reachable another way), so the number reflects what this node hides.
export function countHiddenDescendants(index, visible, expanded) {
  const counts = new Map();
  visible.forEach((id) => {
    if (expanded.has(id) || !hasHierarchyChildren(index, id)) {
      return;
    }
    const seen = new Set();
    const stack = [...index.children.get(id)];
    while (stack.length > 0) {
      const next = stack.pop();
      if (seen.has(next) || next === id || visible.has(next)) {
        continue;
      }
      seen.add(next);
      index.children.get(next).forEach((child) => stack.push(child));
      index.neighbors.get(next).forEach((other) => {
        if (index.satellites.has(other)) {
          stack.push(other);
        }
      });
    }
    // Satellites linked directly to the collapsed node itself are hidden with it.
    index.neighbors.get(id).forEach((other) => {
      if (index.satellites.has(other) && !visible.has(other)) {
        stack.push(other);
      }
    });
    while (stack.length > 0) {
      const next = stack.pop();
      if (seen.has(next) || next === id || visible.has(next)) {
        continue;
      }
      seen.add(next);
      index.neighbors.get(next).forEach((other) => {
        if (index.satellites.has(other)) {
          stack.push(other);
        }
      });
    }
    if (seen.size > 0) {
      counts.set(id, seen.size);
    }
  });
  return counts;
}

export function toggleExpanded(expanded, id) {
  const next = new Set(expanded);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export const COLLAPSE_HIDDEN_CLASS = 'collapse-hidden';

// Mirrors the visibility decision onto Cytoscape elements, including edge-anchor helper nodes.
export function applyCollapseVisibility(cy, layoutNodes, visible, hiddenCounts) {
  cy.batch(() => {
    layoutNodes.forEach((node) => {
      node.toggleClass(COLLAPSE_HIDDEN_CLASS, !visible.has(node.id()));
      const hidden = hiddenCounts.get(node.id()) ?? 0;
      node.data('collapsedCount', hidden);
      node.data('collapsedLabel', hidden > 0 ? `${node.data('label')}\n[+${hidden}]` : '');
    });
    cy.nodes('[edgeAnchor = 1]').forEach((anchor) => {
      const sourceHidden = cy.getElementById(anchor.data('anchoredSourceId')).hasClass(COLLAPSE_HIDDEN_CLASS);
      const targetHidden = cy.getElementById(anchor.data('anchoredTargetId')).hasClass(COLLAPSE_HIDDEN_CLASS);
      anchor.toggleClass(COLLAPSE_HIDDEN_CLASS, sourceHidden || targetHidden);
    });
    cy.edges().forEach((edge) => {
      edge.toggleClass(
        COLLAPSE_HIDDEN_CLASS,
        edge.source().hasClass(COLLAPSE_HIDDEN_CLASS) || edge.target().hasClass(COLLAPSE_HIDDEN_CLASS),
      );
    });
  });
}
