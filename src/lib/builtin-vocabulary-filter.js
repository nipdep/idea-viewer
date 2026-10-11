// Hides W3C core vocabulary terms (owl:Thing, rdfs:Literal, xsd:anyURI, skos:ConceptScheme, ...) that are
// declared in an ontology but connect to nothing, so they only add clutter. Terms that do have edges are
// part of the graph's structure (e.g. owl:Thing as a superclass) and are kept.
const BUILTIN_NAMESPACES = [
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'http://www.w3.org/2000/01/rdf-schema#',
  'http://www.w3.org/2002/07/owl#',
  'http://www.w3.org/2001/XMLSchema#',
  'http://www.w3.org/2004/02/skos/core#',
];

export function isBuiltinVocabularyIri(iri) {
  return typeof iri === 'string' && BUILTIN_NAMESPACES.some((namespace) => iri.startsWith(namespace));
}

/**
 * @param elements Cytoscape element JSON ({data: {...}}) for nodes and edges
 * @param keepIds node ids that must stay (e.g. explicitly focused nodes)
 */
export function hideIsolatedBuiltinTerms(elements, keepIds = []) {
  if (!Array.isArray(elements)) {
    return elements;
  }
  const keep = new Set(keepIds);
  const connected = new Set();
  elements.forEach((element) => {
    const data = element?.data;
    if (data?.source) {
      connected.add(data.source);
      connected.add(data.target);
    }
  });
  return elements.filter((element) => {
    const data = element?.data;
    if (!data || data.source || data.edgeAnchor === 1 || data.edgeBendHandle === 1) {
      return true;
    }
    return !isBuiltinVocabularyIri(data.iri) || connected.has(data.id) || keep.has(data.id);
  });
}
