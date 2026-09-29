import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Award,
  DollarSign,
  Activity,
  Layers,
  Calendar,
  CheckCircle2,
  SlidersHorizontal,
  Zap,
  Info,
} from 'lucide-react';

export interface MonthPerformanceData {
  period: string;
  label: string;
  netPnl: number;
  winRate: number;
  tradesCount: number;
  wins: number;
  losses: number;
  avgDurationMinutes: number;
  grossProfit: number;
  grossLoss: number;
  cumulativePnl?: number;
}

interface MonthlyComparisonChartProps {
  monthlyData: MonthPerformanceData[];
}

export const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({ monthlyData }) => {
  // Current month is the last element
  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonths = monthlyData.slice(0, monthlyData.length - 1);

  // Selected previous month for direct head-to-head comparison
  const [selectedPrevMonthLabel, setSelectedPrevMonthLabel] = useState<string>(
    previousMonths[previousMonths.length - 1]?.label || 'أغسطس 2026'
  );

  // Chart comparison metric mode
  const [chartMetric, setChartMetric] = useState<
    'all-months-pnl' | 'head-to-head' | 'winrate' | 'trades-breakdown'
  >('all-months-pnl');

  const selectedPrevMonth = useMemo(() => {
    return (
      previousMonths.find(m => m.label === selectedPrevMonthLabel) ||
      previousMonths[previousMonths.length - 1]
    );
  }, [previousMonths, selectedPrevMonthLabel]);

  // Calculate historical average of previous months
  const prevMonthsAvg = useMemo(() => {
    if (previousMonths.length === 0) return null;
    const count = previousMonths.length;
    const totalPnl = previousMonths.reduce((sum, m) => sum + m.netPnl, 0);
    const totalWinRate = previousMonths.reduce((sum, m) => sum + m.winRate, 0);
    const totalTrades = previousMonths.reduce((sum, m) => sum + m.tradesCount, 0);
    const totalWins = previousMonths.reduce((sum, m) => sum + m.wins, 0);
    const totalGrossProfit = previousMonths.reduce((sum, m) => sum + m.grossProfit, 0);
    const totalGrossLoss = previousMonths.reduce((sum, m) => sum + m.grossLoss, 0);

    return {
      avgNetPnl: parseFloat((totalPnl / count).toFixed(1)),
      avgWinRate: parseFloat((totalWinRate / count).toFixed(1)),
      avgTrades: Math.round(totalTrades / count),
      avgWins: Math.round(totalWins / count),
      avgGrossProfit: parseFloat((totalGrossProfit / count).toFixed(1)),
      avgGrossLoss: parseFloat((totalGrossLoss / count).toFixed(1)),
      avgProfitPerTrade: parseFloat((totalPnl / Math.max(1, totalTrades)).toFixed(1)),
    };
  }, [previousMonths]);

  // Deltas between Current Month and Selected Previous Month
  const deltas = useMemo(() => {
    if (!currentMonth || !selectedPrevMonth) return null;

    const pnlDiff = currentMonth.netPnl - selectedPrevMonth.netPnl;
    const pnlPercent = selectedPrevMonth.netPnl !== 0
      ? (pnlDiff / Math.abs(selectedPrevMonth.netPnl)) * 100
      : 0;

    const winRateDiff = currentMonth.winRate - selectedPrevMonth.winRate;
    const tradesDiff = currentMonth.tradesCount - selectedPrevMonth.tradesCount;

    const currentAvgProfitPerTrade =
      currentMonth.tradesCount > 0 ? currentMonth.netPnl / currentMonth.tradesCount : 0;
    const prevAvgProfitPerTrade =
      selectedPrevMonth.tradesCount > 0 ? selectedPrevMonth.netPnl / selectedPrevMonth.tradesCount : 0;
    const avgProfitDiff = currentAvgProfitPerTrade - prevAvgProfitPerTrade;
    const avgProfitPercent = prevAvgProfitPerTrade !== 0
      ? (avgProfitDiff / Math.abs(prevAvgProfitPerTrade)) * 100
      : 0;

    const currentPF =
      currentMonth.grossLoss > 0
        ? currentMonth.grossProfit / currentMonth.grossLoss
        : 4.8;
    const prevPF =
      selectedPrevMonth.grossLoss > 0
        ? selectedPrevMonth.grossProfit / selectedPrevMonth.grossLoss
        : 3.5;
    const pfDiff = currentPF - prevPF;

    return {
      pnlDiff: parseFloat(pnlDiff.toFixed(1)),
      pnlPercent: parseFloat(pnlPercent.toFixed(1)),
      winRateDiff: parseFloat(winRateDiff.toFixed(1)),
      tradesDiff,
      currentAvgProfitPerTrade: parseFloat(currentAvgProfitPerTrade.toFixed(1)),
      prevAvgProfitPerTrade: parseFloat(prevAvgProfitPerTrade.toFixed(1)),
      avgProfitDiff: parseFloat(avgProfitDiff.toFixed(1)),
      avgProfitPercent: parseFloat(avgProfitPercent.toFixed(1)),
      currentPF: parseFloat(currentPF.toFixed(2)),
      prevPF: parseFloat(prevPF.toFixed(2)),
      pfDiff: parseFloat(pfDiff.toFixed(2)),
    };
  }, [currentMonth, selectedPrevMonth]);

  // Head-to-head comparative dataset for side-by-side bars
  const headToHeadData = useMemo(() => {
    if (!currentMonth || !selectedPrevMonth) return [];

    const currentAvgProfit =
      currentMonth.tradesCount > 0 ? currentMonth.netPnl / currentMonth.tradesCount : 0;
    const prevAvgProfit =
      selectedPrevMonth.tradesCount > 0 ? selectedPrevMonth.netPnl / selectedPrevMonth.tradesCount : 0;

    return [
      {
        metric: 'صافي الأرباح ($)',
        current: currentMonth.netPnl,
        previous: selectedPrevMonth.netPnl,
        unit: '$',
      },
      {
        metric: 'إجمالي المكاسب ($)',
        current: currentMonth.grossProfit,
        previous: selectedPrevMonth.grossProfit,
        unit: '$',
      },
      {
        metric: 'إجمالي الخسائر ($)',
        current: currentMonth.grossLoss,
        previous: selectedPrevMonth.grossLoss,
        unit: '$',
      },
      {
        metric: 'متوسط ربح الصفقة ($)',
        current: parseFloat(currentAvgProfit.toFixed(1)),
        previous: parseFloat(prevAvgProfit.toFixed(1)),
        unit: '$',
      },
    ];
  }, [currentMonth, selectedPrevMonth]);

  // Custom Recharts Comparative Tooltip
  const ComparativeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isCurrent = data.period === currentMonth?.period;

      return (
        <div className="bg-slate-950 border border-slate-750 p-3 rounded-xl shadow-2xl text-xs flex flex-col gap-2 min-w-[210px] text-right">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-white text-sm flex items-center gap-1.5">
              <span>{data.label || label}</span>
              {isCurrent && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                  الشهر الحالي
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-400">{data.tradesCount} صفقات</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">صافي الأرباح:</span>
            <span className={`font-mono font-bold ${(data.netPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(data.netPnl ?? 0) >= 0 ? `+$${(data.netPnl ?? 0).toLocaleString()}` : `-$${Math.abs(data.netPnl ?? 0).toLocaleString()}`}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">نسبة الفوز:</span>
            <span className="font-mono font-bold text-cyan-300">{data.winRate}%</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">الصفقات (فوز / خسارة):</span>
            <span className="font-mono text-slate-300">
              {data.wins} <span className="text-emerald-400">✓</span> / {data.losses} <span className="text-rose-400">✕</span>
            </span>
          </div>

          {/* Comparison Delta with Current Month */}
          {!isCurrent && currentMonth && (
            <div className="border-t border-slate-850 pt-1 text-[11px] flex items-center justify-between">
              <span className="text-slate-400">فارق أرباح الشهر الحالي:</span>
              <span
                className={`font-mono font-bold ${
                  currentMonth.netPnl >= data.netPnl ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {currentMonth.netPnl >= data.netPnl ? '+' : ''}
                ${(currentMonth.netPnl - data.netPnl).toFixed(1)}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="monthly-performance-comparison" className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-5">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center text-white shadow-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">
                مقارنة أداء الشهر الحالي بالشهور السابقة (Monthly Comparison)
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                Comparative Bar Chart
              </span>
            </div>
            <p className="text-xs text-slate-400">
              تحليل بياني مقارن للأرباح، نسب الفوز، وكفاءة الصفقات بين {currentMonth?.label} والشهور السابقة
            </p>
          </div>
        </div>

        {/* Previous Month Selector Dropdown */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">قارن الشهر الحالي مع:</span>
          <select
            id="select-comparison-month"
            value={selectedPrevMonthLabel}
            onChange={e => setSelectedPrevMonthLabel(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            {previousMonths.map(m => (
              <option key={m.label} value={m.label}>
                {m.label} (صافي {m.netPnl >= 0 ? `+$${m.netPnl}` : `-$${Math.abs(m.netPnl)}`})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Head-to-Head Comparative Delta Cards (4 KPIs) */}
      {deltas && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Net PnL Delta */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>مقارنة صافي الأرباح (Net PnL)</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  +${(currentMonth?.netPnl ?? 0).toLocaleString()}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-0.5 ${
                    (deltas.pnlDiff ?? 0) >= 0
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {(deltas.pnlDiff ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{(deltas.pnlPercent ?? 0) >= 0 ? '+' : ''}{deltas.pnlPercent ?? 0}%</span>
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-850">
                <span>{selectedPrevMonth.label}:</span>
                <span className="font-mono text-slate-300">+${(selectedPrevMonth?.netPnl ?? 0).toLocaleString()}</span>
                <span className="font-mono text-emerald-400">
                  (فارق {(deltas.pnlDiff ?? 0) >= 0 ? '+' : ''}${Math.abs(deltas.pnlDiff ?? 0).toLocaleString()})
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Win Rate Delta */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>مقارنة نسبة الفوز (Win Rate)</span>
              <Award className="w-4 h-4 text-cyan-400" />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {currentMonth.winRate}%
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-0.5 ${
                    deltas.winRateDiff >= 0
                      ? 'bg-cyan-950/80 border border-cyan-800 text-cyan-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {deltas.winRateDiff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{deltas.winRateDiff >= 0 ? '+' : ''}{deltas.winRateDiff}%</span>
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-850">
                <span>{selectedPrevMonth.label}:</span>
                <span className="font-mono text-slate-300">{selectedPrevMonth.winRate}%</span>
                <span className="font-mono text-cyan-300">
                  ({deltas.winRateDiff >= 0 ? '+' : ''}{deltas.winRateDiff}%)
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Avg Profit Per Trade */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>متوسط ربح الصفقة (Avg/Trade)</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-bold font-mono text-purple-300">
                  ${deltas.currentAvgProfitPerTrade}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-0.5 ${
                    deltas.avgProfitDiff >= 0
                      ? 'bg-purple-950/80 border border-purple-800 text-purple-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {deltas.avgProfitDiff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{deltas.avgProfitPercent >= 0 ? '+' : ''}{deltas.avgProfitPercent}%</span>
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-850">
                <span>{selectedPrevMonth.label}:</span>
                <span className="font-mono text-slate-300">${deltas.prevAvgProfitPerTrade}</span>
                <span className="font-mono text-purple-300">
                  ({deltas.avgProfitDiff >= 0 ? '+' : ''}${deltas.avgProfitDiff})
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Profit Factor & Efficiency */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>عامل الربحية (Profit Factor)</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-bold font-mono text-amber-300">
                  {deltas.currentPF}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-0.5 ${
                    deltas.pfDiff >= 0
                      ? 'bg-amber-950/80 border border-amber-800 text-amber-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {deltas.pfDiff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{deltas.pfDiff >= 0 ? '+' : ''}{deltas.pfDiff}</span>
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1 pt-1 border-t border-slate-850">
                <span>{selectedPrevMonth.label}:</span>
                <span className="font-mono text-slate-300">{deltas.prevPF}</span>
                <span className="font-mono text-amber-300">
                  ({deltas.pfDiff >= 0 ? '+' : ''}{deltas.pfDiff})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart View Modes Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            id="btn-comp-all-months"
            onClick={() => setChartMetric('all-months-pnl')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              chartMetric === 'all-months-pnl'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            مقارنة أرباح كافة الشهور ($ Net PnL)
          </button>
          <button
            id="btn-comp-head-to-head"
            onClick={() => setChartMetric('head-to-head')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              chartMetric === 'head-to-head'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            مقارنة مباشرة (Head-to-Head Bars)
          </button>
          <button
            id="btn-comp-winrate"
            onClick={() => setChartMetric('winrate')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              chartMetric === 'winrate'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            مقارنة نسبة الفوز (% Win Rate)
          </button>
          <button
            id="btn-comp-trades"
            onClick={() => setChartMetric('trades-breakdown')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              chartMetric === 'trades-breakdown'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            توزيع الصفقات الرابحة والخاسرة
          </button>
        </div>

        {/* Legend / Info tag */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
            <span>الشهر الحالي ({currentMonth?.period})</span>
          </span>
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-3 h-3 rounded-xs bg-indigo-500 inline-block" />
            <span>الشهور السابقة</span>
          </span>
        </div>
      </div>

      {/* The Comparative Bar Chart Canvas */}
      <div className="w-full h-80 pt-2" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {chartMetric === 'all-months-pnl' ? (
            <BarChart
              data={monthlyData}
              margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="period"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={val => `$${val}`}
                tickLine={false}
              />
              <Tooltip content={<ComparativeTooltip />} />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />

              {prevMonthsAvg && (
                <ReferenceLine
                  y={prevMonthsAvg.avgNetPnl}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  label={{
                    value: `متوسط الشهور السابقة ($${prevMonthsAvg.avgNetPnl})`,
                    fill: '#fbbf24',
                    fontSize: 10,
                    position: 'insideTopLeft',
                  }}
                />
              )}

              <Bar
                dataKey="netPnl"
                name="صافي الأرباح"
                radius={[6, 6, 0, 0]}
                maxBarSize={52}
              >
                {monthlyData.map((entry, index) => {
                  const isCurrent = entry.period === currentMonth?.period;
                  const isSelected = entry.label === selectedPrevMonth?.label;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        isCurrent
                          ? '#10b981' // Vibrant Emerald for current month
                          : isSelected
                          ? '#818cf8' // Indigo highlight for chosen comparison month
                          : '#475569' // Cool slate for other previous months
                      }
                    />
                  );
                })}
              </Bar>
            </BarChart>
          ) : chartMetric === 'head-to-head' ? (
            <BarChart
              data={headToHeadData}
              margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="metric"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={val => `$${val}`}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: any, name: any) => [
                  `$${(Number(value) || 0).toLocaleString()}`,
                  name === 'current' ? `الشهر الحالي (${currentMonth?.period})` : `الشهر المقارن (${selectedPrevMonth?.period})`,
                ]}
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px' }}
              />
              <Legend
                formatter={(val: string) =>
                  val === 'current'
                    ? `الشهر الحالي (${currentMonth?.period})`
                    : `الشهر المقارن (${selectedPrevMonth?.period})`
                }
              />
              <Bar
                dataKey="current"
                name="current"
                fill="#10b981"
                radius={[5, 5, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                dataKey="previous"
                name="previous"
                fill="#6366f1"
                radius={[5, 5, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          ) : chartMetric === 'winrate' ? (
            <BarChart
              data={monthlyData}
              margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="period"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={val => `${val}%`}
                tickLine={false}
              />
              <Tooltip content={<ComparativeTooltip />} />
              <ReferenceLine y={50} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'نقطة التعادل (50%)', fill: '#64748b', fontSize: 10 }} />
              <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'هدف النخبة (80%)', fill: '#10b981', fontSize: 10 }} />

              <Bar
                dataKey="winRate"
                name="نسبة الفوز (%)"
                radius={[6, 6, 0, 0]}
                maxBarSize={52}
              >
                {monthlyData.map((entry, index) => {
                  const isCurrent = entry.period === currentMonth?.period;
                  return (
                    <Cell
                      key={`wr-cell-${index}`}
                      fill={isCurrent ? '#06b6d4' : '#3b82f6'}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          ) : (
            <BarChart
              data={monthlyData}
              margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="period"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
              />
              <Tooltip content={<ComparativeTooltip />} />
              <Legend formatter={(val: string) => (val === 'wins' ? 'صفقات رابحة' : 'صفقات خاسرة')} />
              <Bar
                dataKey="wins"
                name="wins"
                stackId="a"
                fill="#10b981"
                radius={[0, 0, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                dataKey="losses"
                name="losses"
                stackId="a"
                fill="#f43f5e"
                radius={[5, 5, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Comparison Insights Summary Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">
              ملخص تحليل التطور الشهري (Monthly Growth Intelligence)
            </h4>
            <p className="text-slate-400 mt-1 leading-relaxed">
              سجل الشهر الحالي (<strong className="text-white">{currentMonth?.label}</strong>) نمواً بنسبة{' '}
              <strong className="text-emerald-400">
                {deltas ? `${deltas.pnlPercent >= 0 ? '+' : ''}${deltas.pnlPercent}%` : '+17.7%'}
              </strong>{' '}
              مقارنة بشهر <strong className="text-white">{selectedPrevMonth?.label}</strong>، مع ارتفاع معدل الفوز إلى{' '}
              <strong className="text-cyan-400">{currentMonth?.winRate}%</strong> وزيادة متوسط الربح لكل صفقة بنسبة{' '}
              <strong className="text-purple-300">
                {deltas ? `${deltas.avgProfitPercent >= 0 ? '+' : ''}${deltas.avgProfitPercent}%` : '+52.9%'}
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 font-mono">
          <span className="text-slate-400">تقييم الأداء:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold text-xs border border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>انضباط عالي وتطور مستمر</span>
          </span>
        </div>
      </div>
    </div>
  );
};
