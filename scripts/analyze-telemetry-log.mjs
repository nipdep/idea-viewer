#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(
    [
      'Usage: node scripts/analyze-telemetry-log.mjs <log.ndjson> [--bucket-size N] [--json]',
      '',
      'Examples:',
      '  node scripts/analyze-telemetry-log.mjs "temp/Idea Viewer June 21 2026.ndjson"',
      '  node scripts/analyze-telemetry-log.mjs telemetry.ndjson --bucket-size 25',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = null;
  let bucketSize = 1;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--bucket-size') {
      const next = Number.parseInt(args[index + 1], 10);
      if (!Number.isFinite(next) || next <= 0) {
        throw new Error('Expected a positive integer after --bucket-size');
      }
      bucketSize = next;
      index += 1;
      continue;
    }
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (!filePath) {
      filePath = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!filePath) {
    usage();
    process.exit(1);
  }

  return {
    filePath,
    bucketSize,
    json,
  };
}

function parseNdjson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
      }
    });
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function createStats() {
  return {
    count: 0,
    sum: 0,
    min: Infinity,
    max: -Infinity,
    values: [],
  };
}

function addValue(stats, value) {
  stats.count += 1;
  stats.sum += value;
  stats.min = Math.min(stats.min, value);
  stats.max = Math.max(stats.max, value);
  stats.values.push(value);
}

function finalizeStats(stats) {
  if (stats.count === 0) {
    return {
      count: 0,
      avg: null,
      min: null,
      max: null,
      median: null,
      p95: null,
    };
  }

  const sorted = [...stats.values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const percentileIndex = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

  return {
    count: stats.count,
    avg: stats.sum / stats.count,
    min: stats.min,
    max: stats.max,
    median:
      sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle],
    p95: sorted[percentileIndex],
  };
}

function formatNumber(value, digits = 2) {
  if (!isFiniteNumber(value)) {
    return '-';
  }
  return value.toFixed(digits);
}

function bucketNodeCount(value, bucketSize) {
  if (!isFiniteNumber(value) || value < 0) {
    return 'unknown';
  }
  if (bucketSize <= 1) {
    return String(value);
  }
  const start = Math.floor(value / bucketSize) * bucketSize;
  const end = start + bucketSize - 1;
  return `${start}-${end}`;
}

function ensureNestedMap(rootMap, key) {
  if (!rootMap.has(key)) {
    rootMap.set(key, new Map());
  }
  return rootMap.get(key);
}

function updateStateFromRecord(state, record) {
  const context = record.context ?? {};

  if (isFiniteNumber(context.datasetTripletCount)) {
    state.lastDatasetTripletCount = context.datasetTripletCount;
  }
  if (isFiniteNumber(context.nodeCount)) {
    state.lastNodeCount = context.nodeCount;
  }
  if (isFiniteNumber(context.edgeCount)) {
    state.lastEdgeCount = context.edgeCount;
  }
  if (isFiniteNumber(context.renderedNodeCount) && context.renderedNodeCount > 0) {
    state.lastRenderedNodeCount = context.renderedNodeCount;
  }
  if (isFiniteNumber(context.renderedEdgeCount) && context.renderedEdgeCount >= 0) {
    state.lastRenderedEdgeCount = context.renderedEdgeCount;
  }
}

function resolveEffectiveCounts(state, record) {
  const context = record.context ?? {};

  const directRenderedNodeCount =
    isFiniteNumber(context.renderedNodeCount) && context.renderedNodeCount > 0
      ? context.renderedNodeCount
      : null;
  const directNodeCount = isFiniteNumber(context.nodeCount) ? context.nodeCount : null;
  const directDatasetTripletCount = isFiniteNumber(context.datasetTripletCount)
    ? context.datasetTripletCount
    : null;

  return {
    effectiveNodeCount:
      directRenderedNodeCount ??
      directNodeCount ??
      state.lastRenderedNodeCount ??
      state.lastNodeCount ??
      null,
    effectiveEdgeCount:
      (isFiniteNumber(context.renderedEdgeCount) ? context.renderedEdgeCount : null) ??
      (isFiniteNumber(context.edgeCount) ? context.edgeCount : null) ??
      state.lastRenderedEdgeCount ??
      state.lastEdgeCount ??
      null,
    effectiveTripletCount: directDatasetTripletCount ?? state.lastDatasetTripletCount ?? null,
  };
}

function analyzeRecords(records, bucketSize) {
  const sortedRecords = [...records].sort((left, right) => {
    const leftTs = isFiniteNumber(left.ts) ? left.ts : 0;
    const rightTs = isFiniteNumber(right.ts) ? right.ts : 0;
    return leftTs - rightTs;
  });

  const sessionState = new Map();
  const spanStats = new Map();
  const memoryStats = new Map();

  for (const record of sortedRecords) {
    const sessionId = record.sessionId ?? 'default';
    const state = sessionState.get(sessionId) ?? {
      lastDatasetTripletCount: null,
      lastNodeCount: null,
      lastEdgeCount: null,
      lastRenderedNodeCount: null,
      lastRenderedEdgeCount: null,
    };
    sessionState.set(sessionId, state);

    const counts = resolveEffectiveCounts(state, record);
    updateStateFromRecord(state, record);

    if (record.type === 'span' && isFiniteNumber(record.durationMs)) {
      const metricBuckets = ensureNestedMap(spanStats, record.name);
      const bucketKey = bucketNodeCount(counts.effectiveNodeCount, bucketSize);
      if (!metricBuckets.has(bucketKey)) {
        metricBuckets.set(bucketKey, {
          nodeCount: counts.effectiveNodeCount,
          edgeCount: counts.effectiveEdgeCount,
          tripletCount: counts.effectiveTripletCount,
          stats: createStats(),
        });
      }
      addValue(metricBuckets.get(bucketKey).stats, record.durationMs);
    }

    if (record.type === 'gauge' && record.name === 'memory.used.bytes' && isFiniteNumber(record.value)) {
      const phase = record.context?.phase ?? 'unknown';
      const phaseBuckets = ensureNestedMap(memoryStats, phase);
      const bucketKey = bucketNodeCount(counts.effectiveNodeCount, bucketSize);
      if (!phaseBuckets.has(bucketKey)) {
        phaseBuckets.set(bucketKey, {
          nodeCount: counts.effectiveNodeCount,
          edgeCount: counts.effectiveEdgeCount,
          tripletCount: counts.effectiveTripletCount,
          stats: createStats(),
        });
      }
      addValue(phaseBuckets.get(bucketKey).stats, record.value);
    }
  }

  return {
    totalRecords: sortedRecords.length,
    spanStats,
    memoryStats,
  };
}

function mapsToObject(inputMap, valueMapper) {
  const output = {};
  for (const [key, value] of inputMap.entries()) {
    output[key] = valueMapper(value);
  }
  return output;
}

function toJsonSummary(analysis) {
  return {
    totalRecords: analysis.totalRecords,
    spans: mapsToObject(analysis.spanStats, (bucketMap) =>
      mapsToObject(bucketMap, (bucketEntry) => ({
        nodeCount: bucketEntry.nodeCount,
        edgeCount: bucketEntry.edgeCount,
        tripletCount: bucketEntry.tripletCount,
        ...finalizeStats(bucketEntry.stats),
      }))),
    memory: mapsToObject(analysis.memoryStats, (bucketMap) =>
      mapsToObject(bucketMap, (bucketEntry) => ({
        nodeCount: bucketEntry.nodeCount,
        edgeCount: bucketEntry.edgeCount,
        tripletCount: bucketEntry.tripletCount,
        avgBytes: finalizeStats(bucketEntry.stats).avg,
        ...finalizeStats(bucketEntry.stats),
      }))),
  };
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function printSpanStats(spanStats) {
  const names = [...spanStats.keys()].sort();
  for (const name of names) {
    printSection(`Span: ${name}`);
    console.log('nodes\tcount\tavg_ms\tmedian_ms\tp95_ms\tmin_ms\tmax_ms\ttriplets');
    const buckets = [...spanStats.get(name).entries()].sort((left, right) => {
      const leftNode = left[1].nodeCount ?? Number.POSITIVE_INFINITY;
      const rightNode = right[1].nodeCount ?? Number.POSITIVE_INFINITY;
      return leftNode - rightNode;
    });
    for (const [bucketKey, entry] of buckets) {
      const summary = finalizeStats(entry.stats);
      console.log(
        [
          bucketKey,
          summary.count,
          formatNumber(summary.avg),
          formatNumber(summary.median),
          formatNumber(summary.p95),
          formatNumber(summary.min),
          formatNumber(summary.max),
          entry.tripletCount ?? '-',
        ].join('\t'),
      );
    }
  }
}

function printMemoryStats(memoryStats) {
  const phases = [...memoryStats.keys()].sort();
  for (const phase of phases) {
    printSection(`Memory: ${phase}`);
    console.log('nodes\tcount\tavg_mb\tmedian_mb\tp95_mb\tmin_mb\tmax_mb\ttriplets');
    const buckets = [...memoryStats.get(phase).entries()].sort((left, right) => {
      const leftNode = left[1].nodeCount ?? Number.POSITIVE_INFINITY;
      const rightNode = right[1].nodeCount ?? Number.POSITIVE_INFINITY;
      return leftNode - rightNode;
    });
    for (const [bucketKey, entry] of buckets) {
      const summary = finalizeStats(entry.stats);
      const toMb = (value) => (isFiniteNumber(value) ? value / (1024 * 1024) : null);
      console.log(
        [
          bucketKey,
          summary.count,
          formatNumber(toMb(summary.avg)),
          formatNumber(toMb(summary.median)),
          formatNumber(toMb(summary.p95)),
          formatNumber(toMb(summary.min)),
          formatNumber(toMb(summary.max)),
          entry.tripletCount ?? '-',
        ].join('\t'),
      );
    }
  }
}

function main() {
  const { filePath, bucketSize, json } = parseArgs(process.argv);
  const resolvedPath = path.resolve(filePath);
  const records = parseNdjson(resolvedPath);
  const analysis = analyzeRecords(records, bucketSize);

  if (json) {
    console.log(JSON.stringify(toJsonSummary(analysis), null, 2));
    return;
  }

  console.log(`File: ${resolvedPath}`);
  console.log(`Records: ${analysis.totalRecords}`);
  console.log(`Node bucket size: ${bucketSize}`);

  printSpanStats(analysis.spanStats);
  printMemoryStats(analysis.memoryStats);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
