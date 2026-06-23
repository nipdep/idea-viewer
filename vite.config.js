import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return '/';
  }

  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function createTelemetryPersistenceMiddleware() {
  return async (req, res, next) => {
    const requestPath = String(req.url || '').split('?')[0];
    if (req.method !== 'POST' || !requestPath.endsWith('/__telemetry/session')) {
      next();
      return;
    }

    try {
      const body = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
      });

      const payload = JSON.parse(body || '{}');
      const fileName = String(payload?.session?.fileName || '').trim();
      const text = typeof payload?.text === 'string' ? payload.text : '';
      if (!fileName || !text) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Missing telemetry session fileName or text');
        return;
      }

      const logDir = path.resolve(process.cwd(), 'log');
      fs.mkdirSync(logDir, { recursive: true });

      const logPath = path.join(logDir, fileName);
      fs.writeFileSync(logPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');

      const statsText = execFileSync(process.execPath, ['scripts/analyze-telemetry-log.mjs', logPath], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      const statsPath = logPath.replace(/\.ndjson$/i, '.md');
      fs.writeFileSync(statsPath, statsText, 'utf8');

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ logPath, statsPath }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(error?.stack || error?.message || String(error));
    }
  };
}

function telemetryPersistencePlugin() {
  return {
    name: 'telemetry-persistence-plugin',
    configureServer(server) {
      server.middlewares.use(createTelemetryPersistenceMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createTelemetryPersistenceMiddleware());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBasePath(env.VITE_BASE_PATH || '/');
  const isVercelDeployment = isTruthy(env.VERCEL) || isTruthy(process.env.VERCEL);

  const hmr = {};
  if (env.VITE_HMR_PROTOCOL) {
    hmr.protocol = env.VITE_HMR_PROTOCOL;
  }
  if (env.VITE_HMR_HOST) {
    hmr.host = env.VITE_HMR_HOST;
  }
  if (env.VITE_HMR_PATH) {
    hmr.path = env.VITE_HMR_PATH;
  }
  if (env.VITE_HMR_CLIENT_PORT) {
    hmr.clientPort = toNumber(env.VITE_HMR_CLIENT_PORT, undefined);
  }
  if (env.VITE_HMR_PORT) {
    hmr.port = toNumber(env.VITE_HMR_PORT, undefined);
  }

  return {
    base,
    define: {
      __VERCEL_DEPLOYMENT__: JSON.stringify(isVercelDeployment),
    },
    plugins: [react(), telemetryPersistencePlugin()],
    server: {
      host: env.VITE_DEV_HOST || '0.0.0.0',
      port: toNumber(env.VITE_DEV_PORT, 5173),
      strictPort: true,
      allowedHosts: true,
      origin: env.VITE_DEV_ORIGIN || undefined,
      hmr: Object.keys(hmr).length > 0 ? hmr : undefined,
    },
    preview: {
      host: env.VITE_PREVIEW_HOST || '0.0.0.0',
      port: toNumber(env.VITE_PREVIEW_PORT, 4173),
      strictPort: true,
    },
  };
});
