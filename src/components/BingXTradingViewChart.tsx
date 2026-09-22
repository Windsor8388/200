import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
  TrendingUp,
} from 'lucide-react';

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: any) => any;
    };
  }
}

interface BingXTradingViewChartProps {
  pair: string;
  interval?: string;
  onSymbolChange?: (symbol: string) => void;
  className?: string;
}

// Map pair formats to TradingView compatible symbols
export function formatTradingViewSymbol(pair: string, provider: 'BINGX' | 'BINANCE' = 'BINGX'): string {
  const clean = pair.replace('-', '').toUpperCase();
  if (pair.startsWith('FX:') || pair.includes(':')) {
    return pair;
  }
  return `${provider}:${clean}`;
}

const POPULAR_SYMBOLS = [
  { label: 'BTC/USDT (BingX)', value: 'BINGX:BTCUSDT', name: 'BTC' },
  { label: 'ETH/USDT (BingX)', value: 'BINGX:ETHUSDT', name: 'ETH' },
  { label: 'SOL/USDT (BingX)', value: 'BINGX:SOLUSDT', name: 'SOL' },
  { label: 'XRP/USDT (BingX)', value: 'BINGX:XRPUSDT', name: 'XRP' },
  { label: 'BTC/USDT (Binance)', value: 'BINANCE:BTCUSDT', name: 'BTC-Binance' },
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

export const BingXTradingViewChart: React.FC<BingXTradingViewChartProps> = ({
  pair,
  interval = '15m',
  onSymbolChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetContainerId = useRef(`tradingview_${Math.random().toString(36).substring(2, 9)}`);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => formatTradingViewSymbol(pair, 'BINGX'));
  const [currentInterval, setCurrentInterval] = useState<string>(INTERVAL_MAP[interval] || '15');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [provider, setProvider] = useState<'BINGX' | 'BINANCE'>('BINGX');

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

  // Initialize or re-initialize TradingView Widget
  useEffect(() => {
    let isMounted = true;

    const initWidget = () => {
      if (!window.TradingView || !containerRef.current) return;

      // Clear previous container content
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

    // If script already loaded
    if (window.TradingView) {
      initWidget();
    } else {
      // Load script dynamically if needed
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

  return (
    <div
      id="bingx-tradingview-chart-wrapper"
      className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col ${
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
        <div className="flex items-center gap-2">
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

          {/* Provider Toggle (BingX vs Binance) */}
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

      {/* Real-time Status Banner */}
      <div className="bg-slate-950 px-3 py-1 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-850 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 flex items-center gap-1 font-sans">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>رسم بياني حقيقي مباشر:</span>
          </span>
          <span className="text-white font-bold">{selectedSymbol}</span>
          <span className="text-slate-500">|</span>
          <span>الإطار الزمني: {Object.keys(INTERVAL_MAP).find(k => INTERVAL_MAP[k] === currentInterval) || currentInterval}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 hidden sm:inline font-sans">
            مؤشرات مدمجة: <span className="text-cyan-300 font-mono">RSI, MACD, BB, MA</span>
          </span>
          <span className="text-emerald-400 font-sans flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>متصل لحظياً</span>
          </span>
        </div>
      </div>

      {/* TradingView Widget Mount Container */}
      <div
        id="tradingview-mount-point"
        ref={containerRef}
        className={`w-full bg-[#090d16] ${isFullscreen ? 'h-[calc(100vh-100px)]' : 'h-[500px]'}`}
      />
    </div>
  );
};
