import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphData, extractOntologyModel, parseRdfText } from '../src/lib/rdf.js';

const PREFIXES = `@prefix : <http://ex/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`;

async function classIds(body) {
  const quads = await parseRdfText(PREFIXES + body, 'class-types.ttl');
  return buildGraphData(quads, { hasKg: false, hasOntology: true, ontologyModel: extractOntologyModel(quads) }).classes.map((entry) => entry.id).sort();
}

test('property-characteristic declarations are not offered as classes in the Class Type filter', async () => {
  const ids = await classIds(`
:p1 a owl:ObjectProperty, owl:SymmetricProperty .
:p2 a owl:ObjectProperty, owl:TransitiveProperty, owl:FunctionalProperty .
:p3 a owl:ObjectProperty, owl:InverseFunctionalProperty, owl:ReflexiveProperty, owl:IrreflexiveProperty .
:alice a :Person .
`);
  assert.deepEqual(ids, ['http://ex/Person']);
});

test('real classes of instances are still listed', async () => {
  const ids = await classIds(`:alice a :Person . :bob a :Person, :Employee . :Person a owl:Class .`);
  assert.deepEqual(ids, ['http://ex/Employee', 'http://ex/Person']);
});
