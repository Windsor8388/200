import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Sliders,
  DollarSign,
  ShieldCheck,
  Zap,
  ArrowUpDown,
  CheckCircle,
  Bell,
  Wallet,
} from 'lucide-react';
import type { TradeRecord } from '../lib/firestoreService.ts';

export interface TickerData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
}

interface BingXOrderPanelProps {
  pair: string;
  onPairChange: (pair: string) => void;
  tickers: TickerData[];
  orderbook: { bids: [string, string][]; asks: [string, string][] };
  onExecuteTrade: (trade: Omit<TradeRecord, 'id' | 'createdAt'>) => Promise<void>;
  onOpenPriceAlerts?: (pair: string, price?: number) => void;
  isSubmitting?: boolean;
  accountBalance?: {
    balance: number;
    availableMargin: number;
    equity?: number;
    unrealizedProfit?: number;
    asset: string;
    mode: string;
  };
}

export const BingXOrderPanel: React.FC<BingXOrderPanelProps> = ({
  pair,
  onPairChange,
  tickers,
  orderbook,
  onExecuteTrade,
  onOpenPriceAlerts,
  isSubmitting = false,
  accountBalance,
}) => {
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [amount, setAmount] = useState(() => {
    if (accountBalance?.availableMargin !== undefined && accountBalance.availableMargin > 0) {
      if (accountBalance.availableMargin <= 2) return accountBalance.availableMargin.toFixed(2);
      if (accountBalance.availableMargin <= 10) return '1.00';
    }
    return '10';
  });
  const [leverage, setLeverage] = useState(10);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const isGold = pair === 'XAU-USDT' || pair.includes('XAU') || pair.includes('GOLD');

  // Enforce 35x leverage specifically on Gold (applied to Gold only as per BingX CFD contract in picture)
  useEffect(() => {
    if (isGold) {
      setLeverage(35);
    } else if (leverage === 35) {
      setLeverage(10);
    }
  }, [pair, isGold]);

  const currentTicker = tickers.find(t => t.symbol === pair) || {
    symbol: pair,
    lastPrice: '87400.00',
    priceChangePercent: '+3.45',
    highPrice: '88900.00',
    lowPrice: '86100.00',
    volume: '15400000',
  };

  const currentPriceNum = parseFloat(currentTicker.lastPrice) || 87400;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const entry = orderType === 'MARKET' ? currentPriceNum : parseFloat(limitPrice) || currentPriceNum;
      const sl = stopLoss ? parseFloat(stopLoss) : undefined;
      const tp = takeProfit ? parseFloat(takeProfit) : undefined;
      const amt = parseFloat(amount) || 0.50;

      await onExecuteTrade({
        ownerId: '',
        pair,
        side,
        entryPrice: entry,
        amount: amt,
        leverage,
        stopLoss: sl,
        takeProfit: tp,
        pnl: 0,
        pnlPercentage: 0,
        status: 'OPEN',
        source: 'BingX Terminal (Manual/Agent)',
      });

      setSuccessNotice(`تم فتح صفقة ${side === 'LONG' ? 'شراء' : 'بيع'} بنجاح على ${pair} برافعة ${leverage}x`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      console.warn('Order submission caught:', err);
    }
  };

  // Quick SL/TP helper presets
  const applyPresetRisk = (riskPct: number, rewardRatio: number) => {
    if (side === 'LONG') {
      const sl = currentPriceNum * (1 - riskPct / 100);
      const tp = currentPriceNum * (1 + (riskPct * rewardRatio) / 100);
      setStopLoss(sl.toFixed(2));
      setTakeProfit(tp.toFixed(2));
    } else {
      const sl = currentPriceNum * (1 + riskPct / 100);
      const tp = currentPriceNum * (1 - (riskPct * rewardRatio) / 100);
      setStopLoss(sl.toFixed(2));
      setTakeProfit(tp.toFixed(2));
    }
  };

  return (
    <div id="bingx-order-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-4">
      {/* Ticker Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">الزوج:</label>
          <select
            id="order-pair-select"
            value={pair}
            onChange={e => onPairChange(e.target.value)}
            className={`bg-slate-950 border rounded-lg px-2.5 py-1 text-sm font-bold focus:outline-hidden ${
              pair === 'XAU-USDT'
                ? 'border-amber-500 text-amber-300 shadow-xs shadow-amber-500/20'
                : 'border-slate-700 text-white focus:border-cyan-500'
            }`}
          >
            {['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT', 'BNB-USDT', 'XAU-USDT'].map(sym => (
              <option key={sym} value={sym}>
                {sym === 'XAU-USDT' ? 'XAU-USDT (الذهب / Troy Ounce)' : sym}
              </option>
            ))}
          </select>
          {pair === 'XAU-USDT' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              سبيكة ذهب
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`block font-mono text-base font-bold ${pair === 'XAU-USDT' ? 'text-amber-300' : 'text-white'}`}>
              ${(parseFloat(currentTicker?.lastPrice || '0') || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {pair === 'XAU-USDT' && <span className="text-xs text-amber-400/80 mr-1 font-sans">/ أونصة</span>}
            </span>
            <span className={`text-[11px] font-mono font-semibold ${parseFloat(currentTicker?.priceChangePercent || '0') >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {parseFloat(currentTicker?.priceChangePercent || '0') >= 0 ? '+' : ''}{currentTicker?.priceChangePercent || '0'}% 24h
            </span>
          </div>
        </div>
      </div>

      {/* Main Account Balance Strip */}
      {accountBalance && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400 font-sans">رصيد الحساب:</span>
            <span className="font-bold text-white">${(accountBalance.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-cyan-400">{accountBalance.asset || 'USDT'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans hidden sm:inline">الهامش المتاح:</span>
            <span className="text-emerald-400 font-bold">${(accountBalance.availableMargin ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="px-1 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 font-sans">
              {accountBalance.mode === 'LIVE_BINGX' ? 'BingX Live' : 'Demo VST'}
            </span>
          </div>
        </div>
      )}

      {/* Main Order Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
        {/* Long / Short Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            type="button"
            id="side-long-btn"
            onClick={() => setSide('LONG')}
            className={`py-2 rounded-md font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              side === 'LONG'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>شراء / صعود (LONG)</span>
          </button>
          <button
            type="button"
            id="side-short-btn"
            onClick={() => setSide('SHORT')}
            className={`py-2 rounded-md font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              side === 'SHORT'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>بيع / هبوط (SHORT)</span>
          </button>
        </div>

        {/* Order Type & Price */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
            <button
              type="button"
              id="type-market-btn"
              onClick={() => setOrderType('MARKET')}
              className={`px-3 py-1 text-xs rounded transition-colors ${orderType === 'MARKET' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
            >
              Market (سعر السوق)
            </button>
            <button
              type="button"
              id="type-limit-btn"
              onClick={() => {
                setOrderType('LIMIT');
                if (!limitPrice) setLimitPrice(currentTicker.lastPrice);
              }}
              className={`px-3 py-1 text-xs rounded transition-colors ${orderType === 'LIMIT' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
            >
              Limit (معلق)
            </button>
          </div>

          <span className="text-[11px] text-slate-400">BingX Perpetual Swap</span>
        </div>

        {orderType === 'LIMIT' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-medium">سعر الأمر المحدد (Limit Price)</label>
              {onOpenPriceAlerts && (
                <button
                  type="button"
                  onClick={() => onOpenPriceAlerts(pair, parseFloat(limitPrice) || parseFloat(currentTicker.lastPrice))}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-bold transition-colors"
                >
                  <Bell className="w-3 h-3" />
                  <span>تعيين تنبيه لهذا السعر</span>
                </button>
              )}
            </div>
            <input
              id="limit-price-input"
              type="number"
              step="any"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              placeholder={currentTicker.lastPrice}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
            />
          </div>
        )}

        {/* Leverage: Enforced 35x isolated exclusively for Gold as shown in screenshot */}
        {isGold ? (
          <div className="bg-amber-950/60 p-2.5 rounded-lg border border-amber-500/70 flex flex-col gap-1.5 shadow-md">
            <div className="flex justify-between items-center text-xs">
              <span className="text-amber-200 font-bold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>الرافعة المالية لعقود الذهب CFD:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-750 text-slate-300 font-bold text-[10px]">
                  معزول
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-400 font-mono font-black text-xs shadow-xs">
                  35x 35x
                </span>
              </div>
            </div>
            <div className="text-[11px] text-amber-300/90 font-sans">
              ⚡ رافعة الذهب مطابقة لمواصفات منصة BingX (عقود CFD الدائمة 35x معزول).
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>الرافعة المالية:</span>
              </span>
              <span className="font-mono font-bold text-cyan-400 text-sm">{leverage}x</span>
            </div>
            <input
              id="leverage-slider"
              type="range"
              min="1"
              max="50"
              value={leverage}
              onChange={e => setLeverage(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1x</span>
              <span>10x</span>
              <span>20x</span>
              <span>35x</span>
              <span>50x</span>
            </div>
          </div>
        )}

        {/* Amount in USDT */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-slate-300 font-medium">الهامش المطلوب (Margin USDT)</label>
            <span className="text-[11px] text-slate-400">
              الحجم الكلي: ${( (parseFloat(amount || '0') || 0) * (leverage || 1) ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="relative">
            <input
              id="order-amount-input"
              type="number"
              min="0.10"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.50"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
            />
            <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">USDT</span>
          </div>

          {/* Micro Presets and Balance Selectors */}
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-emerald-400 font-medium">متاح التداول بمبالغ ميكرو تبدأ من 0.50$</span>
              {accountBalance?.availableMargin !== undefined && (
                <span className="font-mono text-cyan-300">
                  المتاح: ${(accountBalance.availableMargin).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {/* Quick Micro Presets */}
            <div className="grid grid-cols-6 gap-1">
              {[0.5, 1, 5, 10, 50, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  className={`py-1 rounded text-[11px] font-mono transition-colors border ${
                    amount === val.toString()
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>

            {/* Percentage Selectors of Available Margin */}
            {accountBalance?.availableMargin !== undefined && accountBalance.availableMargin > 0 && (
              <div className="grid grid-cols-4 gap-1 mt-0.5">
                {[0.25, 0.50, 0.75, 1.0].map(pct => {
                  const calculated = Math.max(0.10, Math.floor(accountBalance.availableMargin! * pct * 100) / 100);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAmount(calculated.toFixed(2))}
                      className="bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-cyan-300 py-0.5 rounded text-[10px] font-mono transition-colors"
                      title={`تخصيص ${pct * 100}% من الرصيد ($${calculated.toFixed(2)})`}
                    >
                      {pct * 100}% {pct === 1.0 && 'الكل'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {pair === 'XAU-USDT' && (
            <div className="mt-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-[11px] text-amber-200 flex items-center justify-between">
              <span>حجم العقد التقديري: {( (parseFloat(amount || '0') * leverage) / (parseFloat(currentTicker.lastPrice) || 2688) ).toFixed(2)} أونصة تروي</span>
              <span className="text-amber-400 font-mono font-bold">نقطة الذهب: 0.10$</span>
            </div>
          )}
        </div>

        {/* Stop Loss & Take Profit */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-rose-400 font-medium mb-1">وقف الخسارة (SL)</label>
            <input
              id="order-sl-input"
              type="number"
              step="any"
              placeholder="السعر"
              value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-hidden focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-emerald-400 font-medium mb-1">أخذ الربح (TP)</label>
            <input
              id="order-tp-input"
              type="number"
              step="any"
              placeholder="السعر"
              value={takeProfit}
              onChange={e => setTakeProfit(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Quick Risk Buttons */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-400">إعداد ذكي:</span>
          <button
            type="button"
            onClick={() => applyPresetRisk(1.5, 2)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700"
          >
            مخاطرة 1.5% (عائد 1:2)
          </button>
          <button
            type="button"
            onClick={() => applyPresetRisk(2, 3)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700"
          >
            مخاطرة 2% (عائد 1:3)
          </button>
        </div>

        {/* Feedback message */}
        {successNotice && (
          <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 p-2.5 rounded-lg flex items-center gap-2 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Submit Execution Button */}
        <button
          type="submit"
          id="btn-execute-bingx-order"
          disabled={isSubmitting}
          className={`w-full py-2.5 rounded-lg text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
            side === 'LONG'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
              : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>{side === 'LONG' ? 'فتح صفقة شراء (Open LONG)' : 'فتح صفقة بيع (Open SHORT)'}</span>
        </button>
      </form>

      {/* Mini Orderbook Depth View */}
      <div className="border-t border-slate-800 pt-3">
        <h4 className="text-slate-400 text-xs font-semibold mb-2 flex items-center justify-between">
          <span>دفتر الأوامر اللحظي (BingX Depth)</span>
          <span className="text-[10px] text-slate-500">الكمية</span>
        </h4>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          {/* Asks (Sells) */}
          <div className="flex flex-col gap-0.5">
            <span className="text-rose-400 font-bold text-[10px] mb-1">عروض البيع (Asks)</span>
            {(orderbook?.asks || []).slice(0, 5).map(([p, q], i) => (
              <div key={`ask-${i}`} className="flex justify-between items-center text-rose-300 bg-rose-950/20 px-1.5 py-0.5 rounded">
                <span>{parseFloat(p).toFixed(2)}</span>
                <span className="text-slate-400">{parseFloat(q).toFixed(3)}</span>
              </div>
            ))}
          </div>

          {/* Bids (Buys) */}
          <div className="flex flex-col gap-0.5">
            <span className="text-emerald-400 font-bold text-[10px] mb-1">طلبات الشراء (Bids)</span>
            {(orderbook?.bids || []).slice(0, 5).map(([p, q], i) => (
              <div key={`bid-${i}`} className="flex justify-between items-center text-emerald-300 bg-emerald-950/20 px-1.5 py-0.5 rounded">
                <span>{parseFloat(p).toFixed(2)}</span>
                <span className="text-slate-400">{parseFloat(q).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
