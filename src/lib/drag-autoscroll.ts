const AUTO_SCROLL_EDGE_PX = 120;
const AUTO_SCROLL_MIN_STEP = 8;
const AUTO_SCROLL_MAX_STEP = 28;

export function calculateAutoScrollDelta(clientY: number, viewportHeight: number): number {
  if (!Number.isFinite(clientY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 0;
  }

  if (clientY < AUTO_SCROLL_EDGE_PX) {
    const intensity = (AUTO_SCROLL_EDGE_PX - clientY) / AUTO_SCROLL_EDGE_PX;
    const step = AUTO_SCROLL_MIN_STEP + Math.round((AUTO_SCROLL_MAX_STEP - AUTO_SCROLL_MIN_STEP) * intensity);
    return -step;
  }

  const lowerEdgeStart = viewportHeight - AUTO_SCROLL_EDGE_PX;
  if (clientY > lowerEdgeStart) {
    const intensity = (clientY - lowerEdgeStart) / AUTO_SCROLL_EDGE_PX;
    const step = AUTO_SCROLL_MIN_STEP + Math.round((AUTO_SCROLL_MAX_STEP - AUTO_SCROLL_MIN_STEP) * intensity);
    return step;
  }

  return 0;
}
