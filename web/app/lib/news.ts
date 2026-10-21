import "server-only";
import { cacheLife } from "next/cache";
import { AMAZON_NEWS_SOURCE, mixHeadlines, parseRss, type Headline } from "@/app/lib/rss";

type Feed = {
  source: string;
  url: string;
  /** Keep only headlines whose title matches, for noisy feeds. */
  match?: RegExp;
};

const FEEDS: Feed[] = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  {
    source: "Yahoo Finance",
    url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AMZN&region=US&lang=en-US",
    // The AMZN feed also carries unrelated market stories.
    match: /\b(amazon|amzn|aws)\b/i,
  },
  { source: AMAZON_NEWS_SOURCE, url: "https://www.aboutamazon.com/news/rss" },
];

/** Headlines per source in the ticker. */
const PER_SOURCE = 4;

async function fetchFeed(feed: Feed): Promise<Headline[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "TickerTV/1.0 (+https://github.com/rosasmar/charts-tv)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const headlines = parseRss(await res.text(), feed.source);
    return feed.match ? headlines.filter((h) => feed.match!.test(h.title)) : headlines;
  } catch {
    // One slow or broken feed shouldn't take the ticker down.
    return [];
  }
}

// Fetched at most every few minutes and shared by every TV, so the news
// sites see a handful of requests no matter how many screens are on.
export async function getHeadlines(): Promise<Headline[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3_600 });
  const feeds = await Promise.all(FEEDS.map(fetchFeed));
  return mixHeadlines(feeds, PER_SOURCE);
}
