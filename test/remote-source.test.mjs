import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extensionForContentType,
  fetchRdfSource,
  fileNameFromUrl,
  normalizeSourceUrl,
  RDF_ACCEPT_HEADER,
} from '../src/lib/remote-source.js';

const fakeResponse = ({ status = 200, statusText = 'OK', body = '', headers = {}, url = '' } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  url,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text: async () => body,
});

test('normalizeSourceUrl: scheme defaults, rejects non-http, rewrites GitHub blob links, drops the fragment', () => {
  assert.equal(normalizeSourceUrl('  www.w3.org/ns/odrl/2/ '), 'https://www.w3.org/ns/odrl/2/');
  assert.equal(normalizeSourceUrl('http://example.org/a.ttl#frag'), 'http://example.org/a.ttl');
  assert.equal(
    normalizeSourceUrl('https://github.com/acme/onto/blob/main/src/model.ttl'),
    'https://raw.githubusercontent.com/acme/onto/main/src/model.ttl',
  );
  assert.throws(() => normalizeSourceUrl('ftp://example.org/a.ttl'), /http/);
  assert.throws(() => normalizeSourceUrl('file:///etc/passwd'), /http/);
  assert.throws(() => normalizeSourceUrl('   '), /Enter a URL/);
  assert.throws(() => normalizeSourceUrl('http://'), /not a valid URL/);
});

test('fileNameFromUrl keeps known extensions and otherwise derives one from the content type', () => {
  assert.equal(fileNameFromUrl('https://example.org/onto/model.owl'), 'model.owl');
  assert.equal(fileNameFromUrl('https://www.w3.org/ns/odrl/2/', 'text/turtle; charset=utf-8'), 'odrl-2.ttl');
  assert.equal(fileNameFromUrl('https://example.org/vocab', 'application/rdf+xml'), 'vocab.rdf');
  assert.equal(fileNameFromUrl('https://example.org/ontology.php', 'text/turtle'), 'ontology.ttl');
  assert.equal(fileNameFromUrl('https://example.org/vocab', 'application/octet-stream'), 'vocab.ttl');
  assert.equal(fileNameFromUrl('https://example.org/'), 'example.org.ttl');
  assert.equal(extensionForContentType('APPLICATION/N-Triples'), '.nt');
});

test('fetchRdfSource asks for RDF via content negotiation and returns the document', async () => {
  let seen;
  const result = await fetchRdfSource('https://example.org/vocab', {
    fetchImpl: async (url, options) => {
      seen = { url, accept: options.headers.Accept };
      return fakeResponse({ body: '@prefix : <#> . :a :b :c .', headers: { 'content-type': 'text/turtle' }, url: 'https://example.org/vocab.ttl' });
    },
  });
  assert.equal(seen.accept, RDF_ACCEPT_HEADER);
  assert.equal(result.name, 'vocab.ttl');
  assert.equal(result.sourceUrl, 'https://example.org/vocab.ttl', 'the post-redirect URL is the document base');
  assert.match(result.text, /:a :b :c/);
});

test('fetchRdfSource explains HTTP errors, HTML pages, empty bodies and network/CORS failures', async () => {
  const run = (impl) => fetchRdfSource('https://example.org/x', { fetchImpl: impl });
  await assert.rejects(run(async () => fakeResponse({ status: 404, statusText: 'Not Found' })), /404 Not Found/);
  await assert.rejects(
    run(async () => fakeResponse({ body: '<!DOCTYPE html><html></html>', headers: { 'content-type': 'text/html' } })),
    /web page, not RDF/,
  );
  await assert.rejects(run(async () => fakeResponse({ body: '   ' })), /empty/);
  await assert.rejects(run(async () => { throw new TypeError('Failed to fetch'); }), /CORS/);
});

test('fetchRdfSource aborts a request that exceeds the timeout', async () => {
  const slow = (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  await assert.rejects(fetchRdfSource('https://example.org/slow', { fetchImpl: slow, timeoutMs: 20 }), /timed out/);
});

test('the same URL yields the same lastModified, so loading it twice is a duplicate', async () => {
  const impl = async () => fakeResponse({ body: 'a', headers: { 'content-type': 'text/turtle' } });
  const first = await fetchRdfSource('https://example.org/a.ttl', { fetchImpl: impl });
  const second = await fetchRdfSource('https://example.org/a.ttl', { fetchImpl: impl });
  assert.equal(first.lastModified, second.lastModified);
});

test('the Accept header stays within the 128-byte limit that avoids a CORS preflight', () => {
  assert.ok(RDF_ACCEPT_HEADER.length <= 128, `Accept header is ${RDF_ACCEPT_HEADER.length} bytes`);
  assert.match(RDF_ACCEPT_HEADER, /^text\/turtle/, 'Turtle is preferred, so content negotiation picks it');
});
