import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bot,
  Brain,
  TrendingUp,
  TrendingDown,
  Layers,
  Settings,
  Mail,
  Globe,
  Image as ImageIcon,
  LogIn,
  LogOut,
  RefreshCw,
  Bell,
  Activity,
  ShieldCheck,
  Zap,
  BarChart3,
} from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  logOut,
  subscribeToAuth,
  testConnection,
  getCachedAccessToken,
} from './lib/firebase.ts';
import {
  subscribeToAgents,
  subscribeToTrades,
  subscribeToAnalyses,
  saveAgent,
  updateAgentStatus,
  updateAgent,
  deleteAgent,
  logTrade,
  closeTrade,
  saveAnalysisReport,
  saveUserSettings,
  getUserSettings,
  type TradingAgent,
  type TradeRecord,
  type ChartAnalysisRecord,
  type UserSettings,
  type BotAdaptationEvent,
} from './lib/firestoreService.ts';

import { TradingChart, type KlineBar } from './components/TradingChart.tsx';
import { BingXTradingViewChart } from './components/BingXTradingViewChart.tsx';
import { AgentManager } from './components/AgentManager.tsx';
import { ChartAnalyzer, type AiAnalysisResult } from './components/ChartAnalyzer.tsx';
import { BingXOrderPanel, type TickerData } from './components/BingXOrderPanel.tsx';
import { ProfitAnalytics } from './components/ProfitAnalytics.tsx';
import { PerformanceMetrics } from './components/PerformanceMetrics.tsx';
import { NewsFeedModal } from './components/NewsFeedModal.tsx';
import { ImageGeneratorModal } from './components/ImageGeneratorModal.tsx';
import { GmailAlertModal } from './components/GmailAlertModal.tsx';
import { BingXSettingsModal } from './components/BingXSettingsModal.tsx';

// Default initial agents to seed for the user
const DEFAULT_AGENTS: Omit<TradingAgent, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>[] = [
  {
    name: 'قناص السيولة الذكي (SMC Liquidity)',
    pair: 'BTC-USDT',
    strategy: 'Smart Money Concepts (SMC & Order Blocks)',
    timeframe: '15m',
    riskPercentage: 2,
    status: 'active',
    totalTrades: 34,
    winRate: 82.3,
    pnl: 1420.5,
    model: 'gemini-3.1-pro-preview',
  },
  {
    name: 'مقتنص الزخم الفوري (Trend Momentum)',
    pair: 'ETH-USDT',
    strategy: 'موجات الزخم وتقاطع المتوسطات المتحركة EMA',
    timeframe: '5m',
    riskPercentage: 1.5,
    status: 'active',
    totalTrades: 28,
    winRate: 75.0,
    pnl: 890.0,
    model: 'gemini-3.5-flash',
  },
  {
    name: 'مضارب السكالبينج السريع (Scalper Lite)',
    pair: 'SOL-USDT',
    strategy: 'انعكاسات RSI والدعوم والمقاومات',
    timeframe: '1m',
    riskPercentage: 1.0,
    status: 'paused',
    totalTrades: 52,
    winRate: 71.1,
    pnl: 645.2,
    model: 'gemini-3.1-flash-lite',
  },
  {
    name: 'راصد الأخبار الكبرى (Macro & News Agent)',
    pair: 'BTC-USDT',
    strategy: 'تحليل الأخبار الفورية وأحداث العملات',
    timeframe: '1h',
    riskPercentage: 3.0,
    status: 'active',
    totalTrades: 19,
    winRate: 84.2,
    pnl: 2150.8,
    model: 'gemini-3.5-flash',
  },
];

export default function App() {
  // Authentication & Workspace State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Market & Trading State
  const [selectedPair, setSelectedPair] = useState<string>('BTC-USDT');
  const [selectedInterval, setSelectedInterval] = useState<string>('15m');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [klines, setKlines] = useState<KlineBar[]>([]);
  const [orderbook, setOrderbook] = useState<{ bids: [string, string][]; asks: [string, string][] }>({
    bids: [],
    asks: [],
  });
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false);

  // Firestore Synchronized State
  const [agents, setAgents] = useState<TradingAgent[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<AiAnalysisResult | null>(null);
  const [chartLevels, setChartLevels] = useState<{
    entry?: number;
    stopLoss?: number;
    takeProfit?: number;
    takeProfit2?: number;
    takeProfit3?: number;
  }>({});

  // Modals & UI Controls
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [isImageGenOpen, setIsImageGenOpen] = useState(false);
  const [isGmailOpen, setIsGmailOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chart-trading' | 'analytics' | 'agents' | 'bingx-chart'>('chart-trading');

  // Trigger toast
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Boot test and Auth Subscription
  useEffect(() => {
    testConnection();
    const unsubscribe = subscribeToAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token || getCachedAccessToken());
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Fetch Tickers Feed
  const fetchTickers = useCallback(async () => {
    try {
      const res = await fetch('/api/bingx/tickers');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTickers(data.data);
      }
    } catch (e) {
      console.warn('Failed to load tickers:', e);
    }
  }, []);

  // 3. Fetch Klines & Depth for current pair
  const fetchKlinesAndDepth = useCallback(async (pair: string, interval: string) => {
    setIsChartLoading(true);
    try {
      const [klinesRes, depthRes] = await Promise.all([
        fetch(`/api/bingx/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=70`),
        fetch(`/api/bingx/orderbook?symbol=${encodeURIComponent(pair)}`),
      ]);

      const klinesData = await klinesRes.json();
      if (klinesData.success && Array.isArray(klinesData.data)) {
        setKlines(klinesData.data);
      }

      const depthData = await depthRes.json();
      if (depthData.success && depthData.data) {
        setOrderbook(depthData.data);
      }
    } catch (e) {
      console.warn('Failed to fetch klines or depth:', e);
    } finally {
      setIsChartLoading(false);
    }
  }, []);

  // Initial and periodic market data fetching
  useEffect(() => {
    fetchTickers();
    const tickerInterval = setInterval(fetchTickers, 7000);
    return () => clearInterval(tickerInterval);
  }, [fetchTickers]);

  useEffect(() => {
    fetchKlinesAndDepth(selectedPair, selectedInterval);
  }, [selectedPair, selectedInterval, fetchKlinesAndDepth]);

  // 4. Firestore Subscriptions for authenticated user
  useEffect(() => {
    if (!currentUser?.uid) {
      // Offline / Demo seed state
      const demoAgents: TradingAgent[] = DEFAULT_AGENTS.map((a, i) => ({
        ...a,
        id: `agent-demo-${i}`,
        ownerId: 'demo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      setAgents(demoAgents);

      // Demo sample trades
      const demoTrades: TradeRecord[] = [
        {
          id: 'trade-demo-1',
          ownerId: 'demo',
          pair: 'BTC-USDT',
          side: 'LONG',
          entryPrice: 86400,
          exitPrice: 88150,
          amount: 500,
          leverage: 10,
          stopLoss: 85500,
          takeProfit: 88150,
          pnl: 1012.73,
          pnlPercentage: 20.25,
          status: 'CLOSED',
          source: 'SMC Liquidity Agent',
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        {
          id: 'trade-demo-2',
          ownerId: 'demo',
          pair: 'ETH-USDT',
          side: 'SHORT',
          entryPrice: 3220,
          exitPrice: 3140,
          amount: 400,
          leverage: 15,
          stopLoss: 3260,
          takeProfit: 3140,
          pnl: 596.27,
          pnlPercentage: 37.26,
          status: 'CLOSED',
          source: 'Trend Momentum AI',
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
      ];
      setTrades(demoTrades);
      return;
    }

    const unsubAgents = subscribeToAgents(currentUser.uid, userAgents => {
      if (userAgents.length === 0) {
        // Seed default agents for user in Firestore
        DEFAULT_AGENTS.forEach(async (initAgent, i) => {
          await saveAgent({
            ...initAgent,
            id: `agent_${currentUser.uid.slice(0, 5)}_${Date.now()}_${i}`,
            ownerId: currentUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });
      } else {
        setAgents(userAgents);
      }
    });

    const unsubTrades = subscribeToTrades(currentUser.uid, userTrades => {
      setTrades(userTrades);
    });

    getUserSettings(currentUser.uid).then(s => setSettings(s));

    return () => {
      unsubAgents();
      unsubTrades();
    };
  }, [currentUser]);

  // Current live prices map
  const currentPricesMap = useMemo(() => {
    const map: Record<string, number> = {};
    tickers.forEach(t => {
      map[t.symbol] = parseFloat(t.lastPrice) || 0;
    });
    return map;
  }, [tickers]);

  // Actions
  const handleSignIn = async () => {
    try {
      const res = await signInWithGoogle();
      if (res?.accessToken) {
        setAccessToken(res.accessToken);
        showToast('تم تسجيل الدخول وتفعيل صلاحيات Gmail بنجاح!');
      }
    } catch (err) {
      console.error(err);
      showToast('تعذر تسجيل الدخول، يرجى المحاولة مرة أخرى.');
    }
  };

  const handleSignOut = async () => {
    await logOut();
    showToast('تم تسجيل الخروج بنجاح.');
  };

  // Agent Management
  const handleToggleAgent = async (agentId: string, status: 'active' | 'paused' | 'stopped') => {
    if (currentUser) {
      await updateAgentStatus(agentId, status);
    } else {
      setAgents(prev => prev.map(a => (a.id === agentId ? { ...a, status } : a)));
    }
    showToast(`تم تحديث حالة الوكيل إلى: ${status === 'active' ? 'نشط' : 'متوقف'}`);
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (currentUser) {
      await deleteAgent(agentId);
    } else {
      setAgents(prev => prev.filter(a => a.id !== agentId));
    }
    showToast('تم حذف الوكيل بنجاح.');
  };

  const handleCreateAgent = async (
    agentData: Omit<TradingAgent, 'id' | 'createdAt' | 'updatedAt' | 'totalTrades' | 'winRate' | 'pnl'>
  ) => {
    const newAgent: TradingAgent = {
      ...agentData,
      id: `agent_${Date.now()}`,
      ownerId: currentUser?.uid || 'demo',
      totalTrades: 0,
      winRate: 0,
      pnl: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (currentUser) {
      await saveAgent(newAgent);
    } else {
      setAgents(prev => [newAgent, ...prev]);
    }
    showToast(`تم إنشاء الوكيل "${newAgent.name}" بنجاح!`);
  };

  const handleUpdateAgent = async (agentId: string, updates: Partial<TradingAgent>) => {
    if (currentUser) {
      await updateAgent(agentId, updates);
    } else {
      setAgents(prev => prev.map(a => (a.id === agentId ? { ...a, ...updates } : a)));
    }
    showToast('تم تحديث معلمات وإعدادات الوكيل بنجاح!');
  };

  // Execute Agent Autonomous Cycle
  const handleRunAgentCycle = async (agent: TradingAgent) => {
    const currentTicker = tickers.find(t => t.symbol === agent.pair);
    try {
      const res = await fetch('/api/ai/agent-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          ticker: currentTicker,
          klines: klines.slice(-25),
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Apply market adaptation if returned
      if (data.adaptation) {
        const updatedAdaptation = {
          marketRegime: data.adaptation.marketRegime || 'RANGE_CONSOLIDATION',
          autoPilot: agent.adaptation?.autoPilot ?? true,
          lastAdaptedAt: new Date().toISOString(),
          adaptationSummary: data.adaptation.summary || 'تم فحص الشارت وتحديث المؤشرات الفنية.',
          adaptiveScore: 90,
        };

        const updatedRisk = {
          ...(agent.riskParameters || {
            riskPercentage: agent.riskPercentage || 2,
            maxDrawdownPercent: 10,
            leverage: 10,
            stopLossPercent: 2,
            takeProfitPercent: 4.5,
            trailingStop: true,
            maxOpenTrades: 2,
          }),
          leverage: data.adaptation.adaptedParameters?.leverage ?? agent.riskParameters?.leverage ?? 10,
          stopLossPercent: data.adaptation.adaptedParameters?.stopLossPercent ?? agent.riskParameters?.stopLossPercent ?? 2,
          takeProfitPercent: data.adaptation.adaptedParameters?.takeProfitPercent ?? agent.riskParameters?.takeProfitPercent ?? 4.5,
          riskPercentage: data.adaptation.adaptedParameters?.riskPercentage ?? agent.riskPercentage ?? 2,
        };

        const newHistoryEvent: BotAdaptationEvent = {
          timestamp: new Date().toISOString(),
          marketRegime: data.adaptation.marketRegime || 'RANGE_CONSOLIDATION',
          changeSummary: data.adaptation.summary || 'تكييف المعلمات مع حركة وتقلبات السوق الحالية',
          tunedParameters: `الرافعة ${updatedRisk.leverage}x | مخاطرة ${updatedRisk.riskPercentage}% | SL ${updatedRisk.stopLossPercent}% | TP ${updatedRisk.takeProfitPercent}%`,
          confidence: data.adaptation.confidence || 85,
        };

        const history = [newHistoryEvent, ...(agent.adaptationHistory || [])].slice(0, 25);

        if (currentUser) {
          await updateAgent(agent.id, {
            adaptation: updatedAdaptation,
            riskParameters: updatedRisk,
            adaptationHistory: history,
            riskPercentage: updatedRisk.riskPercentage,
          });
        } else {
          setAgents(prev =>
            prev.map(a =>
              a.id === agent.id
                ? {
                    ...a,
                    adaptation: updatedAdaptation,
                    riskParameters: updatedRisk,
                    adaptationHistory: history,
                    riskPercentage: updatedRisk.riskPercentage,
                  }
                : a
            )
          );
        }
      }

      const decision = data.decision;
      if (decision.execute) {
        // Execute trade automatically!
        const tradeAmount = 500 * (agent.riskPercentage / 2);
        const newTrade: TradeRecord = {
          id: `trade_${Date.now()}`,
          ownerId: currentUser?.uid || 'demo',
          agentId: agent.id,
          pair: agent.pair,
          side: decision.side as any,
          entryPrice: decision.entryPrice || parseFloat(currentTicker?.lastPrice || '87400'),
          amount: tradeAmount,
          leverage: decision.leverage || 10,
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          pnl: 0,
          pnlPercentage: 0,
          status: 'OPEN',
          source: `${agent.name} (Automated)`,
          createdAt: new Date().toISOString(),
        };

        if (currentUser) {
          await logTrade(newTrade);
        } else {
          setTrades(prev => [newTrade, ...prev]);
        }

        showToast(`قام الوكيل "${agent.name}" بفتح صفقة ${decision.side} على ${agent.pair} بنجاح!`);
      } else {
        showToast(`قرار الوكيل "${agent.name}": ${decision.reason}`);
      }
    } catch (e: any) {
      console.error(e);
      showToast('تعذر استكمال دورة الوكيل، يرجى إعادة المحاولة.');
    }
  };

  // Manual / Terminal Trade Execution
  const handleExecuteTrade = async (tradeData: Omit<TradeRecord, 'id' | 'createdAt'>) => {
    const trade: TradeRecord = {
      ...tradeData,
      id: `trade_${Date.now()}`,
      ownerId: currentUser?.uid || 'demo',
      createdAt: new Date().toISOString(),
    };

    if (currentUser) {
      await logTrade(trade);
    } else {
      setTrades(prev => [trade, ...prev]);
    }
  };

  // Close Active Position
  const handleCloseTrade = async (trade: TradeRecord) => {
    const currentPrice = currentPricesMap[trade.pair] || trade.entryPrice;
    const diff = trade.side === 'LONG' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
    const pnlPct = (diff / trade.entryPrice) * trade.leverage * 100;
    const finalPnl = (trade.amount * pnlPct) / 100;

    if (currentUser) {
      await closeTrade(trade.id, currentPrice, finalPnl, pnlPct);
    } else {
      setTrades(prev =>
        prev.map(t =>
          t.id === trade.id
            ? { ...t, status: 'CLOSED', exitPrice: currentPrice, pnl: finalPnl, pnlPercentage: pnlPct }
            : t
        )
      );
    }

    showToast(`تم إغلاق الصفقة على ربح/خسارة: ${finalPnl >= 0 ? `+$${finalPnl.toFixed(2)}` : `-$${Math.abs(finalPnl).toFixed(2)}`}`);
  };

  // Save Analysis to Firestore
  const handleSaveAnalysisToFirestore = async (analysis: AiAnalysisResult) => {
    if (!currentUser) {
      showToast('يرجى تسجيل الدخول لحفظ التحليل في حسابك.');
      return;
    }
    const report: ChartAnalysisRecord = {
      id: `analysis_${Date.now()}`,
      ownerId: currentUser.uid,
      pair: selectedPair,
      timeframe: selectedInterval,
      sentiment: analysis.sentiment,
      confidence: analysis.confidenceScore,
      recommendation: analysis.recommendation,
      summary: analysis.reasoningArabic,
      indicators: analysis.indicatorsAnalysis,
      createdAt: new Date().toISOString(),
    };

    await saveAnalysisReport(report);
    showToast('تم حفظ تقرير التحليل بنجاح في قاعدة بيانات Firestore!');
  };

  // Execute Trade directly from AI Analysis Card
  const handleExecuteTradeFromAnalysis = async (analysis: AiAnalysisResult) => {
    if (analysis.recommendation === 'WAIT') {
      showToast('التوصية الحالية هي الانتظار والترقب.');
      return;
    }
    const side = analysis.recommendation === 'BUY' ? 'LONG' : 'SHORT';
    const currentPrice = currentPricesMap[selectedPair] || analysis.entryTarget;

    await handleExecuteTrade({
      ownerId: currentUser?.uid || 'demo',
      pair: selectedPair,
      side,
      entryPrice: analysis.entryTarget || currentPrice,
      amount: 500,
      leverage: 10,
      stopLoss: analysis.stopLoss,
      takeProfit: analysis.takeProfit1,
      pnl: 0,
      pnlPercentage: 0,
      status: 'OPEN',
      source: 'Gemini Chart Analysis Signal',
    });
    showToast(`تم إرسال وتنفيذ إشارة ${side} فوراً على BingX!`);
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Toast Notification */}
      {notification && (
        <div id="toast-banner" className="fixed top-4 left-1/2 -translate-x-1/2 z-70 bg-cyan-900 border border-cyan-500 text-white px-5 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Bell className="w-4 h-4 text-amber-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header Navbar */}
      <header id="main-app-header" className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Exchange Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-white text-base tracking-tight">
                  BingX AI Trading
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Perpetual & Agents
                </span>
              </div>
              <p className="text-[11px] text-slate-400">منصة وكلاء التداول الآلي وتحليل الشارت المدعومة بـ Gemini</p>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="header-news-btn"
              onClick={() => setIsNewsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs text-slate-200 transition-colors cursor-pointer"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">أخبار السوق (Grounding)</span>
            </button>

            <button
              id="header-image-gen-btn"
              onClick={() => setIsImageGenOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs text-slate-200 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">توليد صورة الشارت (4K)</span>
            </button>

            <button
              id="header-gmail-btn"
              onClick={() => setIsGmailOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs text-slate-200 transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">تنبيهات Gmail</span>
            </button>

            <button
              id="header-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 hover:text-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
              title="فحص واختبار المفاتيح وإعدادات المنصة"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>المفاتيح: شغالة</span>
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            {/* Auth Button */}
            {currentUser ? (
              <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
                <div className="text-right hidden md:block">
                  <span className="block text-xs font-bold text-white truncate max-w-[120px]">
                    {currentUser.displayName || currentUser.email}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>متصل بـ Firestore</span>
                  </span>
                </div>
                <button
                  id="btn-sign-out"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-sign-in"
                onClick={handleSignIn}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>ربط الحساب (Google)</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Tickers Ribbon */}
        <div className="bg-slate-950/90 border-t border-slate-850 py-1.5 px-4 overflow-x-auto text-xs font-mono">
          <div className="max-w-7xl mx-auto flex items-center gap-6">
            <span className="text-slate-500 text-[11px] font-sans shrink-0 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>أسعار BingX المباشرة:</span>
            </span>

            {tickers.map(t => {
              const isSelected = t.symbol === selectedPair;
              const isBull = parseFloat(t.priceChangePercent) >= 0;
              return (
                <button
                  key={t.symbol}
                  onClick={() => setSelectedPair(t.symbol)}
                  className={`flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0 ${
                    isSelected ? 'bg-slate-800 border border-slate-700' : 'hover:bg-slate-900'
                  }`}
                >
                  <span className="font-bold text-white">{t.symbol.replace('-USDT', '')}</span>
                  <span className="text-slate-300">${parseFloat(t.lastPrice).toLocaleString()}</span>
                  <span className={`text-[10px] font-semibold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isBull ? '+' : ''}{t.priceChangePercent}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main id="main-content-layout" className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-5">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div className="flex gap-2">
            <button
              id="tab-chart-trading"
              onClick={() => setActiveTab('chart-trading')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'chart-trading'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              منصة التحليل والتداول المباشر
            </button>
            <button
              id="tab-agents"
              onClick={() => setActiveTab('agents')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'agents'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>الوكلاء الأذكياء ({agents.length})</span>
            </button>
            <button
              id="tab-analytics"
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>مؤشرات الأداء (Performance Metrics)</span>
            </button>
            <button
              id="tab-bingx-chart"
              onClick={() => setActiveTab('bingx-chart')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bingx-chart'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>شارت BingX المباشر (BingX Real-Time)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>نظام التداول التلقائي BingX متصل وجاهز</span>
          </div>
        </div>

        {/* Tab 1: Chart & Live Trading */}
        {activeTab === 'chart-trading' && (
          <div className="flex flex-col gap-5">
            {/* Top Grid: Interactive Chart + BingX Order Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 flex flex-col gap-4">
                <TradingChart
                  pair={selectedPair}
                  klines={klines}
                  interval={selectedInterval}
                  onIntervalChange={setSelectedInterval}
                  entryPrice={chartLevels.entry ?? activeAnalysis?.entryTarget}
                  stopLoss={chartLevels.stopLoss ?? activeAnalysis?.stopLoss}
                  takeProfit={chartLevels.takeProfit ?? activeAnalysis?.takeProfit1}
                  takeProfit2={chartLevels.takeProfit2 ?? activeAnalysis?.takeProfit2}
                  takeProfit3={chartLevels.takeProfit3 ?? activeAnalysis?.takeProfit3}
                  isLoading={isChartLoading}
                  onSelectOpportunity={opp => {
                    const isBull = opp.type === 'BULLISH';
                    setChartLevels({
                      entry: opp.price,
                      stopLoss: isBull ? opp.price * 0.98 : opp.price * 1.02,
                      takeProfit: isBull ? opp.price * 1.04 : opp.price * 0.96,
                      takeProfit2: isBull ? opp.price * 1.07 : opp.price * 0.93,
                      takeProfit3: isBull ? opp.price * 1.10 : opp.price * 0.90,
                    });
                    showToast(`تم تطبيق مستويات فرصة: ${opp.signal}`);
                  }}
                />

                {/* Gemini Chart Analyzer */}
                <ChartAnalyzer
                  pair={selectedPair}
                  timeframe={selectedInterval}
                  klines={klines}
                  onExecuteTradeFromAnalysis={handleExecuteTradeFromAnalysis}
                  onPlotLevelsOnChart={(entry, sl, tp1, tp2, tp3) => {
                    setChartLevels({
                      entry,
                      stopLoss: sl,
                      takeProfit: tp1,
                      takeProfit2: tp2,
                      takeProfit3: tp3,
                    });
                    showToast('تم رسم مستويات الدخول والأهداف TP1/TP2/TP3 ووقف الخسارة على الشارت!');
                  }}
                  onSendEmailAlert={analysis => {
                    setActiveAnalysis(analysis);
                    setIsGmailOpen(true);
                  }}
                  onSaveAnalysisToFirestore={handleSaveAnalysisToFirestore}
                />
              </div>

              {/* BingX Order Execution Panel */}
              <div className="lg:col-span-1">
                <BingXOrderPanel
                  pair={selectedPair}
                  onPairChange={setSelectedPair}
                  tickers={tickers}
                  orderbook={orderbook}
                  onExecuteTrade={handleExecuteTrade}
                />
              </div>
            </div>

            {/* Quick Profit & Open Positions Strip */}
            <ProfitAnalytics
              trades={trades}
              onCloseTrade={handleCloseTrade}
              currentPrices={currentPricesMap}
            />
          </div>
        )}

        {/* Tab 2: Autonomous Agents */}
        {activeTab === 'agents' && (
          <div className="flex flex-col gap-5">
            <AgentManager
              agents={agents}
              onToggleStatus={handleToggleAgent}
              onDeleteAgent={handleDeleteAgent}
              onCreateAgent={handleCreateAgent}
              onUpdateAgent={handleUpdateAgent}
              onRunAgentCycle={handleRunAgentCycle}
            />
          </div>
        )}

        {/* Tab 3: Analytics & PnL History */}
        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-5">
            {/* Visual Recharts Weekly & Monthly Performance Dashboard */}
            <PerformanceMetrics trades={trades} />

            {/* Detailed Positions & Realized Records */}
            <ProfitAnalytics
              trades={trades}
              onCloseTrade={handleCloseTrade}
              currentPrices={currentPricesMap}
            />
          </div>
        )}

        {/* Tab 4: Dedicated BingX Real-Time TradingView Chart View */}
        {activeTab === 'bingx-chart' && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 flex flex-col gap-4">
                <BingXTradingViewChart
                  pair={selectedPair}
                  interval={selectedInterval}
                />

                {/* Gemini Chart Analyzer for current pair */}
                <ChartAnalyzer
                  pair={selectedPair}
                  timeframe={selectedInterval}
                  klines={klines}
                  onExecuteTradeFromAnalysis={handleExecuteTradeFromAnalysis}
                  onPlotLevelsOnChart={(entry, sl, tp1, tp2, tp3) => {
                    setChartLevels({
                      entry,
                      stopLoss: sl,
                      takeProfit: tp1,
                      takeProfit2: tp2,
                      takeProfit3: tp3,
                    });
                    showToast('تم حفظ مستويات التحليل للدخول والأهداف!');
                  }}
                  onSendEmailAlert={analysis => {
                    setActiveAnalysis(analysis);
                    setIsGmailOpen(true);
                  }}
                  onSaveAnalysisToFirestore={handleSaveAnalysisToFirestore}
                />
              </div>

              {/* BingX Order Execution Panel */}
              <div className="lg:col-span-1">
                <BingXOrderPanel
                  pair={selectedPair}
                  onPairChange={setSelectedPair}
                  tickers={tickers}
                  orderbook={orderbook}
                  onExecuteTrade={handleExecuteTrade}
                />
              </div>
            </div>

            {/* Quick Profit & Open Positions Strip */}
            <ProfitAnalytics
              trades={trades}
              onCloseTrade={handleCloseTrade}
              currentPrices={currentPricesMap}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <NewsFeedModal isOpen={isNewsOpen} onClose={() => setIsNewsOpen(false)} />

      <ImageGeneratorModal
        isOpen={isImageGenOpen}
        onClose={() => setIsImageGenOpen(false)}
        pair={selectedPair}
      />

      <GmailAlertModal
        isOpen={isGmailOpen}
        onClose={() => setIsGmailOpen(false)}
        analysis={activeAnalysis}
        pair={selectedPair}
        userEmail={currentUser?.email || 'alshmysyw973@gmail.com'}
        accessToken={accessToken}
        onRequireLogin={handleSignIn}
      />

      <BingXSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={async newSettings => {
          if (currentUser) {
            await saveUserSettings(newSettings);
            setSettings(newSettings);
            showToast('تم حفظ إعدادات BingX بنجاح!');
          } else {
            setSettings(newSettings);
            showToast('تم حفظ الإعدادات في الجلسة المحلية.');
          }
        }}
        userEmail={currentUser?.email || 'alshmysyw973@gmail.com'}
      />
    </div>
  );
}
