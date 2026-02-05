"use client";

import { useEffect, useMemo, useState } from "react";
import Sparkline from "../components/Sparkline";
import SignalBadge from "../components/SignalBadge";
import Toggle from "../components/Toggle";

const POLL_MS = 60_000;

type VelocityMarket = {
  id: string;
  question: string;
  tags: string[];
  yesPrice: number;
  noPrice: number;
  changePct: number;
  last24h: number[];
  liquidity: number;
  volume24h: number;
  sentiment: { mentions: number; score: number };
  silentMove: boolean;
};

type InsiderMarket = {
  id: string;
  question: string;
  tags: string[];
  liquidity: number;
  volume24h: number;
  efficiency: boolean;
  nicheScore: number;
  largeMove: boolean;
  topBuyers: Array<{ address: string; usd: number; fresh: boolean | null; firstSeen?: number | null }>;
  freshSignal: boolean;
};

type OrderFlowMarket = {
  id: string;
  question: string;
  aggressive: boolean;
  spreadTightened: boolean;
  volumeSpike: boolean;
  yes?: { spread: number; askSweep: boolean; bidSweep: boolean };
  no?: { spread: number; askSweep: boolean; bidSweep: boolean };
  signal?: string;
};

type ApiState<T> = {
  updatedAt?: string;
  error?: string;
  markets: T[];
};

function usePolling<T>(url: string, fallback: ApiState<T>) {
  const [data, setData] = useState<ApiState<T>>(fallback);
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (active) {
          setData(json);
        }
      } catch (error) {
        if (active) {
          setData({ ...fallback, error: (error as Error).message });
        }
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [url]);

  return data;
}

function formatPct(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number) {
  if (!value) return "-";
  if (value > 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value > 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function trimAddress(address: string) {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Home() {
  const velocity = usePolling<VelocityMarket>("/api/velocity", { markets: [] });
  const insider = usePolling<InsiderMarket>("/api/insider", { markets: [] });
  const orderflow = usePolling<OrderFlowMarket>("/api/orderflow", { markets: [] });

  const [hideEfficient, setHideEfficient] = useState(true);
  const [silentOnly, setSilentOnly] = useState(false);

  const velocityMarkets = useMemo(() => {
    const markets = velocity.markets ?? [];
    return silentOnly ? markets.filter((market) => market.silentMove) : markets;
  }, [velocity, silentOnly]);

  const insiderMarkets = useMemo(() => {
    const markets = insider.markets ?? [];
    return hideEfficient ? markets.filter((market) => !market.efficiency) : markets;
  }, [insider, hideEfficient]);

  return (
    <main>
      <header>
        <div>
          <h1>Polymarket Alpha-Tracker</h1>
          <p className="tagline">Informed Momentum Radar · Local MVP</p>
        </div>
        <div className="badges">
          <span className="badge">Velocity</span>
          <span className="badge">Insider</span>
          <span className="badge">Order Flow</span>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <div className="section-title">
            <h2>Velocity Screener</h2>
            <span>Hourly ±10%</span>
          </div>
          <div className="filter-row">
            <Toggle checked={silentOnly} label="Silent moves only" onChange={setSilentOnly} />
            <span className="note">RSS sentiment + price spikes</span>
          </div>
          <div className="table" style={{ marginTop: 16 }}>
            <div className="row header">
              <div>Market</div>
              <div>Change</div>
              <div>Trend</div>
              <div>Signal</div>
            </div>
            {velocityMarkets.length === 0 && <p className="note">Waiting on Polymarket data…</p>}
            {velocityMarkets.map((market) => (
              <div className="row" key={market.id}>
                <div className="row-title">
                  <strong>{market.question}</strong>
                  <span>Liquidity {formatUsd(market.liquidity)}</span>
                </div>
                <div className="metric">
                  {formatPct(market.changePct)}
                  <div className="note">YES {market.yesPrice.toFixed(2)}</div>
                </div>
                <div>
                  <Sparkline data={market.last24h} color={market.changePct >= 0 ? "#54e39d" : "#ff6b6b"} />
                </div>
                <div>
                  {market.silentMove ? (
                    <SignalBadge label="Silent move" variant="warn" />
                  ) : (
                    <SignalBadge label="Visible momentum" variant="success" />
                  )}
                  <div className="note">Mentions {market.sentiment.mentions}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="footer">
            Updated {velocity.updatedAt ? new Date(velocity.updatedAt).toLocaleTimeString() : "--"}
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <h2>Insider Filter</h2>
            <span>Niche + Fresh Wallets</span>
          </div>
          <div className="filter-row">
            <Toggle checked={hideEfficient} label="Hide high-efficiency" onChange={setHideEfficient} />
            <span className="note">Low-liquidity + real-world outcomes</span>
          </div>
          <div className="table" style={{ marginTop: 16 }}>
            <div className="row header">
              <div>Market</div>
              <div>Niche</div>
              <div>Wallets</div>
              <div>Signal</div>
            </div>
            {insiderMarkets.length === 0 && <p className="note">Waiting on market metadata…</p>}
            {insiderMarkets.map((market) => (
              <div className="row" key={market.id}>
                <div className="row-title">
                  <strong>{market.question}</strong>
                  <span>Liquidity {formatUsd(market.liquidity)}</span>
                </div>
                <div className="metric">{(market.nicheScore * 100).toFixed(0)}%</div>
                <div className="stack">
                  {market.topBuyers.length === 0 && <span className="note">No buyers yet</span>}
                  {market.topBuyers.map((buyer) => (
                    <div key={buyer.address} className="note">
                      {trimAddress(buyer.address)} · {formatUsd(buyer.usd)}
                    </div>
                  ))}
                </div>
                <div>
                  {market.freshSignal ? (
                    <SignalBadge label="Fresh wallets" variant="danger" />
                  ) : market.largeMove ? (
                    <SignalBadge label="Large move" variant="warn" />
                  ) : (
                    <SignalBadge label="Quiet" variant="success" />
                  )}
                  <div className="note">
                    {market.topBuyers.some((buyer) => buyer.fresh === null)
                      ? "Enable Polygonscan key"
                      : "Wallets aged"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="footer">
            Updated {insider.updatedAt ? new Date(insider.updatedAt).toLocaleTimeString() : "--"}
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <h2>Order Book Aggression</h2>
            <span>Market sweeps</span>
          </div>
          <div className="table" style={{ marginTop: 16 }}>
            <div className="row header">
              <div>Market</div>
              <div>Spread</div>
              <div>Flow</div>
              <div>Signal</div>
            </div>
            {orderflow.markets.length === 0 && <p className="note">Waiting on order books…</p>}
            {orderflow.markets.map((market) => (
              <div className="row" key={market.id}>
                <div className="row-title">
                  <strong>{market.question}</strong>
                  <span>YES spread {market.yes?.spread?.toFixed(3) ?? "-"}</span>
                </div>
                <div className="metric">
                  {market.spreadTightened ? "Tightening" : "Stable"}
                </div>
                <div className="stack">
                  <span className="note">YES sweep: {market.yes?.askSweep ? "Yes" : "No"}</span>
                  <span className="note">NO sweep: {market.no?.askSweep ? "Yes" : "No"}</span>
                </div>
                <div>
                  {market.aggressive ? (
                    <SignalBadge label="Aggressive" variant="danger" />
                  ) : market.spreadTightened ? (
                    <SignalBadge label="Tight spread" variant="warn" />
                  ) : (
                    <SignalBadge label="Calm" variant="success" />
                  )}
                  <div className="note">Volume spike {market.volumeSpike ? "Yes" : "No"}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="footer">
            Updated {orderflow.updatedAt ? new Date(orderflow.updatedAt).toLocaleTimeString() : "--"}
          </div>
        </section>
      </div>
    </main>
  );
}
