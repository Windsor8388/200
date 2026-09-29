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
  BellRing,
  Activity,
  ShieldCheck,
  Zap,
  BarChart3,
  Palette,
  Moon,
  Wallet,
  Sliders,
  Flame,
  Loader2,
  Volume2,
  VolumeX,
  Scale,
  Gavel,
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
  updateTrade,
  saveAnalysisReport,
  saveUserSettings,
  getUserSettings,
  type TradingAgent,
  type TradeRecord,
  type ChartAnalysisRecord,
  type UserSettings,
  type BotAdaptationEvent,
  type BotRiskParameters,
} from './lib/firestoreService.ts';

import { soundService } from './lib/soundService.ts';
import { pushNotificationService } from './lib/pushNotificationService.ts';
import { BingXKeysReminderBanner } from './components/BingXKeysReminderBanner.tsx';
import { AiInstantScalpBar } from './components/AiInstantScalpBar.tsx';
import { LiveMarketRadar } from './components/LiveMarketRadar.tsx';
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
import { PriceAlertsModal } from './components/PriceAlertsModal.tsx';
import { PushNotificationModal } from './components/PushNotificationModal.tsx';
import { LiveTradingActivationModal } from './components/LiveTradingActivationModal.tsx';
import { ExpertTribunalAssistant } from './components/ExpertTribunalAssistant.tsx';
import { StrategyBacktester } from './components/StrategyBacktester.tsx';
import { ToolsCommandDrawer } from './components/ToolsCommandDrawer.tsx';
import { MobileBottomNavigation } from './components/MobileBottomNavigation.tsx';
import { resilientFetch } from './lib/resilientFetch.ts';
import { getFullTechnicalSummary } from './lib/indicators.ts';
import {
  type PriceAlert,
  getPriceAlerts,
  savePriceAlerts,
  playAlertSound,
  sendDesktopNotification,
} from './lib/alertsService.ts';

// Default initial agents to seed for the user
const DEFAULT_AGENTS: Omit<TradingAgent, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>[] = [
  {
    name: 'روبوت التداول العصبي الذكي (BTC/USDT Neural Bot)',
    pair: 'BTC-USDT',
    strategy: 'تحليل الشموع اليابانية، الدعم والمقاومة، تقاطع المتوسطات EMA 20/50 ومؤشر MACD وإدارة المخاطر',
    timeframe: '15m',
    riskPercentage: 2,
    status: 'active',
    totalTrades: 42,
    winRate: 85.7,
    pnl: 2840.5,
    model: 'gemini-3.1-pro-preview',
    minConfidenceScore: 80,
    executionMode: 'AUTO_BINGX',
    patternTriggers: ['SUPPORT_RESISTANCE', 'EMA_CROSS', 'MACD_REVERSAL', 'CANDLESTICK_PATTERNS'],
    riskParameters: {
      riskPercentage: 2,
      maxDrawdownPercent: 8,
      leverage: 10,
      stopLossPercent: 1.8,
      takeProfitPercent: 4.5,
      trailingStop: true,
      maxOpenTrades: 2,
    },
  },
  {
    name: 'صياد سبائك الذهب الفوري (Gold SMC Hunter)',
    pair: 'XAU-USDT',
    strategy: 'Smart Money Concepts & Troy Ounce Liquidity Blocks',
    timeframe: '15m',
    riskPercentage: 2.0,
    status: 'active',
    totalTrades: 38,
    winRate: 84.2,
    pnl: 3420.0,
    model: 'gemini-2.5-flash',
  },
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
    model: 'gemini-2.5-flash',
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
    model: 'gemini-flash-latest',
  },
];

export default function App() {
  // Authentication & Workspace State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningInLoading, setIsSigningInLoading] = useState(false);

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

  // Firestore & LocalStorage Synchronized State
  const [agents, setAgents] = useState<TradingAgent[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(() => {
    try {
      const saved = localStorage.getItem('bingx_user_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
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
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  const [isTribunalOpen, setIsTribunalOpen] = useState(false);
  const [isToolsDrawerOpen, setIsToolsDrawerOpen] = useState(false);
  const [showScalpBar, setShowScalpBar] = useState(true);

  // Market Price Alerts & Live Radar State
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [activeTriggerBanner, setActiveTriggerBanner] = useState<{
    alert: PriceAlert;
    currentPrice: number;
  } | null>(null);

  // Theme State: 'slate' (default dark) vs 'midnight-blue' (high-contrast intense trading theme)
  const [theme, setTheme] = useState<'slate' | 'midnight-blue'>('slate');
  const [notification, setNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chart-trading' | 'backtest' | 'analytics' | 'agents' | 'bingx-chart'>('chart-trading');

  // BingX Main Account Balance & Auto-Pilot State
  const [accountBalance, setAccountBalance] = useState<{
    asset: string;
    balance: number;
    equity: number;
    unrealizedProfit: number;
    availableMargin: number;
    usedMargin: number;
    marginRatio: string;
    mode: string;
    mainFundBalance?: number;
    spotBalance?: number;
    futuresBalance?: number;
    totalMainBalance?: number;
    hasFundBalanceNotTransferred?: boolean;
    walletBreakdown?: Array<{ wallet: string; asset: string; amount: number; valueUsdt: number }>;
  }>({
    asset: 'USDT',
    balance: 50000.0,
    equity: 52430.5,
    unrealizedProfit: 2430.5,
    availableMargin: 48200.0,
    usedMargin: 1800.0,
    marginRatio: '3.6%',
    mode: 'DEMO_VST',
    mainFundBalance: 0,
    spotBalance: 0,
    futuresBalance: 50000.0,
    totalMainBalance: 50000.0,
    hasFundBalanceNotTransferred: false,
  });
  const [isTransferringFunds, setIsTransferringFunds] = useState(false);
  const [isBalanceRefreshing, setIsBalanceRefreshing] = useState(false);
  const [realPositions, setRealPositions] = useState<TradeRecord[]>([]);
  const [isFetchingRealPositions, setIsFetchingRealPositions] = useState(false);
  const [isAutoTradingActive, setIsAutoTradingActive] = useState(true);

  // Trigger toast
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Sound effects state & toggle
  const [isSoundMuted, setIsSoundMuted] = useState(() => soundService.getIsMuted());
  const handleToggleSound = () => {
    const muted = soundService.toggleMute();
    setIsSoundMuted(muted);
    showToast(muted ? '🔇 تم كتم المؤثرات الصوتية' : '🔊 تم تفعيل المؤثرات الصوتية للتداول');
  };

  // Push notifications & Voice briefing state
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() =>
    pushNotificationService.getPermission()
  );

  useEffect(() => {
    return pushNotificationService.subscribePermissionChange(setPushPermission);
  }, []);

  // BingX API Connection Status Indicator: 'checking' (أصفر), 'connected' (أخضر), 'error' (أحمر)
  const [bingxApiStatus, setBingxApiStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [bingxStatusDetails, setBingxStatusDetails] = useState<{
    latencyMs?: number;
    message?: string;
    mode?: string;
    lastChecked?: string;
  } | null>(null);

  // Auto-Retry state: triggers a single re-check attempt after 5 seconds upon connection error 🔴
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [autoRetryCountdown, setAutoRetryCountdown] = useState<number | null>(null);
  const hasAutoRetriedRef = React.useRef(false);
  const retryTimeoutRef = React.useRef<any>(null);
  const countdownIntervalRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const checkBingXConnection = useCallback(async (notify = false, isAutoRetryAttempt = false) => {
    setBingxApiStatus('checking');
    try {
      const activeApiKey = settings?.bingxApiKey?.trim() || '';
      const activeSecretKey = settings?.bingxSecretKey?.trim() || '';
      const isTestnet = settings?.isTestnet ?? false;
      const activeBytezKey = settings?.bytezApiKey?.trim() || '';

      const res = await resilientFetch('/api/system/test-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: activeApiKey,
          secretKey: activeSecretKey,
          isTestnet,
          bytezApiKey: activeBytezKey,
        }),
      });

      const handleErrorState = (msg: string, mode: string) => {
        setBingxApiStatus('error');
        setBingxStatusDetails({
          message: msg,
          mode,
          lastChecked: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        });

        // Trigger Auto-Retry exactly once after 5 seconds before stopping
        if (!isAutoRetryAttempt && !hasAutoRetriedRef.current) {
          setIsAutoRetrying(true);
          setAutoRetryCountdown(5);
          let seconds = 5;

          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);

          countdownIntervalRef.current = setInterval(() => {
            seconds -= 1;
            if (seconds > 0) {
              setAutoRetryCountdown(seconds);
            } else {
              clearInterval(countdownIntervalRef.current);
            }
          }, 1000);

          retryTimeoutRef.current = setTimeout(async () => {
            hasAutoRetriedRef.current = true;
            setIsAutoRetrying(false);
            setAutoRetryCountdown(null);
            await checkBingXConnection(false, true);
          }, 5000);
        } else if (isAutoRetryAttempt) {
          setIsAutoRetrying(false);
          setAutoRetryCountdown(null);
          showToast('⚠️ اكتملت محاولة إعادة الاتصال التلقائية وتوقفت بعد 5 ثوانٍ.');
        } else if (notify) {
          showToast('🔴 تنبيه: خطأ في اتصال BingX API أو المفاتيح غير صالحة');
        }
      };

      if (!res.ok) {
        handleErrorState('تعذر الاتصال بخادم فحص BingX', 'NETWORK_ERROR');
        return;
      }

      const data = await res.json();
      if (data?.report?.bingx?.active) {
        setBingxApiStatus('connected');
        hasAutoRetriedRef.current = false;
        setIsAutoRetrying(false);
        setAutoRetryCountdown(null);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        setBingxStatusDetails({
          latencyMs: data.report.bingx.latencyMs,
          message: data.report.bingx.message,
          mode: data.report.bingx.mode,
          lastChecked: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        });
        if (notify) {
          showToast(`🟢 اتصال BingX API متصل بنجاح (${data.report.bingx.latencyMs || 0}ms)`);
        }
      } else {
        handleErrorState(
          data?.report?.bingx?.message || data?.error || 'فشل الاتصال بمنصة BingX',
          data?.report?.bingx?.mode || 'ERROR'
        );
      }
    } catch (err: any) {
      setBingxApiStatus('error');
      setBingxStatusDetails({
        message: err?.message || 'تعذر الوصول إلى خادم فحص BingX',
        mode: 'NETWORK_ERROR',
        lastChecked: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      });
      if (notify) {
        showToast('🔴 خطأ في الاتصال بالشبكة مع خادم BingX');
      }
    }
  }, [settings]);

  // Periodic and reactive check of BingX API connectivity
  useEffect(() => {
    checkBingXConnection();
    const timer = setInterval(() => {
      checkBingXConnection();
    }, 60000);
    return () => clearInterval(timer);
  }, [checkBingXConnection]);

  // 0. Fetch BingX Main Account Balance
  const fetchAccountBalance = useCallback(async () => {
    try {
      setIsBalanceRefreshing(true);
      const activeApiKey = settings?.bingxApiKey?.trim() || '';
      const activeSecretKey = settings?.bingxSecretKey?.trim() || '';
      const isTestnet = settings?.isTestnet ?? false;

      const res = await resilientFetch('/api/bingx/account-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: activeApiKey,
          secretKey: activeSecretKey,
          isTestnet,
        }),
      });
      if (!res || !res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.success && json?.data) {
        setAccountBalance({
          asset: json.data.asset || 'USDT',
          balance: typeof json.data.balance === 'number' ? json.data.balance : (Number(json.data.balance) || 0),
          equity: typeof json.data.equity === 'number' ? json.data.equity : (Number(json.data.equity) || 0),
          unrealizedProfit: typeof json.data.unrealizedProfit === 'number' ? json.data.unrealizedProfit : (Number(json.data.unrealizedProfit) || 0),
          availableMargin: typeof json.data.availableMargin === 'number' ? json.data.availableMargin : (Number(json.data.availableMargin) || 0),
          usedMargin: typeof json.data.usedMargin === 'number' ? json.data.usedMargin : (Number(json.data.usedMargin) || 0),
          marginRatio: json.data.marginRatio || '0%',
          mode: json.mode || (activeApiKey && !isTestnet ? 'LIVE_BINGX' : 'DEMO_VST'),
          mainFundBalance: json.data.mainFundBalance,
          spotBalance: json.data.spotBalance,
          futuresBalance: json.data.futuresBalance,
          totalMainBalance: json.data.totalMainBalance,
          hasFundBalanceNotTransferred: json.data.hasFundBalanceNotTransferred,
          walletBreakdown: json.data.walletBreakdown,
        });
      }
    } catch (e) {
      console.warn('Failed to load BingX account balance:', e);
    } finally {
      setIsBalanceRefreshing(false);
    }
  }, [settings]);

  // One-Click Fast Internal Transfer from Funding/Spot to Futures
  const handleQuickTransferToFutures = async () => {
    if (isTransferringFunds) return;
    setIsTransferringFunds(true);
    try {
      const activeApiKey = settings?.bingxApiKey?.trim() || '';
      const activeSecretKey = settings?.bingxSecretKey?.trim() || '';
      const availToTransfer = accountBalance.totalMainBalance || (accountBalance.mainFundBalance || 0) + (accountBalance.spotBalance || 0);

      const res = await resilientFetch('/api/bingx/transfer-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: activeApiKey,
          secretKey: activeSecretKey,
          amount: availToTransfer > 0 ? availToTransfer : 10,
          type: 'FUND_SWAP',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || '✅ تم تحويل الرصيد إلى محفظة العقود الآجلة بنجاح!');
        fetchAccountBalance();
      } else {
        showToast(`⚠️ ${data.message || 'يرجى إجراء التحويل الداخلي في تطبيق BingX (محفظة التمويل ➔ العقود)'}`);
      }
    } catch (err: any) {
      showToast(`خطأ في التحويل: ${err.message || 'تعذر الاتصال'}`);
    } finally {
      setIsTransferringFunds(false);
    }
  };

  // Fetch Real Open Positions Directly from BingX Swap API
  const fetchRealPositions = useCallback(async () => {
    const activeApiKey = settings?.bingxApiKey?.trim() || '';
    const activeSecretKey = settings?.bingxSecretKey?.trim() || '';
    if (!activeApiKey || !activeSecretKey || settings?.isTestnet) {
      setRealPositions([]);
      return;
    }
    try {
      setIsFetchingRealPositions(true);
      const res = await resilientFetch('/api/bingx/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: activeApiKey, secretKey: activeSecretKey }),
      });
      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && Array.isArray(json.positions)) {
          const mapped: TradeRecord[] = json.positions.map((p: any) => ({
            id: p.id || `bx_live_${p.symbol}_${p.side}`,
            ownerId: currentUser?.uid || 'bingx_live',
            pair: p.symbol,
            side: p.side,
            entryPrice: p.entryPrice,
            markPrice: p.markPrice,
            amount: p.amount || (p.margin || 50),
            contractQuantity: p.contractQuantity,
            leverage: p.leverage || 10,
            liquidationPrice: p.liquidationPrice,
            pnl: p.pnl || 0,
            pnlPercentage: p.pnlPercentage || 0,
            status: 'OPEN',
            source: 'BingX Live (عقود حقيقية)',
            isLivePosition: true,
            positionId: p.positionId,
            createdAt: p.updateTime || new Date().toISOString(),
          }));
          setRealPositions(mapped);
        }
      }
    } catch (e) {
      console.warn('Real BingX positions fetch error:', e);
    } finally {
      setIsFetchingRealPositions(false);
    }
  }, [settings, currentUser]);

  // Combined trades list (merges real BingX live positions with local/Firestore trades)
  const combinedTrades = useMemo(() => {
    if (realPositions.length === 0) return trades;
    const realIds = new Set(realPositions.map(r => r.positionId || r.id));
    const localNonDuplicates = trades.filter(t => !realIds.has(t.id) && !realIds.has(t.positionId || ''));
    return [...realPositions, ...localNonDuplicates];
  }, [realPositions, trades]);

  // Periodic polling for real positions and balances
  useEffect(() => {
    fetchRealPositions();
    const interval = setInterval(() => {
      if (settings?.bingxApiKey && !settings?.isTestnet) {
        fetchRealPositions();
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [fetchRealPositions, settings]);

  // 1. Boot test and Auth Subscription
  useEffect(() => {
    testConnection().catch(e => {
      console.warn('Firebase test connection notice:', e);
    });
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
      const res = await resilientFetch('/api/bingx/tickers');
      if (!res || !res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.success && Array.isArray(data.data)) {
        setTickers(data.data);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  // 3. Fetch Klines & Depth for current pair
  const fetchKlinesAndDepth = useCallback(async (pair: string, interval: string) => {
    setIsChartLoading(true);
    try {
      const [klinesResult, depthResult] = await Promise.allSettled([
        resilientFetch(`/api/bingx/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=70`),
        resilientFetch(`/api/bingx/orderbook?symbol=${encodeURIComponent(pair)}`),
      ]);

      if (klinesResult.status === 'fulfilled' && klinesResult.value && klinesResult.value.ok) {
        const klinesData = await klinesResult.value.json().catch(() => null);
        if (klinesData?.success && Array.isArray(klinesData.data)) {
          setKlines(klinesData.data);
        }
      }

      if (depthResult.status === 'fulfilled' && depthResult.value && depthResult.value.ok) {
        const depthData = await depthResult.value.json().catch(() => null);
        if (depthData?.success && depthData.data && Array.isArray(depthData.data.bids) && Array.isArray(depthData.data.asks)) {
          setOrderbook(depthData.data);
        }
      }
    } catch {
      // Graceful handling without throwing unhandled exceptions
    } finally {
      setIsChartLoading(false);
    }
  }, []);

  // Initial and periodic market data fetching
  useEffect(() => {
    fetchTickers();
    fetchAccountBalance();
    const tickerInterval = setInterval(fetchTickers, 3500);
    const balanceInterval = setInterval(fetchAccountBalance, 10000);
    return () => {
      clearInterval(tickerInterval);
      clearInterval(balanceInterval);
    };
  }, [fetchTickers, fetchAccountBalance]);

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
          id: 'trade-demo-gold',
          ownerId: 'demo',
          pair: 'XAU-USDT',
          side: 'LONG',
          entryPrice: 2674.50,
          exitPrice: 2712.80,
          amount: 800,
          leverage: 20,
          stopLoss: 2658.00,
          takeProfit: 2712.80,
          pnl: 1432.20,
          pnlPercentage: 179.02,
          status: 'CLOSED',
          source: 'Gold SMC Hunter',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
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

    getUserSettings(currentUser.uid)
      .then(s => {
        if (s) {
          setSettings(s);
          if (s.theme) setTheme(s.theme);
        }
      })
      .catch(() => {});

    return () => {
      unsubAgents();
      unsubTrades();
    };
  }, [currentUser]);

  const handleToggleTheme = async (newTheme?: 'slate' | 'midnight-blue') => {
    const nextTheme = newTheme || (theme === 'slate' ? 'midnight-blue' : 'slate');
    setTheme(nextTheme);
    showToast(`تم تفعيل السمة: ${nextTheme === 'midnight-blue' ? 'Midnight Blue (أزرق ليلي عالي التباين)' : 'Slate (داكن كلاسيكي)'}`);
    if (currentUser?.uid) {
      const updated: UserSettings = {
        ...(settings || {
          ownerId: currentUser.uid,
          emailNotifications: true,
          alertEmail: currentUser.email || 'alshmysyw973@gmail.com',
          isTestnet: true,
          updatedAt: new Date().toISOString(),
        }),
        theme: nextTheme,
      };
      setSettings(updated);
      await saveUserSettings(updated);
    }
  };

  // Current live prices map
  const currentPricesMap = useMemo(() => {
    const map: Record<string, number> = {};
    tickers.forEach(t => {
      map[t.symbol] = parseFloat(t.lastPrice) || 0;
    });
    return map;
  }, [tickers]);

  // Load user price alerts
  useEffect(() => {
    const ownerId = currentUser?.uid || 'demo';
    getPriceAlerts(ownerId).then(loaded => {
      setAlerts(loaded);
    });
  }, [currentUser]);

  // Real-Time Price Radar Alert Checker
  useEffect(() => {
    if (tickers.length === 0 || alerts.length === 0) return;

    let hasChanges = false;
    let newlyHitAlert: { alert: PriceAlert; currentPrice: number } | null = null;

    const updatedAlerts = alerts.map(alert => {
      if (alert.triggered || !alert.active) return alert;

      const ticker = tickers.find(t => t.symbol === alert.pair);
      if (!ticker) return alert;

      const currentPrice = parseFloat(ticker.lastPrice);
      if (!currentPrice || isNaN(currentPrice)) return alert;

      const isHit =
        (alert.direction === 'ABOVE' && currentPrice >= alert.targetPrice) ||
        (alert.direction === 'BELOW' && currentPrice <= alert.targetPrice);

      if (isHit) {
        hasChanges = true;
        if (alert.soundEnabled !== false) {
          playAlertSound();
        }

        const pairLabel = alert.pair === 'XAU-USDT' ? 'الذهب (XAU-USDT)' : alert.pair;
        const dirLabel = alert.direction === 'ABOVE' ? 'تجاوز صعوداً' : 'هبط أدنى من';
        const title = `🔔 تنبيه وصول السوق: ${pairLabel}`;
        const body = `وصل السعر الآن إلى $${(currentPrice ?? 0).toLocaleString()} (${dirLabel} المستهدف $${(alert?.targetPrice ?? 0).toLocaleString()})\n${alert?.note || ''}`;
        sendDesktopNotification(title, body);

        newlyHitAlert = { alert, currentPrice };

        return {
          ...alert,
          triggered: true,
          triggeredAt: new Date().toISOString(),
          triggeredPrice: currentPrice,
        };
      }

      return alert;
    });

    if (hasChanges) {
      setAlerts(updatedAlerts);
      const ownerId = currentUser?.uid || 'demo';
      savePriceAlerts(ownerId, updatedAlerts);
      if (newlyHitAlert) {
        setActiveTriggerBanner(newlyHitAlert);
        soundService.playAlertTrigger();
      }
    }
  }, [tickers, alerts, currentUser]);

  const handleAddAlert = (newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => {
    const ownerId = currentUser?.uid || 'demo';
    const alert: PriceAlert = {
      ...newAlert,
      id: `alert_${Date.now()}`,
      ownerId,
      createdAt: new Date().toISOString(),
      triggered: false,
    };
    const nextList = [alert, ...alerts];
    setAlerts(nextList);
    savePriceAlerts(ownerId, nextList);
    showToast(`تم تفعيل التنبيه السعري لـ ${alert.pair} عند $${(alert?.targetPrice ?? 0).toLocaleString()}`);
  };

  const handleDeleteAlert = (id: string) => {
    const ownerId = currentUser?.uid || 'demo';
    const nextList = alerts.filter(a => a.id !== id);
    setAlerts(nextList);
    savePriceAlerts(ownerId, nextList);
    showToast('تم حذف التنبيه.');
  };

  const handleToggleAlert = (id: string, active: boolean) => {
    const ownerId = currentUser?.uid || 'demo';
    const nextList = alerts.map(a => (a.id === id ? { ...a, active } : a));
    setAlerts(nextList);
    savePriceAlerts(ownerId, nextList);
  };

  const handleReactivateAlert = (id: string) => {
    const ownerId = currentUser?.uid || 'demo';
    const nextList = alerts.map(a =>
      a.id === id ? { ...a, triggered: false, active: true, triggeredAt: undefined, triggeredPrice: undefined } : a
    );
    setAlerts(nextList);
    savePriceAlerts(ownerId, nextList);
    showToast('تمت إعادة تفعيل التنبيه السعري بنجاح.');
  };

  const handleClearTriggered = () => {
    const ownerId = currentUser?.uid || 'demo';
    const nextList = alerts.filter(a => !a.triggered);
    setAlerts(nextList);
    savePriceAlerts(ownerId, nextList);
    showToast('تم مسح سجل التنبيهات المنفذة.');
  };

  // Actions
  const handleSignIn = async () => {
    if (isSigningInLoading) return;
    setIsSigningInLoading(true);
    try {
      const res = await signInWithGoogle();
      if (res?.accessToken) {
        setAccessToken(res.accessToken);
        showToast('تم تسجيل الدخول وتفعيل صلاحيات Gmail بنجاح!');
      } else if (res?.user) {
        showToast('تم تسجيل الدخول بنجاح!');
      }
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMsg = err?.message || '';
      if (
        errorCode !== 'auth/cancelled-popup-request' &&
        errorCode !== 'auth/popup-closed-by-user' &&
        !errorMsg.includes('auth/cancelled-popup-request') &&
        !errorMsg.includes('auth/popup-closed-by-user')
      ) {
        console.error('Sign-in error:', err);
        showToast('تعذر تسجيل الدخول، يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSigningInLoading(false);
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
    const techSummary = klines.length >= 5 ? getFullTechnicalSummary(klines, agent.pair) : null;
    try {
      const res = await resilientFetch('/api/ai/agent-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          ticker: currentTicker,
          klines: klines.slice(-25),
          indicators: techSummary,
          bytezApiKey: settings?.bytezApiKey?.trim() || '',
          bytezModel: settings?.bytezModel || 'deepseek-ai/DeepSeek-V3',
          selectedAiProvider: settings?.selectedAiProvider || 'hybrid',
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

        const oldLeverage = agent.riskParameters?.leverage ?? 10;
        const newLeverage = data.adaptation.adaptedParameters?.leverage ?? agent.riskParameters?.leverage ?? 10;

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
          leverage: newLeverage,
          stopLossPercent: data.adaptation.adaptedParameters?.stopLossPercent ?? agent.riskParameters?.stopLossPercent ?? 2,
          takeProfitPercent: data.adaptation.adaptedParameters?.takeProfitPercent ?? agent.riskParameters?.takeProfitPercent ?? 4.5,
          riskPercentage: data.adaptation.adaptedParameters?.riskPercentage ?? agent.riskPercentage ?? 2,
        };

        // Trigger Browser Push Notification & Fast Spoken Voice Briefing when agent adjusts leverage due to sudden volatility
        if (data.adaptation.adaptedParameters?.leverage !== undefined && oldLeverage !== newLeverage) {
          pushNotificationService.sendLeverageAdaptationNotification({
            agentName: agent.name,
            pair: agent.pair,
            oldLeverage,
            newLeverage,
            reason: data.adaptation.summary || 'استجابة لتقلبات السوق المفاجئة وتغير سيولة العقد',
            volatilityLevel: 'HIGH',
          });
          showToast(`⚡ الوكيل ${agent.name}: قام بتعديل الرافعة إلى ${newLeverage}x بناءً على تقلبات السوق`);
        }

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
        // Enforce agent minimum AI confidence threshold if specified
        if (agent.minConfidenceScore && decision.confidence && decision.confidence < agent.minConfidenceScore) {
          showToast(`⏸️ الوكيل "${agent.name}": ثقة النموذج (${decision.confidence}%) أقل من الشرط المطلوب (${agent.minConfidenceScore}%). استمرار الترقب والتحليل.`);
          return;
        }

        // Live Futures safety check
        if (agent.executionMode === 'LIVE_FUTURES' && (!settings?.bingxApiKey?.trim() || !settings?.bingxSecretKey?.trim())) {
          showToast(`⚠️ الوكيل "${agent.name}" مضبوط على التنفيذ الحقيقي (Live Futures). يرجى إدخال مفاتيح BingX API في الإعدادات.`);
        }

        // Execute trade automatically through BingX Order Router!
        // Dynamic margin calculation supporting micro accounts down to $0.50 USDT balance
        const availableBal = Number(accountBalance?.availableMargin ?? accountBalance?.balance ?? 50);
        let tradeAmount = 0.50;
        if (availableBal <= 1) {
          tradeAmount = Math.max(0.20, Number((availableBal * 0.85).toFixed(2)));
        } else if (availableBal <= 10) {
          tradeAmount = Math.max(0.50, Number((availableBal * 0.5).toFixed(2)));
        } else if (availableBal <= 100) {
          tradeAmount = Math.max(0.50, Number((availableBal * (agent.riskPercentage / 100)).toFixed(2)));
        } else {
          tradeAmount = Math.max(0.50, Math.min(availableBal * 0.1, 500 * (agent.riskPercentage / 2)));
        }
        const resolvedEntry = decision.entryPrice || parseFloat(currentTicker?.lastPrice || String(currentPricesMap[agent.pair] || (agent.pair.includes('XAU') ? 2688.40 : 87400)));

        await handleExecuteTrade({
          ownerId: currentUser?.uid || 'demo',
          agentId: agent.id,
          pair: agent.pair,
          side: (decision.side === 'BUY' || decision.side === 'LONG') ? 'LONG' : 'SHORT',
          entryPrice: resolvedEntry,
          amount: tradeAmount,
          leverage: decision.leverage || 10,
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          pnl: 0,
          pnlPercentage: 0,
          status: 'OPEN',
          source: `${agent.name} (${agent.executionMode === 'LIVE_FUTURES' ? 'BingX Live' : agent.executionMode === 'DEMO_VST' ? 'Demo VST' : 'Automated'})`,
        }, agent.executionMode !== 'LIVE_FUTURES');

        showToast(`🤖 الوكيل الذكي "${agent.name}" نفذ صفقة ${decision.side} على ${agent.pair} بنجاح!`);
      } else {
        showToast(`💡 قرار الوكيل "${agent.name}": ${decision.reason}`);
      }
    } catch (e: any) {
      console.error(e);
      showToast('تعذر استكمال دورة الوكيل، يرجى إعادة المحاولة.');
    }
  };

  // Autonomous Background Trading Engine: Automatically evaluates and executes trades for active agents
  useEffect(() => {
    if (!isAutoTradingActive) return;
    const autoTradeInterval = setInterval(async () => {
      const activeBots = agents.filter(a => a.status === 'active');
      if (activeBots.length === 0) return;

      const randomBot = activeBots[Math.floor(Math.random() * activeBots.length)];
      await handleRunAgentCycle(randomBot);
    }, 38000);

    return () => clearInterval(autoTradeInterval);
  }, [isAutoTradingActive, agents, tickers, klines]);

  // Manual & Autonomous BingX Trade Execution
  const handleExecuteTrade = async (tradeData: Omit<TradeRecord, 'id' | 'createdAt'>, allowFallbackParam: boolean = true) => {
    try {
      const activeApiKey = settings?.bingxApiKey?.trim() || '';
      const activeSecretKey = settings?.bingxSecretKey?.trim() || '';
      const isTestnet = settings?.isTestnet ?? false;

      // 1. Call BingX Order Router API
      const orderRes = await resilientFetch('/api/bingx/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: activeApiKey,
          secretKey: activeSecretKey,
          isTestnet,
          symbol: tradeData.pair,
          side: tradeData.side === 'LONG' ? 'BUY' : 'SELL',
          type: 'MARKET',
          quantity: tradeData.amount,
          price: tradeData.entryPrice,
          leverage: tradeData.leverage,
          stopLoss: tradeData.stopLoss,
          takeProfit: tradeData.takeProfit,
          allowFallback: allowFallbackParam,
        }),
      });

      if (!orderRes.ok) {
        showToast('تعذر الاتصال بخادم الأوامر، يرجى إعادة المحاولة.');
        return;
      }

      const orderJson = await orderRes.json();

      if (!orderJson.success) {
        const errorMsg = orderJson.error || 'تعذر فتح الصفقة على منصة BingX';
        showToast(`❌ تعذر فتح الصفقة: ${errorMsg}`);
        return;
      }

      if (orderJson.warning) {
        showToast(orderJson.warning);
      }

      const trade: TradeRecord = {
        ...tradeData,
        id: orderJson.orderId || `trade_${Date.now()}`,
        ownerId: currentUser?.uid || 'demo',
        status: 'OPEN',
        source:
          orderJson.mode === 'LIVE_EXECUTED'
            ? 'BingX Live (عقود حقيقية)'
            : orderJson.mode === 'FALLBACK_DEMO'
            ? 'محاكي VST (احتياطي تلقائي)'
            : 'BingX Demo VST (تلقائي)',
        createdAt: new Date().toISOString(),
      };

      if (currentUser) {
        await logTrade(trade);
      } else {
        setTrades(prev => [trade, ...prev]);
      }

      fetchAccountBalance();
      fetchRealPositions();
      soundService.playTradeExecuted(trade.side === 'SHORT' || trade.side === 'SELL' ? 'SHORT' : 'LONG');
      showToast(orderJson.message || `تم فتح صفقة ${trade.side} على ${trade.pair} بنجاح!`);
    } catch (err: any) {
      console.error('Trade Execution Error:', err);
      showToast(`فشل فتح الصفقة: ${err.message || 'خطأ في الاتصال'}`);
    }
  };

  // Close Active Position (Dispatches Real Exchange Close if Live Position)
  const handleCloseTrade = async (trade: TradeRecord) => {
    const currentPrice = currentPricesMap[trade.pair] || trade.entryPrice;
    const diff = trade.side === 'LONG' || trade.side === 'BUY' ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
    const pnlPct = (diff / trade.entryPrice) * trade.leverage * 100;
    const finalPnl = (trade.amount * pnlPct) / 100;

    // 1. If it's a real live position on BingX, send close request to BingX exchange
    if (trade.isLivePosition || trade.source?.includes('Live')) {
      const activeApiKey = settings?.bingxApiKey?.trim() || '';
      const activeSecretKey = settings?.bingxSecretKey?.trim() || '';
      if (activeApiKey && activeSecretKey && !settings?.isTestnet) {
        try {
          const closeRes = await resilientFetch('/api/bingx/close-position', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: activeApiKey,
              secretKey: activeSecretKey,
              symbol: trade.pair,
              side: trade.side === 'LONG' || trade.side === 'BUY' ? 'LONG' : 'SHORT',
              positionId: trade.positionId,
              contractQuantity: trade.contractQuantity,
            }),
          });
          const closeJson = await closeRes.json();
          if (closeJson.message) {
            showToast(closeJson.message);
          }
        } catch (err: any) {
          console.warn('Real BingX close error:', err);
        }
      }
    }

    // 2. Update local state and Firestore
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

    // Remove from real positions if present
    setRealPositions(prev => prev.filter(p => p.id !== trade.id && p.positionId !== trade.positionId));

    fetchAccountBalance();
    fetchRealPositions();
    soundService.playSubtleNotification();
    showToast(`تم إغلاق الصفقة على ربح/خسارة: ${finalPnl >= 0 ? `+$${finalPnl.toFixed(2)}` : `-$${Math.abs(finalPnl).toFixed(2)}`}`);
  };

  // Move Stop Loss to Breakeven (نقل وقف الخسارة لنقطة الدخول)
  const handleMoveToBreakeven = async (trade: TradeRecord) => {
    try {
      const updated = { ...trade, stopLoss: trade.entryPrice };
      setTrades(prev => prev.map(t => (t.id === trade.id ? updated : t)));
      if (currentUser && trade.id) {
        await updateTrade(trade.id, { stopLoss: trade.entryPrice });
      }
      soundService.playSubtleNotification();
      showToast(`🛡️ تم تأمين الصفقة! نقل وقف الخسارة إلى نقطة الدخول ($${trade.entryPrice.toLocaleString()}) بنجاح.`);
    } catch (err: any) {
      showToast(`خطأ في تأمين الصفقة: ${err?.message || 'تعذر التحديث'}`);
    }
  };

  // Move All Open Trades to Breakeven (نقل كافة الصفقات المفتوحة إلى نقطة التعادل لحماية المحفظة)
  const handleMoveAllToBreakeven = async () => {
    const openList = combinedTrades.filter(t => t.status === 'OPEN');
    if (openList.length === 0) {
      showToast('لا توجد أي صفقات مفتوحة حالياً لنقل الوقف.');
      return;
    }
    for (const t of openList) {
      await handleMoveToBreakeven(t);
    }
    showToast(`🛡️ تم نقل وقف الخسارة إلى نقطة التعادل لكافة الصفقات (${openList.length}) بنجاح!`);
  };

  // Emergency Panic Close All (زر الطوارئ: إغلاق جميع الصفقات المفتوحة فوراً على BingX والمحاكي)
  const handlePanicCloseAll = async () => {
    const openList = combinedTrades.filter(t => t.status === 'OPEN');
    if (openList.length === 0) {
      showToast('لا توجد أي صفقات مفتوحة حالياً للإغلاق.');
      return;
    }
    showToast(`⚠️ جاري تفعيل إغلاق الطوارئ لجميع الصفقات (${openList.length}) بأمر السوق...`);

    const activeApiKey = settings?.bingxApiKey?.trim() || '';
    const activeSecretKey = settings?.bingxSecretKey?.trim() || '';
    if (activeApiKey && activeSecretKey && !settings?.isTestnet) {
      try {
        const res = await resilientFetch('/api/bingx/close-all-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: activeApiKey, secretKey: activeSecretKey }),
        });
        const json = await res.json();
        if (json.message) showToast(json.message);
      } catch (err: any) {
        console.warn('Real panic close error:', err);
      }
    }

    for (const t of openList) {
      await handleCloseTrade(t);
    }
    setRealPositions([]);
    fetchAccountBalance();
    fetchRealPositions();
    soundService.playAlertTrigger();
    showToast(`✅ تم إغلاق جميع الصفقات المفتوحة (${openList.length}) فوراً بنجاح.`);
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
    try {
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
    } catch (err: any) {
      console.warn('Execute trade from analysis error:', err);
    }
  };

  return (
    <div
      id="app-root-container"
      className={`min-h-screen flex flex-col font-sans select-none transition-colors duration-200 ${
        theme === 'midnight-blue'
          ? 'bg-[#050b18] text-blue-50 selection:bg-blue-600'
          : 'bg-slate-950 text-slate-100 selection:bg-cyan-600'
      }`}
    >
      {/* Toast Notification */}
      {notification && (
        <div id="toast-banner" className="fixed top-4 left-1/2 -translate-x-1/2 z-70 bg-cyan-900 border border-cyan-500 text-white px-5 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <Bell className="w-4 h-4 text-amber-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* Real-Time Price Radar Trigger Banner */}
      {activeTriggerBanner && (
        <div
          id="market-alert-hit-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-70 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-6 py-3 rounded-2xl shadow-2xl border-2 border-white flex items-center gap-4 animate-in slide-in-from-top duration-300 ring-4 ring-amber-500/30"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-bold shrink-0">
            <BellRing className="w-6 h-6 animate-bounce text-amber-400" />
          </div>
          <div className="flex flex-col text-right">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-950">
                🔔 وصل السوق لمستواك المستهدف!
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 font-mono font-bold text-xs">
                {activeTriggerBanner.alert.pair}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-900 font-mono">
              السعر وصل: ${(activeTriggerBanner.currentPrice ?? 0).toLocaleString()} ({activeTriggerBanner.alert.direction === 'ABOVE' ? 'تجاوز صعوداً' : 'هبط أدنى من'} المستهدف ${(activeTriggerBanner.alert?.targetPrice ?? 0).toLocaleString()})
            </span>
            {activeTriggerBanner.alert.note && (
              <span className="text-[11px] text-slate-950/90 font-medium">
                "{activeTriggerBanner.alert.note}"
              </span>
            )}
          </div>
          <button
            onClick={() => setActiveTriggerBanner(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold text-xs cursor-pointer shadow-md mr-2"
          >
            تأكيد الإشعار ✕
          </button>
        </div>
      )}

      {/* Top Header Navbar */}
      <header
        id="main-app-header"
        className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-200 ${
          theme === 'midnight-blue'
            ? 'bg-[#09132d]/95 border-blue-900/60 shadow-lg shadow-blue-950/40'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
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

          {/* Quick HUD Metrics & Tools Drawer Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Live Mode Switcher Pill */}
            <button
              type="button"
              id="header-live-mode-switcher-btn"
              onClick={() => setIsLiveModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-sm select-none ${
                settings?.isTestnet === false && settings?.liveTradingConfirmed
                  ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-amber-950/80 border-amber-500/80 text-amber-300'
              }`}
              title="تغيير نظام التداول (Live حقيقي / Paper تجريبي)"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                settings?.isTestnet === false && settings?.liveTradingConfirmed ? 'bg-rose-500 animate-ping' : 'bg-amber-400'
              }`} />
              <span className="font-extrabold text-[11px]">
                {settings?.isTestnet === false && settings?.liveTradingConfirmed ? 'LIVE' : 'PAPER'}
              </span>
            </button>

            {/* Live Positions Badge (if any) */}
            {realPositions.length > 0 && (
              <button
                type="button"
                id="header-live-positions-indicator"
                onClick={() => {
                  setActiveTab('chart-trading');
                  const el = document.getElementById('profit-analytics-panel');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950/90 border border-amber-500/80 text-amber-300 text-[11px] font-bold cursor-pointer animate-pulse"
                title="عرض الصفقات الحقيقية المفتوحة"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{realPositions.length} صفقات</span>
              </button>
            )}

            {/* BingX Balance (Compact, visible on medium+ screens) */}
            <div
              id="header-bingx-balance-card"
              onClick={() => setIsSettingsOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-800 hover:border-cyan-500/50 cursor-pointer text-xs"
              title="رصيد الحساب المتاح"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono font-bold text-emerald-300 text-xs">
                ${(accountBalance?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* BingX Connection Dot Indicator */}
            <button
              type="button"
              id="header-bingx-status-indicator"
              onClick={() => {
                hasAutoRetriedRef.current = false;
                checkBingXConnection(true);
              }}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                bingxApiStatus === 'connected'
                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                  : bingxApiStatus === 'error'
                  ? 'bg-rose-950/60 border-rose-500/60 text-rose-300'
                  : 'bg-amber-950/60 border-amber-500/60 text-amber-300'
              }`}
              title="انقر لفحص الاتصال بـ BingX"
            >
              <span className={`w-2 h-2 rounded-full ${bingxApiStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span className="text-[11px]">
                {bingxApiStatus === 'connected' ? 'BingX متصل' : 'BingX خطأ'}
              </span>
            </button>

            {/* Auto Trading Switch (Compact) */}
            <button
              type="button"
              id="header-auto-trading-toggle"
              onClick={() => {
                const next = !isAutoTradingActive;
                setIsAutoTradingActive(next);
                showToast(next ? '⚡ تم تفعيل التداول الآلي التلقائي' : 'تم إيقاف التداول الآلي مؤقتاً');
              }}
              className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                isAutoTradingActive
                  ? 'bg-emerald-950 border-emerald-500/70 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
              title="تفعيل/تعطيل التداول الآلي التلقائي بواسطة الوكلاء"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{isAutoTradingActive ? 'تلقائي: ON' : 'تلقائي: OFF'}</span>
            </button>

            {/* The Main Tools Drawer Launcher Button */}
            <button
              type="button"
              id="header-tools-drawer-trigger-btn"
              onClick={() => setIsToolsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-950/40 transition-all cursor-pointer"
              title="فتح مركز الأدوات والتحكم، مجلس التحكيم، الأخبار والتنبيهات"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-200" />
              <span className="whitespace-nowrap">الأدوات والتحكم ⚙️</span>
              {alerts.filter(a => a.active && !a.triggered).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            {/* User Profile or Sign-in (Desktop) */}
            <div className="hidden xl:flex items-center gap-2 pr-1">
              {currentUser ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigningInLoading}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
                >
                  دخول
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Tickers Ribbon */}
        <div
          className={`border-t py-1.5 px-4 overflow-x-auto text-xs font-mono transition-colors duration-200 ${
            theme === 'midnight-blue'
              ? 'bg-[#050917]/95 border-blue-900/50'
              : 'bg-slate-950/90 border-slate-850'
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center gap-6">
            <span className="text-slate-500 text-[11px] font-sans shrink-0 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>أسعار BingX المباشرة:</span>
            </span>

            {tickers.map(t => {
              const isSelected = t.symbol === selectedPair;
              const isBull = parseFloat(t.priceChangePercent) >= 0;
              const isGold = t.symbol === 'XAU-USDT' || t.symbol.includes('XAU') || t.symbol.includes('GOLD');
              const priceNum = parseFloat(t.lastPrice) || 0;
              const formattedPrice = isGold
                ? `$${priceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz`
                : priceNum < 2
                ? `$${priceNum.toFixed(4)}`
                : `$${priceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

              return (
                <button
                  key={t.symbol}
                  onClick={() => setSelectedPair(t.symbol)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg cursor-pointer transition-all shrink-0 ${
                    isSelected
                      ? isGold
                        ? 'bg-amber-950/90 border border-amber-500 text-amber-200 shadow-md shadow-amber-900/30 ring-1 ring-amber-400/50'
                        : theme === 'midnight-blue'
                        ? 'bg-blue-900/80 border border-blue-500 text-blue-100 shadow-sm'
                        : 'bg-slate-800 border border-slate-700'
                      : isGold
                      ? 'bg-amber-950/30 border border-amber-900/50 hover:bg-amber-950/60'
                      : theme === 'midnight-blue'
                      ? 'hover:bg-blue-950/60'
                      : 'hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isGold && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shadow-xs shadow-amber-300 animate-pulse" />
                    )}
                    <span className={`font-bold ${isGold ? 'text-amber-300 flex items-center gap-1' : 'text-white'}`}>
                      {isGold ? 'الذهب (XAU)' : t.symbol.replace('-USDT', '')}
                      {isGold && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          ذهب
                        </span>
                      )}
                    </span>
                  </div>
                  <span className={`font-mono ${isGold ? 'text-amber-100 font-semibold' : 'text-slate-300'}`}>
                    {formattedPrice}
                  </span>
                  <span className={`text-[10px] font-semibold font-mono px-1 py-0.5 rounded ${
                    isBull
                      ? isGold ? 'text-emerald-300 bg-emerald-950/60' : 'text-emerald-400'
                      : isGold ? 'text-rose-300 bg-rose-950/60' : 'text-rose-400'
                  }`}>
                    {isBull ? '+' : ''}{t.priceChangePercent}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main id="main-content-layout" className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 pb-24 md:pb-8 flex flex-col gap-4 sm:gap-5">
        {/* Gentle Reminder for Empty or Incomplete BingX Keys */}
        <BingXKeysReminderBanner
          settings={settings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onContinuePaperTrading={() => showToast('🛡️ تم تفعيل وضع التداول التجريبي (Paper Trading) بنجاح مع كامل قدرات الذكاء الاصطناعي!')}
        />

        {/* Real Account Funding Transfer Alert Banner (One-Click Transfer to Futures) */}
        {accountBalance.hasFundBalanceNotTransferred && (
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/40 border border-amber-500/70 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg shadow-amber-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    رصيدك الحقيقي متاح في محفظة التمويل/السبوت: ${(accountBalance.totalMainBalance || (accountBalance.mainFundBalance || 0) + (accountBalance.spotBalance || 0)).toLocaleString()} USDT
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    حساب حقيقي مباشر
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 mt-0.5">
                  لبدء فتح صفقات العقود الآجلة تلقائياً بدون تعطل، يلزم تحويل الرصيد إلى محفظة العقود (Futures) - يمكنك النقل بنقرة زر واحدة هنا فوراً ومجاناً!
                </p>
              </div>
            </div>

            <button
              onClick={handleQuickTransferToFutures}
              disabled={isTransferringFunds}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all text-xs"
            >
              <Zap className={`w-4 h-4 text-slate-950 ${isTransferringFunds ? 'animate-spin' : ''}`} />
              <span>{isTransferringFunds ? 'جاري النقل...' : '⚡ نقل الرصيد لمحفظة العقود الآن'}</span>
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div className="flex flex-wrap gap-2">
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
              id="tab-backtest"
              onClick={() => setActiveTab('backtest')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'backtest'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-300" />
              <span>فاحص الاستراتيجيات التاريخي (Backtester)</span>
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
            <button
              type="button"
              id="tab-tribunal-nav"
              onClick={() => setIsTribunalOpen(true)}
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-indigo-950/80 via-purple-950/80 to-indigo-900/80 hover:from-indigo-900 hover:to-purple-900 border border-indigo-500/50 text-amber-300 shadow-sm"
              title="فتح مجلس التحكيم المالي الشامل وفاحص نقاط الضعف والمساعد التنفيذي"
            >
              <Scale className="w-3.5 h-3.5 text-amber-300" />
              <span>مجلس التحكيم والتدقيق (Jury & Audit)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 hidden lg:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>نظام التداول التلقائي BingX متصل وجاهز</span>
          </div>
        </div>

        {/* Tab 1: Chart & Live Trading */}
        {activeTab === 'chart-trading' && (
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* AI Instant Scalp Execution Bar with Fast Collapse Toggle */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  id="toggle-scalp-bar-btn"
                  onClick={() => setShowScalpBar(!showScalpBar)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 transition-colors cursor-pointer select-none"
                  title="إظهار أو إخفاء شريط التنفيذ السريع لتوفير مساحة كاملة للشارت"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold">
                    {showScalpBar ? 'إخفاء شريط التنفيذ السريع ▲' : 'إظهار شريط التنفيذ الفوري السريع (AI Scalp) ▼'}
                  </span>
                </button>
                <div className="text-[11px] text-slate-500 font-mono hidden sm:flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>تداول فوري بنصف دولار (0.50$) وما فوق</span>
                </div>
              </div>

              {showScalpBar && (
                <AiInstantScalpBar
                  pair={selectedPair}
                  currentPrice={parseFloat(
                    tickers.find(t => t.symbol === selectedPair)?.lastPrice ||
                      String(currentPricesMap[selectedPair] || (selectedPair.includes('XAU') ? 2688.40 : 87400))
                  )}
                  orderbook={orderbook}
                  accountBalance={accountBalance}
                  onExecuteTrade={handleExecuteTrade}
                  onShowToast={showToast}
                  onQuickTransfer={handleQuickTransferToFutures}
                />
              )}
            </div>

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
                  alerts={alerts}
                  onAddAlert={handleAddAlert}
                  onDeleteAlert={handleDeleteAlert}
                  trades={combinedTrades}
                  onExecuteTrade={async (side, price, sl, tp) => {
                    try {
                      await handleExecuteTrade({
                        ownerId: currentUser?.uid || 'demo',
                        pair: selectedPair,
                        side,
                        entryPrice: price,
                        amount: 500,
                        leverage: 10,
                        stopLoss: sl,
                        takeProfit: tp,
                        pnl: 0,
                        pnlPercentage: 0,
                        status: 'OPEN',
                        source: 'Pro Chart HUD Execution',
                      });
                      showToast(`تم فتح صفقة ${side === 'LONG' ? 'شراء صعودي' : 'بيع هبوطي'} على ${selectedPair} بنجاح!`);
                    } catch (e) {
                      console.warn('Chart HUD execution error:', e);
                    }
                  }}
                  onClearLevels={() => setChartLevels({})}
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

                {/* Live Liquidity Radar & Whale Order Tracker */}
                <LiveMarketRadar
                  pair={selectedPair}
                  currentPrice={parseFloat(
                    tickers.find(t => t.symbol === selectedPair)?.lastPrice ||
                      String(currentPricesMap[selectedPair] || (selectedPair.includes('XAU') ? 2688.40 : 87400))
                  )}
                  orderbook={orderbook}
                  high24h={parseFloat(tickers.find(t => t.symbol === selectedPair)?.highPrice || '0')}
                  low24h={parseFloat(tickers.find(t => t.symbol === selectedPair)?.lowPrice || '0')}
                />

                {/* Gemini Chart Analyzer */}
                <ChartAnalyzer
                  pair={selectedPair}
                  timeframe={selectedInterval}
                  klines={klines}
                  currentPrice={currentPricesMap[selectedPair] || (klines.length ? klines[klines.length - 1].close : undefined)}
                  currentTicker={tickers.find(t => t.symbol === selectedPair)}
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
                  accountBalance={accountBalance}
                  onOpenPriceAlerts={(p, pr) => {
                    setSelectedPair(p);
                    setIsAlertsOpen(true);
                  }}
                />
              </div>
            </div>

            {/* Quick Profit & Open Positions Strip with Breakeven and Emergency Panic Close */}
            <ProfitAnalytics
              trades={combinedTrades}
              onCloseTrade={handleCloseTrade}
              onMoveToBreakeven={handleMoveToBreakeven}
              onPanicCloseAll={handlePanicCloseAll}
              onRefreshLivePositions={fetchRealPositions}
              isRefreshingPositions={isFetchingRealPositions}
              currentPrices={currentPricesMap}
            />
          </div>
        )}

        {/* Tab: Strategy Backtester */}
        {activeTab === 'backtest' && (
          <div className="flex flex-col gap-5">
            <StrategyBacktester
              klines={klines}
              pair={selectedPair}
              agents={agents}
              onApplyParametersToAgent={(agentId, params) => {
                const targetAgent = agents.find(a => a.id === agentId);
                if (targetAgent) {
                  const updatedRiskParams: BotRiskParameters = {
                    riskPercentage: params.riskPercentage,
                    maxDrawdownPercent: targetAgent.riskParameters?.maxDrawdownPercent ?? 10,
                    leverage: targetAgent.riskParameters?.leverage ?? 10,
                    stopLossPercent: params.stopLossPercent,
                    takeProfitPercent: params.takeProfitPercent,
                    trailingStop: targetAgent.riskParameters?.trailingStop ?? true,
                    maxOpenTrades: targetAgent.riskParameters?.maxOpenTrades ?? 3,
                  };
                  handleUpdateAgent(agentId, { riskParameters: updatedRiskParams });
                }
              }}
              onShowToast={showToast}
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
            {/* Visual Recharts Weekly & Monthly Performance Dashboard + Asset Duel Panel + Agent Heatmap */}
            <PerformanceMetrics
              trades={combinedTrades}
              agents={agents}
              onSelectPair={pair => {
                setSelectedPair(pair);
                setActiveTab('chart-trading');
                showToast(`📈 تم الانتقال إلى شارت ${pair} بناءً على توصية خريطة حرارة الوكلاء!`);
              }}
            />

            {/* Detailed Positions & Realized Records */}
            <ProfitAnalytics
              trades={combinedTrades}
              onCloseTrade={handleCloseTrade}
              onMoveToBreakeven={handleMoveToBreakeven}
              onPanicCloseAll={handlePanicCloseAll}
              onRefreshLivePositions={fetchRealPositions}
              isRefreshingPositions={isFetchingRealPositions}
              currentPrices={currentPricesMap}
            />
          </div>
        )}

        {/* Tab 4: Dedicated BingX Real-Time TradingView Chart View */}
        {activeTab === 'bingx-chart' && (
          <div className="flex flex-col gap-5" id="tab-bingx-chart-view">
            {/* AI Instant Scalp Execution Bar */}
            <AiInstantScalpBar
              pair={selectedPair}
              currentPrice={parseFloat(
                tickers.find(t => t.symbol === selectedPair)?.lastPrice ||
                  String(currentPricesMap[selectedPair] || (selectedPair.includes('XAU') ? 2688.40 : 84250))
              )}
              orderbook={orderbook}
              accountBalance={accountBalance}
              onExecuteTrade={handleExecuteTrade}
              onShowToast={showToast}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 flex flex-col gap-4">
                <BingXTradingViewChart
                  pair={selectedPair}
                  interval={selectedInterval}
                  currentPrice={parseFloat(
                    tickers.find(t => t.symbol === selectedPair)?.lastPrice ||
                      String(currentPricesMap[selectedPair] || (selectedPair.includes('XAU') ? 2688.40 : 84250))
                  )}
                  high24h={parseFloat(tickers.find(t => t.symbol === selectedPair)?.highPrice || '0')}
                  low24h={parseFloat(tickers.find(t => t.symbol === selectedPair)?.lowPrice || '0')}
                  orderbook={orderbook}
                  klines={klines}
                  alerts={alerts}
                  onAddAlert={handleAddAlert}
                  onDeleteAlert={handleDeleteAlert}
                  onExecuteTrade={handleExecuteTrade}
                />

                {/* Live Liquidity Radar & Whale Order Tracker */}
                <LiveMarketRadar
                  pair={selectedPair}
                  currentPrice={parseFloat(
                    tickers.find(t => t.symbol === selectedPair)?.lastPrice ||
                      String(currentPricesMap[selectedPair] || (selectedPair.includes('XAU') ? 2688.40 : 84250))
                  )}
                  orderbook={orderbook}
                  high24h={parseFloat(tickers.find(t => t.symbol === selectedPair)?.highPrice || '0')}
                  low24h={parseFloat(tickers.find(t => t.symbol === selectedPair)?.lowPrice || '0')}
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
                  accountBalance={accountBalance}
                />
              </div>
            </div>

            {/* Quick Profit & Open Positions Strip */}
            <ProfitAnalytics
              trades={combinedTrades}
              onCloseTrade={handleCloseTrade}
              onMoveToBreakeven={handleMoveToBreakeven}
              onPanicCloseAll={handlePanicCloseAll}
              onRefreshLivePositions={fetchRealPositions}
              isRefreshingPositions={isFetchingRealPositions}
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
        onThemeChange={newTheme => setTheme(newTheme)}
        onConnectionTested={(status, details) => {
          setBingxApiStatus(status);
          setBingxStatusDetails({
            latencyMs: details?.latencyMs,
            message: details?.message,
            mode: details?.mode,
            lastChecked: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          });
        }}
        onSaveSettings={async newSettings => {
          if (newSettings.theme) {
            setTheme(newSettings.theme);
          }
          try {
            localStorage.setItem('bingx_user_settings', JSON.stringify(newSettings));
          } catch (e) {}
          if (currentUser) {
            await saveUserSettings(newSettings);
            setSettings(newSettings);
            showToast('تم حفظ إعدادات BingX والسمة بنجاح!');
          } else {
            setSettings(newSettings);
            showToast('تم حفظ الإعدادات في الجلسة المحلية.');
          }
          setTimeout(() => checkBingXConnection(), 150);
        }}
        userEmail={currentUser?.email || 'alshmysyw973@gmail.com'}
      />

      {/* Market Price Radar Alerts Modal */}
      <PriceAlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        currentPrices={currentPricesMap}
        defaultPair={selectedPair}
        onAddAlert={handleAddAlert}
        onDeleteAlert={handleDeleteAlert}
        onToggleAlert={handleToggleAlert}
        onReactivateAlert={handleReactivateAlert}
        onClearTriggered={handleClearTriggered}
        userEmail={currentUser?.email || 'alshmysyw973@gmail.com'}
      />

      {/* Push Notifications & Voice Briefing Settings Modal */}
      <PushNotificationModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        onShowToast={showToast}
      />

      {/* Live Trading Activation Modal */}
      <LiveTradingActivationModal
        isOpen={isLiveModalOpen}
        onClose={() => setIsLiveModalOpen(false)}
        settings={settings}
        onSaveSettings={async newSettings => {
          try {
            localStorage.setItem('bingx_user_settings', JSON.stringify(newSettings));
          } catch (e) {}
          if (currentUser) {
            await saveUserSettings(newSettings);
          }
          setSettings(newSettings);
          setTimeout(() => {
            fetchAccountBalance();
            checkBingXConnection();
          }, 150);
        }}
        onLiveActivated={() => {
          fetchAccountBalance();
          checkBingXConnection();
          soundService.playTradeExecuted('LONG');
        }}
        showToast={showToast}
      />

      {/* Expert Trade Tribunal & System Audit Hub Modal */}
      <ExpertTribunalAssistant
        isOpen={isTribunalOpen}
        onClose={() => setIsTribunalOpen(false)}
        selectedPair={selectedPair}
        onSelectPair={setSelectedPair}
        currentPrice={
          parseFloat(
            tickers.find(t => t.symbol === selectedPair)?.lastPrice ||
              String(currentPricesMap[selectedPair] || (selectedPair.includes('XAU') ? 2688.40 : 84250))
          )
        }
        agents={agents}
        settings={settings}
        accountBalance={accountBalance}
        onExecuteTrade={async tradeData => {
          await handleExecuteTrade({
            ownerId: currentUser?.uid || 'demo',
            pair: tradeData.symbol,
            side: tradeData.type,
            entryPrice: tradeData.entryPrice,
            amount: tradeData.amount,
            leverage: tradeData.leverage,
            stopLoss: tradeData.stopLoss,
            takeProfit: tradeData.takeProfit,
            pnl: 0,
            pnlPercentage: 0,
            status: 'OPEN',
            source: tradeData.strategy || 'جلسة محكمة التحكيم الذاتي (Tribunal Verdict)',
          });
        }}
        onMoveAllToBreakeven={handleMoveAllToBreakeven}
        onEmergencyPanicClose={handlePanicCloseAll}
        onShowToast={showToast}
      />

      {/* Modern Slide-over Command Center & Tools Drawer */}
      <ToolsCommandDrawer
        isOpen={isToolsDrawerOpen}
        onClose={() => setIsToolsDrawerOpen(false)}
        onOpenTribunal={() => setIsTribunalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNews={() => setIsNewsOpen(true)}
        onOpenImageGen={() => setIsImageGenOpen(true)}
        onOpenGmail={() => setIsGmailOpen(true)}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenPushModal={() => setIsPushModalOpen(true)}
        onToggleSound={handleToggleSound}
        isSoundMuted={isSoundMuted}
        onToggleTheme={handleToggleTheme}
        theme={theme}
        bingxApiStatus={bingxApiStatus}
        bingxStatusDetails={bingxStatusDetails}
        onCheckBingX={() => {
          hasAutoRetriedRef.current = false;
          checkBingXConnection(true);
        }}
        isAutoRetrying={isAutoRetrying}
        autoRetryCountdown={autoRetryCountdown}
        accountBalance={accountBalance}
        onQuickTransfer={handleQuickTransferToFutures}
        isTransferringFunds={isTransferringFunds}
        activeAlertsCount={alerts.filter(a => a.active && !a.triggered).length}
        pushPermission={pushPermission}
        isAutoTradingActive={isAutoTradingActive}
        onToggleAutoTrading={() => {
          const next = !isAutoTradingActive;
          setIsAutoTradingActive(next);
          showToast(next ? '⚡ تم تفعيل وضع التداول الآلي التلقائي (Auto-Pilot ON)' : 'تم إيقاف وضع التداول الآلي مؤقتاً');
        }}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isSigningInLoading={isSigningInLoading}
        onOpenLiveModal={() => setIsLiveModalOpen(true)}
        isLiveMode={settings?.isTestnet === false && !!settings?.liveTradingConfirmed}
      />

      {/* Ergonomic Mobile Bottom Navigation Bar (Phone First) */}
      <MobileBottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenToolsDrawer={() => setIsToolsDrawerOpen(true)}
        onOpenTribunal={() => setIsTribunalOpen(true)}
        openPositionsCount={realPositions.length}
        agentsCount={agents.length}
      />
    </div>
  );
}
