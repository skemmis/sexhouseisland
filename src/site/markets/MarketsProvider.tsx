import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import type { Bet, Market, MarketIndex, MarketSnapshot, LeaderRow } from "./types";
import {
  SEED_MARKETS, SEED_INDICES, SEED_LEADERBOARD, TRADERS, MARKET_SHORTS,
} from "./seed";

const HISTORY_CAP = 60;
const FEED_CAP = 40;
const TICK_MS = 1100;

function clamp01(x: number) {
  return Math.max(0.02, Math.min(0.98, x));
}
function pick<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0];
}

let betId = 1;

function stepMarket(m: Market): Market {
  let outcomes;
  if (m.outcomes.length === 1) {
    // Binary YES market: mean-reverting random walk with occasional jumps.
    const o = m.outcomes[0];
    const jump = Math.random() < 0.04 ? (Math.random() - 0.5) * 0.12 : 0;
    const next = clamp01(o.prob + (Math.random() - 0.5) * 0.02 + jump);
    outcomes = [{ ...o, prevProb: o.prob, prob: next }];
  } else {
    // Grouped market: walk each leg, then renormalize so they sum to 1.
    const walked = m.outcomes.map((o) => ({
      ...o,
      prevProb: o.prob,
      prob: clamp01(o.prob + (Math.random() - 0.5) * 0.025),
    }));
    const sum = walked.reduce((s, o) => s + o.prob, 0);
    outcomes = walked.map((o) => ({ ...o, prob: o.prob / sum }));
  }
  const lead = outcomes.reduce((a, b) => (b.prob > a.prob ? b : a)).prob;
  const history = [...m.history, lead].slice(-HISTORY_CAP);
  const volume = m.volume + Math.floor(Math.random() * 2600 * (m.hot ? 2.2 : 1));
  return { ...m, outcomes, history, volume };
}

function stepIndex(ix: MarketIndex): MarketIndex {
  const vol = ix.id === "sexiness" ? 0.006 : 0.03;
  const drift = ix.id === "ant" ? 0.004 : ix.id === "pelican" ? 0.002 : 0;
  const next = Math.max(0, ix.value * (1 + (Math.random() - 0.5) * vol + drift));
  return {
    ...ix,
    prevValue: ix.value,
    value: next,
    history: [...ix.history, next].slice(-HISTORY_CAP),
  };
}

function stepLeaderboard(rows: LeaderRow[]): LeaderRow[] {
  const jittered = rows.map((r) => ({
    ...r,
    prevScore: r.score,
    score: Math.max(0, Math.min(99.9, r.score + (Math.random() - 0.5) * 1.4)),
  }));
  return jittered.sort((a, b) => b.score - a.score);
}

function maybeBet(markets: Market[]): Bet | null {
  if (Math.random() > 0.85) return null;
  const m = pick(markets);
  const o = pick(m.outcomes);
  const side: "YES" | "NO" = m.outcomes.length === 1
    ? (Math.random() < o.prob ? "YES" : "NO")
    : "YES";
  const price = m.outcomes.length === 1
    ? (side === "YES" ? o.prob : 1 - o.prob)
    : o.prob;
  const short = m.outcomes.length === 1
    ? MARKET_SHORTS[m.id]
    : `${MARKET_SHORTS[m.id]}: ${o.label}`;
  return {
    id: betId++,
    user: pick(TRADERS),
    side,
    shares: 10 + ((Math.random() * 900) | 0),
    priceCents: Math.round(price * 100),
    marketShort: short ?? m.question,
    ts: Date.now(),
  };
}

function step(prev: MarketSnapshot): MarketSnapshot {
  const markets = prev.markets.map(stepMarket);
  const indices = prev.indices.map(stepIndex);
  const leaderboard = stepLeaderboard(prev.leaderboard);
  const newBets: Bet[] = [];
  for (let i = 0; i < 3; i++) {
    const b = maybeBet(markets);
    if (b) newBets.push(b);
  }
  const bets = [...newBets, ...prev.bets].slice(0, FEED_CAP);
  const totalVolume = markets.reduce((s, m) => s + m.volume, 0);
  const online = Math.max(
    8000,
    prev.online + Math.round((Math.random() - 0.48) * 140),
  );
  return { markets, indices, bets, leaderboard, totalVolume, online };
}

function initialSnapshot(): MarketSnapshot {
  const markets = SEED_MARKETS;
  return {
    markets,
    indices: SEED_INDICES,
    bets: [],
    leaderboard: SEED_LEADERBOARD,
    totalVolume: markets.reduce((s, m) => s + m.volume, 0),
    online: 24_318,
  };
}

const MarketsContext = createContext<MarketSnapshot | null>(null);

export function MarketsProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<MarketSnapshot>(initialSnapshot);
  const paused = useRef(false);

  useEffect(() => {
    const onVis = () => (paused.current = document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => {
      if (!paused.current) setSnap(step);
    }, TICK_MS);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <MarketsContext.Provider value={snap}>{children}</MarketsContext.Provider>;
}

export function useMarkets(): MarketSnapshot {
  const ctx = useContext(MarketsContext);
  if (!ctx) throw new Error("useMarkets must be used within MarketsProvider");
  return ctx;
}
