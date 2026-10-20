export type Headline = {
  id: string;
  title: string;
  source: string;
  link: string;
  /** Epoch milliseconds; 0 when the feed gave no usable date. */
  publishedAt: number;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

// Reads a tag's text, unwrapping CDATA and decoding entities. Feeds are
// untrusted input: any markup left inside is stripped, never rendered.
function readTag(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  const raw = match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return decode(raw.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

// Parses the <item>s of an RSS 2.0 feed into headlines.
export function parseRss(xml: string, source: string): Headline[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const title = readTag(item, "title");
    if (!title) return [];
    const link = readTag(item, "link");
    const published = Date.parse(readTag(item, "pubDate"));
    return [
      {
        id: `${source}:${readTag(item, "guid") || link || title}`,
        title,
        source,
        link,
        publishedAt: Number.isNaN(published) ? 0 : published,
      },
    ];
  });
}

// Takes the newest `perSource` headlines from each feed and interleaves them
// round-robin, so one chatty feed can't crowd the ticker.
export function mixHeadlines(feeds: Headline[][], perSource: number): Headline[] {
  const lists = feeds.map((list) =>
    [...list].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, perSource),
  );
  const mixed: Headline[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < perSource; i++) {
    for (const list of lists) {
      const headline = list[i];
      if (headline && !seen.has(headline.title)) {
        seen.add(headline.title);
        mixed.push(headline);
      }
    }
  }
  return mixed;
}
