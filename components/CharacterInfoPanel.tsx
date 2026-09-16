"use client";

import type { Character } from "@/data/types";
import type { BoardItem } from "@/lib/boardData";

type Props = {
  character: Character;
  itemsById: Map<string, BoardItem>;
  onClose: () => void;
};

export function CharacterInfoPanel({ character, itemsById, onClose }: Props) {
  const appearances = character.appearances
    .map((id) => itemsById.get(id))
    .filter(Boolean) as BoardItem[];

  return (
    <aside className="character-info-panel" role="dialog" aria-label={`Справка: ${character.name}`}>
      <button className="modal-close" onClick={onClose} aria-label="Закрыть справку">×</button>
      <div className="cip-swatch" style={{ background: character.color }} />
      <span className="modal-kicker">ПЕРСОНАЖ</span>
      <h2>{character.name}</h2>
      {character.fullName && <p className="cip-fullname">{character.fullName}</p>}
      <ul className="cip-actors">
        {character.actors.map((a) => (
          <li key={`${a.actor}-${a.period}`}>
            <b>{a.actor}</b> <span>{a.period}</span>
          </li>
        ))}
      </ul>
      <p className="cip-bio">{character.biography}</p>
      <div className="cip-dates">
        {character.birthDate && <span>Рождение: {character.birthDate}</span>}
        {character.deathDate && (
          <span>
            Смерть: {character.deathDate}
            {character.deathMediaId ? ` (${character.deathMediaId})` : ""}
          </span>
        )}
      </div>
      <h3>Появления</h3>
      <ol className="cip-list">
        {appearances.map((item) => (
          <li key={item.id}>
            {item.title} <small>{item.year}</small>
          </li>
        ))}
      </ol>
    </aside>
  );
}
