import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Zap,
  TrendingUp,
  TrendingDown,
  Percent,
} from 'lucide-react';
import { type PriceAlert, playAlertSound } from '../lib/alertsService.ts';

interface PriceAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PriceAlert[];
  currentPrices: Record<string, number>;
  onAddAlert: (newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  onDeleteAlert: (id: string) => void;
  onToggleAlert: (id: string, active: boolean) => void;
  onReactivateAlert: (id: string) => void;
  onClearTriggered: () => void;
  userEmail?: string;
  defaultPair?: string;
}

const AVAILABLE_PAIRS = [
  { id: 'BTC-USDT', name: 'Bitcoin (BTC)', isGold: false },
  { id: 'XAU-USDT', name: 'الذهب العالمي (Gold / Troy Ounce)', isGold: true },
  { id: 'ETH-USDT', name: 'Ethereum (ETH)', isGold: false },
  { id: 'SOL-USDT', name: 'Solana (SOL)', isGold: false },
  { id: 'XRP-USDT', name: 'Ripple (XRP)', isGold: false },
];

export const PriceAlertsModal: React.FC<PriceAlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  currentPrices,
  onAddAlert,
  onDeleteAlert,
  onToggleAlert,
  onReactivateAlert,
  onClearTriggered,
  defaultPair = 'BTC-USDT',
}) => {
  const [selectedPair, setSelectedPair] = useState<string>(defaultPair);
  const currentPrice = currentPrices[selectedPair] || (selectedPair === 'XAU-USDT' ? 2688.4 : 87250);
  const [targetPrice, setTargetPrice] = useState<string>((currentPrice * 1.02).toFixed(selectedPair === 'XAU-USDT' ? 2 : 2));
  const [direction, setDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [note, setNote] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<'active' | 'triggered' | 'all'>('active');

  if (!isOpen) return null;

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
    const p = currentPrices[pair] || (pair === 'XAU-USDT' ? 2688.4 : 87250);
    const multiplier = direction === 'ABOVE' ? 1.02 : 0.98;
    setTargetPrice((p * multiplier).toFixed(pair === 'XAU-USDT' ? 2 : 2));
  };

  const handleApplyDelta = (percentage: number) => {
    const p = currentPrices[selectedPair] || (selectedPair === 'XAU-USDT' ? 2688.4 : 87250);
    const newTarget = p * (1 + percentage / 100);
    setTargetPrice(newTarget.toFixed(selectedPair === 'XAU-USDT' ? 2 : 2));
    if (percentage > 0) {
      setDirection('ABOVE');
    } else {
      setDirection('BELOW');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(targetPrice);
    if (!num || num <= 0) return;

    onAddAlert({
      ownerId: 'current',
      pair: selectedPair,
      targetPrice: num,
      direction,
      note: note.trim() || (direction === 'ABOVE' ? `وصول السعر إلى ${num}$ فأعلى` : `هبوط السعر إلى ${num}$ فأدنى`),
      active: true,
      soundEnabled,
    });

    setNote('');
  };

  const activeAlerts = alerts.filter(a => !a.triggered && a.active);
  const triggeredAlerts = alerts.filter(a => a.triggered);
  const displayedAlerts = filterTab === 'active'
    ? activeAlerts
    : filterTab === 'triggered'
    ? triggeredAlerts
    : alerts;

  return (
    <div id="price-alerts-modal-overlay" className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-md">
              <BellRing className="w-5 h-5 text-slate-950 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  رادار وتنبيهات وصول السوق الفورية
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  Live Price Radar
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                حدد المستوى السعري المستهدف وسيقوم الرادار بإرسال إشعار فوري ونغمة تنبيه فور وصول السعر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => playAlertSound()}
              title="اختبار نغمة التنبيه الصوتي"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-400 border border-amber-500/30 text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">اختبار الصوت</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5 text-xs">
          {/* Create Alert Form Card */}
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3 shadow-inner"
          >
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>إنشاء تنبيه سعري جديد</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                السعر الحالي لـ {selectedPair.replace('-USDT', '')}:{' '}
                <strong className={selectedPair === 'XAU-USDT' ? 'text-amber-300' : 'text-cyan-300'}>
                  ${(currentPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {selectedPair === 'XAU-USDT' ? '/oz' : ''}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pair Selector */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">زوج التداول / الأصل المستهدف</label>
                <select
                  value={selectedPair}
                  onChange={e => handlePairChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-2 text-white text-xs font-semibold focus:border-cyan-500 outline-hidden cursor-pointer"
                >
                  {AVAILABLE_PAIRS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isGold ? '⭐️' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Direction Condition */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">شرط تفعيل التنبيه</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('ABOVE')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      direction === 'ABOVE'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/40 shadow-xs'
                        : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                    <span>صعود لأعلى (≥)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('BELOW')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      direction === 'BELOW'
                        ? 'bg-rose-950/80 border-rose-500 text-rose-200 ring-1 ring-rose-500/40 shadow-xs'
                        : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                    <span>هبوط لأسفل (≤)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Target Price Input & Quick Deltas */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">السعر المستهدف للتنبيه ($)</label>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-500">مستويات سريعة:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(1)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-750 text-emerald-400 font-mono"
                  >
                    +1%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(2.5)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-750 text-emerald-400 font-mono"
                  >
                    +2.5%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(5)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-750 text-emerald-400 font-mono"
                  >
                    +5%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(-1)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-750 text-rose-400 font-mono"
                  >
                    -1%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(-2.5)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-750 text-rose-400 font-mono"
                  >
                    -2.5%
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="any"
                required
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                placeholder="أدخل السعر المطلوب بدقة..."
                className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:border-cyan-500 outline-hidden"
              />
            </div>

            {/* Note & Sound */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">ملاحظة أو سبب التنبيه (اختياري)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="مثال: كسر قمة الأمس، إعادة اختبار الدعم، منطقة شراء ذهبية..."
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-3 py-1.5 text-white text-xs focus:border-cyan-500 outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  id="sound-toggle"
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={e => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="sound-toggle" className="text-slate-300 text-[11px] cursor-pointer flex items-center gap-1">
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                  <span>نغمة صوتية رنانة</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="mt-1 w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>تفعيل وإطلاق التنبيه السعري الآن</span>
            </button>
          </form>

          {/* Alerts Filter Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterTab('active')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterTab === 'active'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>التنبيهات النشطة</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-white">
                  {activeAlerts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('triggered')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterTab === 'triggered'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>التي تم وصولها</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-white">
                  {triggeredAlerts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>الكل ({alerts.length})</span>
              </button>
            </div>

            {triggeredAlerts.length > 0 && (
              <button
                type="button"
                onClick={onClearTriggered}
                className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح المنفذة</span>
              </button>
            )}
          </div>

          {/* Alerts List */}
          <div className="flex flex-col gap-2.5">
            {displayedAlerts.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 flex flex-col items-center gap-2">
                <Bell className="w-8 h-8 text-slate-600" />
                <span className="text-slate-400 font-bold">لا توجد تنبيهات في هذه القائمة حالياً</span>
                <span className="text-[11px] text-slate-500 max-w-sm">
                  يمكنك إضافة تنبيه لأي عملة أو للذهب وسيقوم النظام بتنبيهك صوتياً ومرئياً فور وصول السعر للهدف المحدد.
                </span>
              </div>
            ) : (
              displayedAlerts.map(alert => {
                const livePrice = currentPrices[alert.pair] || (alert.pair === 'XAU-USDT' ? 2688.4 : 87250);
                const diff = alert.targetPrice - livePrice;
                const diffPct = (diff / livePrice) * 100;
                const isGold = alert.pair === 'XAU-USDT';
                const isAbove = alert.direction === 'ABOVE';

                // Distance indicator
                const isVeryClose = Math.abs(diffPct) <= 1.5 && !alert.triggered;

                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      alert.triggered
                        ? 'bg-emerald-950/40 border-emerald-800/80 shadow-inner'
                        : isVeryClose
                        ? 'bg-amber-950/30 border-amber-500/70 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          alert.triggered
                            ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                            : isAbove
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                            : 'bg-rose-950 text-rose-400 border border-rose-900'
                        }`}
                      >
                        {alert.triggered ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : isAbove ? (
                          <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-rose-400" />
                        )}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-extrabold ${isGold ? 'text-amber-300' : 'text-white'}`}>
                            {isGold ? 'الذهب (XAU-USDT)' : alert.pair}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                              isAbove
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {isAbove ? '≥ صعود' : '≤ هبوط'}
                          </span>
                          {alert.triggered && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>وصل السوق للهدف!</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="text-slate-400">
                            المستهدف:{' '}
                            <strong className="text-white font-mono">
                              ${(alert.targetPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                          </span>
                          <span className="text-slate-600">|</span>
                          <span className="text-slate-400 font-mono">
                            الحالي: ${(livePrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>

                          {!alert.triggered && (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                                isVeryClose
                                  ? 'bg-amber-500/20 text-amber-300 font-bold animate-pulse'
                                  : 'bg-slate-900 text-slate-300'
                              }`}
                            >
                              متبقي: {Math.abs(diffPct).toFixed(2)}% (${Math.abs(diff).toFixed(2)})
                            </span>
                          )}
                        </div>

                        {alert.note && (
                          <span className="text-[11px] text-slate-300/80 italic mt-0.5">
                            "{alert.note}"
                          </span>
                        )}

                        {alert.triggered && alert.triggeredAt && (
                          <span className="text-[10px] text-emerald-400/90 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              تم الوصول في: {new Date(alert.triggeredAt).toLocaleTimeString()} بسعر ${(alert.triggeredPrice ?? 0).toLocaleString()}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {alert.triggered ? (
                        <button
                          type="button"
                          onClick={() => onReactivateAlert(alert.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          إعادة تفعيل
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleAlert(alert.id, !alert.active)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            alert.active
                              ? 'bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border border-amber-700/80'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {alert.active ? 'نشط 🔔' : 'موقف ⏸'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDeleteAlert(alert.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 hover:text-rose-300 text-slate-400 border border-slate-800 transition-colors cursor-pointer"
                        title="حذف التنبيه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>الرادار يفحص أسعار السوق المباشرة بدون انقطاع ويرسل تنبيهاً فورياً عند الملامسة.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
