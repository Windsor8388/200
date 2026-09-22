import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import type { UserSettings } from '../lib/firestoreService.ts';

interface BingXSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings | null;
  onSaveSettings: (settings: UserSettings) => Promise<void>;
  userEmail: string;
}

interface TestReport {
  timestamp: string;
  gemini: {
    active: boolean;
    latencyMs: number;
    model: string;
    message: string;
    raw?: string;
  };
  bingx: {
    active: boolean;
    latencyMs: number;
    mode: string;
    balance?: { asset: string; balance: string } | null;
    message: string;
  };
}

export const BingXSettingsModal: React.FC<BingXSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  userEmail,
}) => {
  const [apiKey, setApiKey] = useState(settings?.bingxApiKey || '');
  const [secretKey, setSecretKey] = useState(settings?.bingxSecretKey || '');
  const [isTestnet, setIsTestnet] = useState(settings?.isTestnet ?? true);
  const [emailNotifications, setEmailNotifications] = useState(settings?.emailNotifications ?? true);
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Diagnostic Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setApiKey(settings.bingxApiKey || '');
      setSecretKey(settings.bingxSecretKey || '');
      setIsTestnet(settings.isTestnet ?? true);
      setEmailNotifications(settings.emailNotifications ?? true);
    }
  }, [settings]);

  // Run Real-Time Key & Connection Diagnostic Test
  const handleTestKeys = async () => {
    setIsTesting(true);
    setTestError(null);
    setTestReport(null);
    try {
      const res = await fetch('/api/system/test-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim(),
          isTestnet,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.report) {
        throw new Error(data.error || 'تعذر استكمال فحص المفاتيح');
      }
      setTestReport(data.report);
    } catch (err: any) {
      setTestError(err.message || 'فشل الاتصال بخادم الفحص');
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings({
        ownerId: settings?.ownerId || '',
        bingxApiKey: apiKey.trim(),
        bingxSecretKey: secretKey.trim(),
        isTestnet,
        emailNotifications,
        alertEmail: userEmail || 'alshmysyw973@gmail.com',
        updatedAt: new Date().toISOString(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="bingx-settings-modal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg shadow-2xl flex flex-col gap-4 text-right max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">
              إعدادات الربط واختبار المفاتيح
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 text-lg cursor-pointer">
            ✕
          </button>
        </div>

        {/* Live Diagnostics Card */}
        {testReport && (
          <div className="bg-slate-950 border border-slate-750 p-3.5 rounded-xl flex flex-col gap-2.5 text-xs animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>نتيجة فحص الاتصال والمفاتيح الفوري:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(testReport.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {/* Gemini Status */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <div>
                  <span className="font-bold text-white block">مفتاح الذكاء الاصطناعي (Gemini AI)</span>
                  <span className="text-[11px] text-slate-300">{testReport.gemini.message}</span>
                </div>
              </div>
              <div className="text-left font-mono">
                {testReport.gemini.active ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>شغال ({testReport.gemini.latencyMs}ms)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-bold text-[10px] flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>غير متصل</span>
                  </span>
                )}
              </div>
            </div>

            {/* BingX Status */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="font-bold text-white block">اتصال منصة BingX</span>
                  <span className="text-[11px] text-slate-300">{testReport.bingx.message}</span>
                </div>
              </div>
              <div className="text-left font-mono">
                {testReport.bingx.active ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>متصل ({testReport.bingx.latencyMs}ms)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-bold text-[10px] flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>فشل الاتصال</span>
                  </span>
                )}
              </div>
            </div>

            {/* Balance Badge if Available */}
            {testReport.bingx.balance && (
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/60 rounded border border-slate-850 text-[11px]">
                <span className="text-slate-400">الرصيد المتاح للتداول:</span>
                <span className="font-mono font-bold text-cyan-300">
                  ${testReport.bingx.balance.balance} {testReport.bingx.balance.asset}
                </span>
              </div>
            )}
          </div>
        )}

        {testError && (
          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{testError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-3 text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <span className="text-white font-medium block">وضع التداول التجريبي (Demo / Testnet)</span>
              <span className="text-[11px] text-slate-400">تنفيذ الصفقات وتجربة الوكلاء بدون مخاطرة بالأموال الحقيقية</span>
            </div>
            <input
              id="testnet-toggle-input"
              type="checkbox"
              checked={isTestnet}
              onChange={e => setIsTestnet(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">BingX API Key (اختياري للتنفيذ الحقيقي المباشر)</label>
            <input
              id="bingx-api-key-input"
              type="text"
              placeholder="e.g. 5x7u8d... (يمكنك تركه فارغاً لاستخدام المحاكي المدمج)"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">BingX Secret Key</label>
            <div className="relative">
              <input
                id="bingx-secret-key-input"
                type={showSecret ? 'text' : 'password'}
                placeholder="••••••••••••••••"
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-cyan-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <span className="text-white font-medium block">تنبيهات البريد الإلكتروني التلقائية</span>
              <span className="text-[11px] text-slate-400">إرسال تقرير فور تنفيذ أي صفقة جديدة عبر الوكيل</span>
            </div>
            <input
              id="email-alerts-toggle-input"
              type="checkbox"
              checked={emailNotifications}
              onChange={e => setEmailNotifications(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              يتم حفظ مفاتيحك مشفرة ومحمية في وثيقتك الخاصة على Firestore ومربوطة بحسابك فقط، دون وصول أي طرف ثالث.
            </span>
          </div>

          {savedSuccess && (
            <div className="p-2 rounded bg-emerald-950/70 border border-emerald-700 text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>تم حفظ الإعدادات بنجاح في قاعدة البيانات!</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-3 border-t border-slate-800">
            {/* Direct Diagnostic Test Button */}
            <button
              id="btn-test-keys-connection"
              type="button"
              disabled={isTesting}
              onClick={handleTestKeys}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-cyan-800/60 text-cyan-300 hover:text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
              <span>{isTesting ? 'جاري فحص المفاتيح...' : 'فحص واختبار المفاتيح الآن'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                إغلاق
              </button>
              <button
                id="btn-save-bingx-settings"
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
