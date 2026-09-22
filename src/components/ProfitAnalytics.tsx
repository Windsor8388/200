import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import type { TradeRecord } from '../lib/firestoreService.ts';

interface ProfitAnalyticsProps {
  trades: TradeRecord[];
  onCloseTrade: (trade: TradeRecord) => Promise<void>;
  currentPrices: Record<string, number>;
}

export const ProfitAnalytics: React.FC<ProfitAnalyticsProps> = ({
  trades,
  onCloseTrade,
  currentPrices,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Compute metrics
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const openTrades = trades.filter(t => t.status === 'OPEN');

  const winningTrades = closedTrades.filter(t => t.pnl > 0);
  const losingTrades = closedTrades.filter(t => t.pnl < 0);

  const totalClosedPnl = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 75.0;

  const totalGains = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? (totalGains / totalLosses).toFixed(2) : totalGains > 0 ? '∞' : '1.0';

  const filteredTrades = trades.filter(t => {
    if (filter === 'OPEN') return t.status === 'OPEN';
    if (filter === 'CLOSED') return t.status === 'CLOSED';
    return true;
  });

  return (
    <div id="profit-analytics-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Realized PnL */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>صافي الأرباح المحققة (PnL)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className={`text-xl font-bold font-mono ${totalClosedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalClosedPnl >= 0 ? `+$${totalClosedPnl.toFixed(2)}` : `-$${Math.abs(totalClosedPnl).toFixed(2)}`}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{closedTrades.length} صفقات مغلقة</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>نسبة الصفقات الرابحة (Win Rate)</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-cyan-400">
              {winRate.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {winningTrades.length} رابحة / {losingTrades.length} خاسرة
            </span>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>عامل الربحية (Profit Factor)</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-amber-400">
              {profitFactor}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">معدل العائد لكل دولار مخاطرة</span>
          </div>
        </div>

        {/* Active Open Positions */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>الصفقات المفتوحة حالياً</span>
            <PieChart className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-white">
              {openTrades.length}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">تدار عبر وكلاء التداول الآلي</span>
          </div>
        </div>
      </div>

      {/* Trade Log Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 border-b border-slate-800">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>سجل صفقات BingX والوكلاء الأذكياء</span>
          </h3>

          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded transition-colors ${filter === 'ALL' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
            >
              الكل ({trades.length})
            </button>
            <button
              onClick={() => setFilter('OPEN')}
              className={`px-3 py-1 rounded transition-colors ${filter === 'OPEN' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
            >
              المفتوحة ({openTrades.length})
            </button>
            <button
              onClick={() => setFilter('CLOSED')}
              className={`px-3 py-1 rounded transition-colors ${filter === 'CLOSED' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
            >
              المغلقة ({closedTrades.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">الزوج</th>
                <th className="py-2.5 px-3">النوع</th>
                <th className="py-2.5 px-3">الرافعة</th>
                <th className="py-2.5 px-3">سعر الدخول</th>
                <th className="py-2.5 px-3">سعر الخروج / الحالي</th>
                <th className="py-2.5 px-3">الربح/الخسارة (PnL)</th>
                <th className="py-2.5 px-3">الحالة</th>
                <th className="py-2.5 px-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    لا توجد صفقات مسجلة في هذا القسم بعد. يمكنك فتح صفقة يدوياً أو تفعيل أحد الوكلاء الأذكياء.
                  </td>
                </tr>
              ) : (
                filteredTrades.map(trade => {
                  const currentPrice = currentPrices[trade.pair] || trade.entryPrice;
                  let livePnl = trade.pnl;
                  let livePnlPct = trade.pnlPercentage;

                  if (trade.status === 'OPEN') {
                    const priceDiff = trade.side === 'LONG'
                      ? currentPrice - trade.entryPrice
                      : trade.entryPrice - currentPrice;
                    livePnlPct = (priceDiff / trade.entryPrice) * trade.leverage * 100;
                    livePnl = (trade.amount * livePnlPct) / 100;
                  }

                  return (
                    <tr key={trade.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white font-mono">{trade.pair}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.side === 'LONG' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{trade.leverage}x</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">${trade.entryPrice.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">
                        ${trade.status === 'OPEN' ? currentPrice.toLocaleString() : (trade.exitPrice || trade.entryPrice).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className={`font-bold ${livePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {livePnl >= 0 ? `+$${livePnl.toFixed(2)}` : `-$${Math.abs(livePnl).toFixed(2)}`} ({livePnlPct >= 0 ? '+' : ''}{livePnlPct.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${trade.status === 'OPEN' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-400'}`}>
                          {trade.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {trade.status === 'OPEN' ? (
                          <button
                            id={`close-trade-btn-${trade.id}`}
                            onClick={() => onCloseTrade(trade)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900 text-rose-300 hover:text-white transition-colors cursor-pointer text-[11px] font-bold"
                          >
                            إغلاق الصفقة
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[11px]">مكتملة</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
