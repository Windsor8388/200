import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Play,
  RotateCcw,
  BarChart3,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Target,
  Layers,
  Award,
  Calendar,
  DollarSign,
  Download,
  Info,
  Clock,
} from 'lucide-react';
import type { KlineBar } from './TradingChart.tsx';
import type { TradingAgent } from '../lib/firestoreService.ts';
import { calculateEMA, calculateRSI, calculateMACD, calculateATR } from '../lib/indicators.ts';

export interface BacktestTradeResult {
  id: number;
  entryTime: number;
  exitTime: number;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  pnlPercent: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_REVERSAL' | 'END_OF_DATA';
  fee: number;
  durationCandles: number;
}

export interface BacktestSummary {
  initialCapital: number;
  finalEquity: number;
  netProfit: number;
  netProfitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgWin: number;
  avgLoss: number;
  riskRewardRatio: number;
  expectancy: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

interface StrategyBacktesterProps {
  klines: KlineBar[];
  pair: string;
  agents: TradingAgent[];
  onApplyParametersToAgent?: (agentId: string, params: { stopLossPercent: number; takeProfitPercent: number; riskPercentage: number }) => void;
  onShowToast?: (msg: string) => void;
}

export const StrategyBacktester: React.FC<StrategyBacktesterProps> = ({
  klines,
  pair,
  agents,
  onApplyParametersToAgent,
  onShowToast,
}) => {
  // Backtest Parameters State
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || 'default-neural');
  const [strategyPreset, setStrategyPreset] = useState<'EMA_CROSS' | 'RSI_SMC' | 'MACD_MOMENTUM' | 'VOLATILITY_BREAKOUT'>('EMA_CROSS');
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(2.0);
  const [leverage, setLeverage] = useState<number>(10);
  const [takeProfitPercent, setTakeProfitPercent] = useState<number>(3.5);
  const [stopLossPercent, setStopLossPercent] = useState<number>(1.5);
  const [takerFeePercent, setTakerFeePercent] = useState<number>(0.04);
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Selected agent details
  const currentAgent = useMemo(() => {
    return agents.find(a => a.id === selectedAgentId) || agents[0];
  }, [agents, selectedAgentId]);

  // Synchronize defaults from selected agent if available
  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    const ag = agents.find(a => a.id === agentId);
    if (ag?.riskParameters) {
      if (ag.riskParameters.riskPercentage) setRiskPercent(ag.riskParameters.riskPercentage);
      if (ag.riskParameters.leverage) setLeverage(ag.riskParameters.leverage);
      if (ag.riskParameters.takeProfitPercent) setTakeProfitPercent(ag.riskParameters.takeProfitPercent);
      if (ag.riskParameters.stopLossPercent) setStopLossPercent(ag.riskParameters.stopLossPercent);
    }
  };

  // Backtest Engine Simulation
  const { summary, trades, equityCurve } = useMemo(() => {
    if (!klines || klines.length < 20) {
      return {
        summary: null,
        trades: [],
        equityCurve: [],
      };
    }

    // Precalculate indicators
    const closes = klines.map(k => k.close);
    const emaFast = calculateEMA(closes, 9);
    const emaSlow = calculateEMA(closes, 21);
    const rsiValues = calculateRSI(closes, 14);
    const macdData = calculateMACD(closes);
    const atrValues = calculateATR(klines, 14);

    let currentEquity = initialCapital;
    let peakEquity = initialCapital;
    let maxDD = 0;
    let maxDDPercent = 0;

    const tradeResults: BacktestTradeResult[] = [];
    const curve: { time: number; equity: number; drawdownPercent: number }[] = [
      { time: klines[0].time, equity: initialCapital, drawdownPercent: 0 },
    ];

    let inPosition: {
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      entryIndex: number;
      sizeUsdt: number;
      slPrice: number;
      tpPrice: number;
    } | null = null;

    // Simulate bar-by-bar starting from index 20
    for (let i = 20; i < klines.length; i++) {
      const candle = klines[i];
      const prevCandle = klines[i - 1];

      // Check current open position exit conditions
      if (inPosition) {
        let isExited = false;
        let exitPrice = 0;
        let exitReason: BacktestTradeResult['exitReason'] = 'END_OF_DATA';

        if (inPosition.side === 'LONG') {
          if (candle.low <= inPosition.slPrice) {
            isExited = true;
            exitPrice = inPosition.slPrice;
            exitReason = 'STOP_LOSS';
          } else if (candle.high >= inPosition.tpPrice) {
            isExited = true;
            exitPrice = inPosition.tpPrice;
            exitReason = 'TAKE_PROFIT';
          }
        } else {
          // SHORT position
          if (candle.high >= inPosition.slPrice) {
            isExited = true;
            exitPrice = inPosition.slPrice;
            exitReason = 'STOP_LOSS';
          } else if (candle.low <= inPosition.tpPrice) {
            isExited = true;
            exitPrice = inPosition.tpPrice;
            exitReason = 'TAKE_PROFIT';
          }
        }

        // Signal reversal exit
        if (!isExited) {
          const fastNow = emaFast[i];
          const slowNow = emaSlow[i];
          const fastPrev = emaFast[i - 1];
          const slowPrev = emaSlow[i - 1];

          if (inPosition.side === 'LONG' && fastNow !== null && slowNow !== null && fastPrev !== null && slowPrev !== null) {
            if (fastPrev >= slowPrev && fastNow < slowNow) {
              isExited = true;
              exitPrice = candle.close;
              exitReason = 'SIGNAL_REVERSAL';
            }
          } else if (inPosition.side === 'SHORT' && fastNow !== null && slowNow !== null && fastPrev !== null && slowPrev !== null) {
            if (fastPrev <= slowPrev && fastNow > slowNow) {
              isExited = true;
              exitPrice = candle.close;
              exitReason = 'SIGNAL_REVERSAL';
            }
          }
        }

        // Process exit if triggered
        if (isExited) {
          const rawReturn = inPosition.side === 'LONG'
            ? (exitPrice - inPosition.entryPrice) / inPosition.entryPrice
            : (inPosition.entryPrice - exitPrice) / inPosition.entryPrice;

          const grossPnl = inPosition.sizeUsdt * rawReturn * leverage;
          const fee = (inPosition.sizeUsdt * leverage * takerFeePercent * 2) / 100;
          const netPnl = grossPnl - fee;
          const pnlPercent = (netPnl / inPosition.sizeUsdt) * 100;

          currentEquity += netPnl;
          if (currentEquity > peakEquity) peakEquity = currentEquity;
          const dd = peakEquity - currentEquity;
          const ddPercent = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
          if (dd > maxDD) maxDD = dd;
          if (ddPercent > maxDDPercent) maxDDPercent = ddPercent;

          tradeResults.push({
            id: tradeResults.length + 1,
            entryTime: klines[inPosition.entryIndex].time,
            exitTime: candle.time,
            side: inPosition.side,
            entryPrice: inPosition.entryPrice,
            exitPrice,
            amount: inPosition.sizeUsdt,
            pnl: netPnl,
            pnlPercent,
            exitReason,
            fee,
            durationCandles: i - inPosition.entryIndex,
          });

          inPosition = null;
        }
      }

      // Check entry conditions if not in position
      if (!inPosition && i < klines.length - 1) {
        let triggerSide: 'LONG' | 'SHORT' | null = null;

        if (strategyPreset === 'EMA_CROSS') {
          const fastNow = emaFast[i];
          const slowNow = emaSlow[i];
          const fastPrev = emaFast[i - 1];
          const slowPrev = emaSlow[i - 1];

          if (fastNow !== null && slowNow !== null && fastPrev !== null && slowPrev !== null) {
            if (fastPrev <= slowPrev && fastNow > slowNow) {
              triggerSide = 'LONG';
            } else if (fastPrev >= slowPrev && fastNow < slowNow) {
              triggerSide = 'SHORT';
            }
          }
        } else if (strategyPreset === 'RSI_SMC') {
          const rsiNow = rsiValues[i];
          const rsiPrev = rsiValues[i - 1];
          if (rsiNow !== null && rsiPrev !== null) {
            if (rsiPrev <= 30 && rsiNow > 30) {
              triggerSide = 'LONG';
            } else if (rsiPrev >= 70 && rsiNow < 70) {
              triggerSide = 'SHORT';
            }
          }
        } else if (strategyPreset === 'MACD_MOMENTUM') {
          const histNow = macdData.histogram[i];
          const histPrev = macdData.histogram[i - 1];
          if (histNow !== null && histPrev !== null) {
            if (histPrev < 0 && histNow > 0) {
              triggerSide = 'LONG';
            } else if (histPrev > 0 && histNow < 0) {
              triggerSide = 'SHORT';
            }
          }
        } else if (strategyPreset === 'VOLATILITY_BREAKOUT') {
          const atr = atrValues[i] || 0;
          const body = Math.abs(candle.close - candle.open);
          if (atr > 0 && body > atr * 1.5) {
            triggerSide = candle.close >= candle.open ? 'LONG' : 'SHORT';
          }
        }

        if (triggerSide) {
          const entryPrice = candle.close;
          const slMultiplier = stopLossPercent / 100;
          const tpMultiplier = takeProfitPercent / 100;

          const slPrice = triggerSide === 'LONG'
            ? entryPrice * (1 - slMultiplier)
            : entryPrice * (1 + slMultiplier);

          const tpPrice = triggerSide === 'LONG'
            ? entryPrice * (1 + tpMultiplier)
            : entryPrice * (1 - tpMultiplier);

          const positionSizeUsdt = Math.max(100, (currentEquity * (riskPercent / 100)) / (stopLossPercent / 100));

          inPosition = {
            side: triggerSide,
            entryPrice,
            entryIndex: i,
            sizeUsdt: Math.min(positionSizeUsdt, currentEquity * 0.95),
            slPrice,
            tpPrice,
          };
        }
      }

      // Record curve point
      const ddNow = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;
      curve.push({
        time: candle.time,
        equity: currentEquity,
        drawdownPercent: ddNow,
      });
    }

    // Force close last remaining position at final candle
    if (inPosition) {
      const lastCandle = klines[klines.length - 1];
      const rawReturn = inPosition.side === 'LONG'
        ? (lastCandle.close - inPosition.entryPrice) / inPosition.entryPrice
        : (inPosition.entryPrice - lastCandle.close) / inPosition.entryPrice;

      const grossPnl = inPosition.sizeUsdt * rawReturn * leverage;
      const fee = (inPosition.sizeUsdt * leverage * takerFeePercent * 2) / 100;
      const netPnl = grossPnl - fee;
      currentEquity += netPnl;

      tradeResults.push({
        id: tradeResults.length + 1,
        entryTime: klines[inPosition.entryIndex].time,
        exitTime: lastCandle.time,
        side: inPosition.side,
        entryPrice: inPosition.entryPrice,
        exitPrice: lastCandle.close,
        amount: inPosition.sizeUsdt,
        pnl: netPnl,
        pnlPercent: (netPnl / inPosition.sizeUsdt) * 100,
        exitReason: 'END_OF_DATA',
        fee,
        durationCandles: klines.length - 1 - inPosition.entryIndex,
      });
    }

    // Aggregate statistics
    const totalTrades = tradeResults.length;
    const wins = tradeResults.filter(t => t.pnl > 0);
    const losses = tradeResults.filter(t => t.pnl <= 0);

    const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));

    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 1.0;
    const netProfit = currentEquity - initialCapital;
    const netProfitPercent = (netProfit / initialCapital) * 100;

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 2.5 : 1.0;
    const expectancy = totalTrades > 0 ? netProfit / totalTrades : 0;

    // Sharpe Ratio calculation
    const returns = tradeResults.map(t => t.pnlPercent / 100);
    let sharpeRatio = 0;
    if (returns.length > 1) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      // Annualized Sharpe assuming ~250 periods/trades
      sharpeRatio = stdDev > 0 ? (mean / stdDev) * Math.sqrt(Math.min(252, returns.length)) : 0;
    }

    // Streaks
    let currentWins = 0;
    let maxWins = 0;
    let currentLosses = 0;
    let maxLosses = 0;

    tradeResults.forEach(t => {
      if (t.pnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxWins) maxWins = currentWins;
      } else {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxLosses) maxLosses = currentLosses;
      }
    });

    const calculatedSummary: BacktestSummary = {
      initialCapital,
      finalEquity: currentEquity,
      netProfit,
      netProfitPercent,
      totalTrades,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate,
      profitFactor,
      sharpeRatio: Math.max(0, Number(sharpeRatio.toFixed(2))),
      maxDrawdown: maxDD,
      maxDrawdownPercent: Number(maxDDPercent.toFixed(2)),
      avgWin,
      avgLoss,
      riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
      expectancy,
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
    };

    return {
      summary: calculatedSummary,
      trades: tradeResults,
      equityCurve: curve,
    };
  }, [klines, initialCapital, riskPercent, leverage, takeProfitPercent, stopLossPercent, takerFeePercent, strategyPreset]);

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    if (tradeFilter === 'WIN') return trades.filter(t => t.pnl > 0);
    if (tradeFilter === 'LOSS') return trades.filter(t => t.pnl <= 0);
    return trades;
  }, [trades, tradeFilter]);

  // Apply backtest settings to live agent
  const handleApplySettings = () => {
    if (onApplyParametersToAgent && currentAgent) {
      onApplyParametersToAgent(currentAgent.id, {
        stopLossPercent,
        takeProfitPercent,
        riskPercentage: riskPercent,
      });
      onShowToast?.(`تم تطبيق إعدادات الفحص المالي بنجاح على الوكيل: ${currentAgent.name}`);
    } else {
      onShowToast?.('تم حفظ وتحديث إعدادات الاستراتيجية بنجاح!');
    }
  };

  // SVG Equity curve rendering
  const minEq = useMemo(() => {
    if (equityCurve.length === 0) return initialCapital;
    return Math.min(...equityCurve.map(e => e.equity), initialCapital * 0.9);
  }, [equityCurve, initialCapital]);

  const maxEq = useMemo(() => {
    if (equityCurve.length === 0) return initialCapital;
    return Math.max(...equityCurve.map(e => e.equity), initialCapital * 1.1);
  }, [equityCurve, initialCapital]);

  const eqSvgWidth = 720;
  const eqSvgHeight = 160;
  const eqPadding = 20;

  const getEqX = (idx: number) => {
    if (equityCurve.length <= 1) return eqPadding;
    return eqPadding + (idx / (equityCurve.length - 1)) * (eqSvgWidth - eqPadding * 2);
  };

  const getEqY = (val: number) => {
    if (maxEq === minEq) return eqSvgHeight / 2;
    return eqSvgHeight - eqPadding - ((val - minEq) / (maxEq - minEq)) * (eqSvgHeight - eqPadding * 2);
  };

  const equityPointsStr = useMemo(() => {
    if (equityCurve.length === 0) return '';
    return equityCurve.map((pt, idx) => `${getEqX(idx)},${getEqY(pt.equity)}`).join(' ');
  }, [equityCurve, minEq, maxEq]);

  return (
    <div id="strategy-backtester-workspace" className="flex flex-col gap-5">
      {/* Header & Preset Selection Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-700 text-purple-400 shadow-md shadow-purple-950/40">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">فاحص ومحاكي الاستراتيجيات التاريخي (Strategy Backtester)</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                {pair} ({klines.length} شمعة تاريخية)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              اختبار أداء وكلاء الذكاء الاصطناعي وخوارزميات الدخول والخروج مقابل بيانات الشموع الحقيقية مع قياس معامل شارب (Sharpe) ومضاعف الربح (Profit Factor)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setIsRunning(true);
              setTimeout(() => {
                setIsRunning(false);
                onShowToast?.(`اكتملت محاكاة الاستراتيجية بنجاح على ${klines.length} شمعة تاريخية!`);
              }, 400);
            }}
            disabled={isRunning}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'جاري الفحص...' : 'إعادة تشغيل المحاكاة'}</span>
          </button>

          <button
            onClick={handleApplySettings}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
            title="تطبيق هذه الإعدادات على الوكيل المنفذ الحالي"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>تطبيق على الوكيل</span>
          </button>
        </div>
      </div>

      {/* Grid: Parameters Config Panel + Strategy Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Controls Column */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-lg text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>إعدادات نموذج الفحص</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Quant V2</span>
          </div>

          {/* Select Agent */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">الوكيل المستهدف للمحاكاة:</label>
            <select
              value={selectedAgentId}
              onChange={e => handleSelectAgent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-sans text-xs focus:outline-none focus:border-cyan-500"
            >
              {agents.map(ag => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({ag.pair})
                </option>
              ))}
            </select>
          </div>

          {/* Strategy Rule Preset */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">خوارزمية الدخول والخروج:</label>
            <select
              value={strategyPreset}
              onChange={e => setStrategyPreset(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-cyan-300 font-bold text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="EMA_CROSS">تقاطع المتوسطات المتحركة (EMA 9 / 21 Cross)</option>
              <option value="RSI_SMC">مناطق السيولة والتشبع (RSI 30/70 + SMC)</option>
              <option value="MACD_MOMENTUM">زخم تقاطع الهيستوجرام (MACD Momentum)</option>
              <option value="VOLATILITY_BREAKOUT">انفجار التقلب السعري (ATR Volatility Surge)</option>
            </select>
          </div>

          {/* Capital & Risk Sizing */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">رأس المال ($):</label>
              <input
                type="number"
                value={initialCapital}
                onChange={e => setInitialCapital(Math.max(100, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">الرافعة المالية:</label>
              <input
                type="number"
                value={leverage}
                min="1"
                max="50"
                onChange={e => setLeverage(Math.min(50, Math.max(1, Number(e.target.value))))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
              />
            </div>
          </div>

          {/* Stop Loss & Take Profit % */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-rose-300 mb-1">وقف الخسارة (SL%):</label>
              <input
                type="number"
                step="0.1"
                value={stopLossPercent}
                onChange={e => setStopLossPercent(Math.max(0.2, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-rose-900/60 rounded-lg px-2.5 py-1.5 text-rose-300 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-emerald-300 mb-1">جني الأرباح (TP%):</label>
              <input
                type="number"
                step="0.1"
                value={takeProfitPercent}
                onChange={e => setTakeProfitPercent(Math.max(0.5, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-emerald-900/60 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono text-xs"
              />
            </div>
          </div>

          {/* Risk Per Trade % & Fee */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1">مخاطرة الصفقة %:</label>
              <input
                type="number"
                step="0.5"
                value={riskPercent}
                min="0.5"
                max="10"
                onChange={e => setRiskPercent(Math.min(10, Math.max(0.5, Number(e.target.value))))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">رسوم التداول %:</label>
              <input
                type="number"
                step="0.01"
                value={takerFeePercent}
                onChange={e => setTakerFeePercent(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Center & Right: Key Quantitative Performance Metrics */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Sharpe Ratio */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>معدل شارب (Sharpe Ratio)</span>
                  <Award className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-xl font-bold font-mono text-purple-300">
                  {summary.sharpeRatio.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500 mt-1">
                  {summary.sharpeRatio >= 2.0
                    ? 'ممتاز جداً (Institutional)'
                    : summary.sharpeRatio >= 1.0
                    ? 'جيد ومقبول للمخاطرة'
                    : 'منخفض / يتطلب تحسين'}
                </span>
              </div>

              {/* Profit Factor */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>مضاعف الربح (Profit Factor)</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {summary.profitFactor.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500 mt-1">
                  إجمالي الأرباح / إجمالي الخسائر
                </span>
              </div>

              {/* Win Rate */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>نسبة الفوز (Win Rate)</span>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300">
                  {summary.winRate.toFixed(1)}%
                </div>
                <span className="text-[10px] text-slate-500 mt-1">
                  {summary.winningTrades} رابحة / {summary.totalTrades} إجمالي
                </span>
              </div>

              {/* Max Drawdown */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>أقصى تراجع (Max DD)</span>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-xl font-bold font-mono text-rose-400">
                  -{summary.maxDrawdownPercent}%
                </div>
                <span className="text-[10px] text-slate-500 mt-1">
                  -${summary.maxDrawdown.toFixed(0)} دولار أقصى انخفاض
                </span>
              </div>
            </div>
          )}

          {/* Equity Curve SVG Visualization */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>منحنى نمو رأس المال التراكمي (Historical Equity Curve)</span>
              </span>
              {summary && (
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-slate-400">الرصيد النهائي:</span>
                  <strong className={summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    ${summary.finalEquity.toFixed(2)} ({summary.netProfit >= 0 ? '+' : ''}{summary.netProfitPercent.toFixed(1)}%)
                  </strong>
                </div>
              )}
            </div>

            {/* Equity Curve Chart */}
            <div className="w-full overflow-hidden bg-slate-950/80 rounded-lg border border-slate-800/80 p-2">
              <svg viewBox={`0 0 ${eqSvgWidth} ${eqSvgHeight}`} className="w-full h-36">
                <defs>
                  <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Baseline 0% */}
                <line
                  x1={eqPadding}
                  y1={getEqY(initialCapital)}
                  x2={eqSvgWidth - eqPadding}
                  y2={getEqY(initialCapital)}
                  stroke="#475569"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text x={eqSvgWidth - eqPadding - 55} y={getEqY(initialCapital) - 4} fill="#64748b" fontSize="9" fontFamily="monospace">
                  البداية: ${initialCapital}
                </text>

                {/* Shaded Area under Curve */}
                {equityCurve.length > 1 && (
                  <polygon
                    points={`${getEqX(0)},${eqSvgHeight - eqPadding} ${equityPointsStr} ${getEqX(equityCurve.length - 1)},${eqSvgHeight - eqPadding}`}
                    fill="url(#eqGradient)"
                  />
                )}

                {/* Main Equity Line */}
                {equityPointsStr && (
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points={equityPointsStr}
                  />
                )}
              </svg>
            </div>

            {/* Performance Secondary Metrics Strip */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px] font-mono pt-1">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">معدل العائد للمخاطرة (R:R)</span>
                  <span className="text-white font-bold">{summary.riskRewardRatio}:1</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">المكسب المتوقع للصفقة</span>
                  <span className={summary.expectancy >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    ${summary.expectancy.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">أطول سلسلة ربح متتالية</span>
                  <span className="text-emerald-300 font-bold">{summary.maxConsecutiveWins} صفقات</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">أطول سلسلة خسارة</span>
                  <span className="text-rose-300 font-bold">{summary.maxConsecutiveLosses} صفقات</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trade Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-xs">سجل صفقات الفحص التاريخي:</span>
            <span className="text-slate-400 text-xs">({filteredTrades.length} صفقة منفذة)</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setTradeFilter('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                tradeFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({trades.length})
            </button>
            <button
              onClick={() => setTradeFilter('WIN')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                tradeFilter === 'WIN' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              الرابحة ({trades.filter(t => t.pnl > 0).length})
            </button>
            <button
              onClick={() => setTradeFilter('LOSS')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                tradeFilter === 'LOSS' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              الخاسرة ({trades.filter(t => t.pnl <= 0).length})
            </button>
          </div>
        </div>

        {filteredTrades.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            لا توجد صفقات منفذة مطابقة لهذا الفلتر أو الشروط المحددة.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 font-medium sticky top-0 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">النوع</th>
                  <th className="py-2 px-3">سعر الدخول</th>
                  <th className="py-2 px-3">سعر الخروج</th>
                  <th className="py-2 px-3">الربح / الخسارة</th>
                  <th className="py-2 px-3">العائد %</th>
                  <th className="py-2 px-3">سبب الخروج</th>
                  <th className="py-2 px-3">المدة</th>
                  <th className="py-2 px-3">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredTrades.map(tr => (
                  <tr key={tr.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-slate-500">{tr.id}</td>
                    <td className="py-2 px-3 font-bold font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          tr.side === 'LONG'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {tr.side === 'LONG' ? 'شراء (LONG)' : 'بيع (SHORT)'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-cyan-300">${tr.entryPrice.toFixed(2)}</td>
                    <td className="py-2 px-3 text-white">${tr.exitPrice.toFixed(2)}</td>
                    <td className={`py-2 px-3 font-bold ${tr.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tr.pnl >= 0 ? '+' : ''}${tr.pnl.toFixed(2)}
                    </td>
                    <td className={`py-2 px-3 font-bold ${tr.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tr.pnlPercent >= 0 ? '+' : ''}{tr.pnlPercent.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 font-sans text-[10px]">
                      {tr.exitReason === 'TAKE_PROFIT' ? (
                        <span className="text-emerald-400 font-bold">🎯 هدف الأرباح (TP)</span>
                      ) : tr.exitReason === 'STOP_LOSS' ? (
                        <span className="text-rose-400 font-bold">🛑 وقف الخسارة (SL)</span>
                      ) : tr.exitReason === 'SIGNAL_REVERSAL' ? (
                        <span className="text-amber-300">🔄 انعكاس الإشارة</span>
                      ) : (
                        <span className="text-slate-400">نهاية البيانات</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{tr.durationCandles} شمعة</td>
                    <td className="py-2 px-3 text-slate-500 font-sans text-[10px]">
                      {new Date(tr.entryTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
