import assert from 'node:assert/strict';
import test from 'node:test';
import { Store } from 'n3';
import { formatPropertyChain, markChainLabel, PROPERTY_CHAIN_MARK, readPropertyChains } from '../src/lib/property-chains.js';
import { parseRdfText } from '../src/lib/rdf.js';

const PREFIXES = `@prefix : <http://ex/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`;
const local = (iri) => iri.split('/').pop();
async function chainsOf(body) {
  const quads = await parseRdfText(PREFIXES + body, 'chains.ttl');
  return readPropertyChains(new Store(quads), local);
}

test('a chain is read from the list behind owl:propertyChainAxiom', async () => {
  const result = await chainsOf(':serversRoom a owl:ObjectProperty ; owl:propertyChainAxiom ( :hasServiceComponent :connectsTo ) .');
  const chains = result.byProperty.get('http://ex/serversRoom');
  assert.equal(chains.length, 1);
  assert.deepEqual(chains[0].members.map((member) => member.label), ['hasServiceComponent', 'connectsTo']);
  assert.equal(result.memberIds.size, 2);
  assert.ok(result.headIds.has(chains[0].headId));
  assert.equal(result.cellIds.size, 2);
});

test('the chain text reads member o member -> property', async () => {
  const result = await chainsOf(':serversRoom owl:propertyChainAxiom ( :hasServiceComponent :connectsTo ) .');
  const { members } = result.byProperty.get('http://ex/serversRoom')[0];
  assert.equal(formatPropertyChain(members, 'serversRoom'), 'hasServiceComponent o connectsTo -> serversRoom');
});

test('several chains for one property are all kept', async () => {
  const result = await chainsOf(':p owl:propertyChainAxiom ( :a :b ) ; owl:propertyChainAxiom ( :c :d :e ) .');
  assert.deepEqual(result.byProperty.get('http://ex/p').map((chain) => chain.members.length).sort(), [2, 3]);
});

test('an inverse member is read and printed as "inverse p"', async () => {
  const result = await chainsOf(':p owl:propertyChainAxiom ( :a [ owl:inverseOf :b ] ) .');
  const { members } = result.byProperty.get('http://ex/p')[0];
  assert.deepEqual(members.map((member) => [member.id, member.inverse]), [['http://ex/a', false], ['http://ex/b', true]]);
  assert.equal(formatPropertyChain(members, 'p'), 'a o inverse b -> p');
});

test('a malformed chain (not closed by rdf:nil, or an unreadable member) is ignored, not guessed at', async () => {
  const open = await chainsOf(`:p owl:propertyChainAxiom _:l . _:l <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> :a ; <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> _:m . _:m <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> :b .`);
  assert.equal(open.byProperty.size, 0);
  const literal = await chainsOf(':p owl:propertyChainAxiom ( :a "not a property" ) .');
  assert.equal(literal.byProperty.size, 0);
});

test('markChainLabel prefixes once', () => {
  assert.equal(markChainLabel('serversRoom'), `${PROPERTY_CHAIN_MARK} serversRoom`);
  assert.equal(markChainLabel(markChainLabel('serversRoom')), `${PROPERTY_CHAIN_MARK} serversRoom`);
  assert.equal(markChainLabel(''), '');
});

test('list ids use the same form as graph node ids ("_:" + label for blank nodes)', async () => {
  const result = await chainsOf(':p owl:propertyChainAxiom ( :a :b ) .');
  [...result.headIds, ...result.cellIds].forEach((id) => assert.match(id, /^_:/, id));
  assert.ok([...result.cellIds].includes([...result.headIds][0]), 'the head is one of the cells');
});
