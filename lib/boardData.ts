import type { Character, EditorOverrides, Media, MediaGroup, MediaType, CanonStatus, PhaseId } from "@/data/types";
import { MEDIA } from "@/data/media";
import { CHARACTERS } from "@/data/characters";

export const EDITOR_STORAGE_KEY = "marvel-timeline-board-editor-v1";

export const DEFAULT_FILTERS: EditorOverrides["filters"] = {
  groups: [
    "Сага Бесконечности",
    "Мультивселенная",
    "Спецвыпуски и короткометражки",
  ],
  phases: [1, 2, 3, 4, 5, 6],
  types: ["film", "series", "special", "short", "animated-series"],
  canon: ["sacred_timeline", "conditionally_canonical", "separate_universe", "announced"],
};

export const EMPTY_OVERRIDES: EditorOverrides = {
  media: {},
  characters: {},
  customMedia: [],
  customCharacters: [],
  posterOverrides: {},
  hiddenCharacterLines: [],
  filters: DEFAULT_FILTERS,
};

export type BoardMovieCompat = {
  id: string;
  title: string;
  original: string;
  year: number;
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  wiki: string;
};

export type BoardItem = {
  id: string;
  title: string;
  original: string;
  year: number;
  phase: PhaseId;
  wiki?: string;
  media: Media;
  /** Compatibility with existing Movie helpers */
  movieCompat: BoardMovieCompat | null;
};

function yearFromIso(iso: string): number {
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : 2008;
}

function applyMediaOverrides(base: Media, overrides: EditorOverrides): Media {
  const patch = overrides.media[base.id];
  const posterPath = overrides.posterOverrides[base.id] ?? patch?.posterPath ?? base.posterPath;
  return { ...base, ...patch, posterPath, id: base.id };
}

function applyCharacterOverrides(base: Character, overrides: EditorOverrides): Character {
  const patch = overrides.characters[base.id];
  return patch ? { ...base, ...patch, id: base.id } : base;
}

/** Derive media.characters from character.appearances / mentions */
export function hydrateMediaCharacters(media: Media[], characters: Character[]): Media[] {
  const byMedia = new Map<string, Media["characters"]>();
  for (const ch of characters) {
    for (const mediaId of ch.appearances) {
      const list = byMedia.get(mediaId) ?? [];
      const role =
        ch.lineWidth >= 7 ? "main" : ch.lineWidth >= 4 ? "supporting" : "cameo";
      if (!list.some((a) => a.characterId === ch.id)) {
        list.push({ characterId: ch.id, role });
      }
      byMedia.set(mediaId, list);
    }
    for (const mediaId of ch.mentions ?? []) {
      const list = byMedia.get(mediaId) ?? [];
      if (!list.some((a) => a.characterId === ch.id)) {
        list.push({ characterId: ch.id, role: "mention" });
      }
      byMedia.set(mediaId, list);
    }
  }
  return media.map((m) => {
    const derived = byMedia.get(m.id);
    if (!derived?.length) return m;
    // Prefer explicit media.characters if already filled by editor
    if (m.characters.length > 0) return m;
    return { ...m, characters: derived };
  });
}

export function buildBoardData(
  movies: BoardMovieCompat[],
  overrides: EditorOverrides,
): { items: BoardItem[]; characters: Character[]; media: Media[] } {
  const movieById = new Map(movies.map((m) => [m.id, m]));
  const baseMedia = [...MEDIA, ...overrides.customMedia].map((m) =>
    applyMediaOverrides(m, overrides),
  );
  const characters = [...CHARACTERS, ...overrides.customCharacters].map((c) =>
    applyCharacterOverrides(c, overrides),
  );
  const media = hydrateMediaCharacters(baseMedia, characters);

  const items: BoardItem[] = media.map((m) => {
    const movie = movieById.get(m.id);
    return {
      id: m.id,
      title: m.title,
      original: m.originalTitle ?? movie?.original ?? m.title,
      year: movie?.year ?? yearFromIso(m.releaseDate),
      phase: m.phase ?? movie?.phase ?? null,
      wiki: movie?.wiki,
      media: m,
      movieCompat: movie
        ? movie
        : m.phase
          ? {
            id: m.id,
            title: m.title,
            original: m.originalTitle ?? m.title,
            year: yearFromIso(m.releaseDate),
            phase: m.phase,
            wiki: "",
          }
          : null,
    };
  });

  return { items, characters, media };
}

export function filterBoardItems(
  items: BoardItem[],
  filters: EditorOverrides["filters"],
): BoardItem[] {
  return items.filter((item) => {
    const m = item.media;
    if (!filters.groups.includes(m.group as MediaGroup)) return false;
    if (!filters.types.includes(m.type as MediaType)) return false;
    if (!filters.canon.includes(m.canonStatus as CanonStatus)) return false;
    if (m.phase !== null && !filters.phases.includes(m.phase)) return false;
    // phase null items (TV/shorts): allow if their group/type/canon pass
    return true;
  });
}

export function loadEditorOverrides(): EditorOverrides {
  if (typeof window === "undefined") return EMPTY_OVERRIDES;
  try {
    const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (!raw) return EMPTY_OVERRIDES;
    const parsed = JSON.parse(raw) as Partial<EditorOverrides>;
    return {
      ...EMPTY_OVERRIDES,
      ...parsed,
      filters: { ...DEFAULT_FILTERS, ...parsed.filters },
      media: parsed.media ?? {},
      characters: parsed.characters ?? {},
      customMedia: parsed.customMedia ?? [],
      customCharacters: parsed.customCharacters ?? [],
      posterOverrides: parsed.posterOverrides ?? {},
      hiddenCharacterLines: parsed.hiddenCharacterLines ?? [],
    };
  } catch {
    return EMPTY_OVERRIDES;
  }
}

export function saveEditorOverrides(overrides: EditorOverrides) {
  localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(overrides));
}
