import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Flame,
  Zap,
  Layers,
  Eye,
  EyeOff,
  Sliders,
  Target,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info,
  ShieldAlert,
} from 'lucide-react';

export interface LiquidityZone {
  id: string;
  price: number;
  type: 'BSL' | 'SSL' | 'LIQUIDATION_HIGH' | 'LIQUIDATION_LOW';
  volumeUsdt: number;
  intensity: number; // 0 to 1
  label: string;
  labelArabic: string;
  status: 'ACTIVE' | 'SWEPT';
  sweepTime?: string;
  depthDistancePct: number;
}

export interface LiquidityHeatmapD3Props {
  pair: string;
  currentPrice: number;
  chartHigh: number;
  chartLow: number;
  chartHeight: number;
  orderbook?: { bids: [string, string][]; asks: [string, string][] };
  klines?: Array<{
    time: number | string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  onSelectPrice?: (price: number) => void;
  onTriggerQuickTrade?: (side: 'LONG' | 'SHORT', price: number) => void;
  className?: string;
}

export const LiquidityHeatmapD3: React.FC<LiquidityHeatmapD3Props> = ({
  pair,
  currentPrice,
  chartHigh,
  chartLow,
  chartHeight,
  orderbook,
  klines = [],
  onSelectPrice,
  onTriggerQuickTrade,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // User Interactive View Modes
  const [isVisible, setIsVisible] = useState(true);
  const [filterMode, setFilterMode] = useState<'ALL' | 'SWEEPS_ONLY' | 'POOLS_ONLY'>('ALL');
  const [opacity, setOpacity] = useState(0.85);
  const [hoveredZone, setHoveredZone] = useState<LiquidityZone | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // 1. Calculate Liquidity Profile & Detect Liquidity Sweeps
  const liquidityZones = useMemo<LiquidityZone[]>(() => {
    if (!currentPrice || currentPrice <= 0) return [];

    const zones: LiquidityZone[] = [];
    const spread = Math.max(chartHigh - chartLow, currentPrice * 0.05);

    // A. Parse Real Orderbook if available
    if (orderbook && Array.isArray(orderbook.bids) && Array.isArray(orderbook.asks) && (orderbook.bids.length > 0 || orderbook.asks.length > 0)) {
      // Aggregate bids (Support / SSL / Buy Liquidity)
      const topBids = (orderbook.bids || []).slice(0, 15);
      topBids.forEach((bid, idx) => {
        if (!bid || !bid[0] || !bid[1]) return;
        const p = parseFloat(bid[0]);
        const q = parseFloat(bid[1]);
        const volUsdt = p * q;
        if (p >= chartLow && p <= chartHigh) {
          const distPct = ((currentPrice - p) / currentPrice) * 100;
          zones.push({
            id: `bid_${idx}_${p}`,
            price: p,
            type: 'SSL',
            volumeUsdt: volUsdt,
            intensity: Math.min(1, Math.max(0.2, (volUsdt / (currentPrice * 50)) * (1.2 - idx * 0.05))),
            label: `SSL Pool - $${(volUsdt / 1000).toFixed(1)}k`,
            labelArabic: 'حوض سيولة شراء (طلب مؤسسي)',
            status: 'ACTIVE',
            depthDistancePct: distPct,
          });
        }
      });

      // Aggregate asks (Resistance / BSL / Sell Liquidity)
      const topAsks = (orderbook.asks || []).slice(0, 15);
      topAsks.forEach((ask, idx) => {
        if (!ask || !ask[0] || !ask[1]) return;
        const p = parseFloat(ask[0]);
        const q = parseFloat(ask[1]);
        const volUsdt = p * q;
        if (p >= chartLow && p <= chartHigh) {
          const distPct = ((p - currentPrice) / currentPrice) * 100;
          zones.push({
            id: `ask_${idx}_${p}`,
            price: p,
            type: 'BSL',
            volumeUsdt: volUsdt,
            intensity: Math.min(1, Math.max(0.2, (volUsdt / (currentPrice * 50)) * (1.2 - idx * 0.05))),
            label: `BSL Pool - $${(volUsdt / 1000).toFixed(1)}k`,
            labelArabic: 'حوض سيولة بيع (عرض مؤسسي)',
            status: 'ACTIVE',
            depthDistancePct: distPct,
          });
        }
      });
    }

    // B. Detect Liquidity Sweeps from Klines (Smart Money Concepts)
    if (klines && klines.length >= 10) {
      const recentKlines = klines.slice(-35);

      // Find Swing Highs & Swing Lows
      for (let i = 2; i < recentKlines.length - 2; i++) {
        const prev2 = recentKlines[i - 2];
        const prev1 = recentKlines[i - 1];
        const curr = recentKlines[i];
        const next1 = recentKlines[i + 1];
        const next2 = recentKlines[i + 2];

        // Swing High (Liquidity Pool Above)
        const isSwingHigh =
          curr.high > prev1.high &&
          curr.high > prev2.high &&
          curr.high > next1.high &&
          curr.high > next2.high;

        if (isSwingHigh && curr.high >= chartLow && curr.high <= chartHigh) {
          // Check if any subsequent candle swept this high
          const subsequent = recentKlines.slice(i + 1);
          const swept = subsequent.some(
            k => k.high > curr.high && k.close < curr.high // Wick pierced high, closed below -> Sweep!
          );

          zones.push({
            id: `sweep_high_${curr.time}_${curr.high}`,
            price: curr.high,
            type: 'BSL',
            volumeUsdt: (curr.volume || 100) * curr.high * 0.4,
            intensity: swept ? 0.95 : 0.75,
            label: swept ? 'BSL Swept (Liquidity Grab)' : 'BSL Buy Stops Pool',
            labelArabic: swept
              ? '⚡ كنس سيولة شراء (Liquidity Grab) - رفض هبوطي'
              : '🔥 تجمع سيولة شراء فوق قمة سابقة (BSL)',
            status: swept ? 'SWEPT' : 'ACTIVE',
            sweepTime: swept ? 'مؤخراً' : undefined,
            depthDistancePct: ((curr.high - currentPrice) / currentPrice) * 100,
          });
        }

        // Swing Low (Liquidity Pool Below)
        const isSwingLow =
          curr.low < prev1.low &&
          curr.low < prev2.low &&
          curr.low < next1.low &&
          curr.low < next2.low;

        if (isSwingLow && curr.low >= chartLow && curr.low <= chartHigh) {
          // Check if any subsequent candle swept this low
          const subsequent = recentKlines.slice(i + 1);
          const swept = subsequent.some(
            k => k.low < curr.low && k.close > curr.low // Wick pierced low, closed above -> Sweep!
          );

          zones.push({
            id: `sweep_low_${curr.time}_${curr.low}`,
            price: curr.low,
            type: 'SSL',
            volumeUsdt: (curr.volume || 100) * curr.low * 0.4,
            intensity: swept ? 0.95 : 0.75,
            label: swept ? 'SSL Swept (Liquidity Grab)' : 'SSL Sell Stops Pool',
            labelArabic: swept
              ? '⚡ كنس سيولة بيع (Liquidity Grab) - ارتداد صعودي'
              : '🔥 تجمع سيولة بيع تحت قاع سابق (SSL)',
            status: swept ? 'SWEPT' : 'ACTIVE',
            sweepTime: swept ? 'مؤخراً' : undefined,
            depthDistancePct: ((currentPrice - curr.low) / currentPrice) * 100,
          });
        }
      }
    }

    // C. Add High-Leverage Liquidation Cluster Estimates (25x, 50x, 100x bands)
    const liqMultipliers = [
      { leverage: '100x', multLong: 0.991, multShort: 1.009, intensity: 0.92, vol: 2500000 },
      { leverage: '50x', multLong: 0.981, multShort: 1.019, intensity: 0.85, vol: 1800000 },
      { leverage: '25x', multLong: 0.962, multShort: 1.038, intensity: 0.78, vol: 3200000 },
    ];

    liqMultipliers.forEach(l => {
      const longLiq = currentPrice * l.multLong;
      const shortLiq = currentPrice * l.multShort;

      if (longLiq >= chartLow && longLiq <= chartHigh) {
        zones.push({
          id: `liq_long_${l.leverage}`,
          price: longLiq,
          type: 'LIQUIDATION_LOW',
          volumeUsdt: l.vol,
          intensity: l.intensity,
          label: `Longs Liq Pool (${l.leverage})`,
          labelArabic: `🛑 تكتل تصفية الشراء رافعة ${l.leverage} (Stop Hunt Area)`,
          status: 'ACTIVE',
          depthDistancePct: ((currentPrice - longLiq) / currentPrice) * 100,
        });
      }

      if (shortLiq >= chartLow && shortLiq <= chartHigh) {
        zones.push({
          id: `liq_short_${l.leverage}`,
          price: shortLiq,
          type: 'LIQUIDATION_HIGH',
          volumeUsdt: l.vol,
          intensity: l.intensity,
          label: `Shorts Liq Pool (${l.leverage})`,
          labelArabic: `🛑 تكتل تصفية البيع رافعة ${l.leverage} (Short Squeeze Area)`,
          status: 'ACTIVE',
          depthDistancePct: ((shortLiq - currentPrice) / currentPrice) * 100,
        });
      }
    });

    // Remove duplicates close to each other, keep the highest intensity
    const sorted = [...zones].sort((a, b) => b.intensity - a.intensity);
    const filtered: LiquidityZone[] = [];
    const minDiff = spread * 0.015;

    for (const z of sorted) {
      const exists = filtered.some(f => Math.abs(f.price - z.price) < minDiff);
      if (!exists) {
        filtered.push(z);
      }
    }

    return filtered;
  }, [currentPrice, chartHigh, chartLow, orderbook, klines]);

  // Filtered zones based on mode
  const activeZones = useMemo(() => {
    if (filterMode === 'SWEEPS_ONLY') {
      return liquidityZones.filter(z => z.status === 'SWEPT');
    }
    if (filterMode === 'POOLS_ONLY') {
      return liquidityZones.filter(z => z.status === 'ACTIVE');
    }
    return liquidityZones;
  }, [liquidityZones, filterMode]);

  // Swept zones count for header badge
  const sweptCount = useMemo(() => {
    return liquidityZones.filter(z => z.status === 'SWEPT').length;
  }, [liquidityZones]);

  // 2. D3 Rendering Logic
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !isVisible) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth || 800;
    const height = chartHeight || 500;

    svg.attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (chartHigh <= chartLow || activeZones.length === 0) return;

    // D3 Y-Scale: maps price to vertical pixel height (inverted, higher price is near top)
    const yScale = d3
      .scaleLinear()
      .domain([chartLow, chartHigh])
      .range([height, 0]);

    // D3 Custom Heatmap Color Scale (Turbo & Inferno blend: deep blue -> cyan -> yellow -> intense orange/red)
    const colorScale = d3
      .scaleSequential(d3.interpolateTurbo)
      .domain([0.2, 1.0]);

    // Defs for gradients & glowing filters
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'heatGlow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Main Heatmap Group
    const g = svg.append('g').attr('class', 'liquidity-heatmap-layer');

    // Render each liquidity zone
    activeZones.forEach((zone, index) => {
      const y = yScale(zone.price);
      if (isNaN(y) || y < 0 || y > height) return;

      const bandHeight = Math.max(6, Math.min(24, height * 0.035));
      const bandWidth = width * (0.28 + zone.intensity * 0.45); // Extends from right to left
      const xStart = width - bandWidth;

      const isSwept = zone.status === 'SWEPT';
      const isLiq = zone.type.startsWith('LIQUIDATION');
      const baseColor = isSwept
        ? '#f43f5e' // Neon Pink/Rose for Swept zones
        : isLiq
        ? '#ec4899'
        : colorScale(zone.intensity);

      // Create unique linear gradient for smooth falloff to the left
      const gradId = `zone_grad_${index}`;
      const grad = defs
        .append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');

      grad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', baseColor)
        .attr('stop-opacity', 0.0);

      grad
        .append('stop')
        .attr('offset', '40%')
        .attr('stop-color', baseColor)
        .attr('stop-opacity', zone.intensity * 0.45 * opacity);

      grad
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', baseColor)
        .attr('stop-opacity', zone.intensity * 0.9 * opacity);

      // Group for this zone
      const zoneGroup = g
        .append('g')
        .attr('class', 'zone-item')
        .attr('cursor', 'pointer')
        .on('mouseenter', (event) => {
          setHoveredZone(zone);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: Math.min(event.clientX - rect.left, width - 240),
              y: Math.max(10, Math.min(y - 30, height - 120)),
            });
          }
        })
        .on('mousemove', (event) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: Math.min(event.clientX - rect.left, width - 240),
              y: Math.max(10, Math.min(y - 30, height - 120)),
            });
          }
        })
        .on('mouseleave', () => {
          setHoveredZone(null);
          setTooltipPos(null);
        })
        .on('click', () => {
          if (onSelectPrice) {
            onSelectPrice(zone.price);
          }
        });

      // 1. Heatmap Glow Bar
      zoneGroup
        .append('rect')
        .attr('x', xStart)
        .attr('y', y - bandHeight / 2)
        .attr('width', bandWidth)
        .attr('height', bandHeight)
        .attr('rx', 3)
        .attr('fill', `url(#${gradId})`)
        .attr('filter', zone.intensity > 0.8 ? 'url(#heatGlow)' : null);

      // 2. Center laser price line across chart
      zoneGroup
        .append('line')
        .attr('x1', isSwept ? 0 : width * 0.3)
        .attr('y1', y)
        .attr('x2', width)
        .attr('y2', y)
        .attr('stroke', baseColor)
        .attr('stroke-width', isSwept ? 1.5 : 1)
        .attr('stroke-dasharray', isSwept ? '4 3' : '2 2')
        .attr('stroke-opacity', isSwept ? 0.85 : 0.6);

      // 3. Swept Flash Indicator / Icon
      if (isSwept) {
        zoneGroup
          .append('circle')
          .attr('cx', width - 20)
          .attr('cy', y)
          .attr('r', 5)
          .attr('fill', '#f43f5e')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .append('animate')
          .attr('attributeName', 'r')
          .attr('values', '4;6.5;4')
          .attr('dur', '1.8s')
          .attr('repeatCount', 'indefinite');

        // Swept Text Badge on right
        zoneGroup
          .append('text')
          .attr('x', width - 32)
          .attr('y', y + 3.5)
          .attr('text-anchor', 'end')
          .attr('fill', '#ffe4e6')
          .attr('font-size', '9px')
          .attr('font-family', 'sans-serif')
          .attr('font-weight', 'bold')
          .text('⚡ كنس سيولة');
      } else {
        // High Intensity Pool Badge
        if (zone.intensity > 0.8) {
          zoneGroup
            .append('text')
            .attr('x', width - 15)
            .attr('y', y + 3)
            .attr('text-anchor', 'end')
            .attr('fill', '#fef08a')
            .attr('font-size', '9px')
            .attr('font-family', 'monospace')
            .attr('font-weight', 'bold')
            .text(`🔥 $${(zone.volumeUsdt / 1000).toFixed(0)}k`);
        }
      }
    });

    // 3. Current Price Reference Line
    const currentY = yScale(currentPrice);
    if (!isNaN(currentY) && currentY >= 0 && currentY <= height) {
      const priceGroup = svg.append('g').attr('class', 'current-price-d3-line');
      priceGroup
        .append('line')
        .attr('x1', 0)
        .attr('y1', currentY)
        .attr('x2', width)
        .attr('y2', currentY)
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5 2');
    }
  }, [activeZones, chartHeight, chartHigh, chartLow, currentPrice, isVisible, opacity, onSelectPrice]);

  return (
    <div
      ref={containerRef}
      id="d3-liquidity-heatmap-wrapper"
      className={`absolute inset-0 pointer-events-none z-15 ${className}`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-2 left-3 z-30 pointer-events-auto flex items-center gap-1.5 bg-slate-950/90 border border-slate-700/80 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-xl text-xs">
        <div className="flex items-center gap-1 text-amber-400 font-bold font-sans">
          <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>خريطة سيولة D3</span>
        </div>

        {/* Visibility Toggle */}
        <button
          onClick={() => setIsVisible(!isVisible)}
          className={`p-1 rounded cursor-pointer transition-colors ${
            isVisible ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-500 hover:text-slate-300'
          }`}
          title={isVisible ? 'إخفاء خريطة السيولة' : 'إظهار خريطة السيولة'}
        >
          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>

        {/* Mode Selector */}
        {isVisible && (
          <>
            <div className="h-3 w-px bg-slate-750 mx-0.5" />
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer font-medium transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({liquidityZones.length})
            </button>
            <button
              onClick={() => setFilterMode('SWEEPS_ONLY')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer font-medium flex items-center gap-1 transition-colors ${
                filterMode === 'SWEEPS_ONLY'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-rose-400 hover:text-rose-200'
              }`}
              title="عرض المناطق التي تم كنس واصطياد السيولة فيها فقط"
            >
              <Zap className="w-2.5 h-2.5" />
              <span>كنس السيولة ({sweptCount})</span>
            </button>
            <button
              onClick={() => setFilterMode('POOLS_ONLY')}
              className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer font-medium transition-colors ${
                filterMode === 'POOLS_ONLY'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-amber-400 hover:text-amber-200'
              }`}
              title="عرض أحواض وتكتلات السيولة النشطة فقط"
            >
              الأحواض النشطة
            </button>
          </>
        )}
      </div>

      {/* SVG Container Rendered via D3 */}
      {isVisible && (
        <svg
          ref={svgRef}
          id="d3-liquidity-svg"
          className="w-full h-full pointer-events-auto"
          style={{ overflow: 'visible' }}
        />
      )}

      {/* Interactive Rich Tooltip on Zone Hover */}
      {hoveredZone && tooltipPos && (
        <div
          id="d3-liquidity-tooltip"
          className="absolute z-40 bg-slate-900/95 border border-cyan-500/60 rounded-xl p-3 shadow-2xl backdrop-blur-md pointer-events-auto text-right text-xs flex flex-col gap-1.5 min-w-[210px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-white font-mono text-sm">
              ${(hoveredZone.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                hoveredZone.status === 'SWEPT'
                  ? 'bg-rose-900/70 border border-rose-500/50 text-rose-300'
                  : 'bg-amber-900/70 border border-amber-500/50 text-amber-300'
              }`}
            >
              {hoveredZone.status === 'SWEPT' ? '⚡ تم كنس السيولة' : '🔥 حوض سيولة نشط'}
            </span>
          </div>

          {/* Details */}
          <div className="text-[11px] text-slate-300 flex flex-col gap-1">
            <div>{hoveredZone.labelArabic}</div>
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
              <span>السيولة التقديرية:</span>
              <span className="text-cyan-300 font-bold">${(hoveredZone.volumeUsdt ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
              <span>البعد عن السعر الحالي:</span>
              <span className={hoveredZone.depthDistancePct >= 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {hoveredZone.depthDistancePct >= 0 ? '+' : ''}
                {hoveredZone.depthDistancePct.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800">
            <button
              onClick={() => {
                if (onSelectPrice) onSelectPrice(hoveredZone.price);
              }}
              className="flex-1 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] text-center cursor-pointer transition-colors"
            >
              تحليل المنطقة بـ Gemini 🎯
            </button>
            {onTriggerQuickTrade && (
              <button
                onClick={() => {
                  const side = hoveredZone.price > currentPrice ? 'SHORT' : 'LONG';
                  onTriggerQuickTrade(side, hoveredZone.price);
                }}
                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                title="فتح صفقة سريعة عند هذا المستوى"
              >
                صفقة ⚡
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
