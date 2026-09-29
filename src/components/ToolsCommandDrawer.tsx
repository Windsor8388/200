import React from 'react';
import {
  X,
  Scale,
  Settings,
  Globe,
  ImageIcon,
  Mail,
  BellRing,
  Volume2,
  VolumeX,
  Palette,
  Moon,
  Zap,
  Sliders,
  RefreshCw,
  Loader2,
  Wallet,
  LogIn,
  LogOut,
  Flame,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

interface ToolsCommandDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTribunal: () => void;
  onOpenSettings: () => void;
  onOpenNews: () => void;
  onOpenImageGen: () => void;
  onOpenGmail: () => void;
  onOpenAlerts: () => void;
  onOpenPushModal: () => void;
  onToggleSound: () => void;
  isSoundMuted: boolean;
  onToggleTheme: () => void;
  theme: 'slate' | 'midnight-blue';
  bingxApiStatus: 'connected' | 'error' | 'checking';
  bingxStatusDetails?: { latencyMs?: number; message?: string } | null;
  onCheckBingX: () => void;
  isAutoRetrying?: boolean;
  autoRetryCountdown?: number | null;
  accountBalance: {
    asset: string;
    balance: number;
    equity: number;
    unrealizedProfit: number;
    availableMargin: number;
    usedMargin: number;
    mode: string;
    hasFundBalanceNotTransferred?: boolean;
    mainFundBalance?: number;
    spotBalance?: number;
    totalMainBalance?: number;
  };
  onQuickTransfer: () => void;
  isTransferringFunds: boolean;
  activeAlertsCount: number;
  pushPermission: NotificationPermission | 'unsupported';
  isAutoTradingActive: boolean;
  onToggleAutoTrading: () => void;
  currentUser: any;
  onSignIn: () => void;
  onSignOut: () => void;
  isSigningInLoading: boolean;
  onOpenLiveModal: () => void;
  isLiveMode: boolean;
}

export const ToolsCommandDrawer: React.FC<ToolsCommandDrawerProps> = ({
  isOpen,
  onClose,
  onOpenTribunal,
  onOpenSettings,
  onOpenNews,
  onOpenImageGen,
  onOpenGmail,
  onOpenAlerts,
  onOpenPushModal,
  onToggleSound,
  isSoundMuted,
  onToggleTheme,
  theme,
  bingxApiStatus,
  bingxStatusDetails,
  onCheckBingX,
  isAutoRetrying = false,
  autoRetryCountdown = null,
  accountBalance,
  onQuickTransfer,
  isTransferringFunds,
  activeAlertsCount,
  pushPermission,
  isAutoTradingActive,
  onToggleAutoTrading,
  currentUser,
  onSignIn,
  onSignOut,
  isSigningInLoading,
  onOpenLiveModal,
  isLiveMode,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="tools-command-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="tools-command-drawer-panel"
        className="w-full max-w-md h-full bg-slate-900 border-r md:border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left md:slide-in-from-right duration-250"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">مركز التحكم والأدوات الذكية</h2>
              <p className="text-[11px] text-slate-400">إدارة الجلسات، التنبيهات، وفحص الاتصالات</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق القائمة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body Items */}
        <div className="p-4 flex flex-col gap-4 text-xs">
          {/* Quick Account & Trading Mode Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">نظام التداول الحالي:</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLiveModal();
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  isLiveMode
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500/80 text-amber-300'
                }`}
              >
                {isLiveMode ? '🔴 تداول حقيقي (LIVE)' : '🟡 محاكاة تجريبية (PAPER)'}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
              <span className="text-slate-400">رصيد الحساب:</span>
              <span className="font-mono font-bold text-emerald-400">
                ${(accountBalance?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {accountBalance?.asset || 'USDT'}
              </span>
            </div>

            {/* Auto Trading Master Switch */}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>التداول التلقائي بواسطة الوكلاء:</span>
              </span>
              <button
                type="button"
                onClick={onToggleAutoTrading}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  isAutoTradingActive
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isAutoTradingActive ? 'شغال 🟢' : 'معطّل ⚪'}
              </button>
            </div>

            {/* Quick Fund Transfer if Available in Spot */}
            {accountBalance?.hasFundBalanceNotTransferred && (
              <div className="mt-1 p-2 rounded-lg bg-amber-950/40 border border-amber-500/50 flex items-center justify-between gap-2">
                <span className="text-[10px] text-amber-300">يوجد رصيد بمحفظة التمويل لم ينقل للعقود:</span>
                <button
                  type="button"
                  onClick={onQuickTransfer}
                  disabled={isTransferringFunds}
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] cursor-pointer"
                >
                  {isTransferringFunds ? 'نقل...' : '⚡ نقل للعقود'}
                </button>
              </div>
            )}
          </div>

          {/* Section: Main Executive Tools */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-2 px-1">الأدوات التنفيذية والتحكيم:</span>
            <div className="grid grid-cols-1 gap-2">
              {/* Tribunal & Copilot Assistant */}
              <button
                type="button"
                id="drawer-tribunal-btn"
                onClick={() => {
                  onClose();
                  onOpenTribunal();
                }}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-indigo-950/90 to-purple-950/90 hover:from-indigo-900 hover:to-purple-900 border border-indigo-500/60 text-white flex items-center justify-between cursor-pointer transition-all shadow-md group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-amber-300">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white group-hover:text-amber-300 transition-colors">
                      مجلس التحكيم والتدقيق المالي (Jury & Audit)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      فاحص نقاط الضعف والمساعد التنفيذي الصوتي والرؤية
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  PRO
                </span>
              </button>

              {/* BingX Keys & Diagnostics */}
              <button
                type="button"
                id="drawer-settings-btn"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white block">إعدادات ومفاتيح BingX API</span>
                    <span className="text-[10px] text-slate-400">فحص الصلاحيات، إدارة المخاطر والمفاتيح</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${bingxApiStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  <span className="text-[10px] text-slate-400">
                    {bingxApiStatus === 'connected' ? 'متصل' : 'تحقق'}
                  </span>
                </div>
              </button>

              {/* Price Alerts Radar */}
              <button
                type="button"
                id="drawer-price-alerts-btn"
                onClick={() => {
                  onClose();
                  onOpenAlerts();
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center border border-amber-800">
                    <BellRing className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white block">تنبيهات الأسعار اللحظية</span>
                    <span className="text-[10px] text-slate-400">مراقبة مستويات الدخول والأهداف السعرية</span>
                  </div>
                </div>
                {activeAlertsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] font-mono">
                    {activeAlertsCount} نشط
                  </span>
                )}
              </button>

              {/* Market News Grounding */}
              <button
                type="button"
                id="drawer-news-btn"
                onClick={() => {
                  onClose();
                  onOpenNews();
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white block">أخبار ومفكرة السوق (Google Grounding)</span>
                    <span className="text-[10px] text-slate-400">رصد أحداث الفيدرالي والبيانات الاقتصادية الكبرى</span>
                  </div>
                </div>
              </button>

              {/* Chart Image Generator (4K) */}
              <button
                type="button"
                id="drawer-image-gen-btn"
                onClick={() => {
                  onClose();
                  onOpenImageGen();
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center border border-indigo-800">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white block">توليد صورة الشارت (Chart Vision 4K)</span>
                    <span className="text-[10px] text-slate-400">إنشاء رسومات بيانية تحليلية بالذكاء الاصطناعي</span>
                  </div>
                </div>
              </button>

              {/* Gmail Alerts */}
              <button
                type="button"
                id="drawer-gmail-btn"
                onClick={() => {
                  onClose();
                  onOpenGmail();
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/50 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-950 text-rose-400 flex items-center justify-center border border-rose-800">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white block">تنبيهات البريد الإلكتروني (Gmail)</span>
                    <span className="text-[10px] text-slate-400">إرسال تقارير الصفقات للبريد فورياً</span>
                  </div>
                </div>
              </button>

              {/* Push Notifications & Voice Briefing */}
              <button
                type="button"
                id="drawer-push-btn"
                onClick={() => {
                  onClose();
                  onOpenPushModal();
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center border border-indigo-800">
                    <BellRing className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white block">إشعارات الدفع والملخص الصوتي للوكلاء</span>
                    <span className="text-[10px] text-slate-400">نطق أسباب فتح الصفقات وتعديل الرافعة</span>
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full ${pushPermission === 'granted' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </button>
            </div>
          </div>

          {/* Section: Customization & Sound */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-2 px-1">تخصيص الواجهة والصوت:</span>
            <div className="grid grid-cols-2 gap-2">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={onToggleSound}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  !isSoundMuted
                    ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {!isSoundMuted ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                <span className="font-bold">{!isSoundMuted ? 'الصوت مفعّل' : 'الصوت مكتوم'}</span>
              </button>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={onToggleTheme}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  theme === 'midnight-blue'
                    ? 'bg-blue-950/60 border-blue-500/60 text-blue-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {theme === 'midnight-blue' ? <Palette className="w-4 h-4 text-blue-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
                <span className="font-bold">{theme === 'midnight-blue' ? 'Midnight Blue' : 'Slate Dark'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer (Auth & Status) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          {currentUser ? (
            <div className="flex items-center justify-between w-full">
              <div className="text-right">
                <span className="block text-xs font-bold text-white truncate max-w-[180px]">
                  {currentUser.displayName || currentUser.email}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>متصل بالسحابة (Firestore Sync)</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-bold cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningInLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              {isSigningInLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{isSigningInLoading ? 'جاري الاتصال...' : 'ربط الحساب والمزامنة (Google)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
