import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';

export interface BotRiskParameters {
  riskPercentage: number;
  maxDrawdownPercent: number;
  leverage: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStop: boolean;
  maxOpenTrades: number;
}

export interface BotAdaptationEvent {
  timestamp: string;
  marketRegime: string;
  changeSummary: string;
  tunedParameters: string;
  confidence: number;
}

export interface TradingAgent {
  id: string;
  ownerId: string;
  name: string;
  pair: string;
  strategy: string;
  timeframe: string;
  riskPercentage: number;
  status: 'active' | 'paused' | 'stopped';
  totalTrades: number;
  winRate: number;
  pnl: number;
  model: string;
  riskParameters?: BotRiskParameters;
  adaptation?: {
    marketRegime: string;
    autoPilot: boolean;
    lastAdaptedAt: string;
    adaptationSummary: string;
    adaptiveScore: number;
  };
  adaptationHistory?: BotAdaptationEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface TradeRecord {
  id: string;
  ownerId: string;
  agentId?: string;
  pair: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  amount: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl: number;
  pnlPercentage: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  source: string;
  createdAt: string;
  closedAt?: string;
  durationMinutes?: number;
}

export interface ChartAnalysisRecord {
  id: string;
  ownerId: string;
  pair: string;
  timeframe: string;
  sentiment: string;
  confidence: number;
  recommendation: string;
  summary: string;
  indicators: string;
  createdAt: string;
}

export interface UserSettings {
  ownerId: string;
  emailNotifications: boolean;
  alertEmail: string;
  bingxApiKey?: string;
  bingxSecretKey?: string;
  isTestnet: boolean;
  updatedAt: string;
}

// 1. Agents CRUD
export async function saveAgent(agent: TradingAgent): Promise<void> {
  const path = 'agents';
  try {
    await setDoc(doc(db, path, agent.id), agent);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${agent.id}`);
  }
}

export async function updateAgent(agentId: string, updates: Partial<TradingAgent>): Promise<void> {
  const path = 'agents';
  try {
    await updateDoc(doc(db, path, agentId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${path}/${agentId}`);
  }
}

export async function updateAgentStatus(agentId: string, status: 'active' | 'paused' | 'stopped'): Promise<void> {
  const path = 'agents';
  try {
    await updateDoc(doc(db, path, agentId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${path}/${agentId}`);
  }
}

export async function deleteAgent(agentId: string): Promise<void> {
  const path = 'agents';
  try {
    await deleteDoc(doc(db, path, agentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${path}/${agentId}`);
  }
}

export function subscribeToAgents(
  ownerId: string,
  onUpdate: (agents: TradingAgent[]) => void
) {
  const q = query(collection(db, 'agents'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    snapshot => {
      const agents: TradingAgent[] = [];
      snapshot.forEach(docSnap => {
        agents.push(docSnap.data() as TradingAgent);
      });
      onUpdate(agents);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, 'agents');
    }
  );
}

// 2. Trades CRUD
export async function logTrade(trade: TradeRecord): Promise<void> {
  const path = 'trades';
  try {
    await setDoc(doc(db, path, trade.id), trade);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${trade.id}`);
  }
}

export async function closeTrade(tradeId: string, exitPrice: number, finalPnl: number, pnlPct: number, durationMinutes?: number): Promise<void> {
  const path = 'trades';
  try {
    await updateDoc(doc(db, path, tradeId), {
      exitPrice,
      pnl: finalPnl,
      pnlPercentage: pnlPct,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${path}/${tradeId}`);
  }
}

export function subscribeToTrades(
  ownerId: string,
  onUpdate: (trades: TradeRecord[]) => void
) {
  const q = query(collection(db, 'trades'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    snapshot => {
      const trades: TradeRecord[] = [];
      snapshot.forEach(docSnap => {
        trades.push(docSnap.data() as TradeRecord);
      });
      // Sort newest first
      trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(trades);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, 'trades');
    }
  );
}

// 3. Analyses CRUD
export async function saveAnalysisReport(analysis: ChartAnalysisRecord): Promise<void> {
  const path = 'analyses';
  try {
    await setDoc(doc(db, path, analysis.id), analysis);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${analysis.id}`);
  }
}

export function subscribeToAnalyses(
  ownerId: string,
  onUpdate: (reports: ChartAnalysisRecord[]) => void
) {
  const q = query(collection(db, 'analyses'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    snapshot => {
      const reports: ChartAnalysisRecord[] = [];
      snapshot.forEach(docSnap => {
        reports.push(docSnap.data() as ChartAnalysisRecord);
      });
      reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(reports);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, 'analyses');
    }
  );
}

// 4. User Settings
export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const path = 'settings';
  try {
    await setDoc(doc(db, path, settings.ownerId), settings);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${settings.ownerId}`);
  }
}

export async function getUserSettings(ownerId: string): Promise<UserSettings | null> {
  const path = 'settings';
  try {
    const snap = await getDoc(doc(db, path, ownerId));
    if (snap.exists()) {
      return snap.data() as UserSettings;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${path}/${ownerId}`);
  }
}
