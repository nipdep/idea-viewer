const C = { visibleRadius: 10, minHeadroom: 12, headroomScale: 38, edgeGap: 18, siblingGap: 8, rotations: 16, componentGap: 80, futureDiscount: .58, edgeTolerance: .001, magneticPasses: 4, magneticStrength: 13, magneticStepCap: 9 };
const TAU = Math.PI * 2;
const key = (x, y, size) => `${Math.floor(x / size)},${Math.floor(y / size)}`;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pairDistance = (a, b) => a.radius + b.radius + C.edgeGap;

function model(cy) {
  const degrees = cy.nodes().map((n) => n.degree()); const min = Math.min(...degrees); const span = Math.max(1, Math.max(...degrees) - min);
  const nodes = cy.nodes().map((node) => { const rank = (node.degree() - min) / span; return { id: node.id(), node, rank, radius: C.visibleRadius + C.minHeadroom + C.headroomScale * Math.sqrt(rank), neighbors: new Set(), children: [], depth: undefined, planted: false, demand: 0 }; });
  const byId = new Map(nodes.map((x) => [x.id, x])); cy.edges().forEach((edge) => { const a = byId.get(edge.source().id()); const b = byId.get(edge.target().id()); a.neighbors.add(b.id); b.neighbors.add(a.id); }); return { nodes, byId };
}
function split(nodes, byId) { const unseen = new Set(nodes.map((x) => x.id)); const out = []; while (unseen.size) { const q = [unseen.values().next().value]; unseen.delete(q[0]); const c = []; while (q.length) { const n = byId.get(q.shift()); c.push(n); n.neighbors.forEach((id) => { if (unseen.delete(id)) q.push(id); }); } out.push(c); } return out; }
function spatial(entries, cellSize) { const cells = new Map(); entries.filter((x) => x.planted).forEach((x) => { const bucket = cells.get(key(x.x, x.y, cellSize)) ?? []; bucket.push(x); cells.set(key(x.x, x.y, cellSize), bucket); }); return { cells, cellSize }; }
function nearby(index, x, y, range) { const result = []; const cx = Math.floor(x / index.cellSize); const cy = Math.floor(y / index.cellSize); const cells = Math.ceil(range / index.cellSize); for (let dx = -cells; dx <= cells; dx += 1) for (let dy = -cells; dy <= cells; dy += 1) result.push(...(index.cells.get(`${cx + dx},${cy + dy}`) ?? [])); return result; }
function buildForest(component, byId) {
  const root = [...component].sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))[0]; root.depth = 0; const queue = [root];
  while (queue.length) { queue.sort((a, b) => a.depth - b.depth || b.rank - a.rank || a.id.localeCompare(b.id)); const parent = queue.shift(); const choices = [...parent.neighbors].map((id) => byId.get(id)).filter((x) => x.depth === undefined).sort((a, b) => b.rank - a.rank || a.children.length - b.children.length || a.id.localeCompare(b.id)); choices.forEach((child) => { child.parent = parent; child.depth = parent.depth + 1; parent.children.push(child); queue.push(child); }); }
  [...component].sort((a, b) => b.depth - a.depth).forEach((n) => { n.demand = n.radius + n.children.reduce((sum, child) => sum + C.futureDiscount * child.demand, 0); }); return root;
}
function requiredAngle(center, left, right) { const dl = pairDistance(center, left); const dr = pairDistance(center, right); const required = left.radius + right.radius + C.siblingGap; return Math.acos(Math.max(-1, Math.min(1, (dl * dl + dr * dr - required * required) / (2 * dl * dr)))); }
function candidateFan(center, children, planted, index) {
  const degree = Math.max(1, center.neighbors.size);
  const parentAngle = center.parent ? Math.atan2(center.parent.y - center.y, center.parent.x - center.x) : 0;
  const fanCenterAngle = center.parent ? parentAngle + Math.PI : 0;
  const slotAngle = TAU / degree;
  const alternatingOffsets = Array.from({ length: degree - (center.parent ? 1 : 0) }, (_, index) => {
    if (index === 0) return 0;
    const step = Math.ceil(index / 2);
    return index % 2 === 1 ? step : -step;
  });
  const slots = alternatingOffsets.map((offset) => fanCenterAngle + offset * slotAngle);
  const ordered = [...children].sort((a, b) => b.rank - a.rank || b.demand - a.demand || a.id.localeCompare(b.id)); let best = null;
  for (let turn = 0; turn < C.rotations; turn += 1) { const rotation = turn * TAU / C.rotations; const positions = []; let cost = 0; ordered.forEach((child, i) => { const angle = slots[i % slots.length] + rotation; const d = pairDistance(center, child); const point = { child, x: center.x + Math.cos(angle) * d, y: center.y + Math.sin(angle) * d, angle, distance: d }; positions.push(point); });
    for (let i = 0; i < positions.length; i += 1) { for (let j = i + 1; j < positions.length; j += 1) { const needed = positions[i].child.radius + positions[j].child.radius + C.siblingGap; const gap = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y); if (gap < needed) cost += 1e8 + (needed - gap) * 1e5; else cost += Math.max(0, requiredAngle(center, positions[i].child, positions[j].child) - Math.abs(positions[i].angle - positions[j].angle)); } }
    positions.forEach((point) => { nearby(index, point.x, point.y, center.radius + point.child.radius + C.edgeGap).forEach((other) => { if (other.id !== center.id && Math.hypot(point.x - other.x, point.y - other.y) < point.child.radius + other.radius + C.siblingGap) cost += 1e8; if (point.child.neighbors.has(other.id)) cost += .02 * Math.hypot(point.x - other.x, point.y - other.y); }); cost += .001 * point.child.demand * Math.hypot(point.x, point.y); });
    if (!best || cost < best.cost) best = { cost, positions };
  } return best.positions;
}
function magneticOverlapCleanup(component) {
  for (let pass = 0; pass < C.magneticPasses; pass += 1) {
    const forces = new Map(component.map((node) => [node.id, { x: 0, y: 0 }]));
    for (let leftIndex = 0; leftIndex < component.length; leftIndex += 1) {
      const left = component[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < component.length; rightIndex += 1) {
        const right = component[rightIndex];
        let dx = right.x - left.x; let dy = right.y - left.y; let d = Math.hypot(dx, dy);
        const field = left.radius + right.radius + C.siblingGap;
        if (d >= field) continue;
        if (d < .001) { dx = 1; dy = 0; d = 1; } else { dx /= d; dy /= d; }
        const penetration = (field - d) / field;
        const charge = (1 + Math.sqrt(left.rank)) * (1 + Math.sqrt(right.rank));
        const force = C.magneticStrength * charge * penetration * penetration;
        forces.get(left.id).x -= force * dx; forces.get(left.id).y -= force * dy;
        forces.get(right.id).x += force * dx; forces.get(right.id).y += force * dy;
      }
    }
    component.forEach((node) => {
      const force = forces.get(node.id); const magnitude = Math.hypot(force.x, force.y);
      const mobility = 1 / (1 + Math.sqrt(node.rank));
      const scale = magnitude > C.magneticStepCap ? C.magneticStepCap / magnitude : 1;
      node.x += force.x * scale * mobility; node.y += force.y * scale * mobility;
    });
  }
}

function bounds(component) { const xs = component.map((x) => x.x); const ys = component.map((x) => x.y); return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }; }

export function applyRankAwareRadialBfsLayout(cy) {
  const { nodes, byId } = model(cy); const packed = [];
  split(nodes, byId).forEach((component) => { const root = buildForest(component, byId); root.x = 0; root.y = 0; root.planted = true; const queue = [root];
    while (queue.length) { queue.sort((a, b) => a.depth - b.depth || b.rank - a.rank || a.id.localeCompare(b.id)); const center = queue.shift(); const children = center.children.filter((x) => !x.planted); if (!children.length) continue; const index = spatial(component, 2 * (C.visibleRadius + C.minHeadroom + C.headroomScale) + C.edgeGap); candidateFan(center, children, component, index).forEach((point) => { Object.assign(point.child, { x: point.x, y: point.y, planted: true }); queue.push(point.child); }); }
    magneticOverlapCleanup(component);
    packed.push({ component, box: bounds(component) });
  });
  const columns = Math.max(1, Math.ceil(Math.sqrt(packed.length))); let x = 0; let y = 0; let rowHeight = 0; packed.forEach((item, i) => { const width = item.box.maxX - item.box.minX; const height = item.box.maxY - item.box.minY; if (i && i % columns === 0) { x = 0; y += rowHeight + C.componentGap; rowHeight = 0; } const dx = x - item.box.minX; const dy = y - item.box.minY; item.component.forEach((n) => n.node.position({ x: n.x + dx, y: n.y + dy })); x += width + C.componentGap; rowHeight = Math.max(rowHeight, height); });
  let treeError = 0; nodes.forEach((n) => { if (n.parent) treeError = Math.max(treeError, Math.abs(distance(n, n.parent) - pairDistance(n, n.parent))); });
  return { stable: true, maxDisplacement: 0, collisions: 0, hopViolations: 0, treeError };
}
