import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { MarketsProvider } from "./markets/MarketsProvider";
import { Landing } from "./pages/Landing";
import { CastPage } from "./pages/CastPage";
import { MarketsPage } from "./pages/MarketsPage";
import { InvestorsPage } from "./pages/InvestorsPage";
import { AntPage } from "./pages/AntPage";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <MarketsProvider>
      <ScrollManager />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/cast" element={<CastPage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/investors" element={<InvestorsPage />} />
          <Route path="/ants" element={<AntPage />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>
      <Footer />
    </MarketsProvider>
  );
}
