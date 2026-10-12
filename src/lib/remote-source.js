// Loading RDF documents straight from a URL. The result is wrapped as a File by the caller, so parsing,
// merging and the rest of the pipeline treat it exactly like an uploaded file.
//
// Everything runs in the browser, so the server must allow cross-origin reads (CORS); there is deliberately
// no proxy, because that would send the user's data through a third party.

// Must stay at most 128 bytes: browsers only treat Accept as a "simple" header up to that length. A longer
// value forces a CORS preflight (OPTIONS) request, which most ontology servers do not answer, so every
// cross-origin load would fail.
export const RDF_ACCEPT_HEADER = 'text/turtle, application/rdf+xml;q=0.9, application/n-triples;q=0.8, text/n3;q=0.7, */*;q=0.1';

const EXTENSION_BY_CONTENT_TYPE = new Map([
  ['text/turtle', '.ttl'],
  ['application/x-turtle', '.ttl'],
  ['application/rdf+xml', '.rdf'],
  ['application/xml', '.rdf'],
  ['text/xml', '.rdf'],
  ['application/n-triples', '.nt'],
  ['application/n-quads', '.nq'],
  ['application/trig', '.trig'],
  ['text/n3', '.n3'],
  ['text/rdf+n3', '.n3'],
]);
const KNOWN_EXTENSIONS = ['.ttl', '.rdf', '.owl', '.n3', '.nt', '.nq', '.trig'];

export class RemoteSourceError extends Error {}

/** Cleans what the user typed/pasted into a fetchable http(s) URL, or throws a user-facing error. */
export function normalizeSourceUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) {
    throw new RemoteSourceError('Enter a URL to load.');
  }
  // "www.w3.org/ns/odrl/2/" -> https; anything else with a scheme must be http(s).
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new RemoteSourceError(`"${raw}" is not a valid URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RemoteSourceError('Only http:// and https:// URLs can be loaded.');
  }

  // A GitHub "blob" link is an HTML page; the file itself lives on raw.githubusercontent.com.
  const blob = url.hostname === 'github.com' && url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (blob) {
    return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}${url.search}`;
  }
  url.hash = '';
  return url.toString();
}

export function extensionForContentType(contentType) {
  const type = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  return EXTENSION_BY_CONTENT_TYPE.get(type) ?? '';
}

/** A file name that format detection can work with: keep a known extension, else derive one from the content type. */
export function fileNameFromUrl(urlString, contentType = '') {
  const url = new URL(urlString);
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  const extension = extensionForContentType(contentType) || '.ttl';
  if (segments.length === 0) {
    return `${url.hostname}${extension}`;
  }

  let base = segments[segments.length - 1];
  if (KNOWN_EXTENSIONS.some((known) => base.toLowerCase().endsWith(known))) {
    return base;
  }
  // ".../odrl/2/" would otherwise be named "2": keep the vocabulary name with the bare version number.
  if (/^v?\d+(\.\d+)*$/i.test(base) && segments.length > 1) {
    base = `${segments[segments.length - 2]}-${base}`;
  } else {
    // "ontology.php", "schema.html" ...: drop the misleading extension, the content type decides the format.
    base = base.replace(/\.[a-z0-9]{1,5}$/i, '') || base;
  }
  return `${base}${extension}`;
}

export function describeFetchFailure(error, urlString) {
  if (error instanceof RemoteSourceError) {
    return error.message;
  }
  if (error?.name === 'AbortError') {
    return 'The request timed out. The server did not answer in time.';
  }
  const insecure = typeof window !== 'undefined' && window.location?.protocol === 'https:' && urlString.startsWith('http:');
  if (insecure) {
    return 'The browser blocked this http:// address from an https:// page. Try the https:// version of the URL.';
  }
  return (
    'Could not read this URL from the browser. The server may be unreachable, or it does not allow ' +
    'cross-origin access (CORS). Download the file and upload it instead.'
  );
}

/**
 * @returns {Promise<{text: string, name: string, sourceUrl: string, contentType: string, lastModified: number}>}
 */
export async function fetchRdfSource(input, { fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
  const requestUrl = normalizeSourceUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(requestUrl, {
      headers: { Accept: RDF_ACCEPT_HEADER },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new RemoteSourceError(`The server answered ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    if (!text.trim()) {
      throw new RemoteSourceError('The URL returned an empty document.');
    }
    if (/^text\/html|^application\/xhtml/i.test(contentType) || /^\s*<!doctype html|^\s*<html[\s>]/i.test(text.slice(0, 300))) {
      throw new RemoteSourceError(
        'The URL returned a web page, not RDF. Use a link to the file itself (for GitHub, the "Raw" link).',
      );
    }
    const sourceUrl = response.url || requestUrl;
    const lastModifiedHeader = Date.parse(response.headers.get('last-modified') ?? '');
    return {
      text,
      name: fileNameFromUrl(sourceUrl, contentType),
      sourceUrl,
      contentType,
      // Stable per document, so loading the same URL twice is recognised as a duplicate.
      lastModified: Number.isFinite(lastModifiedHeader) ? lastModifiedHeader : 0,
    };
  } catch (error) {
    throw new RemoteSourceError(describeFetchFailure(error, requestUrl));
  } finally {
    clearTimeout(timer);
  }
}
