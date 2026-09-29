import React, { useState, useEffect } from 'react';
import { KeyRound, Sparkles, X, Sliders, ShieldCheck, ArrowLeft, Info } from 'lucide-react';
import type { UserSettings } from '../lib/firestoreService.ts';

interface BingXKeysReminderBannerProps {
  settings: UserSettings | null;
  onOpenSettings: () => void;
  onContinuePaperTrading: () => void;
}

export const BingXKeysReminderBanner: React.FC<BingXKeysReminderBannerProps> = ({
  settings,
  onOpenSettings,
  onContinuePaperTrading,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed previously within 24 hours
    try {
      const dismissedUntil = localStorage.getItem('nexus_bingx_keys_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setIsVisible(false);
        return;
      }
    } catch (e) {}

    // Check if keys are empty or incomplete (less than 8 chars)
    const apiKey = settings?.bingxApiKey?.trim() || '';
    const secretKey = settings?.bingxSecretKey?.trim() || '';

    const isKeysIncomplete = !apiKey || !secretKey || apiKey.length < 8 || secretKey.length < 8;

    if (isKeysIncomplete) {
      // Small graceful delay so the UI settles on startup before showing gentle banner
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [settings]);

  const handleDismiss = (snooze24h = false) => {
    setIsDismissed(true);
    setIsVisible(false);
    if (snooze24h) {
      try {
        const nextTime = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem('nexus_bingx_keys_dismissed_until', String(nextTime));
      } catch (e) {}
    }
    onContinuePaperTrading();
  };

  if (!isVisible || isDismissed) {
    return null;
  }

  return (
    <div
      id="bingx-keys-gentle-reminder-banner"
      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-cyan-500/40 shadow-xl p-3.5 sm:p-4 mb-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      {/* Decorative ambient glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left Side: Icon & Welcoming Message */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
            <KeyRound className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex flex-col gap-1 text-right">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[11px] font-bold text-cyan-300">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                تذكير لطيف للمستخدم
              </span>
              <span className="text-xs text-amber-400/90 font-medium flex items-center gap-1">
                <Info className="w-3 h-3" />
                مفاتيح التداول الحي غير مكتملة
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
              مرحباً بك في <strong className="text-cyan-300 font-bold">NEXUS AI TRADING</strong>! لم يتم تعيين مفاتيح ربط منصة{' '}
              <strong className="text-white">BingX API</strong> بعد. يمكنك إدخال مفاتيحك في أي وقت لتفعيل التنفيذ المباشر للصفقات الحية، أو الاستمرار بوضع{' '}
              <span className="text-emerald-400 font-bold">التداول التجريبي الذكي (Paper Trading)</span> مع كامل ميزات الوكلاء مجاناً وبدون أي مخاطرة مالية.
            </p>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center w-full md:w-auto justify-end">
          <button
            type="button"
            id="reminder-open-settings-btn"
            onClick={() => {
              handleDismiss(false);
              onOpenSettings();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-950/50 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>إعداد المفاتيح الآن</span>
          </button>

          <button
            type="button"
            id="reminder-paper-trading-btn"
            onClick={() => handleDismiss(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            title="إخفاء التذكير لمدة 24 ساعة والمتابعة بالتداول التجريبي"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>المتابعة بالتجريبي (إخفاء)</span>
          </button>

          <button
            type="button"
            onClick={() => handleDismiss(false)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="إغلاق التذكير"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
