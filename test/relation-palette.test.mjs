import assert from 'node:assert/strict';
import test from 'node:test';
import { relationPaletteCategory } from '../src/lib/relation-palette.js';

const OWL = 'http://www.w3.org/2002/07/owl#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

test('built-in rdf, rdfs and owl relations are gray ("base")', () => {
  [`${RDF}type`, `${RDFS}subClassOf`, `${OWL}equivalentClass`, `${OWL}sameAs`, `${OWL}differentFrom`,
    `${OWL}disjointWith`, `${OWL}complementOf`, `${OWL}inverseOf`, `${OWL}intersectionOf`, 'owl:equivalentClass', 'rdfs:subClassOf']
    .forEach((predicate) => assert.equal(relationPaletteCategory(predicate), 'base', predicate));
});

test('relations the ontology defines are brown ("property"), including ones that merely look similar', () => {
  ['http://example.org/hasPart', 'http://example.org/owl#equivalentClass', 'http://www.w3.org/2002/07/owlish#x',
    'http://xmlns.com/foaf/0.1/knows', '', undefined, null]
    .forEach((predicate) => assert.equal(relationPaletteCategory(predicate), 'property', String(predicate)));
});
