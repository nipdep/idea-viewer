import { createTelemetryCollector } from './collector';
import { exportTelemetrySession } from './export';

export const telemetry = createTelemetryCollector({
  appName: 'idea-viewer',
});

export { exportTelemetrySession };
