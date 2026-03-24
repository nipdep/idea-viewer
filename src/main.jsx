import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import App from './App';

const baseUrl = import.meta.env.BASE_URL || '/';
const routerBasename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '');
const analyticsEnabledByEnv = ['1', 'true', 'yes', 'on'].includes(
  String(import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS ?? '')
    .trim()
    .toLowerCase(),
);
const enableVercelAnalytics =
  import.meta.env.PROD && __VERCEL_DEPLOYMENT__ && analyticsEnabledByEnv;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {enableVercelAnalytics ? <Analytics mode="production" /> : null}
    </BrowserRouter>
  </React.StrictMode>,
);
