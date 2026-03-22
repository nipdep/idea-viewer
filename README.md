# idea* viewer

`idea* viewer` is a Knowledge Graph visualization app built with:
- React (UI/state)
- Cytoscape.js (graph rendering)
- N3.js (RDF parsing)
- Comunica (SPARQL filtering)

## Features

- Upload KG file (`.ttl`, `.rdf`, `.n3`, `.nt`, `.nq`, `.trig`)
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

Optional local env file:

```bash
cp .env.example .env.local
```

By default, Vercel Analytics is disabled locally:

```dotenv
VITE_ENABLE_VERCEL_ANALYTICS=false
```

## Run Instructions

Start dev server:

```bash
npm run dev
```

Then open the URL printed by Vite (typically [http://localhost:5173](http://localhost:5173)).

## Docker

The repo includes a production-oriented Docker setup for the UI with:
- multi-stage build (`node:22-alpine` -> `nginx:alpine`)
- a generic static runtime image that anyone can run directly
- a single mapped UI port
- configurable Vite build base path and matching runtime route handling

Your personal Caddy reverse proxy remains optional and external to the container.

Notes:
- `VITE_BASE_PATH` controls how the app is built.
- `APP_BASE_PATH` controls how the runtime server routes requests.
- Keep them aligned for subpath deployments.
- `APP_BASE_PATH` does not rewrite built asset URLs by itself.
- Multi-arch builds use the native builder platform for the Vite compile step, then package the static output into each target image.

### 1) Build

Build the image locally for the root path:

```bash
docker build --build-arg VITE_BASE_PATH=/ -t idea-viewer-ui .
```

Build the image locally for `/idea-viewer/`:

```bash
docker build --build-arg VITE_BASE_PATH=/idea-viewer/ -t idea-viewer-ui .
```

Build and push multi-arch images from an ARM machine:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg VITE_BASE_PATH=/ \
  -t <your-dockerhub-user>/idea-viewer-ui:latest \
  --push .
```

Subpath tag example:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg VITE_BASE_PATH=/idea-viewer/ \
  -t <your-dockerhub-user>/idea-viewer-ui:idea-viewer-base \
  --push .
```

If you prefer Compose for a local build + run flow:

```bash
docker compose up --build
```

Subpath example:

```bash
VITE_BASE_PATH=/idea-viewer/ APP_BASE_PATH=/idea-viewer/ docker compose up --build
```

### 2) Run

#### Run from a local build

Run the locally built root-path image:

```bash
docker run --rm -p 8080:8080 idea-viewer-ui
```

Open [http://localhost:8080](http://localhost:8080).

Change the host port if needed:

```bash
docker run --rm -p 3000:8080 idea-viewer-ui
```

Run the locally built subpath image that was built with `VITE_BASE_PATH=/idea-viewer/`:

```bash
docker run --rm -p 8080:8080 idea-viewer-ui
```

Open [http://localhost:8080/idea-viewer/](http://localhost:8080/idea-viewer/).

If you need to override the runtime base path, make sure the image was built with the same base path:

```bash
docker run --rm -p 8080:8080 -e APP_BASE_PATH=/idea-viewer/ idea-viewer-ui
```

#### Run from Docker Hub

Replace `<your-dockerhub-user>/idea-viewer-ui:<tag>` with your published image name.

Pull a root-path image:

```bash
docker pull <your-dockerhub-user>/idea-viewer-ui:latest
```

Run it:

```bash
docker run --rm -p 8080:8080 <your-dockerhub-user>/idea-viewer-ui:latest
```

Open [http://localhost:8080](http://localhost:8080).

For `/idea-viewer/`, publish and pull a tag that was built with `VITE_BASE_PATH=/idea-viewer/`.

Example:

```bash
docker pull <your-dockerhub-user>/idea-viewer-ui:idea-viewer-base
docker run --rm -p 8080:8080 <your-dockerhub-user>/idea-viewer-ui:idea-viewer-base
```

Open [http://localhost:8080/idea-viewer/](http://localhost:8080/idea-viewer/).

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

## Vercel Analytics

`idea* viewer` supports [Vercel Analytics](https://vercel.com/docs/analytics) behind an explicit Vite env flag.

Behavior:
- Disabled by default
- Only rendered in production builds
- Intended to be enabled in Vercel project environment variables

### Local behavior

Keep analytics off in local development:

```bash
cp .env.example .env.local
```

`.env.local`

```dotenv
VITE_ENABLE_VERCEL_ANALYTICS=false
```

### Enable it in Vercel

1. Make sure dependencies are installed locally and committed:

```bash
npm install
```

2. In your Vercel project, open:
   `Project -> Settings -> Environment Variables`

3. Add this variable:

```dotenv
VITE_ENABLE_VERCEL_ANALYTICS=true
```

4. Scope it to the environments where you want analytics enabled:
   - `Production` only, if you only want production traffic tracked
   - `Preview` too, if you also want preview deployments tracked

5. Redeploy the project.

### What the app checks

Analytics renders only when both conditions are true:

```text
import.meta.env.PROD
VITE_ENABLE_VERCEL_ANALYTICS === "true"
```

That means:
- local `npm run dev` stays off
- builds without the env flag stay off
- Vercel deployments with the env flag turned on will send analytics

## Notes

- RDF/XML (`.rdf`, `.owl`) and Turtle-family syntaxes are supported.
- SPARQL filter should return `?entity` (or any node variable bound to graph entities).

## error
```
$ npm run dev:caddy:spark

> idea-viewer@0.1.0 dev:caddy:spark
> VITE_BASE_PATH=/idea-viewer/ VITE_DEV_ORIGIN=https://spark-6d47.tailb1f37b.ts.net VITE_HMR_PROTOCOL=wss VITE_HMR_HOST=spark-6d47.tailb1f37b.ts.net VITE_HMR_CLIENT_PORT=443 VITE_HMR_PATH=/idea-viewer/@vite/ws vite --host 0.0.0.0 --strictPort

sh: 1: vite: not found
```
