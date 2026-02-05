import { CONFIG } from "./config";
import { toNumber } from "./utils";

export type Market = {
  id?: number | string;
  conditionId?: string;
  question?: string;
  title?: string;
  clobTokenIds?: string[];
  outcomes?: string[];
  outcomePrices?: string[];
  tokens?: Array<{
    token_id?: string;
    outcome?: string;
    name?: string;
  }>;
  category?: string;
  subcategory?: string;
  tags?: Array<string | { name?: string; slug?: string }>;
  liquidity?: number | string;
  volume?: number | string;
  volume24hr?: number | string;
  volume24h?: number | string;
};

export type OrderBookLevel = {
  price: string;
  size: string;
};

export type OrderBook = {
  market: string;
  asset_id: string;
  timestamp: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  min_order_size: string;
  tick_size: string;
  neg_risk: boolean;
  hash: string;
};

export async function fetchMarkets(limit = CONFIG.MAX_MARKETS) {
  const url = new URL(`${CONFIG.GAMMA_API}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Gamma API error: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? (data as Market[]) : (data?.markets as Market[]) ?? [];
}

export function getMarketQuestion(market: Market) {
  return market.question || market.title || "Untitled market";
}

export function getMarketId(market: Market) {
  return market.id?.toString() ?? market.conditionId ?? "";
}

export function extractOutcomes(market: Market) {
  return market.outcomes ?? [];
}

export function extractTokenIds(market: Market) {
  if (market.clobTokenIds && market.clobTokenIds.length) {
    return market.clobTokenIds;
  }
  const tokens = market.tokens ?? [];
  if (tokens.length) {
    return tokens.map((token) => token.token_id || "");
  }
  return [];
}

export function extractTokenByOutcome(market: Market, desired: string) {
  const outcomes = extractOutcomes(market);
  const tokenIds = extractTokenIds(market);
  const index = outcomes.findIndex(
    (outcome) => outcome.toLowerCase() === desired.toLowerCase()
  );
  if (index >= 0 && tokenIds[index]) return tokenIds[index];

  const tokens = market.tokens ?? [];
  const token = tokens.find(
    (item) =>
      item.outcome?.toLowerCase() === desired.toLowerCase() ||
      item.name?.toLowerCase() === desired.toLowerCase()
  );
  return token?.token_id;
}

export function extractYesNoTokenIds(market: Market) {
  const yesTokenId = extractTokenByOutcome(market, "Yes");
  const noTokenId = extractTokenByOutcome(market, "No");
  const tokenIds = extractTokenIds(market);
  return {
    yesTokenId: yesTokenId ?? tokenIds[0],
    noTokenId: noTokenId ?? tokenIds[1]
  };
}

export function extractOutcomePrices(market: Market) {
  const outcomes = extractOutcomes(market);
  const prices = market.outcomePrices ?? [];
  const yesIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === "yes");
  const noIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === "no");
  return {
    yes: toNumber(prices[yesIndex], 0),
    no: toNumber(prices[noIndex], 0)
  };
}

export function extractTags(market: Market) {
  const tags: string[] = [];
  if (market.category) tags.push(market.category);
  if (market.subcategory) tags.push(market.subcategory);
  if (Array.isArray(market.tags)) {
    for (const tag of market.tags) {
      if (typeof tag === "string") tags.push(tag);
      else if (tag?.name) tags.push(tag.name);
      else if (tag?.slug) tags.push(tag.slug);
    }
  }
  return tags.map((tag) => tag.toLowerCase());
}

export async function fetchPriceHistory(tokenId: string) {
  const url = new URL(`${CONFIG.CLOB_API}/prices-history`);
  url.searchParams.set("market", tokenId);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("fidelity", "60");
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`CLOB price history error: ${res.status}`);
  }
  const data = await res.json();
  const history = (data?.history ?? []) as Array<{ t: number; p: number }>;
  return history.map((point) => ({
    timestamp: point.t,
    price: Number(point.p)
  }));
}

export async function fetchOrderBook(tokenId: string) {
  const url = new URL(`${CONFIG.CLOB_API}/book`);
  url.searchParams.set("token_id", tokenId);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`CLOB orderbook error: ${res.status}`);
  }
  const data = (await res.json()) as OrderBook;
  return data;
}
