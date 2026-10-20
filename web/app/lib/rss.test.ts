import { describe, expect, it } from "vitest";
import { mixHeadlines, parseRss, type Headline } from "./rss";

const feed = (items: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed title</title>${items}</channel></rss>`;

describe("parseRss", () => {
  it("reads CDATA titles and links", () => {
    const [headline] = parseRss(
      feed(`<item>
        <title><![CDATA[Bitcoin tops $110K]]></title>
        <link><![CDATA[https://example.com/a?x=1]]></link>
        <guid isPermaLink="false">abc-1</guid>
        <pubDate>Tue, 20 Oct 2026 21:12:21 +0000</pubDate>
      </item>`),
      "CoinDesk",
    );
    expect(headline).toEqual({
      id: "CoinDesk:abc-1",
      title: "Bitcoin tops $110K",
      source: "CoinDesk",
      link: "https://example.com/a?x=1",
      publishedAt: Date.parse("2026-10-20T21:12:21Z"),
    });
  });

  it("handles the title coming after the description, and decodes entities", () => {
    const [headline] = parseRss(
      feed(`<item>
        <description>Long summary &amp; more</description>
        <link>https://example.com/b</link>
        <pubDate>Tue, 20 Oct 2026 22:29:50 +0000</pubDate>
        <title>Amazon &amp; AWS: what&#39;s next &#x2014; analysts</title>
      </item>`),
      "Yahoo Finance",
    );
    expect(headline.title).toBe("Amazon & AWS: what's next — analysts");
    expect(headline.id).toBe("Yahoo Finance:https://example.com/b");
  });

  it("strips any markup inside a title instead of keeping it", () => {
    const [headline] = parseRss(
      feed(`<item><title><![CDATA[<b>Breaking</b> <script>x()</script>news]]></title></item>`),
      "Feed",
    );
    expect(headline.title).toBe("Breaking x()news");
  });

  it("skips items without a title and tolerates a missing date", () => {
    const headlines = parseRss(
      feed(`<item><link>https://example.com/c</link></item><item><title>No date</title></item>`),
      "Feed",
    );
    expect(headlines).toHaveLength(1);
    expect(headlines[0]).toMatchObject({ title: "No date", publishedAt: 0 });
  });

  it("returns nothing for a non-feed response", () => {
    expect(parseRss("<html><body>Rate limited</body></html>", "Feed")).toEqual([]);
  });
});

describe("mixHeadlines", () => {
  const h = (source: string, title: string, publishedAt: number): Headline => ({
    id: `${source}:${title}`,
    title,
    source,
    link: "",
    publishedAt,
  });

  it("interleaves the newest headlines of each source", () => {
    const mixed = mixHeadlines(
      [
        [h("A", "a-old", 1), h("A", "a-new", 3), h("A", "a-mid", 2)],
        [h("B", "b-new", 5), h("B", "b-old", 4)],
      ],
      2,
    );
    expect(mixed.map((x) => x.title)).toEqual(["a-new", "b-new", "a-mid", "b-old"]);
  });

  it("drops duplicate titles across feeds", () => {
    const mixed = mixHeadlines([[h("A", "Same story", 2)], [h("B", "Same story", 1)]], 3);
    expect(mixed).toHaveLength(1);
  });
});
