import { useMarkets } from "../../markets/MarketsProvider";
import { ago, compact } from "../../lib/format";

export function BetFeed() {
  const { bets } = useMarkets();
  return (
    <div className="feed">
      <div className="feed__head">
        <span className="live-dot" /> LIVE TRADES
      </div>
      <ul className="feed__list">
        {bets.length === 0 && <li className="feed__empty">Matching orders…</li>}
        {bets.map((b) => (
          <li key={b.id} className="feed__row">
            <span className={`feed__side feed__side--${b.side.toLowerCase()}`}>{b.side}</span>
            <span className="feed__body">
              <b>@{b.user}</b> bought {compact(b.shares)} @ {b.priceCents}¢
              <span className="feed__mkt">{b.marketShort}</span>
            </span>
            <span className="feed__ts">{ago(b.ts)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
