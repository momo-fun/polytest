import { NextResponse } from "next/server";
import { CONFIG } from "../../../lib/config";
import {
  fetchMarkets,
  extractYesNoTokenIds,
  extractOutcomePrices,
  extractTags,
  getMarketQuestion,
  getMarketId
} from "../../../lib/polymarket";
import { getCache, setCache } from "../../../lib/cache";
import { computeHourlyChange } from "../../../lib/analysis";
import { fetchRecentRssItems } from "../../../lib/rss";
import { sentimentForMarket } from "../../../lib/sentiment";
import { mapLimit, toNumber } from "../../../lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasCategory(tags: string[], categoryList: string[], question: string) {
  const lower = question.toLowerCase();
  return (
    tags.some((tag) => categoryList.some((needle) => tag.includes(needle))) ||
    categoryList.some((needle) => lower.includes(needle))
  );
}

async function getPriceHistory(tokenId: string) {
  const cacheKey = `priceHistory:${tokenId}`;
  const cached = getCache<Array<{ timestamp: number; price: number }>>(cacheKey, CONFIG.CACHE_TTL_SECONDS);
  if (cached) return cached;
  try {
    const { fetchPriceHistory } = await import("../../../lib/polymarket");
    const history = await fetchPriceHistory(tokenId);
    setCache(cacheKey, history);
    return history;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const markets = await fetchMarkets();
    const rssItems = await fetchRecentRssItems();

    const filtered = markets.filter((market) => {
      const tags = extractTags(market);
      const question = getMarketQuestion(market);
      return (
        hasCategory(tags, CONFIG.POLITICS_TAGS, question) ||
        hasCategory(tags, CONFIG.FINANCE_TAGS, question)
      );
    });

    const enriched = await mapLimit(filtered, 6, async (market) => {
      const question = getMarketQuestion(market);
      const tags = extractTags(market);
      const { yesTokenId, noTokenId } = extractYesNoTokenIds(market);
      const prices = extractOutcomePrices(market);
      const liquidity = toNumber(market.liquidity, 0);
      const volume24h = toNumber(market.volume24h ?? market.volume24hr, 0);

      const history = yesTokenId ? await getPriceHistory(yesTokenId) : [];
      const { changePct, last24h } = computeHourlyChange(history);

      const sentiment = sentimentForMarket(question, rssItems);
      const silentMove =
        Math.abs(changePct) >= CONFIG.VELOCITY_THRESHOLD &&
        sentiment.mentions <= CONFIG.SENTIMENT_MENTIONS_LOW &&
        Math.abs(sentiment.score) < 0.12;

      return {
        id: getMarketId(market),
        question,
        tags,
        yesPrice: prices.yes || (history.length ? history[history.length - 1].price : 0),
        noPrice: prices.no,
        changePct,
        last24h,
        liquidity,
        volume24h,
        sentiment,
        silentMove,
        yesTokenId,
        noTokenId
      };
    });

    const movers = enriched
      .filter((market) => Math.abs(market.changePct) >= CONFIG.VELOCITY_THRESHOLD)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      count: movers.length,
      markets: movers
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message ?? "Unknown error",
        updatedAt: new Date().toISOString(),
        count: 0,
        markets: []
      },
      { status: 500 }
    );
  }
}
