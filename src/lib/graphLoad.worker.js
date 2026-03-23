import { Parser } from 'n3';
import { buildGraphData, extractOntologyModel, getTermId, parseRdfText } from './rdf';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_ONTOLOGY = 'http://www.w3.org/2002/07/owl#Ontology';
const PROGRESSIVE_BATCH_SIZE = 1800;
const PROGRESSIVE_SNAPSHOT_INTERVAL_MS = 300;

function serializeTerm(term) {
  if (!term) {
    return {
      termType: 'DefaultGraph',
      value: '',
      language: '',
      datatype: '',
    };
  }

  return {
    termType: term.termType,
    value: term.value ?? '',
    language: term.termType === 'Literal' ? term.language ?? '' : '',
    datatype: term.termType === 'Literal' ? term.datatype?.value ?? '' : '',
  };
}

function serializeQuad(quad) {
  return {
    subject: serializeTerm(quad.subject),
    predicate: serializeTerm(quad.predicate),
    object: serializeTerm(quad.object),
    graph: serializeTerm(quad.graph),
  };
}

function partitionOntologyHeaderQuads(quads) {
  const ontologySubjectIds = new Set();
  for (const quad of quads) {
    if (
      quad.predicate.value === RDF_TYPE &&
      quad.object.termType === 'NamedNode' &&
      quad.object.value === OWL_ONTOLOGY
    ) {
      ontologySubjectIds.add(getTermId(quad.subject));
    }
  }

  if (ontologySubjectIds.size === 0) {
    return {
      headerQuads: [],
      contentQuads: quads,
    };
  }

  const headerQuads = [];
  const contentQuads = [];
  for (const quad of quads) {
    if (ontologySubjectIds.has(getTermId(quad.subject))) {
      headerQuads.push(quad);
    } else {
      contentQuads.push(quad);
    }
  }

  return {
    headerQuads,
    contentQuads,
  };
}

function modelHasOntologySchema(model) {
  if (!model) {
    return false;
  }

  return (
    (model.classIds?.size ?? 0) > 0 ||
    (model.objectPropertyIds?.size ?? 0) > 0 ||
    (model.dataPropertyIds?.size ?? 0) > 0 ||
    (model.annotationPropertyIds?.size ?? 0) > 0 ||
    (model.datatypeIds?.size ?? 0) > 0
  );
}

function detectFormat(fileName, text) {
  const sample = text.slice(0, 4000);

  if (
    /<\?xml[\s>]/i.test(sample) ||
    /<rdf:RDF[\s>]/i.test(sample) ||
    /xmlns:rdf\s*=\s*["']http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#["']/i.test(sample)
  ) {
    return 'RDFXML';
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.rdf') && /^\s*</.test(sample)) {
    return 'RDFXML';
  }

  if (lower.endsWith('.nt')) {
    return 'N-Triples';
  }

  if (lower.endsWith('.nq')) {
    return 'N-Quads';
  }

  if (lower.endsWith('.trig')) {
    return 'TriG';
  }

  return 'Turtle';
}

function canProgressivelyParseFormat(format) {
  return format !== 'RDFXML';
}

function buildSnapshotGraphData(effectiveKgQuads, schemaOntologyQuads) {
  const mergedQuads = [...effectiveKgQuads, ...schemaOntologyQuads];
  const ontologyModel = extractOntologyModel(schemaOntologyQuads);
  const hasOntology = modelHasOntologySchema(ontologyModel) && schemaOntologyQuads.length > 0;
  const hasKg = effectiveKgQuads.length > 0;

  return buildGraphData(mergedQuads, {
    hasKg,
    hasOntology,
    ontologyModel,
    createStore: false,
  });
}

function postPartialGraph(effectiveKgQuads, schemaOntologyQuads, extra = {}) {
  const graphData = {
    ...buildSnapshotGraphData(effectiveKgQuads, schemaOntologyQuads),
    store: null,
    serializedQuads: [],
  };

  self.postMessage({
    type: 'partial',
    payload: {
      graphData,
      ...extra,
    },
  });
}

function parseTextProgressively(text, fileName, onBatch) {
  const format = detectFormat(fileName, text);
  if (!canProgressivelyParseFormat(format)) {
    return parseRdfText(text, fileName);
  }

  return new Promise((resolve, reject) => {
    const parser = new Parser({ format });
    const quads = [];
    let batch = [];
    let lastSnapshotAt = Date.now();

    parser.parse(text, (error, quad) => {
      if (error) {
        reject(error);
        return;
      }

      if (!quad) {
        if (batch.length > 0) {
          onBatch(batch);
        }
        resolve(quads);
        return;
      }

      quads.push(quad);
      batch.push(quad);

      const now = Date.now();
      if (batch.length >= PROGRESSIVE_BATCH_SIZE || now - lastSnapshotAt >= PROGRESSIVE_SNAPSHOT_INTERVAL_MS) {
        const nextBatch = batch;
        batch = [];
        lastSnapshotAt = now;
        onBatch(nextBatch);
      }
    });
  });
}

function postProgress(message) {
  self.postMessage({
    type: 'progress',
    message,
  });
}

self.onmessage = async (event) => {
  const { kgFiles = [], ontologyFiles = [] } = event.data ?? {};

  try {
    postProgress('Reading KG files...');
    const effectiveKgQuads = [];
    const schemaOntologyQuads = [];
    const instanceOntologyQuads = [];
    let schemaOntologyFileCount = 0;
    let instanceOntologyFileCount = 0;
    const ontologyHeaderGroups = [];

    for (let index = 0; index < kgFiles.length; index += 1) {
      const file = kgFiles[index];
      const kgCountBeforeFile = effectiveKgQuads.length;
      postProgress(`Reading KG file ${index + 1} of ${kgFiles.length}: ${file.name}`);
      const text = await file.text();
      postProgress(`Parsing KG file ${index + 1} of ${kgFiles.length}: ${file.name}`);
      const quads = await parseTextProgressively(text, file.name, (batch) => {
        if (!Array.isArray(batch) || batch.length === 0) {
          return;
        }
        effectiveKgQuads.push(...batch);
        postPartialGraph(effectiveKgQuads, schemaOntologyQuads, {
          kgQuadCount: effectiveKgQuads.length,
        });
      });
      const parsedFromThisFile = effectiveKgQuads.length - kgCountBeforeFile;
      if (parsedFromThisFile < quads.length) {
        effectiveKgQuads.push(...quads.slice(parsedFromThisFile));
      }
    }

    postProgress('Reading ontology files...');
    for (let index = 0; index < ontologyFiles.length; index += 1) {
      const file = ontologyFiles[index];
      postProgress(`Parsing ontology file ${index + 1} of ${ontologyFiles.length}: ${file.name}`);
      const text = await file.text();
      const quads = await parseRdfText(text, file.name);
      const { headerQuads, contentQuads } = partitionOntologyHeaderQuads(quads);
      const model = extractOntologyModel(contentQuads);
      const hasSchema = modelHasOntologySchema(model);
      ontologyHeaderGroups.push({
        fileName: file.name,
        headerQuads: headerQuads.map(serializeQuad),
      });

      if (hasSchema) {
        schemaOntologyQuads.push(...contentQuads);
        schemaOntologyFileCount += 1;
      } else {
        instanceOntologyQuads.push(...contentQuads);
        instanceOntologyFileCount += 1;
      }

      postPartialGraph([...effectiveKgQuads, ...instanceOntologyQuads], schemaOntologyQuads, {
        kgQuadCount: effectiveKgQuads.length + instanceOntologyQuads.length,
      });
    }

    postProgress('Merging parsed graph data...');
    const finalEffectiveKgQuads = [...effectiveKgQuads, ...instanceOntologyQuads];
    const mergedQuads = [...finalEffectiveKgQuads, ...schemaOntologyQuads];
    const ontologyModel = extractOntologyModel(schemaOntologyQuads);
    const hasOntology = modelHasOntologySchema(ontologyModel) && schemaOntologyQuads.length > 0;
    const hasKg = finalEffectiveKgQuads.length > 0;

    postProgress('Building graph model...');
    const nextGraphData = buildGraphData(mergedQuads, {
      hasKg,
      hasOntology,
      ontologyModel,
      createStore: false,
    });

    const graphData = {
      ...nextGraphData,
      store: null,
      serializedQuads: mergedQuads.map(serializeQuad),
    };

    self.postMessage({
      type: 'result',
      payload: {
        graphData,
        ontologyHeaderGroups,
        schemaOntologyFileCount,
        instanceOntologyFileCount,
        kgFileCount: kgFiles.length,
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unable to prepare the graph.',
    });
  }
};
