import assert from 'node:assert/strict';
import test from 'node:test';
import { createBaseIriResolver, namespaceOf } from '../src/lib/base-iri.js';

const VC = 'https://tw.rpi.edu/ontology-engineering/oe2026/ventilation-compliance/ventilation-compliance';

test('the base is the IRI minus its local name, so entities of one namespace share a base (the reported bug)', () => {
  const base = `${VC}/`;
  ['appliesTo', 'Assessment', 'connectsTo', 'evaluatesOn'].forEach((name) => {
    assert.equal(namespaceOf(`${VC}/${name}`), base, name);
  });
  const resolve = createBaseIriResolver();
  assert.equal(resolve(`${VC}/appliesTo`), resolve(`${VC}/Assessment`), 'two entities, one base');
});

test('hash namespaces keep the hash, and well-known vocabularies resolve to their real namespace', () => {
  assert.equal(namespaceOf('http://www.w3.org/2004/02/skos/core#Concept'), 'http://www.w3.org/2004/02/skos/core#');
  assert.equal(namespaceOf('http://purl.org/dc/terms/title'), 'http://purl.org/dc/terms/');
  assert.equal(namespaceOf('https://saref.etsi.org/saref4bldg/Sensor'), 'https://saref.etsi.org/saref4bldg/');
});

test('IRIs without a path, and non-http IRIs, still give a usable base', () => {
  assert.equal(namespaceOf('https://saref.etsi.org'), 'https://saref.etsi.org/');
  assert.equal(namespaceOf('urn:example:thing'), 'urn:example:');
  assert.equal(namespaceOf(''), '');
});

test('a declared ontology groups its entities and itself under one base', () => {
  const saref = 'https://saref.etsi.org/saref4bldg';
  const resolve = createBaseIriResolver({ ontologyIris: [saref], iris: [`${saref}/Sensor`] });
  assert.equal(resolve(saref), `${saref}/`, 'the ontology IRI sits in the namespace it defines');
  assert.equal(resolve(`${saref}/Sensor`), `${saref}/`);
});

test('an ontology that uses hash terms gets a hash base', () => {
  const onto = 'http://example.org/onto';
  const resolve = createBaseIriResolver({ ontologyIris: [onto], iris: [`${onto}#A`, `${onto}#B`] });
  assert.equal(resolve(onto), `${onto}#`);
  assert.equal(resolve(`${onto}#A`), `${onto}#`);
});

test('sub-paths of a declared ontology collapse under it, and the nearest declared ontology wins', () => {
  const resolve = createBaseIriResolver({
    ontologyIris: ['http://example.org/onto', 'http://example.org/onto/sub'],
    iris: ['http://example.org/onto/classes/Foo', 'http://example.org/onto/sub/Bar'],
  });
  assert.equal(resolve('http://example.org/onto/classes/Foo'), 'http://example.org/onto/');
  assert.equal(resolve('http://example.org/onto/sub/Bar'), 'http://example.org/onto/sub/');
});

test('an ontology IRI that is not a prefix of anything does not capture unrelated IRIs', () => {
  const resolve = createBaseIriResolver({ ontologyIris: ['http://example.org/onto'], iris: [] });
  assert.equal(resolve('http://example.org/ontology-two/X'), 'http://example.org/ontology-two/');
});
