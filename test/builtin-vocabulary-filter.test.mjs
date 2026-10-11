import assert from 'node:assert/strict';
import test from 'node:test';
import { hideIsolatedBuiltinTerms, isBuiltinVocabularyIri } from '../src/lib/builtin-vocabulary-filter.js';

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
