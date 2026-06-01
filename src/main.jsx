import React from 'react';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');

function showBootMessage(title, detail = '') {
  if (!rootElement) {
    return;
  }

  rootElement.innerHTML = `
    <div style="
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      color: #1e1b16;
      font-family: Palatino Linotype, Book Antiqua, Palatino, Georgia, serif;
      background: radial-gradient(circle at top left, #f8e6d6 0%, #fef6ee 40%, #f3f5f4 100%);
    ">
      <div style="
        max-width: 760px;
        width: min(760px, 100%);
        border: 1px solid rgba(30, 27, 22, 0.14);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 18px 40px rgba(30, 27, 22, 0.12);
        padding: 22px 24px;
      ">
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 500;">${title}</h1>
        ${
          detail
            ? `<pre style="white-space: pre-wrap; margin: 12px 0 0; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #7a2f20;">${detail}</pre>`
            : '<p style="margin: 0; color: #6b6157;">Loading the application shell...</p>'
        }
      </div>
    </div>
  `;
}

function formatBootError(error) {
  const message = error?.stack || error?.message || String(error);
  return message.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function ErrorFallback({ error }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        color: '#1e1b16',
        fontFamily: 'Palatino Linotype, Book Antiqua, Palatino, Georgia, serif',
        background: 'radial-gradient(circle at top left, #f8e6d6 0%, #fef6ee 40%, #f3f5f4 100%)',
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: 'min(760px, 100%)',
          border: '1px solid rgba(30, 27, 22, 0.14)',
          borderRadius: 14,
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 18px 40px rgba(30, 27, 22, 0.12)',
          padding: '22px 24px',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 500 }}>IDEA Viewer failed to start</h1>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            margin: '12px 0 0',
            font: '13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            color: '#7a2f20',
          }}
        >
          {error?.stack || error?.message || String(error)}
        </pre>
      </div>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('IDEA Viewer failed to start', error);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

async function boot() {
  const [{ default: App }, { Analytics }] = await Promise.all([
    import('./App'),
    import('@vercel/analytics/react'),
  ]);
  const analyticsEnabledByEnv = ['1', 'true', 'yes', 'on'].includes(
    String(import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS ?? '')
      .trim()
      .toLowerCase(),
  );
  const enableVercelAnalytics =
    import.meta.env.PROD && __VERCEL_DEPLOYMENT__ && analyticsEnabledByEnv;

  reactStarted = true;
  ReactDOM.createRoot(rootElement).render(
    <AppErrorBoundary>
      <App />
      {enableVercelAnalytics ? <Analytics mode="production" /> : null}
    </AppErrorBoundary>,
  );
}

let reactStarted = false;
boot().catch((error) => {
  if (reactStarted) {
    console.error('IDEA Viewer failed after React startup', error);
    return;
  }
  showBootMessage('IDEA Viewer failed to start', formatBootError(error));
});
