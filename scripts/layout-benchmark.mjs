// Usage: node scripts/<name>.mjs ... (dev server must be running: npm run dev)
// Set CHROMIUM_PATH to use a specific Chromium/Chrome binary; APP_URL to point at another server.
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const ROOT = new URL('../ontology/', import.meta.url).pathname;
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/';
const OUT_DIR = new URL('../log/layout-benchmark/', import.meta.url).pathname;
fs.mkdirSync(OUT_DIR, { recursive: true });
const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const args = process.argv.slice(2);
const tag = args.shift();
const files = args;
const METRICS = () => {
  const cy = window.__ideaViewerCy;
  const nodes = cy.nodes(':visible').not('[edgeAnchor = 1]').not('[edgeBendHandle = 1]');
  const edges = cy.edges(':visible').not('[edgeAnchorTether = 1]').not('[edgeAttachedConnector = 1]').not('[owlRelationConnector = 1]');
  const box = nodes.map(n => { const p = n.position(); return { x0: p.x - n.width()/2, x1: p.x + n.width()/2, y0: p.y - n.height()/2, y1: p.y + n.height()/2 }; });
  let overlapNodes = new Set();
  for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
    const a = box[i], b = box[j];
    if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) { overlapNodes.add(i); overlapNodes.add(j); }
  }
  const seg = edges.map(e => { const s = e.source().position(), t = e.target().position(); return { a: e.source().id(), b: e.target().id(), x1: s.x, y1: s.y, x2: t.x, y2: t.y }; });
  const ccw = (ax, ay, bx, by, cx, cy_) => (cy_ - ay) * (bx - ax) > (by - ay) * (cx - ax);
  let cross = 0;
  for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) {
    const p = seg[i], q = seg[j];
    if (p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b) continue;
    if (ccw(p.x1,p.y1,q.x1,q.y1,q.x2,q.y2) !== ccw(p.x2,p.y2,q.x1,q.y1,q.x2,q.y2) && ccw(p.x1,p.y1,p.x2,p.y2,q.x1,q.y1) !== ccw(p.x1,p.y1,p.x2,p.y2,q.x2,q.y2)) cross++;
  }
  const lens = seg.map(s => Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).sort((a, b) => a - b);
  const bb = nodes.boundingBox();
  const st = cy.scratch('_layoutStats') || {};
  const fontNode = parseFloat(nodes.length ? nodes[0].style('font-size') : 12) || 12;
  return {
    nodes: nodes.length, edges: edges.length,
    overlapPct: +(100 * overlapNodes.size / Math.max(1, nodes.length)).toFixed(1),
    crossPerEdge: +(cross / Math.max(1, edges.length)).toFixed(2),
    medEdge: Math.round(lens[Math.floor(lens.length/2)] || 0), p95Edge: Math.round(lens[Math.floor(lens.length*0.95)] || 0),
    bb: [Math.round(bb.w), Math.round(bb.h)],
    fitZoom: +cy.zoom().toFixed(3), fontPx: +(cy.zoom() * fontNode).toFixed(1),
    layoutMs: Math.round(st.ms || 0),
    inView: (() => { const w = cy.width(), h = cy.height(); let c = 0; nodes.forEach(n => { const r = n.renderedPosition(); if (r.x >= 0 && r.x <= w && r.y >= 0 && r.y <= h) c++; }); return Math.round(100 * c / Math.max(1, nodes.length)); })(),
  };
};
const POS = () => { const cy = window.__ideaViewerCy; const o = {}; cy.nodes().not('[edgeAnchor = 1]').forEach(n => { o[n.id()] = n.position(); }); return o; };
const b = await launch();
const rows = [];
for (const f of files) {
  const p = await b.newPage({viewport:{width:1600,height:950}}); if (process.env.OVR) await p.addInitScript(o=>{window.__ideaViewerLayoutOverrides=JSON.parse(o)}, process.env.OVR);
  p.on('pageerror', e=>console.log('PAGEERR', e.message.slice(0,300)));
  await p.goto(APP_URL); await p.waitForTimeout(1500);
  await p.setInputFiles('input[type=file]', ROOT+f);
  await p.waitForFunction(()=>/[1-9][\d,]* nodes visible/.test(document.body.innerText), null, {timeout:90000});
  for (const view of ['owl','rdf']) {
    await p.click(`.projection-toggle.theme-switch button:nth-of-type(${view==='owl'?1:2})`); await p.waitForTimeout(2500);
    for (const t of ['spread','hierarchy']) {
      await p.click(`button[data-layout-type=${t}]`);
      await p.waitForFunction(()=>window.__ideaViewerCy.scratch('_layoutStats'), null, {timeout:60000}).catch(()=>{});
      await p.waitForTimeout(3500);
      const m = await p.evaluate(METRICS);
      // determinism: re-run the same layout and compare positions
      await p.click(`button[data-layout-type=${t==='spread'?'hierarchy':'spread'}]`); await p.waitForTimeout(2500);
      await p.click(`button[data-layout-type=${t}]`); await p.waitForTimeout(3500);
      const before = await p.evaluate(POS);
      await p.click(`button[data-layout-type=${t==='spread'?'hierarchy':'spread'}]`); await p.waitForTimeout(2500);
      await p.click(`button[data-layout-type=${t}]`); await p.waitForTimeout(3500);
      const after = await p.evaluate(POS);
      let moved = 0, n = 0; for (const id in before) if (after[id]) { n++; if (Math.hypot(before[id].x-after[id].x, before[id].y-after[id].y) > 1) moved++; }
      m.nondeterministicPct = +(100*moved/Math.max(1,n)).toFixed(0);
      await p.screenshot({path:`${OUT_DIR}${tag}_${view}_${f.replace(/[^\w.]/g,'_')}_${t}.png`});
      console.log(f.padEnd(28), view, t.padEnd(9), JSON.stringify(m));
    }
  }
  await p.close();
}
await b.close();
