// Property chains: `:serversRoom owl:propertyChainAxiom ( :hasServiceComponent :connectsTo )` means that
// hasServiceComponent o connectsTo implies serversRoom. The axiom is a statement ABOUT a property, so it is not drawn
// as a list of nodes: the property's own edge gets a chain mark and the chain is shown when the edge is selected.
import { DataFactory } from 'n3';

const { namedNode } = DataFactory;
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDF_FIRST = `${RDF_NS}first`;
const RDF_REST = `${RDF_NS}rest`;
const RDF_NIL = `${RDF_NS}nil`;
const OWL_PROPERTY_CHAIN_AXIOM = `${OWL_NS}propertyChainAxiom`;
const OWL_INVERSE_OF = `${OWL_NS}inverseOf`;

// The id the graph uses for a term (blank nodes are "_:" + label), so the ids recorded here match its nodes.
const idOf = (term) => (term.termType === 'BlankNode' ? `_:${term.value}` : term.value);

export const PROPERTY_CHAIN_MARK = '⛓';
export const PROPERTY_CHAIN_ROW_KEY = 'Property chain';

// A well-formed list: one rdf:first and one rdf:rest per cell, no cycle, ends in rdf:nil.
function readListTerms(store, head) {
  const items = [];
  const cellIds = [];
  const seen = new Set();
  let current = head;
  while (current && current.value !== RDF_NIL) {
    if (seen.has(current.value)) {
      return null;
    }
    seen.add(current.value);
    cellIds.push(idOf(current));
    const firsts = store.getObjects(current, namedNode(RDF_FIRST), null);
    const rests = store.getObjects(current, namedNode(RDF_REST), null);
    if (firsts.length !== 1 || rests.length !== 1) {
      return null;
    }
    items.push(firsts[0]);
    current = rests[0];
  }
  return current ? { items, cellIds } : null;
}

// A chain member is a property, or an inverse property expression `[ owl:inverseOf :p ]`.
function readChainMember(store, term, labelOf) {
  if (term.termType === 'NamedNode') {
    return { id: term.value, label: labelOf(term.value), inverse: false };
  }
  if (term.termType === 'BlankNode') {
    const inverseOf = store.getObjects(term, namedNode(OWL_INVERSE_OF), null);
    if (inverseOf.length === 1 && inverseOf[0].termType === 'NamedNode') {
      return { id: inverseOf[0].value, label: labelOf(inverseOf[0].value), inverse: true, blankId: idOf(term) };
    }
  }
  return null;
}

/**
 * @param store N3 store holding the graph
 * @param labelOf (iri) => display label of a property
 * @returns {{byProperty: Map<string, Array<{members: object[], headId: string}>>, headIds: Set<string>, cellIds: Set<string>, memberIds: Set<string>}}
 */
export function readPropertyChains(store, labelOf = (iri) => iri) {
  const byProperty = new Map();
  const headIds = new Set();
  const cellIds = new Set();
  const memberIds = new Set();

  for (const quad of store.getQuads(null, namedNode(OWL_PROPERTY_CHAIN_AXIOM), null, null)) {
    if (quad.subject.termType !== 'NamedNode') {
      continue;
    }
    const list = readListTerms(store, quad.object);
    if (!list || list.items.length === 0) {
      continue;
    }
    const members = list.items.map((term) => readChainMember(store, term, labelOf));
    if (members.some((member) => member === null)) {
      continue;
    }
    const propertyId = quad.subject.value;
    const chains = byProperty.get(propertyId) ?? [];
    chains.push({ members, headId: idOf(quad.object), propertyLabel: labelOf(quad.subject.value) });
    byProperty.set(propertyId, chains);
    headIds.add(idOf(quad.object));
    list.cellIds.forEach((id) => cellIds.add(id));
    members.forEach((member) => memberIds.add(member.id));
  }
  return { byProperty, headIds, cellIds, memberIds };
}

/** `hasServiceComponent o connectsTo -> serversRoom` */
export function formatPropertyChain(members, propertyLabel) {
  const left = members.map((member) => (member.inverse ? `inverse ${member.label}` : member.label)).join(' o ');
  return `${left} -> ${propertyLabel}`;
}

export function markChainLabel(label) {
  return label && !String(label).startsWith(PROPERTY_CHAIN_MARK) ? `${PROPERTY_CHAIN_MARK} ${label}` : label;
}
