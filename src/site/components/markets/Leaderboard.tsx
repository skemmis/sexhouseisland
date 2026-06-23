import { useMarkets } from "../../markets/MarketsProvider";

export function Leaderboard() {
  const { leaderboard } = useMarkets();
  return (
    <div className="leader">
      <div className="leader__head">
        🏆 A.I.I.A. SEXINESS STACK-RANK
        <span className="leader__sub">drone focus allocated by rank · auto-updated</span>
      </div>
      <ol className="leader__list">
        {leaderboard.map((r, i) => {
          const move = r.score - r.prevScore;
          return (
            <li key={r.id} className="leader__row">
              <span className="leader__rank">{i + 1}</span>
              <span className="leader__name">{r.name}</span>
              <span className="leader__bar">
                <span className="leader__fill" style={{ width: `${r.score}%` }} />
              </span>
              <span className="leader__score">{r.score.toFixed(1)}</span>
              <span className={`leader__move ${move >= 0 ? "up" : "down"}`}>
                {move >= 0 ? "▲" : "▼"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
