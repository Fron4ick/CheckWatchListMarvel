"use client";

import { memo } from "react";

export type GlowLayer = {
  color: string;
  width: number;
};

type Props = {
  layers: GlowLayer[];
  /** Poster area (not the whole card) */
  x: number;
  y: number;
  width: number;
  height: number;
  dimmed: boolean;
  selectedCharacter: boolean;
};

/**
 * Renders true concentric "rings" around a poster, one per character layer,
 * instead of stacking box-shadows on top of each other.
 * SVG circles/rects with stroke produce a clear radial layering.
 */
function CardGlowInner({ layers, x, y, width, height, dimmed, selectedCharacter }: Props) {
  if (!layers.length) return null;

  const rx = 14;
  const ry = 14;
  const cx = x + width / 2;
  const cy = y + height / 2;
  // Base rect is the poster; rings expand outward
  const baseW = width;
  const baseH = height;

  return (
    <svg
      className="card-glow"
      width={width + 120}
      height={height + 120}
      style={{
        position: "absolute",
        left: x,
        top: y,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      {layers.map((layer, i) => {
        const inset = i * 7 + 4; // each layer sits further out
        const w = baseW + inset * 2;
        const h = baseH + inset * 2;
        const opacity = dimmed ? 0.05 : selectedCharacter ? 1 : 0.75;
        const strokeWidth = Math.max(3, layer.width * 0.9);
        return (
          <rect
            key={i}
            x={cx - w / 2}
            y={cy - h / 2}
            width={w}
            height={h}
            rx={rx + inset}
            ry={ry + inset}
            fill="none"
            stroke={layer.color}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}

export const CardGlow = memo(CardGlowInner);