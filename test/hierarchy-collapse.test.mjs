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
  assert.deepEqual(sorted(index.roots), ['r1', 'r2']);
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
  assert.deepEqual(index.roots, []);
  assert.deepEqual([...computeVisibleNodes(index, new Set())], ['a'], 'a has no real edges, so it is a free satellite');
});

test('autoExpand respects the budget and expands level by level', () => {
  const ids = ['root', ...Array.from({ length: 10 }, (_, i) => `c${i}`), 'g0', 'g1'];
  const edges = [...Array.from({ length: 10 }, (_, i) => edge(`c${i}`, 'root')), edge('g0', 'c0'), edge('g1', 'c0')];
  const index = buildHierarchyIndex(ids, edges);

  const tight = autoExpand(index, { budget: 5, foldAbove: 0 });
  assert.equal(tight.has('root'), false);
  assert.equal(computeVisibleNodes(index, tight).size, 1);

  const roomy = autoExpand(index, { budget: 11, foldAbove: 0 });
  assert.equal(roomy.has('root'), true);
  assert.equal(roomy.has('c0'), false);
  assert.equal(computeVisibleNodes(index, roomy).size, 11);

  const all = autoExpand(index, { budget: 100, foldAbove: 0 });
  assert.equal(computeVisibleNodes(index, all).size, ids.length);
});

test('small graphs are never folded, however wide a level is (a layout must not filter)', () => {
  const ids = ['root', ...Array.from({ length: 40 }, (_, i) => `c${i}`)];
  const index = buildHierarchyIndex(ids, ids.slice(1).map((id) => edge(id, 'root')));
  assert.equal(computeVisibleNodes(index, autoExpand(index)).size, ids.length);
  const folded = autoExpand(index, { foldAbove: 10, maxLevelWidth: 10 });
  assert.equal(computeVisibleNodes(index, folded).size, 1, 'above the threshold the width cap applies again');
});

test('autoExpand keeps wide levels collapsed even when the budget allows them', () => {
  const ids = ['root', ...Array.from({ length: 40 }, (_, i) => `c${i}`), 'x'];
  const index = buildHierarchyIndex(ids, [...Array.from({ length: 40 }, (_, i) => edge(`c${i}`, 'root')), edge('x', 'c0')]);
  const expanded = autoExpand(index, { budget: 500, maxLevelWidth: 10, foldAbove: 10 });
  assert.equal(expanded.has('root'), false);
  assert.equal(autoExpand(index, { budget: 500, maxLevelWidth: 50, foldAbove: 10 }).has('root'), true);
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

test('satellites (no taxonomy edge) are shown only while a neighbor is shown', () => {
  const index = buildHierarchyIndex(
    ['cls', 'ind', 'lit', 'free1', 'free2'],
    [edge('ind', 'cls')],
    [edge('ind', 'lit'), edge('free1', 'free2')],
  );
  assert.deepEqual(sorted(index.satellites), ['free1', 'free2', 'lit']);
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set())), ['cls', 'free1', 'free2'], 'lit hides with ind');
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set(['cls']))), ['cls', 'free1', 'free2', 'ind', 'lit']);
  const counts = countHiddenDescendants(index, computeVisibleNodes(index, new Set()), new Set());
  assert.equal(counts.get('cls'), 2, 'badge counts the hidden individual and its literal');
});

test('satellites chained through other satellites follow the visible anchor', () => {
  const index = buildHierarchyIndex(['a', 'x', 'lit', 'b'], [edge('x', 'a')], [edge('lit', 'x'), edge('lit', 'b')]);
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set())), ['a']);
  assert.deepEqual(sorted(computeVisibleNodes(index, new Set(['a']))), ['a', 'b', 'lit', 'x']);
});

test('toggleExpanded does not mutate its input', () => {
  const before = new Set(['a']);
  const after = toggleExpanded(before, 'b');
  assert.deepEqual(sorted(before), ['a']);
  assert.deepEqual(sorted(after), ['a', 'b']);
  assert.deepEqual(sorted(toggleExpanded(after, 'a')), ['b']);
});

import { computeClusters } from '../src/lib/spread-clusters.js';

test('spread clusters: dense groups are found, deterministically, and tiny ones are dropped', () => {
  const ids = [...Array(33).keys()].map((i) => `n${i}`);
  const edges = [];
  for (let group = 0; group < 3; group += 1) {
    for (let i = 0; i < 10; i += 1) {
      for (let j = i + 1; j < 10; j += 1) {
        if ((i * 7 + j * 3 + group) % 3 === 0) {
          edges.push({ source: `n${group * 10 + i}`, target: `n${group * 10 + j}` });
        }
      }
    }
  }
  edges.push({ source: 'n0', target: 'n10' }, { source: 'n11', target: 'n20' }, { source: 'n30', target: 'n31' });
  const first = computeClusters(ids, edges);
  const second = computeClusters(ids, edges);
  assert.deepEqual([...first], [...second]);
  assert.equal(first.size, 3, 'three dense groups; the n30-n31 pair and isolated n32 are below the minimum size');
  assert.ok([...first.values()].every((members) => members.length >= 8));
  const all = [...first.values()].flat();
  assert.equal(new Set(all).size, all.length, 'clusters are a partition: no node in two clusters');
});
