import { soundService } from './soundService.ts';
import type { VolatilitySpike } from './indicators.ts';

export interface LeverageAdaptationAlert {
  agentName: string;
  pair: string;
  oldLeverage: number;
  newLeverage: number;
  reason?: string;
  volatilityLevel?: 'HIGH' | 'EXTREME' | 'SPIKE' | 'NORMAL';
}

class PushNotificationService {
  private isPushEnabled: boolean = true;
  private isVoiceSummaryEnabled: boolean = true;
  private speechSynth: SpeechSynthesis | null = null;
  private arabicVoice: SpeechSynthesisVoice | null = null;
  private listeners: Array<(permission: NotificationPermission) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedPush = localStorage.getItem('nexus_push_notifications_enabled');
        if (savedPush !== null) {
          this.isPushEnabled = savedPush === 'true';
        }
        const savedVoice = localStorage.getItem('nexus_voice_summary_enabled');
        if (savedVoice !== null) {
          this.isVoiceSummaryEnabled = savedVoice === 'true';
        }

        if ('speechSynthesis' in window) {
          this.speechSynth = window.speechSynthesis;
          this.initVoices();
          if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = () => this.initVoices();
          }
        }
      } catch (e) {}
    }
  }

  private initVoices() {
    if (!this.speechSynth) return;
    try {
      const voices = this.speechSynth.getVoices();
      // Look for Arabic voice first, fallback to standard natural voice
      const ar = voices.find(v => v.lang.startsWith('ar') || v.lang.includes('ar-') || v.name.toLowerCase().includes('arabic'));
      if (ar) {
        this.arabicVoice = ar;
      }
    } catch (e) {}
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const res = await Notification.requestPermission();
      this.notifyListeners(res);
      return res;
    } catch (e) {
      return 'denied';
    }
  }

  public subscribePermissionChange(cb: (permission: NotificationPermission) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notifyListeners(perm: NotificationPermission) {
    this.listeners.forEach(cb => {
      try {
        cb(perm);
      } catch (e) {}
    });
  }

  public getIsPushEnabled(): boolean {
    return this.isPushEnabled;
  }

  public togglePushEnabled(): boolean {
    this.isPushEnabled = !this.isPushEnabled;
    try {
      localStorage.setItem('nexus_push_notifications_enabled', String(this.isPushEnabled));
    } catch (e) {}
    return this.isPushEnabled;
  }

  public getIsVoiceSummaryEnabled(): boolean {
    return this.isVoiceSummaryEnabled;
  }

  public toggleVoiceSummary(): boolean {
    this.isVoiceSummaryEnabled = !this.isVoiceSummaryEnabled;
    try {
      localStorage.setItem('nexus_voice_summary_enabled', String(this.isVoiceSummaryEnabled));
    } catch (e) {}
    return this.isVoiceSummaryEnabled;
  }

  // Fast Spoken Audio Summary via Web Speech API
  public speakQuickSummary(text: string) {
    if (!this.isVoiceSummaryEnabled || soundService.getIsMuted()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      const synth = window.speechSynthesis;
      synth.cancel(); // Stop any pending speech to ensure instant reaction

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.arabicVoice) {
        utterance.voice = this.arabicVoice;
        utterance.lang = this.arabicVoice.lang;
      } else {
        utterance.lang = 'ar-SA';
      }

      // Slightly accelerated rate (1.1) for an urgent, crisp trader summary
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;

      synth.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  // Send Browser Push Notification + Trigger Voice Summary
  public sendLeverageAdaptationNotification(alert: LeverageAdaptationAlert) {
    const { agentName, pair, oldLeverage, newLeverage, reason, volatilityLevel = 'HIGH' } = alert;

    // 1. Play alert acoustic tone
    soundService.playAlertTrigger();

    // 2. Prepare spoken summary script in Arabic
    const actionText = newLeverage < oldLeverage ? 'تخفيض' : 'رفع';
    const speechSummary = `تنبيه المخاطر: قام الوكيل ${agentName} بـ ${actionText} الرافعة المالية على زوج ${pair} إلى ${newLeverage}x بسبب تقلبات السوق المفاجئة.`;

    // Trigger voice briefing
    this.speakQuickSummary(speechSummary);

    // 3. Send system browser push notification
    if (this.isPushEnabled && this.isSupported() && Notification.permission === 'granted') {
      try {
        const title = `⚡ NEXUS AI: تعديل الرافعة إلى ${newLeverage}x (${pair})`;
        const body = `قام الوكيل ${agentName} بتعديل الرافعة من ${oldLeverage}x إلى ${newLeverage}x.\nالسبب: ${reason || 'استجابة لتقلبات السوق المفاجئة لحماية الهامش'}`;

        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `leverage-adapt-${pair}-${Date.now()}`,
          requireInteraction: false,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        // Auto close after 7 seconds
        setTimeout(() => notif.close(), 7000);
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }

    return {
      speechSummary,
      title: `⚡ تعديل الرافعة: ${agentName} (${pair})`,
      details: `تم التعديل من ${oldLeverage}x إلى ${newLeverage}x [${volatilityLevel}]`,
    };
  }

  // Send Volatility Spike Notification + Sound + Voice Alert
  public sendVolatilitySpikeNotification(spike: VolatilitySpike) {
    // 1. Play alert acoustic tone
    soundService.playAlertTrigger();

    // 2. Prepare spoken summary script in Arabic
    const dirText = spike.type === 'BULLISH_SPIKE' ? 'صعودية مفاجئة' : spike.type === 'BEARISH_SPIKE' ? 'هبوطية حادة' : 'توسع في التذبذب';
    const speechSummary = `تنبيه تقلب سعري: رصد طفرة ${dirText} على زوج ${spike.pair || 'العملة'} بنسبة ${Math.abs(spike.priceChangePct).toFixed(1)} في المائة. معدل التذبذب ${spike.spikeRatio.toFixed(1)} أضعاف المعدل الطبيعي.`;

    // Trigger voice briefing
    this.speakQuickSummary(speechSummary);

    // 3. Send system browser push notification
    if (this.isPushEnabled && this.isSupported() && Notification.permission === 'granted') {
      try {
        const title = `🚨 طفرة تقلب: ${spike.badgeLabel} (${spike.pair || 'السوق'})`;
        const body = `${spike.titleArabic}\n${spike.messageArabic}\nنصيحة المتداول: ${spike.actionTipArabic}`;

        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `vol-spike-${spike.pair}-${spike.time}`,
          requireInteraction: false,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        setTimeout(() => notif.close(), 8000);
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }

    return {
      speechSummary,
      title: `🚨 طفرة تقلب: ${spike.badgeLabel}`,
      details: spike.messageArabic,
    };
  }
}

export const pushNotificationService = new PushNotificationService();
