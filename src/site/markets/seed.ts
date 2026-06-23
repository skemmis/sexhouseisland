import type { Market, MarketIndex, LeaderRow } from "./types";

// Initial board state. Probabilities and values drift live in the engine.

const hist = (p: number, n = 48): number[] => {
  // Seed a plausible-looking history that lands on the current value.
  const out: number[] = [];
  let v = clamp01(p + (Math.random() - 0.5) * 0.18);
  for (let i = 0; i < n; i++) {
    v = clamp01(v + (Math.random() - 0.5) * 0.04 + (p - v) * 0.08);
    out.push(v);
  }
  out.push(p);
  return out;
};

function clamp01(x: number) {
  return Math.max(0.02, Math.min(0.98, x));
}

const yes = (prob: number) => [
  { id: "yes", label: "YES", prob, prevProb: prob },
];

export const SEED_MARKETS: Market[] = [
  {
    id: "love-day3",
    question: "Will anyone fall in genuine love before Day 3?",
    category: "romance",
    outcomes: yes(0.41),
    history: hist(0.41),
    volume: 184_220,
    closes: "Closes Day 3 · 6:00 AM",
    hot: true,
  },
  {
    id: "coltyn-reveal",
    question: "Will Coltyn be revealed as an A.I. on camera this week?",
    category: "ai",
    outcomes: yes(0.63),
    history: hist(0.63),
    volume: 412_900,
    closes: "Closes Sunday · 11:59 PM",
    hot: true,
  },
  {
    id: "pelican-footage",
    question: "Will the pelicans return this week's footage intact?",
    category: "wildlife",
    outcomes: yes(0.12),
    history: hist(0.12),
    volume: 98_540,
    closes: "Closes when footage is recovered",
  },
  {
    id: "wifi-friday",
    question: "Will House WiFi stay online through Friday?",
    category: "infra",
    outcomes: yes(0.29),
    history: hist(0.29),
    volume: 221_310,
    closes: "Closes Friday · Midnight",
    hot: true,
  },
  {
    id: "brock-eats",
    question: "Will Brock eat something he shouldn't today?",
    category: "chaos",
    outcomes: yes(0.88),
    history: hist(0.88),
    volume: 67_010,
    closes: "Closes daily · 11:59 PM",
  },
  {
    id: "drone-clip",
    question: "Will a camera drone clip a contestant today?",
    category: "infra",
    outcomes: yes(0.94),
    history: hist(0.94),
    volume: 51_770,
    closes: "Closes daily · 11:59 PM",
  },
  {
    id: "strathairn-finale",
    question: "Will Mr. Strathairn make it to the finale?",
    category: "chaos",
    outcomes: yes(0.34),
    history: hist(0.34),
    volume: 143_880,
    closes: "Closes at Finale",
  },
  {
    id: "aiia-danceparty",
    question: "Will A.I.I.A. call a mandatory Dance Party tonight?",
    category: "ai",
    outcomes: yes(0.57),
    history: hist(0.57),
    volume: 79_400,
    closes: "Closes tonight · 9:00 PM",
  },
  {
    id: "couple-first",
    question: "Who will couple up first?",
    category: "romance",
    outcomes: [
      { id: "danni-coltyn", label: "Danni & Coltyn", prob: 0.38, prevProb: 0.38 },
      { id: "tanner-sage", label: "Tanner & Sage", prob: 0.21, prevProb: 0.21 },
      { id: "marco-danni", label: "Marco & Danni", prob: 0.18, prevProb: 0.18 },
      { id: "brock-xiao", label: "Brock & Xiao", prob: 0.14, prevProb: 0.14 },
      { id: "field", label: "The Field", prob: 0.09, prevProb: 0.09 },
    ],
    history: hist(0.38),
    volume: 503_650,
    closes: "Closes at first coupling",
    hot: true,
  },
];

export const SEED_INDICES: MarketIndex[] = [
  { id: "sexiness", label: "SHI Sexiness Index", value: 1487.2, prevValue: 1487.2, history: idxHist(1487, 0.012), unit: "points" },
  { id: "drama", label: "Drama Volatility", value: 38.4, prevValue: 38.4, history: idxHist(38, 0.05), unit: "points" },
  { id: "ant", label: "Ant Containment", value: 22.0, prevValue: 22.0, history: idxHist(22, 0.06), unit: "pct" },
  { id: "pelican", label: "Pelican Threat Level", value: 7.1, prevValue: 7.1, history: idxHist(7, 0.04), unit: "level" },
];

function idxHist(base: number, vol: number, n = 48): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v = Math.max(0, v * (1 + (Math.random() - 0.5) * vol));
    out.push(v);
  }
  out.push(base);
  return out;
}

export const SEED_LEADERBOARD: LeaderRow[] = [
  { id: "coltyn", name: "Coltyn", score: 94.2, prevScore: 94.2 },
  { id: "danni", name: "Danni", score: 91.7, prevScore: 91.7 },
  { id: "marco", name: "Marco", score: 80.5, prevScore: 80.5 },
  { id: "tanner", name: "Tanner", score: 77.1, prevScore: 77.1 },
  { id: "brock", name: "Brock", score: 71.9, prevScore: 71.9 },
  { id: "sage", name: "Sage", score: 64.0, prevScore: 64.0 },
  { id: "xiao", name: "Xiao", score: 61.3, prevScore: 61.3 },
  { id: "grayson", name: "Grayson", score: 44.8, prevScore: 44.8 },
  { id: "lenore", name: "Mr. Strathairn", score: 12.6, prevScore: 12.6 },
];

// Fake trader handles for the live bet feed.
export const TRADERS = [
  "pelican_pilled", "danni_truther", "WetManWaiter", "qat_chewer_88", "abandoned_by_god",
  " totemhead".trim(), "ohbookballer", "coltyn_is_real", "drone_dad", "sexiness_maxi",
  "ghazal_andy", "MAHA_mommy", "footage_finder", "Tostito_Whale", "no_game_no_life",
  "strathairn_stan", "boba_farmer", "screenface_99", "lube_only_medkit", "ROIonROMANCE",
];

export const MARKET_SHORTS: Record<string, string> = {
  "love-day3": "Love by Day 3",
  "coltyn-reveal": "Coltyn = A.I.?",
  "pelican-footage": "Footage returned?",
  "wifi-friday": "WiFi survives Friday",
  "brock-eats": "Brock eats it",
  "drone-clip": "Drone clips someone",
  "strathairn-finale": "Strathairn → Finale",
  "aiia-danceparty": "A.I.I.A. Dance Party",
  "couple-first": "First couple",
};
