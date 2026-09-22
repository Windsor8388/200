import React, { useState } from 'react';
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
  isSubmitting?: boolean;
}

export const BingXOrderPanel: React.FC<BingXOrderPanelProps> = ({
  pair,
  onPairChange,
  tickers,
  orderbook,
  onExecuteTrade,
  isSubmitting = false,
}) => {
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [amount, setAmount] = useState('500');
  const [leverage, setLeverage] = useState(10);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

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
    const entry = orderType === 'MARKET' ? currentPriceNum : parseFloat(limitPrice) || currentPriceNum;
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    const amt = parseFloat(amount) || 100;

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
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-hidden focus:border-cyan-500"
          >
            {['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT', 'BNB-USDT'].map(sym => (
              <option key={sym} value={sym}>{sym}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block font-mono text-base font-bold text-white">
              ${parseFloat(currentTicker.lastPrice).toLocaleString()}
            </span>
            <span className={`text-[11px] font-mono font-semibold ${parseFloat(currentTicker.priceChangePercent) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {parseFloat(currentTicker.priceChangePercent) >= 0 ? '+' : ''}{currentTicker.priceChangePercent}% 24h
            </span>
          </div>
        </div>
      </div>

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
            <label className="block text-slate-300 font-medium mb-1">سعر الأمر المحدد (Limit Price)</label>
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

        {/* Leverage Slider */}
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

        {/* Amount in USDT */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-slate-300 font-medium">الهامش المطلوب (Margin USDT)</label>
            <span className="text-[11px] text-slate-400">الحجم الكلي: ${(parseFloat(amount || '0') * leverage).toLocaleString()}</span>
          </div>
          <input
            id="order-amount-input"
            type="number"
            min="10"
            step="10"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
          />
          <div className="grid grid-cols-4 gap-1.5 mt-1.5">
            {[100, 250, 500, 1000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val.toString())}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 rounded text-[11px] font-mono transition-colors"
              >
                ${val}
              </button>
            ))}
          </div>
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
