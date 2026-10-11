import assert from 'node:assert/strict';
import test from 'node:test';
import {
  autoExpand,
  buildHierarchyIndex,
  computeVisibleNodes,
  countHiddenDescendants,
  toggleExpanded,
} from '../src/lib/hierarchy-collapse.js';

// child -> parent edges
const edge = (source, target) => ({ source, target });
const sorted = (set) => [...set].sort();

test('diamond node stays visible while either parent is expanded', () => {
  const index = buildHierarchyIndex(['root', 'a', 'b', 'leaf'], [
    edge('a', 'root'), edge('b', 'root'), edge('leaf', 'a'), edge('leaf', 'b'),
  ]);
  assert.deepEqual(index.roots, ['root']);
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set(['root']))), ['a', 'b', 'root']);
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set(['root', 'a']))), ['a', 'b', 'leaf', 'root']);
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set(['root', 'b']))), ['a', 'b', 'leaf', 'root']);
});

test('forest: every parentless node is a root and isolated nodes stay visible', () => {
  const index = buildHierarchyIndex(['r1', 'r2', 'c1', 'c2', 'solo'], [edge('c1', 'r1'), edge('c2', 'r2')]);
  assert.deepEqual(sorted(index.roots), ['r1', 'r2', 'solo']);
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set())), ['r1', 'r2', 'solo']);
});

test('cycles get a fallback root and self loops are ignored', () => {
  const index = buildHierarchyIndex(['a', 'b', 'c'], [edge('a', 'b'), edge('b', 'a'), edge('c', 'a'), edge('a', 'a')]);
  assert.equal(index.roots.length, 1);
  const all = computeVisibleNodes(index, new Set(['a', 'b', 'c']));
  assert.deepEqual(sorted(all), ['a', 'b', 'c']);
});

test('edges to unknown nodes are ignored', () => {
  const index = buildHierarchyIndex(['a'], [edge('a', 'ghost'), edge('ghost', 'a')]);
  assert.deepEqual(index.roots, ['a']);
});

test('autoExpand respects the budget and expands level by level', () => {
  const ids = ['root', ...Array.from({ length: 10 }, (_, i) => `c${i}`), 'g0', 'g1'];
  const edges = [...Array.from({ length: 10 }, (_, i) => edge(`c${i}`, 'root')), edge('g0', 'c0'), edge('g1', 'c0')];
  const index = buildHierarchyIndex(ids, edges);

  const tight = autoExpand(index, { budget: 5 });
  assert.equal(tight.has('root'), false);
  assert.equal(computeVisibleNodes(index, tight).size, 1);

  const roomy = autoExpand(index, { budget: 11 });
  assert.equal(roomy.has('root'), true);
  assert.equal(roomy.has('c0'), false);
  assert.equal(computeVisibleNodes(index, roomy).size, 11);

  const all = autoExpand(index, { budget: 100 });
  assert.equal(computeVisibleNodes(index, all).size, ids.length);
});

test('autoExpand keeps wide levels collapsed even when the budget allows them', () => {
  const ids = ['root', ...Array.from({ length: 40 }, (_, i) => `c${i}`), 'x'];
  const index = buildHierarchyIndex(ids, [...Array.from({ length: 40 }, (_, i) => edge(`c${i}`, 'root')), edge('x', 'c0')]);
  const expanded = autoExpand(index, { budget: 500, maxLevelWidth: 10 });
  assert.equal(expanded.has('root'), false);
  assert.equal(autoExpand(index, { budget: 500, maxLevelWidth: 50 }).has('root'), true);
});

test('hidden descendant counts only count nodes not otherwise visible', () => {
  const index = buildHierarchyIndex(['root', 'a', 'b', 'leaf', 'deep'], [
    edge('a', 'root'), edge('b', 'root'), edge('leaf', 'a'), edge('leaf', 'b'), edge('deep', 'leaf'),
  ]);
  const expanded = new Set(['root', 'b']);
  const visible = computeVisibleNodes(index, expanded);
  const counts = countHiddenDescendants(index, visible, expanded);
  assert.equal(counts.get('a'), undefined, 'leaf is visible via b, deep is hidden behind leaf only');
  assert.equal(counts.get('leaf'), 1);
});

test('toggleExpanded does not mutate its input', () => {
  const before = new Set(['a']);
  const after = toggleExpanded(before, 'b');
  assert.deepEqual(sorted(before), ['a']);
  assert.deepEqual(sorted(after), ['a', 'b']);
  assert.deepEqual(sorted(toggleExpanded(after, 'a')), ['b']);
});
