import { Clock } from "@/app/components/clock";
import { Watchlist } from "@/app/components/watchlist";
import { MOCK_WATCHLIST } from "@/app/lib/watchlist";

export default function Home() {
  const featured = MOCK_WATCHLIST[0];

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] gap-[2rem] p-[3rem]">
      <header className="flex items-start justify-between">
        <Clock />
        <div className="text-right">
          <div className="text-[2.5rem] font-semibold tracking-tight">
            TickerTV
          </div>
          <div className="mt-2 text-[1.25rem] text-muted">Crypto · 24/7</div>
        </div>
      </header>

      <main className="grid min-h-0 grid-cols-[1fr_34rem] gap-[2rem]">
        {/* TODO: Replace with the live candlestick chart for the featured
            symbol once the chart component lands. */}
        <section
          aria-label="Chart"
          className="flex min-h-0 flex-col rounded-[2rem] border border-panel-border bg-panel p-[2.5rem]"
        >
          <div className="text-[3rem] font-semibold leading-none">
            {featured.symbol}
            <span className="ml-4 text-[2rem] font-normal text-muted">
              {featured.name}
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center text-[1.5rem] text-muted">
            Chart
          </div>
        </section>

        <Watchlist items={MOCK_WATCHLIST} />
      </main>

      {/* TODO: Replace with the scrolling news ticker. */}
      <footer
        aria-label="News"
        className="flex h-[4.5rem] items-center rounded-[1.25rem] border border-panel-border bg-panel px-[2rem] text-[1.5rem] text-muted"
      >
        News ticker
      </footer>
    </div>
  );
}
