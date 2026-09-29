import React, { useMemo } from 'react';
import {
  Activity,
  Layers,
  TrendingUp,
  TrendingDown,
  Compass,
  Zap,
  ShieldAlert,
  BarChart3,
  DollarSign,
  Radio,
} from 'lucide-react';

interface LiveMarketRadarProps {
  pair: string;
  currentPrice: number;
  orderbook: { bids: [string, string][]; asks: [string, string][] };
  high24h: number;
  low24h: number;
}

export const LiveMarketRadar: React.FC<LiveMarketRadarProps> = ({
  pair,
  currentPrice,
  orderbook,
  high24h,
  low24h,
}) => {
  // Analyze Orderbook depth & imbalances
  const {
    buyVolume,
    sellVolume,
    buyRatio,
    sellRatio,
    whaleBids,
    whaleAsks,
    liquidityScore,
    sentiment,
    estimatedFundingRate,
  } = useMemo(() => {
    const bids = orderbook.bids.slice(0, 15);
    const asks = orderbook.asks.slice(0, 15);

    let bVol = 0;
    let aVol = 0;
    const wBids: { price: number; amountUsdt: number }[] = [];
    const wAsks: { price: number; amountUsdt: number }[] = [];

    bids.forEach(([p, q]) => {
      const price = parseFloat(p);
      const qty = parseFloat(q);
      const notional = price * qty;
      bVol += notional;
      if (notional > 15000) {
        wBids.push({ price, amountUsdt: Math.round(notional) });
      }
    });

    asks.forEach(([p, q]) => {
      const price = parseFloat(p);
      const qty = parseFloat(q);
      const notional = price * qty;
      aVol += notional;
      if (notional > 15000) {
        wAsks.push({ price, amountUsdt: Math.round(notional) });
      }
    });

    const total = bVol + aVol;
    const bRatio = total > 0 ? Math.round((bVol / total) * 100) : 50;
    const aRatio = 100 - bRatio;

    // Determine sentiment
    let sent = 'محايد (Neutral)';
    if (bRatio >= 65) sent = 'شراء مكثف (Bullish Flow)';
    else if (bRatio >= 55) sent = 'ميل إيجابي (Mild Bullish)';
    else if (aRatio >= 65) sent = 'ضغط بيع قوي (Bearish Flow)';
    else if (aRatio >= 55) sent = 'ميل سلبي (Mild Bearish)';

    // Score
    const score = total > 500000 ? 'A+' : total > 200000 ? 'A' : total > 50000 ? 'B' : 'C';

    // Simulated/Calculated Funding Rate
    const funding = (bRatio > 55 ? 0.01 : bRatio < 45 ? -0.008 : 0.005).toFixed(4);

    return {
      buyVolume: bVol,
      sellVolume: aVol,
      buyRatio: bRatio,
      sellRatio: aRatio,
      whaleBids: wBids.slice(0, 3),
      whaleAsks: wAsks.slice(0, 3),
      liquidityScore: score,
      sentiment: sent,
      estimatedFundingRate: funding,
    };
  }, [orderbook]);

  return (
    <div
      id="live-market-radar-panel"
      className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-xl flex flex-col gap-3 text-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-700/50 text-indigo-400">
            <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <span>رادار السيولة وتدفقات السوق (Market Liquidity Pulse)</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono">
                {pair}
              </span>
            </h4>
            <span className="text-[10px] text-slate-400">مراقبة حية لدفتر الأوامر، الحيتان، ونبض السيولة</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300 font-bold">
            جودة السيولة: {liquidityScore}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-300">
            معدل التمويل: {estimatedFundingRate}%
          </span>
        </div>
      </div>

      {/* Imbalance Meter Bar */}
      <div className="flex flex-col gap-1.5 bg-slate-950/80 p-3 rounded-lg border border-slate-850">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className="text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            طلبات الشراء (Bids): {buyRatio}% (${Math.round(buyVolume).toLocaleString()})
          </span>
          <span className="text-slate-400 font-bold">{sentiment}</span>
          <span className="text-rose-400 flex items-center gap-1">
            طلبات البيع (Asks): {sellRatio}% (${Math.round(sellVolume).toLocaleString()})
            <TrendingDown className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Visual Dual-Color Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${buyRatio}%` }}
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
          />
          <div
            style={{ width: `${sellRatio}%` }}
            className="h-full bg-gradient-to-r from-rose-500 to-rose-700 transition-all duration-500"
          />
        </div>
      </div>

      {/* Whale Walls & Large Orders Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Whale Buy Walls */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-emerald-950/60 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
            <span>جدران الشراء الكبرى (Whale Bids 🐋)</span>
            <span className="text-[10px] text-slate-500">حماية الدعم</span>
          </div>
          {whaleBids.length === 0 ? (
            <span className="text-[10px] text-slate-500 py-1">لا توجد جدران حيتان شاذة حالياً</span>
          ) : (
            <div className="flex flex-col gap-1">
              {whaleBids.map((b, idx) => (
                <div key={idx} className="flex justify-between items-center text-[10px] font-mono text-slate-300">
                  <span className="text-emerald-300 font-bold">${b.price.toLocaleString()}</span>
                  <span className="bg-emerald-950/80 px-1.5 py-0.2 rounded text-emerald-400 border border-emerald-800/40">
                    ${b.amountUsdt.toLocaleString()} USDT
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Whale Sell Walls */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-rose-950/60 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-rose-400 font-bold">
            <span>جدران البيع الكبرى (Whale Asks 🐋)</span>
            <span className="text-[10px] text-slate-500">مستويات المقاومة</span>
          </div>
          {whaleAsks.length === 0 ? (
            <span className="text-[10px] text-slate-500 py-1">لا توجد جدران حيتان شاذة حالياً</span>
          ) : (
            <div className="flex flex-col gap-1">
              {whaleAsks.map((a, idx) => (
                <div key={idx} className="flex justify-between items-center text-[10px] font-mono text-slate-300">
                  <span className="text-rose-300 font-bold">${a.price.toLocaleString()}</span>
                  <span className="bg-rose-950/80 px-1.5 py-0.2 rounded text-rose-400 border border-rose-800/40">
                    ${a.amountUsdt.toLocaleString()} USDT
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
