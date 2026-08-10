#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DEFAULT_INPUT_DIR = 'log/scale';
const DEFAULT_OUTPUT_DIR = 'log/scale/figures';
const FIREFOX_CANDIDATES = [
  '/snap/firefox/current/usr/lib/firefox/firefox',
  '/snap/firefox/current/usr/lib/firefox/firefox-bin',
  '/usr/bin/firefox',
];

const CHART_DEFINITIONS = [
  {
    id: 'loading-time',
    title: 'Loading Time vs Dataset Triplets',
    yAxisLabel: 'Time (ms)',
    valueFormatter: (value) => `${value.toFixed(0)} ms`,
    yTickFormatter: (value) => `${value.toFixed(0)}`,
    yTickStrategy: 'major-only',
    series: [
      { key: 'parseTimeMs', label: 'RDF/OWL parse time', color: '#FFBF00', dasharray: '' },
      { key: 'timeToFirstVisualizationMs', label: 'Time to first visualization', color: '#0067A5', dasharray: '' },
      { key: 'fullLayoutVisualizationTimeMs', label: 'Full layout / visualization time', color: '#D4070f', dasharray: '' },
    ],
  },
  {
    id: 'operation-time',
    title: 'Operation Time vs Dataset Triplets',
    yAxisLabel: 'Time (ms)',
    valueFormatter: (value) => `${value.toFixed(0)} ms`,
    yTickFormatter: (value) => `${value.toFixed(0)}`,
    yTickStrategy: 'major-only',
    legendPosition: 'middle-left',
    series: [
      { key: 'panZoomLatencyMs', label: 'Pan / zoom latency', color: '#FFBF00', dasharray: '' },
      { key: 'searchLatencyMs', label: 'Search latency', color: '#0067A5', dasharray: '' },
      { key: 'projectionChangeTimeMs', label: 'Projection change time', color: '#D4070f', dasharray: '' },
      { key: 'filterLatencyMs', label: 'Filter latency', color: '#00A86B', dasharray: '' },
    ],
  },
  {
    id: 'application-memory',
    title: 'Application Memory vs Dataset Triplets',
    yAxisLabel: 'Memory (MB)',
    valueFormatter: (value) => `${value.toFixed(1)} MB`,
    yTickFormatter: (value) => `${value >= 100 || Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}`,
    yTickStrategy: 'major-only',
    series: [
      { key: 'postStartupMb', label: 'Post startup', color: '#00A86B', dasharray: '' },
      { key: 'postDatasetLoadMb', label: 'Post dataset load', color: '#FFBF00', dasharray: '' },
      { key: 'postLayoutSettleMb', label: 'Post layout settle', color: '#0067A5', dasharray: '' },
      { key: 'peakUsedMb', label: 'Peak used', color: '#D4070f', dasharray: '' },
    ],
  },
];

function usage() {
  console.error(
    [
      'Usage: node scripts/plot-scale-stats.mjs [--input-dir <dir>] [--output-dir <dir>]',
      '',
      'Defaults:',
      `  input dir:  ${DEFAULT_INPUT_DIR}`,
      `  output dir: ${DEFAULT_OUTPUT_DIR}`,
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let inputDir = DEFAULT_INPUT_DIR;
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input-dir') {
      inputDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--output-dir') {
      outputDir = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!inputDir || !outputDir) {
    throw new Error('Both input and output directories must be provided.');
  }

  return {
    inputDir: path.resolve(inputDir),
    outputDir: path.resolve(outputDir),
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function parseMetricValue(rawValue, unit) {
  if (!rawValue || rawValue === '-') {
    return null;
  }

  const pattern = unit === 'ms'
    ? /avg\s+([\d.]+)\s+ms|([\d.]+)\s+ms/
    : /avg\s+([\d.]+)\s+MB|([\d.]+)\s+MB/;
  const match = rawValue.match(pattern);
  if (!match) {
    return null;
  }
  const value = Number(match[1] ?? match[2]);
  return Number.isFinite(value) ? value : null;
}

function parseScaleSummary(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const record = {
    sourceFile: path.basename(filePath),
    datasetTripletCount: null,
    parseTimeMs: null,
    timeToFirstVisualizationMs: null,
    fullLayoutVisualizationTimeMs: null,
    panZoomLatencyMs: null,
    searchLatencyMs: null,
    projectionChangeTimeMs: null,
    filterLatencyMs: null,
    postStartupMb: null,
    postDatasetLoadMb: null,
    postLayoutSettleMb: null,
    peakUsedMb: null,
  };

  const metricMap = new Map([
    ['RDF/OWL parse time', { key: 'parseTimeMs', unit: 'ms' }],
    ['Time to first visualization', { key: 'timeToFirstVisualizationMs', unit: 'ms' }],
    ['Full layout / visualization time', { key: 'fullLayoutVisualizationTimeMs', unit: 'ms' }],
    ['Pan / zoom latency', { key: 'panZoomLatencyMs', unit: 'ms' }],
    ['Search latency', { key: 'searchLatencyMs', unit: 'ms' }],
    ['Projection change time', { key: 'projectionChangeTimeMs', unit: 'ms' }],
    ['Filter latency', { key: 'filterLatencyMs', unit: 'ms' }],
    ['Post startup', { key: 'postStartupMb', unit: 'mb' }],
    ['Post dataset load', { key: 'postDatasetLoadMb', unit: 'mb' }],
    ['Post layout settle', { key: 'postLayoutSettleMb', unit: 'mb' }],
    ['Peak used', { key: 'peakUsedMb', unit: 'mb' }],
  ]);

  for (const line of lines) {
    const tripletsMatch = line.match(/^Dataset triplets:\s+(\d+)/);
    if (tripletsMatch) {
      record.datasetTripletCount = Number(tripletsMatch[1]);
      continue;
    }

    const metricMatch = line.match(/^- ([^:]+):\s+(.+)$/);
    if (!metricMatch) {
      continue;
    }

    const [, label, rawValue] = metricMatch;
    const descriptor = metricMap.get(label);
    if (!descriptor) {
      continue;
    }

    record[descriptor.key] = parseMetricValue(rawValue, descriptor.unit);
  }

  if (!Number.isFinite(record.datasetTripletCount)) {
    throw new Error(`Missing dataset triplet count in ${filePath}`);
  }

  return record;
}

function readScaleSummaries(inputDir) {
  const files = fs
    .readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(inputDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (!files.length) {
    throw new Error(`No markdown summary files found in ${inputDir}`);
  }

  return files
    .map((filePath) => parseScaleSummary(filePath))
    .sort((left, right) => left.datasetTripletCount - right.datasetTripletCount);
}

function createLogTicks(minValue, maxValue) {
  const ticks = new Set();
  const start = Math.floor(Math.log10(minValue));
  const end = Math.ceil(Math.log10(maxValue));

  for (let exponent = start; exponent <= end; exponent += 1) {
    for (const multiplier of [1, 2, 5]) {
      const candidate = multiplier * 10 ** exponent;
      if (candidate >= minValue && candidate <= maxValue) {
        ticks.add(candidate);
      }
    }
  }

  ticks.add(minValue);
  ticks.add(maxValue);
  return [...ticks].sort((left, right) => left - right);
}

function createPositiveLogTicks(minValue, maxValue, strategy = 'dense') {
  const safeMin = Math.max(minValue, 1e-9);
  const safeMax = Math.max(maxValue, safeMin);
  const ticks = new Set();
  const start = Math.floor(Math.log10(safeMin));
  const end = Math.ceil(Math.log10(safeMax));
  const multipliers = strategy === 'major-only' ? [1] : [1, 2, 5];

  for (let exponent = start; exponent <= end; exponent += 1) {
    for (const multiplier of multipliers) {
      const candidate = multiplier * 10 ** exponent;
      if (candidate >= safeMin && candidate <= safeMax) {
        ticks.add(candidate);
      }
    }
  }

  ticks.add(safeMin);
  ticks.add(safeMax);
  return [...ticks].sort((left, right) => left - right);
}

function buildSeriesPoints(data, series, xScale, yScale) {
  return data
    .filter((record) => Number.isFinite(record[series.key]))
    .map((record) => ({
      x: xScale(record.datasetTripletCount),
      y: yScale(record[series.key]),
      value: record[series.key],
      triplets: record.datasetTripletCount,
      sourceFile: record.sourceFile,
    }));
}

function renderSvgChart(data, definition) {
  const width = 1800;
  const height = 1160;
  const margin = { top: 70, right: 70, bottom: 170, left: 190 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const xValues = data.map((record) => record.datasetTripletCount).filter(Number.isFinite);
  const seriesValues = definition.series.flatMap((series) =>
    data.map((record) => record[series.key]).filter(Number.isFinite),
  );

  if (!xValues.length || !seriesValues.length) {
    throw new Error(`Not enough data to draw ${definition.id}`);
  }

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...seriesValues);
  const maxY = Math.max(...seriesValues);
  const yDomainMin = Math.max(minY, 1e-9);
  const yDomainMax = Math.max(maxY, yDomainMin);
  const yTicks = createPositiveLogTicks(yDomainMin, yDomainMax, definition.yTickStrategy ?? 'dense');

  const logMin = Math.log10(minX);
  const logMax = Math.log10(maxX);
  const logYMin = Math.log10(yDomainMin);
  const logYMax = Math.log10(yDomainMax);
  const xScale = (value) =>
    margin.left + ((Math.log10(value) - logMin) / Math.max(logMax - logMin, 1e-9)) * plotWidth;
  const yScale = (value) =>
    margin.top +
    plotHeight -
    ((Math.log10(Math.max(value, 1e-9)) - logYMin) / Math.max(logYMax - logYMin, 1e-9)) * plotHeight;

  const xTicks = createLogTicks(minX, maxX);
  const gridLines = [];
  const axes = [];
  const labels = [];
  const seriesShapes = [];
  const legend = [];
  const defs = [];

  const axisLabelFontSize = 42;
  const tickFontSize = 34;
  const legendFontSize = 34;
  const lineStrokeWidth = 7;
  const pointRadius = 11;
  const pointStrokeWidth = 5;

  const filteredYTicks = [];
  const yTickMinSeparation = tickFontSize * 1.15;
  for (const tick of yTicks) {
    const y = yScale(tick);
    const previous = filteredYTicks[filteredYTicks.length - 1];
    if (previous && Math.abs(y - previous.y) < yTickMinSeparation) {
      filteredYTicks[filteredYTicks.length - 1] = { tick, y };
      continue;
    }
    filteredYTicks.push({ tick, y });
  }

  for (const { tick, y } of filteredYTicks) {
    gridLines.push(
      `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#d8d8d8" stroke-width="1.8" />`,
    );
    labels.push(
      `<text x="${margin.left - 24}" y="${y + 10}" text-anchor="end" font-size="${tickFontSize}" font-weight="700" fill="#262626">${escapeXml((definition.yTickFormatter ?? definition.valueFormatter)(tick))}</text>`,
    );
  }

  for (const tick of xTicks) {
    const x = xScale(tick);
    gridLines.push(
      `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="#e2e2e2" stroke-width="1.8" />`,
    );
    labels.push(
      `<text x="${x}" y="${height - margin.bottom + 58}" text-anchor="middle" font-size="${tickFontSize}" font-weight="700" fill="#262626">${escapeXml(tick.toLocaleString())}</text>`,
    );
  }

  defs.push(
    '<marker id="axis-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#111111" />' +
    '</marker>',
  );

  axes.push(
    `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right + 14}" y2="${height - margin.bottom}" stroke="#111111" stroke-width="3.5" marker-end="url(#axis-arrow)" />`,
  );
  axes.push(
    `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${margin.left}" y2="${margin.top - 14}" stroke="#111111" stroke-width="3.5" marker-end="url(#axis-arrow)" />`,
  );

  labels.push(
    `<text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="${axisLabelFontSize}" font-weight="700" fill="#111111">Dataset triplets (min-max normalized log scale)</text>`,
  );
  labels.push(
    `<text x="58" y="${height / 2}" transform="rotate(-90 58 ${height / 2})" text-anchor="middle" font-size="${axisLabelFontSize}" font-weight="700" fill="#111111">${escapeXml(definition.yAxisLabel)}</text>`,
  );

  const legendBoxX = margin.left + 26;
  const legendBoxWidth = 820;
  const legendRowHeight = 58;
  const legendPadding = 24;
  const activeSeries = definition.series.filter((series) =>
    data.some((record) => Number.isFinite(record[series.key])),
  );
  const legendBoxHeight = legendPadding * 2 + activeSeries.length * legendRowHeight;
  const legendBoxY = definition.legendPosition === 'middle-left'
    ? margin.top + (plotHeight - legendBoxHeight) / 2
    : margin.top + 26;

  legend.push(
    `<rect x="${legendBoxX}" y="${legendBoxY}" width="${legendBoxWidth}" height="${legendBoxHeight}" rx="10" ry="10" fill="#ffffff" fill-opacity="0.9" stroke="#cfcfcf" stroke-width="2" />`,
  );

  const legendX = legendBoxX + 28;
  let legendY = legendBoxY + legendPadding + 18;
  for (const series of definition.series) {
    const points = buildSeriesPoints(data, series, xScale, yScale);
    if (!points.length) {
      continue;
    }

    seriesShapes.push(
      `<polyline fill="none" stroke="${series.color}" stroke-width="${lineStrokeWidth}" ${series.dasharray ? `stroke-dasharray="${series.dasharray}"` : ''} points="${points.map((point) => `${point.x},${point.y}`).join(' ')}" />`,
    );

    for (const point of points) {
      seriesShapes.push(
        `<circle cx="${point.x}" cy="${point.y}" r="${pointRadius}" fill="#ffffff" stroke="${series.color}" stroke-width="${pointStrokeWidth}"><title>${escapeXml(`${series.label}: ${definition.valueFormatter(point.value)} at ${point.triplets.toLocaleString()} triplets (${point.sourceFile})`)}</title></circle>`,
      );
    }

    legend.push(
      `<line x1="${legendX}" y1="${legendY}" x2="${legendX + 112}" y2="${legendY}" stroke="${series.color}" stroke-width="${lineStrokeWidth}" ${series.dasharray ? `stroke-dasharray="${series.dasharray}"` : ''} />`,
    );
    legend.push(
      `<text x="${legendX + 140}" y="${legendY + 11}" font-size="${legendFontSize}" font-weight="700" fill="#1f1f1f">${escapeXml(series.label)}</text>`,
    );
    legendY += legendRowHeight;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${definition.id}-title ${definition.id}-desc">`,
    `<title id="${definition.id}-title">${escapeXml(definition.title)}</title>`,
    `<desc id="${definition.id}-desc">Line chart with dataset triplet count on a min-max normalized log-scale x-axis and ${escapeXml(definition.yAxisLabel.toLowerCase())} on a min-max normalized log-scale y-axis.</desc>`,
    `<rect width="${width}" height="${height}" fill="#ffffff" />`,
    `<defs>${defs.join('\n')}</defs>`,
    gridLines.join('\n'),
    axes.join('\n'),
    seriesShapes.join('\n'),
    labels.join('\n'),
    legend.join('\n'),
    '</svg>',
  ].join('\n');
}

function findFirefoxBinary() {
  return FIREFOX_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function renderPngWithFirefox(svg, outputPath) {
  const firefoxBinary = findFirefoxBinary();
  if (!firefoxBinary) {
    throw new Error('Could not find a Firefox binary for PNG export.');
  }

  const widthMatch = svg.match(/width="(\d+)"/);
  const heightMatch = svg.match(/height="(\d+)"/);
  const width = Number(widthMatch?.[1] ?? 1800);
  const height = Number(heightMatch?.[1] ?? 1160);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-viewer-scale-'));
  const htmlPath = path.join(tempDir, 'chart.html');
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<title>Scale Chart</title>',
    '<style>',
    'html, body { margin: 0; padding: 0; background: #ffffff; width: 100%; height: 100%; overflow: hidden; }',
    'body { display: flex; align-items: flex-start; justify-content: flex-start; }',
    `svg { display: block; width: ${width}px; height: ${height}px; background: #ffffff; }`,
    '</style>',
    '</head>',
    '<body>',
    svg,
    '</body>',
    '</html>',
  ].join('\n');

  fs.writeFileSync(htmlPath, html, 'utf8');

  try {
    execFileSync(
      firefoxBinary,
      [
        '--headless',
        '--screenshot',
        outputPath,
        '--window-size',
        `${width},${height}`,
        `file://${htmlPath}`,
      ],
      {
        stdio: 'pipe',
        env: {
          ...process.env,
          MOZ_DISABLE_CONTENT_SANDBOX: '1',
        },
      },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeCharts(data, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputs = [];

  for (const definition of CHART_DEFINITIONS) {
    const svg = renderSvgChart(data, definition);
    const svgPath = path.join(outputDir, `${definition.id}.svg`);
    const pngPath = path.join(outputDir, `${definition.id}.png`);
    fs.writeFileSync(svgPath, `${svg}\n`, 'utf8');
    renderPngWithFirefox(svg, pngPath);
    outputs.push(svgPath, pngPath);
  }

  return outputs;
}

function main() {
  const { inputDir, outputDir } = parseArgs(process.argv);
  const data = readScaleSummaries(inputDir);
  const outputs = writeCharts(data, outputDir);

  console.log(`Read ${data.length} summary files from ${inputDir}`);
  for (const outputPath of outputs) {
    console.log(`Wrote ${outputPath}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
