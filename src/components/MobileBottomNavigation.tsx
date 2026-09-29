import React from 'react';
import {
  LineChart,
  Bot,
  Briefcase,
  BarChart3,
  Scale,
  Sliders,
  Flame,
} from 'lucide-react';

interface MobileBottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  onOpenToolsDrawer: () => void;
  onOpenTribunal: () => void;
  openPositionsCount: number;
  agentsCount: number;
}

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  activeTab,
  onTabChange,
  onOpenToolsDrawer,
  onOpenTribunal,
  openPositionsCount,
  agentsCount,
}) => {
  return (
    <nav
      id="mobile-bottom-navigation-bar"
      aria-label="التنقل السفلي للموبايل"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-850 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb"
      dir="rtl"
    >
      {/* 1. Chart & Trade */}
      <button
        type="button"
        id="mobile-nav-chart"
        onClick={() => onTabChange('chart-trading')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
          activeTab === 'chart-trading'
            ? 'text-cyan-400 font-bold bg-cyan-950/50 scale-105'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LineChart className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">الشارت</span>
      </button>

      {/* 2. Agents */}
      <button
        type="button"
        id="mobile-nav-agents"
        onClick={() => onTabChange('agents')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl relative transition-all cursor-pointer ${
          activeTab === 'agents'
            ? 'text-cyan-400 font-bold bg-cyan-950/50 scale-105'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Bot className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">الوكلاء</span>
        {agentsCount > 0 && (
          <span className="absolute top-0.5 right-1 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-slate-950" />
        )}
      </button>

      {/* 3. Positions */}
      <button
        type="button"
        id="mobile-nav-positions"
        onClick={() => {
          onTabChange('chart-trading');
          const el = document.getElementById('profit-analytics-panel');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl relative transition-all cursor-pointer text-slate-400 hover:text-slate-200"
      >
        <Briefcase className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">الصفقات</span>
        {openPositionsCount > 0 && (
          <span className="absolute -top-1 -right-0.5 px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] font-mono animate-bounce">
            {openPositionsCount}
          </span>
        )}
      </button>

      {/* 4. Analytics */}
      <button
        type="button"
        id="mobile-nav-analytics"
        onClick={() => onTabChange('analytics')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
          activeTab === 'analytics'
            ? 'text-cyan-400 font-bold bg-cyan-950/50 scale-105'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <BarChart3 className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">الأداء</span>
      </button>

      {/* 5. Tribunal (Jury & Audit) */}
      <button
        type="button"
        id="mobile-nav-tribunal"
        onClick={onOpenTribunal}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-amber-300 hover:text-amber-200 transition-all cursor-pointer"
      >
        <Scale className="w-5 h-5 mb-0.5 text-amber-400" />
        <span className="text-[10px] font-bold">التحكيم</span>
      </button>

      {/* 6. Tools & Drawer */}
      <button
        type="button"
        id="mobile-nav-tools"
        onClick={onOpenToolsDrawer}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-cyan-300 hover:text-white transition-all cursor-pointer"
      >
        <Sliders className="w-5 h-5 mb-0.5 text-cyan-400" />
        <span className="text-[10px] font-bold">الأدوات ⚙️</span>
      </button>
    </nav>
  );
};
