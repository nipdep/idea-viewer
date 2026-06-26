import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRAPH_VIEW_MODES } from '../src/lib/view-projections.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectionTestManifest = [
  {
    id: 'owl-class-declaration',
    title: 'OWL | Classes | Class Declaration | exact-snapshot',
    family: 'Classes',
    category: 'Class Declaration',
    strategy: 'exact-snapshot',
    view: 'owl',
    mode: GRAPH_VIEW_MODES.OWL,
    projectionLevel: 'ontology',
    purpose: 'Verify that a minimal owl:Class declaration is recognized as a class node in OWL view.',
    dependencies: [],
    targetAssertions: [
      'contains one normalized class node for Person',
      'contains no edges',
      'contains no helper nodes',
    ],
    fixturePath: path.join(__dirname, 'fixtures/projections/owl/class-declaration.ttl'),
    expectedPath: path.join(__dirname, 'fixtures/projections/owl/class-declaration.expected.json'),
  },
];
