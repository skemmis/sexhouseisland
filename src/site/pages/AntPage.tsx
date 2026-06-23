import { useMarkets } from "../markets/MarketsProvider";
import { PageHero } from "./CastPage";

const TIMELINE = [
  {
    day: "Day 1",
    t: "A monitor lizard situation",
    d: "On arrival, the production Jeep struck a large monitor lizard. The driver wished to bury it. The host said “whatever the f***” and threw it into the WiFi closet instead.",
  },
  {
    day: "Day 1, later",
    t: "The ants arrive",
    d: "The lizard, now in the WiFi closet, attracted ants to the server and router. WiFi went down. A.I.I.A. briefly lost the ability to dispense food, rank the cast, or resolve markets.",
  },
  {
    day: "Day 2",
    t: "A hard reset of the show",
    d: "A contestant flexible enough to fit inside the closet performed a manual router reset. WiFi was restored. The ants remain a known issue. The lizard remains in the closet.",
  },
  {
    day: "Day 3",
    t: "Night One footage incident",
    d: "Separately, our autonomous drones attempted to dock and upload Night One. A pelican had nested on the docking pad. The footage was misidentified as food. The footage is now inside the pelican.",
  },
  {
    day: "Ongoing",
    t: "Recovery operations",
    d: "Cast have been informed that if they would like the season to continue, they are welcome to locate the pelican nest and retrieve the footage. It’s on them.",
  },
];

const ACTIONS = [
  {
    icon: "🐜",
    t: "Ant remediation",
    d: "We have introduced a unique island flea to predate the ants. The flea is, regrettably, impervious to all known pest control. We are introducing flea collars to manage the flea.",
  },
  {
    icon: "🦴",
    t: "Flea collars → cones",
    d: "Flea collars escalated to veterinary cones for all cast and crew. Cones make hearing amazing but blind the wearer. It is hard to spit qat out of a cone. We consider this contained.",
  },
  {
    icon: "🪖",
    t: "Dedicated pelican officer",
    d: "A Ukrainian war veteran has been placed in charge of combating the pelicans. He may at any time be recalled to the front, at which point pelican operations will pause.",
  },
  {
    icon: "🧋",
    t: "Boba mitigation",
    d: "Pelicans now emerge from the bottomless pool with beaks full of boba. Cast have begun farming this boba. We are choosing to frame this as a contestant amenity.",
  },
];

export function AntPage() {
  const { indices } = useMarkets();
  const ant = indices.find((i) => i.id === "ant");
  const pelican = indices.find((i) => i.id === "pelican");

  return (
    <div className="page page--ants">
      <PageHero
        kicker="Official statement · Updated continuously"
        title="An Update on the Ant Situation"
        sub="To our viewers, our contestants, and our shareholders: we hear you, and the ants — and the pelicans — are being handled."
      />

      <section className="section">
        <div className="status-banner">
          <div className="status-banner__cell">
            <span className="status-banner__lbl">🐜 Ant Containment</span>
            <b className="status-banner__val">{ant ? `${ant.value.toFixed(1)}%` : "—"}</b>
            <span className="status-banner__tag status-banner__tag--warn">Actively improving</span>
          </div>
          <div className="status-banner__cell">
            <span className="status-banner__lbl">🦤 Pelican Threat Level</span>
            <b className="status-banner__val">{pelican ? pelican.value.toFixed(1) : "—"} / 10</b>
            <span className="status-banner__tag status-banner__tag--warn">Elevated</span>
          </div>
          <div className="status-banner__cell">
            <span className="status-banner__lbl">📼 Footage Recovered</span>
            <b className="status-banner__val">90 min</b>
            <span className="status-banner__tag">Found inside pelican</span>
          </div>
          <div className="status-banner__cell">
            <span className="status-banner__lbl">📶 House WiFi</span>
            <b className="status-banner__val">Intermittent</b>
            <span className="status-banner__tag status-banner__tag--bad">Lizard-adjacent</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="ant-split">
          <div className="ant-split__text">
            <span className="section__kicker section__kicker--warn">How we got here</span>
            <h2>A complete and honest timeline.</h2>
            <ol className="timeline">
              {TIMELINE.map((e) => (
                <li key={e.day} className="timeline__item">
                  <span className="timeline__day">{e.day}</span>
                  <div>
                    <h3>{e.t}</h3>
                    <p>{e.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="ant-split__media">
            <img src="/img/pelican.jpg" alt="The pelican in question" />
            <figcaption>
              File photo: a pelican believed to be holding Night One.
            </figcaption>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__head section__head--left">
          <span className="section__kicker">What we’re doing about it</span>
          <h2>A robust, escalating response.</h2>
        </div>
        <div className="actions-grid">
          {ACTIONS.map((a) => (
            <div key={a.t} className="action">
              <span className="action__icon">{a.icon}</span>
              <h3>{a.t}</h3>
              <p>{a.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="reassure">
          <h2>Is the House still safe and sexy?</h2>
          <p>
            Yes. Despite the ants, the flea, the cones, the qat, the bottomless pool, the
            intermittent WiFi, and the pelican holding our footage hostage, Sex House
            Island remains a safe and sexy place to find love. The show has continued
            this entire time with no one at the helm, which we believe speaks to the
            resilience of the format.
          </p>
          <p className="reassure__sign">— Sex House LLC, on behalf of A.I.I.A.</p>
        </div>
      </section>
    </div>
  );
}
