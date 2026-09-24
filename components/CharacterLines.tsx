"use client";

import { memo, useMemo, type ReactNode } from "react";
import type { Character } from "@/data/types";
import type { CardRect } from "@/lib/layout";
import { buildCharacterLines } from "@/lib/routing";

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
  const built = useMemo(() => {
    const hidden = new Set(hiddenIds);
    const visible = characters.filter(
      (c) => !hidden.has(c.id) && c.lineWidth >= 2,
    );
    return buildCharacterLines(
      visible.map((c) => ({
        id: c.id,
        appearances: c.appearances,
        lineWidth: c.lineWidth,
      })),
      orderedIds,
      rects,
    );
  }, [characters, orderedIds, rects, hiddenIds]);

  const renderItems = useMemo(() => {
    const charById = new Map(characters.map((c) => [c.id, c]));
    const items: Array<{ z: number; node: ReactNode }> = [];

    // Линии: тонкие ниже, толстые выше (z = индекс в built.lines).
    built.lines.forEach((line, z) => {
      const character = charById.get(line.id);
      if (!character) return;
      const isSelected = selectedId === line.id;
      const dimmed = selectedId !== null && !isSelected;
      // Удвоенная толщина линии по запросу пользователя.
      const width = Math.max(3, character.lineWidth * 1.7);
      items.push({
        z,
        node: (
          <g key={line.id}>
            {/* Расширенная невидимая зона клика */}
            <path
              d={line.d}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(18, width + 12)}
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
              d={line.d}
              fill="none"
              stroke={character.color}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={dimmed ? 0.08 : isSelected ? 1 : 0.72}
              style={{ pointerEvents: "none", transition: "opacity .25s ease" }}
              filter={
                isSelected ? `drop-shadow(0 0 6px ${character.color})` : undefined
              }
            />
          </g>
        ),
      });
    });

    // Тёмные «мостики» на пересечениях: кладём строго между нижней и верхней линиями.
    built.bridges.forEach((bridge, k) => {
      items.push({
        z: bridge.z,
        node: (
          <path
            key={`bridge-${k}`}
            d={`M ${bridge.x - bridge.dx * bridge.half} ${bridge.y - bridge.dy * bridge.half} L ${bridge.x + bridge.dx * bridge.half} ${bridge.y + bridge.dy * bridge.half}`}
            fill="none"
            stroke="rgba(4, 7, 14, 0.92)"
            strokeWidth={bridge.width}
            strokeLinecap="round"
            style={{ pointerEvents: "none" }}
          />
        ),
      });
    });

    return items.sort((a, b) => a.z - b.z);
  }, [built, characters, selectedId, onSelect]);

  return (
    <svg
      className="character-lines-layer"
      width="100%"
      height="100%"
      aria-hidden={false}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      {renderItems.map((item) => item.node)}
    </svg>
  );
}

export const CharacterLines = memo(CharacterLinesInner);