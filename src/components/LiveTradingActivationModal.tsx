import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  KeyRound,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  DollarSign,
  Lock,
  ArrowRight,
  Flame,
} from 'lucide-react';
import type { UserSettings } from '../lib/firestoreService.ts';
import { resilientFetch } from '../lib/resilientFetch.ts';

interface LiveTradingActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings | null;
  onSaveSettings: (settings: UserSettings) => Promise<void>;
  onLiveActivated: () => void;
  showToast: (msg: string) => void;
}

export const LiveTradingActivationModal: React.FC<LiveTradingActivationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onLiveActivated,
  showToast,
}) => {
  const isCurrentlyLive = settings?.isTestnet === false && settings?.liveTradingConfirmed;

  // Credentials
  const [apiKey, setApiKey] = useState(settings?.bingxApiKey || '');
  const [secretKey, setSecretKey] = useState(settings?.bingxSecretKey || '');

  // Risk Limits
  const [maxLeverage, setMaxLeverage] = useState(settings?.riskLimits?.maxLeverage ?? 10);
  const [maxRiskPerTrade, setMaxRiskPerTrade] = useState(settings?.riskLimits?.maxRiskPerTrade ?? 2);
  const [maxDailyLossUsdt, setMaxDailyLossUsdt] = useState(settings?.riskLimits?.maxDailyLossUsdt ?? 100);
  const [stopLossRequired, setStopLossRequired] = useState(settings?.riskLimits?.stopLossRequired ?? true);
  const [takeProfitRequired, setTakeProfitRequired] = useState(settings?.riskLimits?.takeProfitRequired ?? true);

  // User Consent & Confirmation
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [riskUnderstood, setRiskUnderstood] = useState(false);

  // Verification & Testing State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    balance?: string;
    asset?: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      showToast('⚠️ يرجى إدخال مفتاح BingX API و Secret Key أولاً');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await resilientFetch('/api/system/test-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim(),
          isTestnet: false,
        }),
      });

      const data = await res.json();
      if (data?.report?.bingx?.active) {
        setTestResult({
          success: true,
          message: data.report.bingx.message || 'تم التحقق من الاتصال بنجاح ومحفظة العقود الآجلة جاهزة!',
          balance: data.report.bingx.balance?.balance || '0.00',
          asset: data.report.bingx.balance?.asset || 'USDT',
        });
        showToast('✅ تم الاتصال بحساب BingX الحقيقي بنجاح!');
      } else {
        setTestResult({
          success: false,
          message: data?.report?.bingx?.error || data?.report?.bingx?.message || 'تعذر الاتصال بـ BingX، تحقق من المفاتيح',
        });
        showToast('❌ فشل الاتصال بحساب BingX');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'خطأ في الشبكة أثناء فحص المفاتيح',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleLiveMode = async (enableLive: boolean) => {
    if (enableLive) {
      if (!apiKey.trim() || !secretKey.trim()) {
        showToast('⚠️ يتطلب التداول الحقيقي إدخال مفاتيح BingX API أولاً.');
        return;
      }
      if (!userConfirmed || !riskUnderstood) {
        showToast('⚠️ يجب الموافقة على إقرار المخاطر والشروط قبل التفعيل.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updated: UserSettings = {
        ...(settings || {
          ownerId: 'default',
          emailNotifications: true,
          alertEmail: '',
        }),
        ownerId: settings?.ownerId || 'default',
        emailNotifications: settings?.emailNotifications ?? true,
        alertEmail: settings?.alertEmail || '',
        bingxApiKey: apiKey.trim(),
        bingxSecretKey: secretKey.trim(),
        isTestnet: !enableLive, // false = LIVE, true = PAPER
        liveTradingConfirmed: enableLive,
        riskLimits: {
          maxLeverage,
          maxRiskPerTrade,
          maxDailyLossUsdt,
          stopLossRequired,
          takeProfitRequired,
        },
        updatedAt: new Date().toISOString(),
      };

      await onSaveSettings(updated);

      if (enableLive) {
        showToast('🔥 تم تفعيل التداول الحقيقي (Live Trading ON)! الأوامر ستُنفذ على محفظتك الفعلية.');
        onLiveActivated();
      } else {
        showToast('🟡 تم التحويل إلى وضع التداول التجريبي (Paper Trading).');
      }
      onClose();
    } catch (e: any) {
      showToast(`فشل حفظ الإعدادات: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isCurrentlyLive
            ? 'bg-rose-950/40 border-rose-800/60'
            : 'bg-gradient-to-r from-cyan-950/60 to-slate-950 border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isCurrentlyLive
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}>
              {isCurrentlyLive ? <Flame className="w-5 h-5 animate-pulse" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>تفعيل التداول الحقيقي (Live Trading)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  isCurrentlyLive
                    ? 'bg-rose-900 text-rose-200 border border-rose-700'
                    : 'bg-amber-900/80 text-amber-200 border border-amber-700'
                }`}>
                  {isCurrentlyLive ? '🔴 LIVE نشط' : '🟡 PAPER تجريبي'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                الربط المباشر مع حسابك الحقيقي على BingX لتنفيذ الصفقات الفعلية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Statutory Risk Warning (Requirement 35) */}
          <div className="bg-rose-950/50 border border-rose-700/80 rounded-xl p-3.5 text-rose-200 flex items-start gap-2.5 shadow-inner">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[12px] text-rose-300">تحذير المخاطر المالية الإلزامي:</span>
              <p className="text-[11px] leading-relaxed text-rose-200/90">
                &ldquo;التداول ينطوي على مخاطر وقد يؤدي إلى خسارة رأس المال. إشارات الذكاء الاصطناعي ليست ضمانًا للربح.&rdquo;
              </p>
              <p className="text-[10px] text-rose-300/80">
                عند تفعيل هذا الوضع، ستُرسل أوامر التداول الحقيقية عبر API إلى حساب BingX الفعلي وتُخصم الهوامش من رصيد محفظتك.
              </p>
            </div>
          </div>

          {/* STEP 1: API Keys & Connection */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-cyan-400" />
                <span>1. بيانات اعتماد BingX API</span>
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                صلاحيات تداول فقط (بدون سحب)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">BingX API Key</label>
                <input
                  type="text"
                  placeholder="أدخل مفتاح API الخاص بك"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">BingX Secret Key</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !apiKey.trim() || !secretKey.trim()}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>فحص الاتصال والتحقق من الرصيد الحقيقي</span>
              </button>

              {testResult && (
                <div className={`flex items-center gap-1.5 text-[11px] font-mono ${
                  testResult.success ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>{testResult.success ? `الرصيد: $${testResult.balance} ${testResult.asset}` : testResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: Risk Engine Guardrails */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>2. قيود وقواعد محرك المخاطر البرمجي (Risk Engine)</span>
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                حماية إلزامية مستقلة
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>أقصى رافعة:</span>
                  <span className="font-bold text-cyan-400 font-mono">{maxLeverage}x</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="1"
                  value={maxLeverage}
                  onChange={e => setMaxLeverage(parseInt(e.target.value) || 10)}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>أقصى مخاطرة/صفقة:</span>
                  <span className="font-bold text-emerald-400 font-mono">{maxRiskPerTrade}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={maxRiskPerTrade}
                  onChange={e => setMaxRiskPerTrade(parseFloat(e.target.value) || 2)}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>حد الخسارة اليومي:</span>
                  <span className="font-bold text-amber-400 font-mono">${maxDailyLossUsdt}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="10"
                  value={maxDailyLossUsdt}
                  onChange={e => setMaxDailyLossUsdt(parseInt(e.target.value) || 100)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stopLossRequired}
                  onChange={e => setStopLossRequired(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>إلزامية أمر وقف الخسارة (Stop Loss Required)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={takeProfitRequired}
                  onChange={e => setTakeProfitRequired(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>إلزامية أمر جني الأرباح (Take Profit Required)</span>
              </label>
            </div>
          </div>

          {/* STEP 3: Explicit User Consent */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
            <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>3. إقرار وموافقة المتداول الصريحة</span>
            </span>

            <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={riskUnderstood}
                onChange={e => setRiskUnderstood(e.target.checked)}
                className="mt-0.5 accent-rose-500 rounded cursor-pointer shrink-0"
              />
              <span>
                قرأت وفهمت تحذير المخاطر وأعلم أن إشارات ونماذج الذكاء الاصطناعي ليست ضمانًا للربح المالي.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={userConfirmed}
                onChange={e => setUserConfirmed(e.target.checked)}
                className="mt-0.5 accent-cyan-500 rounded cursor-pointer shrink-0"
              />
              <span className="font-medium text-white">
                أوافق على تفعيل التداول الحقيقي (Live Trading) وإرسال الأوامر المباشرة إلى حساب BingX الفعلي.
              </span>
            </label>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
          {/* Paper Mode button */}
          <button
            type="button"
            onClick={() => handleToggleLiveMode(false)}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>البقاء في وضع التداول التجريبي (Paper)</span>
          </button>

          {/* Activate Live button */}
          <button
            type="button"
            onClick={() => handleToggleLiveMode(true)}
            disabled={isSubmitting || !userConfirmed || !riskUnderstood}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            <span>تأكيد وتفعيل التداول الحقيقي الآن 🔴</span>
          </button>
        </div>
      </div>
    </div>
  );
};
