export const CONFIG = {
  MAX_MARKETS: Number(process.env.MAX_MARKETS ?? "100"),
  VELOCITY_THRESHOLD: Number(process.env.VELOCITY_THRESHOLD ?? "0.1"),
  RSS_FEEDS:
    process.env.RSS_FEEDS?.split(",").map((feed) => feed.trim()).filter(Boolean) ?? [
      "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
      "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
      "https://feeds.reuters.com/Reuters/PoliticsNews",
      "https://feeds.reuters.com/news/world",
      "https://www.politico.com/rss/politics08.xml",
      "https://www.wsj.com/xml/rss/3_7031.xml"
    ],
  HIGH_EFFICIENCY_KEYWORDS:
    process.env.HIGH_EFFICIENCY_KEYWORDS?.split(",").map((word) => word.trim().toLowerCase()).filter(Boolean) ?? [
      "btc",
      "bitcoin",
      "eth",
      "ethereum",
      "sol",
      "solana",
      "xrp",
      "bnb",
      "doge",
      "aapl",
      "apple",
      "msft",
      "microsoft",
      "googl",
      "google",
      "amzn",
      "amazon",
      "nvda",
      "nvidia",
      "meta",
      "tesla",
      "tsla"
    ],
  POLITICS_TAGS:
    process.env.POLITICS_TAGS?.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean) ?? [
      "politics",
      "elections",
      "government",
      "policy",
      "white house",
      "congress"
    ],
  FINANCE_TAGS:
    process.env.FINANCE_TAGS?.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean) ?? [
      "finance",
      "macro",
      "markets",
      "economy",
      "rates",
      "fed"
    ],
  LIQUIDITY_NICHE_MAX: Number(process.env.LIQUIDITY_NICHE_MAX ?? "75000"),
  SENTIMENT_MENTIONS_LOW: Number(process.env.SENTIMENT_MENTIONS_LOW ?? "2"),
  CACHE_TTL_SECONDS: Number(process.env.CACHE_TTL_SECONDS ?? "240"),
  CLOB_API: process.env.CLOB_API ?? "https://clob.polymarket.com",
  GAMMA_API: process.env.GAMMA_API ?? "https://gamma-api.polymarket.com",
  DATA_API: process.env.DATA_API ?? "https://data-api.polymarket.com",
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com",
  POLYGONSCAN_API_KEY: process.env.POLYGONSCAN_API_KEY
};
