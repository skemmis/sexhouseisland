import { useMarkets } from "../../markets/MarketsProvider";
import { Sparkline } from "../Chart";
import type { MarketIndex } from "../../markets/types";

function fmt(ix: MarketIndex): string {
  if (ix.unit === "pct") return `${ix.value.toFixed(1)}%`;
  if (ix.unit === "level") return ix.value.toFixed(1);
  return ix.value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function IndexTicker() {
  const { indices } = useMarkets();
  return (
    <div className="index-ticker">
      {indices.map((ix) => {
        const d = ix.value - ix.prevValue;
        const up = d >= 0;
        const color = up ? "#1fbf6b" : "#ff3b5c";
        return (
          <div key={ix.id} className="index-cell">
            <div className="index-cell__top">
              <span className="index-cell__lbl">{ix.label}</span>
              <span className="index-cell__spark"><Sparkline data={ix.history} color={color} /></span>
            </div>
            <div className="index-cell__val">
              <b>{fmt(ix)}</b>
              <span className="index-cell__chg" style={{ color }}>
                {up ? "▲" : "▼"} {Math.abs((d / (ix.prevValue || 1)) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
