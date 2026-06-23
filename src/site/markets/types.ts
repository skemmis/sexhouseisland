// Data model for Sex House Island Markets — a (fully fake) Kalshi-style
// prediction market on events inside the House.

export interface Outcome {
  id: string;
  label: string;
  /** Current implied probability, 0..1. */
  prob: number;
  /** Probability one tick ago — used to flash green/red. */
  prevProb: number;
}

export interface Market {
  id: string;
  question: string;
  category: "romance" | "chaos" | "infra" | "ai" | "wildlife";
  /** Binary markets have a single YES outcome; grouped markets have several. */
  outcomes: Outcome[];
  /** Recent YES-price (or leader-price) history for the chart, oldest→newest. */
  history: number[];
  /** Cumulative fake dollar volume. */
  volume: number;
  /** Human-readable time-to-resolution. */
  closes: string;
  hot?: boolean;
}

export interface MarketIndex {
  id: string;
  label: string;
  value: number;
  prevValue: number;
  history: number[];
  /** How to format the value. */
  unit: "points" | "level" | "pct";
}

export interface Bet {
  id: number;
  user: string;
  side: "YES" | "NO";
  shares: number;
  priceCents: number;
  marketShort: string;
  ts: number;
}

export interface LeaderRow {
  id: string;
  name: string;
  score: number;
  prevScore: number;
}

export interface MarketSnapshot {
  markets: Market[];
  indices: MarketIndex[];
  bets: Bet[];
  leaderboard: LeaderRow[];
  /** Total fake dollars matched, for the headline counter. */
  totalVolume: number;
  /** Fake live trader count. */
  online: number;
}
