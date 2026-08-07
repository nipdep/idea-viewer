import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

const GRAPH_SIZES = [10, 50, 100, 200, 500, 1000];
const ALGORITHMS = {
  magnetSpring: { name: 'Magnet + Spring', detail: 'rank-weighted quadratic force' },
  orbit: { name: 'Orbit', detail: 'degree-aware force' },
  tide: { name: 'Tide', detail: 'balanced spring force' },
  drift: { name: 'Drift', detail: 'gentle radial settling' },
};

function makeElements(nodeCount, connectedness) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    data: { id: "node-" + index, label: String(index + 1) },
    position: {
      x: Math.cos((index / nodeCount) * Math.PI * 2) * (260 + Math.random() * 80),
      y: Math.sin((index / nodeCount) * Math.PI * 2) * (260 + Math.random() * 80),
    },
  }));
  const edgeCount = Math.round((nodeCount - 1) * connectedness);
  const parent = Array.from({ length: nodeCount }, (_, index) => index);
  const findRoot = (index) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const edges = [];
  const connectComponents = (first, second) => {
    const firstRoot = findRoot(first);
    const secondRoot = findRoot(second);
    if (firstRoot === secondRoot) return false;
    parent[firstRoot] = secondRoot;
    const [source, target] = Math.random() < 0.5 ? [first, second] : [second, first];
    edges.push({ data: { id: "edge-" + edges.length, source: "node-" + source, target: "node-" + target } });
    return true;
  };

  // Seed a random matching first: this spends the available links covering nodes rather than making isolated vertices.
  const shuffledNodeIds = Array.from({ length: nodeCount }, (_, index) => index).sort(() => Math.random() - 0.5);
  for (let index = 0; index + 1 < nodeCount && edges.length < edgeCount; index += 2) {
    connectComponents(shuffledNodeIds[index], shuffledNodeIds[index + 1]);
  }

  // Then join only distinct components, preserving an acyclic, potentially disconnected forest.
  while (edges.length < edgeCount) {
    connectComponents(Math.floor(Math.random() * nodeCount), Math.floor(Math.random() * nodeCount));
  }
  return { nodes, edges };
}

function estimateMemory(nodes, edges) {
  // Positions, ids, and the two endpoint references; a useful browser-side estimate rather than heap total.
  return ((nodes * 80 + edges * 96) / 1024).toFixed(1);
}

function applyOrganization(cy, algorithm, iteration, iterationLimit) {
  const nodes = cy.nodes();
  const edges = cy.edges();
  const rawEntries = nodes.map((node) => ({ node, x: node.position('x'), y: node.position('y'), degree: node.degree() }));
  const rankValues = rawEntries.map((entry) => entry.degree);
  const minRank = Math.min(...rankValues);
  const maxRank = Math.max(...rankValues);
  const rankSpan = Math.max(1, maxRank - minRank);
  const entries = rawEntries.map((entry) => {
    const normalizedRank = (entry.degree - minRank) / rankSpan;
    return {
      ...entry,
      normalizedRank,
      magneticFieldStrength: 0.45 + normalizedRank * 1.55,
      nodeWeight: 0.45 + normalizedRank * 1.55,
      virtualRadius: 14 + normalizedRank * 34,
    };
  });
  const entryById = new Map(entries.map((entry) => [entry.node.id(), entry]));
  const force = new Map(entries.map(({ node }) => [node.id(), { x: 0, y: 0 }]));
  const count = entries.length;
  const isMagnetSpring = algorithm === 'magnetSpring';
  const cooling = isMagnetSpring ? Math.max(0.08, 1 - iteration / Math.max(1, iterationLimit)) : 1;
  const repulsion = isMagnetSpring ? 18000 / Math.max(1, count) : algorithm === 'orbit' ? 9200 : algorithm === 'tide' ? 6700 : 4200;
  const spring = isMagnetSpring ? 0.018 : algorithm === 'orbit' ? 0.010 : algorithm === 'tide' ? 0.017 : 0.008;
  const edgeLength = isMagnetSpring ? 96 : algorithm === 'drift' ? 112 : 84;

  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const a = entries[i];
      const b = entries[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < 1) { dx = 1; dy = 1; distanceSquared = 2; }
      const distance = Math.sqrt(distanceSquared);
      // Each pair is evaluated here, which makes Magnet + Spring O(n²) per solver step.
      const aFieldPenetration = Math.max(0, 1 - distance / a.virtualRadius);
      const bFieldPenetration = Math.max(0, 1 - distance / b.virtualRadius);
      const fieldStrength = a.magneticFieldStrength * aFieldPenetration + b.magneticFieldStrength * bFieldPenetration;
      // Virtual radii are field boundaries: nodes may enter them; force only grows after that boundary is crossed.
      const value = (repulsion / distanceSquared) * (isMagnetSpring ? fieldStrength : 1) * cooling;
      const ax = (dx / distance) * value;
      const ay = (dy / distance) * value;
      force.get(a.node.id()).x -= ax;
      force.get(a.node.id()).y -= ay;
      force.get(b.node.id()).x += ax;
      force.get(b.node.id()).y += ay;
    }
  }

  edges.forEach((edge) => {
    const source = edge.source();
    const target = edge.target();
    const a = entryById.get(source.id());
    const b = entryById.get(target.id());
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const springWeight = isMagnetSpring ? 0.75 + (a.normalizedRank + b.normalizedRank) * 0.25 : 1;
    const value = (distance - edgeLength) * spring * springWeight * cooling;
    const ax = (dx / distance) * value;
    const ay = (dy / distance) * value;
    force.get(a.node.id()).x += ax;
    force.get(a.node.id()).y += ay;
    force.get(b.node.id()).x -= ax;
    force.get(b.node.id()).y -= ay;
  });

  cy.batch(() => entries.forEach((entry) => {
    const value = force.get(entry.node.id());
    const damping = algorithm === 'orbit' ? 1 / (1 + entry.degree * 0.08) : isMagnetSpring ? 1 / entry.nodeWeight : 1;
    const center = algorithm === 'drift' ? 0.004 : isMagnetSpring ? 0.002 : 0.0015;
    entry.node.position({
      x: entry.x + Math.max(-18, Math.min(18, value.x * damping)) - entry.x * center,
      y: entry.y + Math.max(-18, Math.min(18, value.y * damping)) - entry.y * center,
    });
  }));
}

export default function MockGraphLab({ onExit }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [nodeCount, setNodeCount] = useState(100);
  const [connectedness, setConnectedness] = useState(0.55);
  const [algorithm, setAlgorithm] = useState('magnetSpring');
  const [speed, setSpeed] = useState(180);
  const [iterationLimit, setIterationLimit] = useState(100);
  const iterationRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [revision, setRevision] = useState(0);
  const [stats, setStats] = useState({ iterations: 0, elapsed: 0, compute: 0, edges: 0, components: 0 });

  useEffect(() => {
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      wheelSensitivity: 0.18,
      style: [
        { selector: 'node', style: { label: 'data(label)', width: 20, height: 20, 'background-color': '#f6eadc', 'border-width': 1.5, 'border-color': '#b65a3b', color: '#40342c', 'font-size': 7, 'text-valign': 'center', 'text-halign': 'center' } },
        { selector: 'edge', style: { width: 1, 'line-color': '#6e9c99', 'target-arrow-color': '#6e9c99', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.7, opacity: 0.72 } },
      ],
    });
    cyRef.current = cy;
    const observer = new ResizeObserver(() => cy.resize());
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); cy.destroy(); };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    setRunning(false);
    const { nodes, edges } = makeElements(nodeCount, connectedness);
    cy.elements().remove();
    cy.add([...nodes, ...edges]);
    cy.fit(cy.elements(), 56);
    iterationRef.current = 0;
    setStats({ iterations: 0, elapsed: 0, compute: 0, edges: edges.length, components: nodeCount - edges.length });
  }, [nodeCount, connectedness, revision]);

  useEffect(() => {
    if (!running) return undefined;
    if (iterationRef.current >= iterationLimit) {
      setRunning(false);
      return undefined;
    }
    let cancelled = false;
    let timer;
    const tick = () => {
      if (cancelled || iterationRef.current >= iterationLimit) {
        setRunning(false);
        return;
      }
      const started = performance.now();
      applyOrganization(cyRef.current, algorithm, iterationRef.current, iterationLimit);
      const duration = performance.now() - started;
      iterationRef.current += 1;
      setStats((current) => ({ ...current, iterations: iterationRef.current, elapsed: current.elapsed + speed, compute: current.compute + duration }));
      if (iterationRef.current < iterationLimit) {
        timer = window.setTimeout(tick, speed);
      } else {
        setRunning(false);
      }
    };
    timer = window.setTimeout(tick, speed);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [running, speed, algorithm, iterationLimit]);

  const step = () => {
    if (iterationRef.current >= iterationLimit) return;
    const started = performance.now();
    applyOrganization(cyRef.current, algorithm, iterationRef.current, iterationLimit);
    const duration = performance.now() - started;
    iterationRef.current += 1;
    setStats((current) => ({ ...current, iterations: iterationRef.current, elapsed: current.elapsed + speed, compute: current.compute + duration }));
  };

  return (
    <main className="lab-shell">
      <aside className="lab-panel">
        <button type="button" className="lab-back" onClick={onExit}>← IDEA Viewer</button>
        <p className="lab-eyebrow">Independent experiment</p>
        <h1>Graph lab</h1>
        <p className="lab-intro">A clean Cytoscape sandbox for testing self-organization against generated directed graphs.</p>

        <label className="lab-field">Graph size <span>n = {nodeCount}</span>
          <select value={nodeCount} onChange={(event) => setNodeCount(Number(event.target.value))}>
            {GRAPH_SIZES.map((size) => <option key={size} value={size}>{size} nodes</option>)}
          </select>
        </label>
        <label className="lab-field">Forest connectedness <span>r = {connectedness.toFixed(2)}</span>
          <input type="range" min="0.55" max="1" step="0.05" value={connectedness} onChange={(event) => setConnectedness(Number(event.target.value))} />
          <small>Fraction of maximum forest links (n − 1). The minimum keeps every node connected to at least one arrow. This run has {Math.round((nodeCount - 1) * connectedness)} arrows in {nodeCount - Math.round((nodeCount - 1) * connectedness)} components.</small>
        </label>
        <label className="lab-field">Organization algorithm
          <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
            {Object.entries(ALGORITHMS).map(([id, option]) => <option key={id} value={id}>{option.name} — {option.detail}</option>)}
          </select>
        </label>
        <label className="lab-field">Algorithm iterations <span>{iterationLimit} steps</span>
          <input type="range" min="10" max="500" step="10" value={iterationLimit} onChange={(event) => setIterationLimit(Number(event.target.value))} />
          <small>One step is one self-organization solver iteration. The run pauses at this limit.</small>
        </label>
        <label className="lab-field">Rendering speed <span>{speed} ms</span>
          <input type="range" min="30" max="1000" step="10" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          <small>Time each iteration remains visible.</small>
        </label>
        <div className="lab-actions">
          <button type="button" className="lab-primary" disabled={stats.iterations >= iterationLimit} onClick={() => setRunning((value) => !value)}>{running ? 'Pause' : stats.iterations >= iterationLimit ? 'Run complete' : 'Run'}</button>
          <button type="button" disabled={stats.iterations >= iterationLimit} onClick={step}>Step once</button>
          <button type="button" onClick={() => setRevision((value) => value + 1)}>New graph</button>
        </div>
      </aside>
      <section className="lab-stage">
        <div className="lab-stage-header"><div><p className="lab-eyebrow">{ALGORITHMS[algorithm].name}</p><h2>{nodeCount} nodes · {stats.edges} arrows · {stats.components} components</h2></div><span className={running ? 'lab-status active' : 'lab-status'}>{running ? 'Organizing' : stats.iterations >= iterationLimit ? 'Complete' : 'Paused'}</span></div>
        <div ref={containerRef} className="lab-graph" />
      </section>
      <footer className="lab-footer">
        <span>Total rendering time <strong>{(stats.elapsed / 1000).toFixed(2)} s</strong></span>
        <span>Iterations <strong>{stats.iterations} / {iterationLimit}</strong></span>
        <span>Algorithm compute <strong>{stats.compute.toFixed(1)} ms</strong></span>
        <span>Estimated graph memory <strong>{estimateMemory(nodeCount, stats.edges)} KB</strong></span>
      </footer>
    </main>
  );
}
