import { useMarkets } from "../../markets/MarketsProvider";
import { MARKET_SHORTS } from "../../markets/seed";
import { MarketCard } from "./MarketCard";
import { BetFeed } from "./BetFeed";
import { Leaderboard } from "./Leaderboard";
import { IndexTicker } from "./IndexTicker";
import { money, compact, pct } from "../../lib/format";

function TickerStrip() {
  const { markets } = useMarkets();
  const items = markets.map((m) => {
    const lead = m.outcomes.reduce((a, b) => (b.prob > a.prob ? b : a));
    const up = lead.prob >= lead.prevProb;
    return (
      <span className="strip__item" key={m.id}>
        <b>{MARKET_SHORTS[m.id] ?? m.question}</b>
        <span style={{ color: up ? "#9dffce" : "#ffd0dc" }}>
          {pct(lead.prob)} {up ? "▲" : "▼"}
        </span>
      </span>
    );
  });
  return (
    <div className="strip">
      <div className="strip__track">
        {items}{items}
      </div>
    </div>
  );
}

export function MarketsBoard() {
  const { totalVolume, online, markets } = useMarkets();
  return (
    <section id="markets" className="board">
      <div className="board__header">
        <div className="board__title">
          <span className="board__kicker">
            <span className="live-dot" /> LIVE · OPEN 24/7
          </span>
          <h2>
            Sex House Island <span className="grad">Markets</span>
          </h2>
          <p className="board__blurb">
            The official prediction market of Season 50. Trade the outcome of every
            kiss, betrayal, and pelican incident in real time. Whoever finishes the
            week up the most records a video DM the entire House is contractually
            required to watch.<sup>4</sup>
          </p>
        </div>
        <div className="board__stats">
          <div className="stat">
            <b>{money(totalVolume)}</b>
            <span>matched this season</span>
          </div>
          <div className="stat">
            <b>{compact(online)}</b>
            <span>traders online</span>
          </div>
          <div className="stat">
            <b>{markets.length}</b>
            <span>open markets</span>
          </div>
        </div>
      </div>

      <TickerStrip />
      <IndexTicker />

      <div className="board__grid">
        <div className="board__markets">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
        <aside className="board__side">
          <BetFeed />
          <Leaderboard />
          <p className="board__disclaimer">
            Powered by O-Book™. Not investment advice. Markets are a dramatization.
            Settlement subject to footage recovery. Must be 18+ and on the island to
            participate.<sup>5</sup>
          </p>
        </aside>
      </div>
    </section>
  );
}
