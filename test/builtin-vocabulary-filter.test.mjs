import assert from 'node:assert/strict';
import test from 'node:test';
import { filterBuiltinVocabulary, hideIsolatedBuiltinTerms, hideRdfPrimitives, isBuiltinVocabularyIri } from '../src/lib/builtin-vocabulary-filter.js';

const node = (id, iri = id) => ({ data: { id, iri } });
const edge = (source, target) => ({ data: { id: `${source}->${target}`, source, target } });
const ids = (elements) => elements.filter((e) => !e.data.source).map((e) => e.data.id);

test('isolated built-in vocabulary terms are hidden, domain terms are kept', () => {
  const elements = [
    node('http://www.w3.org/2002/07/owl#Thing'),
    node('http://www.w3.org/2000/01/rdf-schema#Literal'),
    node('http://www.w3.org/2001/XMLSchema#anyURI'),
    node('http://www.w3.org/2004/02/skos/core#ConceptScheme'),
    node('http://example.org/Policy'),
  ];
  assert.deepEqual(ids(hideIsolatedBuiltinTerms(elements)), ['http://example.org/Policy']);
});

test('built-in terms with edges stay, since they shape the graph', () => {
  const thing = 'http://www.w3.org/2002/07/owl#Thing';
  const elements = [node(thing), node('http://example.org/Agent'), edge('http://example.org/Agent', thing)];
  assert.equal(hideIsolatedBuiltinTerms(elements).length, 3);
});

test('keepIds protects an explicitly focused built-in term', () => {
  const thing = 'http://www.w3.org/2002/07/owl#Thing';
  assert.deepEqual(ids(hideIsolatedBuiltinTerms([node(thing)], [thing])), [thing]);
});

test('helper nodes, blank nodes and non-IRI data are never touched', () => {
  const elements = [{ data: { id: 'anchor', edgeAnchor: 1 } }, { data: { id: '_:b0' } }, node('plain-no-iri', undefined)];
  assert.equal(hideIsolatedBuiltinTerms(elements).length, 3);
  assert.equal(isBuiltinVocabularyIri(undefined), false);
});

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const typed = (source, target) => ({ data: { id: `${source}-type-${target}`, source, target, predicate: RDF_TYPE } });
const OWL = 'http://www.w3.org/2002/07/owl#';

test('primitives named by rdf:type (owl:Class, owl:Restriction) are hidden with their type edges', () => {
  const elements = [
    node('http://ex/Policy'), node(`${OWL}Class`), node('_:r', undefined), node(`${OWL}Restriction`),
    typed('http://ex/Policy', `${OWL}Class`), typed('_:r', `${OWL}Restriction`),
    edge('_:r', 'http://ex/Policy'),
  ];
  const result = hideRdfPrimitives(elements);
  assert.deepEqual(ids(result).sort(), ['_:r', 'http://ex/Policy']);
  assert.equal(result.filter((e) => e.data.source).length, 1, 'only the real edge is left');
});

test('rdf:nil that ends a visible list is kept, so the last list cell is not left dangling', () => {
  const nil = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
  const rest = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
  const cell = { data: { id: '_:cell2', kind: 'blank' } };
  const toNil = { data: { id: 'rest-nil', source: '_:cell2', target: nil, predicate: rest } };
  const result = filterBuiltinVocabulary([cell, node(nil), toNil]);
  assert.deepEqual(ids(result).sort(), ['_:cell2', nil].sort());
  assert.equal(result.filter((e) => e.data.source).length, 1, 'the rest -> nil edge survives');
});

test('an rdf:nil that nothing points at is dropped as an isolated built-in term', () => {
  const nil = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
  assert.deepEqual(ids(filterBuiltinVocabulary([node(nil), node('http://ex/A')])), ['http://ex/A']);
});

test('owl:Thing and rdfs:Literal are drawn per the formatting spec, even when they are rdf:type objects', () => {
  const thing = `${OWL}Thing`;
  const elements = [node('http://ex/A'), node(thing), typed('http://ex/A', thing)];
  assert.deepEqual(ids(hideRdfPrimitives(elements)).sort(), ['http://ex/A', thing].sort());
});

test('edge-anchor helpers go with a removed edge, and terms orphaned by the removal are then dropped', () => {
  const skosCollection = 'http://www.w3.org/2004/02/skos/core#Collection';
  const elements = [
    node('http://ex/A'), node(`${OWL}Class`), node(skosCollection),
    { data: { id: 'anchor1', edgeAnchor: 1, anchoredSourceId: 'http://ex/A', anchoredTargetId: `${OWL}Class` } },
    { data: { id: 'anchor1:source', source: 'http://ex/A', target: 'anchor1' } },
    typed('http://ex/A', `${OWL}Class`),
    typed(skosCollection, `${OWL}Class`),
  ];
  const result = filterBuiltinVocabulary(elements);
  assert.deepEqual(ids(result), ['http://ex/A']);
  assert.equal(result.length, 1, 'no dangling anchor or tether edge');
});
