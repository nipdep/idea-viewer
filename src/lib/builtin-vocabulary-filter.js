// Keeps W3C core vocabulary out of the drawing. Shape and style already say "this is a class / restriction /
// property" (see the formatting figure in docs), so the terms that merely name those categories are noise.
//
//  1. Primitives: rdf/rdfs/owl terms used as the object of rdf:type (owl:Class, owl:Restriction,
//     owl:ObjectProperty, rdf:Property, ...), together with every edge that touches them.
//     owl:Thing, rdfs:Resource and rdfs:Literal are kept: the formatting spec draws them as resources/literals.
//     rdf:nil is NOT a primitive: when the RDF view shows a list as raw first/rest cells, rdf:nil is what ends the
//     last cell, and hiding it left that cell dangling with its `rest` edge cut off. (Lists that are collapsed
//     into one connector never reach this filter with a nil, and an unattached nil is dropped by rule 2.)
//  2. Isolated built-in terms (owl:Thing, skos:ConceptScheme, xsd:anyURI, ...) that connect to nothing.
//     Connected ones are part of the graph's structure and stay.
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const BUILTIN_NAMESPACES = [RDF_NS, RDFS_NS, OWL_NS, 'http://www.w3.org/2001/XMLSchema#', 'http://www.w3.org/2004/02/skos/core#'];
const PRIMITIVE_NAMESPACES = [RDF_NS, RDFS_NS, OWL_NS];
const RDF_TYPE = `${RDF_NS}type`;
const DRAWN_AS_RESOURCES = new Set([`${OWL_NS}Thing`, `${RDFS_NS}Resource`, `${RDFS_NS}Literal`]);

export function isBuiltinVocabularyIri(iri) {
  return typeof iri === 'string' && BUILTIN_NAMESPACES.some((namespace) => iri.startsWith(namespace));
}

const isPrimitiveIri = (iri) =>
  typeof iri === 'string' && PRIMITIVE_NAMESPACES.some((namespace) => iri.startsWith(namespace));

const isNodeData = (data) => data && !data.source && data.edgeAnchor !== 1 && data.edgeBendHandle !== 1;

function dropWithIncidentElements(elements, removedNodeIds) {
  if (removedNodeIds.size === 0) {
    return elements;
  }
  // Edge-anchor helpers belong to the edge between their two endpoints; drop them with it.
  const removed = new Set(removedNodeIds);
  elements.forEach((element) => {
    const data = element?.data;
    if (data?.edgeAnchor === 1 && (removed.has(data.anchoredSourceId) || removed.has(data.anchoredTargetId))) {
      removed.add(data.id);
    }
  });
  return elements.filter((element) => {
    const data = element?.data;
    if (!data) {
      return true;
    }
    return data.source ? !removed.has(data.source) && !removed.has(data.target) : !removed.has(data.id);
  });
}

/** Removes rdf/rdfs/owl terms that only name a category (owl:Class, owl:Restriction, rdf:nil, ...). */
export function hideRdfPrimitives(elements, keepIds = []) {
  if (!Array.isArray(elements)) {
    return elements;
  }
  const keep = new Set(keepIds);
  const typeObjects = new Set();
  elements.forEach((element) => {
    const data = element?.data;
    if (data?.source && data.predicate === RDF_TYPE) {
      typeObjects.add(data.target);
    }
  });
  const primitives = new Set();
  elements.forEach((element) => {
    const data = element?.data;
    if (!isNodeData(data) || keep.has(data.id) || !isPrimitiveIri(data.iri) || DRAWN_AS_RESOURCES.has(data.iri)) {
      return;
    }
    if (typeObjects.has(data.id)) {
      primitives.add(data.id);
    }
  });
  return dropWithIncidentElements(elements, primitives);
}

/** Removes built-in vocabulary terms that have no edges at all. */
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
    if (!isNodeData(data)) {
      return true;
    }
    return !isBuiltinVocabularyIri(data.iri) || connected.has(data.id) || keep.has(data.id);
  });
}

/** Primitives first, so terms that only hung off a primitive are then caught as isolated. */
export function filterBuiltinVocabulary(elements, keepIds = []) {
  return hideIsolatedBuiltinTerms(hideRdfPrimitives(elements, keepIds), keepIds);
}
