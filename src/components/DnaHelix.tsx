'use client';

import type { CSSProperties } from 'react';

const TAU = Math.PI * 2;
const COLUMNS = 56;
const ROWS = 42;
const CELL = 8;
const PIXEL = 5;
const PAIR_COUNT = 42;
const FRAME_COUNT = 96;
const TURNS = 1.5;
const DURATION = '12s';

const AXIS_START = { column: 7, row: 8 };
const AXIS_END = { column: 48, row: 34 };
const AXIS_DX = AXIS_END.column - AXIS_START.column;
const AXIS_DY = AXIS_END.row - AXIS_START.row;
const AXIS_LENGTH = Math.hypot(AXIS_DX, AXIS_DY);
const AXIS_UNIT = {
  column: AXIS_DX / AXIS_LENGTH,
  row: AXIS_DY / AXIS_LENGTH,
};
const PERP_UNIT = {
  column: -AXIS_UNIT.row,
  row: AXIS_UNIT.column,
};
const RADIUS_CELLS = 8;

type CellPoint = {
  column: number;
  row: number;
  opacity: number;
};

type Point = {
  x: number;
  y: number;
};

type PixelSource = {
  key: string;
  size: number;
  dnaIndex: number;
  strand?: 'a' | 'b';
  rung?: {
    step: number;
    stepCount: number;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function cubicPoint(
  start: Point,
  controlA: Point,
  controlB: Point,
  end: Point,
  amount: number,
): Point {
  const inverse = 1 - amount;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * amount * controlA.x +
      3 * inverse * amount ** 2 * controlB.x +
      amount ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * amount * controlA.y +
      3 * inverse * amount ** 2 * controlB.y +
      amount ** 3 * end.y,
  };
}

function sampleCubic(
  start: Point,
  controlA: Point,
  controlB: Point,
  end: Point,
  steps = 18,
): Point[] {
  return Array.from({ length: steps }, (_, index) =>
    cubicPoint(start, controlA, controlB, end, (index + 1) / steps),
  );
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i];
    const previous = polygon[j];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) +
          current.x;

    if (intersects) inside = !inside;
  }

  return inside;
}

function toSvgValue(value: number) {
  return (value * CELL).toFixed(1);
}

function pixelX(point: CellPoint, size: number) {
  return toSvgValue(point.column + (CELL - size) / CELL / 2);
}

function pixelY(point: CellPoint, size: number) {
  return toSvgValue(point.row + (CELL - size) / CELL / 2);
}

function values(points: CellPoint[], size: number, axis: 'x' | 'y') {
  return points
    .map((point) => (axis === 'x' ? pixelX(point, size) : pixelY(point, size)))
    .join(';');
}

function opacityValues(points: CellPoint[]) {
  return points.map((point) => point.opacity.toFixed(2)).join(';');
}

function projectDna(index: number, phase: number, strand: 'a' | 'b'): CellPoint {
  const progress = index / (PAIR_COUNT - 1);
  const axisColumn = AXIS_START.column + AXIS_DX * progress;
  const axisRow = AXIS_START.row + AXIS_DY * progress;
  const angle = progress * TURNS * TAU + phase;
  const lateral = Math.cos(angle) * RADIUS_CELLS;
  const front = (Math.sin(angle) + 1) / 2;
  const direction = strand === 'a' ? 1 : -1;
  const depth = strand === 'a' ? front : 1 - front;

  return {
    column: axisColumn + PERP_UNIT.column * lateral * direction,
    row: axisRow + PERP_UNIT.row * lateral * direction,
    opacity: 0.55 + depth * 0.45,
  };
}

function pointBetween(
  a: CellPoint,
  b: CellPoint,
  amount: number,
  opacity: number,
): CellPoint {
  return {
    column: a.column + (b.column - a.column) * amount,
    row: a.row + (b.row - a.row) * amount,
    opacity,
  };
}

function projectDnaPixel(pixel: PixelSource, phase: number): CellPoint {
  if (pixel.rung) {
    const a = projectDna(pixel.dnaIndex, phase, 'a');
    const b = projectDna(pixel.dnaIndex, phase, 'b');
    const amount = pixel.rung.step / pixel.rung.stepCount;
    const centerWeight = 1 - Math.abs(amount - 0.5) * 2;
    const pulse =
      (Math.sin((pixel.dnaIndex / PAIR_COUNT) * TURNS * TAU + phase + Math.PI / 2) + 1) /
      2;

    return pointBetween(
      a,
      b,
      amount,
      clamp(0.22 + centerWeight * 0.22 + pulse * 0.3, 0.18, 0.72),
    );
  }

  return projectDna(pixel.dnaIndex, phase, pixel.strand ?? 'a');
}

function makeDnaFrames(pixel: PixelSource) {
  return Array.from({ length: FRAME_COUNT + 1 }, (_, frame) => {
    const phase = (frame / FRAME_COUNT) * TAU;
    return projectDnaPixel(pixel, phase);
  });
}

function buildPixelSources(): PixelSource[] {
  const pixels: PixelSource[] = [];

  for (let index = 0; index < PAIR_COUNT; index += 1) {
    pixels.push({ key: `strand-a-${index}`, size: PIXEL, dnaIndex: index, strand: 'a' });
    pixels.push({ key: `strand-b-${index}`, size: PIXEL, dnaIndex: index, strand: 'b' });

    if (index % 3 === 0) {
      const stepCount = 7;
      for (let step = 1; step < stepCount; step += 1) {
        pixels.push({
          key: `rung-${index}-${step}`,
          size: PIXEL,
          dnaIndex: index,
          rung: { step, stepCount },
        });
      }
    }
  }

  return pixels;
}

// Schema Logo 形状 - 章鱼图案
const mantlePolygon = [
  { x: 50, y: 92 },
  ...sampleCubic({ x: 50, y: 92 }, { x: 40, y: 50 }, { x: 70, y: 20 }, { x: 100, y: 20 }),
  ...sampleCubic(
    { x: 100, y: 20 },
    { x: 130, y: 20 },
    { x: 160, y: 50 },
    { x: 150, y: 92 },
  ),
  ...sampleCubic(
    { x: 150, y: 92 },
    { x: 120, y: 75 },
    { x: 80, y: 75 },
    { x: 50, y: 92 },
  ),
];

const tentaclePolygon = [
  { x: 55, y: 100 },
  ...sampleCubic({ x: 55, y: 100 }, { x: 35, y: 115 }, { x: 15, y: 140 }, { x: 30, y: 155 }),
  ...sampleCubic({ x: 30, y: 155 }, { x: 45, y: 145 }, { x: 60, y: 135 }, { x: 70, y: 120 }),
  ...sampleCubic({ x: 70, y: 120 }, { x: 75, y: 140 }, { x: 75, y: 165 }, { x: 85, y: 175 }),
  ...sampleCubic({ x: 85, y: 175 }, { x: 90, y: 155 }, { x: 95, y: 130 }, { x: 100, y: 110 }),
  ...sampleCubic(
    { x: 100, y: 110 },
    { x: 105, y: 130 },
    { x: 110, y: 155 },
    { x: 115, y: 175 },
  ),
  ...sampleCubic(
    { x: 115, y: 175 },
    { x: 125, y: 165 },
    { x: 125, y: 140 },
    { x: 130, y: 120 },
  ),
  ...sampleCubic(
    { x: 130, y: 120 },
    { x: 140, y: 135 },
    { x: 155, y: 145 },
    { x: 170, y: 155 },
  ),
  ...sampleCubic(
    { x: 170, y: 155 },
    { x: 185, y: 140 },
    { x: 165, y: 115 },
    { x: 145, y: 100 },
  ),
  ...sampleCubic(
    { x: 145, y: 100 },
    { x: 120, y: 85 },
    { x: 80, y: 85 },
    { x: 55, y: 100 },
  ),
];

function toLogoSpace(column: number, row: number): Point {
  const scaledX = ((column - 9.5) / 37) * 200;
  const scaledY = ((row - 2.5) / 37) * 200;
  const angle = (-15 * Math.PI) / 180;
  const dx = scaledX - 100;
  const dy = scaledY - 100;

  return {
    x: 100 + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: 100 + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

function isInsideLogo(column: number, row: number) {
  const logoPoint = toLogoSpace(column, row);
  return pointInPolygon(logoPoint, mantlePolygon) || pointInPolygon(logoPoint, tentaclePolygon);
}

function buildOctopusTargets(count: number): CellPoint[] {
  const candidates: CellPoint[] = [];

  for (let row = 3; row <= 39; row += 1) {
    for (let column = 8; column <= 48; column += 1) {
      if (isInsideLogo(column, row)) {
        candidates.push({ column, row, opacity: 0.95 });
      }
    }
  }

  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.floor((index / count) * candidates.length);
    return candidates[sourceIndex];
  });
}

const pixelSources = buildPixelSources();
const octopusTargets = buildOctopusTargets(pixelSources.length);

export function DnaHelix() {
  return (
    <div
      className="dna-helix-container group relative w-full h-full overflow-hidden"
      role="img"
      aria-label="DNA 双螺旋动画，悬停时聚合为章鱼图案"
      tabIndex={0}
    >
      <style>{`
        .dna-helix-container .dna-layer {
          transition: opacity 720ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .dna-helix-container .octopus-pixel {
          opacity: 0;
          transform: translate(var(--from-x), var(--from-y)) scale(0.72);
          transform-box: fill-box;
          transform-origin: center;
          transition:
            transform 1050ms cubic-bezier(0.18, 0.86, 0.28, 1),
            opacity 560ms ease;
          transition-delay: var(--delay);
        }

        .dna-helix-container:hover .dna-layer,
        .dna-helix-container:focus .dna-layer,
        .dna-helix-container:focus-within .dna-layer {
          opacity: 0.08;
        }

        .dna-helix-container:hover .octopus-pixel,
        .dna-helix-container:focus .octopus-pixel,
        .dna-helix-container:focus-within .octopus-pixel {
          opacity: var(--target-opacity);
          transform: translate(0, 0) scale(1);
        }

        .dna-helix-container:not(:hover):not(:focus):not(:focus-within) .octopus-pixel {
          transition-delay: 0ms;
        }
      `}</style>
      <svg
        viewBox={`0 0 ${COLUMNS * CELL} ${ROWS * CELL}`}
        className="absolute inset-0 h-full w-full"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {/* DNA 双螺旋层 */}
        <g className="dna-layer">
          {pixelSources.map((pixel) => {
            const frames = makeDnaFrames(pixel);
            const firstFrame = frames[0];

            return (
              <rect
                key={pixel.key}
                x={pixelX(firstFrame, pixel.size)}
                y={pixelY(firstFrame, pixel.size)}
                width={pixel.size}
                height={pixel.size}
                fill="currentColor"
                opacity={firstFrame.opacity.toFixed(2)}
              >
                <animate
                  attributeName="x"
                  dur={DURATION}
                  values={values(frames, pixel.size, 'x')}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y"
                  dur={DURATION}
                  values={values(frames, pixel.size, 'y')}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  dur={DURATION}
                  values={opacityValues(frames)}
                  repeatCount="indefinite"
                />
              </rect>
            );
          })}
        </g>

        {/* 悬停时形成的章鱼图案层 */}
        <g>
          {pixelSources.map((pixel, index) => {
            const target = octopusTargets[index];
            const origin = projectDnaPixel(pixel, 0);
            const delay = 10 + (index % 18) * 18;
            const style = {
              '--from-x': `${(origin.column - target.column) * CELL}px`,
              '--from-y': `${(origin.row - target.row) * CELL}px`,
              '--target-opacity': target.opacity.toFixed(2),
              '--delay': `${delay}ms`,
            } as CSSProperties;

            return (
              <rect
                key={`octopus-${pixel.key}`}
                className="octopus-pixel"
                x={pixelX(target, pixel.size)}
                y={pixelY(target, pixel.size)}
                width={pixel.size}
                height={pixel.size}
                fill="currentColor"
                style={style}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
