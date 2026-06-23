import { MarketsBoard } from "../components/markets/MarketsBoard";
import { PageHero } from "./CastPage";

export function MarketsPage() {
  return (
    <div className="page">
      <PageHero
        kicker="Powered by O-Book™ · Open 24/7"
        title="Sex House Island Markets"
        sub="Every kiss, betrayal, drone strike, and pelican incident — priced live by the crowd. Trade the show as it happens."
      />
      <MarketsBoard />
    </div>
  );
}
