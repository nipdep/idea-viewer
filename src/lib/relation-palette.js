// Edge colour class of a relation. Built-in vocabulary relations (rdf:, rdfs:, owl:) are drawn in the quiet gray
// "base" colour; only relations the ontology itself defines get the brown "property" colour. That keeps the
// frequent, structural statements (rdf:type, rdfs:subClassOf, owl:equivalentClass, owl:sameAs ...) from competing
// with the domain relations the reader is actually looking for.
const BUILTIN_NAMESPACES = [
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'http://www.w3.org/2000/01/rdf-schema#',
  'http://www.w3.org/2002/07/owl#',
];
const BUILTIN_PREFIXES = ['rdf:', 'rdfs:', 'owl:'];

export function relationPaletteCategory(predicate) {
  if (
    typeof predicate === 'string' &&
    (BUILTIN_NAMESPACES.some((namespace) => predicate.startsWith(namespace)) ||
      BUILTIN_PREFIXES.some((prefix) => predicate.startsWith(prefix)))
  ) {
    return 'base';
  }
  return 'property';
}
