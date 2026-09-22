import React, { useState } from 'react';
import {
  Bot,
  Play,
  Pause,
  Plus,
  Trash2,
  Cpu,
  TrendingUp,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Sliders,
  History,
  ShieldCheck,
  ShieldAlert,
  Zap,
  RefreshCw,
  Clock,
  Compass,
} from 'lucide-react';
import type { TradingAgent, BotRiskParameters, BotAdaptationEvent } from '../lib/firestoreService.ts';

interface AgentManagerProps {
  agents: TradingAgent[];
  onToggleStatus: (agentId: string, status: 'active' | 'paused' | 'stopped') => void;
  onDeleteAgent: (agentId: string) => void;
  onCreateAgent: (agent: Omit<TradingAgent, 'id' | 'createdAt' | 'updatedAt' | 'totalTrades' | 'winRate' | 'pnl'>) => void;
  onUpdateAgent?: (agentId: string, updates: Partial<TradingAgent>) => Promise<void>;
  onRunAgentCycle: (agent: TradingAgent) => Promise<void>;
  isExecuting?: boolean;
}

export const AgentManager: React.FC<AgentManagerProps> = ({
  agents,
  onToggleStatus,
  onDeleteAgent,
  onCreateAgent,
  onUpdateAgent,
  onRunAgentCycle,
  isExecuting = false,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeCycleAgentId, setActiveCycleAgentId] = useState<string | null>(null);
  const [selectedHistoryAgent, setSelectedHistoryAgent] = useState<TradingAgent | null>(null);
  const [editingRiskAgent, setEditingRiskAgent] = useState<TradingAgent | null>(null);

  // Form State for Creation
  const [name, setName] = useState('');
  const [pair, setPair] = useState('BTC-USDT');
  const [strategy, setStrategy] = useState('Smart Money Concepts (SMC & Order Blocks)');
  const [timeframe, setTimeframe] = useState('15m');
  const [riskPercentage, setRiskPercentage] = useState(2);
  const [leverage, setLeverage] = useState(10);
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState(10);
  const [stopLossPercent, setStopLossPercent] = useState(2.0);
  const [takeProfitPercent, setTakeProfitPercent] = useState(4.5);
  const [trailingStop, setTrailingStop] = useState(true);
  const [model, setModel] = useState('gemini-3.1-pro-preview');

  // Edit Risk Parameters State
  const [editRiskParams, setEditRiskParams] = useState<BotRiskParameters>({
    riskPercentage: 2,
    maxDrawdownPercent: 10,
    leverage: 10,
    stopLossPercent: 2.0,
    takeProfitPercent: 4.5,
    trailingStop: true,
    maxOpenTrades: 2,
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateAgent({
      ownerId: '',
      name: name.trim(),
      pair,
      strategy,
      timeframe,
      riskPercentage,
      status: 'active',
      model,
      riskParameters: {
        riskPercentage,
        maxDrawdownPercent,
        leverage,
        stopLossPercent,
        takeProfitPercent,
        trailingStop,
        maxOpenTrades: 2,
      },
      adaptation: {
        marketRegime: 'RANGE_CONSOLIDATION',
        autoPilot: true,
        lastAdaptedAt: new Date().toISOString(),
        adaptationSummary: 'تم تهيئة الوكيل ومراقبة بيئة السوق الأولية.',
        adaptiveScore: 88,
      },
      adaptationHistory: [
        {
          timestamp: new Date().toISOString(),
          marketRegime: 'RANGE_CONSOLIDATION',
          changeSummary: 'تهيئة الوكيل وربط استراتيجية التداول وخطة المخاطرة',
          tunedParameters: `الرافعة ${leverage}x | مخاطرة ${riskPercentage}% | SL ${stopLossPercent}% | TP ${takeProfitPercent}%`,
          confidence: 88,
        },
      ],
    });

    setName('');
    setShowAddModal(false);
  };

  const handleRunCycle = async (agent: TradingAgent) => {
    setActiveCycleAgentId(agent.id);
    try {
      await onRunAgentCycle(agent);
    } finally {
      setActiveCycleAgentId(null);
    }
  };

  const handleToggleAutoPilot = async (agent: TradingAgent) => {
    if (!onUpdateAgent) return;
    const current = agent.adaptation?.autoPilot ?? true;
    await onUpdateAgent(agent.id, {
      adaptation: {
        marketRegime: agent.adaptation?.marketRegime || 'RANGE_CONSOLIDATION',
        autoPilot: !current,
        lastAdaptedAt: new Date().toISOString(),
        adaptationSummary: !current
          ? 'تم تفعيل التداول الذاتي المتكيف (Auto-Pilot).'
          : 'تم إيقاف التداول الذاتي والتحويل إلى الوضع اليدوي.',
        adaptiveScore: agent.adaptation?.adaptiveScore || 85,
      },
    });
  };

  const openRiskModal = (agent: TradingAgent) => {
    setEditingRiskAgent(agent);
    setEditRiskParams(
      agent.riskParameters || {
        riskPercentage: agent.riskPercentage || 2,
        maxDrawdownPercent: 10,
        leverage: 10,
        stopLossPercent: 2.0,
        takeProfitPercent: 4.5,
        trailingStop: true,
        maxOpenTrades: 2,
      }
    );
  };

  const handleSaveRiskParams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRiskAgent || !onUpdateAgent) return;

    await onUpdateAgent(editingRiskAgent.id, {
      riskPercentage: editRiskParams.riskPercentage,
      riskParameters: editRiskParams,
      updatedAt: new Date().toISOString(),
    });

    setEditingRiskAgent(null);
  };

  const regimeLabels: Record<string, { label: string; color: string }> = {
    STRONG_BULL_TREND: { label: 'اتجاه صاعد قوي', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' },
    STRONG_BEAR_TREND: { label: 'اتجاه هابط قوي', color: 'bg-rose-950 text-rose-300 border-rose-700' },
    RANGE_CONSOLIDATION: { label: 'تذبذب وتجميع عرضي', color: 'bg-amber-950 text-amber-300 border-amber-700' },
    VOLATILITY_EXPANSION: { label: 'تقلبات وانفجار سعري', color: 'bg-purple-950 text-purple-300 border-purple-700' },
  };

  return (
    <div id="agent-manager-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <span>وكلاء التداول الآلي الذكية المتكيفة (AI Autonomous Bots)</span>
              <span className="text-xs bg-slate-800 text-cyan-400 px-2 py-0.5 rounded-full border border-slate-700">
                {agents.length} وكيل
              </span>
            </h2>
            <p className="text-xs text-slate-400">خوارزميات ذاتية التعلم تتكيف مع تقلبات وظروف السوق وتنفذ الصفقات مباشرة على BingX</p>
          </div>
        </div>

        <button
          id="btn-create-agent-modal"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء وكيل ذكي جديد</span>
        </button>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {agents.map(agent => {
          const isCycleActive = activeCycleAgentId === agent.id;
          const statusColors = {
            active: 'bg-emerald-950 text-emerald-400 border-emerald-800',
            paused: 'bg-amber-950 text-amber-400 border-amber-800',
            stopped: 'bg-rose-950 text-rose-400 border-rose-800',
          };

          const regime = agent.adaptation?.marketRegime || 'RANGE_CONSOLIDATION';
          const regimeInfo = regimeLabels[regime] || { label: regime, color: 'bg-slate-800 text-slate-300 border-slate-700' };
          const isAutoPilot = agent.adaptation?.autoPilot ?? true;

          return (
            <div
              key={agent.id}
              id={`agent-card-${agent.id}`}
              className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all"
            >
              {/* Agent Title & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 mt-0.5 rounded-lg bg-cyan-950/70 border border-cyan-850 flex items-center justify-center text-cyan-400 font-bold text-xs">
                    <Cpu className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-semibold text-white text-sm">{agent.name}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${statusColors[agent.status]}`}>
                        {agent.status === 'active' ? 'نشط' : agent.status === 'paused' ? 'متوقف مؤقتاً' : 'معطل'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                      <span className="font-mono text-cyan-300 font-bold">{agent.pair}</span>
                      <span>•</span>
                      <span>{agent.timeframe}</span>
                      <span>•</span>
                      <span className="text-slate-300 truncate max-w-[170px]">{agent.strategy}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    id={`risk-btn-${agent.id}`}
                    onClick={() => openRiskModal(agent)}
                    title="إدارة المخاطر والمعلمات"
                    className="text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-800 transition-colors"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  <button
                    id={`history-btn-${agent.id}`}
                    onClick={() => setSelectedHistoryAgent(agent)}
                    title="سجل التكيف والتعلم الذاتي"
                    className="text-slate-400 hover:text-purple-300 p-1 rounded hover:bg-slate-800 transition-colors"
                  >
                    <History className="w-4 h-4" />
                  </button>

                  <button
                    id={`del-agent-${agent.id}`}
                    onClick={() => onDeleteAgent(agent.id)}
                    title="حذف الوكيل"
                    className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Learning & Market Adaptation Status Badge */}
              <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-850 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>حالة السوق المرصودة:</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${regimeInfo.color}`}>
                    {regimeInfo.label}
                  </span>
                </div>

                {agent.adaptation?.adaptationSummary && (
                  <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-1.5 rounded border border-slate-850/60">
                    {agent.adaptation.adaptationSummary}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>
                    الرافعة الحالية: <strong className="text-white font-mono">{agent.riskParameters?.leverage || 10}x</strong>
                  </span>
                  <span>
                    وقف الخسارة: <strong className="text-rose-300 font-mono">{agent.riskParameters?.stopLossPercent || 2}%</strong>
                  </span>
                  <span>
                    جني الأرباح: <strong className="text-emerald-300 font-mono">{agent.riskParameters?.takeProfitPercent || 4.5}%</strong>
                  </span>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900/60 rounded-lg p-2 text-center text-xs border border-slate-850">
                <div>
                  <span className="text-slate-400 block text-[10px]">معدل الفوز (Win Rate)</span>
                  <span className="font-bold text-emerald-400 font-mono">{agent.winRate}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الأرباح الإجمالية</span>
                  <span className={`font-bold font-mono ${agent.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {agent.pnl >= 0 ? `+$${agent.pnl.toFixed(1)}` : `-$${Math.abs(agent.pnl).toFixed(1)}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">إجمالي الصفقات</span>
                  <span className="font-bold text-white font-mono">{agent.totalTrades}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-850">
                <div className="flex items-center gap-2">
                  {agent.status === 'active' ? (
                    <button
                      id={`pause-btn-${agent.id}`}
                      onClick={() => onToggleStatus(agent.id, 'paused')}
                      className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Pause className="w-3 h-3" />
                      <span>إيقاف مؤقت</span>
                    </button>
                  ) : (
                    <button
                      id={`play-btn-${agent.id}`}
                      onClick={() => onToggleStatus(agent.id, 'active')}
                      className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>تفعيل التداول</span>
                    </button>
                  )}

                  {/* AutoPilot toggle button */}
                  <button
                    id={`autopilot-toggle-${agent.id}`}
                    onClick={() => handleToggleAutoPilot(agent)}
                    title={isAutoPilot ? 'التداول الذاتي مفعل' : 'التداول الذاتي معطل'}
                    className={`px-2 py-1 text-xs rounded flex items-center gap-1 border transition-colors cursor-pointer ${
                      isAutoPilot
                        ? 'bg-purple-950 text-purple-300 border-purple-800 font-semibold'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>{isAutoPilot ? 'تلقائي (Auto)' : 'يدوي'}</span>
                  </button>
                </div>

                {/* Instant Evaluation Cycle Trigger */}
                <button
                  id={`run-cycle-btn-${agent.id}`}
                  disabled={isExecuting || isCycleActive}
                  onClick={() => handleRunCycle(agent)}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: isCycleActive ? '1s' : '0s' }} />
                  <span>{isCycleActive ? 'جاري التحليل والتكيف...' : 'تشغيل دورة فحص الآن'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Agent */}
      {showAddModal && (
        <div id="create-agent-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg shadow-2xl flex flex-col gap-4 text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                <span>إنشاء وكيل تداول آلي ذكي متكيف</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">اسم الوكيل</label>
                <input
                  id="agent-name-input"
                  type="text"
                  required
                  placeholder="مثال: قناص سيولة البيتكوين الذاتي SMC"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">زوج التداول على BingX</label>
                  <select
                    id="agent-pair-select"
                    value={pair}
                    onChange={e => setPair(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                  >
                    <option value="BTC-USDT">BTC-USDT</option>
                    <option value="ETH-USDT">ETH-USDT</option>
                    <option value="SOL-USDT">SOL-USDT</option>
                    <option value="XRP-USDT">XRP-USDT</option>
                    <option value="DOGE-USDT">DOGE-USDT</option>
                    <option value="BNB-USDT">BNB-USDT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">الفريم الزمني</label>
                  <select
                    id="agent-timeframe-select"
                    value={timeframe}
                    onChange={e => setTimeframe(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                  >
                    <option value="1m">1m (مضاربة سريعة جداً)</option>
                    <option value="5m">5m (Scalping)</option>
                    <option value="15m">15m (Day Trading)</option>
                    <option value="1h">1h (Swing Trading)</option>
                    <option value="4h">4h (Macro Trend)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">استراتيجية التداول الأساسية</label>
                <select
                  id="agent-strategy-select"
                  value={strategy}
                  onChange={e => setStrategy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="Smart Money Concepts (SMC & Order Blocks)">1. Smart Money Concepts (مناطق صانع السوق وكتل الأوامر Order Blocks)</option>
                  <option value="Trend Following & Triple EMA Alignment">2. تتبع الاتجاه وتوافق المتوسطات الثلاثية (EMA 20/50/200)</option>
                  <option value="MACD Momentum Divergence & Scalper">3. انفراجات الماكد وزخم الانعكاس السريع (MACD Divergence)</option>
                  <option value="RSI Mean Reversion & Exhaustion">4. تشبع القوة النسبية والارتداد السعري (RSI Mean Reversion)</option>
                  <option value="Bollinger Bands Squeeze & Volatility Breakout">5. ضغط بولينجر باند واقتناص الانفجار السعري (BB Breakout)</option>
                  <option value="Adaptive Multi-Confluence Meta-Bot">6. الوكيل الذاتي الهجين متعدد المؤشرات (Adaptive Confluence)</option>
                </select>
              </div>

              {/* Risk Management Section */}
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-col gap-2.5">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>معايير إدارة المخاطر المتقدمة (Risk Management)</span>
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">المخاطرة لكل صفقة (%)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={riskPercentage}
                      onChange={e => setRiskPercentage(parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">الرافعة المالية الافتراضية</label>
                    <select
                      value={leverage}
                      onChange={e => setLeverage(parseInt(e.target.value) || 10)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    >
                      <option value="2">2x (مخاطرة منخفضة)</option>
                      <option value="5">5x (محافظة)</option>
                      <option value="10">10x (قياسية)</option>
                      <option value="20">20x (متقدمة)</option>
                      <option value="50">50x (مضاربة حادة)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">وقف الخسارة الأقصى (SL %)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="10"
                      step="0.1"
                      value={stopLossPercent}
                      onChange={e => setStopLossPercent(parseFloat(e.target.value) || 2)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">الهدف المقترح (TP %)</label>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      step="0.5"
                      value={takeProfitPercent}
                      onChange={e => setTakeProfitPercent(parseFloat(e.target.value) || 4.5)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trailingStop}
                      onChange={e => setTrailingStop(e.target.checked)}
                      className="rounded accent-cyan-500"
                    />
                    <span>تفعيل وقف الخسارة المتحرك (Trailing Stop-Loss)</span>
                  </label>

                  <div className="flex items-center gap-1 text-slate-400">
                    <span>قاطع التراجع:</span>
                    <input
                      type="number"
                      min="3"
                      max="30"
                      value={maxDrawdownPercent}
                      onChange={e => setMaxDrawdownPercent(parseInt(e.target.value) || 10)}
                      className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center text-white"
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">محرك الذكاء الاصطناعي</label>
                <select
                  id="agent-model-select"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (تفكير عميق ودقة استنتاج عالية)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (سرعة تنفيذ وتحديث فوري)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  id="confirm-create-agent-btn"
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer shadow-md"
                >
                  تأكيد وإنشاء الوكيل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Risk Parameters */}
      {editingRiskAgent && (
        <div id="edit-risk-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>تعديل إدارة المخاطر: {editingRiskAgent.name}</span>
              </h3>
              <button
                onClick={() => setEditingRiskAgent(null)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRiskParams} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">المخاطرة لكل صفقة (%)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={editRiskParams.riskPercentage}
                    onChange={e => setEditRiskParams({ ...editRiskParams, riskPercentage: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">الرافعة المالية</label>
                  <select
                    value={editRiskParams.leverage}
                    onChange={e => setEditRiskParams({ ...editRiskParams, leverage: parseInt(e.target.value) || 10 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="2">2x</option>
                    <option value="5">5x</option>
                    <option value="10">10x</option>
                    <option value="20">20x</option>
                    <option value="50">50x</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">وقف الخسارة الافتراضي (SL %)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.1"
                    value={editRiskParams.stopLossPercent}
                    onChange={e => setEditRiskParams({ ...editRiskParams, stopLossPercent: parseFloat(e.target.value) || 2 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">جني الأرباح الافتراضي (TP %)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={editRiskParams.takeProfitPercent}
                    onChange={e => setEditRiskParams({ ...editRiskParams, takeProfitPercent: parseFloat(e.target.value) || 4 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRiskParams.trailingStop}
                    onChange={e => setEditRiskParams({ ...editRiskParams, trailingStop: e.target.checked })}
                    className="accent-cyan-500"
                  />
                  <span>وقف خسارة متتبع (Trailing Stop)</span>
                </label>

                <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                  <span>أقصى تراجع:</span>
                  <input
                    type="number"
                    min="5"
                    max="30"
                    value={editRiskParams.maxDrawdownPercent}
                    onChange={e => setEditRiskParams({ ...editRiskParams, maxDrawdownPercent: parseInt(e.target.value) || 10 })}
                    className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-center text-white"
                  />
                  <span>%</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRiskAgent(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adaptation & Learning History */}
      {selectedHistoryAgent && (
        <div id="adaptation-history-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg shadow-2xl flex flex-col gap-4 text-right max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <span>سجل التكيف والتعلم الذاتي: {selectedHistoryAgent.name}</span>
              </h3>
              <button
                onClick={() => setSelectedHistoryAgent(null)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {(!selectedHistoryAgent.adaptationHistory || selectedHistoryAgent.adaptationHistory.length === 0) ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  لا توجد أحداث تكيف سابقة حتى الآن. يتم تسجيل التكيف تلقائياً عند تشغيل دورات الفحص وتغير حالة السوق.
                </div>
              ) : (
                selectedHistoryAgent.adaptationHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <span className="bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                        {item.marketRegime}
                      </span>
                    </div>

                    <p className="text-slate-200 font-medium leading-relaxed">
                      {item.changeSummary}
                    </p>

                    <div className="flex items-center justify-between text-[11px] bg-slate-900 p-1.5 rounded border border-slate-850">
                      <span className="text-slate-400">المعلمات المعدلة:</span>
                      <span className="font-mono text-cyan-300 font-bold">{item.tunedParameters}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => setSelectedHistoryAgent(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
