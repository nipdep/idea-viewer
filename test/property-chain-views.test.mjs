import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphData, extractOntologyModel, parseRdfText } from '../src/lib/rdf.js';
import {
  buildOwlViewProjection,
  buildRdfViewProjection,
  createViewOptions,
  GRAPH_VIEW_MODES,
} from '../src/lib/view-projections.js';

const TTL = `@prefix : <http://ex/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:A a owl:Class . :B a owl:Class .
:hasPart a owl:ObjectProperty . :connectsTo a owl:ObjectProperty .
:serves a owl:ObjectProperty ; rdfs:domain :A ; rdfs:range :B ;
  owl:propertyChainAxiom ( :hasPart :connectsTo ) .
`;

async function project(builder, mode) {
  const quads = await parseRdfText(TTL, 'chain.ttl');
  const graphData = buildGraphData(quads, { hasKg: false, hasOntology: true, ontologyModel: extractOntologyModel(quads) });
  return builder(graphData, null, createViewOptions(mode, {}));
}

for (const [name, builder, mode] of [
  ['OWL', buildOwlViewProjection, GRAPH_VIEW_MODES.OWL],
  ['RDF', buildRdfViewProjection, GRAPH_VIEW_MODES.RDF],
]) {
  test(`${name} view marks the chain property edge and carries the chain text`, async () => {
    const elements = await project(builder, mode);
    const edges = elements.filter((element) => element.data.source);
    const chainEdge = edges.find((edge) => /serves/.test(edge.data.predicateLabel ?? ''));
    assert.ok(chainEdge, 'property edge present');
    assert.match(chainEdge.data.predicateLabel, /⛓/);
    const rows = chainEdge.data.projectedMetadataRows ?? [];
    assert.ok(rows.some((row) => row.key === 'Property chain' && /hasPart o connectsTo -> serves/.test(row.value)), JSON.stringify(rows));
  });

  test(`${name} view leaves no list connector or cons-cell nodes for the chain`, async () => {
    const elements = await project(builder, mode);
    const nodes = elements.filter((element) => !element.data.source);
    assert.deepEqual(nodes.filter((node) => node.data.kind === 'blank'), []);
    assert.deepEqual(nodes.filter((node) => /hasPart|connectsTo/.test(node.data.label ?? '')), []);
  });
}
