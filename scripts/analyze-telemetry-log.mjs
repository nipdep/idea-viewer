#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(
    [
      'Usage: node scripts/analyze-telemetry-log.mjs <log.ndjson> [--json]',
      '',
      'Examples:',
      '  node scripts/analyze-telemetry-log.mjs "temp/Idea Viewer June 21 2026.ndjson"',
      '  node scripts/analyze-telemetry-log.mjs telemetry.ndjson --json',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = null;
  let json = false;

  for (const arg of args) {
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

  return { filePath, json };
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

function createSeries() {
  return [];
}

function addSeriesValue(series, value) {
  if (isFiniteNumber(value)) {
    series.push(value);
  }
}

function summarizeSeries(values) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length,
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle],
  };
}

function formatMs(value) {
  return isFiniteNumber(value) ? `${value.toFixed(2)} ms` : '-';
}

function formatMb(bytes) {
  return isFiniteNumber(bytes) ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : '-';
}

function extractDatasetTripletCount(records) {
  let triplets = null;
  for (const record of records) {
    const value = record?.context?.datasetTripletCount;
    if (isFiniteNumber(value)) {
      triplets = Math.max(triplets ?? value, value);
    }
  }
  return triplets;
}

function firstSpanDuration(records, name) {
  const match = records.find((record) => record.type === 'span' && record.name === name && isFiniteNumber(record.durationMs));
  return match?.durationMs ?? null;
}

function firstGaugeValue(records, name, phase) {
  const match = records.find(
    (record) =>
      record.type === 'gauge' &&
      record.name === name &&
      record.context?.phase === phase &&
      isFiniteNumber(record.value),
  );
  return match?.value ?? null;
}

function averageOfMatching(records, predicate, extractor) {
  const values = [];
  for (const record of records) {
    if (!predicate(record)) {
      continue;
    }
    const value = extractor(record);
    if (isFiniteNumber(value)) {
      values.push(value);
    }
  }
  const summary = summarizeSeries(values);
  return {
    count: values.length,
    avg: summary?.avg ?? null,
    min: summary?.min ?? null,
    max: summary?.max ?? null,
    median: summary?.median ?? null,
  };
}

function buildSessionSummary(records) {
  const datasetTripletCount = extractDatasetTripletCount(records);
  const parseTimeMs = firstSpanDuration(records, 'dataset.read_and_parse');
  const timeToFirstVisualizationMs = firstSpanDuration(records, 'view.first_render.total');
  const fullLayoutVisualizationTimeMs =
    firstSpanDuration(records, 'view.settle.total') ?? firstSpanDuration(records, 'layout.compute.total');

  const zoomLatency = averageOfMatching(
    records,
    (record) => record.type === 'span' && record.name === 'interaction.zoom.latency',
    (record) => record.durationMs,
  );

  const searchLatency = averageOfMatching(
    records,
    (record) => record.type === 'event' && (record.name === 'search.latency' || record.name === 'search.compute'),
    (record) => record.context?.latencyMs ?? record.context?.perceivedLatencyMs,
  );

  const projectionChangeLatency = averageOfMatching(
    records,
    (record) =>
      record.type === 'span' &&
      (
        record.name === 'projection.change.total' ||
        (record.name === 'filter.apply.total' && record.context?.filterTrigger === 'projection-change')
      ),
    (record) => record.durationMs,
  );

  const filterLatency = averageOfMatching(
    records,
    (record) =>
      record.type === 'span' &&
      record.name === 'filter.apply.total' &&
      record.context?.filterTrigger === 'filter-change',
    (record) => record.durationMs,
  );

  const peakMemoryBytes = records.reduce((peak, record) => {
    if (record.type !== 'gauge' || record.name !== 'memory.used.bytes' || !isFiniteNumber(record.value)) {
      return peak;
    }
    return Math.max(peak ?? record.value, record.value);
  }, null);

  return {
    sessionId: records[0]?.sessionId ?? 'unknown',
    datasetTripletCount,
    parseTimeMs,
    timeToFirstVisualizationMs,
    fullLayoutVisualizationTimeMs,
    zoomLatency,
    searchLatency,
    projectionChangeLatency,
    filterLatency,
    memory: {
      postStartupBytes: firstGaugeValue(records, 'memory.used.bytes', 'post-startup'),
      postDatasetLoadBytes: firstGaugeValue(records, 'memory.used.bytes', 'post-dataset-load'),
      postLayoutSettleBytes: firstGaugeValue(records, 'memory.used.bytes', 'post-layout-settle'),
      peakBytes: peakMemoryBytes,
    },
  };
}

function groupSessionsByTriplets(sessionSummaries) {
  const groups = new Map();
  for (const summary of sessionSummaries) {
    const key = isFiniteNumber(summary.datasetTripletCount) ? String(summary.datasetTripletCount) : 'unknown';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(summary);
  }
  return groups;
}

function aggregateSessionSummaries(groupedSummaries) {
  const results = [];
  for (const [tripletKey, summaries] of [...groupedSummaries.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const parseSeries = createSeries();
    const firstVisualizationSeries = createSeries();
    const fullLayoutSeries = createSeries();
    const postStartupMemorySeries = createSeries();
    const postDatasetLoadMemorySeries = createSeries();
    const postLayoutSettleMemorySeries = createSeries();
    const peakMemorySeries = createSeries();
    const zoomSessionAvgSeries = createSeries();
    const searchSessionAvgSeries = createSeries();
    const projectionChangeSessionAvgSeries = createSeries();
    const filterSessionAvgSeries = createSeries();

    let totalZoomOperations = 0;
    let totalSearchOperations = 0;
    let totalProjectionChangeOperations = 0;
    let totalFilterOperations = 0;

    for (const summary of summaries) {
      addSeriesValue(parseSeries, summary.parseTimeMs);
      addSeriesValue(firstVisualizationSeries, summary.timeToFirstVisualizationMs);
      addSeriesValue(fullLayoutSeries, summary.fullLayoutVisualizationTimeMs);
      addSeriesValue(postStartupMemorySeries, summary.memory.postStartupBytes);
      addSeriesValue(postDatasetLoadMemorySeries, summary.memory.postDatasetLoadBytes);
      addSeriesValue(postLayoutSettleMemorySeries, summary.memory.postLayoutSettleBytes);
      addSeriesValue(peakMemorySeries, summary.memory.peakBytes);

      if (summary.zoomLatency.count > 0) {
        totalZoomOperations += summary.zoomLatency.count;
        addSeriesValue(zoomSessionAvgSeries, summary.zoomLatency.avg);
      }
      if (summary.searchLatency.count > 0) {
        totalSearchOperations += summary.searchLatency.count;
        addSeriesValue(searchSessionAvgSeries, summary.searchLatency.avg);
      }
      if (summary.projectionChangeLatency.count > 0) {
        totalProjectionChangeOperations += summary.projectionChangeLatency.count;
        addSeriesValue(projectionChangeSessionAvgSeries, summary.projectionChangeLatency.avg);
      }
      if (summary.filterLatency.count > 0) {
        totalFilterOperations += summary.filterLatency.count;
        addSeriesValue(filterSessionAvgSeries, summary.filterLatency.avg);
      }
    }

    results.push({
      datasetTripletCount: tripletKey === 'unknown' ? null : Number(tripletKey),
      sessionCount: summaries.length,
      sessions: summaries,
      oneTime: {
        parseTimeMs: summarizeSeries(parseSeries),
        timeToFirstVisualizationMs: summarizeSeries(firstVisualizationSeries),
        fullLayoutVisualizationTimeMs: summarizeSeries(fullLayoutSeries),
      },
      repeated: {
        panZoomLatencyMs: {
          sessionAverage: summarizeSeries(zoomSessionAvgSeries),
          totalOperations: totalZoomOperations,
        },
        searchLatencyMs: {
          sessionAverage: summarizeSeries(searchSessionAvgSeries),
          totalOperations: totalSearchOperations,
        },
        projectionChangeTimeMs: {
          sessionAverage: summarizeSeries(projectionChangeSessionAvgSeries),
          totalOperations: totalProjectionChangeOperations,
        },
        filterLatencyMs: {
          sessionAverage: summarizeSeries(filterSessionAvgSeries),
          totalOperations: totalFilterOperations,
        },
      },
      memory: {
        postStartupBytes: summarizeSeries(postStartupMemorySeries),
        postDatasetLoadBytes: summarizeSeries(postDatasetLoadMemorySeries),
        postLayoutSettleBytes: summarizeSeries(postLayoutSettleMemorySeries),
        peakBytes: summarizeSeries(peakMemorySeries),
      },
    });
  }
  return results;
}

function printOneTimeMetric(label, summary, formatter) {
  if (!summary) {
    console.log(`- ${label}: -`);
    return;
  }
  if (summary.count === 1) {
    console.log(`- ${label}: ${formatter(summary.avg)}`);
    return;
  }
  console.log(`- ${label}: avg ${formatter(summary.avg)} across ${summary.count} sessions`);
}

function printRepeatedMetric(label, metric, formatter) {
  if (!metric.sessionAverage || metric.totalOperations === 0) {
    console.log(`- ${label}: -`);
    return;
  }
  console.log(
    `- ${label}: avg ${formatter(metric.sessionAverage.avg)} across ${metric.totalOperations} operations in ${metric.sessionAverage.count} session(s)`,
  );
}

function printReport(filePath, aggregated) {
  console.log(`File: ${filePath}`);
  for (const group of aggregated) {
    console.log(`\nDataset triplets: ${group.datasetTripletCount ?? 'unknown'}`);
    console.log(`Sessions: ${group.sessionCount}`);
    console.log('\nOne-time metrics');
    printOneTimeMetric('RDF/OWL parse time', group.oneTime.parseTimeMs, formatMs);
    printOneTimeMetric('Time to first visualization', group.oneTime.timeToFirstVisualizationMs, formatMs);
    printOneTimeMetric('Full layout / visualization time', group.oneTime.fullLayoutVisualizationTimeMs, formatMs);

    console.log('\nRepeated interaction metrics');
    printRepeatedMetric('Pan / zoom latency', group.repeated.panZoomLatencyMs, formatMs);
    printRepeatedMetric('Search latency', group.repeated.searchLatencyMs, formatMs);
    printRepeatedMetric('Projection change time', group.repeated.projectionChangeTimeMs, formatMs);
    printRepeatedMetric('Filter latency', group.repeated.filterLatencyMs, formatMs);

    console.log('\nMemory usage');
    printOneTimeMetric('Post startup', group.memory.postStartupBytes, formatMb);
    printOneTimeMetric('Post dataset load', group.memory.postDatasetLoadBytes, formatMb);
    printOneTimeMetric('Post layout settle', group.memory.postLayoutSettleBytes, formatMb);
    printOneTimeMetric('Peak used', group.memory.peakBytes, formatMb);
  }
}

function main() {
  const { filePath, json } = parseArgs(process.argv);
  const resolvedPath = path.resolve(filePath);
  const records = parseNdjson(resolvedPath);
  const bySession = new Map();
  for (const record of records) {
    const sessionId = record.sessionId ?? 'unknown';
    if (!bySession.has(sessionId)) {
      bySession.set(sessionId, []);
    }
    bySession.get(sessionId).push(record);
  }

  const sessionSummaries = [...bySession.values()].map((sessionRecords) =>
    buildSessionSummary(sessionRecords.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))),
  );
  const aggregated = aggregateSessionSummaries(groupSessionsByTriplets(sessionSummaries));

  if (json) {
    console.log(JSON.stringify({ file: resolvedPath, datasets: aggregated }, null, 2));
    return;
  }

  printReport(resolvedPath, aggregated);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
