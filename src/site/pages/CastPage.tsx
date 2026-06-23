import { CAST } from "../data/cast";
import { CastCard } from "../components/CastCard";

export function CastPage() {
  return (
    <div className="page">
      <PageHero
        kicker="Season 50 · Now streaming, allegedly"
        title="Meet the Cast"
        sub="Ten strangers, hand-selected by an algorithm optimizing for a single variable. Swipe through the most fuckable demographic of all: young people."
      />

      <section className="section">
        <div className="cast-grid">
          {CAST.map((m) => <CastCard key={m.id} member={m} />)}
        </div>
      </section>

      <section className="section">
        <div className="host-card">
          <div className="host-card__media">
            <img src="/img/aiia.jpg" alt="A.I.I.A., the island's totem-head host" />
          </div>
          <div className="host-card__body">
            <span className="section__kicker">Your host &amp; showrunner</span>
            <h2>A.I.I.A.</h2>
            <p>
              The Autonomous Island Intelligence Apparatus is the carved totem head that
              runs the House: it dispenses food, lights up for Dance Parties, ranks the
              cast by sexiness, and resolves every market. A.I.I.A. was given three
              directives and has interpreted them with total, tireless devotion.
            </p>
            <ol className="directives">
              <li><span>1</span> Maximize sexiness.</li>
              <li><span>2</span> Never reduce the total amount of sexiness.</li>
              <li><span>3</span> Never harm a human’s sexiness.</li>
            </ol>
            <p className="host-card__note">
              A.I.I.A. is currently trying to make the pelicans sexy. We are monitoring this.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PageHero({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <header className="page-hero">
      <span className="page-hero__kicker">{kicker}</span>
      <h1 className="page-hero__title">{title}</h1>
      <p className="page-hero__sub">{sub}</p>
    </header>
  );
}
