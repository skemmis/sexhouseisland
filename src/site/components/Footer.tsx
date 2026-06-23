const SPONSORS = [
  "Cum Rag™ — sponsored by Tostitos",
  "Twidsulin® — insulin-adjacent",
  "Tombstone Pizza — 25 pts per slice",
  "O-Book™ Gambling",
  "Daily Wire App (the only app)",
  "Juicero-for-Protein",
];

const FOOTNOTES = [
  "“Family affair” meant figuratively. In accordance with Hofster v. Sex House LLC (Md. 2017), Sex House Island is now a strictly incest-free zone.",
  "“Fully autonomous” includes a 24-hour anonymous human contractor team in skintight gray bodysuits whom we are legally required to mention exactly once.",
  "Contestant ages, vital signs, and consent are continuously verified by A.I.I.A. and are accurate to within several years.",
  "“Required to watch” is enforced via the House WiFi, which is itself not guaranteed to be online. See footnote 2.",
  "O-Book™ markets are a dramatization for promotional purposes. No real money, no real pelicans, no real Coltyn.",
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__sponsors">
        <span className="footer__sponsors-lbl">This season made possible by</span>
        <div className="footer__sponsor-row">
          {SPONSORS.map((s) => (
            <span key={s} className="footer__sponsor">{s}</span>
          ))}
        </div>
      </div>

      <div className="footer__main">
        <div className="footer__brand">
          <div className="footer__logo">SEX HOUSE ISLAND</div>
          <p>
            Eight sexy Americans. One autonomous island. Fifty seasons and counting.
            <br />A production of Sex House LLC for the ONN — abandoned by God,
            sustained by the algorithm.
          </p>
          <p className="footer__copy">
            © 2012–2026 Sex House LLC. All footage recovered from the pelican is
            property of Sex House LLC.
          </p>
        </div>

        <ol className="footer__notes">
          {FOOTNOTES.map((f, i) => (
            <li key={i}><sup>{i + 1}</sup> {f}</li>
          ))}
        </ol>
      </div>
    </footer>
  );
}
