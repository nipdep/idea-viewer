import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectionSnapshot } from './projection-helpers/buildProjectionSnapshot.mjs';
import {
  assertContainsEdge,
  assertContainsNode,
  assertEdgeReferencesExistingNodes,
  assertNoDanglingHelpers,
  assertNoEdges,
  assertNoHelperNodes,
} from './projection-helpers/assertProjection.mjs';
import { projectionTestManifest } from './projection-manifest.mjs';

async function readExpectedJson(expectedPath) {
  return JSON.parse(await readFile(expectedPath, 'utf8'));
}

function buildTestViewOptions(testCase) {
  return {
    ...(testCase.view === 'owl'
      ? { owlProjectionLevel: testCase.projectionLevel }
      : { rdfProjectionLevel: testCase.projectionLevel }),
    ...(testCase.viewOptions ?? {}),
  };
}

function runStructuralSemanticAssertions(snapshot, testCase) {
  for (const expectedNode of testCase.structuralNodes ?? []) {
    assertContainsNode(snapshot, expectedNode);
  }
  for (const expectedEdge of testCase.structuralEdges ?? []) {
    assertContainsEdge(snapshot, expectedEdge);
  }
  if (testCase.expectNoEdges) {
    assertNoEdges(snapshot);
  }
  if (testCase.expectNoHelperNodes) {
    assertNoHelperNodes(snapshot);
  }
}

function runInvariantAssertions(snapshot, testCase) {
  assertEdgeReferencesExistingNodes(snapshot);
  assertNoDanglingHelpers(snapshot);
  if (testCase.invariantExpectNoHelperNodes) {
    assertNoHelperNodes(snapshot);
  }
}

for (const testCase of projectionTestManifest) {
  test(testCase.title, async () => {
    const actual = await buildProjectionSnapshot({
      fixturePath: testCase.fixturePath,
      mode: testCase.mode,
      viewOptions: buildTestViewOptions(testCase),
    });

    if (testCase.strategy === 'exact-snapshot') {
      const expected = await readExpectedJson(testCase.expectedPath);
      assert.deepStrictEqual(actual, expected);
      return;
    }

    if (testCase.strategy === 'structural-semantic') {
      runStructuralSemanticAssertions(actual, testCase);
      return;
    }

    if (testCase.strategy === 'invariant') {
      runInvariantAssertions(actual, testCase);
      return;
    }

    throw new Error(`Unsupported strategy: ${testCase.strategy}`);
  });
}
