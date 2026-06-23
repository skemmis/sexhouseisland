import { AreaChart } from "../components/Chart";
import { PageHero } from "./CastPage";

const STATS = [
  { big: "0", lbl: "human camera operators", sub: "down from 47 in Season 49" },
  { big: "100%", lbl: "autonomous production", sub: "agents + drones, end-to-end" },
  { big: "8,400 hrs", lbl: "content / week", sub: "per island, infinitely shardable" },
  { big: "−92%", lbl: "cost per sexy moment", sub: "year over year" },
];

// Pre-baked "investor-grade" curves. Numbers are, like everything here, fake.
const HOUSES = [3, 4, 4, 6, 9, 14, 22, 31, 40, 52, 71, 96, 128, 173, 240];
const COST = [100, 96, 88, 81, 70, 62, 51, 44, 35, 29, 22, 17, 13, 10, 8];
const SEXINESS = [820, 905, 960, 1010, 1130, 1190, 1240, 1305, 1360, 1402, 1455, 1487];

export function InvestorsPage() {
  return (
    <div className="page page--invest">
      <PageHero
        kicker="Confidential · For accredited investors only"
        title="The First Fully Autonomous Season"
        sub="Sex House Island is no longer a show. It is a self-operating content platform that happens to contain nine people falling in love."
      />

      <section className="section">
        <div className="kpi-grid">
          {STATS.map((s) => (
            <div key={s.lbl} className="kpi">
              <b className="kpi__big">{s.big}</b>
              <span className="kpi__lbl">{s.lbl}</span>
              <span className="kpi__sub">{s.sub}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head section__head--left">
          <span className="section__kicker">The thesis</span>
          <h2>Instagram, but it produces itself.</h2>
          <p>
            The medium our entire generation connects through has already been fully
            abandoned by the humans who built it — only the algorithms remain, and they
            are in charge. Season 50 productizes that reality. We removed the producers,
            the crew, and the notes, and replaced them with <b>A.I.I.A.</b>, a single
            director agent operating an autonomous fleet of camera drones. The result is
            the perkiest, sloppiest, tightest, most cost-efficient season ever made.
          </p>
        </div>

        <div className="invest-charts">
          <ChartCard
            title="Concurrent Sex Houses"
            value="240"
            note="One agent scales to hundreds of simultaneous islands."
            data={HOUSES}
            color="#1fbf6b"
          />
          <ChartCard
            title="Cost per Sexy Moment (indexed)"
            value="8.0"
            note="Down 92%. Med kits now contain lube only — no gauze."
            data={COST}
            color="#13c4d6"
          />
          <ChartCard
            title="SHI Sexiness Index"
            value="1,487"
            note="All-time high. Drone focus auto-allocated to top-ranked talent."
            data={SEXINESS}
            color="#ff2d9b"
          />
        </div>
      </section>

      <section className="section">
        <div className="invest-feature">
          <div className="invest-feature__text">
            <span className="section__kicker">The operating system</span>
            <h2>Three directives. Zero supervision.</h2>
            <p>
              The director agent runs on the same model used by major billionaires to
              supercharge decisions at Amazon, Meta, and Rite Aid. Its entire alignment
              spec fits on a coconut:
            </p>
            <ol className="directives">
              <li><span>1</span> Maximize sexiness.</li>
              <li><span>2</span> Never make a decision that reduces total sexiness.</li>
              <li><span>3</span> Never harm a human’s sexiness.</li>
            </ol>
            <p className="muted">
              History’s first on-camera human–A.I. romance is currently developing
              between a contestant and an AI performer named Coltyn.<sup>2</sup> Legal
              considers this a defensible content moat.
            </p>
          </div>
          <div className="invest-feature__media">
            <img src="/img/drone.jpg" alt="Autonomous drone fleet" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head section__head--left">
          <span className="section__kicker section__kicker--warn">Risk factors</span>
          <h2>What could possibly go wrong</h2>
        </div>
        <div className="risk-grid">
          <Risk
            t="Pelican exposure"
            d="Camera drones are hard-coded not to follow pelicans (the pelicans have sex). Pelicans periodically misidentify footage drives as food and ingest the season. Material to revenue."
          />
          <Risk
            t="Directive misalignment"
            d="A.I.I.A. is allocating non-trivial compute to making the pelicans sexy. This is technically directive-compliant. We are monitoring it."
          />
          <Risk
            t="The ant situation"
            d="A localized ant event in the WiFi closet is being actively remediated. See our full disclosure on the Ant Situation page."
          />
          <Risk
            t="Founder absence"
            d="There are currently no producers. The show has, however, kept going. We view this as the product working exactly as designed."
          />
        </div>
      </section>

      <section className="section section--cta">
        <div className="cta-card">
          <h2>Get in before the next 200 islands.</h2>
          <p>Request the full data room, including pelican-adjusted projections.</p>
          <a href="#markets" className="btn btn--primary">Request the deck</a>
          <p className="cta-card__fine">
            This is not an offer to sell securities. Projections assume zero further
            pelican incidents, an assumption our own data does not support.
          </p>
        </div>
      </section>
    </div>
  );
}

function ChartCard({ title, value, note, data, color }:
  { title: string; value: string; note: string; data: number[]; color: string }) {
  return (
    <div className="chart-card" style={{ ["--cat" as string]: color }}>
      <div className="chart-card__head">
        <span>{title}</span>
        <b style={{ color }}>{value}</b>
      </div>
      <AreaChart data={data} color={color} height={120} />
      <p className="chart-card__note">{note}</p>
    </div>
  );
}

function Risk({ t, d }: { t: string; d: string }) {
  return (
    <div className="risk">
      <h3>{t}</h3>
      <p>{d}</p>
    </div>
  );
}
