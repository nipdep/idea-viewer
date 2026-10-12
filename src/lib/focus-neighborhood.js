// Focus neighbourhood that looks through connectors.
//
// Connectors (blank nodes, OWL expression glyphs such as the intersection/union circles, RDF collection nodes,
// edge anchors) are notation, not content: a focused class that stops at a connector has told the reader
// nothing. So the neighbourhood continues through connectors, however deeply nested, until it reaches
// non-connector nodes, which are included but not expanded any further.

export function isConnectorNode(node) {
  const data = node.data();
  return data.kind === 'blank' || data.edgeAnchor === 1;
}

/**
 * @param roots Cytoscape collection of focused nodes
 * @returns {Collection} the nodes and edges of the focus neighbourhood
 */
export function connectorTransparentNeighborhood(roots) {
  let result = roots.closedNeighborhood();
  const expanded = new Set();
  let frontier = result.nodes().filter(isConnectorNode);

  while (frontier.nonempty()) {
    const pending = frontier.filter((node) => !expanded.has(node.id()));
    if (pending.empty()) {
      break;
    }
    pending.forEach((node) => expanded.add(node.id()));
    const reached = pending.closedNeighborhood();
    result = result.union(reached);
    frontier = reached.nodes().filter(isConnectorNode);
  }
  return result;
}
