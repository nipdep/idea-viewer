// Base IRI (namespace) of an entity, for the Base IRI filter, SPARQL prefixes and the inspector.
//
// The base is the IRI minus its local name: everything up to and including the last '#' or '/'. Where the data
// declares an ontology (owl:Ontology / owl:imports / owl:versionIRI), entities under that ontology IRI group under
// it, so an ontology with sub-paths is one base and the ontology IRI itself sits in the group it defines.
//
// The previous version guessed an "ontology acronym" among the path segments (a short word with a capital letter).
// For https://example.org/ontology-engineering/oe2026/ventilation-compliance/appliesTo none of the namespace segments
// qualified but the local name `appliesTo` did, so every entity became its own "base IRI".

/** The namespace part of an IRI: up to and including the last '#' or '/'. */
export function namespaceOf(iri) {
  if (!iri) {
    return '';
  }
  const hashIndex = iri.lastIndexOf('#');
  if (hashIndex >= 0) {
    return iri.slice(0, hashIndex + 1);
  }
  try {
    const url = new URL(iri);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      // "https://saref.etsi.org" has no path: the host is the namespace.
      return url.pathname === '' || url.pathname === '/' ? `${url.origin}/` : iri.slice(0, iri.lastIndexOf('/') + 1);
    }
  } catch {
    // not an absolute URL: fall through to the generic splits
  }
  const slashIndex = iri.lastIndexOf('/');
  if (slashIndex >= 0) {
    return iri.slice(0, slashIndex + 1);
  }
  const colonIndex = iri.lastIndexOf(':');
  return colonIndex >= 0 ? iri.slice(0, colonIndex + 1) : iri;
}

/**
 * @param {{iris?: Iterable<string>, ontologyIris?: Iterable<string>}} context
 *   iris: the named IRIs present in the data (decides whether an ontology's namespace ends in '#' or '/')
 *   ontologyIris: IRIs declared as ontologies (or imported / versioned ontologies)
 * @returns {(iri: string) => string} resolves an IRI to its base
 */
export function createBaseIriResolver({ iris = [], ontologyIris = [] } = {}) {
  const known = Array.isArray(iris) ? iris : [...iris];
  const rootByOntology = new Map();
  for (const ontologyIri of new Set(ontologyIris)) {
    if (!ontologyIri || typeof ontologyIri !== 'string') {
      continue;
    }
    if (ontologyIri.endsWith('/') || ontologyIri.endsWith('#')) {
      rootByOntology.set(ontologyIri, ontologyIri);
    } else {
      const usesHash = known.some((iri) => iri.startsWith(`${ontologyIri}#`));
      rootByOntology.set(ontologyIri, `${ontologyIri}${usesHash ? '#' : '/'}`);
    }
  }
  // Longest root first, so a nested ontology wins over the one that contains it.
  const roots = [...new Set(rootByOntology.values())].sort((a, b) => b.length - a.length);
  const cache = new Map();

  return (iri) => {
    if (!iri) {
      return '';
    }
    const cached = cache.get(iri);
    if (cached !== undefined) {
      return cached;
    }
    const base = rootByOntology.get(iri) ?? roots.find((root) => iri.startsWith(root)) ?? namespaceOf(iri);
    cache.set(iri, base);
    return base;
  };
}
