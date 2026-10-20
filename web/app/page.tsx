import { Clock } from "@/app/components/clock";
import { Dashboard } from "@/app/components/dashboard";
import { NewsTicker } from "@/app/components/news-ticker";
import { MOCK_WATCHLIST } from "@/app/lib/watchlist";

export default function Home() {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] gap-[2rem] p-[3rem]">
      <header className="flex items-start justify-between">
        <Clock />
        <div className="text-right">
          <div className="text-[2.5rem] font-semibold tracking-tight">
            TickerTV
          </div>
          <div className="mt-2 text-[1.25rem] text-muted">Crypto &amp; stocks</div>
        </div>
      </header>

      <Dashboard items={MOCK_WATCHLIST} />

      <NewsTicker />
    </div>
  );
}
