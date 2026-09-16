export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6 | null;

export type MediaType = "film" | "series" | "special" | "short" | "animated-series";

export type CanonStatus =
  | "sacred_timeline"
  | "conditionally_canonical"
  | "separate_universe"
  | "announced";

export type RoleType =
  | "main"
  | "supporting"
  | "cameo"
  | "voice"
  | "mention"
  | "archive_footage";

export type MediaGroup =
  | "Сага Бесконечности"
  | "Мультивселенная"
  | "Marvel Television"
  | "Анимация"
  | "Спецвыпуски и короткометражки";

export type RelationshipType =
  | "союзник"
  | "враг"
  | "семья"
  | "романтические отношения"
  | "наставник"
  | "ученик";

export type MediaAppearance = {
  characterId: string;
  role: RoleType;
};

export type Media = {
  id: string;
  type: MediaType;
  title: string;
  originalTitle?: string;
  group: MediaGroup;
  canonStatus: CanonStatus;
  releaseDate: string;
  inUniverseStart: string;
  inUniverseEnd?: string;
  phase: PhaseId;
  sspoiskId?: string;
  posterPath?: string;
  characters: MediaAppearance[];
  notes?: string;
  director?: string;
  seasons?: number;
  episodes?: number;
  network?: string;
  /** Sort key for chronological mode; lower = earlier. Special: 9000+ = outside normal time */
  chronoOrder: number;
};

export type Character = {
  id: string;
  name: string;
  fullName?: string;
  actors: Array<{ actor: string; period: string }>;
  aliases?: string[];
  birthDate?: string;
  deathDate?: string | null;
  deathMediaId?: string | null;
  group?: string;
  appearances: string[];
  mentions?: string[];
  relationships?: Array<{
    targetId: string;
    type: RelationshipType;
    note?: string;
  }>;
  biography: string;
  color: string;
  lineWidth: number;
};

export type TimelineMode = "release" | "chronology";

export type EditorOverrides = {
  media: Record<string, Partial<Media>>;
  characters: Record<string, Partial<Character>>;
  customMedia: Media[];
  customCharacters: Character[];
  posterOverrides: Record<string, string>;
  hiddenCharacterLines: string[];
  filters: {
    groups: MediaGroup[];
    phases: Array<1 | 2 | 3 | 4 | 5 | 6>;
    types: MediaType[];
    canon: CanonStatus[];
  };
};
