import createGraph from 'ngraph.graph';
import createForceLayout from 'ngraph.forcelayout';

const DEFAULT_CONFIG = Object.freeze({
  baseMass: 1,
  massScale: 2.4,
  baseRadius: 34,
  radiusScale: 28,
  baseRepulsion: 2400,
  repulsionRankScale: 0.8,
  baseAttraction: 0.12,
  attractionRankScale: 0.45,
  minNodeSpacing: 24,
  overlapPenaltyMultiplier: 8,
  preferredEdgeLength: 130,
  edgeLengthRankScale: 48,
  componentSpacing: 260,
  maxComponentRowWidth: 4800,
  maxBatchSize: 12,
  maxSeedPlacementAttempts: 24,
  minimumAcceptedOverlap: 0.5,
  finalConstraintPasses: 18,
  fixedNodeSearchPadding: 260,
  spatialCellSize: 240,
  ngraphStepsPerBatch: 480,
  ngraphMinStepsPerBatch: 120,
  ngraphMaxBatchTimeMs: 64,
  ngraphStepMovementThreshold: 0.0025,
  rippleStepsPerLayer: 220,
  rippleMinStepsPerLayer: 72,
  rippleMaxLayerTimeMs: 36,
  rippleStepMovementThreshold: 0.003,
  ngraphSpringLength: 100,
  ngraphSpringCoefficient: 0.95,
  ngraphGravity: -20,
  ngraphTheta: 0.9,
  ngraphDragCoefficient: 0.12,
  ngraphTimeStep: 0.45,
  ngraphAdaptiveTimeStepWeight: 0,
  viewport: null,
});

function mergeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

function deterministicUnit(value) {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000003) / 1000003;
}

function deterministicAngle(value) {
  return deterministicUnit(value) * Math.PI * 2;
}

function deterministicJitter(id, magnitude = 1) {
  const angle = deterministicAngle(`${id}|angle`);
  const radius = deterministicUnit(`${id}|radius`) * magnitude;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function clampMagnitude(x, y, maxMagnitude) {
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || magnitude <= maxMagnitude || magnitude === 0) {
    return { x, y };
  }
  const scale = maxMagnitude / magnitude;
  return {
    x: x * scale,
    y: y * scale,
  };
}

function createBounds() {
  return {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
}

function extendBounds(bounds, x, y, radius = 0) {
  bounds.minX = Math.min(bounds.minX, x - radius);
  bounds.minY = Math.min(bounds.minY, y - radius);
  bounds.maxX = Math.max(bounds.maxX, x + radius);
  bounds.maxY = Math.max(bounds.maxY, y + radius);
}

function isFiniteBounds(bounds) {
  return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY);
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pairPreferredDistance(left, right, config) {
  return (Number(left?.radius) || 0) + (Number(right?.radius) || 0) + config.minNodeSpacing;
}

class GridSpatialIndex {
  constructor(cellSize) {
    this.cellSize = Math.max(24, Number(cellSize) || DEFAULT_CONFIG.spatialCellSize);
    this.cells = new Map();
    this.nodeCells = new Map();
  }

  cellKey(ix, iy) {
    return `${ix},${iy}`;
  }

  getCellRange(bounds) {
    return {
      minX: Math.floor(bounds.minX / this.cellSize),
      maxX: Math.floor(bounds.maxX / this.cellSize),
      minY: Math.floor(bounds.minY / this.cellSize),
      maxY: Math.floor(bounds.maxY / this.cellSize),
    };
  }

  insert(node) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      return;
    }
    this.remove(node);
    const radius = Number(node.radius) || 0;
    const range = this.getCellRange({
      minX: node.x - radius,
      minY: node.y - radius,
      maxX: node.x + radius,
      maxY: node.y + radius,
    });
    const keys = [];
    for (let ix = range.minX; ix <= range.maxX; ix += 1) {
      for (let iy = range.minY; iy <= range.maxY; iy += 1) {
        const key = this.cellKey(ix, iy);
        const cell = this.cells.get(key) ?? new Set();
        cell.add(node.id);
        this.cells.set(key, cell);
        keys.push(key);
      }
    }
    this.nodeCells.set(node.id, keys);
  }

  remove(node) {
    const keys = this.nodeCells.get(node.id);
    if (!keys) {
      return;
    }
    for (const key of keys) {
      const cell = this.cells.get(key);
      if (!cell) {
        continue;
      }
      cell.delete(node.id);
      if (cell.size === 0) {
        this.cells.delete(key);
      }
    }
    this.nodeCells.delete(node.id);
  }

  search(bounds, nodeMap) {
    const range = this.getCellRange(bounds);
    const matches = new Map();
    for (let ix = range.minX; ix <= range.maxX; ix += 1) {
      for (let iy = range.minY; iy <= range.maxY; iy += 1) {
        const cell = this.cells.get(this.cellKey(ix, iy));
        if (!cell) {
          continue;
        }
        for (const nodeId of cell) {
          const node = nodeMap.get(nodeId);
          if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
            continue;
          }
          const radius = Number(node.radius) || 0;
          if (
            node.x + radius < bounds.minX ||
            node.x - radius > bounds.maxX ||
            node.y + radius < bounds.minY ||
            node.y - radius > bounds.maxY
          ) {
            continue;
          }
          matches.set(nodeId, node);
        }
      }
    }
    return Array.from(matches.values());
  }
}

export class NgraphIncrementalLayout {
  constructor({ nodes = [], edges = [], config = {} } = {}) {
    this.config = mergeConfig(config);
    this.nodeMap = new Map();
    this.edgeMap = new Map();
    this.spatialIndex = new GridSpatialIndex(this.config.spatialCellSize);
    this.componentBounds = new Map();
    this.componentOrder = [];
    this.componentCursor = { x: 0, y: 0, rowHeight: 0 };
    this.componentCounter = 0;
    this.parentAngleState = new Map();
    this.activeComponentId = null;
    this.layoutCompleted = false;
    this.layoutNodeIds = new Set();
    this.layoutEdgeIds = new Set();
    this.normalizeGraphInput(nodes, edges);
    this.computeRanks();
    this.derivePhysicsProperties();
    this.layoutGraph = createGraph();
    this.layout = createForceLayout(this.layoutGraph, {
      springLength: this.config.ngraphSpringLength,
      springCoefficient: this.config.ngraphSpringCoefficient,
      gravity: this.config.ngraphGravity,
      theta: this.config.ngraphTheta,
      dragCoefficient: this.config.ngraphDragCoefficient,
      timeStep: this.config.ngraphTimeStep,
      adaptiveTimeStepWeight: this.config.ngraphAdaptiveTimeStepWeight,
      nodeMass: (nodeId) => this.nodeMap.get(nodeId)?.mass ?? this.config.baseMass,
      springTransform: (link, spring) => {
        const edgeId = link?.data?.edgeId;
        const edge = edgeId ? this.edgeMap.get(edgeId) : null;
        if (!edge) {
          return;
        }
        spring.length = edge.length;
        spring.coefficient = edge.coefficient;
      },
    });
  }

  normalizeGraphInput(nodes, edges) {
    for (const inputNode of nodes) {
      const id = inputNode?.id ?? inputNode?.data?.id;
      if (!id || this.nodeMap.has(id)) {
        continue;
      }
      const data = inputNode?.data ?? inputNode;
      const width = Number(data?.nodeWidth ?? data?.width ?? inputNode?.width) || 72;
      const height = Number(data?.nodeHeight ?? data?.height ?? inputNode?.height) || 40;
      this.nodeMap.set(id, {
        id,
        neighborIds: [],
        incomingIds: [],
        outgoingIds: [],
        rank: 0,
        normalizedRank: 0.5,
        mass: 0,
        radius: Math.max(width, height) * 0.5,
        repulsionStrength: 0,
        attractionStrength: 0,
        x: Number.isFinite(inputNode?.position?.x) ? inputNode.position.x : null,
        y: Number.isFinite(inputNode?.position?.y) ? inputNode.position.y : null,
        mutable: false,
        status: 'undiscovered',
        componentId: null,
        hopDepth: null,
        label: data?.label ?? '',
        shape: data?.shape ?? '',
        annotations: data,
        renderWidth: width,
        renderHeight: height,
      });
    }

    for (const inputEdge of edges) {
      const data = inputEdge?.data ?? inputEdge;
      const id = data?.id;
      const sourceId = data?.source;
      const targetId = data?.target;
      if (!id || !sourceId || !targetId) {
        continue;
      }
      if (!this.nodeMap.has(sourceId) || !this.nodeMap.has(targetId) || this.edgeMap.has(id)) {
        continue;
      }
      this.edgeMap.set(id, {
        id,
        sourceId,
        targetId,
        weight: Number(data?.weight) || 1,
        length: this.config.preferredEdgeLength,
        coefficient: this.config.ngraphSpringCoefficient,
      });
      const sourceNode = this.nodeMap.get(sourceId);
      const targetNode = this.nodeMap.get(targetId);
      sourceNode.outgoingIds.push(targetId);
      targetNode.incomingIds.push(sourceId);
      sourceNode.neighborIds.push(targetId);
      targetNode.neighborIds.push(sourceId);
    }

    for (const node of this.nodeMap.values()) {
      node.neighborIds = Array.from(new Set(node.neighborIds));
      node.incomingIds = Array.from(new Set(node.incomingIds));
      node.outgoingIds = Array.from(new Set(node.outgoingIds));
    }
  }

  computeRanks() {
    let minRank = Infinity;
    let maxRank = -Infinity;
    for (const node of this.nodeMap.values()) {
      node.rank = node.incomingIds.length + node.outgoingIds.length;
      minRank = Math.min(minRank, node.rank);
      maxRank = Math.max(maxRank, node.rank);
    }
    const singleValue = minRank === maxRank;
    for (const node of this.nodeMap.values()) {
      node.normalizedRank = singleValue ? 0.5 : (node.rank - minRank) / (maxRank - minRank);
    }
  }

  derivePhysicsProperties() {
    for (const node of this.nodeMap.values()) {
      const visualRadius = Math.max(Number(node.renderWidth) || 0, Number(node.renderHeight) || 0) * 0.5;
      const normalizedRank = node.normalizedRank;
      const rankRadius = this.config.baseRadius + this.config.radiusScale * normalizedRank;
      node.mass = this.config.baseMass + this.config.massScale * normalizedRank;
      node.radius = Math.max(visualRadius + this.config.baseRadius * 0.35, this.config.baseRadius) + rankRadius;
      node.repulsionStrength =
        this.config.baseRepulsion * (1 + this.config.repulsionRankScale * normalizedRank);
      node.attractionStrength =
        this.config.baseAttraction * Math.max(0.4, 1 - this.config.attractionRankScale * normalizedRank);
    }
    for (const edge of this.edgeMap.values()) {
      const source = this.nodeMap.get(edge.sourceId);
      const target = this.nodeMap.get(edge.targetId);
      const avgRank = ((source?.normalizedRank ?? 0.5) + (target?.normalizedRank ?? 0.5)) * 0.5;
      edge.length =
        this.config.preferredEdgeLength +
        (1 - avgRank) * this.config.edgeLengthRankScale +
        ((source?.radius ?? 0) + (target?.radius ?? 0)) * 0.2;
      edge.coefficient = this.config.ngraphSpringCoefficient * edge.weight;
    }
  }

  hasUndiscoveredNodes() {
    for (const node of this.nodeMap.values()) {
      if (node.status === 'undiscovered') {
        return true;
      }
    }
    return false;
  }

  getHighestRankUndiscoveredNode() {
    const candidates = Array.from(this.nodeMap.values()).filter((node) => node.status === 'undiscovered');
    candidates.sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id));
    return candidates[0] ?? null;
  }

  createComponentId() {
    this.componentCounter += 1;
    return `component-${this.componentCounter}`;
  }

  getNextComponentSeedPosition() {
    if (this.componentOrder.length === 0) {
      const viewport = this.config.viewport;
      if (viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y)) {
        return { x: viewport.x, y: viewport.y };
      }
      return { x: 0, y: 0 };
    }

    const spacing = this.config.componentSpacing;
    const seedRadius = this.config.preferredEdgeLength * 2;
    let attempts = 0;
    while (attempts < 256) {
      const x = this.componentCursor.x;
      const y = this.componentCursor.y;
      const occupied = this.spatialIndex.search(
        {
          minX: x - seedRadius,
          minY: y - seedRadius,
          maxX: x + seedRadius,
          maxY: y + seedRadius,
        },
        this.nodeMap,
      );
      if (occupied.length === 0) {
        return { x, y };
      }
      this.componentCursor.x += spacing;
      if (this.componentCursor.x > this.config.maxComponentRowWidth) {
        this.componentCursor.x = 0;
        this.componentCursor.y += this.componentCursor.rowHeight + spacing;
        this.componentCursor.rowHeight = 0;
      }
      attempts += 1;
    }

    return { x: this.componentCursor.x, y: this.componentCursor.y };
  }

  initializeComponentSeed(seed) {
    const componentId = this.createComponentId();
    const { x, y } = this.getNextComponentSeedPosition();
    seed.x = x;
    seed.y = y;
    seed.mutable = false;
    seed.status = 'frontier';
    seed.componentId = componentId;
    seed.hopDepth = 0;
    this.ensureLayoutNode(seed);
    this.pinLayoutNode(seed.id, true);
    this.spatialIndex.insert(seed);
    return componentId;
  }

  getFrontierNodesForComponent(componentId) {
    return Array.from(this.nodeMap.values())
      .filter((node) => node.componentId === componentId && node.status === 'frontier')
      .sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id));
  }

  collectUndiscoveredOneHopNeighbors(frontierNodes) {
    const batch = [];
    const seen = new Set();
    for (const frontierNode of frontierNodes) {
      for (const neighborId of frontierNode.neighborIds) {
        const neighbor = this.nodeMap.get(neighborId);
        if (!neighbor || neighbor.status !== 'undiscovered' || seen.has(neighborId)) {
          continue;
        }
        neighbor.componentId = frontierNode.componentId;
        const candidateDepth = (Number.isFinite(frontierNode.hopDepth) ? frontierNode.hopDepth : 0) + 1;
        neighbor.hopDepth = Number.isFinite(neighbor.hopDepth) ? Math.min(neighbor.hopDepth, candidateDepth) : candidateDepth;
        seen.add(neighborId);
        batch.push(neighbor);
        if (batch.length >= this.config.maxBatchSize) {
          return batch;
        }
      }
    }
    batch.sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id));
    return batch;
  }

  initializeBatchPositions(batch, anchors) {
    const anchorById = new Map(anchors.map((node) => [node.id, node]));
    const occupied = [...anchors];
    for (const node of batch) {
      const parentAnchors = node.neighborIds
        .map((neighborId) => anchorById.get(neighborId))
        .filter(Boolean);
      let candidate;
      if (parentAnchors.length > 1) {
        const jitter = deterministicJitter(node.id, Math.max(node.radius, this.config.preferredEdgeLength * 0.35));
        candidate = {
          x: average(parentAnchors.map((parent) => parent.x)) + jitter.x,
          y: average(parentAnchors.map((parent) => parent.y)) + jitter.y,
        };
      } else if (parentAnchors.length === 1) {
        const [parent] = parentAnchors;
        const angle = this.parentAngleState.get(parent.id) ?? deterministicAngle(`${parent.id}|ring`);
        const distance = parent.radius + node.radius + this.config.preferredEdgeLength;
        candidate = {
          x: parent.x + Math.cos(angle) * distance,
          y: parent.y + Math.sin(angle) * distance,
        };
        this.parentAngleState.set(parent.id, angle + Math.PI / 3);
      } else {
        const seedJitter = deterministicJitter(node.id, this.config.preferredEdgeLength);
        candidate = {
          x: seedJitter.x,
          y: seedJitter.y,
        };
      }
      const resolved = this.findNonOverlappingPosition(node, candidate, occupied, `ngraph-seed:${node.id}`);
      node.x = resolved.x;
      node.y = resolved.y;
      occupied.push(node);
    }
  }

  getBatchBounds(nodes, padding = 0) {
    const bounds = createBounds();
    for (const node of nodes) {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        continue;
      }
      extendBounds(bounds, node.x, node.y, node.radius + padding);
    }
    return isFiniteBounds(bounds) ? bounds : null;
  }

  refreshFixedNodesForMutableBatch(mutableNodes) {
    const mutableIds = new Set(mutableNodes.map((node) => node.id));
    const fixedNodes = new Map();
    for (const node of mutableNodes) {
      for (const neighborId of node.neighborIds) {
        const neighbor = this.nodeMap.get(neighborId);
        if (!neighbor || mutableIds.has(neighbor.id) || !Number.isFinite(neighbor.x) || !Number.isFinite(neighbor.y)) {
          continue;
        }
        fixedNodes.set(neighbor.id, neighbor);
      }
    }

    const bounds = this.getBatchBounds(mutableNodes, this.config.fixedNodeSearchPadding);
    if (bounds) {
      for (const node of this.spatialIndex.search(bounds, this.nodeMap)) {
        if (!mutableIds.has(node.id)) {
          fixedNodes.set(node.id, node);
        }
      }
    }

    return Array.from(fixedNodes.values());
  }

  moveNodeOutsideObstacles(node, obstacles, attemptKey = '') {
    let moved = false;
    for (let pass = 0; pass < this.config.finalConstraintPasses; pass += 1) {
      let forceX = 0;
      let forceY = 0;
      let maxViolation = 0;

      for (const obstacle of obstacles) {
        if (!obstacle || obstacle.id === node.id || !Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.y)) {
          continue;
        }
        let dx = (node.x ?? 0) - obstacle.x;
        let dy = (node.y ?? 0) - obstacle.y;
        let centerDistance = Math.hypot(dx, dy);
        const preferred = pairPreferredDistance(node, obstacle, this.config);
        if (centerDistance === 0) {
          const angle = deterministicAngle(`${attemptKey}|${node.id}|${obstacle.id}|${pass}`);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          centerDistance = 1;
        }
        const violation = preferred - centerDistance;
        if (violation <= 0) {
          continue;
        }
        maxViolation = Math.max(maxViolation, violation);
        const scale = (violation + this.config.minNodeSpacing * 0.25) / centerDistance;
        forceX += dx * scale;
        forceY += dy * scale;
      }

      if (maxViolation <= this.config.minimumAcceptedOverlap) {
        break;
      }

      const clamped = clampMagnitude(forceX, forceY, Math.max(node.radius, this.config.preferredEdgeLength * 0.35));
      node.x = (node.x ?? 0) + clamped.x;
      node.y = (node.y ?? 0) + clamped.y;
      moved = true;
    }

    return moved;
  }

  findNonOverlappingPosition(node, candidate, obstacles, attemptKey = '') {
    const baseDistance = Math.max(node.radius + this.config.minNodeSpacing, this.config.preferredEdgeLength * 0.6);
    for (let attempt = 0; attempt < this.config.maxSeedPlacementAttempts; attempt += 1) {
      const angle = deterministicAngle(`${attemptKey}|${node.id}|${attempt}`);
      const distance = baseDistance + attempt * Math.max(this.config.minNodeSpacing, node.radius * 0.6);
      const proposed = attempt === 0
        ? { x: candidate.x, y: candidate.y }
        : {
            x: candidate.x + Math.cos(angle) * distance,
            y: candidate.y + Math.sin(angle) * distance,
          };
      node.x = proposed.x;
      node.y = proposed.y;
      this.moveNodeOutsideObstacles(node, obstacles, `${attemptKey}|${attempt}`);
      const stillBlocked = obstacles.some((obstacle) => {
        if (!obstacle || obstacle.id === node.id) {
          return false;
        }
        const distanceToObstacle = Math.hypot((node.x ?? 0) - obstacle.x, (node.y ?? 0) - obstacle.y);
        return distanceToObstacle < pairPreferredDistance(node, obstacle, this.config) - this.config.minimumAcceptedOverlap;
      });
      if (!stillBlocked) {
        return { x: node.x, y: node.y };
      }
    }

    return { x: node.x, y: node.y };
  }

  ensureLayoutNode(node) {
    if (!this.layoutNodeIds.has(node.id)) {
      const layoutNode = this.layoutGraph.addNode(node.id, { isPinned: !node.mutable });
      layoutNode.position = {
        x: Number.isFinite(node.x) ? node.x : 0,
        y: Number.isFinite(node.y) ? node.y : 0,
      };
      layoutNode.isPinned = !node.mutable;
      this.layoutNodeIds.add(node.id);
    } else {
      const layoutNode = this.layoutGraph.getNode(node.id);
      if (layoutNode) {
        layoutNode.position = {
          x: Number.isFinite(node.x) ? node.x : 0,
          y: Number.isFinite(node.y) ? node.y : 0,
        };
        layoutNode.isPinned = !node.mutable;
      }
    }
    this.layout.setNodePosition(node.id, Number.isFinite(node.x) ? node.x : 0, Number.isFinite(node.y) ? node.y : 0);
  }

  ensureLayoutEdge(edge) {
    if (this.layoutEdgeIds.has(edge.id)) {
      return;
    }
    if (!this.layoutNodeIds.has(edge.sourceId) || !this.layoutNodeIds.has(edge.targetId)) {
      return;
    }
    const layoutLink = this.layoutGraph.addLink(edge.sourceId, edge.targetId, { edgeId: edge.id });
    layoutLink.length = edge.length;
    layoutLink.weight = edge.weight;
    this.layoutEdgeIds.add(edge.id);
  }

  syncLayoutNeighborhood(nodes) {
    for (const node of nodes) {
      this.ensureLayoutNode(node);
    }
    for (const edge of this.edgeMap.values()) {
      if (!this.layoutNodeIds.has(edge.sourceId) || !this.layoutNodeIds.has(edge.targetId)) {
        continue;
      }
      this.ensureLayoutEdge(edge);
    }
  }

  pinLayoutNode(nodeId, isPinned) {
    const layoutNode = this.layoutGraph.getNode(nodeId);
    if (!layoutNode) {
      return;
    }
    layoutNode.isPinned = isPinned;
    this.layout.pinNode(layoutNode, isPinned);
  }

  runForceSimulation({ mutableNodes, fixedNodes, pinMutableOnFinish = true, simulationConfig = null }) {
    const neighborhood = [...fixedNodes, ...mutableNodes];
    this.syncLayoutNeighborhood(neighborhood);

    for (const fixedNode of fixedNodes) {
      this.layout.setNodePosition(fixedNode.id, fixedNode.x ?? 0, fixedNode.y ?? 0);
      this.pinLayoutNode(fixedNode.id, true);
    }

    for (const mutableNode of mutableNodes) {
      this.layout.setNodePosition(mutableNode.id, mutableNode.x ?? 0, mutableNode.y ?? 0);
      this.pinLayoutNode(mutableNode.id, false);
    }

    const config = simulationConfig ?? {
      maxSteps: this.config.ngraphStepsPerBatch,
      minSteps: this.config.ngraphMinStepsPerBatch,
      maxTimeMs: this.config.ngraphMaxBatchTimeMs,
      movementThreshold: this.config.ngraphStepMovementThreshold,
    };

    const startedAt = performance.now();
    let steps = 0;
    let stable = false;
    while (
      steps < config.maxSteps &&
      performance.now() - startedAt < config.maxTimeMs
    ) {
      stable = this.layout.step();
      steps += 1;

      if (steps < config.minSteps) {
        continue;
      }

      if (stable) {
        break;
      }

      if ((this.layout.lastMove ?? Infinity) <= config.movementThreshold) {
        break;
      }
    }

    for (const mutableNode of mutableNodes) {
      const position = this.layout.getNodePosition(mutableNode.id);
      mutableNode.x = position.x;
      mutableNode.y = position.y;
    }

    const currentFixedNodes = fixedNodes.length > 0 ? fixedNodes : [];
    for (let pass = 0; pass < this.config.finalConstraintPasses; pass += 1) {
      let moved = false;
      for (const mutableNode of mutableNodes) {
        const peers = [
          ...mutableNodes.filter((candidate) => candidate.id !== mutableNode.id),
          ...currentFixedNodes,
        ];
        moved = this.moveNodeOutsideObstacles(mutableNode, peers, `ngraph-final:${pass}`) || moved;
      }
      if (!moved) {
        break;
      }
    }

    for (const mutableNode of mutableNodes) {
      this.layout.setNodePosition(mutableNode.id, mutableNode.x ?? 0, mutableNode.y ?? 0);
      this.pinLayoutNode(mutableNode.id, pinMutableOnFinish);
    }

    return {
      changed: steps > 0,
    };
  }

  pinBatch(batch) {
    for (const node of batch) {
      node.mutable = false;
      node.status = 'frontier';
      this.ensureLayoutNode(node);
      this.pinLayoutNode(node.id, true);
      this.spatialIndex.insert(node);
    }
  }

  updateSpatialIndexForNodes(nodes) {
    for (const node of nodes) {
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        continue;
      }
      this.spatialIndex.remove(node);
      this.spatialIndex.insert(node);
    }
  }

  getComponentNodes(componentId) {
    return Array.from(this.nodeMap.values())
      .filter((node) => node.componentId === componentId && node.status !== 'undiscovered' && Number.isFinite(node.x) && Number.isFinite(node.y));
  }

  runBackwardRipple(componentId) {
    const componentNodes = this.getComponentNodes(componentId);
    if (componentNodes.length <= 1) {
      return false;
    }

    let maxHopDepth = 0;
    for (const node of componentNodes) {
      if (Number.isFinite(node.hopDepth)) {
        maxHopDepth = Math.max(maxHopDepth, node.hopDepth);
      }
    }

    let changed = false;
    for (let depth = maxHopDepth; depth >= 0; depth -= 1) {
      const layerNodes = componentNodes.filter((node) => node.hopDepth === depth);
      if (layerNodes.length === 0) {
        continue;
      }
      const layerIds = new Set(layerNodes.map((node) => node.id));
      const fixedNodes = componentNodes.filter((node) => !layerIds.has(node.id));
      for (const node of layerNodes) {
        node.mutable = true;
      }
      const result = this.runForceSimulation({
        mutableNodes: layerNodes,
        fixedNodes,
        pinMutableOnFinish: true,
        simulationConfig: {
          maxSteps: this.config.rippleStepsPerLayer,
          minSteps: this.config.rippleMinStepsPerLayer,
          maxTimeMs: this.config.rippleMaxLayerTimeMs,
          movementThreshold: this.config.rippleStepMovementThreshold,
        },
      });
      for (const node of layerNodes) {
        node.mutable = false;
      }
      this.updateSpatialIndexForNodes(layerNodes);
      changed = result.changed || changed;
    }

    const finalMutable = [...componentNodes];
    for (const node of finalMutable) {
      node.mutable = true;
    }
    const finalResult = this.runForceSimulation({
      mutableNodes: finalMutable,
      fixedNodes: [],
      pinMutableOnFinish: true,
      simulationConfig: {
        maxSteps: Math.max(this.config.rippleStepsPerLayer, 260),
        minSteps: Math.max(this.config.rippleMinStepsPerLayer, 96),
        maxTimeMs: Math.max(this.config.rippleMaxLayerTimeMs, 48),
        movementThreshold: Math.min(this.config.rippleStepMovementThreshold, 0.0025),
      },
    });
    for (const node of finalMutable) {
      node.mutable = false;
    }
    this.updateSpatialIndexForNodes(finalMutable);
    return changed || finalResult.changed;
  }

  allNeighborsDiscovered(node) {
    return node.neighborIds.every((neighborId) => this.nodeMap.get(neighborId)?.status !== 'undiscovered');
  }

  updateStatuses(nodes) {
    const affected = new Set(nodes.map((node) => node.id));
    for (const node of nodes) {
      for (const neighborId of node.neighborIds) {
        affected.add(neighborId);
      }
    }
    for (const nodeId of affected) {
      const node = this.nodeMap.get(nodeId);
      if (!node || node.status === 'undiscovered') {
        continue;
      }
      node.status = this.allNeighborsDiscovered(node) ? 'explored' : 'frontier';
    }
  }

  finalizeComponent(componentId) {
    const bounds = createBounds();
    for (const node of this.nodeMap.values()) {
      if (node.componentId !== componentId || !Number.isFinite(node.x) || !Number.isFinite(node.y)) {
        continue;
      }
      extendBounds(bounds, node.x, node.y, node.radius);
    }
    if (!isFiniteBounds(bounds)) {
      return;
    }
    this.componentBounds.set(componentId, bounds);
    this.componentOrder.push(componentId);

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const spacing = this.config.componentSpacing;
    this.componentCursor.x += width + spacing;
    this.componentCursor.rowHeight = Math.max(this.componentCursor.rowHeight, height);
    if (this.componentCursor.x > this.config.maxComponentRowWidth) {
      this.componentCursor.x = 0;
      this.componentCursor.y += this.componentCursor.rowHeight + spacing;
      this.componentCursor.rowHeight = 0;
    }
  }

  isComplete() {
    return this.layoutCompleted || !this.hasUndiscoveredNodes();
  }

  computeNextBatch() {
    if (this.layoutCompleted) {
      return { done: true, changed: false, newNodeIds: [] };
    }

    while (true) {
      if (!this.activeComponentId) {
        const seed = this.getHighestRankUndiscoveredNode();
        if (!seed) {
          this.layoutCompleted = true;
          return { done: true, changed: false, newNodeIds: [] };
        }
        this.initializeComponentSeed(seed);
        this.activeComponentId = seed.componentId;
        return { done: false, changed: true, newNodeIds: [seed.id] };
      }

      const frontierNodes = this.getFrontierNodesForComponent(this.activeComponentId);
      if (frontierNodes.length === 0) {
        const rippleChanged = this.runBackwardRipple(this.activeComponentId);
        this.finalizeComponent(this.activeComponentId);
        this.activeComponentId = null;
        if (!this.hasUndiscoveredNodes()) {
          this.layoutCompleted = true;
          return { done: true, changed: rippleChanged, newNodeIds: [] };
        }
        return { done: false, changed: rippleChanged, newNodeIds: [] };
      }

      const batch = this.collectUndiscoveredOneHopNeighbors(frontierNodes);
      if (batch.length === 0) {
        this.updateStatuses(frontierNodes);
        const nextFrontier = this.getFrontierNodesForComponent(this.activeComponentId);
        if (nextFrontier.length === 0) {
          const rippleChanged = this.runBackwardRipple(this.activeComponentId);
          this.finalizeComponent(this.activeComponentId);
          this.activeComponentId = null;
          return { done: this.isComplete(), changed: rippleChanged, newNodeIds: [] };
        }
        return { done: this.isComplete(), changed: false, newNodeIds: [] };
      }

      this.initializeBatchPositions(batch, frontierNodes);
      for (const node of batch) {
        node.mutable = true;
        node.status = 'frontier';
      }
      this.runForceSimulation({
        mutableNodes: batch,
        fixedNodes: this.refreshFixedNodesForMutableBatch(batch),
      });
      this.pinBatch(batch);
      this.updateStatuses([...frontierNodes, ...batch]);
      return {
        done: false,
        changed: true,
        newNodeIds: batch.map((node) => node.id),
      };
    }
  }

  getNodeById(id) {
    return this.nodeMap.get(id) ?? null;
  }

  updateNodePosition(id, x, y) {
    const node = this.nodeMap.get(id);
    if (!node || !Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    if (node.status !== 'undiscovered') {
      this.spatialIndex.remove(node);
    }
    node.x = x;
    node.y = y;
    node.mutable = false;
    if (node.status === 'undiscovered') {
      node.status = 'frontier';
    }
    this.ensureLayoutNode(node);
    this.pinLayoutNode(id, true);
    this.spatialIndex.insert(node);
    return node;
  }

  getPositionMap() {
    return new Map(
      Array.from(this.nodeMap.values()).map((node) => [
        node.id,
        {
          x: node.x,
          y: node.y,
        },
      ]),
    );
  }

  getFullGraph() {
    return {
      nodes: Array.from(this.nodeMap.values()).map((node) => ({ ...node })),
      edges: Array.from(this.edgeMap.values()).map((edge) => ({ ...edge })),
    };
  }
}
