// Viewport helpers: a "readable" fit never zooms out past the point where labels stop being legible.
// When the whole graph cannot fit at that zoom, the view is anchored on the most connected node
// (at the top-centre for hierarchy layouts, where the roots live) so the user lands on something useful.

export const MIN_READABLE_ZOOM = 0.6;
const MAX_FIT_ZOOM = 1.5;

function pickFocalNode(nodes, anchorTop) {
  let pool = nodes;
  if (anchorTop) {
    const top = nodes.boundingBox().y1;
    const topLayer = nodes.filter((node) => node.position('y') <= top + 60);
    if (topLayer.length > 0) {
      pool = topLayer;
    }
  }
  let best = null;
  pool.forEach((node) => {
    if (!best || node.degree() > best.degree()) {
      best = node;
    }
  });
  return best;
}

export function computeReadableViewport(cy, eles, { padding = 42, minZoom = MIN_READABLE_ZOOM, anchorTop = false } = {}) {
  const nodes = eles.nodes();
  if (nodes.length === 0) {
    return null;
  }
  const width = cy.width();
  const height = cy.height();
  const bb = eles.boundingBox();
  const fitZoom = Math.min((width - 2 * padding) / Math.max(bb.w, 1), (height - 2 * padding) / Math.max(bb.h, 1));
  const clamp = (zoom) => Math.min(Math.max(zoom, cy.minZoom()), Math.min(cy.maxZoom(), MAX_FIT_ZOOM));

  if (fitZoom >= minZoom) {
    const zoom = clamp(fitZoom);
    return {
      zoom,
      pan: {
        x: (width - bb.w * zoom) / 2 - bb.x1 * zoom,
        y: (height - bb.h * zoom) / 2 - bb.y1 * zoom,
      },
    };
  }

  const zoom = clamp(minZoom);
  const focal = pickFocalNode(nodes, anchorTop);
  const position = focal.position();
  const screenY = anchorTop ? padding + (focal.height() * zoom) / 2 + 24 : height / 2;
  return {
    zoom,
    pan: { x: width / 2 - position.x * zoom, y: screenY - position.y * zoom },
  };
}

export function applyReadableViewport(cy, options = {}) {
  const eles = cy
    .elements(':visible')
    .not('[edgeAnchor = 1]')
    .not('[edgeBendHandle = 1]')
    .not('[edgeAnchorTether = 1]');
  const viewport = computeReadableViewport(cy, eles, options);
  if (viewport) {
    cy.viewport(viewport);
  }
  return viewport;
}
