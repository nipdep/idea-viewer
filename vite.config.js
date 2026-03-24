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
    plugins: [react()],
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
