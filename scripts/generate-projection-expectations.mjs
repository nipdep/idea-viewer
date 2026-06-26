import { writeFile } from 'node:fs/promises';
import { buildProjectionSnapshot } from '../test/projection-helpers/buildProjectionSnapshot.mjs';
import { projectionTestManifest } from '../test/projection-manifest.mjs';

function buildTestViewOptions(testCase) {
  return {
    ...(testCase.view === 'owl'
      ? { owlProjectionLevel: testCase.projectionLevel }
      : { rdfProjectionLevel: testCase.projectionLevel }),
    ...(testCase.viewOptions ?? {}),
  };
}

for (const testCase of projectionTestManifest) {
  if (testCase.strategy !== 'exact-snapshot' || !testCase.expectedPath) {
    continue;
  }
  const snapshot = await buildProjectionSnapshot({
    fixturePath: testCase.fixturePath,
    mode: testCase.mode,
    viewOptions: buildTestViewOptions(testCase),
  });
  await writeFile(testCase.expectedPath, `${JSON.stringify(snapshot, null, 2)}
`);
  console.log(`wrote ${testCase.expectedPath}`);
}
