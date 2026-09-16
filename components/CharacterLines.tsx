"use client";

import { memo, useMemo } from "react";
import type { Character } from "@/data/types";
import type { CardRect } from "@/lib/layout";
import { routeCharacterPath } from "@/lib/routing";

type Props = {
  characters: Character[];
  orderedIds: string[];
  rects: Map<string, CardRect>;
  hiddenIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

function CharacterLinesInner({
  characters,
  orderedIds,
  rects,
  hiddenIds,
  selectedId,
  onSelect,
}: Props) {
  const paths = useMemo(() => {
    const hidden = new Set(hiddenIds);
    return characters
      .filter((c) => !hidden.has(c.id) && c.lineWidth >= 2)
      .map((character) => {
        const appearanceIds = character.appearances.filter((id) => rects.has(id));
        // Keep board order for path direction
        const orderedAppearances = orderedIds.filter((id) =>
          appearanceIds.includes(id),
        );
        const d = routeCharacterPath(orderedAppearances, rects, orderedIds);
        return { character, d, orderedAppearances };
      })
      .filter((p) => p.d);
  }, [characters, orderedIds, rects, hiddenIds]);

  return (
    <svg
      className="character-lines-layer"
      width="100%"
      height="100%"
      aria-hidden={false}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      {paths.map(({ character, d }) => {
        const isSelected = selectedId === character.id;
        const dimmed = selectedId !== null && !isSelected;
        const width = Math.max(1.5, character.lineWidth * 0.85);
        return (
          <g key={character.id}>
            {/* Wider invisible hit area */}
            <path
              d={d!}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(14, width + 10)}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isSelected ? null : character.id);
              }}
              aria-label={`Линия персонажа ${character.name}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(isSelected ? null : character.id);
                }
              }}
            />
            <path
              d={d!}
              fill="none"
              stroke={character.color}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={dimmed ? 0.08 : isSelected ? 1 : 0.72}
              style={{ pointerEvents: "none", transition: "opacity .25s ease" }}
              filter={isSelected ? `drop-shadow(0 0 6px ${character.color})` : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}

export const CharacterLines = memo(CharacterLinesInner);
