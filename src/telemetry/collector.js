function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeError(error) {
  if (!error) {
    return null;
  }
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack || '',
  };
}

function sanitizeIsoForFilename(value) {
  return String(value).replace(/:/g, '-').replace(/\./g, '-');
}

function isTelemetryEnabled() {
  const raw = String(import.meta.env.VITE_ENABLE_TELEMETRY ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function createNoopSpan() {
  return {
    end() {},
    fail() {},
  };
}

function createSession(commonContext, startupDate, sessionId = createId('session')) {
  const startedAtIso = startupDate.toISOString();
  return {
    id: sessionId,
    startedAtIso,
    fileName: `${commonContext.appName}-${sanitizeIsoForFilename(startedAtIso)}.ndjson`,
  };
}

export function createTelemetryCollector(options = {}) {
  const enabled = options.enabled ?? isTelemetryEnabled();
  const commonContext = {
    appName: options.appName ?? 'idea-viewer',
  };
  const records = [];

  const collector = {
    enabled,
    session: createSession(commonContext, options.startupDate ?? new Date(), options.sessionId),
    records,
    addRecord(record) {
      if (!enabled) {
        return;
      }
      records.push({
        sessionId: collector.session.id,
        ts: Date.now(),
        ...record,
      });
    },
    startSpan(name, context = {}) {
      if (!enabled) {
        return createNoopSpan();
      }
      const opId = createId('span');
      const startedAt = performance.now();
      let finished = false;

      const finish = (status, extra = {}) => {
        if (finished) {
          return;
        }
        finished = true;
        const endedAt = performance.now();
        collector.addRecord({
          type: 'span',
          name,
          opId,
          startedAt,
          endedAt,
          durationMs: Number((endedAt - startedAt).toFixed(3)),
          status,
          context: {
            ...commonContext,
            ...context,
            ...(extra.context ?? {}),
          },
          error: extra.error ?? null,
        });
      };

      return {
        opId,
        end(extra = {}) {
          finish('ok', extra);
        },
        fail(error, extra = {}) {
          finish('error', {
            ...extra,
            error: normalizeError(error),
          });
        },
      };
    },
    recordEvent(name, context = {}) {
      collector.addRecord({
        type: 'event',
        name,
        context: {
          ...commonContext,
          ...context,
        },
        error: null,
      });
    },
    recordMetric(name, value, context = {}) {
      collector.addRecord({
        type: 'gauge',
        name,
        value,
        context: {
          ...commonContext,
          ...context,
        },
        error: null,
      });
    },
    async captureMemory(context = {}) {
      if (!enabled || typeof performance === 'undefined') {
        return null;
      }
      try {
        if (typeof performance.measureUserAgentSpecificMemory === 'function') {
          const result = await performance.measureUserAgentSpecificMemory();
          collector.recordMetric('memory.used.bytes', result.bytes, context);
          return result.bytes;
        }
        if (performance.memory && Number.isFinite(performance.memory.usedJSHeapSize)) {
          collector.recordMetric('memory.used.bytes', performance.memory.usedJSHeapSize, context);
          if (Number.isFinite(performance.memory.totalJSHeapSize)) {
            collector.recordMetric('memory.total.bytes', performance.memory.totalJSHeapSize, context);
          }
          if (Number.isFinite(performance.memory.jsHeapSizeLimit)) {
            collector.recordMetric('memory.limit.bytes', performance.memory.jsHeapSizeLimit, context);
          }
          return performance.memory.usedJSHeapSize;
        }
      } catch (error) {
        collector.recordEvent('memory.capture.failed', {
          ...context,
          message: error.message || String(error),
        });
      }
      return null;
    },
    exportText() {
      return records.map((record) => JSON.stringify(record)).join('\n');
    },
    getSnapshot() {
      return {
        session: { ...collector.session },
        records: records.map((record) => ({ ...record })),
        text: collector.exportText(),
      };
    },
    startNewSession(startupDate = new Date()) {
      records.length = 0;
      collector.session = createSession(commonContext, startupDate);
      if (enabled) {
        collector.addRecord({
          type: 'session-start',
          name: 'session.start',
          context: {
            ...commonContext,
            startedAtIso: collector.session.startedAtIso,
            fileName: collector.session.fileName,
          },
          error: null,
        });
      }
      return collector.session;
    },
  };

  if (enabled) {
    collector.addRecord({
      type: 'session-start',
      name: 'session.start',
      context: {
        ...commonContext,
        startedAtIso: collector.session.startedAtIso,
        fileName: collector.session.fileName,
      },
      error: null,
    });
  }

  return collector;
}
