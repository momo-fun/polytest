import { NextResponse } from "next/server";
import { CONFIG } from "../../../lib/config";
import {
  fetchMarkets,
  extractYesNoTokenIds,
  extractTags,
  getMarketQuestion,
  getMarketId
} from "../../../lib/polymarket";
import { computeHourlyChange, isHighEfficiency, liquidityScore } from "../../../lib/analysis";
import { getCache, setCache } from "../../../lib/cache";
import { mapLimit, toNumber } from "../../../lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function extractTrades(trades: any[]) {
  return trades
    .map((trade) => {
      const price = toNumber(trade.price ?? trade.rate ?? trade.pricePerShare, 0);
      const size = toNumber(trade.size ?? trade.amount ?? trade.quantity, 0);
      const usd = price && size ? price * size : 0;
      const address =
        trade.taker ??
        trade.maker ??
        trade.buyer ??
        trade.trader ??
        trade.user ??
        "";
      return { address, usd };
    })
    .filter((trade) => trade.address && trade.usd > 0);
}

async function fetchMarketTrades(marketId: string) {
  try {
    const url = new URL(`${CONFIG.DATA_API}/trades`);
    url.searchParams.set("market", marketId);
    url.searchParams.set("limit", "50");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const trades = Array.isArray(data) ? data : data?.trades ?? [];
    return extractTrades(trades);
  } catch {
    return [];
  }
}

async function getFirstSeenTimestamp(address: string) {
  if (!CONFIG.POLYGONSCAN_API_KEY) return null;
  try {
    const url = new URL("https://api.polygonscan.com/api");
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "txlist");
    url.searchParams.set("address", address);
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "1");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("apikey", CONFIG.POLYGONSCAN_API_KEY ?? "");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const firstTx = data?.result?.[0];
    if (!firstTx?.timeStamp) return null;
    return Number(firstTx.timeStamp) * 1000;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const markets = await fetchMarkets();

    const enriched = await mapLimit(markets, 6, async (market) => {
      const question = getMarketQuestion(market);
      const tags = extractTags(market);
      const { yesTokenId } = extractYesNoTokenIds(market);
      const liquidity = toNumber(market.liquidity, 0);
      const volume24h = toNumber(market.volume24h ?? market.volume24hr, 0);
      const efficiency = isHighEfficiency(question);

      const history = yesTokenId ? await getPriceHistory(yesTokenId) : [];
      const { changePct } = computeHourlyChange(history);
      const largeMove = Math.abs(changePct) >= CONFIG.VELOCITY_THRESHOLD;

      const trades = largeMove ? await fetchMarketTrades(getMarketId(market)) : [];
      const buyers = trades
        .reduce((acc, trade) => {
          const existing = acc.get(trade.address) ?? 0;
          acc.set(trade.address, existing + trade.usd);
          return acc;
        }, new Map<string, number>())
        .entries();

      const topBuyers = Array.from(buyers)
        .map(([address, usd]) => ({ address, usd }))
        .sort((a, b) => b.usd - a.usd)
        .slice(0, 3);

      const buyersWithFresh = await mapLimit(topBuyers, 3, async (buyer) => {
        const firstSeen = await getFirstSeenTimestamp(buyer.address);
        const fresh = firstSeen ? Date.now() - firstSeen < 1000 * 60 * 60 * 48 : null;
        return { ...buyer, fresh, firstSeen };
      });

      const freshSignal = buyersWithFresh.some((buyer) => buyer.fresh && buyer.usd > 10000);

      return {
        id: getMarketId(market),
        question,
        tags,
        liquidity,
        volume24h,
        efficiency,
        nicheScore: liquidityScore(liquidity),
        largeMove,
        topBuyers: buyersWithFresh,
        freshSignal
      };
    });

    const niche = enriched
      .filter((market) => market.liquidity <= CONFIG.LIQUIDITY_NICHE_MAX)
      .sort((a, b) => b.nicheScore - a.nicheScore);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      markets: niche
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
