import createGraph from 'ngraph.graph';
import createForceLayout from 'ngraph.forcelayout';

const DEFAULT_CONFIG = Object.freeze({
  baseMass: 1,
  massScale: 2.4,
  baseRadius: 24,
  radiusScale: 18,
  baseRepulsion: 3600,
  repulsionRankScale: 2.2,
  baseAttraction: 0.08,
  attractionRankScale: 0.9,
  minNodeSpacing: 24,
  overlapPenaltyMultiplier: 8,
  preferredEdgeLength: 130,
  edgeLengthRankScale: 48,
  damping: 0.76,
  maxStep: 10,
  velocityThreshold: 0.12,
  maxTicks: 520,
  maxLayoutTimeMs: 160,
  acceptableOverlapThreshold: 2,
  spatialCellSize: 240,
  fixedNodeSearchPadding: 260,
  componentSpacing: 260,
  maxComponentRowWidth: 4800,
  maxBatchSize: 12,
  fixedRefreshInterval: 6,
  maxSeedPlacementAttempts: 24,
  minimumAcceptedOverlap: 0.5,
  finalConstraintPasses: 18,
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

function pairRadiusSum(left, right) {
  return (Number(left?.radius) || 0) + (Number(right?.radius) || 0);
}

function pairGeometry(left, right) {
  const dx = (right.x ?? 0) - (left.x ?? 0);
  const dy = (right.y ?? 0) - (left.y ?? 0);
  const centerDistance = Math.max(0.001, Math.hypot(dx, dy));
  const radiusSum = pairRadiusSum(left, right);
  const surfaceDistance = centerDistance - radiusSum;
  return {
    dx,
    dy,
    centerDistance,
    radiusSum,
    surfaceDistance,
  };
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

  searchRadius(x, y, radius, nodeMap) {
    return this.search(
      {
        minX: x - radius,
        minY: y - radius,
        maxX: x + radius,
        maxY: y + radius,
      },
      nodeMap,
    );
  }
}

export class IncrementalGraphLayout {
  constructor({ nodes = [], edges = [], config = {} } = {}) {
    this.config = mergeConfig(config);
    this.nodeMap = new Map();
    this.edgeMap = new Map();
    this.componentBounds = new Map();
    this.componentOrder = [];
    this.componentCursor = {
      x: 0,
      y: 0,
      rowHeight: 0,
    };
    this.componentCounter = 0;
    this.parentAngleState = new Map();
    this.activeComponentId = null;
    this.layoutCompleted = false;
    this.spatialIndex = new GridSpatialIndex(this.config.spatialCellSize);
    this.normalizeGraphInput(nodes, edges);
    this.computeRanks();
    this.derivePhysicsProperties();
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
        label: data?.label ?? '',
        shape: data?.shape ?? '',
        annotations: data,
        isConnector: Boolean(
          data?.owlHelper ||
            data?.edgeAnchor ||
            data?.edgeBendHandle ||
            data?.owlExpressionNode ||
            data?.owlGroupNode ||
            data?.owlCollectionConnector ||
            data?.rdfConnectorNode ||
            data?.rdfBlankNode ||
            data?.rdfStructuralBlankNode ||
            data?.entityCategory?.includes?.('connector'),
        ),
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
        type: data?.predicate ?? data?.category ?? '',
        weight: Number(data?.weight) || 1,
        isConnectorEdge: Boolean(data?.edgeAnchorTether || data?.edgeAttachedConnector || data?.owlRelationConnector),
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
      const normalizedRank = node.normalizedRank;
      const visualRadius = Math.max(Number(node.renderWidth) || 0, Number(node.renderHeight) || 0) * 0.5;
      const rankRadius = this.config.baseRadius + this.config.radiusScale * normalizedRank;
      node.mass = this.config.baseMass + this.config.massScale * normalizedRank;
      node.radius = Math.max(visualRadius, this.config.baseRadius) + rankRadius;
      node.repulsionStrength =
        this.config.baseRepulsion * (1 + this.config.repulsionRankScale * normalizedRank);
      node.attractionStrength =
        this.config.baseAttraction / (1 + this.config.attractionRankScale * normalizedRank);
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
    const multiParentNodes = [];
    const singleParentGroups = new Map();

    for (const node of batch) {
      const parentAnchors = node.neighborIds
        .map((neighborId) => anchorById.get(neighborId))
        .filter(Boolean);
      if (parentAnchors.length > 1) {
        multiParentNodes.push({ node, parentAnchors });
        continue;
      }
      const parent = parentAnchors[0];
      if (!parent) {
        multiParentNodes.push({ node, parentAnchors: [] });
        continue;
      }
      const siblings = singleParentGroups.get(parent.id) ?? [];
      siblings.push(node);
      singleParentGroups.set(parent.id, siblings);
    }

    for (const { node, parentAnchors } of multiParentNodes) {
      if (parentAnchors.length === 0) {
        const seedJitter = deterministicJitter(node.id, this.config.preferredEdgeLength);
        const resolved = this.findNonOverlappingPosition(
          node,
          { x: seedJitter.x, y: seedJitter.y },
          occupied,
          'seed-isolated',
        );
        node.x = resolved.x;
        node.y = resolved.y;
        occupied.push(node);
        continue;
      }
      const jitter = deterministicJitter(node.id, Math.max(node.radius, this.config.preferredEdgeLength * 0.35));
      const candidate = {
        x: average(parentAnchors.map((parent) => parent.x)) + jitter.x,
        y: average(parentAnchors.map((parent) => parent.y)) + jitter.y,
      };
      const resolved = this.findNonOverlappingPosition(
        node,
        candidate,
        [...occupied, ...parentAnchors],
        `seed-multiparent:${node.id}`,
      );
      node.x = resolved.x;
      node.y = resolved.y;
      occupied.push(node);
    }

    for (const [parentId, children] of singleParentGroups.entries()) {
      const parent = anchorById.get(parentId);
      if (!parent) {
        continue;
      }
      const sortedChildren = [...children].sort((left, right) => right.rank - left.rank || left.id.localeCompare(right.id));
      let nextAngle = this.parentAngleState.get(parent.id) ?? deterministicAngle(`${parent.id}|ring`);
      let ringIndex = 0;
      let offsetInRing = 0;
      let ringRadius = parent.radius + this.config.preferredEdgeLength;
      let ringCapacity = 1;

      for (const child of sortedChildren) {
        const childSpacing = parent.radius + child.radius + this.config.preferredEdgeLength;
        ringRadius = Math.max(ringRadius, childSpacing + ringIndex * (child.radius * 2 + this.config.minNodeSpacing));
        ringCapacity = Math.max(
          1,
          Math.floor((2 * Math.PI * ringRadius) / Math.max(24, child.radius * 2 + this.config.minNodeSpacing)),
        );
        if (offsetInRing >= ringCapacity) {
          ringIndex += 1;
          offsetInRing = 0;
          ringRadius = childSpacing + ringIndex * (child.radius * 2 + this.config.minNodeSpacing);
          ringCapacity = Math.max(
            1,
            Math.floor((2 * Math.PI * ringRadius) / Math.max(24, child.radius * 2 + this.config.minNodeSpacing)),
          );
        }
        const angleStep = (Math.PI * 2) / ringCapacity;
        const angle = nextAngle + offsetInRing * angleStep;
        const resolved = this.findNonOverlappingPosition(
          child,
          {
            x: parent.x + Math.cos(angle) * ringRadius,
            y: parent.y + Math.sin(angle) * ringRadius,
          },
          occupied,
          `seed-singleparent:${parent.id}`,
        );
        child.x = resolved.x;
        child.y = resolved.y;
        occupied.push(child);
        offsetInRing += 1;
        nextAngle = angle + angleStep;
      }
      this.parentAngleState.set(parent.id, nextAngle);
    }
  }

  getRelevantFixedNodes(batch) {
    const mutableIds = new Set(batch.map((node) => node.id));
    const fixedNodes = new Map();
    const bounds = createBounds();

    for (const node of batch) {
      extendBounds(bounds, node.x ?? 0, node.y ?? 0, node.radius);
      for (const neighborId of node.neighborIds) {
        const neighbor = this.nodeMap.get(neighborId);
        if (!neighbor || mutableIds.has(neighborId) || !Number.isFinite(neighbor.x) || !Number.isFinite(neighbor.y)) {
          continue;
        }
        fixedNodes.set(neighbor.id, neighbor);
      }
    }

    if (!isFiniteBounds(bounds)) {
      return [];
    }

    const nearbyFixed = this.spatialIndex.search(
      {
        minX: bounds.minX - this.config.fixedNodeSearchPadding,
        minY: bounds.minY - this.config.fixedNodeSearchPadding,
        maxX: bounds.maxX + this.config.fixedNodeSearchPadding,
        maxY: bounds.maxY + this.config.fixedNodeSearchPadding,
      },
      this.nodeMap,
    );
    for (const node of nearbyFixed) {
      if (!mutableIds.has(node.id)) {
        fixedNodes.set(node.id, node);
      }
    }

    return Array.from(fixedNodes.values());
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

  measureNodeViolation(node, obstacles) {
    let maxViolation = 0;
    let totalViolation = 0;
    let count = 0;
    for (const obstacle of obstacles) {
      if (!obstacle || obstacle.id === node.id || !Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.y)) {
        continue;
      }
      const distance = Math.max(0.001, Math.hypot((node.x ?? 0) - obstacle.x, (node.y ?? 0) - obstacle.y));
      const preferred = pairPreferredDistance(node, obstacle, this.config);
      const violation = preferred - distance;
      if (violation > 0) {
        maxViolation = Math.max(maxViolation, violation);
        totalViolation += violation;
        count += 1;
      }
    }
    return {
      maxViolation,
      totalViolation,
      count,
    };
  }

  violatesSpacing(node, obstacles) {
    return this.measureNodeViolation(node, obstacles).maxViolation > 0;
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
      if (!this.violatesSpacing(node, obstacles)) {
        return {
          x: node.x,
          y: node.y,
        };
      }
    }

    return {
      x: node.x,
      y: node.y,
    };
  }

  collectSimulationDiagnostics(mutableNodes, fixedNodes) {
    let maxViolation = 0;
    let totalViolation = 0;
    let violationCount = 0;
    const mutableSet = new Set(mutableNodes.map((node) => node.id));

    for (let index = 0; index < mutableNodes.length; index += 1) {
      const node = mutableNodes[index];
      const mutablePeers = mutableNodes.slice(index + 1);
      const mutableStats = this.measureNodeViolation(node, mutablePeers);
      maxViolation = Math.max(maxViolation, mutableStats.maxViolation);
      totalViolation += mutableStats.totalViolation;
      violationCount += mutableStats.count;

      const fixedStats = this.measureNodeViolation(node, fixedNodes.filter((entry) => !mutableSet.has(entry.id)));
      maxViolation = Math.max(maxViolation, fixedStats.maxViolation);
      totalViolation += fixedStats.totalViolation;
      violationCount += fixedStats.count;
    }

    return {
      maxViolation,
      averageOverlap: violationCount > 0 ? totalViolation / violationCount : 0,
      violationCount,
    };
  }

  getRelevantEdges(batch) {
    const mutableIds = new Set(batch.map((node) => node.id));
    return Array.from(this.edgeMap.values()).filter(
      (edge) => mutableIds.has(edge.sourceId) || mutableIds.has(edge.targetId),
    );
  }

  runForceSimulation({ mutableNodes, fixedNodes, edges }) {
    const startTime = Date.now();
    const mutableById = new Map(mutableNodes.map((node) => [node.id, node]));
    const velocities = new Map(mutableNodes.map((node) => [node.id, { x: 0, y: 0 }]));
    let tickCount = 0;
    let averageVelocity = Infinity;
    let averageOverlap = Infinity;
    let currentFixedNodes = [...fixedNodes];
    let fixedById = new Map(currentFixedNodes.map((node) => [node.id, node]));

    while (
      tickCount < this.config.maxTicks &&
      averageVelocity > this.config.velocityThreshold &&
      Date.now() - startTime < this.config.maxLayoutTimeMs
    ) {
      if (tickCount === 0 || tickCount % this.config.fixedRefreshInterval === 0) {
        currentFixedNodes = this.refreshFixedNodesForMutableBatch(mutableNodes);
        fixedById = new Map(currentFixedNodes.map((node) => [node.id, node]));
      }
      const forces = new Map(mutableNodes.map((node) => [node.id, { x: 0, y: 0 }]));
      let overlapAccumulator = 0;
      let overlapCount = 0;

      for (let leftIndex = 0; leftIndex < mutableNodes.length; leftIndex += 1) {
        const left = mutableNodes[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < mutableNodes.length; rightIndex += 1) {
          const right = mutableNodes[rightIndex];
          const { dx, dy, centerDistance, radiusSum, surfaceDistance } = pairGeometry(left, right);
          const preferred = pairPreferredDistance(left, right, this.config);
          const preferredSurfaceDistance = preferred - radiusSum;
          const effectiveSurfaceDistance = Math.max(surfaceDistance, 0.001);
          const normalizedDistance = effectiveSurfaceDistance / Math.max(preferredSurfaceDistance, 1);
          let repulsion =
            ((left.repulsionStrength + right.repulsionStrength) * 0.5) /
            Math.max(preferredSurfaceDistance * preferredSurfaceDistance * normalizedDistance * normalizedDistance, 1);
          if (centerDistance < preferred) {
            repulsion *=
              this.config.overlapPenaltyMultiplier *
              (Math.max(preferredSurfaceDistance, this.config.minNodeSpacing) / effectiveSurfaceDistance);
            overlapAccumulator += preferred - centerDistance;
            overlapCount += 1;
          }
          const fx = (dx / centerDistance) * repulsion;
          const fy = (dy / centerDistance) * repulsion;
          forces.get(left.id).x -= fx;
          forces.get(left.id).y -= fy;
          forces.get(right.id).x += fx;
          forces.get(right.id).y += fy;
        }
      }

      for (const mutableNode of mutableNodes) {
        for (const fixedNode of currentFixedNodes) {
          const { dx, dy, centerDistance, radiusSum, surfaceDistance } = pairGeometry(fixedNode, mutableNode);
          const preferred = pairPreferredDistance(mutableNode, fixedNode, this.config);
          const preferredSurfaceDistance = preferred - radiusSum;
          const effectiveSurfaceDistance = Math.max(surfaceDistance, 0.001);
          const normalizedDistance = effectiveSurfaceDistance / Math.max(preferredSurfaceDistance, 1);
          let repulsion =
            ((mutableNode.repulsionStrength + fixedNode.repulsionStrength) * 0.5) /
            Math.max(preferredSurfaceDistance * preferredSurfaceDistance * normalizedDistance * normalizedDistance, 1);
          if (centerDistance < preferred) {
            repulsion *=
              this.config.overlapPenaltyMultiplier *
              (Math.max(preferredSurfaceDistance, this.config.minNodeSpacing) / effectiveSurfaceDistance);
            overlapAccumulator += preferred - centerDistance;
            overlapCount += 1;
          }
          forces.get(mutableNode.id).x += (dx / centerDistance) * repulsion;
          forces.get(mutableNode.id).y += (dy / centerDistance) * repulsion;
        }
      }

      for (const edge of edges) {
        const source = mutableById.get(edge.sourceId) ?? fixedById.get(edge.sourceId) ?? this.nodeMap.get(edge.sourceId);
        const target = mutableById.get(edge.targetId) ?? fixedById.get(edge.targetId) ?? this.nodeMap.get(edge.targetId);
        if (!source || !target) {
          continue;
        }
        const sourceMutable = mutableById.has(source.id);
        const targetMutable = mutableById.has(target.id);
        if (!sourceMutable && !targetMutable) {
          continue;
        }
        const { dx, dy, centerDistance, radiusSum } = pairGeometry(source, target);
        const desiredSurfaceDistance =
          this.config.preferredEdgeLength +
          (1 - ((source.normalizedRank + target.normalizedRank) * 0.5)) * this.config.edgeLengthRankScale;
        const desiredCenterDistance = radiusSum + desiredSurfaceDistance;
        const attractionStrength = ((source.attractionStrength + target.attractionStrength) * 0.5) * edge.weight;
        const springForce = attractionStrength * (centerDistance - desiredCenterDistance);
        const fx = (dx / centerDistance) * springForce;
        const fy = (dy / centerDistance) * springForce;
        if (sourceMutable) {
          forces.get(source.id).x += fx;
          forces.get(source.id).y += fy;
        }
        if (targetMutable) {
          forces.get(target.id).x -= fx;
          forces.get(target.id).y -= fy;
        }
      }

      let velocityTotal = 0;
      for (const mutableNode of mutableNodes) {
        const velocity = velocities.get(mutableNode.id);
        const force = forces.get(mutableNode.id);
        velocity.x = (velocity.x + force.x / Math.max(0.001, mutableNode.mass)) * this.config.damping;
        velocity.y = (velocity.y + force.y / Math.max(0.001, mutableNode.mass)) * this.config.damping;
        const clamped = clampMagnitude(velocity.x, velocity.y, this.config.maxStep);
        velocity.x = clamped.x;
        velocity.y = clamped.y;
        mutableNode.x = (mutableNode.x ?? 0) + velocity.x;
        mutableNode.y = (mutableNode.y ?? 0) + velocity.y;
        velocityTotal += Math.hypot(velocity.x, velocity.y);
      }

      averageVelocity = mutableNodes.length ? velocityTotal / mutableNodes.length : 0;
      averageOverlap = overlapCount ? overlapAccumulator / overlapCount : 0;
      if (averageOverlap <= this.config.acceptableOverlapThreshold && averageVelocity <= this.config.velocityThreshold * 1.25) {
        break;
      }
      tickCount += 1;
    }

    currentFixedNodes = this.refreshFixedNodesForMutableBatch(mutableNodes);
    for (let pass = 0; pass < this.config.finalConstraintPasses; pass += 1) {
      let moved = false;
      for (const mutableNode of mutableNodes) {
        const peers = [
          ...mutableNodes.filter((candidate) => candidate.id !== mutableNode.id),
          ...currentFixedNodes,
        ];
        moved = this.moveNodeOutsideObstacles(mutableNode, peers, `final-pass:${pass}`) || moved;
      }
      const diagnostics = this.collectSimulationDiagnostics(mutableNodes, currentFixedNodes);
      if (diagnostics.maxViolation <= this.config.minimumAcceptedOverlap) {
        return diagnostics;
      }
      if (!moved) {
        return diagnostics;
      }
    }

    return this.collectSimulationDiagnostics(mutableNodes, currentFixedNodes);
  }

  pinBatch(batch) {
    for (const node of batch) {
      node.mutable = false;
      node.status = 'frontier';
      this.spatialIndex.insert(node);
    }
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

  expandComponentFromSeed(seed) {
    while (true) {
      const frontierNodes = this.getFrontierNodesForComponent(seed.componentId);
      if (frontierNodes.length === 0) {
        break;
      }
      const batch = this.collectUndiscoveredOneHopNeighbors(frontierNodes);
      if (batch.length === 0) {
        this.updateStatuses(frontierNodes);
        break;
      }
      this.initializeBatchPositions(batch, frontierNodes);
      for (const node of batch) {
        node.mutable = true;
        node.status = 'frontier';
      }
      let diagnostics = this.runForceSimulation({
        mutableNodes: batch,
        fixedNodes: this.getRelevantFixedNodes(batch),
        edges: this.getRelevantEdges(batch),
      });
      if (diagnostics.maxViolation > this.config.minimumAcceptedOverlap) {
        const retryFixedNodes = this.refreshFixedNodesForMutableBatch(batch);
        diagnostics = this.runForceSimulation({
          mutableNodes: batch,
          fixedNodes: retryFixedNodes,
          edges: this.getRelevantEdges(batch),
        });
      }
      this.pinBatch(batch);
      this.updateStatuses([...frontierNodes, ...batch]);
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

  getDiscoveredNodeIds() {
    return new Set(
      Array.from(this.nodeMap.values())
        .filter((node) => node.status !== 'undiscovered' && Number.isFinite(node.x) && Number.isFinite(node.y))
        .map((node) => node.id),
    );
  }

  computeNextBatch() {
    if (this.layoutCompleted) {
      return {
        done: true,
        changed: false,
        newNodeIds: [],
      };
    }

    while (true) {
      if (!this.activeComponentId) {
        const seed = this.getHighestRankUndiscoveredNode();
        if (!seed) {
          this.layoutCompleted = true;
          return {
            done: true,
            changed: false,
            newNodeIds: [],
          };
        }
        this.initializeComponentSeed(seed);
        this.activeComponentId = seed.componentId;
        return {
          done: false,
          changed: true,
          newNodeIds: [seed.id],
        };
      }

      const frontierNodes = this.getFrontierNodesForComponent(this.activeComponentId);
      if (frontierNodes.length === 0) {
        this.finalizeComponent(this.activeComponentId);
        this.activeComponentId = null;
        if (!this.hasUndiscoveredNodes()) {
          this.layoutCompleted = true;
          return {
            done: true,
            changed: false,
            newNodeIds: [],
          };
        }
        continue;
      }

      const batch = this.collectUndiscoveredOneHopNeighbors(frontierNodes);
      if (batch.length === 0) {
        this.updateStatuses(frontierNodes);
        const nextFrontier = this.getFrontierNodesForComponent(this.activeComponentId);
        if (nextFrontier.length === 0) {
          this.finalizeComponent(this.activeComponentId);
          this.activeComponentId = null;
        }
        return {
          done: this.isComplete(),
          changed: false,
          newNodeIds: [],
        };
      }

      this.initializeBatchPositions(batch, frontierNodes);
      for (const node of batch) {
        node.mutable = true;
        node.status = 'frontier';
      }
      let diagnostics = this.runForceSimulation({
        mutableNodes: batch,
        fixedNodes: this.getRelevantFixedNodes(batch),
        edges: this.getRelevantEdges(batch),
      });
      if (diagnostics.maxViolation > this.config.minimumAcceptedOverlap) {
        const retryFixedNodes = this.refreshFixedNodesForMutableBatch(batch);
        diagnostics = this.runForceSimulation({
          mutableNodes: batch,
          fixedNodes: retryFixedNodes,
          edges: this.getRelevantEdges(batch),
        });
      }
      this.pinBatch(batch);
      this.updateStatuses([...frontierNodes, ...batch]);
      return {
        done: false,
        changed: true,
        newNodeIds: batch.map((node) => node.id),
      };
    }
  }

  computeLayout() {
    while (!this.isComplete()) {
      this.computeNextBatch();
    }
    this.layoutCompleted = true;
    return this.getFullGraph();
  }

  getNodeById(id) {
    return this.nodeMap.get(id) ?? null;
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
    this.spatialIndex.insert(node);
    return node;
  }

  focusNode(id) {
    return this.getNodeById(id);
  }

  getFullGraph() {
    return {
      nodes: Array.from(this.nodeMap.values()).map((node) => ({ ...node })),
      edges: Array.from(this.edgeMap.values()).map((edge) => ({ ...edge })),
    };
  }
}

export function applyLayoutPositions(elements, engine) {
  if (!Array.isArray(elements) || !engine) {
    return Array.isArray(elements) ? elements : [];
  }

  const nodeElements = elements.filter((element) => element?.data?.id && !element?.data?.source);
  const edgeElements = elements.filter((element) => element?.data?.source);
  const positionedNodes = new Map();
  const adjacency = new Map();
  const nodeDataById = new Map();

  const ensureAdjacency = (nodeId) => {
    const bucket = adjacency.get(nodeId) ?? [];
    adjacency.set(nodeId, bucket);
    return bucket;
  };

  for (const nodeElement of nodeElements) {
    const data = nodeElement.data;
    nodeDataById.set(data.id, data);
    const canonicalNode = engine.getNodeById(data.id);
    if (canonicalNode && Number.isFinite(canonicalNode.x) && Number.isFinite(canonicalNode.y)) {
      positionedNodes.set(data.id, {
        x: canonicalNode.x,
        y: canonicalNode.y,
      });
    }
  }

  for (const edgeElement of edgeElements) {
    const data = edgeElement.data;
    ensureAdjacency(data.source).push(data.target);
    ensureAdjacency(data.target).push(data.source);
  }

  const resolveNodeRadius = (data) => Math.max(Number(data?.nodeWidth ?? 42), Number(data?.nodeHeight ?? 42)) * 0.5;

  const placeBetweenEndpoints = (data) => {
    const source = positionedNodes.get(data.anchoredSourceId);
    const target = positionedNodes.get(data.anchoredTargetId);
    if (!source || !target) {
      return null;
    }
    return {
      x: (source.x + target.x) * 0.5,
      y: (source.y + target.y) * 0.5,
    };
  };

  const placeFromNeighbors = (nodeId, data) => {
    const neighborIds = Array.from(new Set(adjacency.get(nodeId) ?? []));
    const neighborPositions = neighborIds.map((neighborId) => positionedNodes.get(neighborId)).filter(Boolean);
    if (neighborPositions.length === 0) {
      return null;
    }

    if (data.edgeAnchor === 1) {
      return placeBetweenEndpoints(data) ?? {
        x: average(neighborPositions.map((entry) => entry.x)),
        y: average(neighborPositions.map((entry) => entry.y)),
      };
    }

    const centroid = {
      x: average(neighborPositions.map((entry) => entry.x)),
      y: average(neighborPositions.map((entry) => entry.y)),
    };

    if (neighborPositions.length >= 2 || data.owlGroupNode === 1 || data.owlCollectionConnector === 1) {
      const jitter = deterministicJitter(`${nodeId}|centroid`, Math.max(12, resolveNodeRadius(data) * 0.45));
      return {
        x: centroid.x + jitter.x,
        y: centroid.y + jitter.y,
      };
    }

    const [anchor] = neighborPositions;
    const angle = deterministicAngle(`${nodeId}|neighbor`);
    const radialDistance = resolveNodeRadius(data) + 38;
    return {
      x: anchor.x + Math.cos(angle) * radialDistance,
      y: anchor.y + Math.sin(angle) * radialDistance,
    };
  };

  const unresolvedNodeIds = nodeElements
    .map((element) => element.data.id)
    .filter((nodeId) => !positionedNodes.has(nodeId));

  let progress = true;
  let passCount = 0;
  while (progress && unresolvedNodeIds.length > 0 && passCount < 8) {
    progress = false;
    for (let index = unresolvedNodeIds.length - 1; index >= 0; index -= 1) {
      const nodeId = unresolvedNodeIds[index];
      const data = nodeDataById.get(nodeId);
      const position = placeFromNeighbors(nodeId, data);
      if (!position) {
        continue;
      }
      positionedNodes.set(nodeId, position);
      unresolvedNodeIds.splice(index, 1);
      progress = true;
    }
    passCount += 1;
  }

  const canonicalNodeIds = new Set(
    nodeElements
      .map((element) => element.data.id)
      .filter((nodeId) => {
        const canonicalNode = engine.getNodeById(nodeId);
        return Boolean(canonicalNode && Number.isFinite(canonicalNode.x) && Number.isFinite(canonicalNode.y));
      }),
  );

  const projectedMovableNodeIds = nodeElements
    .map((element) => element.data.id)
    .filter((nodeId) => positionedNodes.has(nodeId) && !canonicalNodeIds.has(nodeId));

  const resolvedEdgeList = edgeElements.filter((element) => {
    const data = element?.data;
    return Boolean(data?.source && positionedNodes.has(data.source) && positionedNodes.has(data.target));
  });

  if (projectedMovableNodeIds.length > 0) {
    const projectionGraph = createGraph();
    const allProjectedNodeIds = Array.from(positionedNodes.keys());
    const movableSet = new Set(allProjectedNodeIds);
    const nodeRadiusMap = new Map(allProjectedNodeIds.map((nodeId) => [nodeId, resolveNodeRadius(nodeDataById.get(nodeId))]));

    const nodeMass = (nodeId) => {
      const canonicalNode = canonicalNodeIds.has(nodeId) ? engine.getNodeById(nodeId) : null;
      const normalizedRank = canonicalNode?.normalizedRank ?? 0.5;
      return (engine.config.baseMass ?? 1) + (engine.config.massScale ?? 0) * normalizedRank;
    };

    const projectionLayout = createForceLayout(projectionGraph, {
      springLength: engine.config.preferredEdgeLength,
      springCoefficient: 0.6,
      gravity: -28,
      theta: 0.95,
      dragCoefficient: 0.16,
      timeStep: 0.5,
      adaptiveTimeStepWeight: 0,
      nodeMass,
      springTransform: (link, spring) => {
        const sourceRadius = nodeRadiusMap.get(link.fromId) ?? 0;
        const targetRadius = nodeRadiusMap.get(link.toId) ?? 0;
        spring.length = engine.config.preferredEdgeLength + sourceRadius + targetRadius;
        spring.coefficient = 0.6;
      },
    });

    for (const nodeId of allProjectedNodeIds) {
      const position = positionedNodes.get(nodeId);
      const layoutNode = projectionGraph.addNode(nodeId, { isPinned: false });
      layoutNode.position = { x: position.x, y: position.y };
      layoutNode.isPinned = false;
    }

    for (const edgeElement of resolvedEdgeList) {
      const data = edgeElement.data;
      if (!projectionGraph.getNode(data.source) || !projectionGraph.getNode(data.target)) {
        continue;
      }
      projectionGraph.addLink(data.source, data.target, { edgeId: data.id });
    }

    for (const nodeId of allProjectedNodeIds) {
      const position = positionedNodes.get(nodeId);
      projectionLayout.setNodePosition(nodeId, position.x, position.y);
      projectionLayout.pinNode(projectionGraph.getNode(nodeId), false);
    }

    projectionLayout.simulator.addForce('surfaceRepulsion', () => {
      for (let leftIndex = 0; leftIndex < allProjectedNodeIds.length; leftIndex += 1) {
        const leftId = allProjectedNodeIds[leftIndex];
        const leftBody = projectionLayout.getBody(leftId);
        const leftRadius = nodeRadiusMap.get(leftId) ?? 0;
        if (!leftBody) {
          continue;
        }
        for (let rightIndex = leftIndex + 1; rightIndex < allProjectedNodeIds.length; rightIndex += 1) {
          const rightId = allProjectedNodeIds[rightIndex];
          const rightBody = projectionLayout.getBody(rightId);
          const rightRadius = nodeRadiusMap.get(rightId) ?? 0;
          if (!rightBody) {
            continue;
          }

          let dx = rightBody.pos.x - leftBody.pos.x;
          let dy = rightBody.pos.y - leftBody.pos.y;
          let distance = Math.hypot(dx, dy);
          if (distance === 0) {
            const angle = deterministicAngle(`${leftId}|${rightId}|surface`);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }

          const preferred = leftRadius + rightRadius + engine.config.minNodeSpacing;
          const overlap = preferred - distance;
          const baseScale = (engine.config.baseRepulsion ?? 3600) * 0.000035;
          const strength = overlap > 0
            ? baseScale * (1 + overlap * 0.12)
            : baseScale * 0.22 / Math.max(distance / Math.max(preferred, 1), 1.15);
          const fx = (dx / distance) * strength;
          const fy = (dy / distance) * strength;

          leftBody.force.x -= fx;
          leftBody.force.y -= fy;
          rightBody.force.x += fx;
          rightBody.force.y += fy;
        }
      }
    });

    let steps = 0;
    let stable = false;
    while (steps < 260) {
      stable = projectionLayout.step();
      steps += 1;
      if (steps >= 96 && (stable || (projectionLayout.lastMove ?? Infinity) <= 0.0025)) {
        break;
      }
    }

    for (const nodeId of allProjectedNodeIds) {
      const position = projectionLayout.getNodePosition(nodeId);
      positionedNodes.set(nodeId, {
        x: position.x,
        y: position.y,
      });
    }

    for (let pass = 0; pass < 4; pass += 1) {
      let moved = false;
      for (const nodeId of allProjectedNodeIds) {
        const nextNode = {
          id: nodeId,
          x: positionedNodes.get(nodeId).x,
          y: positionedNodes.get(nodeId).y,
          radius: nodeRadiusMap.get(nodeId) ?? resolveNodeRadius(nodeDataById.get(nodeId)),
        };
        const obstacles = allProjectedNodeIds
          .filter((otherId) => otherId !== nodeId)
          .map((otherId) => ({
            id: otherId,
            x: positionedNodes.get(otherId).x,
            y: positionedNodes.get(otherId).y,
            radius: nodeRadiusMap.get(otherId) ?? resolveNodeRadius(nodeDataById.get(otherId)),
          }));
        moved = engine.moveNodeOutsideObstacles(nextNode, obstacles, `projected-ngraph:${pass}:${nodeId}`) || moved;
        positionedNodes.set(nodeId, { x: nextNode.x, y: nextNode.y });
      }
      if (!moved) {
        break;
      }
    }
  }

  const positionedNodeIds = new Set(positionedNodes.keys());
  const visibleNodeIds = new Set();
  const resolvedNodeElements = nodeElements
    .map((element) => {
      const position = positionedNodes.get(element.data.id);
      if (!position) {
        return null;
      }
      visibleNodeIds.add(element.data.id);
      return {
        ...element,
        position,
      };
    })
    .filter(Boolean);

  const resolvedEdgeElements = edgeElements.filter((element) => {
    const data = element?.data;
    return Boolean(data?.source && visibleNodeIds.has(data.source) && visibleNodeIds.has(data.target));
  });

  const resolvedNodeIdSet = new Set(resolvedNodeElements.map((element) => element.data.id));
  const reachableHelperIds = new Set();
  for (const element of resolvedEdgeElements) {
    const sourceId = element.data.source;
    const targetId = element.data.target;
    if (!positionedNodeIds.has(sourceId)) {
      reachableHelperIds.add(sourceId);
    }
    if (!positionedNodeIds.has(targetId)) {
      reachableHelperIds.add(targetId);
    }
  }

  const filteredNodeElements = resolvedNodeElements.filter((element) => {
    const data = element.data;
    const isCanonical = positionedNodeIds.has(data.id);
    return isCanonical || reachableHelperIds.has(data.id) || resolvedNodeIdSet.has(data.id);
  });

  return [...filteredNodeElements, ...resolvedEdgeElements].map((element) => {
    const data = element?.data;
    if (!data?.id || data?.source) {
      return element;
    }
    const position = positionedNodes.get(data.id);
    if (!position) {
      return element;
    }
    return {
      ...element,
      position,
    };
  });
}
