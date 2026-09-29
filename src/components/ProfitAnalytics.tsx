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
  ShieldCheck,
  AlertOctagon,
  Percent,
  Zap,
  RefreshCw,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import type { TradeRecord } from '../lib/firestoreService.ts';

interface ProfitAnalyticsProps {
  trades: TradeRecord[];
  onCloseTrade: (trade: TradeRecord) => Promise<void>;
  onMoveToBreakeven?: (trade: TradeRecord) => void;
  onPanicCloseAll?: () => void;
  onRefreshLivePositions?: () => void;
  isRefreshingPositions?: boolean;
  currentPrices: Record<string, number>;
}

export const ProfitAnalytics: React.FC<ProfitAnalyticsProps> = ({
  trades,
  onCloseTrade,
  onMoveToBreakeven,
  onPanicCloseAll,
  onRefreshLivePositions,
  isRefreshingPositions = false,
  currentPrices,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'OPEN' | 'CLOSED'>('ALL');
  const [confirmPanic, setConfirmPanic] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);

  // Compute metrics
  const livePositions = trades.filter(t => t.status === 'OPEN' && (t.isLivePosition || t.source?.includes('Live')));
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
    if (filter === 'LIVE') return t.status === 'OPEN' && (t.isLivePosition || t.source?.includes('Live'));
    if (filter === 'OPEN') return t.status === 'OPEN';
    if (filter === 'CLOSED') return t.status === 'CLOSED';
    return true;
  });

  const handleExecuteClose = async (trade: TradeRecord) => {
    setClosingTradeId(trade.id);
    try {
      await onCloseTrade(trade);
    } finally {
      setClosingTradeId(null);
    }
  };

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
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-white">
              {openTrades.length}
            </span>
            {livePositions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />
                <span>{livePositions.length} حقيقية</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Real Positions Showcase (Visible when real BingX positions exist) */}
      {livePositions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/20 border border-amber-500/50 rounded-xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <span>الصفقات الحقيقية المفتوحة مباشرة على منصة BingX</span>
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[10px] font-mono border border-amber-500/40">
                  LIVE REAL POSITIONS ({livePositions.length})
                </span>
              </h4>
            </div>

            {onRefreshLivePositions && (
              <button
                type="button"
                onClick={onRefreshLivePositions}
                disabled={isRefreshingPositions}
                className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-white px-2 py-1 rounded bg-amber-950/60 border border-amber-800/60 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingPositions ? 'animate-spin text-amber-300' : ''}`} />
                <span>تحديث الصفقات الحقيقية</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {livePositions.map(pos => {
              const currentPrice = currentPrices[pos.pair] || pos.markPrice || pos.entryPrice;
              const isLong = pos.side === 'LONG';
              const pnl = pos.pnl;
              const pnlPct = pos.pnlPercentage;
              const isProfit = pnl >= 0;

              return (
                <div
                  key={pos.id}
                  className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-3 flex flex-col justify-between gap-2.5 relative overflow-hidden shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono text-sm">{pos.pair}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isLong
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : 'bg-rose-950 text-rose-300 border border-rose-700'
                        }`}
                      >
                        {isLong ? 'شراء 📈 LONG' : 'بيع 📉 SHORT'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                        {pos.leverage}x
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-bold text-sm block ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold ${isProfit ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Prices & Liquidation info */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                    <div>
                      <span className="text-slate-400 block text-[10px]">سعر الدخول:</span>
                      <span className="font-mono text-slate-200 font-bold">${(pos.entryPrice || 0).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">السعر الحالي / المارك:</span>
                      <span className="font-mono text-cyan-300 font-bold">${(currentPrice || 0).toLocaleString()}</span>
                    </div>
                    {pos.liquidationPrice && pos.liquidationPrice > 0 && (
                      <div className="col-span-2 flex items-center justify-between border-t border-slate-800 pt-1 mt-0.5">
                        <span className="text-amber-400/90 text-[10px] flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                          <span>سعر التصفية (Liquidation):</span>
                        </span>
                        <span className="font-mono font-bold text-amber-300">${pos.liquidationPrice.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                    {onMoveToBreakeven && (
                      <button
                        type="button"
                        onClick={() => onMoveToBreakeven(pos)}
                        className="flex-1 py-1 rounded bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-[10px] font-bold cursor-pointer transition-colors"
                        title="تحريك وقف الخسارة إلى نقطة الدخول لحماية رأس المال"
                      >
                        تأمين الدخول (BE)
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={closingTradeId === pos.id}
                      onClick={() => handleExecuteClose(pos)}
                      className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      {closingTradeId === pos.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>إغلاق على BingX فوراً</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade Log Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 border-b border-slate-800">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>سجل صفقات BingX والوكلاء الأذكياء</span>
          </h3>

          <div className="flex items-center gap-2">
            {onRefreshLivePositions && (
              <button
                type="button"
                onClick={onRefreshLivePositions}
                disabled={isRefreshingPositions}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                title="تحديث الصفقات اللحظية من BingX"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPositions ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            )}

            {openTrades.length > 0 && onPanicCloseAll && (
              <div className="flex items-center gap-1.5">
                {confirmPanic ? (
                  <div className="flex items-center gap-1 bg-rose-950 p-1 rounded-lg border border-rose-600 animate-pulse">
                    <span className="text-[10px] text-rose-200 font-bold px-1">تأكيد إغلاق الكل؟</span>
                    <button
                      type="button"
                      id="confirm-panic-close-all-btn"
                      onClick={() => {
                        setConfirmPanic(false);
                        onPanicCloseAll();
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                    >
                      نعم، إغلاق فوراً
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmPanic(false)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] hover:text-white"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    id="panic-close-all-btn"
                    onClick={() => setConfirmPanic(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
                    title="زر الطوارئ: إغلاق جميع الصفقات المفتوحة فوراً بأمر السوق على BingX"
                  >
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    <span>إغلاق الكل فوراً ({openTrades.length})</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${filter === 'ALL' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
              >
                الكل ({trades.length})
              </button>
              {livePositions.length > 0 && (
                <button
                  onClick={() => setFilter('LIVE')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                    filter === 'LIVE' ? 'bg-amber-600 text-slate-950 font-bold' : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <Flame className="w-3 h-3" />
                  <span>حقيقية ({livePositions.length})</span>
                </button>
              )}
              <button
                onClick={() => setFilter('OPEN')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${filter === 'OPEN' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
              >
                المفتوحة ({openTrades.length})
              </button>
              <button
                onClick={() => setFilter('CLOSED')}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${filter === 'CLOSED' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}
              >
                المغلقة ({closedTrades.length})
              </button>
            </div>
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
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white font-mono">{trade.pair}</span>
                          {(trade.isLivePosition || trade.source?.includes('Live')) && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5 text-amber-400" />
                              <span>حقيقي</span>
                            </span>
                          )}
                        </div>
                        {trade.liquidationPrice && trade.liquidationPrice > 0 && (
                          <span className="text-[10px] text-amber-400/80 font-mono block">
                            تصفية: ${trade.liquidationPrice.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.side === 'LONG' || trade.side === 'BUY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                          {trade.side === 'BUY' || trade.side === 'LONG' ? 'LONG 📈' : 'SHORT 📉'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{trade.leverage}x</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">${(trade.entryPrice ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">
                        ${trade.status === 'OPEN' ? (currentPrice ?? 0).toLocaleString() : ((trade.exitPrice || trade.entryPrice) ?? 0).toLocaleString()}
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
                          <div className="flex items-center justify-center gap-1.5">
                            {onMoveToBreakeven && (
                              <button
                                type="button"
                                id={`be-trade-btn-${trade.id}`}
                                onClick={() => onMoveToBreakeven(trade)}
                                className="px-2 py-1 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-750 text-indigo-300 text-[10px] font-bold transition-colors cursor-pointer"
                                title="نقل وقف الخسارة إلى نقطة الدخول (Breakeven) لتأمين رأس المال"
                              >
                                تأمين الدخول (BE)
                              </button>
                            )}
                            <button
                              id={`close-trade-btn-${trade.id}`}
                              disabled={closingTradeId === trade.id}
                              onClick={() => handleExecuteClose(trade)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900 text-rose-300 hover:text-white disabled:opacity-50 transition-colors cursor-pointer text-[11px] font-bold flex items-center gap-1"
                            >
                              {closingTradeId === trade.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-white" />
                              ) : (
                                <span>إغلاق</span>
                              )}
                            </button>
                          </div>
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
