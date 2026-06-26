import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildProjectionSnapshot } from './projection-helpers/buildProjectionSnapshot.mjs';
import { GRAPH_VIEW_MODES } from '../src/lib/view-projections.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readExpectedJson(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  return JSON.parse(await readFile(fullPath, 'utf8'));
}

test('OWL view exact snapshot: class declaration', async () => {
  const fixturePath = path.join(__dirname, 'fixtures/projections/owl/class-declaration.ttl');
  const expected = await readExpectedJson('fixtures/projections/owl/class-declaration.expected.json');

  const actual = await buildProjectionSnapshot({
    fixturePath,
    mode: GRAPH_VIEW_MODES.OWL,
    viewOptions: {
      owlProjectionLevel: 'ontology',
    },
  });

  assert.deepStrictEqual(actual, expected);
});
