import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  Zap,
  Target,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Send,
  Mail,
  BookmarkPlus,
  Compass,
  LineChart,
  CheckCircle2,
} from 'lucide-react';
import type { KlineBar } from './TradingChart.tsx';
import {
  calculateEMA,
  calculateSMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  detectTradingOpportunities,
} from '../lib/indicators.ts';

export interface AiAnalysisResult {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentiment: string;
  confidenceScore: number;
  winRateEstimate: number;
  recommendation: 'BUY' | 'SELL' | 'WAIT';
  marketRegime?: string;
  entryTarget: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  riskRewardRatio: string;
  keySupport: string;
  keyResistance: string;
  indicatorsAnalysis: string;
  reasoningArabic: string;
  agentAction: string;
}

interface ChartAnalyzerProps {
  pair: string;
  timeframe: string;
  klines: KlineBar[];
  onExecuteTradeFromAnalysis: (analysis: AiAnalysisResult) => void;
  onPlotLevelsOnChart?: (entry: number, sl: number, tp1: number, tp2?: number, tp3?: number) => void;
  onSendEmailAlert: (analysis: AiAnalysisResult) => void;
  onSaveAnalysisToFirestore: (analysis: AiAnalysisResult) => void;
}

export const ChartAnalyzer: React.FC<ChartAnalyzerProps> = ({
  pair,
  timeframe,
  klines,
  onExecuteTradeFromAnalysis,
  onPlotLevelsOnChart,
  onSendEmailAlert,
  onSaveAnalysisToFirestore,
}) => {
  const [useHighThinking, setUseHighThinking] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levelsPlotted, setLevelsPlotted] = useState(false);

  const runAnalysis = async (promptOverride?: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setLevelsPlotted(false);

    try {
      // Calculate latest technical indicators summary to pass to Gemini
      const prices = klines.map(k => k.close);
      const e20 = calculateEMA(prices, 20);
      const e50 = calculateEMA(prices, 50);
      const s200 = calculateSMA(prices, Math.min(200, Math.max(20, Math.floor(prices.length * 0.8))));
      const bb = calculateBollingerBands(prices, 20, 2);
      const rsi = calculateRSI(prices, 14);
      const macd = calculateMACD(prices, 12, 26, 9);
      const opps = detectTradingOpportunities(klines, e20, e50, rsi, macd, bb);

      const lastIdx = prices.length - 1;
      const indicatorsSummary = {
        ema20: e20[lastIdx],
        ema50: e50[lastIdx],
        sma200: s200[lastIdx],
        rsi14: rsi[lastIdx],
        macd: {
          line: macd.macdLine[lastIdx],
          signal: macd.signalLine[lastIdx],
          hist: macd.histogram[lastIdx],
        },
        bollinger: {
          upper: bb.upper[lastIdx],
          middle: bb.middle[lastIdx],
          lower: bb.lower[lastIdx],
        },
        detectedOpportunitiesCount: opps.length,
        latestOpportunity: opps[opps.length - 1] || null,
      };

      const res = await fetch('/api/ai/analyze-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair,
          timeframe,
          klines,
          indicatorsSummary,
          customPrompt: promptOverride || customPrompt,
          useHighThinking,
          strategy: 'Smart Technical Confluence (Moving Averages, RSI, MACD, Bollinger, Order Blocks)',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل التحليل من خادم الذكاء الاصطناعي');
      }

      setAnalysis(data.analysis);
      setModelUsed(data.modelUsed);

      // Auto plot levels if supported
      if (onPlotLevelsOnChart && data.analysis) {
        onPlotLevelsOnChart(
          Number(data.analysis.entryTarget),
          Number(data.analysis.stopLoss),
          Number(data.analysis.takeProfit1),
          data.analysis.takeProfit2 ? Number(data.analysis.takeProfit2) : undefined,
          data.analysis.takeProfit3 ? Number(data.analysis.takeProfit3) : undefined
        );
        setLevelsPlotted(true);
      }
    } catch (err: any) {
      console.error('Analysis failed:', err);
      let message = err?.message || 'حدث خطأ أثناء تحليل الشارت';
      if (message.includes('503') || message.includes('high demand') || message.includes('UNAVAILABLE')) {
        message = 'خوادم الذكاء الاصطناعي تشهد طلباً مرتفعاً مؤقتاً. تم تفعيل نظام التوافق الكمي الاحتياطي، ويمكنك إعادة المحاولة في أي وقت.';
      }
      setErrorMsg(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlotLevels = () => {
    if (!analysis || !onPlotLevelsOnChart) return;
    onPlotLevelsOnChart(
      Number(analysis.entryTarget),
      Number(analysis.stopLoss),
      Number(analysis.takeProfit1),
      analysis.takeProfit2 ? Number(analysis.takeProfit2) : undefined,
      analysis.takeProfit3 ? Number(analysis.takeProfit3) : undefined
    );
    setLevelsPlotted(true);
  };

  const quickTemplates = [
    'تحليل مناطق السيولة وحركة الحيتان (SMC)',
    'تقاطع متوسطات EMA 20/50 ومؤشر الماكد MACD',
    'استراتيجية تشبع RSI وارتداد حدود بولينجر باند',
    'إدارة المخاطر وتحديد أهداف TP1, TP2, TP3 و SL بدقة',
  ];

  return (
    <div id="chart-analyzer-container" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <span>تحليل الشارت وتوقع الفرص بالذكاء الاصطناعي</span>
              <span className="text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-full border border-slate-700">
                Gemini Multi-Indicator Engine
              </span>
            </h2>
            <p className="text-xs text-slate-400">تحليل حي لبيانات BingX، تقاطع المتوسطات، RSI، MACD، وتحديد مستويات الدخول والأهداف</p>
          </div>
        </div>

        {/* High Thinking Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
          <button
            id="toggle-high-thinking-btn"
            onClick={() => setUseHighThinking(!useHighThinking)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
              useHighThinking
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>نمط التفكير الفائق (High Thinking)</span>
          </button>
          <span className="text-[10px] text-slate-500 px-1 font-mono">
            {useHighThinking ? 'gemini-3.1-pro-preview' : 'gemini-3.5-flash'}
          </span>
        </div>
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400">قوالب تحليلية موجهة:</span>
          {quickTemplates.map((t, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCustomPrompt(t);
                runAnalysis(t);
              }}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded border border-slate-700 transition-colors cursor-pointer"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            id="analysis-prompt-input"
            type="text"
            placeholder="أدخل استفسارك أو ركز على مؤشر معين (مثال: هل توجد فرصة دخول آمنة مع تقاطع MACD وكسر البولينجر؟)..."
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAnalysis()}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-indigo-500"
          />
          <button
            id="btn-run-analysis"
            disabled={isAnalyzing}
            onClick={() => runAnalysis()}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isAnalyzing ? (
              <>
                <Zap className="w-4 h-4 animate-spin text-amber-300" />
                <span>جاري معالجة الشارت والمؤشرات...</span>
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                <span>بدء التحليل والتوقع الفني</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-3 text-rose-300 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => {
              setErrorMsg(null);
              runAnalysis();
            }}
            disabled={isAnalyzing}
            className="px-3 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
          >
            إعادة المحاولة الآن
          </button>
        </div>
      )}

      {/* Analysis Output Result Card */}
      {analysis && (
        <div id="ai-analysis-results-card" className="bg-slate-950/90 border border-indigo-900/60 rounded-xl p-4 flex flex-col gap-3.5">
          {/* Top Bar with Recommendation Badge & Regime */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                  analysis.recommendation === 'BUY'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                    : analysis.recommendation === 'SELL'
                    ? 'bg-rose-950 text-rose-400 border-rose-700'
                    : 'bg-amber-950 text-amber-400 border-amber-700'
                }`}
              >
                {analysis.recommendation === 'BUY'
                  ? 'توصية: صفقة شراء صاعدة (LONG)'
                  : analysis.recommendation === 'SELL'
                  ? 'توصية: صفقة بيع هابطة (SHORT)'
                  : 'توصية: ترقب وانتظار (WAIT)'}
              </span>

              {analysis.marketRegime && (
                <span className="text-xs bg-slate-900 text-cyan-300 px-2.5 py-0.5 rounded border border-slate-700 font-medium">
                  حالة السوق: {analysis.marketRegime}
                </span>
              )}

              <span className="text-xs text-slate-400">
                الميل العام: <strong className="text-white">{analysis.sentiment}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">احتمالية الفوز:</span>
                <span className="text-emerald-400 font-bold text-sm bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800">
                  {analysis.winRateEstimate}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">نسبة الثقة:</span>
                <span className="text-cyan-400 font-bold text-sm bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800">
                  {analysis.confidenceScore}%
                </span>
              </div>
            </div>
          </div>

          {/* Targets Grid: Entry, SL, TP1, TP2, TP3, Risk:Reward */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block mb-0.5">نقطة الدخول</span>
              <span className="font-mono font-bold text-cyan-400 text-xs">${Number(analysis.entryTarget).toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block mb-0.5">وقف الخسارة (SL)</span>
              <span className="font-mono font-bold text-rose-400 text-xs">${Number(analysis.stopLoss).toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block mb-0.5">الهدف الأول (TP1)</span>
              <span className="font-mono font-bold text-emerald-400 text-xs">${Number(analysis.takeProfit1).toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block mb-0.5">الهدف الثاني (TP2)</span>
              <span className="font-mono font-bold text-emerald-400 text-xs">${Number(analysis.takeProfit2).toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block mb-0.5">الهدف الثالث (TP3)</span>
              <span className="font-mono font-bold text-teal-400 text-xs">
                ${analysis.takeProfit3 ? Number(analysis.takeProfit3).toLocaleString() : (Number(analysis.takeProfit2) * 1.02).toFixed(1)}
              </span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block mb-0.5">العائد / المخاطرة</span>
              <span className="font-mono font-bold text-amber-300 text-xs">{analysis.riskRewardRatio}</span>
            </div>
          </div>

          {/* Indicators & Reasoning Details */}
          <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 flex flex-col gap-2.5 text-xs">
            <div>
              <span className="text-indigo-400 font-bold block mb-1">تحليل المؤشرات الفنية المتقدم (MA / RSI / MACD / Bollinger):</span>
              <p className="text-slate-300 leading-relaxed">{analysis.indicatorsAnalysis}</p>
            </div>
            <div className="border-t border-slate-800 pt-2">
              <span className="text-cyan-400 font-bold block mb-1">الرؤية الاستشرافية وتفسير حركة السيولة:</span>
              <p className="text-slate-300 leading-relaxed">{analysis.reasoningArabic}</p>
            </div>
            <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <span>إجراء الوكيل المقترح: <strong className="text-emerald-400">{analysis.agentAction}</strong></span>
              <span className="font-mono text-slate-500">النموذج المستخدم: {modelUsed}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            {onPlotLevelsOnChart && (
              <button
                id="plot-levels-chart-btn"
                onClick={handlePlotLevels}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  levelsPlotted
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <LineChart className="w-4 h-4 text-cyan-400" />
                <span>{levelsPlotted ? 'المستويات مرسومة على الشارت ✓' : 'رسم المستويات على الشارت'}</span>
              </button>
            )}

            <button
              id="save-analysis-firestore-btn"
              onClick={() => onSaveAnalysisToFirestore(analysis)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer transition-colors"
            >
              <BookmarkPlus className="w-4 h-4 text-cyan-400" />
              <span>حفظ في Firestore</span>
            </button>

            <button
              id="send-gmail-analysis-btn"
              onClick={() => onSendEmailAlert(analysis)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 cursor-pointer transition-colors"
            >
              <Mail className="w-4 h-4 text-indigo-400" />
              <span>إرسال تقرير (Gmail)</span>
            </button>

            <button
              id="execute-trade-now-btn"
              onClick={() => onExecuteTradeFromAnalysis(analysis)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md"
            >
              <Target className="w-4 h-4" />
              <span>تنفيذ الصفقة على BingX فوراً</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
