"use client";

import type { CanonStatus, MediaGroup, MediaType, TimelineMode } from "@/data/types";
import type { EditorOverrides } from "@/data/types";

const ALL_GROUPS: MediaGroup[] = [
  "Сага Бесконечности",
  "Мультивселенная",
  "Marvel Television",
  "Анимация",
  "Спецвыпуски и короткометражки",
];

const ALL_TYPES: { id: MediaType; label: string }[] = [
  { id: "film", label: "Фильмы" },
  { id: "series", label: "Сериалы" },
  { id: "animated-series", label: "Анимация" },
  { id: "special", label: "Спецвыпуски" },
  { id: "short", label: "Короткометражки" },
];

const ALL_CANON: { id: CanonStatus; label: string }[] = [
  { id: "sacred_timeline", label: "Sacred Timeline" },
  { id: "conditionally_canonical", label: "Условно-канон" },
  { id: "separate_universe", label: "Отд. вселенная" },
  { id: "announced", label: "Анонсы" },
];

type Props = {
  mode: TimelineMode;
  onModeChange: (mode: TimelineMode) => void;
  filters: EditorOverrides["filters"];
  onFiltersChange: (filters: EditorOverrides["filters"]) => void;
  editMode: boolean;
  onEditModeChange: (v: boolean) => void;
  linesVisible: boolean;
  onLinesVisibleChange: (v: boolean) => void;
};

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function MapControls({
  mode,
  onModeChange,
  filters,
  onFiltersChange,
  editMode,
  onEditModeChange,
  linesVisible,
  onLinesVisibleChange,
}: Props) {
  return (
    <div className="map-controls" aria-label="Управление картой">
      <div className="mode-toggle" role="group" aria-label="Режим хронологии">
        <button
          type="button"
          className={mode === "release" ? "active" : ""}
          onClick={() => onModeChange("release")}
        >
          По датам выхода
        </button>
        <button
          type="button"
          className={mode === "chronology" ? "active" : ""}
          onClick={() => onModeChange("chronology")}
        >
          Хронологически
        </button>
      </div>

      <label className="ctrl-check">
        <input
          type="checkbox"
          checked={linesVisible}
          onChange={(e) => onLinesVisibleChange(e.target.checked)}
        />
        Линии персонажей
      </label>

      <button
        type="button"
        className={`edit-toggle ${editMode ? "active" : ""}`}
        onClick={() => onEditModeChange(!editMode)}
      >
        {editMode ? "Закрыть редактор" : "Редактор"}
      </button>

      <details className="filter-details">
        <summary>Фильтры</summary>
        <div className="filter-panel">
          <fieldset>
            <legend>Группы</legend>
            {ALL_GROUPS.map((g) => (
              <label key={g}>
                <input
                  type="checkbox"
                  checked={filters.groups.includes(g)}
                  onChange={() =>
                    onFiltersChange({ ...filters, groups: toggleIn(filters.groups, g) })
                  }
                />
                {g}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Тип</legend>
            {ALL_TYPES.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={filters.types.includes(t.id)}
                  onChange={() =>
                    onFiltersChange({ ...filters, types: toggleIn(filters.types, t.id) })
                  }
                />
                {t.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Канон</legend>
            {ALL_CANON.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={filters.canon.includes(c.id)}
                  onChange={() =>
                    onFiltersChange({ ...filters, canon: toggleIn(filters.canon, c.id) })
                  }
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Фазы</legend>
            {([1, 2, 3, 4, 5, 6] as const).map((p) => (
              <label key={p}>
                <input
                  type="checkbox"
                  checked={filters.phases.includes(p)}
                  onChange={() =>
                    onFiltersChange({ ...filters, phases: toggleIn(filters.phases, p) })
                  }
                />
                Фаза {p}
              </label>
            ))}
          </fieldset>
        </div>
      </details>
    </div>
  );
}
