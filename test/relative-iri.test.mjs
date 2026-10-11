import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphData, compactIri, parseRdfText } from '../src/lib/rdf.js';

const TTL = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
<> a foaf:PersonalProfileDocument ; foaf:primaryTopic <#me> .
<#me> a foaf:Person ; foaf:name "Tim" .`;

test('relative IRIs resolve against the document and never yield empty ids', () => {
  const graph = buildGraphData(parseRdfText(TTL, 'tim.ttl'));
  for (const element of graph.elements) {
    for (const key of ['id', 'source', 'target']) {
      if (key in element.data) assert.notEqual(element.data[key], '', `empty ${key}`);
    }
  }
  const doc = graph.elements.find((e) => e.data.id === 'file:///tim.ttl');
  assert.ok(doc, 'document node exists');
  assert.ok(graph.elements.some((e) => e.data.source === 'file:///tim.ttl'));
  assert.equal(compactIri('file:///tim.ttl'), 'tim.ttl');
  assert.ok(graph.elements.some((e) => e.data.id === 'file:///tim.ttl#me'), '#me resolves against the document');
});
