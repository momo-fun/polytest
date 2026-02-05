import Parser from "rss-parser";
import { CONFIG } from "./config";
import { getCache, setCache } from "./cache";

export type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
};

const parser = new Parser();

async function fetchFeed(url: string) {
  const cacheKey = `rss:${url}`;
  const cached = getCache<RssItem[]>(cacheKey, CONFIG.CACHE_TTL_SECONDS * 5);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`RSS fetch failed: ${url}`);
  const xml = await res.text();
  const feed = await parser.parseString(xml);
  const items = (feed.items ?? []) as RssItem[];
  setCache(cacheKey, items);
  return items;
}

export async function fetchRecentRssItems() {
  const now = Date.now();
  const items = await Promise.all(
    CONFIG.RSS_FEEDS.map(async (feed) => {
      try {
        return await fetchFeed(feed);
      } catch {
        return [] as RssItem[];
      }
    })
  );
  const flat = items.flat();
  return flat.filter((item) => {
    if (!item.pubDate) return true;
    const ts = Date.parse(item.pubDate);
    if (Number.isNaN(ts)) return true;
    return now - ts < 1000 * 60 * 60 * 24;
  });
}
