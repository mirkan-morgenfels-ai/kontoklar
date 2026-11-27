const ROWS = [
  "100010111000111",
  "110110100101000",
  "101010100101000",
  "100010100101011",
  "100010100101001",
  "100010100101001",
  "100010111000111",
] as const;

const STEP = 10;
const RADIUS = 3.6;
const WIDTH = (ROWS[0].length - 1) * STEP + 2 * RADIUS;
const HEIGHT = (ROWS.length - 1) * STEP + 2 * RADIUS;
const COLORS = { ivory: "#f4efe6", gold: "#dcc27a" } as const;

const DOTS = ROWS.flatMap((row, rowIndex) =>
  [...row].flatMap((bit, col) =>
    bit === "1"
      ? [{ cx: RADIUS + col * STEP, cy: RADIUS + rowIndex * STEP, fill: col >= 6 && col <= 9 ? COLORS.gold : COLORS.ivory }]
      : [],
  ),
);

export function Monogram({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} aria-hidden="true" focusable="false">
      {DOTS.map((dot) => (
        <circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r={RADIUS} fill={dot.fill} />
      ))}
    </svg>
  );
}
