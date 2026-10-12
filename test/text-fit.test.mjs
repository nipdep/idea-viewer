import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AVERAGE_CHAR_WIDTH,
  computeTextBox,
  measureTextWidth,
  MIN_NODE_WIDTH,
  NODE_PADDING_X,
  splitBreakable,
  wrapToWidth,
} from '../src/lib/text-fit.js';

const MAX = 26 * AVERAGE_CHAR_WIDTH;

test('splitBreakable breaks at camelCase and separators, never inside a word', () => {
  assert.deepEqual(splitBreakable('UnsatisfiedPolicyAssessment'), ['Unsatisfied', 'Policy', 'Assessment']);
  assert.deepEqual(splitBreakable('HTMLParser'), ['HTML', 'Parser']);
  assert.deepEqual(splitBreakable('snake_case_name'), ['snake_', 'case_', 'name']);
  assert.deepEqual(splitBreakable('hasPart2Value'), ['has', 'Part2', 'Value']);
  assert.deepEqual(splitBreakable('plain'), ['plain']);
});

test('short labels stay on one line, with no mid-word break', () => {
  assert.deepEqual(wrapToWidth('PizzaBase', MAX), ['PizzaBase']);
  assert.deepEqual(wrapToWidth('Faithfulness Measure', MAX), ['Faithfulness Measure']);
});

test('a long camelCase name wraps at word boundaries and loses no characters', () => {
  const name = 'PartiallySatisfiedComplianceAssessmentRecord';
  const lines = wrapToWidth(name, MAX);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), name, 'no character dropped or added');
  lines.forEach((line) => assert.ok(measureTextWidth(line) <= MAX, `"${line}" fits`));
  lines.slice(1).forEach((line) => assert.match(line, /^[A-Z]/, `"${line}" starts at a word boundary`));
});

test('multi-word text wraps at spaces and every line fits', () => {
  const text = 'Evaluating the quality of machine learning explanations: a survey on methods and metrics';
  const lines = wrapToWidth(text, MAX);
  assert.equal(lines.join(' '), text);
  lines.forEach((line) => assert.ok(measureTextWidth(line) <= MAX, `"${line}" fits`));
});

test('an unbreakable run (a hash) is split by width as a last resort, and still fits', () => {
  const hash = 'ebe99c737bd3670239600547e5e2eb1d1497da39947b6576c3c44ffeca3';
  const lines = wrapToWidth(hash, MAX);
  assert.equal(lines.join(''), hash);
  lines.forEach((line) => assert.ok(measureTextWidth(line) <= MAX));
});

test('maxLines caps the output', () => {
  assert.equal(wrapToWidth('word '.repeat(200).trim(), MAX, 3).length, 3);
});

test('the box is the measured text plus real padding on both sides, with a floor for tiny labels', () => {
  const lines = ['PizzaBase'];
  const box = computeTextBox(lines);
  assert.ok(box.nodeWidth >= Math.ceil(measureTextWidth('PizzaBase')) + 2 * NODE_PADDING_X);
  assert.equal(box.textMaxWidth, box.nodeWidth, 'Cytoscape never needs to wrap again');
  assert.equal(computeTextBox(['A']).nodeWidth, MIN_NODE_WIDTH);
  assert.ok(computeTextBox(['one', 'two', 'three']).nodeHeight > computeTextBox(['one']).nodeHeight);
});

test('the widest line decides the width', () => {
  const wide = computeTextBox(['a much longer first line', 'short']);
  const narrow = computeTextBox(['short', 'short']);
  assert.ok(wide.nodeWidth > narrow.nodeWidth);
});

import { isTextBoxData, scaledBoxPatch } from '../src/lib/text-fit.js';

test('scaledBoxPatch scales from the 12px base and never compounds', () => {
  const data = { label: 'PizzaBase', kind: 'entity', nodeWidth: 80, nodeHeight: 27, textMaxWidth: 80 };
  const big = scaledBoxPatch(data, 1.5);
  assert.deepEqual([big.nodeWidth, big.nodeHeight, big.textMaxWidth], [120, 41, 120]);
  const again = scaledBoxPatch({ ...data, ...big }, 1.5);
  assert.equal(again.nodeWidth, 120, 'applying the same scale twice gives the same size');
  assert.equal(scaledBoxPatch({ ...data, ...big }, 1).nodeWidth, 80, 'scale 1 returns to the original');
});

test('only nodes whose box comes from text are scaled', () => {
  assert.equal(isTextBoxData({ label: 'A', kind: 'entity' }), true);
  assert.equal(isTextBoxData({ label: '', kind: 'blank' }), false, 'connector circles keep their fixed size');
  assert.equal(isTextBoxData({ label: 'x', edgeAnchor: 1 }), false);
  assert.equal(isTextBoxData({ label: 'Group +3', clusterNode: 1 }), false);
});
