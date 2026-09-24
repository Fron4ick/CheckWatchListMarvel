import type { TimelineMode } from "@/data/types";
import type { BoardItem } from "./boardData";

export const CARD_WIDTH = 184;
export const CARD_HEIGHT = 390;
export const POSTER_WIDTH = 172;
export const POSTER_HEIGHT = 250;
export const COLUMN_GAP = 266;
export const TIMELINE_Y = 980;
export const LAYOUT_START_X = 520;
export const WORLD_HEIGHT = 2500;

/** Расстояние от центра постера до временной оси (симметрично сверху/снизу). */
export const CARD_DIST_MIN = 330;
export const CARD_DIST_MAX = 360;

export type CardRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Center of poster for line anchors */
  cx: number;
  cy: number;
};

/** Count "weight" of a card: how many notable characters pass through it. */
function characterWeight(item: BoardItem): number {
  const roles = item.media.characters ?? [];
  const main = roles.filter(
    (a) => a.role === "main" || a.role === "supporting",
  ).length;
  // Also count characters that list this project as an appearance but were
  // not explicitly marked in media.characters (derived by hydrateMediaCharacters).
  const derived = new Set(
    roles
      .map((a) => a.characterId)
      .filter((id) => id),
  ).size;
  return Math.max(main, derived);
}

/**
 * Vertical position of a card: poster center sits at a symmetric distance
 * (CARD_DIST_MIN..CARD_DIST_MAX) above/below the timeline, so neither row
 * hangs far away from the axis. Cards with many passing character lines sit
 * a bit closer to the axis.
 */
export function getItemY(item: BoardItem, index: number) {
  const weight = characterWeight(item);
  const t = Math.min(1, Math.max(0, (weight - 1) / 5));
  const dist = Math.round(CARD_DIST_MAX - t * (CARD_DIST_MAX - CARD_DIST_MIN));
  const halfPoster = POSTER_HEIGHT / 2;
  return index % 2 === 0
    ? TIMELINE_Y - dist - halfPoster
    : TIMELINE_Y + dist - halfPoster;
}

export function sortItems(items: BoardItem[], mode: TimelineMode): BoardItem[] {
  const copy = [...items];
  if (mode === "release") {
    copy.sort((a, b) => {
      const d = a.media.releaseDate.localeCompare(b.media.releaseDate);
      return d !== 0 ? d : a.title.localeCompare(b.title, "ru");
    });
  } else {
    copy.sort((a, b) => {
      const d = a.media.chronoOrder - b.media.chronoOrder;
      return d !== 0 ? d : a.media.releaseDate.localeCompare(b.media.releaseDate);
    });
  }
  return copy;
}

export function getItemX(index: number) {
  return LAYOUT_START_X + index * COLUMN_GAP;
}

export function worldWidthForCount(count: number) {
  return Math.max(11000, LAYOUT_START_X + Math.max(count - 1, 0) * COLUMN_GAP + 800);
}

export function buildCardRects(ordered: BoardItem[]): Map<string, CardRect> {
  const map = new Map<string, CardRect>();
  ordered.forEach((item, index) => {
    const x = getItemX(index);
    const y = getItemY(item, index);
    map.set(item.id, {
      id: item.id,
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cx: x + POSTER_WIDTH / 2,
      cy: y + POSTER_HEIGHT / 2,
    });
  });
  return map;
}

export function formatCardCaption(item: BoardItem, mode: TimelineMode, phaseLabel?: string) {
  if (mode === "chronology") {
    const end = item.media.inUniverseEnd ? `–${item.media.inUniverseEnd}` : "";
    return `${item.media.inUniverseStart}${end}`;
  }
  const phase = phaseLabel ? ` · ${phaseLabel}` : "";
  return `${item.year}${phase}`;
}