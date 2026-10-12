import assert from 'node:assert/strict';
import test from 'node:test';
import cytoscape from 'cytoscape';
import { connectorTransparentNeighborhood } from '../src/lib/focus-neighborhood.js';

// nodes: ids starting with "c" are connectors (kind: blank)
const graph = (edges, extraNodes = []) => {
  const ids = new Set(extraNodes);
  edges.forEach(([a, b]) => { ids.add(a); ids.add(b); });
  return cytoscape({
    headless: true,
    elements: [
      ...[...ids].map((id) => ({ data: { id, kind: id.startsWith('c') ? 'blank' : 'entity' } })),
      ...edges.map(([source, target], index) => ({ data: { id: `e${index}`, source, target } })),
    ],
  });
};
const names = (collection) => collection.nodes().map((n) => n.id()).sort();

test('without connectors it is the plain one-hop neighbourhood', () => {
  const cy = graph([['A', 'B'], ['B', 'C']]);
  assert.deepEqual(names(connectorTransparentNeighborhood(cy.$id('A'))), ['A', 'B']);
});

test('continues through a connector and stops at the first non-connector nodes beyond it', () => {
  // A - c1 - B, c1 - C, B - D   (D is two non-connector hops away and must not be included)
  const cy = graph([['A', 'c1'], ['c1', 'B'], ['c1', 'C'], ['B', 'D']]);
  const result = connectorTransparentNeighborhood(cy.$id('A'));
  assert.deepEqual(names(result), ['A', 'B', 'C', 'c1']);
  assert.equal(result.edges().length, 3, 'edges A-c1, c1-B, c1-C are in the neighbourhood; B-D is not');
});

test('goes through nested connectors, in either edge direction', () => {
  const cy = graph([['A', 'c1'], ['c2', 'c1'], ['c2', 'B'], ['c3', 'c2'], ['C', 'c3']]);
  assert.deepEqual(names(connectorTransparentNeighborhood(cy.$id('A'))), ['A', 'B', 'C', 'c1', 'c2', 'c3']);
});

test('a cycle of connectors terminates', () => {
  const cy = graph([['A', 'c1'], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'c1'], ['c3', 'B']]);
  assert.deepEqual(names(connectorTransparentNeighborhood(cy.$id('A'))), ['A', 'B', 'c1', 'c2', 'c3']);
});

test('a non-connector neighbour beyond the connectors is not expanded through its own connectors', () => {
  // A - c1 - B - c2 - X : B is a real node, so the walk ends there; c2 and X stay out.
  const cy = graph([['A', 'c1'], ['c1', 'B'], ['B', 'c2'], ['c2', 'X']]);
  assert.deepEqual(names(connectorTransparentNeighborhood(cy.$id('A'))), ['A', 'B', 'c1']);
});

test('a focused connector expands the same way, and several roots combine', () => {
  const cy = graph([['A', 'c1'], ['c1', 'c2'], ['c2', 'B'], ['Z', 'Y']]);
  assert.deepEqual(names(connectorTransparentNeighborhood(cy.$id('c1'))), ['A', 'B', 'c1', 'c2']);
  assert.deepEqual(names(connectorTransparentNeighborhood(cy.$id('c1').union(cy.$id('Z')))), ['A', 'B', 'Y', 'Z', 'c1', 'c2']);
});

test('edge anchors are transparent too', () => {
  const cy = cytoscape({
    headless: true,
    elements: [
      { data: { id: 'A', kind: 'entity' } }, { data: { id: 'B', kind: 'entity' } },
      { data: { id: 'anchor', kind: 'entity', edgeAnchor: 1 } },
      { data: { id: 't1', source: 'A', target: 'anchor' } }, { data: { id: 't2', source: 'anchor', target: 'B' } },
    ],
  });
  assert.deepEqual(names(connectorTransparentNeighborhood(cy.$id('A'))), ['A', 'B', 'anchor']);
});
