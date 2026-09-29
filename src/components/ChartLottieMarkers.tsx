import React, { useState } from 'react';
import { Lottie } from 'lottie-react';
import {
  entryLongLottie,
  entryShortLottie,
  exitProfitLottie,
  exitLossLottie,
} from '../lib/lottieAnimations.ts';
import type { TradeRecord } from '../lib/firestoreService.ts';
import type { KlineBar } from './TradingChart.tsx';
import { TrendingUp, TrendingDown, Target, Zap, Clock, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

interface ChartLottieMarkersProps {
  trades: TradeRecord[];
  klines: KlineBar[];
  pair: string;
  getX: (index: number) => number;
  getY: (price: number) => number;
  svgWidth: number;
  mainHeight: number;
  paddingLeft: number;
  paddingRight: number;
}

interface ActiveTooltipData {
  trade: TradeRecord;
  type: 'ENTRY' | 'EXIT';
  x: number;
  y: number;
}

export const ChartLottieMarkers: React.FC<ChartLottieMarkersProps> = ({
  trades,
  klines,
  pair,
  getX,
  getY,
  svgWidth,
  mainHeight,
  paddingLeft,
  paddingRight,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltipData | null>(null);

  if (!klines || klines.length === 0 || !trades || trades.length === 0) {
    return null;
  }

  // Filter trades for current symbol
  const relevantTrades = trades.filter(
    t => t.pair === pair || t.pair.replace('-', '') === pair.replace('-', '')
  );

  if (relevantTrades.length === 0) return null;

  // Find index in klines closest to timestamp
  const findClosestIndex = (timestampStr?: string, defaultIndex = klines.length - 1) => {
    if (!timestampStr) return defaultIndex;
    const timeMs = new Date(timestampStr).getTime();
    if (isNaN(timeMs)) return defaultIndex;

    let closestIdx = 0;
    let minDiff = Infinity;

    for (let i = 0; i < klines.length; i++) {
      const diff = Math.abs(klines[i].time - timeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20">
      {relevantTrades.map((trade, idx) => {
        const isLong = trade.side === 'LONG' || trade.side === 'BUY';
        const entryIdx = findClosestIndex(trade.createdAt, Math.max(0, klines.length - 1 - (idx * 6 + 4)));
        const entryX = getX(entryIdx);
        const entryY = getY(trade.entryPrice);

        // Clamping to visible chart area
        const isEntryVisible = entryX >= paddingLeft && entryX <= svgWidth - paddingRight;

        // Exit marker if closed
        const isClosed = trade.status === 'CLOSED';
        const exitIdx = isClosed ? findClosestIndex(trade.closedAt, Math.min(klines.length - 1, entryIdx + 5)) : null;
        const exitX = exitIdx !== null ? getX(exitIdx) : null;
        const exitPrice = trade.exitPrice || (exitIdx !== null && klines[exitIdx] ? klines[exitIdx].close : trade.entryPrice);
        const exitY = exitIdx !== null ? getY(exitPrice) : null;
        const isExitVisible = exitX !== null && exitX >= paddingLeft && exitX <= svgWidth - paddingRight;

        const isProfitable = (trade.pnl ?? 0) >= 0;

        return (
          <React.Fragment key={`trade-marker-${trade.id || idx}`}>
            {/* ENTRY LOTTIE MARKER */}
            {isEntryVisible && (
              <div
                className="absolute pointer-events-auto cursor-pointer transition-transform duration-200 hover:scale-125 z-30 group"
                style={{
                  left: `${(entryX / svgWidth) * 100}%`,
                  top: `${(entryY / (mainHeight + 105)) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => {
                  setActiveTooltip({
                    trade,
                    type: 'ENTRY',
                    x: entryX,
                    y: entryY,
                  });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => {
                  setActiveTooltip(prev =>
                    prev?.trade.id === trade.id && prev.type === 'ENTRY'
                      ? null
                      : { trade, type: 'ENTRY', x: entryX, y: entryY }
                  );
                }}
              >
                <div className="relative flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center p-0.5 shadow-lg border backdrop-blur-sm ${
                      isLong
                        ? 'bg-emerald-950/80 border-emerald-400 shadow-emerald-500/40 text-emerald-400'
                        : 'bg-rose-950/80 border-rose-500 shadow-rose-500/40 text-rose-400'
                    }`}
                  >
                    <Lottie
                      src={isLong ? (entryLongLottie as any) : (entryShortLottie as any)}
                      loop
                      autoplay
                      className="w-full h-full"
                    />
                  </div>
                  {/* Mini badge */}
                  <span
                    className={`text-[8.5px] font-bold px-1 py-0.2 rounded-full border shadow-xs mt-0.5 tracking-tighter ${
                      isLong
                        ? 'bg-emerald-900/90 text-emerald-200 border-emerald-600'
                        : 'bg-rose-900/90 text-rose-200 border-rose-600'
                    }`}
                  >
                    {isLong ? 'دخول L' : 'دخول S'}
                  </span>
                </div>
              </div>
            )}

            {/* EXIT LOTTIE MARKER */}
            {isClosed && isExitVisible && exitX !== null && exitY !== null && (
              <div
                className="absolute pointer-events-auto cursor-pointer transition-transform duration-200 hover:scale-125 z-30 group"
                style={{
                  left: `${(exitX / svgWidth) * 100}%`,
                  top: `${(exitY / (mainHeight + 105)) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => {
                  setActiveTooltip({
                    trade,
                    type: 'EXIT',
                    x: exitX,
                    y: exitY,
                  });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => {
                  setActiveTooltip(prev =>
                    prev?.trade.id === trade.id && prev.type === 'EXIT'
                      ? null
                      : { trade, type: 'EXIT', x: exitX, y: exitY }
                  );
                }}
              >
                <div className="relative flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center p-0.5 shadow-lg border backdrop-blur-sm ${
                      isProfitable
                        ? 'bg-amber-950/85 border-amber-400 shadow-amber-500/50 text-amber-300'
                        : 'bg-rose-950/85 border-rose-600 shadow-rose-600/40 text-rose-400'
                    }`}
                  >
                    <Lottie
                      src={isProfitable ? (exitProfitLottie as any) : (exitLossLottie as any)}
                      loop
                      autoplay
                      className="w-full h-full"
                    />
                  </div>
                  {/* Mini exit badge */}
                  <span
                    className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border shadow-xs mt-0.5 tracking-tighter ${
                      isProfitable
                        ? 'bg-amber-900/90 text-amber-200 border-amber-500'
                        : 'bg-rose-950/90 text-rose-300 border-rose-700'
                    }`}
                  >
                    {isProfitable ? `+${(trade.pnlPercentage ?? 0).toFixed(1)}%` : `${(trade.pnlPercentage ?? 0).toFixed(1)}%`}
                  </span>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* RICH HOVER TOOLTIP */}
      {activeTooltip && (
        <div
          className="absolute z-50 pointer-events-auto transform -translate-x-1/2 -translate-y-full mb-3 w-64 bg-slate-950/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-right text-xs"
          style={{
            left: `${Math.max(130, Math.min(svgWidth - 130, activeTooltip.x)) / svgWidth * 100}%`,
            top: `${Math.max(40, (activeTooltip.y / (mainHeight + 105)) * 100)}%`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                activeTooltip.trade.side === 'LONG' || activeTooltip.trade.side === 'BUY'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : 'bg-rose-950 text-rose-300 border-rose-700'
              }`}
            >
              {activeTooltip.trade.side === 'LONG' || activeTooltip.trade.side === 'BUY' ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-400" />
              )}
              <span>{activeTooltip.type === 'ENTRY' ? 'نقطة دخول صفقة' : 'نقطة إغلاق صفقة'}</span>
            </span>

            <span className="text-[10px] text-slate-400 font-mono">
              {activeTooltip.trade.status === 'CLOSED' ? (
                <span className="text-slate-300 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> مغلقة
                </span>
              ) : (
                <span className="text-cyan-400 flex items-center gap-1 animate-pulse">
                  <Zap className="w-2.5 h-2.5 text-amber-400" /> جارية (Open)
                </span>
              )}
            </span>
          </div>

          {/* Core Execution & PnL Metrics */}
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">سعر الدخول:</span>
              <span className="text-cyan-300 font-bold">${activeTooltip.trade.entryPrice.toLocaleString()}</span>
            </div>

            {activeTooltip.trade.exitPrice && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">سعر الإغلاق:</span>
                <span className="text-white font-bold">${activeTooltip.trade.exitPrice.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
              <span className="text-slate-300 font-sans font-medium">الربح / الخسارة (P/L):</span>
              <span
                className={`font-bold text-xs ${
                  (activeTooltip.trade.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {(activeTooltip.trade.pnl ?? 0) >= 0 ? '+' : ''}
                ${(activeTooltip.trade.pnl ?? 0).toFixed(2)}{' '}
                <span className="text-[10px]">
                  ({(activeTooltip.trade.pnlPercentage ?? 0) >= 0 ? '+' : ''}
                  {(activeTooltip.trade.pnlPercentage ?? 0).toFixed(1)}%)
                </span>
              </span>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span>الرافعة وحجم العقد:</span>
              <span className="text-slate-200">
                {activeTooltip.trade.leverage || 10}x | ${(activeTooltip.trade.amount || 500).toLocaleString()}
              </span>
            </div>

            {activeTooltip.trade.source && (
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-sans">
                <span>الوكيل المنفّذ:</span>
                <span className="text-purple-300 truncate max-w-[130px] font-medium">
                  {activeTooltip.trade.source}
                </span>
              </div>
            )}

            {activeTooltip.trade.createdAt && (
              <div className="flex items-center gap-1 text-[9px] text-slate-500 pt-1 justify-end font-sans">
                <Clock className="w-2.5 h-2.5" />
                <span>{new Date(activeTooltip.trade.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
