import assert from 'node:assert/strict';

function matchesSubset(candidate, expectedSubset) {
  return Object.entries(expectedSubset).every(([key, value]) => candidate?.[key] === value);
}

function isHelperNode(node) {
  return String(node?.idHint || '').startsWith('helper:');
}

export function assertContainsNode(snapshot, expectedSubset) {
  const match = snapshot.nodes.find((node) => matchesSubset(node, expectedSubset));
  assert.ok(match, `Expected node not found: ${JSON.stringify(expectedSubset, null, 2)}`);
}

export function assertContainsEdge(snapshot, expectedSubset) {
  const match = snapshot.edges.find((edge) => matchesSubset(edge, expectedSubset));
  assert.ok(match, `Expected edge not found: ${JSON.stringify(expectedSubset, null, 2)}`);
}

export function assertNoHelperNodes(snapshot) {
  const helpers = snapshot.nodes.filter(isHelperNode);
  assert.deepStrictEqual(helpers, [], `Unexpected helper nodes found: ${JSON.stringify(helpers, null, 2)}`);
}

export function assertNoEdges(snapshot) {
  assert.deepStrictEqual(snapshot.edges, [], `Expected no edges, found: ${JSON.stringify(snapshot.edges, null, 2)}`);
}

export function assertEdgeReferencesExistingNodes(snapshot) {
  const nodeIds = new Set(snapshot.nodes.map((node) => node.idHint));
  const invalidEdges = snapshot.edges.filter(
    (edge) => !nodeIds.has(edge.sourceHint) || !nodeIds.has(edge.targetHint),
  );
  assert.deepStrictEqual(
    invalidEdges,
    [],
    `Edges reference missing nodes: ${JSON.stringify(invalidEdges, null, 2)}`,
  );
}

export function assertNoDanglingHelpers(snapshot) {
  const helperIds = new Set(snapshot.nodes.filter(isHelperNode).map((node) => node.idHint));
  const dangling = [];

  for (const helperId of helperIds) {
    const incoming = snapshot.edges.filter((edge) => edge.targetHint === helperId).length;
    const outgoing = snapshot.edges.filter((edge) => edge.sourceHint === helperId).length;
    if (incoming === 0 || outgoing === 0) {
      dangling.push({ helperId, incoming, outgoing });
    }
  }

  assert.deepStrictEqual(dangling, [], `Dangling helper nodes found: ${JSON.stringify(dangling, null, 2)}`);
}
