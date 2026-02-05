import { CONFIG } from "./config";
import { getCache, setCache } from "./cache";
import { OrderBook } from "./polymarket";
import { toNumber } from "./utils";

export function computeHourlyChange(history: Array<{ timestamp: number; price: number }>) {
  if (!history || history.length < 2) {
    return { changePct: 0, last24h: [] as number[] };
  }
  const last = history[history.length - 1].price;
  const prev = history[history.length - 2].price;
  const changePct = prev > 0 ? (last - prev) / prev : 0;
  const last24h = history.slice(-24).map((point) => point.price);
  return { changePct, last24h };
}

export function isHighEfficiency(question: string) {
  const lower = question.toLowerCase();
  return CONFIG.HIGH_EFFICIENCY_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function sumDepth(levels: { size: string; price: string }[], depth = 3) {
  return levels.slice(0, depth).reduce((acc, level) => acc + toNumber(level.size, 0), 0);
}

export function analyzeOrderBook(tokenId: string, orderBook: OrderBook) {
  const bestBid = orderBook.bids?.[0] ? toNumber(orderBook.bids[0].price) : 0;
  const bestAsk = orderBook.asks?.[0] ? toNumber(orderBook.asks[0].price) : 0;
  const spread = bestAsk && bestBid ? Math.abs(bestAsk - bestBid) : 0;

  const depthAsk = sumDepth(orderBook.asks ?? []);
  const depthBid = sumDepth(orderBook.bids ?? []);
  const snapshotKey = `orderbook:${tokenId}`;
  const prev = getCache<{ ts: number; depthAsk: number; depthBid: number }>(snapshotKey, CONFIG.CACHE_TTL_SECONDS);

  const now = Date.now();
  const deltaSeconds = prev ? (now - prev.ts) / 1000 : null;
  const askSweep = prev && deltaSeconds !== null && deltaSeconds < 120 && prev.depthAsk > 0
    ? depthAsk / prev.depthAsk < 0.45
    : false;
  const bidSweep = prev && deltaSeconds !== null && deltaSeconds < 120 && prev.depthBid > 0
    ? depthBid / prev.depthBid < 0.45
    : false;

  setCache(snapshotKey, { ts: now, depthAsk, depthBid });

  const spreadKey = `spread:${tokenId}`;
  const spreadHistory = getCache<number[]>(spreadKey, CONFIG.CACHE_TTL_SECONDS * 10) ?? [];
  const updatedHistory = [...spreadHistory, spread].slice(-24);
  setCache(spreadKey, updatedHistory);
  const avgSpread = updatedHistory.reduce((acc, value) => acc + value, 0) / Math.max(updatedHistory.length, 1);
  const spreadTightened = avgSpread > 0 ? spread < avgSpread * 0.6 : false;

  return {
    bestBid,
    bestAsk,
    spread,
    avgSpread,
    spreadTightened,
    askSweep,
    bidSweep
  };
}

export function liquidityScore(liquidity: number) {
  if (liquidity <= 0) return 0;
  const score = Math.max(0, 1 - liquidity / CONFIG.LIQUIDITY_NICHE_MAX);
  return Number(score.toFixed(2));
}

export function volumeSpike(volume24h: number) {
  return volume24h > 25000;
}
