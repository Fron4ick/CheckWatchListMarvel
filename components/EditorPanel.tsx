"use client";

import { useRef } from "react";
import type { Character, EditorOverrides, Media, MediaGroup, CanonStatus, RoleType } from "@/data/types";
import type { BoardItem } from "@/lib/boardData";

type Props = {
  open: boolean;
  overrides: EditorOverrides;
  onChange: (next: EditorOverrides) => void;
  characters: Character[];
  items: BoardItem[];
  selectedMediaId: string | null;
  onToast: (msg: string) => void;
};

const ROLES: RoleType[] = ["main", "supporting", "cameo", "voice", "mention", "archive_footage"];

export function EditorPanel({
  open,
  overrides,
  onChange,
  characters,
  items,
  selectedMediaId,
  onToast,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const mediaId = selectedMediaId ?? items[0]?.id ?? "";
  const mediaItem = items.find((i) => i.id === mediaId);

  if (!open) return null;

  const setPoster = (id: string, dataUrl: string | null) => {
    const posterOverrides = { ...overrides.posterOverrides };
    if (dataUrl) posterOverrides[id] = dataUrl;
    else delete posterOverrides[id];
    onChange({ ...overrides, posterOverrides });
  };

  const patchCharacter = (id: string, patch: Partial<Character>) => {
    onChange({
      ...overrides,
      characters: {
        ...overrides.characters,
        [id]: { ...overrides.characters[id], ...patch },
      },
    });
  };

  const toggleAppearance = (characterId: string, projectId: string, role: RoleType = "supporting") => {
    const ch = characters.find((c) => c.id === characterId);
    if (!ch) return;
    const has = ch.appearances.includes(projectId);
    const appearances = has
      ? ch.appearances.filter((id) => id !== projectId)
      : [...ch.appearances, projectId];
    const baseChars = mediaItem?.media.characters ?? [];
    const nextChars = has
      ? baseChars.filter((a) => a.characterId !== characterId)
      : [...baseChars.filter((a) => a.characterId !== characterId), { characterId, role }];
    onChange({
      ...overrides,
      characters: {
        ...overrides.characters,
        [characterId]: { ...overrides.characters[characterId], appearances },
      },
      media: {
        ...overrides.media,
        [projectId]: {
          ...overrides.media[projectId],
          characters: nextChars,
        },
      },
    });
  };

  const addCharacter = () => {
    const id = `custom-${Date.now()}`;
    const neu: Character = {
      id,
      name: "Новый персонаж",
      actors: [{ actor: "TODO", period: "—" }],
      appearances: [],
      biography: "TODO: краткая биография",
      color: "#888888",
      lineWidth: 3,
    };
    onChange({
      ...overrides,
      customCharacters: [...overrides.customCharacters, neu],
    });
    onToast("Персонаж добавлен");
  };

  const addMedia = () => {
    const id = `custom-media-${Date.now()}`;
    const neu: Media = {
      id,
      type: "film",
      title: "Новый проект",
      originalTitle: "New Project",
      group: "Мультивселенная" as MediaGroup,
      canonStatus: "announced" as CanonStatus,
      releaseDate: "2027-01-01",
      inUniverseStart: "2027",
      phase: 6,
      characters: [],
      chronoOrder: 9600,
    };
    onChange({
      ...overrides,
      customMedia: [...overrides.customMedia, neu],
    });
    onToast("Проект добавлен");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marvel-timeline-editor.json";
    a.click();
    URL.revokeObjectURL(url);
    onToast("Экспорт готов");
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as EditorOverrides;
      onChange({ ...overrides, ...data, filters: data.filters ?? overrides.filters });
      onToast("Импорт выполнен");
    } catch {
      onToast("Не удалось импортировать JSON");
    }
  };

  const onPosterFile = async (file: File) => {
    if (!mediaId) return;
    const reader = new FileReader();
    reader.onload = () => setPoster(mediaId, String(reader.result));
    reader.readAsDataURL(file);
    onToast("Постер обновлён");
  };

  return (
    <aside className="editor-panel" aria-label="Редактор данных">
      <header>
        <h2>Редактор</h2>
        <div className="editor-actions">
          <button type="button" onClick={exportJson}>Экспорт JSON</button>
          <button type="button" onClick={() => importRef.current?.click()}>Импорт</button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
            }}
          />
        </div>
      </header>

      <section>
        <h3>Постер проекта</h3>
        <p className="editor-hint">Выберите карточку на карте или используйте текущий id.</p>
        <code>{mediaId || "—"}</code>
        <div className="editor-row">
          <button type="button" onClick={() => fileRef.current?.click()}>Загрузить постер</button>
          <button type="button" onClick={() => mediaId && setPoster(mediaId, null)}>Сбросить</button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPosterFile(f);
            }}
          />
        </div>
      </section>

      <section>
        <h3>Цвет и толщина линий</h3>
        <div className="editor-char-list">
          {characters.slice(0, 60).map((ch) => (
            <div key={ch.id} className="editor-char-row">
              <span>{ch.name}</span>
              <input
                type="color"
                value={ch.color}
                aria-label={`Цвет ${ch.name}`}
                onChange={(e) => patchCharacter(ch.id, { color: e.target.value })}
              />
              <input
                type="range"
                min={1}
                max={10}
                value={ch.lineWidth}
                aria-label={`Толщина ${ch.name}`}
                onChange={(e) => patchCharacter(ch.id, { lineWidth: Number(e.target.value) })}
              />
              <label className="ctrl-check">
                <input
                  type="checkbox"
                  checked={!overrides.hiddenCharacterLines.includes(ch.id)}
                  onChange={() => {
                    const hidden = overrides.hiddenCharacterLines.includes(ch.id)
                      ? overrides.hiddenCharacterLines.filter((id) => id !== ch.id)
                      : [...overrides.hiddenCharacterLines, ch.id];
                    onChange({ ...overrides, hiddenCharacterLines: hidden });
                  }}
                />
                линия
              </label>
            </div>
          ))}
        </div>
      </section>

      {mediaId && (
        <section>
          <h3>Участие в «{mediaItem?.title ?? mediaId}»</h3>
          <div className="editor-char-list">
            {characters.map((ch) => {
              const on = ch.appearances.includes(mediaId);
              return (
                <label key={ch.id} className="editor-appear-row">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleAppearance(ch.id, mediaId)}
                  />
                  <span>{ch.name}</span>
                  {on && (
                    <select
                      aria-label={`Роль ${ch.name}`}
                      defaultValue="supporting"
                      onChange={(e) => {
                        const role = e.target.value as RoleType;
                        const nextChars = [
                          ...(overrides.media[mediaId]?.characters ??
                            mediaItem?.media.characters ??
                            []),
                        ].filter((a) => a.characterId !== ch.id);
                        nextChars.push({ characterId: ch.id, role });
                        onChange({
                          ...overrides,
                          media: {
                            ...overrides.media,
                            [mediaId]: { ...overrides.media[mediaId], characters: nextChars },
                          },
                        });
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className="editor-row">
        <button type="button" onClick={addCharacter}>+ Персонаж</button>
        <button type="button" onClick={addMedia}>+ Проект</button>
      </section>
    </aside>
  );
}
