import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
  TrendingUp,
  Bell,
  BellRing,
  Check,
  X,
  Plus,
  Trash2,
  Crosshair,
  Volume2,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  CheckCircle2,
  BrainCircuit,
  ShieldCheck,
  Target,
  ArrowRightLeft,
  Compass,
  Flame,
} from 'lucide-react';
import type { PriceAlert } from '../lib/alertsService.ts';
import { playAlertSound } from '../lib/alertsService.ts';
import { LiquidityHeatmapD3 } from './LiquidityHeatmapD3.tsx';
import { resilientFetch } from '../lib/resilientFetch.ts';

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: any) => any;
    };
  }
}

export interface QuickZoneAnalysis {
  zoneType: string;
  zoneTypeNameArabic: string;
  bias: 'BUY' | 'SELL' | 'WAIT';
  biasArabic: string;
  winRatePercent: number;
  riskRewardRatio: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  arabicSummary: string;
  traderTip: string;
  confidenceScore: number;
  source: string;
}

interface BingXTradingViewChartProps {
  pair: string;
  interval?: string;
  onSymbolChange?: (symbol: string) => void;
  className?: string;
  currentPrice?: number;
  high24h?: number;
  low24h?: number;
  orderbook?: { bids: [string, string][]; asks: [string, string][] };
  klines?: Array<{
    time: number | string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  alerts?: PriceAlert[];
  onAddAlert?: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  onDeleteAlert?: (id: string) => void;
  onExecuteTrade?: (trade: any) => Promise<void>;
}

// Map pair formats to TradingView compatible symbols
export function formatTradingViewSymbol(pair: string, provider: 'BINGX' | 'BINANCE' = 'BINGX'): string {
  const clean = pair.replace('-', '').toUpperCase();
  if (pair.startsWith('FX:') || pair.includes(':')) {
    return pair;
  }
  if (clean === 'XAUUSDT' || clean === 'XAUUSD' || clean.includes('GOLD') || clean === 'XAUTUSDT') {
    return provider === 'BINGX' ? 'BINGX:XAUTUSDT' : 'BINANCE:PAXGUSDT';
  }
  return `${provider}:${clean}`;
}

const POPULAR_SYMBOLS = [
  { label: 'BTC/USDT (BingX)', value: 'BINGX:BTCUSDT', name: 'BTC' },
  { label: 'الذهب XAU/USDT (BingX XAUT)', value: 'BINGX:XAUTUSDT', name: 'الذهب (XAU)' },
  { label: 'ETH/USDT (BingX)', value: 'BINGX:ETHUSDT', name: 'ETH' },
  { label: 'SOL/USDT (BingX)', value: 'BINGX:SOLUSDT', name: 'SOL' },
  { label: 'XRP/USDT (BingX)', value: 'BINGX:XRPUSDT', name: 'XRP' },
  { label: 'BTC/USDT (Binance)', value: 'BINANCE:BTCUSDT', name: 'BTC-Binance' },
  { label: 'الذهب XAU/USD (Forex OANDA)', value: 'OANDA:XAUUSD', name: 'الذهب (Forex)' },
  { label: 'EUR/USD (Forex)', value: 'FX:EURUSD', name: 'EUR/USD' },
];

const INTERVAL_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
};

interface ConfirmationModalData {
  isOpen: boolean;
  price: number;
  pair: string;
  direction: 'ABOVE' | 'BELOW';
  note: string;
  soundEnabled: boolean;
}

export const BingXTradingViewChart: React.FC<BingXTradingViewChartProps> = ({
  pair,
  interval = '15m',
  onSymbolChange,
  className = '',
  currentPrice,
  high24h,
  low24h,
  orderbook,
  klines,
  alerts = [],
  onAddAlert,
  onDeleteAlert,
  onExecuteTrade,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const widgetContainerId = useRef(`tradingview_${Math.random().toString(36).substring(2, 9)}`);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => formatTradingViewSymbol(pair, 'BINGX'));
  const [currentInterval, setCurrentInterval] = useState<string>(INTERVAL_MAP[interval] || '15');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [provider, setProvider] = useState<'BINGX' | 'BINANCE'>('BINGX');

  // Double-Click Feature States
  const [isDblClickMode, setIsDblClickMode] = useState(true);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  // Modal State & Tabs: 'ai-analysis' | 'set-alert'
  const [confirmModal, setConfirmModal] = useState<ConfirmationModalData | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'ai-analysis' | 'set-alert'>('ai-analysis');

  // Gemini Zone Analysis State
  const [zoneAnalysis, setZoneAnalysis] = useState<QuickZoneAnalysis | null>(null);
  const [isAnalyzingZone, setIsAnalyzingZone] = useState(false);
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);

  // Sync external pair updates
  useEffect(() => {
    const formatted = formatTradingViewSymbol(pair, provider);
    setSelectedSymbol(formatted);
  }, [pair, provider]);

  // Sync external interval updates
  useEffect(() => {
    if (INTERVAL_MAP[interval]) {
      setCurrentInterval(INTERVAL_MAP[interval]);
    }
  }, [interval]);

  // Real-time price calculations for crosshair & alerts
  const livePrice = useMemo(() => {
    if (currentPrice && currentPrice > 0) return currentPrice;
    if (pair.includes('XAU')) return 2688.40;
    if (pair.includes('BTC')) return 84412.0;
    if (pair.includes('ETH')) return 2240;
    if (pair.includes('SOL')) return 142.5;
    return 100;
  }, [currentPrice, pair]);

  // Dynamic price bounds for coordinate mapping
  const { chartHigh, chartLow } = useMemo(() => {
    const baseHigh = high24h && high24h > livePrice ? high24h : livePrice * 1.035;
    const baseLow = low24h && low24h < livePrice && low24h > 0 ? low24h : livePrice * 0.965;
    const padding = (baseHigh - baseLow) * 0.12;
    return {
      chartHigh: baseHigh + padding,
      chartLow: baseLow - padding,
    };
  }, [high24h, low24h, livePrice]);

  // Convert pixel Y coordinate to price
  const yToPrice = (y: number, height: number): number => {
    if (height <= 0) return livePrice;
    const ratio = Math.max(0, Math.min(1, 1 - y / height));
    const calculated = chartLow + ratio * (chartHigh - chartLow);
    if (calculated > 1000) return Math.round(calculated * 100) / 100;
    if (calculated > 10) return Math.round(calculated * 1000) / 1000;
    return Math.round(calculated * 100000) / 100000;
  };

  // Convert price to pixel Y coordinate
  const priceToY = (price: number, height: number): number => {
    if (chartHigh === chartLow || height <= 0) return height / 2;
    const ratio = (price - chartLow) / (chartHigh - chartLow);
    const clamped = Math.max(0, Math.min(1, ratio));
    return (1 - clamped) * height;
  };

  // Active alerts for this specific pair
  const activePairAlerts = useMemo(() => {
    return alerts.filter(a => a.pair === pair && a.active && !a.triggered);
  }, [alerts, pair]);

  // Initialize or re-initialize TradingView Widget
  useEffect(() => {
    let isMounted = true;

    const initWidget = () => {
      if (!window.TradingView || !containerRef.current) return;

      containerRef.current.innerHTML = `<div id="${widgetContainerId.current}" style="width: 100%; height: 100%;"></div>`;

      try {
        new window.TradingView.widget({
          container_id: widgetContainerId.current,
          autosize: true,
          symbol: selectedSymbol,
          interval: currentInterval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1', // Candlesticks
          locale: 'ar',
          toolbar_bg: '#0f172a',
          enable_publishing: false,
          hide_legend: false,
          allow_symbol_change: true,
          save_image: true,
          calendar: true,
          hotlist: true,
          details: true,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
            'BB@tv-basicstudies',
          ],
          support_host: 'https://www.tradingview.com',
          loading_screen: { backgroundColor: '#090d16', foregroundColor: '#06b6d4' },
          overrides: {
            'paneProperties.background': '#090d16',
            'paneProperties.vertGridProperties.color': '#1e293b',
            'paneProperties.horzGridProperties.color': '#1e293b',
            'symbolWatermarkProperties.transparency': 90,
            'scalesProperties.textColor': '#94a3b8',
            'mainSeriesProperties.candleStyle.upColor': '#10b981',
            'mainSeriesProperties.candleStyle.downColor': '#f43f5e',
            'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.borderDownColor': '#f43f5e',
            'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.wickDownColor': '#f43f5e',
          },
        });

        if (isMounted) {
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('TradingView Widget initialization error:', err);
      }
    };

    if (window.TradingView) {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        if (isMounted) initWidget();
      };
      document.head.appendChild(script);
    }

    return () => {
      isMounted = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [selectedSymbol, currentInterval]);

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    if (onSymbolChange) {
      onSymbolChange(sym);
    }
  };

  // Handle Mouse Movement over chart overlay
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartWrapperRef.current) return;
    const rect = chartWrapperRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setMouseY(y);
    const calculated = yToPrice(y, rect.height);
    setHoverPrice(calculated);
  };

  const handleMouseLeave = () => {
    setMouseY(null);
    setHoverPrice(null);
  };

  // Fetch Gemini AI Technical Zone Analysis
  const fetchQuickZoneAnalysis = async (targetPrice: number) => {
    setIsAnalyzingZone(true);
    try {
      const res = await resilientFetch('/api/ai/quick-zone-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair,
          clickedPrice: targetPrice,
          currentPrice: livePrice,
          timeframe: Object.keys(INTERVAL_MAP).find(k => INTERVAL_MAP[k] === currentInterval) || '15m',
          high24h,
          low24h,
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.success && json.data) {
          setZoneAnalysis(json.data);
        }
      }
    } catch {
      // Safe fallback
    } finally {
      setIsAnalyzingZone(false);
    }
  };

  // Trigger Confirmation & AI Analysis Modal from Double Click
  const handleChartDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chartWrapperRef.current) return;
    const rect = chartWrapperRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const clickedPrice = yToPrice(y, rect.height);

    triggerConfirmationModal(clickedPrice);
  };

  // Open confirmation modal with specific price and trigger Gemini analysis
  const triggerConfirmationModal = (targetPrice: number) => {
    const isAbove = targetPrice >= livePrice;
    const suggestedDirection = isAbove ? 'ABOVE' : 'BELOW';
    const suggestedNote = isAbove ? 'اختراق مقاومة مستهدفة' : 'ارتداد من منطقة طلب ودعم';

    setConfirmModal({
      isOpen: true,
      price: targetPrice,
      pair: pair,
      direction: suggestedDirection,
      note: suggestedNote,
      soundEnabled: true,
    });

    setActiveModalTab('ai-analysis');
    fetchQuickZoneAnalysis(targetPrice);
  };

  // Handle Save from confirmation modal
  const handleConfirmAlert = () => {
    if (!confirmModal) return;

    if (onAddAlert) {
      onAddAlert({
        ownerId: 'current',
        pair: confirmModal.pair,
        targetPrice: confirmModal.price,
        direction: confirmModal.direction,
        note: confirmModal.note,
        soundEnabled: confirmModal.soundEnabled,
        active: true,
      });
    }

    if (confirmModal.soundEnabled) {
      playAlertSound();
    }

    setLocalFeedback(`تم ضبط التنبيه السعري لـ ${confirmModal.pair} عند $${confirmModal.price.toLocaleString()} بنجاح!`);
    setTimeout(() => setLocalFeedback(null), 4000);
    setConfirmModal(null);
  };

  // Handle Immediate Trade Execution from Gemini Analysis
  const handleExecuteTradeFromZone = async () => {
    if (!zoneAnalysis || !confirmModal || !onExecuteTrade) return;
    setIsExecutingTrade(true);
    try {
      const side = zoneAnalysis.bias === 'BUY' ? 'LONG' : zoneAnalysis.bias === 'SELL' ? 'SHORT' : 'LONG';
      await onExecuteTrade({
        ownerId: 'current',
        pair: confirmModal.pair,
        side,
        entryPrice: zoneAnalysis.entryPrice || confirmModal.price,
        amount: 500,
        leverage: 10,
        stopLoss: zoneAnalysis.stopLoss,
        takeProfit: zoneAnalysis.takeProfit1,
        pnl: 0,
        pnlPercentage: 0,
        status: 'OPEN',
        source: `Gemini Quick Zone Execution (${side})`,
      });

      playAlertSound();
      setLocalFeedback(`⚡ تم فتح صفقة ${side} فوراً عند $${confirmModal.price.toLocaleString()} مع ربط أهداف Gemini!`);
      setTimeout(() => setLocalFeedback(null), 5000);
      setConfirmModal(null);
    } catch (e: any) {
      console.error(e);
      setLocalFeedback('تعذر فتح الصفقة، تأكد من اتصال المنصة.');
    } finally {
      setIsExecutingTrade(false);
    }
  };

  const currentChartHeight = isFullscreen ? window.innerHeight - 110 : 500;

  return (
    <div
      id="bingx-tradingview-chart-wrapper"
      className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col relative ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-slate-950 p-4' : className
      }`}
    >
      {/* Top Chart Toolbar */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Symbol Quick Select & Exchange Provider */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-750">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white text-xs">BingX Live Chart</span>
            <span className="text-[10px] text-cyan-400 font-mono">TradingView</span>
          </div>

          {/* Quick Symbol Buttons */}
          <div className="flex items-center gap-1">
            {POPULAR_SYMBOLS.map(item => {
              const isActive = selectedSymbol === item.value;
              return (
                <button
                  key={item.value}
                  id={`btn-tv-sym-${item.name}`}
                  onClick={() => handleSymbolChange(item.value)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                  title={item.label}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intervals & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Double Click Alert & Analysis Mode Toggle */}
          <button
            id="btn-toggle-dblclick-alert"
            onClick={() => setIsDblClickMode(!isDblClickMode)}
            className={`px-2.5 py-1 rounded border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
              isDblClickMode
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="انقر نقراً مزدوجاً على الشارت لتشغيل تحليل فني فوري بـ Gemini وضبط تنبيه سعري"
          >
            <BrainCircuit className={`w-3.5 h-3.5 ${isDblClickMode ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
            <span>نقر مزدوج للتحليل &amp; التنبيه: {isDblClickMode ? 'مفعّل 🎯' : 'معطّل'}</span>
          </button>

          {/* Quick Analyze / Add Alert at Current Price */}
          <button
            id="btn-quick-add-alert-current"
            onClick={() => triggerConfirmationModal(livePrice)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
            title="تحليل السعر اللحظي الحالي وضبط تنبيه"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>تحليل السعر (${livePrice.toLocaleString()})</span>
          </button>

          {/* Active Alerts Dropdown */}
          <div className="relative">
            <button
              id="btn-active-alerts-dropdown"
              onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3 h-3 text-amber-400" />
              <span>تنبيهاتي</span>
              <span className="px-1.5 py-0.2 bg-cyan-600 text-white rounded-full text-[10px] font-mono">
                {activePairAlerts.length}
              </span>
            </button>

            {showAlertsDropdown && (
              <div
                className="absolute left-0 top-full mt-1.5 w-64 bg-slate-950 border border-slate-800 rounded-lg p-2 shadow-2xl z-40 text-right"
                dir="rtl"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-1 text-[11px] font-bold text-slate-300">
                  <span>تنبيهات {pair} النشطة ({activePairAlerts.length})</span>
                  <button
                    onClick={() => setShowAlertsDropdown(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs"
                  >
                    ×
                  </button>
                </div>
                {activePairAlerts.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-3 text-center">
                    لا توجد تنبيهات حالية. انقر نقراً مزدوجاً على الشارت للتحليل وضبط تنبيه!
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {activePairAlerts.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/80 text-[11px]"
                      >
                        <div>
                          <div className="flex items-center gap-1 font-mono font-bold text-white">
                            <span>${a.targetPrice.toLocaleString()}</span>
                            <span
                              className={`text-[10px] px-1 rounded ${
                                a.direction === 'ABOVE'
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : 'bg-rose-950 text-rose-400'
                              }`}
                            >
                              {a.direction === 'ABOVE' ? 'صعوداً ▲' : 'هبوطاً ▼'}
                            </span>
                          </div>
                          {a.note && <span className="text-[10px] text-slate-400 truncate block max-w-[150px]">{a.note}</span>}
                        </div>
                        {onDeleteAlert && (
                          <button
                            onClick={() => onDeleteAlert(a.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="حذف التنبيه"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interval Buttons */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800">
            {[
              { label: '1m', val: '1' },
              { label: '5m', val: '5' },
              { label: '15m', val: '15' },
              { label: '1h', val: '60' },
              { label: '4h', val: '240' },
              { label: '1D', val: 'D' },
            ].map(int => (
              <button
                key={int.val}
                id={`btn-tv-interval-${int.label}`}
                onClick={() => setCurrentInterval(int.val)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  currentInterval === int.val
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {int.label}
              </button>
            ))}
          </div>

          {/* Provider Toggle */}
          <button
            id="btn-toggle-provider"
            onClick={() => {
              const nextProvider = provider === 'BINGX' ? 'BINANCE' : 'BINGX';
              setProvider(nextProvider);
              setSelectedSymbol(formatTradingViewSymbol(pair, nextProvider));
            }}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[11px] text-slate-300 hover:text-white cursor-pointer font-mono"
            title="تبديل مصدر التغذية بين سيرفرات BingX و Binance"
          >
            سيرفر: <strong className="text-cyan-400">{provider}</strong>
          </button>

          {/* Fullscreen Toggle */}
          <button
            id="btn-tv-fullscreen"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
            title={isFullscreen ? 'تصغير الشارت' : 'تكبير الشاشة بالكامل'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Real-time Status Banner with Double Click Prompt */}
      <div className="bg-slate-950 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-850 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 flex items-center gap-1 font-sans">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>شارت مباشر:</span>
          </span>
          <span className="text-white font-bold">{selectedSymbol}</span>
          <span className="text-slate-500">|</span>
          <span>السعر اللحظي: <strong className="text-cyan-300 font-mono">${livePrice.toLocaleString()}</strong></span>
        </div>

        {/* Feature Banner: Double Click Hint */}
        <div className="flex items-center gap-2 text-amber-300/90 font-sans text-[11px] hidden sm:flex">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span>ميزة ذكية: انقر نقراً مزدوجاً (Double Click) على أي منطقة بالشارت لتشغيل تحليل Gemini الفني وضبط تنبيه!</span>
        </div>
      </div>

      {/* Local Feedback Toast */}
      {localFeedback && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{localFeedback}</span>
        </div>
      )}

      {/* Interactive Chart Container with Overlay */}
      <div
        id="tradingview-interactive-container"
        ref={chartWrapperRef}
        className={`relative w-full overflow-hidden select-none ${
          isFullscreen ? 'h-[calc(100vh-100px)]' : 'h-[500px]'
        }`}
        onMouseMove={isDblClickMode ? handleMouseMove : undefined}
        onMouseLeave={isDblClickMode ? handleMouseLeave : undefined}
        onDoubleClick={isDblClickMode ? handleChartDoubleClick : undefined}
      >
        {/* TradingView Widget Mount Container */}
        <div
          id="tradingview-mount-point"
          ref={containerRef}
          className="w-full h-full bg-[#090d16]"
        />

        {/* D3.js High Liquidity & Sweeps Heatmap Layer */}
        <LiquidityHeatmapD3
          pair={pair}
          currentPrice={livePrice}
          chartHigh={chartHigh}
          chartLow={chartLow}
          chartHeight={currentChartHeight}
          orderbook={orderbook}
          klines={klines}
          onSelectPrice={(targetPrice) => {
            triggerConfirmationModal(targetPrice);
          }}
          onTriggerQuickTrade={async (side, price) => {
            if (onExecuteTrade) {
              await onExecuteTrade({
                ownerId: '',
                pair,
                side,
                entryPrice: price,
                amount: 500,
                leverage: 10,
                status: 'OPEN',
                source: 'D3 Liquidity Sweep Instant Trade',
              });
            }
          }}
        />

        {/* Interactive Double-Click Catch Overlay */}
        {isDblClickMode && (
          <div
            id="chart-alert-overlay-layer"
            className="absolute inset-0 z-20 cursor-crosshair"
            onDoubleClick={handleChartDoubleClick}
            title="انقر نقراً مزدوجاً لتشغيل تحليل فني للمنطقة بـ Gemini وضبط تنبيه"
          >
            {/* Top Overlay Badge */}
            <div className="absolute top-3 right-3 pointer-events-none flex items-center gap-2 bg-slate-900/85 backdrop-blur-xs border border-cyan-500/30 px-3 py-1.5 rounded-lg shadow-lg text-[11px] text-cyan-300 font-sans">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>وضع النقر المزدوج: اضغط مرتين لتحليل المنطقة بـ Gemini</span>
            </div>

            {/* Visual Crosshair Following Mouse */}
            {mouseY !== null && hoverPrice !== null && (
              <div
                className="absolute left-0 right-0 pointer-events-none transition-all duration-75 ease-out"
                style={{ top: `${mouseY}px` }}
              >
                {/* Horizontal Laser Line */}
                <div className="w-full border-b border-dashed border-cyan-400/70 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />

                {/* Left Floating Tag */}
                <div className="absolute left-2 -top-3.5 flex items-center gap-1.5 bg-cyan-600 text-white font-mono text-[11px] px-2 py-0.5 rounded shadow-lg pointer-events-auto">
                  <BrainCircuit className="w-3 h-3 text-amber-300" />
                  <span>نقر مزدوج: تحليل فني Gemini</span>
                </div>

                {/* Right Floating Price Axis Tag */}
                <div className="absolute right-2 -top-3.5 flex items-center gap-1.5 bg-slate-950 border border-cyan-400 text-cyan-300 font-mono font-bold text-xs px-2.5 py-0.5 rounded shadow-lg">
                  <span>${hoverPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {/* Active Alert Lines Plotted on Chart */}
            {activePairAlerts.map(alert => {
              const y = priceToY(alert.targetPrice, currentChartHeight);
              const isAbove = alert.direction === 'ABOVE';
              return (
                <div
                  key={alert.id}
                  className="absolute left-0 right-0 pointer-events-auto group transition-all"
                  style={{ top: `${y}px` }}
                >
                  <div
                    className={`w-full border-b border-dashed ${
                      isAbove ? 'border-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'border-rose-400/80 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                    }`}
                  />
                  {/* Alert Tag on Right Axis */}
                  <div
                    className={`absolute right-2 -top-3.5 flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-lg text-white ${
                      isAbove ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <Bell className="w-2.5 h-2.5" />
                    <span>${alert.targetPrice.toLocaleString()}</span>
                    <span>{isAbove ? '▲' : '▼'}</span>
                    {onDeleteAlert && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAlert(alert.id);
                        }}
                        className="hover:text-amber-200 transition-colors mr-0.5"
                        title="حذف هذا التنبيه"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ENHANCED CONFIRMATION & GEMINI AI ANALYSIS POPUP (نافذة منبثقة فوق الشارت) */}
      {confirmModal && confirmModal.isOpen && (
        <div
          id="chart-alert-confirmation-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setConfirmModal(null)}
        >
          <div
            id="chart-alert-confirmation-modal"
            className="w-full max-w-lg bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] relative text-right flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header & Navigation Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="tab-btn-gemini-analysis"
                  onClick={() => setActiveModalTab('ai-analysis')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeModalTab === 'ai-analysis'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4 text-cyan-300" />
                  <span>تحليل فني بـ Gemini ⚡</span>
                </button>

                <button
                  type="button"
                  id="tab-btn-set-alert"
                  onClick={() => setActiveModalTab('set-alert')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeModalTab === 'set-alert'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <BellRing className="w-4 h-4 text-amber-300" />
                  <span>ضبط تنبيه سعري 🔔</span>
                </button>
              </div>

              <button
                onClick={() => setConfirmModal(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clicked Price Header Card */}
            <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span>المنطقة السعرية المحددة:</span>
                  <span className="font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded font-mono">
                    {confirmModal.pair}
                  </span>
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">الفريم: {currentInterval}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-3xl font-black font-mono text-cyan-300 tracking-tight">
                  ${confirmModal.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </div>

                {/* Fine-tune +/- steppers */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const step = confirmModal.price > 1000 ? 50 : 1;
                      const next = Math.max(0, confirmModal.price - step);
                      setConfirmModal(prev => prev ? { ...prev, price: next } : null);
                      fetchQuickZoneAnalysis(next);
                    }}
                    className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold flex items-center justify-center cursor-pointer"
                    title="تقليل السعر"
                  >
                    -
                  </button>
                  <button
                    onClick={() => {
                      const step = confirmModal.price > 1000 ? 50 : 1;
                      const next = confirmModal.price + step;
                      setConfirmModal(prev => prev ? { ...prev, price: next } : null);
                      fetchQuickZoneAnalysis(next);
                    }}
                    className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold flex items-center justify-center cursor-pointer"
                    title="زيادة السعر"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Comparison vs live price */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-850 text-[11px] font-mono">
                <span className="text-slate-400">سعر السوق اللحظي: ${livePrice.toLocaleString()}</span>
                {(() => {
                  const diff = confirmModal.price - livePrice;
                  const diffPercent = (diff / livePrice) * 100;
                  const isUp = diff >= 0;
                  return (
                    <span className={`font-bold flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>
                        {isUp ? '+' : ''}{diffPercent.toFixed(2)}% ({diff >= 0 ? '+' : ''}${diff.toFixed(2)})
                      </span>
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* TAB 1: GEMINI AI ZONE ANALYSIS */}
            {activeModalTab === 'ai-analysis' && (
              <div className="flex flex-col gap-3">
                {isAnalyzingZone ? (
                  <div className="p-6 bg-slate-950/60 rounded-xl border border-cyan-500/20 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin flex items-center justify-center" />
                      <Sparkles className="w-5 h-5 text-cyan-300 absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-white text-xs font-bold">جاري تحليل المنطقة السعرية بواسطة Gemini 3.8 Flash...</h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        تدقيق مستويات السيولة • فحص كتل الأوامر المؤسساتية • تقدير احتمالية الفوز ونسبة R:R
                      </p>
                    </div>
                  </div>
                ) : zoneAnalysis ? (
                  <div className="flex flex-col gap-3 animate-in fade-in">
                    {/* Zone Classification & Bias Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">تصنيف المنطقة:</span>
                        <span className="text-xs font-bold text-cyan-300">
                          {zoneAnalysis.zoneTypeNameArabic}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm ${
                            zoneAnalysis.bias === 'BUY'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                              : zoneAnalysis.bias === 'SELL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                          }`}
                        >
                          {zoneAnalysis.bias === 'BUY' ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span>{zoneAnalysis.biasArabic}</span>
                        </span>
                      </div>
                    </div>

                    {/* Win Rate & R:R Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">احتمالية النجاح</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {zoneAnalysis.winRatePercent}%
                        </span>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">العائد / المخاطرة</span>
                        <span className="font-mono font-bold text-cyan-400 text-sm">
                          {zoneAnalysis.riskRewardRatio}
                        </span>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">مستوى الثقة</span>
                        <span className="font-mono font-bold text-amber-300 text-sm">
                          {zoneAnalysis.confidenceScore}%
                        </span>
                      </div>
                    </div>

                    {/* Calculated Execution Levels */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 block font-sans">الدخول المقترح</span>
                        <span className="font-bold text-white">${(zoneAnalysis?.entryPrice ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-rose-900/40">
                        <span className="text-[9px] text-rose-400 block font-sans">وقف الخسارة (SL)</span>
                        <span className="font-bold text-rose-300">${(zoneAnalysis?.stopLoss ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-emerald-900/40">
                        <span className="text-[9px] text-emerald-400 block font-sans">الهدف 1 (TP1)</span>
                        <span className="font-bold text-emerald-300">${(zoneAnalysis?.takeProfit1 ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-emerald-900/40">
                        <span className="text-[9px] text-emerald-400 block font-sans">الهدف 2 (TP2)</span>
                        <span className="font-bold text-emerald-300">${(zoneAnalysis?.takeProfit2 ?? 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Arabic Summary & Reasoning */}
                    <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                      <span className="text-[10px] text-cyan-400 font-bold block mb-1">ملخص التحليل الفني لـ Gemini:</span>
                      <p>{zoneAnalysis.arabicSummary}</p>
                    </div>

                    {/* Trader Tip */}
                    {zoneAnalysis.traderTip && (
                      <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 flex items-start gap-2">
                        <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span><strong>نصيحة المتداول:</strong> {zoneAnalysis.traderTip}</span>
                      </div>
                    )}

                    {/* Action Buttons inside Analysis Tab */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {onExecuteTrade && (
                        <button
                          type="button"
                          id="btn-zone-execute-trade"
                          disabled={isExecutingTrade}
                          onClick={handleExecuteTradeFromZone}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Zap className="w-4 h-4 text-amber-300" />
                          <span>فتح صفقة فورية من هذه المنطقة</span>
                        </button>
                      )}

                      <button
                        type="button"
                        id="btn-zone-quick-alert"
                        onClick={() => {
                          setActiveModalTab('set-alert');
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-400" />
                        <span>ضبط تنبيه عند السعر</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 rounded-xl text-center text-xs text-slate-400">
                    <p>تعذر تحميل التحليل الفني لهذه المنطقة.</p>
                    <button
                      onClick={() => fetchQuickZoneAnalysis(confirmModal.price)}
                      className="mt-2 px-3 py-1 bg-cyan-600 text-white rounded text-xs"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SET PRICE ALERT */}
            {activeModalTab === 'set-alert' && (
              <div className="flex flex-col gap-3">
                {/* Trigger Condition Direction */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 font-bold">شرط تفعيل التنبيه:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmModal(prev => prev ? { ...prev, direction: 'ABOVE' } : null)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        confirmModal.direction === 'ABOVE'
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                        <span>صعوداً (تجاوز السعر)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">عندما السعر &gt;= ${(confirmModal?.price ?? 0).toLocaleString()}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmModal(prev => prev ? { ...prev, direction: 'BELOW' } : null)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        confirmModal.direction === 'BELOW'
                          ? 'bg-rose-950/60 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                        <span>هبوطاً (انخفاض السعر)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">عندما السعر &lt;= ${(confirmModal?.price ?? 0).toLocaleString()}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Note Tags & Note Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 font-bold">ملاحظة التنبيه:</label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {['🎯 جني أرباح', '🛑 وقف خسارة', '📈 اختراق مقاومة', '📉 ارتداد دعم', '⚡ فرصة دخول'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setConfirmModal(prev => prev ? { ...prev, note: tag } : null)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={confirmModal.note}
                    onChange={(e) => setConfirmModal(prev => prev ? { ...prev, note: e.target.value } : null)}
                    placeholder="أدخل ملاحظة لهذا التنبيه (اختياري)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Sound Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-855 text-xs">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-300">تشغيل رنة تنبيه صوتية فورية</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={confirmModal.soundEnabled}
                    onChange={(e) => setConfirmModal(prev => prev ? { ...prev, soundEnabled: e.target.checked } : null)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    id="btn-confirm-chart-alert"
                    onClick={handleConfirmAlert}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Check className="w-4 h-4" />
                    <span>تأكيد وضبط التنبيه</span>
                  </button>

                  <button
                    id="btn-cancel-chart-alert"
                    onClick={() => setConfirmModal(null)}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
