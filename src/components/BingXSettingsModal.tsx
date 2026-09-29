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
  Palette,
  Moon,
  Sliders,
  ExternalLink,
  Brain,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { UserSettings } from '../lib/firestoreService.ts';
import { resilientFetch } from '../lib/resilientFetch.ts';

interface BingXSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings | null;
  onSaveSettings: (settings: UserSettings) => Promise<void>;
  userEmail: string;
  onThemeChange?: (theme: 'slate' | 'midnight-blue') => void;
  onConnectionTested?: (status: 'connected' | 'error', details: any) => void;
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
  bytez?: {
    active: boolean;
    latencyMs: number;
    message: string;
  };
  autoTrading?: {
    active: boolean;
    readyToOpenTrades: boolean;
    mode: string;
    message: string;
  };
}

export const BingXSettingsModal: React.FC<BingXSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  userEmail,
  onThemeChange,
  onConnectionTested,
}) => {
  const [activeTab, setActiveTab] = useState<'bingx' | 'bytez' | 'appearance'>('bingx');

  // BingX State
  const [apiKey, setApiKey] = useState(settings?.bingxApiKey || '');
  const [secretKey, setSecretKey] = useState(settings?.bingxSecretKey || '');
  const [isTestnet, setIsTestnet] = useState(settings?.isTestnet ?? true);
  const [showSecret, setShowSecret] = useState(false);

  // Bytez AI State (https://bytez.com/api/key)
  const [bytezApiKey, setBytezApiKey] = useState(settings?.bytezApiKey || '');
  const [selectedAiProvider, setSelectedAiProvider] = useState<'gemini' | 'bytez' | 'hybrid'>(
    settings?.selectedAiProvider || 'hybrid'
  );
  const [bytezModel, setBytezModel] = useState(settings?.bytezModel || 'deepseek-ai/DeepSeek-V3');
  const [showBytezSecret, setShowBytezSecret] = useState(false);

  // Preferences State
  const [emailNotifications, setEmailNotifications] = useState(settings?.emailNotifications ?? true);
  const [currentTheme, setCurrentTheme] = useState<'slate' | 'midnight-blue'>(settings?.theme || 'slate');
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
      setBytezApiKey(settings.bytezApiKey || '');
      setSelectedAiProvider(settings.selectedAiProvider || 'hybrid');
      setBytezModel(settings.bytezModel || 'deepseek-ai/DeepSeek-V3');
      setEmailNotifications(settings.emailNotifications ?? true);
      if (settings.theme) {
        setCurrentTheme(settings.theme);
      }
    }
  }, [settings]);

  const handleThemeChange = (newTheme: 'slate' | 'midnight-blue') => {
    setCurrentTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  // Run Real-Time Key & Connection Diagnostic Test
  const handleTestKeys = async () => {
    setIsTesting(true);
    setTestError(null);
    setTestReport(null);
    try {
      const res = await resilientFetch('/api/system/test-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim(),
          isTestnet,
          bytezApiKey: bytezApiKey.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'تعذر استكمال فحص المفاتيح');
      }

      const data = await res.json();
      if (!data.success || !data.report) {
        throw new Error(data.error || 'تعذر استكمال فحص المفاتيح');
      }
      setTestReport(data.report);
      if (data.report.bingx?.active) {
        onConnectionTested?.('connected', data.report.bingx);
      } else {
        onConnectionTested?.('error', data.report.bingx);
      }
    } catch (err: any) {
      setTestError(err.message || 'فشل الاتصال بخادم الفحص');
      onConnectionTested?.('error', { message: err.message });
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
        bytezApiKey: bytezApiKey.trim(),
        selectedAiProvider,
        bytezModel,
        emailNotifications,
        theme: currentTheme,
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
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-xl shadow-2xl flex flex-col gap-4 text-right max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">
              إعدادات منصات التداول والذكاء الاصطناعي (BingX & Bytez AI)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 text-lg cursor-pointer">
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('bingx')}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'bingx'
                ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>منصة BingX</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bytez')}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
              activeTab === 'bytez'
                ? 'bg-purple-950/80 border border-purple-500/50 text-purple-300 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>منصة Bytez AI ⚡</span>
            {bytezApiKey && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1.5 right-1.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'appearance'
                ? 'bg-slate-850 border border-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            <span>المظهر والتنبيهات</span>
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

            {/* Bytez AI Status */}
            {testReport.bytez && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="font-bold text-white block">منصة Bytez AI (DeepSeek / Llama)</span>
                    <span className="text-[11px] text-slate-300">{testReport.bytez.message}</span>
                  </div>
                </div>
                <div className="text-left font-mono">
                  {testReport.bytez.active ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>متصل ({testReport.bytez.latencyMs}ms)</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-bold text-[10px] flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>غير متصل</span>
                    </span>
                  )}
                </div>
              </div>
            )}

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

            {/* Auto-Trading Engine Readiness Status */}
            {testReport.autoTrading && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-bold text-white block">محرك الصفقات التلقائية (Auto-Trading Engine)</span>
                    <span className="text-[11px] text-slate-300">{testReport.autoTrading.message}</span>
                  </div>
                </div>
                <div className="text-left font-mono">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>جاهز للتنفيذ 100%</span>
                  </span>
                </div>
              </div>
            )}

            {/* Balance Badge if Available */}
            {testReport.bingx.balance && (() => {
              const rawBal = testReport.bingx.balance as any;
              let displayBalance = '0.00';
              let displayAsset = 'USDT';

              if (typeof rawBal === 'object' && rawBal !== null) {
                const inner = (rawBal.balance && typeof rawBal.balance === 'object') ? rawBal.balance : rawBal;
                displayAsset = (typeof inner.asset === 'string' && inner.asset) ? inner.asset : (typeof rawBal.asset === 'string' ? rawBal.asset : 'USDT');
                
                const val = (typeof inner.balance === 'string' || typeof inner.balance === 'number')
                  ? inner.balance
                  : (typeof rawBal.balance === 'string' || typeof rawBal.balance === 'number' ? rawBal.balance : '0.00');
                
                displayBalance = typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : String(val);
              } else if (typeof rawBal === 'string' || typeof rawBal === 'number') {
                displayBalance = String(rawBal);
              }

              return (
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/60 rounded border border-slate-850 text-[11px]">
                  <span className="text-slate-400">الرصيد المتاح للتداول:</span>
                  <span className="font-mono font-bold text-cyan-300">
                    ${displayBalance} {displayAsset}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {testError && (
          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{testError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-3 text-xs">
          {/* TAB 1: BINGX CONFIGURATION */}
          {activeTab === 'bingx' && (
            <div className="flex flex-col gap-3">
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
            </div>
          )}

          {/* TAB 2: BYTEZ AI INTEGRATION (https://bytez.com/api/key) */}
          {activeTab === 'bytez' && (
            <div className="flex flex-col gap-3">
              {/* Bytez Banner Info & Direct Link */}
              <div className="p-3 bg-gradient-to-r from-purple-950/70 to-slate-950 border border-purple-800/60 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white">منصة Bytez AI للنماذج المفتوحة (Open-Source AI)</span>
                  </div>
                  <a
                    href="https://bytez.com/api/key"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-purple-300 hover:text-white bg-purple-900/60 px-2.5 py-1 rounded-md border border-purple-700/60 transition-colors"
                  >
                    <span>الحصول على المفتاح من Bytez</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  تتيح منصة <strong>Bytez.com</strong> تشغيل نماذج الذكاء الاصطناعي العالمية مثل <strong>DeepSeek-R1</strong> و <strong>Llama-3.3-70B</strong> و <strong>Qwen-2.5</strong> لتعزيز التحليل الفني الكمي وتأكيد قرارات التداول الآلي بدقة استدلالية متقدمة.
                </p>
              </div>

              {/* Bytez API Key Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="bytez-api-key-input" className="text-slate-300 font-medium">مفتاح Bytez API Key</label>
                  <a
                    href="https://bytez.com/api/key"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-purple-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>https://bytez.com/api/key</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="bytez-api-key-input"
                    type={showBytezSecret ? 'text' : 'password'}
                    placeholder="الصق مفتاح Bytez API هنا (e.g. bz_...)"
                    value={bytezApiKey}
                    onChange={e => setBytezApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-700/60 focus:border-purple-400 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-hidden pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBytezSecret(!showBytezSecret)}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showBytezSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bytez Model Selector */}
              <div>
                <label htmlFor="bytez-model-select" className="block text-slate-300 font-medium mb-1">النموذج الذكي المفضل على Bytez</label>
                <select
                  id="bytez-model-select"
                  value={bytezModel}
                  onChange={e => setBytezModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-hidden focus:border-purple-500 cursor-pointer"
                >
                  <option value="deepseek-ai/DeepSeek-V3">deepseek-ai/DeepSeek-V3 (سرعة استجابة فائقة وتحليل متكامل - موصى به)</option>
                  <option value="meta-llama/Llama-3.3-70B-Instruct">meta-llama/Llama-3.3-70B-Instruct (النمذجة الكمية المؤسساتية)</option>
                  <option value="Qwen/Qwen2.5-72B-Instruct">Qwen/Qwen2.5-72B-Instruct (دقة العمليات الرياضية والمعادلات)</option>
                  <option value="mistralai/Mistral-Large-2407">mistralai/Mistral-Large-2407 (تحليل مالي متقدم)</option>
                  <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (استدلال سريع وموثوق)</option>
                  <option value="deepseek-ai/DeepSeek-R1">deepseek-ai/DeepSeek-R1 (تفكير استدلالي)</option>
                </select>
              </div>

              {/* AI Engine Provider Preference */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">وضع تشغيل محرك الذكاء الاصطناعي</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAiProvider('hybrid')}
                    className={`p-2.5 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                      selectedAiProvider === 'hybrid'
                        ? 'bg-purple-950/70 border-purple-500 text-purple-200 ring-1 ring-purple-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs text-white">هجين ذكي (Hybrid) ⭐</span>
                    <span className="text-[10px] text-slate-400">Gemini أساسي + Bytez احتياطي فوري</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAiProvider('bytez')}
                    className={`p-2.5 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                      selectedAiProvider === 'bytez'
                        ? 'bg-purple-950/70 border-purple-500 text-purple-200 ring-1 ring-purple-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs text-white">Bytez AI حصراً</span>
                    <span className="text-[10px] text-slate-400">DeepSeek R1 / Llama 3.3 المختار</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAiProvider('gemini')}
                    className={`p-2.5 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                      selectedAiProvider === 'gemini'
                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs text-white">Google Gemini</span>
                    <span className="text-[10px] text-slate-400">Gemini 2.5 Flash / Pro المدمج</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPEARANCE & ALERTS */}
          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-3">
              {/* Theme Selector Section */}
              <div className="flex flex-col gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium flex items-center gap-1.5 text-xs">
                    <Palette className="w-4 h-4 text-cyan-400" />
                    <span>سمة الواجهة وتجربة التداول (UI Theme)</span>
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {currentTheme === 'midnight-blue' ? 'Midnight Blue (نشط)' : 'Slate Dark (نشط)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    id="theme-toggle-slate"
                    onClick={() => handleThemeChange('slate')}
                    className={`p-2.5 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                      currentTheme === 'slate'
                        ? 'bg-slate-900 border-cyan-500 shadow-sm ring-1 ring-cyan-500/50'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-200">داكن كلاسيكي (Slate)</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-600" />
                    </div>
                    <span className="text-[10px] text-slate-400 leading-relaxed">
                      خلفيات رمادية احترافية متوازنة ومريحة للعين.
                    </span>
                  </button>

                  <button
                    type="button"
                    id="theme-toggle-midnight"
                    onClick={() => handleThemeChange('midnight-blue')}
                    className={`p-2.5 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                      currentTheme === 'midnight-blue'
                        ? 'bg-blue-950/80 border-blue-400 shadow-md ring-1 ring-blue-400/50 text-blue-100'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-300">أزرق ليلي (Midnight Blue)</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-blue-400 animate-pulse" />
                    </div>
                    <span className="text-[10px] text-blue-300/80 leading-relaxed">
                      تباين عالي فائق الوضوح مخصص لجلسات التداول المركزة.
                    </span>
                  </button>
                </div>
              </div>

              {/* Email Alerts Toggle */}
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
            </div>
          )}

          {/* Privacy & Encryption notice */}
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              يتم تشفير وحفظ مفاتيحك (BingX و Bytez) في قاعدة البيانات الموثقة لحسابك فقط، واستخدامها مباشرة في استدعاءات الـ API الآمنة.
            </span>
          </div>

          {savedSuccess && (
            <div className="p-2 rounded bg-emerald-950/70 border border-emerald-700 text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>تم حفظ الإعدادات ومفاتيح المنصة بنجاح!</span>
            </div>
          )}

          {/* Footer Actions */}
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
              <span>{isTesting ? 'جاري فحص جميع المفاتيح...' : 'فحص واختبار المفاتيح الآن'}</span>
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
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات والمفاتيح'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
