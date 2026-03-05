# idea* viewer

`idea* viewer` is a Knowledge Graph visualization app built with:
- React (UI/state)
- Cytoscape.js (graph rendering)
- N3.js (RDF parsing)
- Comunica (SPARQL filtering)

## Features

- Upload KG file (`.ttl`, `.n3`, `.nt`, `.nq`, `.trig`)
- Upload optional ontology file (`.owl`, `.rdf`, `.ttl`, `.n3`, `.nt`, `.nq`, `.trig`)
- Merge KG + ontology into one base graph
- Collapsible left panel:
  - File upload
  - Class (`rdf:type`) filters
  - SPARQL filters
- Collapsible right panel:
  - Selected node/entity details
  - Neighbor connections
  - Focus mode controls
- Click any entity to focus/snap to its 1-hop neighborhood
- Long label support:
  - Wrapped/truncated labels in graph nodes
  - Full text preserved in details panel

## Linux Setup (Complete)

### 1) Install system dependencies

For Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

For Fedora:

```bash
sudo dnf install -y curl git @development-tools
```

For Arch:

```bash
sudo pacman -Syu --noconfirm curl git base-devel
```

### 2) Install Node.js (recommended with nvm)

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Reload shell:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Install and use Node 22 LTS:

```bash
nvm install 22
nvm use 22
node -v
npm -v
```

### 3) Get project and install packages

If you already have the repo, `cd` into it. Otherwise:

```bash
git clone <your-repo-url> idea-viewer
cd idea-viewer
```

Install dependencies:

```bash
npm install
```

## Run Instructions

Start dev server:

```bash
npm run dev
```

Then open the URL printed by Vite (typically [http://localhost:5173](http://localhost:5173)).

## Reverse Proxy with Caddy

The app supports reverse-proxy routing under `/idea-viewer/`, including HMR over WSS.

### 1) Start the app in Caddy mode

Use the preconfigured script for your Tailscale host:

```bash
npm run dev:caddy:spark
```

Expected startup output should include:
- `Local: http://localhost:5173/`
- no syntax/build errors

The script sets:

```dotenv
VITE_BASE_PATH=/idea-viewer/
VITE_DEV_ORIGIN=https://spark-6d47.tailb1f37b.ts.net
VITE_HMR_PROTOCOL=wss
VITE_HMR_HOST=spark-6d47.tailb1f37b.ts.net
VITE_HMR_CLIENT_PORT=443
VITE_HMR_PATH=/idea-viewer/@vite/ws
```

### 2) Use this Caddy block (for your `:8081` file)

Important:
- Keep `handle_path` for other apps if needed.
- For `idea-viewer`, use `handle`, not `handle_path`.
- Add redirect from `/idea-viewer` to `/idea-viewer/`.

```caddy
:8081 {
    handle_path /fuseki* {
        reverse_proxy 127.0.0.1:3030
    }

    handle_path /idea-annotator* {
        reverse_proxy 127.0.0.1:3000
    }

    handle_path /static/* {
        reverse_proxy 127.0.0.1:3030
    }

    redir /idea-viewer /idea-viewer/ 308

    handle /idea-viewer* {
        reverse_proxy 127.0.0.1:5173
    }
}
```

Reload Caddy after editing:

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

### 3) If `spark-...` points to Caddy on `:8081`

If you are using Tailscale Serve/Funnel for the external HTTPS URL, make sure it forwards to `127.0.0.1:8081`:

```bash
tailscale serve status
```

You should see HTTPS traffic for `spark-6d47.tailb1f37b.ts.net` forwarding to your local `:8081`.

Open:
[https://spark-6d47.tailb1f37b.ts.net/idea-viewer/](https://spark-6d47.tailb1f37b.ts.net/idea-viewer/)

### 4) White page troubleshooting (quick checks)

Run these:

```bash
curl -I https://spark-6d47.tailb1f37b.ts.net/idea-viewer/
curl -I https://spark-6d47.tailb1f37b.ts.net/idea-viewer/@vite/client
curl -I https://spark-6d47.tailb1f37b.ts.net/idea-viewer/src/main.jsx
```

Expected: all return `200`.

If not:
- `404` on `@vite/client` or `src/main.jsx`: route rewrite issue, `handle` is not applied correctly.
- `502/503`: Vite is not running on `127.0.0.1:5173`.
- HTML loads but blank page: open browser console and check first red error; most often stale cache or JS load failure.

After changes, do a hard refresh once (`Ctrl+Shift+R`).

### 5) Production under `/idea-viewer`

Build with the same base path:

```bash
VITE_BASE_PATH=/idea-viewer/ npm run build
```

Example Caddy static config:

```caddy
http://localhost {
  handle_path /idea-viewer/* {
    root * /var/www/idea-viewer/dist
    try_files {path} /index.html
    file_server
  }
}
```

## Build and Preview

Production build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Notes

- `.owl`/`.rdf` files that are RDF/XML are currently rejected in this build.
- Turtle-family syntaxes are supported through N3 parser flow.
- SPARQL filter should return `?entity` (or any node variable bound to graph entities).
