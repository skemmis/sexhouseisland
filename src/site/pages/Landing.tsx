import { Link } from "react-router-dom";
import { CAST } from "../data/cast";
import { CastCard } from "../components/CastCard";
import { MarketsBoard } from "../components/markets/MarketsBoard";

export function Landing() {
  return (
    <>
      <Hero />
      <CastTeaser />
      <MarketsBoard />
      <InvestorTeaser />
      <AntTeaser />
    </>
  );
}

function Hero() {
  return (
    <header className="hero" style={{ backgroundImage: "url(/img/hero.jpg)" }}>
      <div className="hero__scrim" />
      <div className="hero__inner">
        <span className="hero__season">★ THE LANDMARK 50TH SEASON ★</span>
        <h1 className="hero__title">
          SEX HOUSE <span className="hero__island">ISLAND</span>
        </h1>
        <p className="hero__tag">
          Eight sexy Americans. One remote island. The first totally autonomous
          season in television history.<sup>2</sup>
        </p>
        <div className="hero__cta">
          <Link to="/cast" className="btn btn--primary">Meet the Cast</Link>
          <a href="#markets" className="btn btn--ghost">Open the Markets ↓</a>
        </div>
        <div className="hero__badges">
          <span>🤖 100% AI-Run House</span>
          <span>🚁 All-Drone Camera Crew</span>
          <span>📈 Live Prediction Markets</span>
        </div>
      </div>
      <p className="hero__fineprint">
        From the creators of Sex House, the Onion’s cult hit with over 113M views.
        Streamlined horniness. Optimized penetration. Now medically supervised by A.I.I.A.<sup>3</sup>
      </p>
    </header>
  );
}

function CastTeaser() {
  const featured = CAST.slice(0, 3);
  return (
    <section className="section section--cast-teaser">
      <div className="section__head">
        <span className="section__kicker">Now casting your obsession</span>
        <h2>Meet the Season 50 Cast</h2>
        <p>
          A crunchy wellness mom, an immortality-pilled biohacker, a podcast host who
          thinks the show is too woke, and the most anticipated contestant in franchise
          history — all alone on an island with nobody making the show.
        </p>
      </div>
      <div className="cast-grid cast-grid--teaser">
        {featured.map((m) => <CastCard key={m.id} member={m} />)}
      </div>
      <div className="section__more">
        <Link to="/cast" className="btn btn--primary">See all {CAST.length} contestants →</Link>
      </div>
    </section>
  );
}

function InvestorTeaser() {
  return (
    <section className="section section--invest-teaser">
      <div className="promo-split">
        <div className="promo-split__text">
          <span className="section__kicker">For accredited investors</span>
          <h2>The first show that runs itself.</h2>
          <p>
            Season 50 is produced end-to-end by autonomous AI agents and a fleet of
            self-directed camera drones. No crew. No producers. No notes. Just three
            simple directives and infinitely scalable content.
          </p>
          <ul className="check-list">
            <li>Camera crew headcount reduced to zero</li>
            <li>One director agent, hundreds of simultaneous Sex Houses</li>
            <li>Up and to the right, except where pelicans intervene</li>
          </ul>
          <Link to="/investors" className="btn btn--primary">Read the investor deck →</Link>
        </div>
        <div className="promo-split__media">
          <img src="/img/drone.jpg" alt="Autonomous camera drones over the House" />
        </div>
      </div>
    </section>
  );
}

function AntTeaser() {
  return (
    <section className="section section--ant-teaser">
      <div className="promo-split promo-split--rev">
        <div className="promo-split__media">
          <img src="/img/pelican.jpg" alt="A pelican with the footage" />
        </div>
        <div className="promo-split__text">
          <span className="section__kicker section__kicker--warn">⚠ Operational update</span>
          <h2>An update on the ant situation.</h2>
          <p>
            We want to be fully transparent with our viewers and shareholders: the ants
            are being handled, and the pelicans have returned most of the footage. The
            House remains a safe and sexy place to find love.
          </p>
          <Link to="/ants" className="btn btn--warn">Read the full statement →</Link>
        </div>
      </div>
    </section>
  );
}
