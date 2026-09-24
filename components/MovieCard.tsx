"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { CardGlow, type GlowLayer } from "@/components/CardGlow";
import { POSTER_WIDTH, POSTER_HEIGHT } from "@/lib/layout";
import type { BoardItem } from "@/lib/boardData";

type PosterProps = {
  title: string;
  original: string;
  src: string;
};

function Poster({ title, original, src }: PosterProps) {
  const [broken, setBroken] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  // Корректировка состояния при смене пропа без useEffect
  // (официальный паттерн React; позволяет избежать каскадного рендера).
  if (prevSrc !== src) {
    setPrevSrc(src);
    setBroken(false);
  }

  if (broken || !src) {
    return (
      <span className="poster-fallback" aria-label={`Постер «${title}»`}>
        <b>{original.split(" ").slice(0, 2).map((word) => word[0]).join("")}</b>
        <small>MARVEL STUDIOS</small>
      </span>
    );
  }
  return (
    // Постеры — локальные статические JPG в /public/posters; next/image
    // не применяется намеренно: нужен мгновенный fallback при отсутствии файла.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Постер «${title}»`}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

type MovieCardProps = {
  item: BoardItem;
  /** 1-based position on the board */
  order: number;
  x: number;
  y: number;
  above: boolean;
  /** TIMELINE_Y − y: смещение точки/коннектора от верхней границы карточки до временной оси */
  axisOffset: number;
  phaseColor: string;
  /** true when card should be visually dimmed (search miss or character dimming) */
  dimmed: boolean;
  /** true when this card is part of the selected character's path (grows slightly) */
  highlighted: boolean;
  isWatched: boolean;
  announced: boolean;
  editorSelected: boolean;
  glowLayers: GlowLayer[];
  caption: string;
  link: string | undefined;
  posterSrc: string;
  copying: boolean;
  suppressPosterClickRef: { current: boolean };
  onToggleWatched: (id: string) => void;
  onCopy: (movie: { id: string; title: string; year: number }) => void;
  onSelectMedia: (id: string) => void;
};

function MovieCardInner({
  item,
  order,
  x,
  y,
  above,
  axisOffset,
  phaseColor,
  dimmed,
  highlighted,
  isWatched,
  announced,
  editorSelected,
  glowLayers,
  caption,
  link,
  posterSrc,
  copying,
  suppressPosterClickRef,
  onToggleWatched,
  onCopy,
  onSelectMedia,
}: MovieCardProps) {
  return (
    <motion.article
      className={`movie-node ${above ? "above" : "below"} ${dimmed ? "muted" : "matched"
        } ${isWatched ? "watched" : ""} ${announced ? "announced" : ""} ${editorSelected ? "editor-selected" : ""
        } ${highlighted ? "character-highlight" : ""}`}
      initial={false}
      animate={{ left: x, top: y }}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
      style={
        {
          "--phase": phaseColor,
          "--axis-offset": `${axisOffset}px`,
        } as React.CSSProperties
      }
      onClick={() => onSelectMedia(item.id)}
    >
      <span className="connector" />
      <span className="timeline-dot">
        <i />
      </span>
      <div className="movie-order">{String(order).padStart(2, "0")}</div>
      <div className="poster-shell">
        <CardGlow
          layers={glowLayers}
          x={0}
          y={0}
          width={POSTER_WIDTH}
          height={POSTER_HEIGHT}
          dimmed={dimmed}
          selectedCharacter={highlighted}
        />
        {link ? (
          <a
            className="poster-link"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onClick={(event) => {
              if (!suppressPosterClickRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressPosterClickRef.current = false;
            }}
            aria-label={`Открыть страницу «${item.title}» на SSpoisk`}
          >
            <Poster title={item.title} original={item.original} src={posterSrc} />
            <span className="play-orbit">
              <b>▶</b>
            </span>
          </a>
        ) : (
          <div className="poster-link poster-link-static" aria-label={`Постер «${item.title}»`}>
            <Poster title={item.title} original={item.original} src={posterSrc} />
          </div>
        )}
        <label
          className="watched-control"
          title={isWatched ? "Отмечено как просмотренное" : "Отметить как просмотренное"}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isWatched}
            onChange={() => onToggleWatched(item.id)}
          />
          <i aria-hidden="true">✓</i>
          <span>{isWatched ? "Просмотрено" : "Отметить просмотренным"}</span>
        </label>
      </div>
      <div className="movie-copy">
        <span>{caption}</span>
        <h3>{item.title}</h3>
        <p>{item.original}</p>
        {link && (
          <button
            className="copy-watch-button"
            type="button"
            disabled={copying}
            onClick={() =>
              onCopy({
                id: item.id,
                title: item.title,
                year: item.year,
              })
            }
            aria-label={`Скопировать текст и постер «${item.title}»`}
            title={copying ? "Готовим постер…" : "Скопировать текст и постер"}
          >
            <span className="copy-glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="8" y="8" width="11" height="11" rx="2" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </motion.article>
  );
}

export const MovieCard = memo(MovieCardInner);