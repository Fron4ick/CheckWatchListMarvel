import type { CardRect } from "./layout";
import { CARD_WIDTH, CARD_HEIGHT } from "./layout";

export type Point = { x: number; y: number };

function rectsOverlapSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: CardRect,
  padding = 18,
): boolean {
  const left = rect.x - padding;
  const right = rect.x + CARD_WIDTH + padding;
  const top = rect.y - padding;
  const bottom = rect.y + CARD_HEIGHT + padding;

  // Sample the segment; if any sample falls inside an obstacle rect, it intersects
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (x >= left && x <= right && y >= top && y <= bottom) return true;
  }
  return false;
}

function waypointAround(
  from: Point,
  to: Point,
  obstacles: CardRect[],
): Point | null {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const candidates: Point[] = [
    { x: midX, y: midY - 320 },
    { x: midX, y: midY + 320 },
    { x: midX, y: 280 },
    { x: midX, y: 1680 },
    { x: midX, y: 980 },
  ];

  for (const wp of candidates) {
    const clearA = !obstacles.some((r) =>
      rectsOverlapSegment(from.x, from.y, wp.x, wp.y, r),
    );
    const clearB = !obstacles.some((r) =>
      rectsOverlapSegment(wp.x, wp.y, to.x, to.y, r),
    );
    if (clearA && clearB) return wp;
  }

  // Fallback: route far above the timeline
  return { x: midX, y: 220 };
}

/**
 * Build an SVG path that connects appearance card centers in order,
 * routing around cards where the character does not appear.
 */
export function routeCharacterPath(
  appearanceIds: string[],
  rects: Map<string, CardRect>,
  allIds: string[],
): string | null {
  const points: Point[] = [];
  for (const id of appearanceIds) {
    const r = rects.get(id);
    if (r) points.push({ x: r.cx, y: r.cy });
  }
  if (points.length < 2) return null;

  const obstacleIds = new Set(
    allIds.filter((id) => !appearanceIds.includes(id)),
  );
  const obstacles = [...obstacleIds]
    .map((id) => rects.get(id))
    .filter((r): r is CardRect => Boolean(r));

  const pathPoints: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const blocked = obstacles.some((r) =>
      rectsOverlapSegment(a.x, a.y, b.x, b.y, r),
    );
    if (blocked) {
      const wp = waypointAround(a, b, obstacles);
      if (wp) pathPoints.push(wp);
    }
    pathPoints.push(b);
  }

  return pointsToSmoothPath(pathPoints);
}

function pointsToSmoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const c1x = prev.x + (curr.x - prev.x) * 0.55;
    const c1y = prev.y + (curr.y - prev.y) * 0.55;
    const c2x = curr.x - (next.x - prev.x) * 0.12;
    const c2y = curr.y - (next.y - prev.y) * 0.12;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${curr.x} ${curr.y}`;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const c1x = prev.x + (last.x - prev.x) * 0.45;
  const c1y = prev.y + (last.y - prev.y) * 0.45;
  d += ` S ${c1x} ${c1y}, ${last.x} ${last.y}`;
  return d;
}
