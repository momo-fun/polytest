import { NextResponse } from "next/server";
import { CONFIG } from "../../../lib/config";
import {
  fetchMarkets,
  extractYesNoTokenIds,
  getMarketQuestion,
  getMarketId
} from "../../../lib/polymarket";
import { analyzeOrderBook, volumeSpike } from "../../../lib/analysis";
import { mapLimit, toNumber } from "../../../lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const markets = await fetchMarkets(60);

    const enriched = await mapLimit(markets, 5, async (market) => {
      const question = getMarketQuestion(market);
      const { yesTokenId, noTokenId } = extractYesNoTokenIds(market);
      const volume24h = toNumber(market.volume24h ?? market.volume24hr, 0);

      if (!yesTokenId || !noTokenId) {
        return {
          id: getMarketId(market),
          question,
          signal: "insufficient data",
          aggressive: false,
          spreadTightened: false,
          volumeSpike: volumeSpike(volume24h)
        };
      }

      let yesBook;
      let noBook;
      try {
        const { fetchOrderBook } = await import("../../../lib/polymarket");
        [yesBook, noBook] = await Promise.all([
          fetchOrderBook(yesTokenId),
          fetchOrderBook(noTokenId)
        ]);
      } catch {
        return {
          id: getMarketId(market),
          question,
          signal: "orderbook unavailable",
          aggressive: false,
          spreadTightened: false,
          volumeSpike: volumeSpike(volume24h)
        };
      }

      const yesMetrics = analyzeOrderBook(yesTokenId, yesBook);
      const noMetrics = analyzeOrderBook(noTokenId, noBook);

      const aggressive = yesMetrics.askSweep || yesMetrics.bidSweep || noMetrics.askSweep || noMetrics.bidSweep;
      const spreadTightened = yesMetrics.spreadTightened || noMetrics.spreadTightened;

      return {
        id: getMarketId(market),
        question,
        aggressive,
        spreadTightened,
        volumeSpike: volumeSpike(volume24h),
        yes: {
          spread: yesMetrics.spread,
          askSweep: yesMetrics.askSweep,
          bidSweep: yesMetrics.bidSweep
        },
        no: {
          spread: noMetrics.spread,
          askSweep: noMetrics.askSweep,
          bidSweep: noMetrics.bidSweep
        }
      };
    });

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      markets: enriched
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
