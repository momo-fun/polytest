# Polymarket Alpha-Tracker (Local MVP)

Real-time Polymarket intelligence dashboard focused on informed momentum. Three modules:

- Velocity Screener: hourly price moves with 24h sparklines + low-sentiment "silent move" flags.
- Insider Filter: niche/low-liquidity markets + top buyer wallet heuristics.
- Order Book Aggression: market sweep + spread tightening detection.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment config

All configuration lives in `.env.local`. See `.env.example` for defaults.

Optional but useful:

- `POLYGONSCAN_API_KEY` enables wallet age checks for "fresh wallet" flags.
- `RSS_FEEDS` controls sentiment inputs.
- `MAX_MARKETS` caps markets to keep the MVP responsive.

## Endpoints

- `GET /api/velocity` — markets with hourly price swings, sentiment, 24h sparklines
- `GET /api/insider` — niche filter, top buyers, fresh wallet signal (optional)
- `GET /api/orderflow` — order book aggression + spread watch
- `GET /api/health`

## Notes

- Market metadata is pulled from the Polymarket Gamma API.
- Price history and order books come from the Polymarket CLOB API.
- Wallet freshness uses Polygonscan when a key is provided.

If you want, I can add more sophisticated sentiment models or on-chain analytics once the MVP feels right.

## Deploy (Vercel)

1. Push this repo to GitHub.
2. In Vercel, import the repo as a new project.
3. Add environment variables from `.env.example` in the project settings.
4. Deploy.

Notes:
- Serverless file storage is ephemeral; SQLite here is used only for short-lived caching.

