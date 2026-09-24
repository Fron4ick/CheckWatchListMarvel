import type { CardRect } from "./layout";
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  POSTER_WIDTH,
  POSTER_HEIGHT,
  TIMELINE_Y,
} from "./layout";

export type Point = { x: number; y: number };

/** Точка пути: anchor=true — контакт (пин) на карточке персонажа (её нельзя схлопывать). */
type PathPoint = Point & { anchor?: boolean };

type Seg = { a: Point; b: Point };

/** Зоны горизонтальной прокладки линий. */
type Zone = "top" | "bottom";

/** Шаг между параллельными шинами внутри зоны. */
const LANE_STEP = 8;
/** Верхняя зона — над верхним рядом постеров (карточки начинаются с y=495). */
const TOP_ZONE_Y0 = 355;
/** Нижняя зона — под нижним рядом постеров (нижние карточки заканчиваются на y≈1605). */
const BOTTOM_ZONE_Y0 = 1635;
/** Сколько шин в каждой зоне (ёмкость больше числа персонажей → линии почти не совпадают). */
const ZONE_LANES = 14;
/** Длина фаски 45° на поворотах. */
const CHAMFER = 14;
/** Точность при определении «собственного» пересечения. */
const EPS = 1e-6;
/**
 * Минимальная длина пересекающегося сегмента для «мостика».
 * Короткие стыки у пинов не затемняются — мостики остаются только
 * там, где значимые длинные линии действительно проходят друг над другом
 * (например, вертикаль перехода через всю высоту доски).
 */
const MIN_CROSS_LEN = 140;

// Шины верхней зоны заполняются ОТ карточек (снизу вверх) — стойки к пинам
// короткие и пересекают меньше чужих шин.
const TOP_LANES = Array.from(
  { length: ZONE_LANES },
  (_, k) => TOP_ZONE_Y0 + (ZONE_LANES - 1 - k) * LANE_STEP,
);
// Шины нижней зоны заполняются ОТ карточек (сверху вниз).
const BOTTOM_LANES = Array.from(
  { length: ZONE_LANES },
  (_, k) => BOTTOM_ZONE_Y0 + k * LANE_STEP,
);

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function zoneOfY(y: number): Zone {
  return y < TIMELINE_Y ? "top" : "bottom";
}

/**
 * Уникальные шины персонажа в верхней и нижней зонах.
 * Раздаются по кругу в порядке хэша id — линии разных персонажей
 * почти никогда не идут по одной и той же шине.
 */
function buildLanes(
  chars: Array<{ id: string }>,
): Map<string, { top: number; bottom: number }> {
  const sorted = [...chars].sort((a, b) => hashOf(a.id) - hashOf(b.id));
  const counter = { top: 0, bottom: 0 };
  const map = new Map<string, { top: number; bottom: number }>();
  for (const ch of sorted) {
    map.set(ch.id, {
      top: TOP_LANES[counter.top++ % TOP_LANES.length],
      bottom: BOTTOM_LANES[counter.bottom++ % BOTTOM_LANES.length],
    });
  }
  return map;
}

/**
 * Контакты («пины») на кромке постера для каждого персонажа.
 * Как проводки витой пары в разъёме RJ-45: каждый персонаж входит
 * в тайтл своим выводом, контакты распределены друг за другом по ширине.
 * Верхние карточки обслуживаются верхней зоной (пины на верхней кромке),
 * нижние — нижней зоной (пины на нижней кромке постера).
 */
function buildPins(
  chars: Array<{ id: string; appearanceIds: string[] }>,
  rects: Map<string, CardRect>,
): Map<string, Map<string, Point>> {
  const perMedia = new Map<string, Array<{ id: string; h: number }>>();
  for (const ch of chars) {
    for (const mediaId of ch.appearanceIds) {
      if (!rects.has(mediaId)) continue;
      const list = perMedia.get(mediaId) ?? [];
      list.push({ id: ch.id, h: hashOf(ch.id) });
      perMedia.set(mediaId, list);
    }
  }

  const pins = new Map<string, Map<string, Point>>();
  for (const [mediaId, list] of perMedia) {
    const rect = rects.get(mediaId)!;
    const n = list.length;
    // Доступная ширина кромки постера (с отступами от краёв).
    const edgeWidth = Math.max(40, POSTER_WIDTH - 44);
    const spacing = Math.min(22, Math.max(12, edgeWidth / n));
    const startX = rect.cx - ((n - 1) * spacing) / 2;
    const pinY = zoneOfY(rect.cy) === "top" ? rect.y : rect.y + POSTER_HEIGHT;
    list.sort((a, b) => a.h - b.h);
    const map = pins.get(mediaId) ?? new Map<string, Point>();
    list.forEach((entry, k) => {
      map.set(entry.id, { x: Math.round(startX + k * spacing), y: pinY });
    });
    pins.set(mediaId, map);
  }
  return pins;
}

/**
 * Строит ломаную персонажа: от пина к своей шине, по шине (горизонтально,
 * только в своей зоне), затем вертикально к следующему пину.
 * Переходы «верх↔низ» пересекают ось времени строго перпендикулярно
 * и только в колонке карточки назначения.
 */
function buildPolyline(
  appearanceIds: string[],
  charId: string,
  rects: Map<string, CardRect>,
  pins: Map<string, Map<string, Point>>,
  lanes: Map<string, { top: number; bottom: number }>,
): PathPoint[] | null {
  const pts: Point[] = [];
  for (const id of appearanceIds) {
    const pin = pins.get(id)?.get(charId);
    if (pin) pts.push(pin);
  }
  if (pts.length < 2) return null;

  const lane = lanes.get(charId);
  const full: PathPoint[] = [{ ...pts[0], anchor: true }];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const zone = zoneOfY(a.y);
    const laneY =
      lane?.[zone] ?? (zone === "top" ? TOP_LANES[0] : BOTTOM_LANES[0]);
    const route: Point[] = [a, { x: a.x, y: laneY }, { x: b.x, y: laneY }, b];
    for (let j = 1; j < route.length; j++) {
      full.push({ x: route[j].x, y: route[j].y, anchor: j === route.length - 1 });
    }
  }
  return full;
}

/** Убирает дублирующиеся и коллинеарные служебные точки (пины всегда сохраняются). */
function simplify(points: PathPoint[]): Point[] {
  const out: PathPoint[] = [];
  for (const p of points) {
    const prev = out.at(-1);
    if (prev && Math.abs(prev.x - p.x) < 0.01 && Math.abs(prev.y - p.y) < 0.01) {
      continue;
    }
    if (p.anchor) {
      out.push(p);
      continue;
    }
    const before = out.at(-2);
    if (prev && before && !prev.anchor) {
      const d1x = prev.x - before.x;
      const d1y = prev.y - before.y;
      const d2x = p.x - prev.x;
      const d2y = p.y - prev.y;
      if (d1x * d2y - d1y * d2x === 0) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/**
 * Скругляет 90°-повороты фасками 45° (октилинейная геометрия, как дорожки
 * печатной платы). Развороты на пинах (180°) оставляет острыми — они
 * скругляются strokeLinejoin="round" при отрисовке.
 */
function chamfer(points: Point[], len = CHAMFER): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (d1 < 1 || d2 < 1) {
      out.push(p1);
      continue;
    }
    const ux1 = (p0.x - p1.x) / d1;
    const uy1 = (p0.y - p1.y) / d1;
    const ux2 = (p2.x - p1.x) / d2;
    const uy2 = (p2.y - p1.y) / d2;
    const cross = ux1 * uy2 - uy1 * ux2;
    // Коллинеарный угол (в т.ч. разворот на пине) — не фасуем.
    if (Math.abs(cross) < 1e-6) {
      out.push(p1);
      continue;
    }
    const l = Math.min(len, d1 / 2, d2 / 2);
    out.push({ x: p1.x + ux1 * l, y: p1.y + uy1 * l });
    out.push({ x: p1.x + ux2 * l, y: p1.y + uy2 * l });
  }
  out.push(points[points.length - 1]);
  return out;
}

function segmentsOf(points: Point[]): Seg[] {
  const segs: Seg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segs.push({ a: points[i], b: points[i + 1] });
  }
  return segs;
}

/** Собственное пересечение двух отрезков (не касание концов, не коллинеарность). */
function intersectSeg(a: Seg, b: Seg): Point | null {
  const d1x = a.b.x - a.a.x;
  const d1y = a.b.y - a.a.y;
  const d2x = b.b.x - b.a.x;
  const d2y = b.b.y - b.a.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b.a.x - a.a.x) * d2y - (b.a.y - a.a.y) * d2x) / denom;
  const u = ((b.a.x - a.a.x) * d1y - (b.a.y - a.a.y) * d1x) / denom;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: a.a.x + t * d1x, y: a.a.y + t * d1y };
}

export type Bridge = {
  /** Центр пересечения. */
  x: number;
  y: number;
  /** Единичный вектор направления ВЕРХНЕЙ линии в точке пересечения. */
  dx: number;
  dy: number;
  /** Полуширина «мостика». */
  half: number;
  /** Толщина тёмного штриха под верхней линией. */
  width: number;
  /** Позиция в стеке отрисовки: строго между нижней и верхней линиями. */
  z: number;
};

export type BuiltCharacterLine = {
  id: string;
  d: string;
  orderedAppearances: string[];
};

export type BuiltLines = {
  /** Линии в порядке отрисовки (тонкие снизу, толстые сверху). */
  lines: BuiltCharacterLine[];
  /** Тёмные «мостики» в местах пересечений. */
  bridges: Bridge[];
};

function buildPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

/**
 * Собирает линии всех персонажей:
 * - пины на кромках постеров (по выводу на персонажа — как RJ-45);
 * - горизонтали только в верхней/нижней зоне (ось времени не занимается);
 * - ось пересекается только вертикально при смене стороны;
 * - 45°-фаски на поворотах;
 * - в точках пересечения рисуется тёмный «мостик» под верхней линией —
 *   нижняя линия затемняется, верхняя выглядит проходящей над ней.
 */
export function buildCharacterLines(
  characters: Array<{ id: string; appearances: string[]; lineWidth: number }>,
  orderedIds: string[],
  rects: Map<string, CardRect>,
): BuiltLines {
  // Порядок отрисовки: тонкие снизу, толстые сверху (важные герои поверх второстепенных).
  const paintOrder = [...characters].sort(
    (a, b) => a.lineWidth - b.lineWidth || a.id.localeCompare(b.id),
  );

  const appear = new Map<string, string[]>();
  for (const ch of paintOrder) {
    const ids = new Set(ch.appearances.filter((id) => rects.has(id)));
    appear.set(ch.id, orderedIds.filter((id) => ids.has(id)));
  }

  const lanes = buildLanes(paintOrder);
  const pins = buildPins(
    paintOrder.map((c) => ({ id: c.id, appearanceIds: appear.get(c.id) ?? [] })),
    rects,
  );

  const polylines: Array<{ id: string; points: Point[]; width: number }> = [];
  for (const ch of paintOrder) {
    const raw = buildPolyline(appear.get(ch.id) ?? [], ch.id, rects, pins, lanes);
    if (!raw) continue;
    const pts = chamfer(simplify(raw));
    if (pts.length >= 2) {
      polylines.push({ id: ch.id, points: pts, width: ch.lineWidth });
    }
  }

  const linesWithSegs = polylines.map((p) => ({
    id: p.id,
    width: p.width,
    segs: segmentsOf(p.points),
  }));

  // Точка пересечения позади карточки (SVG лежит под карточками) —
  // мостик там невидим, пропускаем.
  const cardRects = [...rects.values()];
  const isBehindCard = (p: Point) =>
    cardRects.some(
      (r) =>
        p.x >= r.x - 2 &&
        p.x <= r.x + CARD_WIDTH + 2 &&
        p.y >= r.y - 2 &&
        p.y <= r.y + CARD_HEIGHT + 2,
    );

  // Мостик рисуем только там, где хотя бы один из пересекающихся сегментов
  // пересекает ось времени (значимый переход «верх↔низ»). Локальные стыки
  // «вертикаль у пина × шина» не затеняем — их много, и они читаются через
  // порядок отрисовки.
  const crossesAxis = (s: Seg) =>
    (s.a.y < TIMELINE_Y && s.b.y > TIMELINE_Y) ||
    (s.a.y > TIMELINE_Y && s.b.y < TIMELINE_Y);

  // Ищем пересечения попарно; верхняя линия (позже в порядке отрисовки)
  // получает «мостик», который затемняет нижнюю.
  const bridges: Bridge[] = [];
  for (let i = 0; i < linesWithSegs.length; i++) {
    for (let j = i + 1; j < linesWithSegs.length; j++) {
      for (const sa of linesWithSegs[i].segs) {
        for (const sb of linesWithSegs[j].segs) {
          const p = intersectSeg(sa, sb);
          if (!p) continue;
          // Только значимые пересечения длинных сегментов.
          const la = Math.hypot(sa.b.x - sa.a.x, sa.b.y - sa.a.y);
          const lb = Math.hypot(sb.b.x - sb.a.x, sb.b.y - sb.a.y);
          if (la < MIN_CROSS_LEN || lb < MIN_CROSS_LEN) continue;
          if (!crossesAxis(sa) && !crossesAxis(sb)) continue;
          // Невидимые пересечения за карточками не затеняем.
          if (isBehindCard(p)) continue;
          // Направление верхней (j) линии.
          const dx = sb.b.x - sb.a.x;
          const dy = sb.b.y - sb.a.y;
          const len = Math.hypot(dx, dy) || 1;
          const upperWidth = linesWithSegs[j].width * 1.7;
          bridges.push({
            x: p.x,
            y: p.y,
            dx: dx / len,
            dy: dy / len,
            width: Math.max(6, upperWidth + 5),
            half: Math.max(8, upperWidth / 2 + 4),
            z: i + 0.5,
          });
        }
      }
    }
  }

  const lines: BuiltCharacterLine[] = polylines.map((p) => ({
    id: p.id,
    d: buildPath(p.points),
    orderedAppearances: appear.get(p.id) ?? [],
  }));

  return { lines, bridges };
}