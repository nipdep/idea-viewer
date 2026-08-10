const CONFIG = Object.freeze({
  visibleRadius: 10,
  minHeadroom: 12,
  headroomScale: 38,
  chargeScale: 0.8,
  mobilityBase: 1,
  mobilityRankScale: 1.1,
  visibleGap: 6,
  magneticHeadroom: 8,
  edgeSlack: 24,
  springStrength: 0.042,
  magneticStrength: 32,
  magneticPower: 2,
  hopEpsilon: 14,
  movementCap: 38,
  initialStep: 0.82,
  minStep: 0.06,
  cooling: 0.985,
  collisionPasses: 3,
  movementTolerance: 0.18,
});

function deterministicUnit(leftId, rightId) {
  let hash = 2166136261;
  for (const character of `${leftId}|${rightId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const angle = ((hash >>> 0) / 4294967296) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function cellKey(x, y, size) {
  return `${Math.floor(x / size)},${Math.floor(y / size)}`;
}

function buildSpatialHash(entries, cellSize) {
  const cells = new Map();
  for (const entry of entries) {
    const key = cellKey(entry.x, entry.y, cellSize);
    const bucket = cells.get(key) ?? [];
    bucket.push(entry);
    cells.set(key, bucket);
  }
  return { cells, cellSize };
}

function nearbyEntries(hash, x, y, range) {
  const baseX = Math.floor(x / hash.cellSize);
  const baseY = Math.floor(y / hash.cellSize);
  const cellRange = Math.ceil(range / hash.cellSize);
  const results = [];
  for (let offsetX = -cellRange; offsetX <= cellRange; offsetX += 1) {
    for (let offsetY = -cellRange; offsetY <= cellRange; offsetY += 1) {
      const bucket = hash.cells.get(`${baseX + offsetX},${baseY + offsetY}`);
      if (bucket) results.push(...bucket);
    }
  }
  return results;
}

function buildEntries(cy) {
  const nodes = cy.nodes();
  const degrees = nodes.map((node) => node.degree());
  const minRank = Math.min(...degrees);
  const maxRank = Math.max(...degrees);
  const rankSpan = maxRank - minRank;
  const entries = nodes.map((node) => {
    const normalizedRank = rankSpan === 0 ? 0 : (node.degree() - minRank) / rankSpan;
    const rankFactor = Math.sqrt(normalizedRank);
    return {
      id: node.id(),
      node,
      x: node.position('x'),
      y: node.position('y'),
      rank: normalizedRank,
      radius: CONFIG.visibleRadius,
      virtualRadius: CONFIG.visibleRadius + CONFIG.minHeadroom + CONFIG.headroomScale * rankFactor,
      charge: 1 + CONFIG.chargeScale * rankFactor,
      mobility: CONFIG.mobilityBase / (1 + CONFIG.mobilityRankScale * rankFactor),
      neighbors: new Set(),
    };
  });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  cy.edges().forEach((edge) => {
    const source = byId.get(edge.source().id());
    const target = byId.get(edge.target().id());
    source?.neighbors.add(target.id);
    target?.neighbors.add(source.id);
  });
  return { entries, byId };
}

function pairMetrics(left, right) {
  const magneticDistance = left.virtualRadius + right.virtualRadius + CONFIG.magneticHeadroom;
  return {
    separation: left.radius + right.radius + CONFIG.visibleGap,
    magneticDistance,
    edgeLength: magneticDistance + CONFIG.edgeSlack,
  };
}

function connectedComponents(entries, byId) {
  const remaining = new Set(entries.map((entry) => entry.id));
  const components = [];
  while (remaining.size) {
    const startId = remaining.values().next().value;
    const queue = [startId];
    const component = [];
    remaining.delete(startId);
    while (queue.length) {
      const id = queue.shift();
      const entry = byId.get(id);
      component.push(entry);
      for (const neighborId of entry.neighbors) {
        if (remaining.delete(neighborId)) queue.push(neighborId);
      }
    }
    components.push(component);
  }
  return components;
}

// Topology-aware component seed placement: highest-ranked seed, then BFS hop layers.
export function seedRankAwareLayout(cy) {
  const { entries, byId } = buildEntries(cy);
  const components = connectedComponents(entries, byId);
  const columns = Math.max(1, Math.ceil(Math.sqrt(components.length)));
  components.forEach((component, componentIndex) => {
    const seed = [...component].sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id))[0];
    const origin = { x: (componentIndex % columns) * 720, y: Math.floor(componentIndex / columns) * 720 };
    const placed = new Set([seed.id]);
    const queue = [{ entry: seed, hop: 0 }];
    seed.x = origin.x;
    seed.y = origin.y;
    while (queue.length) {
      const { entry, hop } = queue.shift();
      const unplaced = [...entry.neighbors].filter((id) => !placed.has(id)).map((id) => byId.get(id));
      unplaced.forEach((neighbor, index) => {
        const metrics = pairMetrics(entry, neighbor);
        const angle = (index / Math.max(1, unplaced.length)) * Math.PI * 2 + hop * 0.61;
        neighbor.x = entry.x + Math.cos(angle) * metrics.edgeLength;
        neighbor.y = entry.y + Math.sin(angle) * metrics.edgeLength;
        placed.add(neighbor.id);
        queue.push({ entry: neighbor, hop: hop + 1 });
      });
    }
  });
  cy.batch(() => entries.forEach((entry) => entry.node.position({ x: entry.x, y: entry.y })));
}

function resolveCandidate(candidate, subject, hash, radius) {
  const startAngle = Math.atan2(candidate.y - subject.y, candidate.x - subject.x);
  for (let ring = 0; ring < 5; ring += 1) {
    const candidateRadius = radius + ring * CONFIG.visibleGap * 3;
    for (let offset = 0; offset <= 12; offset += 1) {
      for (const direction of offset === 0 ? [0] : [1, -1]) {
        const angle = startAngle + direction * offset * (Math.PI / 18);
        const point = { x: subject.x + Math.cos(angle) * candidateRadius, y: subject.y + Math.sin(angle) * candidateRadius };
        const occupied = nearbyEntries(hash, point.x, point.y, candidateRadius + CONFIG.visibleGap)
          .some((other) => other.id !== subject.id && Math.hypot(other.x - point.x, other.y - point.y) < subject.radius + other.radius + CONFIG.visibleGap);
        if (!occupied) return point;
      }
    }
  }
  return candidate;
}

function projectOneHopBoundaries(entries, byId, hash) {
  const components = connectedComponents(entries, byId);
  for (const component of components) {
    const target = [...component].sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id))[0];
    if (target.neighbors.size === 0) continue;
    let boundary = 0;
    for (const neighborId of target.neighbors) boundary = Math.max(boundary, pairMetrics(target, byId.get(neighborId)).edgeLength);
    const requiredRadius = boundary + CONFIG.hopEpsilon;
    for (const candidate of nearbyEntries(hash, target.x, target.y, requiredRadius)) {
      if (candidate.id === target.id || target.neighbors.has(candidate.id)) continue;
      let dx = candidate.x - target.x;
      let dy = candidate.y - target.y;
      let distance = Math.hypot(dx, dy);
      if (distance >= requiredRadius) continue;
      if (distance < 0.001) ({ x: dx, y: dy } = deterministicUnit(target.id, candidate.id));
      else { dx /= distance; dy /= distance; }
      const projected = { x: target.x + dx * requiredRadius, y: target.y + dy * requiredRadius };
      const resolved = resolveCandidate(projected, target, hash, requiredRadius);
      candidate.x = resolved.x;
      candidate.y = resolved.y;
    }
  }
}

function projectCollisions(entries, maxRadius) {
  const cellSize = Math.max(1, maxRadius * 2 + CONFIG.magneticHeadroom);
  for (let pass = 0; pass < CONFIG.collisionPasses; pass += 1) {
    const hash = buildSpatialHash(entries, cellSize);
    for (let index = 0; index < entries.length; index += 1) {
      const left = entries[index];
      for (const right of nearbyEntries(hash, left.x, left.y, left.radius * 2 + CONFIG.visibleGap)) {
        if (right.id <= left.id) continue;
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);
        const required = pairMetrics(left, right).separation;
        if (distance >= required) continue;
        if (distance < 0.001) ({ x: dx, y: dy } = deterministicUnit(left.id, right.id));
        else { dx /= distance; dy /= distance; }
        const overlap = required - distance;
        const totalMobility = left.mobility + right.mobility;
        left.x -= dx * overlap * (left.mobility / totalMobility);
        left.y -= dy * overlap * (left.mobility / totalMobility);
        right.x += dx * overlap * (right.mobility / totalMobility);
        right.y += dy * overlap * (right.mobility / totalMobility);
      }
    }
  }
}

function countUnresolvedConstraints(entries, byId, maxRadius) {
  const cellSize = Math.max(1, maxRadius * 2 + CONFIG.magneticHeadroom);
  const hash = buildSpatialHash(entries, cellSize);
  let collisions = 0;
  for (const left of entries) {
    for (const right of nearbyEntries(hash, left.x, left.y, left.radius * 2 + CONFIG.visibleGap)) {
      if (right.id > left.id && Math.hypot(right.x - left.x, right.y - left.y) < pairMetrics(left, right).separation) collisions += 1;
    }
  }
  let hopViolations = 0;
  for (const component of connectedComponents(entries, byId)) {
    const target = [...component].sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id))[0];
    if (target.neighbors.size === 0) continue;
    let boundary = 0;
    for (const neighborId of target.neighbors) boundary = Math.max(boundary, pairMetrics(target, byId.get(neighborId)).edgeLength);
    const requiredRadius = boundary + CONFIG.hopEpsilon;
    for (const candidate of nearbyEntries(hash, target.x, target.y, requiredRadius)) {
      if (candidate.id !== target.id && !target.neighbors.has(candidate.id) && Math.hypot(candidate.x - target.x, candidate.y - target.y) < requiredRadius) hopViolations += 1;
    }
  }
  return { collisions, hopViolations };
}

export function applyRankAwareMagneticSpringLayout(cy, iteration) {
  const { entries, byId } = buildEntries(cy);
  const maxRadius = Math.max(...entries.map((entry) => entry.virtualRadius));
  const cellSize = Math.max(1, maxRadius * 2 + CONFIG.magneticHeadroom);
  const hash = buildSpatialHash(entries, cellSize);
  const forces = new Map(entries.map((entry) => [entry.id, { x: 0, y: 0 }]));

  cy.edges().forEach((edge) => {
    const left = byId.get(edge.source().id());
    const right = byId.get(edge.target().id());
    let dx = right.x - left.x;
    let dy = right.y - left.y;
    let distance = Math.hypot(dx, dy);
    if (distance < 0.001) ({ x: dx, y: dy } = deterministicUnit(left.id, right.id));
    else { dx /= distance; dy /= distance; }
    const attraction = CONFIG.springStrength * Math.max(0, distance - pairMetrics(left, right).edgeLength);
    forces.get(left.id).x += attraction * dx;
    forces.get(left.id).y += attraction * dy;
    forces.get(right.id).x -= attraction * dx;
    forces.get(right.id).y -= attraction * dy;
  });

  for (let index = 0; index < entries.length; index += 1) {
    const left = entries[index];
    const range = Math.ceil((left.virtualRadius + maxRadius + CONFIG.magneticHeadroom) / cellSize);
    for (const right of nearbyEntries(hash, left.x, left.y, range * cellSize)) {
      if (right.id <= left.id) continue;
      let dx = right.x - left.x;
      let dy = right.y - left.y;
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) ({ x: dx, y: dy } = deterministicUnit(left.id, right.id));
      else { dx /= distance; dy /= distance; }
      const { magneticDistance } = pairMetrics(left, right);
      if (distance >= magneticDistance) continue;
      const penetration = (magneticDistance - distance) / magneticDistance;
      const repulsion = CONFIG.magneticStrength * left.charge * right.charge * penetration ** CONFIG.magneticPower;
      forces.get(left.id).x -= repulsion * dx;
      forces.get(left.id).y -= repulsion * dy;
      forces.get(right.id).x += repulsion * dx;
      forces.get(right.id).y += repulsion * dy;
    }
  }

  const step = Math.max(CONFIG.minStep, CONFIG.initialStep * CONFIG.cooling ** iteration);
  let maxDisplacement = 0;
  for (const entry of entries) {
    const force = forces.get(entry.id);
    const magnitude = Math.hypot(force.x, force.y);
    const scale = magnitude > CONFIG.movementCap ? CONFIG.movementCap / magnitude : 1;
    const moveX = step * entry.mobility * force.x * scale;
    const moveY = step * entry.mobility * force.y * scale;
    entry.x += moveX;
    entry.y += moveY;
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(moveX, moveY));
  }

  const postForceHash = buildSpatialHash(entries, cellSize);
  projectOneHopBoundaries(entries, byId, postForceHash);
  projectCollisions(entries, maxRadius);
  const { collisions, hopViolations } = countUnresolvedConstraints(entries, byId, maxRadius);
  cy.batch(() => entries.forEach((entry) => entry.node.position({ x: entry.x, y: entry.y })));
  return { maxDisplacement, collisions, hopViolations, stable: maxDisplacement < CONFIG.movementTolerance && collisions === 0 && hopViolations === 0 };
}
