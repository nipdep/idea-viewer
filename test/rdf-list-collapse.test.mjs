import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphData, extractOntologyModel, parseRdfText } from '../src/lib/rdf.js';
import { buildRdfViewProjection, createViewOptions, GRAPH_VIEW_MODES } from '../src/lib/view-projections.js';

const PREFIXES = `@prefix : <http://ex/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
`;
const short = (iri) => String(iri).split(/[#/]/).pop();

async function project(body) {
  const quads = await parseRdfText(PREFIXES + body, 'list-test.ttl');
  const graphData = buildGraphData(quads, { hasKg: false, hasOntology: true, ontologyModel: extractOntologyModel(quads) });
  const elements = buildRdfViewProjection(graphData, null, createViewOptions(GRAPH_VIEW_MODES.RDF, {}));
  const nodes = elements.filter((element) => !element.data.source);
  const edges = elements.filter((element) => element.data.source);
  return {
    nodes,
    edges,
    rawListEdges: edges.filter((edge) => ['first', 'rest'].includes(short(edge.data.predicate))),
    connectors: nodes.filter((node) => String(node.data.id).startsWith('rdf-list:')),
    memberEdges: (connectorId) =>
      edges.filter((edge) => edge.data.source === connectorId).map((edge) => [edge.data.predicateLabel, short(edge.data.target)]),
  };
}

test('the plain cons cells behind owl:unionOf collapse into one connector with positional member edges', async () => {
  const result = await project(':A a owl:Class ; owl:equivalentClass [ a owl:Class ; owl:unionOf ( :B :C :D ) ] .');
  assert.equal(result.rawListEdges.length, 0, 'no first/rest edges are drawn');
  assert.equal(result.connectors.length, 1);
  assert.deepEqual(result.memberEdges(result.connectors[0].data.id), [['1st', 'B'], ['2nd', 'C'], ['3rd', 'D']]);
  const incoming = result.edges.filter((edge) => edge.data.target === result.connectors[0].data.id);
  assert.deepEqual(incoming.map((edge) => short(edge.data.predicate)), ['unionOf'], 'the unionOf edge now ends at the connector');
});

// The two malformed-list tests hang the list off owl:unionOf: that is the case the plain-cons-cell rule handles
// (a head reached from an ordinary property was already classified as a List and collapsed before this rule).
test('a list that does not end in rdf:nil is not reinterpreted: its raw triples stay visible', async () => {
  const result = await project(`:A owl:equivalentClass [ owl:unionOf _:a ] .
_:a rdf:first :B ; rdf:rest _:b . _:b rdf:first :C .`);
  assert.equal(result.connectors.length, 0);
  assert.ok(result.rawListEdges.length >= 3, 'first/rest edges are still drawn');
});

test('a list whose cell has two rdf:first values is malformed and stays raw', async () => {
  const result = await project(`:A owl:equivalentClass [ owl:unionOf _:a ] .
_:a rdf:first :B, :C ; rdf:rest rdf:nil .`);
  assert.equal(result.connectors.length, 0);
});

test('a list nested in a list points at the inner list connector, not at a hidden cell', async () => {
  const result = await project(':X :p ( :B ( :C :D ) ) .');
  assert.equal(result.connectors.length, 2);
  const nodeIds = new Set(result.nodes.map((node) => node.data.id));
  result.edges.forEach((edge) => {
    assert.ok(nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target), `edge ${edge.data.id} has both endpoints`);
  });
  const outer = result.connectors.find((connector) => result.edges.some((edge) => edge.data.target === connector.data.id && short(edge.data.predicate) === 'p'));
  const memberTargets = result.edges.filter((edge) => edge.data.source === outer.data.id).map((edge) => edge.data.target);
  assert.ok(memberTargets.some((target) => String(target).startsWith('rdf-list:')), 'one member of the outer list is the inner connector');
});

test('literal members are kept (they are not in graphData.objectEdges)', async () => {
  const result = await project(':D a owl:DataRange ; owl:oneOf ( "red" "green" ) .');
  assert.equal(result.connectors.length, 1);
  assert.equal(result.memberEdges(result.connectors[0].data.id).length, 2);
});

test('every edge in the projection keeps both of its endpoints after collapsing', async () => {
  const result = await project(':A owl:equivalentClass [ owl:intersectionOf ( :B [ a owl:Restriction ; owl:onProperty :p ; owl:someValuesFrom :C ] ) ] .');
  const nodeIds = new Set(result.nodes.map((node) => node.data.id));
  result.edges.forEach((edge) => assert.ok(nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target), edge.data.id));
});
