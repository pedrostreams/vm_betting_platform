// Live (server-cached) news fetch from the Independent's World Cup RSS feed.
// Already WC-filtered, so no keyword filtering. Cached 30 min via revalidate —
// no DB table, no cron.

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
}

const FEEDS = [
  { url: "https://www.independent.co.uk/sport/football/world-cup/rss", source: "The Independent" },
];

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() || null;
}

export async function fetchNews(limit = 8): Promise<NewsItem[]> {
  const all: NewsItem[] = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { next: { revalidate: 1800 } });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const item of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
        const title = tag(item, "title");
        const link = tag(item, "link");
        if (!title || !link) continue;
        const pub = tag(item, "pubDate");
        all.push({
          title,
          link,
          source: feed.source,
          publishedAt: pub ? new Date(pub).toISOString() : null,
        });
      }
    } catch {
      // Non-critical; skip a failing feed.
    }
  }
  all.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return all.slice(0, limit);
}
