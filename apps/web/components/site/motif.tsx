const STEP = 20;
const START_X = 20;
export const ORNAMENT_AXIS_Y = 250;
const BALANCE_TOP = 150;
const BALANCE_SCALE = 0.42;

const MONTHS: ReadonlyArray<readonly [number, readonly number[]]> = [
  [86, [24, 14, 18, 8]],
  [90, [18, 26, 10, 14]],
  [84, [28, 10, 16, 12]],
  [94, [12, 22, 26, 10]],
  [88, [20, 30, 8, 14]],
  [98, [16, 28, 12, 18]],
  [92, []],
];

export interface OrnamentBar {
  x: number;
  kind: "in" | "out";
  height: number;
  balanceY: number;
}

export const ORNAMENT_BARS: readonly OrnamentBar[] = MONTHS.flatMap(([income, outs]) => [
  { kind: "in" as const, amount: income },
  ...outs.map((amount) => ({ kind: "out" as const, amount })),
]).reduce<{ balance: number; bars: OrnamentBar[] }>(
  (acc, { kind, amount }, index) => {
    const balance = acc.balance + (kind === "in" ? amount : -amount);
    acc.bars.push({ x: START_X + index * STEP, kind, height: amount, balanceY: BALANCE_TOP - balance * BALANCE_SCALE });
    return { balance, bars: acc.bars };
  },
  { balance: 0, bars: [] },
).bars;

const LAST_BAR: OrnamentBar = ORNAMENT_BARS[ORNAMENT_BARS.length - 1] ?? { x: 620, kind: "in", height: 92, balanceY: 58.4 };

export const ORNAMENT_BALANCE_PATH = [`M${START_X - 12} ${BALANCE_TOP}`, ...ORNAMENT_BARS.map((bar) => `L${bar.x} ${bar.balanceY.toFixed(1)}`)].join(" ");

export const ORNAMENT_AREA_PATH = `${ORNAMENT_BALANCE_PATH} L${LAST_BAR.x} ${ORNAMENT_AXIS_Y} L${START_X - 12} ${ORNAMENT_AXIS_Y} Z`;

export const ORNAMENT_LAST = LAST_BAR;

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <path d="M16 1.75 30.25 16 16 30.25 1.75 16Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.05 20V16.5M14.35 20V13.5M17.65 20V15M20.95 20V12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function HeroOrnament({ idPrefix, className }: { idPrefix: string; className?: string }) {
  const barId = `${idPrefix}-bar`;
  const areaId = `${idPrefix}-area`;
  const fadeId = `${idPrefix}-fade`;
  const maskId = `${idPrefix}-mask`;
  const last = LAST_BAR;
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8bd72" stopOpacity="0.55" />
          <stop offset="1" stopColor="#c9a548" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a548" stopOpacity="0.16" />
          <stop offset="1" stopColor="#c9a548" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="640" height="360" fill={`url(#${fadeId})`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        {[40, 100, 160, 310].map((y) => (
          <line key={y} x1="0" x2="640" y1={y} y2={y} stroke="#c9a548" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={ORNAMENT_AREA_PATH} fill={`url(#${areaId})`} />
        {ORNAMENT_BARS.map((bar) =>
          bar.kind === "in" ? (
            <rect
              key={bar.x}
              x={bar.x - 3}
              y={ORNAMENT_AXIS_Y - bar.height}
              width="6"
              height={bar.height}
              rx="1"
              fill={`url(#${barId})`}
              stroke="#d8bd72"
              strokeOpacity="0.8"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <rect
              key={bar.x}
              x={bar.x - 3}
              y={ORNAMENT_AXIS_Y + 3}
              width="6"
              height={bar.height}
              rx="1"
              fill="#c9a548"
              fillOpacity="0.08"
              stroke="#c9a548"
              strokeOpacity="0.5"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
        <line x1="0" x2="640" y1={ORNAMENT_AXIS_Y} y2={ORNAMENT_AXIS_Y} stroke="#c9a548" strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {[14, 9, 5].map((offset, index) => (
          <path
            key={offset}
            d={ORNAMENT_BALANCE_PATH}
            transform={`translate(0 ${offset})`}
            fill="none"
            stroke="#c9a548"
            strokeOpacity={0.06 + index * 0.05}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={ORNAMENT_BALANCE_PATH}
          pathLength={1}
          className="draw-line"
          fill="none"
          stroke="#d8bd72"
          strokeWidth="1.75"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {ORNAMENT_BARS.filter((bar, index) => bar.kind === "in" && index > 0 && bar !== last).map((bar) => (
          <circle key={`peak-${bar.x}`} cx={bar.x} cy={bar.balanceY} r="3" fill="#0b1626" stroke="#d8bd72" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={last.x} x2={last.x} y1={last.balanceY + 12} y2={ORNAMENT_AXIS_Y - last.height} stroke="#d8bd72" strokeOpacity="0.45" strokeDasharray="3 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={last.x + 12} x2="640" y1={last.balanceY} y2={last.balanceY} stroke="#d8bd72" strokeOpacity="0.45" strokeDasharray="3 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>
      <circle cx={last.x} cy={last.balanceY} r="12" fill="none" stroke="#d8bd72" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.balanceY} r="4.5" fill="#d8bd72" />
    </svg>
  );
}

export function UploadGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      <path d="M13 6.5h15.5L37 15v26.5H13Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28.5 6.5V15H37" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17.5 21h8M17.5 25h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M19 36.5v-3M23 36.5v-6.5M27 36.5v-4.5M31 36.5v-8.5" stroke="#b8912f" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
