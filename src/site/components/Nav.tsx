import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/cast", label: "Meet the Cast" },
  { to: "/markets", label: "Markets" },
  { to: "/investors", label: "For Investors" },
  { to: "/ants", label: "The Ant Situation" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="nav">
      <Link to="/" className="nav__brand" onClick={() => setOpen(false)}>
        <span className="nav__heart">♥</span>
        <span className="nav__name">SEX HOUSE ISLAND</span>
        <span className="nav__s50">S50</span>
      </Link>

      <button
        className="nav__toggle"
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        ☰
      </button>

      <ul className={`nav__links ${open ? "is-open" : ""}`}>
        {LINKS.map((l) => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? "is-active" : "")}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          </li>
        ))}
        <li>
          <a className="nav__cta" href="/#markets" onClick={() => setOpen(false)}>
            Start Trading
          </a>
        </li>
      </ul>
    </nav>
  );
}
