import { createTelemetryCollector } from './collector';

export const telemetry = createTelemetryCollector({
  appName: 'idea-viewer',
  enabled: __TELEMETRY_ENABLED__,
});

export async function persistAndRotateTelemetrySession({ reason = 'clear', context = {} } = {}) {
  if (!__TELEMETRY_ENABLED__ || !telemetry.enabled) {
    return { skipped: true, reason: 'disabled' };
  }

  telemetry.recordEvent('session.end', {
    reason,
    ...context,
  });

  const snapshot = telemetry.getSnapshot();
  const meaningfulRecordCount = snapshot.records.filter((record) => record.name !== 'session.start').length;
  if (meaningfulRecordCount === 0) {
    telemetry.startNewSession();
    return { skipped: true, reason: 'empty' };
  }

  const telemetryEndpoint = new URL('__telemetry/session', window.location.href).toString();
  try {
    const response = await fetch(telemetryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: snapshot.session,
        text: snapshot.text,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Telemetry persistence failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    telemetry.startNewSession();
  }
}
