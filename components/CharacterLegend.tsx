"use client";

import { useState } from "react";
import type { Character } from "@/data/types";

type Props = {
  characters: Character[];
  selectedId: string | null;
  hiddenIds: string[];
  onSelect: (id: string | null) => void;
};

export function CharacterLegend({ characters, selectedId, hiddenIds, onSelect }: Props) {
  const [open, setOpen] = useState(true);
  const hidden = new Set(hiddenIds);
  const visible = characters.filter((c) => !hidden.has(c.id) && c.lineWidth >= 3);

  return (
    <nav
      className={`character-legend ${open ? "" : "collapsed"}`}
      aria-label="Легенда персонажей"
    >
      <button
        type="button"
        className="legend-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Свернуть список персонажей" : "Развернуть список персонажей"}
      >
        <span className="toolbox-title">ПЕРСОНАЖИ</span>
        <span className="legend-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <ul>
          {visible.map((ch) => (
            <li key={ch.id}>
              <button
                type="button"
                className={selectedId === ch.id ? "active" : ""}
                onClick={() => onSelect(selectedId === ch.id ? null : ch.id)}
                aria-pressed={selectedId === ch.id}
                aria-label={`Выделить ${ch.name}`}
              >
                <i style={{ background: ch.color }} />
                <span>{ch.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}