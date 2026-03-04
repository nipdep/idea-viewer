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

### error
```
$ npm run dev

> idea-viewer@0.1.0 dev
> vite


  VITE v6.4.1  ready in 102 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
Error:   Failed to scan for dependencies from entries:
  /home/nipdep/Dev/idea-viewer/index.html

  ✘ [ERROR] Unexpected backslash in JSX element

    src/App.jsx:553:119:
      553 │ ...?entity ?p ?o . FILTER(CONTAINS(LCASE(STR(?o)), \"argument\")) }"
          ╵                                                              ^

  Quoted JSX attributes use XML-style escapes instead of JavaScript-style escapes:

    src/App.jsx:553:109:
      553 │ ...?entity ?p ?o . FILTER(CONTAINS(LCASE(STR(?o)), \"argument\")) }"
          │                                                    ~~
          ╵                                                    &quot;

  Consider using a JavaScript string inside {...} instead of a quoted JSX attribute:

    src/App.jsx:553:28:
      553 │ ...aceholder="SELECT DISTINCT ?entity WHERE { ?entity ?p ?o . FIL...
          │              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          ╵              {"SELECT DISTINCT ?entity WHERE { ?entity ?p ?o . FILTER(CONTAINS(LCASE(STR(?o)), \"argument\")) }"}


    at failureErrorWithLog (/home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:1467:15)
    at /home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:926:25
    at runOnEndCallbacks (/home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:1307:45)
    at buildResponseToResult (/home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:924:7)
    at /home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:936:9
    at new Promise (<anonymous>)
    at requestCallbacks.on-end (/home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:935:54)
    at handleRequest (/home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:628:17)
    at handleIncomingPacket (/home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:653:7)
    at Socket.readFromStdout (/home/nipdep/Dev/idea-viewer/node_modules/esbuild/lib/main.js:581:7)
    ```