// Shapes the ontology-header statements (the owl:Ontology block) into a readable overview for the inspector
// that is shown while nothing is selected: title, key facts, imports, annotations, prefixes.

const PREDICATE_TITLES = new Map([
  ['http://purl.org/dc/terms/title', 'Title'],
  ['http://purl.org/dc/elements/1.1/title', 'Title'],
  ['http://www.w3.org/2000/01/rdf-schema#label', 'Title'],
]);

const TITLE_PREDICATES = [...PREDICATE_TITLES.keys()];
const OWL = 'http://www.w3.org/2002/07/owl#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

// Shown first, in this order, as the "key facts" of the dataset.
const KEY_PREDICATES = [
  [`${OWL}versionIRI`, 'Version IRI'],
  [`${OWL}versionInfo`, 'Version'],
  ['http://purl.org/dc/terms/license', 'License'],
  ['http://purl.org/dc/terms/creator', 'Creator'],
  ['http://purl.org/dc/terms/created', 'Created'],
  ['http://purl.org/dc/terms/modified', 'Modified'],
];

function localName(iri) {
  const cleaned = String(iri ?? '').replace(/[#/]+$/, '');
  const cut = Math.max(cleaned.lastIndexOf('#'), cleaned.lastIndexOf('/'));
  const name = cut >= 0 ? cleaned.slice(cut + 1) : cleaned;
  try {
    return decodeURIComponent(name) || iri;
  } catch {
    return name || iri;
  }
}

// "versionIRI" -> "Version IRI", "hasAbstract" -> "Has abstract"
export function humanizePredicate(iri) {
  const name = localName(iri)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!name) {
    return String(iri ?? '');
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function pushUnique(list, entry) {
  if (!list.some((existing) => existing.text === entry.text && existing.iri === entry.iri)) {
    list.push(entry);
  }
}

export function buildDatasetOverview(headerRows) {
  const rows = (headerRows ?? []).filter((row) => row.predicateIri);
  if (rows.length === 0) {
    return null;
  }

  const subjectCounts = new Map();
  for (const row of rows) {
    subjectCounts.set(row.subjectIri, (subjectCounts.get(row.subjectIri) ?? 0) + 1);
  }
  const ontologyIri = [...subjectCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const groups = new Map();
  for (const row of rows) {
    if (row.predicateIri === RDF_TYPE) {
      continue;
    }
    const group = groups.get(row.predicateIri) ?? [];
    pushUnique(group, { text: row.valueText, iri: row.valueIsIri ? row.valueIri : '' });
    groups.set(row.predicateIri, group);
  }

  let title = '';
  for (const predicate of TITLE_PREDICATES) {
    const first = groups.get(predicate)?.[0];
    if (first) {
      title = first.text;
      break;
    }
  }
  for (const predicate of TITLE_PREDICATES) {
    groups.delete(predicate);
  }

  const imports = groups.get(`${OWL}imports`) ?? [];
  groups.delete(`${OWL}imports`);

  const facts = [];
  for (const [predicate, label] of KEY_PREDICATES) {
    const values = groups.get(predicate);
    if (values) {
      facts.push({ predicate, label, values });
      groups.delete(predicate);
    }
  }

  const annotations = [...groups.entries()].map(([predicate, values]) => ({
    predicate,
    label: humanizePredicate(predicate),
    values,
  }));

  return {
    ontologyIri: ontologyIri && !ontologyIri.startsWith('_:') ? ontologyIri : '',
    title: title || (ontologyIri && !ontologyIri.startsWith('_:') ? localName(ontologyIri) : 'Dataset'),
    facts,
    imports,
    annotations,
  };
}
