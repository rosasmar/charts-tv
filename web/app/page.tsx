import { Suspense } from "react";
import { BurnInShift } from "@/app/components/burn-in-shift";
import { Clock } from "@/app/components/clock";
import { Dashboard } from "@/app/components/dashboard";
import { NewsTicker } from "@/app/components/news-ticker";
import { NightDim } from "@/app/components/night-dim";
import { getMarketData } from "@/app/lib/market-data";
import { isRedisAvailable } from "@/app/lib/redis";

export default async function Home() {
  const { items } = await getMarketData();
  // R9: the QR block is hidden when Redis isn't configured.
  const remoteAvailable = isRedisAvailable();
  return (
    <BurnInShift className="grid h-screen grid-rows-[auto_1fr_auto] gap-[2rem] p-[3rem]">
      <header className="flex items-start justify-between">
        <Clock />
        <div className="text-right">
          <div className="text-[2.5rem] font-semibold tracking-tight">
            TickerTV
          </div>
          <div className="mt-2 text-[1.25rem] text-muted">Crypto &amp; stocks</div>
        </div>
      </header>

      {/* Suspense allows Dashboard (a client component) to use Math.random() and
          window.location.origin for the pairing code without blocking prerender. */}
      <Suspense>
        <Dashboard items={items} remoteAvailable={remoteAvailable} />
      </Suspense>

      <NewsTicker />

      <NightDim />
    </BurnInShift>
  );
}
