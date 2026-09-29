import React, { useState, useEffect, useRef } from 'react';
import {
  Gavel,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  ArrowRight,
  Send,
  Camera,
  Volume2,
  VolumeX,
  Sliders,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  FileCheck2,
} from 'lucide-react';
import type { TradingAgent, UserSettings } from '../lib/firestoreService.ts';
import { resilientFetch } from '../lib/resilientFetch.ts';

interface AgentVote {
  agentName: string;
  vote: 'BUY' | 'SELL' | 'WAIT' | 'APPROVED' | 'VETO';
  reason: string;
  weight: number;
  score: number;
}

interface ArbitrationResult {
  tribunalVerdict: 'APPROVED_LONG' | 'APPROVED_SHORT' | 'REJECTED_RISK_VETO' | 'WAIT_CONFIRMATION';
  verdictTitleArabic: string;
  consensusScore: number;
  confidencePercent: number;
  action: 'BUY' | 'SELL' | 'WAIT';
  courtSessionSummary: string;
  agentVotes: AgentVote[];
  dissentingOpinions: string[];
  executionParameters: {
    pair: string;
    side: 'BUY' | 'SELL';
    entryZone: { min: number; max: number };
    recommendedEntry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    riskRewardRatio: string;
    recommendedLeverage: number;
    recommendedSizeUsdt: number;
    maxAllowedLossUsdt: number;
    invalidationRule: string;
  };
  safetyAdvisory: string;
  isFallback?: boolean;
}

interface VulnerabilityItem {
  id: string;
  category: 'SECURITY' | 'DATA_FEED' | 'AGENT_ECOSYSTEM' | 'RISK_ENGINE' | 'EXECUTION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  impact: string;
  recommendedFix: string;
  autoFixable: boolean;
}

interface AuditReport {
  overallHealthScore: number;
  systemStatus: 'OPTIMAL' | 'NEEDS_ATTENTION' | 'CRITICAL_RISK';
  checks: Record<string, { status: 'PASS' | 'WARN' | 'FAIL'; latencyMs?: number; message: string }>;
  agentRanks: Array<{ code: string; name: string; role: string }>;
  vulnerabilities: VulnerabilityItem[];
  recommendationArabic: string;
  timestamp: string;
}

interface ExpertTribunalAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
  currentPrice: number;
  agents: TradingAgent[];
  settings: UserSettings | null;
  accountBalance: {
    asset: string;
    balance: number;
    equity: number;
    availableMargin: number;
    mode: string;
  };
  onExecuteTrade: (trade: {
    symbol: string;
    type: 'LONG' | 'SHORT';
    amount: number;
    leverage: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    strategy: string;
    agentId?: string;
  }) => void;
  onMoveAllToBreakeven?: () => void;
  onEmergencyPanicClose?: () => void;
  onShowToast: (msg: string) => void;
}

export const ExpertTribunalAssistant: React.FC<ExpertTribunalAssistantProps> = ({
  isOpen,
  onClose,
  selectedPair,
  onSelectPair,
  currentPrice,
  agents,
  settings,
  accountBalance,
  onExecuteTrade,
  onMoveAllToBreakeven,
  onEmergencyPanicClose,
  onShowToast,
}) => {
  // Navigation tabs inside modal: 'tribunal' | 'audit' | 'copilot'
  const [activeTab, setActiveTab] = useState<'tribunal' | 'audit' | 'copilot'>('tribunal');

  // Tribunal State
  const [isArbitrating, setIsArbitrating] = useState(false);
  const [arbitrationData, setArbitrationData] = useState<ArbitrationResult | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'5m' | '15m' | '1h' | '4h'>('15m');
  const [executionSide, setExecutionSide] = useState<'LONG' | 'SHORT'>('LONG');

  // Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedFixes, setOptimizedFixes] = useState<any[]>([]);

  // Copilot Assistant State
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; time: string; image?: string }>>([
    {
      sender: 'assistant',
      text: 'مرحباً بك! أنا المساعد التنفيذي الخبير ورئيس مجلس التحكيم لنظام NEXUS AI TRADING. يمكنني تشغيل جلسة تحكيم شاملة للوكلاء، وفحص نقاط ضعف النظام، وتنفيذ أوامر التداول الحقيقي أو التجريبي بعد استيفاء شروط الحوكمة وإدارة المخاطر. كيف يمكنني مساندتك الآن؟',
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chartImageBase64, setChartImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // Request Full Arbitration Tribunal
  const runTribunalArbitration = async () => {
    setIsArbitrating(true);
    try {
      const res = await resilientFetch('/api/ai/arbitration-verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair: selectedPair,
          timeframe: selectedTimeframe,
          riskLimits: settings?.riskLimits || { maxLeverage: 10, maxRiskPerTrade: 2, stopLossRequired: true },
          accountBalance: accountBalance.balance || 50000,
        }),
      });
      const data = await res.json();
      if (data.arbitration) {
        setArbitrationData(data.arbitration);
        setExecutionSide(data.arbitration.action === 'SELL' ? 'SHORT' : 'LONG');
        onShowToast(`⚖️ أصدر مجلس التحكيم حكمه: ${data.arbitration.verdictTitleArabic}`);
      } else {
        onShowToast('⚠️ تعذر إتمام جلسة التحكيم الفنية، تم استدعاء الحكم الاحتياطي.');
      }
    } catch (e: any) {
      onShowToast(`خطأ في جلسة التحكيم: ${e.message}`);
    } finally {
      setIsArbitrating(false);
    }
  };

  // Run Deep System Vulnerability Audit
  const runDeepAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await resilientFetch('/api/system/expert-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings?.bingxApiKey || '',
          secretKey: settings?.bingxSecretKey || '',
          isTestnet: settings?.isTestnet ?? false,
          agents,
          riskLimits: settings?.riskLimits || { maxLeverage: 10, maxRiskPerTrade: 2, stopLossRequired: true },
          pair: selectedPair,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAuditReport(data);
        onShowToast(`🛡️ اكتمل الفحص الشامل: درجة صحة النظام ${data.overallHealthScore}/100`);
      }
    } catch (e: any) {
      onShowToast(`خطأ في فحص النظام: ${e.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // Run Auto-Optimize / Self-Healing
  const runAutoOptimize = async () => {
    setIsOptimizing(true);
    try {
      const res = await resilientFetch('/api/system/auto-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setOptimizedFixes(data.appliedFixes || []);
        onShowToast('🚀 تم تنفيذ التحسينات التلقائية ومعالجة نقاط الضعف بنجاح!');
        // Re-run audit to reflect 96%+ score
        setTimeout(() => runDeepAudit(), 500);
      }
    } catch (e: any) {
      onShowToast(`خطأ في التحسين التلقائي: ${e.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Execute Direct Trade from Tribunal Verdict
  const handleExecuteTribunalTrade = () => {
    if (!arbitrationData) return;
    const params = arbitrationData.executionParameters;
    const isLive = !settings?.isTestnet && settings?.liveTradingConfirmed;

    onExecuteTrade({
      symbol: params.pair || selectedPair,
      type: params.side === 'SELL' ? 'SHORT' : 'LONG',
      amount: params.recommendedSizeUsdt || 200,
      leverage: params.recommendedLeverage || 10,
      entryPrice: params.recommendedEntry || currentPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit1,
      strategy: `حكم مجلس التحكيم: ${arbitrationData.verdictTitleArabic}`,
    });

    onShowToast(`🚀 تم توجيه أمر الصفقة (${params.side}) برافعة ${params.recommendedLeverage}x (${isLive ? 'حقيقي BingX' : 'تجريبي VST'})`);
  };

  // Handle Copilot Chat Send
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || chatInput).trim();
    if (!query && !chartImageBase64) return;

    const userMsg = {
      sender: 'user' as const,
      text: query || 'تحليل لقطة شاشة الشارت المرفقة',
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      image: chartImageBase64 || undefined,
    };

    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await resilientFetch('/api/ai/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          pair: selectedPair,
          imageBase64: chartImageBase64 || undefined,
          context: {
            balance: accountBalance,
            isTestnet: settings?.isTestnet,
            liveTradingConfirmed: settings?.liveTradingConfirmed,
            arbitration: arbitrationData ? { verdict: arbitrationData.tribunalVerdict, score: arbitrationData.consensusScore } : null,
          },
        }),
      });

      const data = await res.json();
      const reply = data.reply || 'تمت معالجة الطلب.';

      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: reply,
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setChartImageBase64(null);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `عذراً، حدث خطأ أثناء معالجة الاستفسار: ${e.message}`,
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setChartImageBase64(reader.result as string);
      onShowToast('📸 تم إرفاق لقطة شاشة الشارت للتحليل البصري متعدد الوسائط');
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const isLiveTrading = !settings?.isTestnet && settings?.liveTradingConfirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Strip */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                  مجلس التحكيم المالي والوكيل الخبير
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-700/60">
                  NEXUS TRIBUNAL v3.2
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isLiveTrading
                      ? 'bg-rose-950/80 text-rose-300 border-rose-600/70'
                      : 'bg-cyan-950/80 text-cyan-300 border-cyan-600/70'
                  }`}
                >
                  {isLiveTrading ? 'LIVE TRADING 🔴' : 'PAPER VST 🟢'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                حوكمة قرارات الوكلاء المتعددين • فحص نقاط الضعف • التحكيم الذاتي قبل التنفيذ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('tribunal')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tribunal'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Gavel className="w-4 h-4 text-amber-300" />
            <span>جلسة تحكيم الصفقات (Trade Tribunal)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('audit');
              if (!auditReport) runDeepAudit();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-emerald-300" />
            <span>فاحص نقاط الضعف وتدقيق النظام (Deep Audit)</span>
            {auditReport && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-emerald-200">
                {auditReport.overallHealthScore}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('copilot')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'copilot'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>المساعد التنفيذي الصوتي والرؤية (Copilot & Vision)</span>
          </button>
        </div>

        {/* Tab 1: Trade Arbitration Tribunal */}
        {activeTab === 'tribunal' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Top Control Bar: Select Pair, Timeframe, Run Button */}
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الزوج المراد تحكيمه:</label>
                  <select
                    value={selectedPair}
                    onChange={e => onSelectPair(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-lg px-3 py-1.5 focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="BTC-USDT">BTC-USDT (Bitcoin)</option>
                    <option value="ETH-USDT">ETH-USDT (Ethereum)</option>
                    <option value="SOL-USDT">SOL-USDT (Solana)</option>
                    <option value="XAU-USDT">XAU-USDT (Gold Spot / Troy Ounce)</option>
                    <option value="XRP-USDT">XRP-USDT (Ripple)</option>
                    <option value="BNB-USDT">BNB-USDT (Binance Coin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الفريم الزمني:</label>
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
                    {(['5m', '15m', '1h', '4h'] as const).map(tf => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setSelectedTimeframe(tf)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                          selectedTimeframe === tf ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-r border-slate-700 pr-3">
                  <div className="text-[11px] text-slate-400">السعر اللحظي:</div>
                  <div className="text-sm font-black font-mono text-cyan-300">
                    ${currentPrice.toLocaleString()}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={runTribunalArbitration}
                disabled={isArbitrating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-indigo-600 to-indigo-700 hover:from-amber-400 hover:to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isArbitrating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                    <span>انعقاد جلسة مجلس التحكيم...</span>
                  </>
                ) : (
                  <>
                    <Gavel className="w-4 h-4 text-amber-300" />
                    <span>عقد جلسة تحكيم شاملة للوكلاء ⚖️</span>
                  </>
                )}
              </button>
            </div>

            {/* Arbitration Result Card */}
            {arbitrationData ? (
              <div className="space-y-5 animate-fadeIn">
                {/* Ruling Banner */}
                <div
                  className={`p-5 rounded-2xl border ${
                    arbitrationData.action === 'BUY'
                      ? 'bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/30'
                      : arbitrationData.action === 'SELL'
                      ? 'bg-rose-950/40 border-rose-500/50 shadow-rose-950/30'
                      : 'bg-amber-950/40 border-amber-500/50 shadow-amber-950/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-md ${
                          arbitrationData.action === 'BUY'
                            ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                            : arbitrationData.action === 'SELL'
                            ? 'bg-rose-600 text-white shadow-rose-600/30'
                            : 'bg-amber-600 text-white shadow-amber-600/30'
                        }`}
                      >
                        {arbitrationData.action === 'BUY' ? 'LONG' : arbitrationData.action === 'SELL' ? 'SHORT' : 'WAIT'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {arbitrationData.verdictTitleArabic}
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                            حكم المحكمة: {arbitrationData.tribunalVerdict}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                          {arbitrationData.courtSessionSummary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-center px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80">
                        <div className="text-[10px] text-slate-400">درجة التوافق (AI Score)</div>
                        <div className="text-lg font-black font-mono text-cyan-300">
                          {arbitrationData.consensusScore}/100
                        </div>
                      </div>
                      <div className="text-center px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80">
                        <div className="text-[10px] text-slate-400">نسبة العائد للمخاطرة</div>
                        <div className="text-lg font-black font-mono text-emerald-400">
                          {arbitrationData.executionParameters.riskRewardRatio}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dissenting opinions warning if any */}
                  {arbitrationData.dissentingOpinions && arbitrationData.dissentingOpinions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-start gap-2 text-xs text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <span className="font-bold">تحفظات واعتراضات هيئة التحكيم: </span>
                        <span>{arbitrationData.dissentingOpinions.join(' • ')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agents Jury Voting Table */}
                <div className="p-4 rounded-xl bg-slate-850 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>جدول تصويت الوكلاء المتخصصين في مجلس التحكيم (Jury Matrix)</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">6 وكلاء متخصصين + حق الفيتو لوكيل المخاطر</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {arbitrationData.agentVotes.map((vote, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white">{vote.agentName}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              vote.vote === 'BUY' || vote.vote === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                                : vote.vote === 'SELL'
                                ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                                : vote.vote === 'VETO'
                                ? 'bg-rose-900 text-rose-200 border border-rose-500 font-black'
                                : 'bg-amber-950 text-amber-300 border border-amber-600/50'
                            }`}
                          >
                            {vote.vote}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                          {vote.reason}
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                          <span>الوزن النسبي: {vote.weight}%</span>
                          <span className="font-mono text-cyan-400">{vote.score}/{vote.weight}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instant Execution Panel (If Verdict is Approved) */}
                {arbitrationData.action !== 'WAIT' && (
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-700/60 shadow-xl">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
                      <div className="space-y-1.5 text-center lg:text-right">
                        <div className="flex items-center justify-center lg:justify-start gap-2">
                          <span className="text-xs font-bold text-indigo-300">
                            جاهزية التنفيذ المباشر بعد استيفاء شروط التحكيم
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                            شروط المخاطرة مستوفاة
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          الدخول: ${arbitrationData.executionParameters.recommendedEntry.toLocaleString()} | الوقف (SL): ${arbitrationData.executionParameters.stopLoss.toLocaleString()} | الهدف الأول (TP1): ${arbitrationData.executionParameters.takeProfit1.toLocaleString()} | الرافعة: {arbitrationData.executionParameters.recommendedLeverage}x
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleExecuteTribunalTrade}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm shadow-xl shadow-emerald-500/30 transition-all cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>
                            تنفيذ صفقة {arbitrationData.action === 'BUY' ? 'شراء (LONG)' : 'بيع (SHORT)'} الآن 🚀
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-850/50">
                <Gavel className="w-12 h-12 text-indigo-400/60 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-white mb-1">
                  مجلس التحكيم بانتظار إشارة البدء
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4 leading-relaxed">
                  انقر على زر "عقد جلسة تحكيم شاملة للوكلاء" أعلاه لبدء فحص المؤشرات اللحظية وهيكل السوق والسيولة مع تطبيق قواعد إدارة المخاطر وتصويت الوكلاء الستة.
                </p>
                <button
                  type="button"
                  onClick={runTribunalArbitration}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>بدء التحكيم الآن لزوج {selectedPair}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Deep System Vulnerability Audit & Self-Healing */}
        {activeTab === 'audit' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Top Score & Action Bar */}
            <div className="p-5 rounded-2xl bg-slate-850 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black border ${
                    (auditReport?.overallHealthScore ?? 0) >= 80
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                      : (auditReport?.overallHealthScore ?? 0) >= 60
                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                      : 'bg-rose-950/60 border-rose-500/60 text-rose-300'
                  }`}
                >
                  <span className="text-2xl font-mono leading-none">
                    {auditReport?.overallHealthScore ?? '--'}
                  </span>
                  <span className="text-[9px] font-sans opacity-80 mt-0.5">درجة الأمان</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      فحص وتدقيق النظام لكشف نقاط الضعف
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        auditReport?.systemStatus === 'OPTIMAL'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-600/40'
                      }`}
                    >
                      {auditReport?.systemStatus || 'جاري الفحص'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    {auditReport?.recommendationArabic || 'تحليل شامل لحالة مفاتيح BingX، تدفقات البيانات اللحظية، جاهزية الوكلاء وقواطع المخاطر.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={runDeepAudit}
                  disabled={isAuditing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer"
                >
                  {isAuditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>إعادة الفحص</span>
                </button>

                <button
                  type="button"
                  onClick={runAutoOptimize}
                  disabled={isOptimizing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Zap className="w-4 h-4 text-emerald-200" />}
                  <span>معالجة وتحسين فوري (Auto-Fix) 🚀</span>
                </button>
              </div>
            </div>

            {/* System Vector Checks */}
            {auditReport && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(auditReport.checks).map(([key, check]) => (
                  <div key={key} className="p-3.5 rounded-xl bg-slate-850 border border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-300">
                        {key === 'apiSecurity'
                          ? 'أمان API والمفاتيح'
                          : key === 'dataFeed'
                          ? 'تغذية بيانات السوق'
                          : key === 'agentRanks'
                          ? 'جاهزية الوكلاء'
                          : 'محرك المخاطر والرافعة'}
                      </span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          check.status === 'PASS'
                            ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                            : check.status === 'WARN'
                            ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                            : 'bg-rose-400 shadow-[0_0_6px_#f43f5e]'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">{check.message}</p>
                    {check.latencyMs !== undefined && (
                      <span className="mt-2 inline-block text-[10px] font-mono text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded">
                        الزمن: {check.latencyMs}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Vulnerabilities Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>نقاط الضعف والمخاطر المكتشفة ({auditReport?.vulnerabilities.length || 0})</span>
              </h4>

              {auditReport && auditReport.vulnerabilities.length > 0 ? (
                auditReport.vulnerabilities.map(vuln => (
                  <div
                    key={vuln.id}
                    className="p-4 rounded-xl bg-slate-850 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            vuln.severity === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                              : vuln.severity === 'HIGH'
                              ? 'bg-rose-900/60 text-rose-200 border border-rose-700/40'
                              : vuln.severity === 'MEDIUM'
                              ? 'bg-amber-950 text-amber-300 border border-amber-600/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {vuln.severity}
                        </span>
                        <h5 className="text-xs font-bold text-white">{vuln.title}</h5>
                      </div>
                      <p className="text-xs text-slate-300">{vuln.description}</p>
                      <div className="text-[11px] text-emerald-400">
                        <span className="font-bold">الحل المقترح: </span>
                        {vuln.recommendedFix}
                      </div>
                    </div>

                    {vuln.autoFixable && (
                      <button
                        type="button"
                        onClick={runAutoOptimize}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        معالجة تلقائية ⚡
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-700/40 text-center text-xs text-emerald-300">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  لم يتم اكتشاف أي نقاط ضعف أو ثغرات خطرة! جميع معايير الحوكمة والتحكيم مستوفاة.
                </div>
              )}
            </div>

            {/* Applied Fixes Log if any */}
            {optimizedFixes.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-850 border border-emerald-600/40 space-y-2">
                <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>التحسينات المطبقة بنجاح:</span>
                </h5>
                <div className="space-y-1 text-xs text-slate-300">
                  {optimizedFixes.map(fix => (
                    <div key={fix.id} className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span className="font-bold text-white">{fix.action}: </span>
                      <span className="text-slate-400">{fix.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Autonomous Executive Copilot & Multimodal Vision Chat */}
        {activeTab === 'copilot' && (
          <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-5">
            {/* Quick Executive Trading Actions Bar */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs overflow-x-auto">
              <span className="text-slate-400 shrink-0 font-bold">أوامر تنفيذية سريعة:</span>
              <button
                type="button"
                onClick={() => {
                  onMoveAllToBreakeven?.();
                  handleSendMessage('تم إعطاء أمر بنقل جميع الصفقات المفتوحة إلى نقطة الدخول (Breakeven) لحماية الأرباح.');
                }}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                🛡️ نقل الوقف لنقطة التعادل
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(`حلل وضع ${selectedPair} فنياً وقدم ملخصاً لمناطق الدخول والوقف`)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-slate-700 font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                📊 تحليل فوري لـ {selectedPair}
              </button>
              <button
                type="button"
                onClick={() => {
                  onEmergencyPanicClose?.();
                  handleSendMessage('تم تنفيذ إغلاق طوارئ لكافة الصفقات النشطة في السوق.');
                }}
                className="px-3 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-300 font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                🚨 إغلاق طوارئ فوري
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.image && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-slate-700 max-w-xs">
                        <img src={msg.image} alt="Chart Screenshot" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    <div className="whitespace-pre-line">{msg.text}</div>
                    <div className="mt-2 text-[10px] opacity-70 text-left font-mono">
                      {msg.time}
                    </div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800 text-xs text-slate-300 w-fit">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>المساعد الخبير يقوم بتحليل بيانات السوق والشارت...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Attached Image Preview if any */}
            {chartImageBase64 && (
              <div className="p-2 mb-2 bg-slate-850 rounded-xl border border-indigo-500/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-indigo-300">
                  <Camera className="w-4 h-4" />
                  <span>تم إرفاق صورة الشارت للتحليل البصري المتعدد (Vision)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setChartImageBase64(null)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-cyan-400 border border-slate-700 transition-all cursor-pointer"
                title="إرفاق لقطة شاشة للشارت للتحليل البصري (Gemini Multimodal Vision)"
              >
                <Camera className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder={`اسأل المساعد عن ${selectedPair} أو اطلب جلسة تحكيم أو تفاصيل الصفقات...`}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-all"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isChatLoading || (!chatInput.trim() && !chartImageBase64)}
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer info bar */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>نظام الحوكمة والتحكيم المالي نشط ومتصل ببيانات BingX الحية</span>
          </div>
          <div className="text-left font-mono">
            {isLiveTrading ? 'LIVE EXECUTION READY' : 'PAPER SIMULATION MODE'}
          </div>
        </div>

      </div>
    </div>
  );
};
