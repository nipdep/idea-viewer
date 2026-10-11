// Collapse/expand state for hierarchy layouts over forests of DAGs.
//
// Edges point child -> parent (rdfs:subClassOf, rdf:type, ...). A node is visible when it is
// reachable from a root through expanded nodes only, so a node with several parents stays
// visible while any one of them is expanded. State is the set of *expanded* nodes: anything not
// in it is collapsed, which makes expanding a node reveal exactly one more level.

export const DEFAULT_VISIBLE_NODE_BUDGET = 120;
export const DEFAULT_MAX_LEVEL_WIDTH = 24;

export function buildHierarchyIndex(nodeIds, edges) {
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

  // Nodes in a cycle (or hanging off one) have no parent-free ancestor, so pick fallback roots.
  const roots = ids.filter((id) => parents.get(id).size === 0);
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

  return { ids, parents, children, roots };
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
  return visible;
}

// Expands breadth-first from the roots while both the total node budget and the width of each
// level (a layered layout gets unreadably wide otherwise) stay within their limits.
export function autoExpand(index, { budget = DEFAULT_VISIBLE_NODE_BUDGET, maxLevelWidth = DEFAULT_MAX_LEVEL_WIDTH } = {}) {
  const expanded = new Set();
  const depthOf = new Map(index.roots.map((id) => [id, 0]));
  const levelSizes = [index.roots.length];
  let visibleCount = index.roots.length;
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
    if (visibleCount + revealed.length > budget || levelSize + revealed.length > maxLevelWidth) {
      continue;
    }
    expanded.add(id);
    levelSizes[depth] = levelSize + revealed.length;
    visibleCount += revealed.length;
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
