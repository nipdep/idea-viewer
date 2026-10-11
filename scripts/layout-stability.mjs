// Usage: node scripts/<name>.mjs ... (dev server must be running: npm run dev)
// Set CHROMIUM_PATH to use a specific Chromium/Chrome binary; APP_URL to point at another server.
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const ROOT = new URL('../ontology/', import.meta.url).pathname;
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173/';
const OUT_DIR = new URL('../log/layout-benchmark/', import.meta.url).pathname;
fs.mkdirSync(OUT_DIR, { recursive: true });
const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const [file, view] = process.argv.slice(2);
const b = await launch();
const p = await b.newPage({viewport:{width:1600,height:950}});
p.on('pageerror', e=>console.log('PAGEERR', e.message.slice(0,300)));
await p.goto(APP_URL); await p.waitForTimeout(1500);
await p.setInputFiles('input[type=file]', ROOT+file);
await p.waitForFunction(()=>/[1-9][\d,]* nodes visible/.test(document.body.innerText), null, {timeout:90000});
if (view==='tax') { await p.getByText('Taxonomy',{exact:true}).first().click(); await p.waitForTimeout(2500); }
if (view==='rdf') { await p.click('.projection-toggle.theme-switch button:nth-of-type(2)'); await p.waitForTimeout(2500); }
await p.click('button[data-layout-type=hierarchy]'); await p.waitForTimeout(4000);
const snap = () => p.evaluate(()=>{const cy=window.__ideaViewerCy; const o={}; cy.nodes(':visible').not('[edgeAnchor = 1]').forEach(n=>{const r=n.renderedPosition(); o[n.id()]=[r.x,r.y];}); return o;});
for (let step=0; step<3; step++) {
  const target = await p.evaluate(()=>{const cy=window.__ideaViewerCy; const n=cy.nodes('[collapsedCount > 0]').sort((a,b)=>a.data('collapsedCount')-b.data('collapsedCount')).filter(n=>{const r=n.renderedPosition(); return r.x>20&&r.x<cy.width()-20&&r.y>20&&r.y<cy.height()-20;})[0]; if(!n) return null; const r=n.renderedPosition(), box=cy.container().getBoundingClientRect(); return {id:n.id(), label:n.data('label'), count:n.data('collapsedCount'), x:box.left+r.x, y:box.top+r.y};});
  if (!target) { console.log('no collapsed node in view'); break; }
  const before = await snap();
  await p.mouse.dblclick(target.x, target.y); await p.waitForTimeout(2500);
  const after = await snap();
  const anchorMove = Math.hypot(after[target.id][0]-before[target.id][0], after[target.id][1]-before[target.id][1]);
  const moves=[]; for (const id in before) if (after[id] && id!==target.id) moves.push(Math.hypot(after[id][0]-before[id][0], after[id][1]-before[id][1]));
  moves.sort((a,b)=>a-b);
  const q=(f)=>Math.round(moves[Math.floor(moves.length*f)]||0);
  console.log(`expand "${target.label}" (+${target.count}): anchorMovePx=${anchorMove.toFixed(1)} shown ${Object.keys(before).length}->${Object.keys(after).length} otherNodesMovedPx median=${q(.5)} p90=${q(.9)} max=${q(.999)}`);
}
await b.close();
