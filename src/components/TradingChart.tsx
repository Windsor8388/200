import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Sliders,
  Zap,
  Activity,
  Compass,
  CheckCircle2,
  Crosshair,
  Info,
} from 'lucide-react';
import {
  calculateEMA,
  calculateSMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  detectTradingOpportunities,
  type TradingOpportunity,
} from '../lib/indicators.ts';
import { BingXTradingViewChart } from './BingXTradingViewChart.tsx';

export interface KlineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingChartProps {
  pair: string;
  klines: KlineBar[];
  interval: string;
  onIntervalChange: (interval: string) => void;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  isLoading?: boolean;
  onSelectOpportunity?: (opp: TradingOpportunity) => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  pair,
  klines,
  interval,
  onIntervalChange,
  entryPrice,
  stopLoss,
  takeProfit,
  takeProfit2,
  takeProfit3,
  isLoading = false,
  onSelectOpportunity,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showIndicators, setShowIndicators] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [subIndicator, setSubIndicator] = useState<'RSI' | 'MACD'>('MACD');
  const [selectedOpportunity, setSelectedOpportunity] = useState<TradingOpportunity | null>(null);
  const [chartViewMode, setChartViewMode] = useState<'tradingview' | 'ai-pattern'>('tradingview');

  const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

  // Calculate all technical indicators
  const {
    ema20,
    ema50,
    sma200,
    bb,
    rsi,
    macd,
    opportunities,
    minPrice,
    maxPrice,
    maxVolume,
  } = useMemo(() => {
    if (!klines || klines.length === 0) {
      return {
        ema20: [],
        ema50: [],
        sma200: [],
        bb: { upper: [], middle: [], lower: [] },
        rsi: [],
        macd: { macdLine: [], signalLine: [], histogram: [] },
        opportunities: [],
        minPrice: 0,
        maxPrice: 1,
        maxVolume: 1,
      };
    }

    const prices = klines.map(k => k.close);
    let min = Math.min(...klines.map(k => k.low));
    let max = Math.max(...klines.map(k => k.high));
    const maxVol = Math.max(...klines.map(k => k.volume), 1);

    // Calculate indicators
    const e20 = calculateEMA(prices, 20);
    const e50 = calculateEMA(prices, 50);
    const s200 = calculateSMA(prices, Math.min(200, Math.max(20, Math.floor(prices.length * 0.8))));
    const bBands = calculateBollingerBands(prices, 20, 2);
    const rsiData = calculateRSI(prices, 14);
    const macdData = calculateMACD(prices, 12, 26, 9);
    const opps = detectTradingOpportunities(klines, e20, e50, rsiData, macdData, bBands);

    // Expand bounds if overlay levels exist
    if (entryPrice) {
      min = Math.min(min, entryPrice);
      max = Math.max(max, entryPrice);
    }
    if (stopLoss) {
      min = Math.min(min, stopLoss);
      max = Math.max(max, stopLoss);
    }
    if (takeProfit) {
      min = Math.min(min, takeProfit);
      max = Math.max(max, takeProfit);
    }
    if (takeProfit2) {
      min = Math.min(min, takeProfit2);
      max = Math.max(max, takeProfit2);
    }
    if (takeProfit3) {
      min = Math.min(min, takeProfit3);
      max = Math.max(max, takeProfit3);
    }

    // Add Bollinger limits to scale if enabled
    bBands.upper.forEach(val => {
      if (val !== null) max = Math.max(max, val);
    });
    bBands.lower.forEach(val => {
      if (val !== null) min = Math.min(min, val);
    });

    const padding = (max - min) * 0.08;
    min -= padding;
    max += padding;

    return {
      ema20: e20,
      ema50: e50,
      sma200: s200,
      bb: bBands,
      rsi: rsiData,
      macd: macdData,
      opportunities: opps,
      minPrice: min,
      maxPrice: max,
      maxVolume: maxVol,
    };
  }, [klines, entryPrice, stopLoss, takeProfit, takeProfit2, takeProfit3]);

  const svgWidth = 840;
  const mainHeight = 310;
  const subPanelHeight = 90;
  const paddingRight = 65;
  const paddingLeft = 12;
  const chartWidth = svgWidth - paddingRight - paddingLeft;

  const getX = (index: number) => {
    if (klines.length <= 1) return paddingLeft;
    return paddingLeft + (index / (klines.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    if (maxPrice === minPrice) return mainHeight / 2;
    return mainHeight - ((price - minPrice) / (maxPrice - minPrice)) * (mainHeight - 20) - 10;
  };

  const candleWidth = useMemo(() => {
    if (klines.length === 0) return 4;
    return Math.max(2, Math.min(9, (chartWidth / klines.length) * 0.68));
  }, [klines.length, chartWidth]);

  const activeCandle = hoveredIndex !== null && klines[hoveredIndex]
    ? klines[hoveredIndex]
    : klines[klines.length - 1];

  const currentRSI = rsi[rsi.length - 1] ?? 50;
  const currentMacdHist = macd.histogram[macd.histogram.length - 1] ?? 0;
  const currentMacdLine = macd.macdLine[macd.macdLine.length - 1] ?? 0;
  const currentMacdSignal = macd.signalLine[macd.signalLine.length - 1] ?? 0;

  // Polyline generator
  const getLinePoints = (data: (number | null)[]) => {
    return data
      .map((val, idx) => (val !== null ? `${getX(idx)},${getY(val)}` : null))
      .filter(Boolean)
      .join(' ');
  };

  // Bollinger Shaded polygon
  const getBollingerPolygon = () => {
    const validPointsUpper: { x: number; y: number }[] = [];
    const validPointsLower: { x: number; y: number }[] = [];

    for (let i = 0; i < klines.length; i++) {
      const up = bb.upper[i];
      const low = bb.lower[i];
      if (up !== null && low !== null) {
        validPointsUpper.push({ x: getX(i), y: getY(up) });
        validPointsLower.push({ x: getX(i), y: getY(low) });
      }
    }

    if (validPointsUpper.length === 0) return '';
    const upperStr = validPointsUpper.map(p => `${p.x},${p.y}`).join(' ');
    const lowerStr = validPointsLower.reverse().map(p => `${p.x},${p.y}`).join(' ');
    return `${upperStr} ${lowerStr}`;
  };

  // RSI subpanel points
  const getRsiPoints = () => {
    return rsi
      .map((val, idx) => {
        if (val === null) return null;
        const x = getX(idx);
        const y = mainHeight + 15 + (1 - val / 100) * (subPanelHeight - 25);
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(' ');
  };

  // MACD lines points
  const maxMacdVal = useMemo(() => {
    const vals = [...macd.macdLine, ...macd.signalLine, ...macd.histogram].filter((v): v is number => v !== null);
    if (vals.length === 0) return 1;
    return Math.max(...vals.map(Math.abs), 0.5);
  }, [macd]);

  const getMacdY = (val: number | null) => {
    if (val === null) return mainHeight + 15 + subPanelHeight / 2;
    const midY = mainHeight + 15 + (subPanelHeight - 20) / 2;
    const scale = (subPanelHeight - 25) / (2 * maxMacdVal);
    return midY - val * scale;
  };

  const getMacdLinePoints = (data: (number | null)[]) => {
    return data
      .map((val, idx) => (val !== null ? `${getX(idx)},${getMacdY(val)}` : null))
      .filter(Boolean)
      .join(' ');
  };

  return (
    <div id="trading-chart-workspace" className="flex flex-col gap-2.5">
      {/* Chart Engine Switcher */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            id="tab-chart-mode-tv"
            onClick={() => setChartViewMode('tradingview')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              chartViewMode === 'tradingview'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>الرسم البياني الحقيقي (TradingView / BingX)</span>
          </button>

          <button
            id="tab-chart-mode-ai"
            onClick={() => setChartViewMode('ai-pattern')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              chartViewMode === 'ai-pattern'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-300" />
            <span>شارت الذكاء الاصطناعي والإشارات الفنية</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white font-bold">{pair}</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400 font-sans">تغذية الأسعار متصلة</span>
        </div>
      </div>

      {chartViewMode === 'tradingview' ? (
        <BingXTradingViewChart
          pair={pair}
          interval={interval}
        />
      ) : (
        <div id="trading-chart-container" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
          {/* Chart Header Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-slate-950/70 border-b border-slate-800 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-wide">{pair}</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-850">
                  BingX AI Pattern Feed
                </span>
              </div>

          {activeCandle && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-400">O: <strong className="text-white">{activeCandle.open.toFixed(2)}</strong></span>
              <span className="text-slate-400">H: <strong className="text-emerald-400">{activeCandle.high.toFixed(2)}</strong></span>
              <span className="text-slate-400">L: <strong className="text-rose-400">{activeCandle.low.toFixed(2)}</strong></span>
              <span className="text-slate-400">C: <strong className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>{activeCandle.close.toFixed(2)}</strong></span>
            </div>
          )}
        </div>

        {/* Timeframe Selectors & Indicator Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframes */}
          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            {intervals.map(tf => (
              <button
                key={tf}
                id={`tf-btn-${tf}`}
                onClick={() => onIntervalChange(tf)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  interval === tf
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Indicator toggles */}
          <div className="flex items-center gap-1 bg-slate-900/90 rounded-lg p-0.5 border border-slate-800 text-xs">
            <button
              id="toggle-ma-btn"
              onClick={() => setShowIndicators(!showIndicators)}
              title="متوسطات EMA 20 / EMA 50"
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                showIndicators ? 'bg-cyan-950 text-cyan-300 font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>EMA</span>
            </button>

            <button
              id="toggle-bb-btn"
              onClick={() => setShowBollinger(!showBollinger)}
              title="بولينجر باند Bollinger Bands"
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                showBollinger ? 'bg-indigo-950 text-indigo-300 font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>BB</span>
            </button>

            <button
              id="toggle-sma200-btn"
              onClick={() => setShowSMA200(!showSMA200)}
              title="المتوسط البسيط 200 (الاتجاه العام)"
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                showSMA200 ? 'bg-amber-950 text-amber-300 font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>SMA200</span>
            </button>
          </div>

          {/* Sub Oscillator Selector */}
          <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
            <button
              id="switch-osc-macd"
              onClick={() => setSubIndicator('MACD')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                subIndicator === 'MACD' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              MACD
            </button>
            <button
              id="switch-osc-rsi"
              onClick={() => setSubIndicator('RSI')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                subIndicator === 'RSI' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              RSI
            </button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative w-full overflow-x-auto bg-slate-950/90 p-2">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-20">
            <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
              <Zap className="w-5 h-5 animate-pulse" />
              <span>جاري تحديث بيانات الشموع والمؤشرات من BingX...</span>
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${svgWidth} ${mainHeight + subPanelHeight + 25}`}
          className="w-full min-w-[700px] h-[440px] select-none cursor-crosshair"
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
            if (mouseX >= paddingLeft && mouseX <= chartWidth + paddingLeft) {
              const idx = Math.round(((mouseX - paddingLeft) / chartWidth) * (klines.length - 1));
              if (idx >= 0 && idx < klines.length) setHoveredIndex(idx);
            }
          }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="bullishVolGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bearishVolGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bbBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map(ratio => {
            const y = mainHeight * ratio;
            const price = maxPrice - (maxPrice - minPrice) * ratio;
            return (
              <g key={ratio}>
                <line x1={paddingLeft} y1={y} x2={svgWidth - paddingRight} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                <text x={svgWidth - paddingRight + 6} y={y + 4} fill="#64748b" fontSize="10" fontFamily="monospace">
                  {price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Volume bars behind candles */}
          {klines.map((k, i) => {
            const x = getX(i);
            const isBull = k.close >= k.open;
            const volH = (k.volume / maxVolume) * 55;
            const volY = mainHeight - volH;
            return (
              <rect
                key={`vol-${i}`}
                x={x - candleWidth / 2}
                y={volY}
                width={candleWidth}
                height={volH}
                fill={isBull ? 'url(#bullishVolGrad)' : 'url(#bearishVolGrad)'}
              />
            );
          })}

          {/* Bollinger Bands Shaded Area & Lines */}
          {showBollinger && bb.upper.length > 0 && (
            <g id="bollinger-bands-layer">
              <polygon points={getBollingerPolygon()} fill="url(#bbBandGrad)" />
              <polyline fill="none" stroke="#818cf8" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.7" points={getLinePoints(bb.upper)} />
              <polyline fill="none" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.6" points={getLinePoints(bb.middle)} />
              <polyline fill="none" stroke="#818cf8" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.7" points={getLinePoints(bb.lower)} />
            </g>
          )}

          {/* Moving Averages: EMA 20, EMA 50, SMA 200 */}
          {showIndicators && (
            <g id="moving-averages-layer">
              <polyline fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeOpacity="0.9" points={getLinePoints(ema20)} />
              <polyline fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeOpacity="0.9" points={getLinePoints(ema50)} />
              {showSMA200 && (
                <polyline fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4 2" strokeOpacity="0.75" points={getLinePoints(sma200)} />
              )}
            </g>
          )}

          {/* Candlesticks */}
          {klines.map((k, i) => {
            const x = getX(i);
            const isBull = k.close >= k.open;
            const openY = getY(k.open);
            const closeY = getY(k.close);
            const highY = getY(k.high);
            const lowY = getY(k.low);
            const bodyTop = Math.min(openY, closeY);
            const bodyH = Math.max(Math.abs(openY - closeY), 1.5);
            const color = isBull ? '#10b981' : '#f43f5e';

            return (
              <g key={`candle-${i}`}>
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1.2" />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyH}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Opportunity Beacons/Pins */}
          {opportunities.map(opp => {
            const x = getX(opp.index);
            const y = getY(opp.price);
            const isBull = opp.type === 'BULLISH';
            return (
              <g
                key={`opp-${opp.index}`}
                id={`opportunity-beacon-${opp.index}`}
                className="cursor-pointer group"
                onClick={() => {
                  setSelectedOpportunity(opp);
                  if (onSelectOpportunity) onSelectOpportunity(opp);
                }}
              >
                {/* Glow ring */}
                <circle cx={x} cy={isBull ? y + 14 : y - 14} r="8" fill={isBull ? '#10b981' : '#f43f5e'} fillOpacity="0.2" className="animate-ping" />
                <circle cx={x} cy={isBull ? y + 14 : y - 14} r="5" fill={isBull ? '#10b981' : '#f43f5e'} />
                <polygon
                  points={isBull ? `${x-4},${y+17} ${x+4},${y+17} ${x},${y+10}` : `${x-4},${y-17} ${x+4},${y-17} ${x},${y-10}`}
                  fill="#ffffff"
                />
              </g>
            );
          })}

          {/* Trade Levels: Take Profits */}
          {takeProfit3 && (
            <g id="tp3-line-overlay">
              <line x1={paddingLeft} y1={getY(takeProfit3)} x2={svgWidth - paddingRight} y2={getY(takeProfit3)} stroke="#14b8a6" strokeWidth="1" strokeDasharray="3 3" />
              <rect x={svgWidth - paddingRight + 2} y={getY(takeProfit3) - 8} width="62" height="16" fill="#134e4a" rx="3" />
              <text x={svgWidth - paddingRight + 5} y={getY(takeProfit3) + 3} fill="#5eead4" fontSize="8.5" fontWeight="bold">
                TP3: {takeProfit3.toFixed(1)}
              </text>
            </g>
          )}

          {takeProfit2 && (
            <g id="tp2-line-overlay">
              <line x1={paddingLeft} y1={getY(takeProfit2)} x2={svgWidth - paddingRight} y2={getY(takeProfit2)} stroke="#10b981" strokeWidth="1.2" strokeDasharray="4 2" />
              <rect x={svgWidth - paddingRight + 2} y={getY(takeProfit2) - 8} width="62" height="16" fill="#065f46" rx="3" />
              <text x={svgWidth - paddingRight + 5} y={getY(takeProfit2) + 3} fill="#a7f3d0" fontSize="8.5" fontWeight="bold">
                TP2: {takeProfit2.toFixed(1)}
              </text>
            </g>
          )}

          {takeProfit && (
            <g id="tp1-line-overlay">
              <line x1={paddingLeft} y1={getY(takeProfit)} x2={svgWidth - paddingRight} y2={getY(takeProfit)} stroke="#22c55e" strokeWidth="1.6" strokeDasharray="4 2" />
              <rect x={svgWidth - paddingRight + 2} y={getY(takeProfit) - 8} width="62" height="16" fill="#14532d" rx="3" />
              <text x={svgWidth - paddingRight + 5} y={getY(takeProfit) + 3} fill="#86efac" fontSize="8.5" fontWeight="bold">
                TP1: {takeProfit.toFixed(1)}
              </text>
            </g>
          )}

          {/* Trade Level: Entry */}
          {entryPrice && (
            <g id="entry-line-overlay">
              <line x1={paddingLeft} y1={getY(entryPrice)} x2={svgWidth - paddingRight} y2={getY(entryPrice)} stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="2 2" />
              <rect x={svgWidth - paddingRight + 2} y={getY(entryPrice) - 8} width="62" height="16" fill="#155e75" rx="3" />
              <text x={svgWidth - paddingRight + 5} y={getY(entryPrice) + 3} fill="#cffafe" fontSize="8.5" fontWeight="bold">
                دخول: {entryPrice.toFixed(1)}
              </text>
            </g>
          )}

          {/* Trade Level: Stop Loss */}
          {stopLoss && (
            <g id="sl-line-overlay">
              <line x1={paddingLeft} y1={getY(stopLoss)} x2={svgWidth - paddingRight} y2={getY(stopLoss)} stroke="#f43f5e" strokeWidth="1.6" strokeDasharray="4 2" />
              <rect x={svgWidth - paddingRight + 2} y={getY(stopLoss) - 8} width="62" height="16" fill="#881337" rx="3" />
              <text x={svgWidth - paddingRight + 5} y={getY(stopLoss) + 3} fill="#fecdd3" fontSize="8.5" fontWeight="bold">
                SL: {stopLoss.toFixed(1)}
              </text>
            </g>
          )}

          {/* Crosshair Cursor */}
          {hoveredIndex !== null && klines[hoveredIndex] && (
            <g id="chart-crosshair">
              <line x1={getX(hoveredIndex)} y1={0} x2={getX(hoveredIndex)} y2={mainHeight + subPanelHeight + 15} stroke="#94a3b8" strokeDasharray="2 2" strokeWidth="1" />
              <line x1={paddingLeft} y1={getY(klines[hoveredIndex].close)} x2={svgWidth - paddingRight} y2={getY(klines[hoveredIndex].close)} stroke="#94a3b8" strokeDasharray="2 2" strokeWidth="1" />
              <rect x={svgWidth - paddingRight + 2} y={getY(klines[hoveredIndex].close) - 9} width="62" height="18" fill="#0284c7" rx="2" />
              <text x={svgWidth - paddingRight + 5} y={getY(klines[hoveredIndex].close) + 3} fill="#ffffff" fontSize="9" fontFamily="monospace">
                {klines[hoveredIndex].close.toFixed(1)}
              </text>
            </g>
          )}

          {/* Separator to Sub-Oscillator Panel */}
          <line x1={paddingLeft} y1={mainHeight + 8} x2={svgWidth} y2={mainHeight + 8} stroke="#334155" strokeWidth="1.2" />

          {/* Sub-Panel: RSI or MACD */}
          {subIndicator === 'RSI' ? (
            <g id="rsi-subpanel">
              <text x={paddingLeft} y={mainHeight + 22} fill="#94a3b8" fontSize="10" fontWeight="bold">
                RSI (14): <tspan fill={currentRSI > 70 ? '#f43f5e' : currentRSI < 30 ? '#10b981' : '#a855f7'}>{Number(currentRSI).toFixed(1)}</tspan>
              </text>
              {/* Overbought 70 & Oversold 30 levels */}
              <line x1={paddingLeft} y1={mainHeight + 15 + 0.3 * (subPanelHeight - 25)} x2={svgWidth - paddingRight} y2={mainHeight + 15 + 0.3 * (subPanelHeight - 25)} stroke="#f43f5e" strokeDasharray="2 2" strokeOpacity="0.4" />
              <text x={svgWidth - paddingRight + 4} y={mainHeight + 15 + 0.3 * (subPanelHeight - 25) + 3} fill="#f43f5e" fontSize="8">70 (OB)</text>
              <line x1={paddingLeft} y1={mainHeight + 15 + 0.7 * (subPanelHeight - 25)} x2={svgWidth - paddingRight} y2={mainHeight + 15 + 0.7 * (subPanelHeight - 25)} stroke="#10b981" strokeDasharray="2 2" strokeOpacity="0.4" />
              <text x={svgWidth - paddingRight + 4} y={mainHeight + 15 + 0.7 * (subPanelHeight - 25) + 3} fill="#10b981" fontSize="8">30 (OS)</text>
              <polyline fill="none" stroke="#c084fc" strokeWidth="1.6" points={getRsiPoints()} />
            </g>
          ) : (
            <g id="macd-subpanel">
              <text x={paddingLeft} y={mainHeight + 22} fill="#94a3b8" fontSize="10" fontWeight="bold">
                MACD (12,26,9):{' '}
                <tspan fill="#38bdf8">L:{currentMacdLine.toFixed(2)}</tspan>{' '}
                <tspan fill="#fbbf24">S:{currentMacdSignal.toFixed(2)}</tspan>{' '}
                <tspan fill={currentMacdHist >= 0 ? '#10b981' : '#f43f5e'}>H:{currentMacdHist.toFixed(2)}</tspan>
              </text>
              {/* Center zero line */}
              <line x1={paddingLeft} y1={getMacdY(0)} x2={svgWidth - paddingRight} y2={getMacdY(0)} stroke="#475569" strokeDasharray="2 2" />
              {/* Histogram bars */}
              {macd.histogram.map((val, idx) => {
                if (val === null) return null;
                const x = getX(idx);
                const midY = getMacdY(0);
                const barY = getMacdY(val);
                const h = Math.abs(midY - barY);
                const isPositive = val >= 0;
                return (
                  <rect
                    key={`hist-${idx}`}
                    x={x - candleWidth / 2}
                    y={isPositive ? barY : midY}
                    width={candleWidth}
                    height={Math.max(h, 1)}
                    fill={isPositive ? '#10b981' : '#f43f5e'}
                    fillOpacity="0.8"
                  />
                );
              })}
              {/* MACD Line & Signal Line */}
              <polyline fill="none" stroke="#38bdf8" strokeWidth="1.5" points={getMacdLinePoints(macd.macdLine)} />
              <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2 1" points={getMacdLinePoints(macd.signalLine)} />
            </g>
          )}
        </svg>
      </div>

      {/* Selected Opportunity Info Card */}
      {selectedOpportunity && (
        <div className="mx-4 my-2 p-3 bg-slate-950 border border-slate-700 rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${selectedOpportunity.type === 'BULLISH' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <div>
              <span className="font-bold text-white block">{selectedOpportunity.signal}</span>
              <span className="text-slate-400 text-[11px]">{selectedOpportunity.reason}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-cyan-300 font-bold">${selectedOpportunity.price.toLocaleString()}</span>
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
              ثقة {selectedOpportunity.confidence}%
            </span>
            <button
              onClick={() => setSelectedOpportunity(null)}
              className="text-slate-400 hover:text-white px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Indicator Legend footer */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-950/95 border-t border-slate-850 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          {showIndicators && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#38bdf8] inline-block" />
                <span>EMA 20</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#fbbf24] inline-block" />
                <span>EMA 50</span>
              </span>
              {showSMA200 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-[#f43f5e] inline-block border-t border-dashed border-white" />
                  <span>SMA 200</span>
                </span>
              )}
            </>
          )}

          {showBollinger && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#818cf8] inline-block" />
              <span>Bollinger Bands (20, 2)</span>
            </span>
          )}

          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span>{opportunities.length} فرص مرصودة تلقائياً</span>
          </span>
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          BingX Open API Real-Time
        </span>
      </div>
    </div>
      )}
    </div>
  );
};
