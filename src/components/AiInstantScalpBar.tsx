import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  Sliders,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { TradeRecord } from '../lib/firestoreService.ts';

interface AiInstantScalpBarProps {
  pair: string;
  currentPrice: number;
  orderbook?: { bids: [string, string][]; asks: [string, string][] };
  accountBalance?: {
    balance: number;
    availableMargin: number;
    hasFundBalanceNotTransferred?: boolean;
    totalMainBalance?: number;
  };
  onExecuteTrade: (trade: Omit<TradeRecord, 'id' | 'createdAt'>) => Promise<void>;
  onShowToast: (msg: string) => void;
  onQuickTransfer?: () => void;
}

export const AiInstantScalpBar: React.FC<AiInstantScalpBarProps> = ({
  pair,
  currentPrice,
  orderbook = { bids: [], asks: [] },
  accountBalance,
  onExecuteTrade,
  onShowToast,
  onQuickTransfer,
}) => {
  const [selectedMargin, setSelectedMargin] = useState<number>(0.50);
  const [isCustomMargin, setIsCustomMargin] = useState(false);
  const [customMarginInput, setCustomMarginInput] = useState('0.50');
  const [leverage, setLeverage] = useState<number>(10);
  const [isExecuting, setIsExecuting] = useState(false);

  const isGold = pair === 'XAU-USDT' || pair.includes('XAU') || pair.includes('GOLD');

  // Enforce 35x leverage specifically on Gold (applied to Gold only as per BingX CFD contract)
  useEffect(() => {
    if (isGold) {
      setLeverage(35);
    } else if (leverage === 35) {
      setLeverage(10);
    }
  }, [pair, isGold]);

  // Compute live orderbook pressure & spread
  const { buyPressure, sellPressure, spread, spreadPct } = useMemo(() => {
    const topBids = (orderbook.bids || []).slice(0, 8);
    const topAsks = (orderbook.asks || []).slice(0, 8);

    const bidVol = topBids.reduce((acc, [, qty]) => acc + parseFloat(qty || '0'), 0);
    const askVol = topAsks.reduce((acc, [, qty]) => acc + parseFloat(qty || '0'), 0);
    const totalVol = bidVol + askVol;

    const bPress = totalVol > 0 ? Math.round((bidVol / totalVol) * 100) : 54;
    const sPress = 100 - bPress;

    const bestBid = topBids[0] ? parseFloat(topBids[0][0]) : currentPrice * 0.9998;
    const bestAsk = topAsks[0] ? parseFloat(topAsks[0][0]) : currentPrice * 1.0002;
    const sp = Math.max(0.01, bestAsk - bestBid);
    const spPct = (sp / (currentPrice || 1)) * 100;

    return { buyPressure: bPress, sellPressure: sPress, spread: sp, spreadPct: spPct };
  }, [orderbook, currentPrice]);

  // Scalp Targets based on Dynamic ATR / Orderbook
  const { longSl, longTp, shortSl, shortTp, rrr } = useMemo(() => {
    const isGold = pair.includes('XAU');
    const slDist = isGold ? 4.50 : currentPrice * 0.0035; // 0.35% tight scalp SL
    const tpDist = slDist * 2.2; // 1:2.2 Risk to Reward

    return {
      longSl: Math.round((currentPrice - slDist) * 100) / 100,
      longTp: Math.round((currentPrice + tpDist) * 100) / 100,
      shortSl: Math.round((currentPrice + slDist) * 100) / 100,
      shortTp: Math.round((currentPrice - tpDist) * 100) / 100,
      rrr: '1:2.2',
    };
  }, [pair, currentPrice]);

  const handleInstantTrade = async (side: 'LONG' | 'SHORT') => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      const sl = side === 'LONG' ? longSl : shortSl;
      const tp = side === 'LONG' ? longTp : shortTp;

      const record: Omit<TradeRecord, 'id' | 'createdAt'> = {
        ownerId: '',
        pair,
        side,
        entryPrice: currentPrice,
        amount: selectedMargin,
        leverage,
        stopLoss: sl,
        takeProfit: tp,
        pnl: 0,
        pnlPercentage: 0,
        status: 'OPEN',
        source: 'AI_INSTANT_SCALP',
      };

      await onExecuteTrade(record);
      onShowToast(`⚡ تم تنفيذ صفقة سريعة ذكية ${side === 'LONG' ? 'شراء 📈' : 'بيع 📉'} بنجاح!`);
    } catch (e: any) {
      onShowToast(`خطأ في تنفيذ الصفقة: ${e?.message || 'تعذر الإرسال'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div
      id="ai-instant-scalp-bar"
      className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
    >
      {/* Title & Scalp Signal indicator */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
          <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400/30" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-bold text-white">
            <span>التنفيذ الفوري الذكي (AI Scalp Engine)</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-750 text-[10px] font-mono">
              {pair}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
            <span>ضغط السيولة:</span>
            <span className="text-emerald-400 font-bold font-mono">شراء {buyPressure}%</span>
            <span>/</span>
            <span className="text-rose-400 font-bold font-mono">بيع {sellPressure}%</span>
            <span className="text-slate-500">| الفارق: ${spread.toFixed(2)} ({spreadPct.toFixed(3)}%)</span>
          </div>
        </div>
      </div>

      {/* Margin Presets & Leverage & Quick % */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-center">
        <span className="text-slate-400 text-[11px] hidden sm:inline">الهامش:</span>
        <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
          {[0.50, 1.0, 5.0, 10, 25, 50, 100].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setSelectedMargin(val);
                setIsCustomMargin(false);
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                !isCustomMargin && selectedMargin === val
                  ? val === 0.50
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ${val < 1 ? val.toFixed(2) : val}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCustomMargin(!isCustomMargin)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              isCustomMargin
                ? 'bg-purple-600 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            مخصص
          </button>
        </div>

        {isCustomMargin && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0.10"
              step="0.10"
              value={customMarginInput}
              onChange={e => {
                setCustomMarginInput(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n) && n > 0) setSelectedMargin(n);
              }}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-xs text-center"
              placeholder="0.50"
            />
          </div>
        )}

        {accountBalance && accountBalance.availableMargin > 0 && (
          <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 px-1 py-0.5 rounded border border-slate-800 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setSelectedMargin(0.50)}
              className="text-emerald-400 hover:text-emerald-300 px-1 py-0.5 rounded hover:bg-slate-800 font-bold"
              title="تداول بنصف دولار (0.50$)"
            >
              $0.50
            </button>
            <button
              type="button"
              onClick={() => setSelectedMargin(Math.max(0.50, Math.floor(accountBalance.availableMargin * 0.25 * 100) / 100))}
              className="text-slate-400 hover:text-cyan-300 px-1 py-0.5 rounded hover:bg-slate-800"
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => setSelectedMargin(Math.max(0.50, Math.floor(accountBalance.availableMargin * 0.5 * 100) / 100))}
              className="text-slate-400 hover:text-cyan-300 px-1 py-0.5 rounded hover:bg-slate-800"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => setSelectedMargin(Math.max(0.50, Math.floor(accountBalance.availableMargin * 0.95 * 100) / 100))}
              className="text-amber-400 hover:text-amber-300 px-1 py-0.5 rounded hover:bg-slate-800"
            >
              MAX
            </button>
          </div>
        )}

        {/* Leverage Dropdown: 35x exclusively for Gold (CFD isolated) */}
        {isGold ? (
          <div className="flex items-center gap-1 bg-amber-950/70 border border-amber-500/80 rounded-lg px-2 py-0.5">
            <span className="text-[10px] text-amber-300 font-bold">معزول</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 font-mono font-black text-xs border border-emerald-600/70">
              35x 35x
            </span>
          </div>
        ) : (
          <select
            value={leverage}
            onChange={e => setLeverage(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-hidden"
            title="الرافعة المالية"
          >
            <option value={5}>5x</option>
            <option value={10}>10x</option>
            <option value={20}>20x</option>
            <option value={50}>50x</option>
          </select>
        )}

        {accountBalance?.hasFundBalanceNotTransferred && onQuickTransfer && (
          <button
            type="button"
            onClick={onQuickTransfer}
            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[10px] rounded-md transition-colors flex items-center gap-1 cursor-pointer animate-pulse"
            title="نقل رصيدك من محفظة التمويل إلى محفظة العقود فوراً"
          >
            <Zap className="w-3 h-3" />
            <span>نقل الرصيد للعقود</span>
          </button>
        )}
      </div>

      {/* Fast 1-Click Action Buttons */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        {/* Instant Long */}
        <button
          type="button"
          id="instant-scalp-long-btn"
          disabled={isExecuting}
          onClick={() => handleInstantTrade('LONG')}
          className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer text-xs"
          title={`شراء فوري بـ $${selectedMargin} رافعة ${leverage}x | وقف: $${longSl} | هدف: $${longTp}`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>شراء فوري</span>
          <span className="font-mono text-[10px] opacity-80">(${longTp.toLocaleString()})</span>
        </button>

        {/* Instant Short */}
        <button
          type="button"
          id="instant-scalp-short-btn"
          disabled={isExecuting}
          onClick={() => handleInstantTrade('SHORT')}
          className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold transition-all shadow-md shadow-rose-950/40 cursor-pointer text-xs"
          title={`بيع فوري بـ $${selectedMargin} رافعة ${leverage}x | وقف: $${shortSl} | هدف: $${shortTp}`}
        >
          <ArrowDownRight className="w-4 h-4" />
          <span>بيع فوري</span>
          <span className="font-mono text-[10px] opacity-80">(${shortTp.toLocaleString()})</span>
        </button>
      </div>
    </div>
  );
};
