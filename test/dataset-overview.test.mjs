import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDatasetOverview, humanizePredicate } from '../src/lib/dataset-overview.js';

const ONT = 'https://ex.org/onto/';
const row = (predicateIri, valueText, extra = {}) => ({
  subjectIri: ONT,
  predicateIri,
  valueText,
  valueIsIri: false,
  valueIri: '',
  ...extra,
});

test('humanizes predicate names', () => {
  assert.equal(humanizePredicate('http://www.w3.org/2002/07/owl#versionIRI'), 'Version IRI');
  assert.equal(humanizePredicate('http://purl.org/dc/terms/abstract'), 'Abstract');
});

test('groups header statements: title, facts, imports, annotations; drops rdf:type', () => {
  const overview = buildDatasetOverview([
    row('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'owl:Ontology'),
    row('http://purl.org/dc/terms/title', 'Ventilation'),
    row('http://www.w3.org/2002/07/owl#versionIRI', ONT + 'v1', { valueIsIri: true, valueIri: ONT + 'v1' }),
    row('http://www.w3.org/2002/07/owl#imports', 'a', { valueIsIri: true, valueIri: 'https://a.org/' }),
    row('http://www.w3.org/2002/07/owl#imports', 'b', { valueIsIri: true, valueIri: 'https://b.org/' }),
    row('http://www.w3.org/2002/07/owl#imports', 'b', { valueIsIri: true, valueIri: 'https://b.org/' }),
    row('http://purl.org/dc/terms/abstract', 'About'),
  ]);
  assert.equal(overview.title, 'Ventilation');
  assert.equal(overview.ontologyIri, ONT);
  assert.deepEqual(overview.facts.map((f) => f.label), ['Version IRI']);
  assert.equal(overview.imports.length, 2, 'duplicate import collapsed');
  assert.deepEqual(overview.annotations.map((a) => a.label), ['Abstract']);
});

test('falls back to the ontology IRI name when there is no title; null when empty', () => {
  assert.equal(buildDatasetOverview([row('http://purl.org/dc/terms/abstract', 'x')]).title, 'onto');
  assert.equal(buildDatasetOverview([]), null);
});
