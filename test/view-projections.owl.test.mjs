import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectionSnapshot } from './projection-helpers/buildProjectionSnapshot.mjs';
import { projectionTestManifest } from './projection-manifest.mjs';

async function readExpectedJson(expectedPath) {
  return JSON.parse(await readFile(expectedPath, 'utf8'));
}

for (const testCase of projectionTestManifest.filter((entry) => entry.view === 'owl')) {
  test(testCase.title, async () => {
    const expected = await readExpectedJson(testCase.expectedPath);

    const actual = await buildProjectionSnapshot({
      fixturePath: testCase.fixturePath,
      mode: testCase.mode,
      viewOptions: {
        owlProjectionLevel: testCase.projectionLevel,
      },
    });

    assert.deepStrictEqual(actual, expected);
  });
}
