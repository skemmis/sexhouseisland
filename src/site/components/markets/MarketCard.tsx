import type { Market } from "../../markets/types";
import { AreaChart } from "../Chart";
import { cents, pct, money } from "../../lib/format";

const CAT_COLOR: Record<Market["category"], string> = {
  romance: "#ff2d9b",
  chaos: "#ff7a00",
  infra: "#13c4d6",
  ai: "#9b5cff",
  wildlife: "#1fbf6b",
};

const CAT_LABEL: Record<Market["category"], string> = {
  romance: "Romance",
  chaos: "Chaos",
  infra: "Infrastructure",
  ai: "Artificial Intelligence",
  wildlife: "Wildlife",
};

function Delta({ prob, prevProb }: { prob: number; prevProb: number }) {
  const d = prob - prevProb;
  const up = d >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(d * 100).toFixed(1)}
    </span>
  );
}

export function MarketCard({ market }: { market: Market }) {
  const color = CAT_COLOR[market.category];
  const binary = market.outcomes.length === 1;

  return (
    <article className="market-card" style={{ ["--cat" as string]: color }}>
      <header className="market-card__top">
        <span className="market-card__cat">{CAT_LABEL[market.category]}</span>
        {market.hot && <span className="market-card__hot">🔥 HOT</span>}
      </header>

      <h3 className="market-card__q">{market.question}</h3>

      {binary ? (
        <BinaryBody market={market} color={color} />
      ) : (
        <GroupedBody market={market} />
      )}

      <AreaChart data={market.history} color={color} height={64} className="market-card__chart" />

      <footer className="market-card__foot">
        <span>{money(market.volume)} Vol.</span>
        <span>{market.closes}</span>
      </footer>
    </article>
  );
}

function BinaryBody({ market, color }: { market: Market; color: string }) {
  const o = market.outcomes[0];
  return (
    <>
      <div className="market-card__price">
        <div className="market-card__big" style={{ color }}>
          {pct(o.prob)}
          <span className="market-card__lbl">chance</span>
        </div>
        <Delta prob={o.prob} prevProb={o.prevProb} />
      </div>
      <div className="market-card__bar">
        <div className="market-card__fill" style={{ width: pct(o.prob), background: color }} />
      </div>
      <div className="trade">
        <button className="trade__btn trade__btn--yes">
          Buy YES <b>{cents(o.prob)}</b>
        </button>
        <button className="trade__btn trade__btn--no">
          Buy NO <b>{cents(1 - o.prob)}</b>
        </button>
      </div>
    </>
  );
}

function GroupedBody({ market }: { market: Market }) {
  const sorted = [...market.outcomes].sort((a, b) => b.prob - a.prob);
  return (
    <ul className="grouped">
      {sorted.map((o) => (
        <li key={o.id} className="grouped__row">
          <span className="grouped__name">{o.label}</span>
          <span className="grouped__bar">
            <span className="grouped__fill" style={{ width: pct(o.prob) }} />
          </span>
          <span className="grouped__price">{cents(o.prob)}</span>
          <Delta prob={o.prob} prevProb={o.prevProb} />
        </li>
      ))}
    </ul>
  );
}
