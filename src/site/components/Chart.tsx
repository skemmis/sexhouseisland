// Lightweight hand-rolled SVG charts so the board can have lots of live,
// updating graphs with no charting dependency.

interface AreaProps {
  data: number[];
  /** Override the y-range; defaults to data min/max with padding. */
  min?: number;
  max?: number;
  color?: string;
  height?: number;
  className?: string;
}

function buildPath(data: number[], w: number, h: number, lo: number, hi: number) {
  const span = hi - lo || 1;
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * w);
  const y = (v: number) => h - ((v - lo) / span) * h;
  let line = `M ${x(0).toFixed(2)} ${y(data[0]).toFixed(2)}`;
  for (let i = 1; i < n; i++) line += ` L ${x(i).toFixed(2)} ${y(data[i]).toFixed(2)}`;
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area, lastX: x(n - 1), lastY: y(data[n - 1]) };
}

export function AreaChart({
  data, min, max, color = "#ff2d9b", height = 90, className,
}: AreaProps) {
  const W = 320;
  const lo = min ?? Math.min(...data) * 0.96;
  const hi = max ?? Math.max(...data) * 1.04;
  const { line, area, lastX, lastY } = buildPath(data, W, height, lo, hi);
  const gid = `g-${color.replace("#", "")}-${height}`;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3.5" fill={color}>
        <animate attributeName="r" values="3.5;6;3.5" dur="1.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function Sparkline({
  data, color = "#13c4d6", height = 28,
}: { data: number[]; color?: string; height?: number }) {
  const W = 90;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const { line } = buildPath(data, W, height, lo === hi ? lo - 1 : lo, lo === hi ? hi + 1 : hi);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}>
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
