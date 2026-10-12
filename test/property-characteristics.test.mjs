import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphData, extractOntologyModel, parseRdfText } from '../src/lib/rdf.js';
import { buildOwlViewProjection, createViewOptions, GRAPH_VIEW_MODES } from '../src/lib/view-projections.js';

const PREFIXES = `@prefix : <http://ex/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`;

async function owlEdgeLabels(body) {
  const quads = await parseRdfText(PREFIXES + body, 'characteristics.ttl');
  const graphData = buildGraphData(quads, { hasKg: false, hasOntology: true, ontologyModel: extractOntologyModel(quads) });
  const elements = buildOwlViewProjection(graphData, null, createViewOptions(GRAPH_VIEW_MODES.OWL, {}));
  return {
    labels: elements.filter((element) => element.data.source).map((element) => element.data.predicateLabel),
    classIds: graphData.classes.map((entry) => entry.id),
  };
}

test('property characteristics still mark the edge label, while not being offered as classes', async () => {
  const { labels, classIds } = await owlEdgeLabels(`
:A a owl:Class . :B a owl:Class .
:isCloserThan a owl:ObjectProperty, owl:TransitiveProperty ; rdfs:domain :A ; rdfs:range :B .
:neighbor a owl:ObjectProperty, owl:SymmetricProperty ; rdfs:domain :A ; rdfs:range :B .
`);
  assert.ok(labels.some((label) => /isCloserThan \[T\]/.test(label)), `transitive marker in ${JSON.stringify(labels)}`);
  assert.ok(labels.some((label) => /neighbor \[S\]/.test(label)), `symmetric marker in ${JSON.stringify(labels)}`);
  assert.deepEqual(classIds.filter((id) => /Property$/.test(id)), [], 'characteristic types are not classes');
});
