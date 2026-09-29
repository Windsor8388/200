import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Zap,
  Info,
  Radio,
} from 'lucide-react';
import { pushNotificationService, type LeverageAdaptationAlert } from '../lib/pushNotificationService.ts';

interface PushNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const PushNotificationModal: React.FC<PushNotificationModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    pushNotificationService.getPermission()
  );
  const [isPushEnabled, setIsPushEnabled] = useState(() =>
    pushNotificationService.getIsPushEnabled()
  );
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() =>
    pushNotificationService.getIsVoiceSummaryEnabled()
  );
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const unsub = pushNotificationService.subscribePermissionChange(perm => {
      setPermission(perm);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const res = await pushNotificationService.requestPermission();
    setPermission(res);
    if (res === 'granted') {
      onShowToast('✅ تم منح إذن إشعارات المتصفح بنجاح!');
    } else if (res === 'denied') {
      onShowToast('⚠️ تم رفض الإذن من المتصفح. يمكنك تغييره من إعدادات الموقع.');
    }
  };

  const handleTogglePush = () => {
    const next = pushNotificationService.togglePushEnabled();
    setIsPushEnabled(next);
    onShowToast(next ? '🔔 تم تفعيل إشعارات الدفع للمتصفح' : '🔕 تم إيقاف إشعارات الدفع للمتصفح');
  };

  const handleToggleVoice = () => {
    const next = pushNotificationService.toggleVoiceSummary();
    setIsVoiceEnabled(next);
    onShowToast(next ? '🎙️ تم تفعيل الملخص الصوتي السريع' : '🔇 تم كتم الملخص الصوتي');
  };

  const handleTestAlert = () => {
    if (isTesting) return;
    setIsTesting(true);

    const testData: LeverageAdaptationAlert = {
      agentName: 'SMC Hunter AI',
      pair: 'BTC-USDT',
      oldLeverage: 20,
      newLeverage: 10,
      reason: 'رصد تذبذب سعري مفاجئ وكسر وهمي لسيولة القمة (Liquidity Sweep)',
      volatilityLevel: 'HIGH',
    };

    pushNotificationService.sendLeverageAdaptationNotification(testData);
    onShowToast('⚡ تم إرسال إشعار تعديل الرافعة والملخص الصوتي التجريبي!');

    setTimeout(() => {
      setIsTesting(false);
    }, 2500);
  };

  return (
    <div
      id="push-notification-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="push-notification-modal"
        className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col gap-4 p-5 text-xs text-right animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
              <BellRing className="w-5 h-5 animate-pulse text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <span>إشعارات الدفع والملخص الصوتي للوكلاء</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-750 text-[10px] font-mono">
                  Smart Audio Alert
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                تنبيهات فورية وملخص صوتي سريع عند قيام الوكلاء بتعديل الرافعة المالية استجابة لتقلبات السوق
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permission Status Box */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {permission === 'granted' && (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                </>
              )}
              {permission === 'default' && (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              )}
              {permission === 'denied' && (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 shadow-[0_0_8px_#ef4444]" />
              )}
            </span>
            <div>
              <span className="font-bold text-white block text-xs">
                {permission === 'granted' && 'إذن الإشعارات: مفعّل بنجاح (Granted 🟢)'}
                {permission === 'default' && 'إذن الإشعارات: بانتظار الموافقة (Default 🟡)'}
                {permission === 'denied' && 'إذن الإشعارات: محظور في المتصفح (Denied 🔴)'}
              </span>
              <span className="text-[10px] text-slate-400">
                {permission === 'granted' && 'ستصلك تنبيهات النظام حتى عند تصغير المتصفح'}
                {permission === 'default' && 'اضغط على زر التفعيل أدناه لمنح المتصفح الإذن'}
                {permission === 'denied' && 'يمكنك السماح بالإشعارات من أيقونة القفل في شريط العنوان'}
              </span>
            </div>
          </div>

          {permission !== 'granted' && (
            <button
              type="button"
              id="request-push-permission-btn"
              onClick={handleRequestPermission}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-cyan-950/50"
            >
              تفعيل الإذن الآن
            </button>
          )}
        </div>

        {/* Settings Toggles */}
        <div className="flex flex-col gap-2.5">
          {/* Push notification toggle */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white block text-xs">إرسال إشعارات الدفع (Browser Push)</span>
                <span className="text-[10px] text-slate-400">
                  إرسال بطاقة إشعار مرئية عند رصد تقلبات وتغيير الرافعة
                </span>
              </div>
            </div>

            <button
              type="button"
              id="toggle-push-btn"
              onClick={handleTogglePush}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                isPushEnabled ? 'bg-cyan-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isPushEnabled ? 'left-1' : 'left-7'
                }`}
              />
            </button>
          </div>

          {/* Voice Summary toggle */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white block text-xs">
                  الملخص الصوتي السريع (Fast Spoken Briefing)
                </span>
                <span className="text-[10px] text-slate-400">
                  نطق ملخص صوتي فوري باللغة العربية عند تعديل الرافعة لحماية رأس المال
                </span>
              </div>
            </div>

            <button
              type="button"
              id="toggle-voice-btn"
              onClick={handleToggleVoice}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                isVoiceEnabled ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isVoiceEnabled ? 'left-1' : 'left-7'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Live Audio / Push Test Section */}
        <div className="bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-950/50 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>تجربة فورية للاستجابة الصوتية وتعديل الرافعة</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Web Speech + Audio Synth</span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            عندما يرصد الوكيل تقلبات حادة (مثل ارتفاع الشموع الفجائي أو تذبذب السيولة)، يقوم بخفض الرافعة فوراً وينبهك صوتياً عبر المتصفح:
          </p>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[10px] text-cyan-300">
            "تنبيه المخاطر: قام الوكيل SMC Hunter AI بتخفيض الرافعة المالية على زوج BTC-USDT إلى 10x بسبب تقلبات السوق المفاجئة."
          </div>

          <button
            type="button"
            id="test-push-and-voice-alert-btn"
            disabled={isTesting}
            onClick={handleTestAlert}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-cyan-950/50 cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-white ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'جاري تشغيل الملخص الصوتي...' : 'تشغيل تنبيه تجريبي للملخص الصوتي الآن'}</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-500">
          <span>يعمل بدون استهلاك موارد خارجية باستخدام واجهات المتصفح الأصلية</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
