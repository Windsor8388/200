import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.ts';

export interface PriceAlert {
  id: string;
  ownerId: string;
  pair: string;
  targetPrice: number;
  direction: 'ABOVE' | 'BELOW';
  note?: string;
  createdAt: string;
  triggered: boolean;
  triggeredAt?: string;
  triggeredPrice?: number;
  active: boolean;
  soundEnabled?: boolean;
}

const STORAGE_KEY = 'bingx_price_alerts';

// Synthesize a pleasant, crisp multi-tone chime using the Web Audio API without needing external files
export function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;

    // Tone 1: High crisp harmonic (880Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Tone 2: Rich resonance (1174Hz - D6) after 120ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.35);

    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.warn('AudioContext alert playback error:', err);
  }
}

// Request and dispatch HTML5 browser notifications if supported
export function sendDesktopNotification(title: string, body: string) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body, icon: '/favicon.ico' });
        }
      });
    }
  } catch (e) {
    console.warn('Notification dispatch error:', e);
  }
}

// Load alerts from local storage or cloud
export async function getPriceAlerts(ownerId: string): Promise<PriceAlert[]> {
  try {
    const local = localStorage.getItem(`${STORAGE_KEY}_${ownerId}`);
    let list: PriceAlert[] = [];
    if (local) {
      list = JSON.parse(local);
    }

    // Try firestore if online
    if (ownerId && ownerId !== 'demo') {
      try {
        const snap = await getDoc(doc(db, 'price_alerts', ownerId));
        if (snap.exists() && snap.data()?.alerts) {
          list = snap.data().alerts as PriceAlert[];
          localStorage.setItem(`${STORAGE_KEY}_${ownerId}`, JSON.stringify(list));
        }
      } catch (e) {
        // Fallback to local
      }
    }

    // If empty, provide default seed alerts for demonstration
    if (!list || list.length === 0) {
      list = [
        {
          id: 'alert-seed-gold',
          ownerId,
          pair: 'XAU-USDT',
          targetPrice: 2715.0,
          direction: 'ABOVE',
          note: 'كسر مقاومة الذهب التاريخية (2,715$ للأونصة)',
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          triggered: false,
          active: true,
          soundEnabled: true,
        },
        {
          id: 'alert-seed-btc',
          ownerId,
          pair: 'BTC-USDT',
          targetPrice: 89000.0,
          direction: 'ABOVE',
          note: 'استهداف حاجز 89,000$ لكتلة السيولة اليومية',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          triggered: false,
          active: true,
          soundEnabled: true,
        },
      ];
      try {
        localStorage.setItem(`${STORAGE_KEY}_${ownerId}`, JSON.stringify(list));
      } catch (e) {}
    }

    return list;
  } catch (err) {
    console.warn('Error loading price alerts:', err);
    return [];
  }
}

// Save alerts to local storage and sync to firestore
export async function savePriceAlerts(ownerId: string, alerts: PriceAlert[]): Promise<void> {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${ownerId}`, JSON.stringify(alerts));
    if (ownerId && ownerId !== 'demo') {
      try {
        await setDoc(doc(db, 'price_alerts', ownerId), {
          alerts,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        // Continue silently if offline
      }
    }
  } catch (err) {
    console.warn('Error saving price alerts:', err);
  }
}
