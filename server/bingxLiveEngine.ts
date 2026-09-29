import crypto from 'crypto';

export interface BingXContractSpec {
  contractId: string;
  symbol: string;
  size: string;
  quantityPrecision: number;
  pricePrecision: number;
  tradeMinQuantity: number;
  tradeMinUSDT: number;
  feeRate: number;
  makerFeeRate: number;
  takerFeeRate: number;
  status: number;
  apiStateOpen: string;
  apiStateClose: string;
  displayName?: string;
}

export interface PositionSizeResult {
  canTrade: boolean;
  symbol: string;
  bingxSymbol: string;
  currentPrice: number;
  leverage: number;
  requestedMargin: number;
  availableBalance: number;
  minNotionalUsdt: number;
  minQuantity: number;
  requiredMarginForMinOrder: number;
  calculatedQuantity: number;
  formattedQuantity: string;
  calculatedNotionalUsdt: number;
  shortfallUsdt?: number;
  estimatedFeeUsdt: number;
  reason?: string;
  messageArabic: string;
}

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  user: string;
  agentId?: string;
  signalId?: string;
  symbol: string;
  side: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  requestedMargin: number;
  requestedQty: number;
  executedQty?: number;
  price: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  clientOrderId: string;
  bingxOrderId?: string;
  apiStatus: 'SUCCESS' | 'REJECTED' | 'FAILED' | 'TIMEOUT';
  orderStatus: 'FILLED' | 'NEW' | 'PARTIALLY_FILLED' | 'CANCELED' | 'FAILED' | 'UNKNOWN';
  verificationStatus: 'VERIFIED_OPEN' | 'PROTECTION_NOT_CONFIRMED' | 'UNVERIFIED' | 'FAILED';
  actualEntry?: number;
  actualQuantity?: number;
  actualSL?: number;
  actualTP?: number;
  protectionConfirmed: boolean;
  bingxRawCode?: number;
  errorReason?: string;
  message: string;
}

// Global in-memory cache for BingX Contract Specifications
let contractsCache: BingXContractSpec[] = [];
let contractsCacheTimestamp = 0;
const CONTRACTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Emergency Stop State (Backend Enforced)
let isEmergencyStopActive = false;
let emergencyStopReason = '';
let emergencyStopTimestamp: string | null = null;

// Duplicate Order Prevention Store (Rolling 20-second window)
interface RecentOrderRecord {
  symbol: string;
  side: string;
  timestamp: number;
  clientOrderId: string;
}
const recentOrdersMap = new Map<string, RecentOrderRecord>();

// Execution Logs Store (Rolling 200 items)
const executionLogs: ExecutionLogEntry[] = [];

/**
 * Normalizes symbols between UI and BingX API formats
 * (e.g. XAU-USDT / XAUUSD -> XAUT-USDT, BTCUSDT -> BTC-USDT)
 */
export function normalizeToBingXSymbol(symbol: string): string {
  const clean = (symbol || '').trim().toUpperCase();
  if (clean === 'XAU-USDT' || clean === 'XAUUSDT' || clean === 'GOLD-USDT' || clean === 'GOLD') {
    return 'XAUT-USDT';
  }
  if (!clean.includes('-') && clean.endsWith('USDT')) {
    return clean.replace('USDT', '-USDT');
  }
  return clean;
}

/**
 * Normalizes BingX symbol back to UI format
 * (e.g. XAUT-USDT -> XAU-USDT)
 */
export function normalizeFromBingXSymbol(symbol: string): string {
  const clean = (symbol || '').trim().toUpperCase();
  if (clean === 'XAUT-USDT' || clean === 'XAUTUSDT') {
    return 'XAU-USDT';
  }
  return clean;
}

/**
 * Canonical BingX API Query Builder
 * Sorts parameters alphabetically as strictly required by BingX Open API specification.
 */
export function buildBingXSignedQuery(
  params: Record<string, any>,
  secretKey: string
): { queryString: string; signature: string; fullQuery: string } {
  const sortedKeys = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();

  const queryString = sortedKeys.map(k => `${k}=${encodeURIComponent(String(params[k]))}`).join('&');
  const signature = crypto.createHmac('sha256', secretKey.trim()).update(queryString).digest('hex');
  const fullQuery = `${queryString}&signature=${signature}`;

  return { queryString, signature, fullQuery };
}

/**
 * Fetches and caches official BingX Perpetual Swap contract specifications.
 */
export async function getBingXContractSpecs(): Promise<BingXContractSpec[]> {
  const now = Date.now();
  if (contractsCache.length > 0 && now - contractsCacheTimestamp < CONTRACTS_CACHE_TTL) {
    return contractsCache;
  }

  try {
    const res = await fetch('https://open-api.bingx.com/openApi/swap/v2/quote/contracts', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && Array.isArray(json.data) && json.data.length > 0) {
        contractsCache = json.data.map((c: any) => ({
          contractId: String(c.contractId || ''),
          symbol: String(c.symbol || '').toUpperCase(),
          size: String(c.size || '1'),
          quantityPrecision: Number(c.quantityPrecision) ?? 2,
          pricePrecision: Number(c.pricePrecision) ?? 2,
          tradeMinQuantity: parseFloat(String(c.tradeMinQuantity || '0.001')),
          tradeMinUSDT: parseFloat(String(c.tradeMinUSDT || '2')),
          feeRate: parseFloat(String(c.feeRate || '0.0005')),
          makerFeeRate: parseFloat(String(c.makerFeeRate || '0.0002')),
          takerFeeRate: parseFloat(String(c.takerFeeRate || '0.0005')),
          status: Number(c.status) ?? 1,
          apiStateOpen: String(c.apiStateOpen ?? 'true'),
          apiStateClose: String(c.apiStateClose ?? 'true'),
          displayName: c.displayName,
        }));
        contractsCacheTimestamp = now;
        return contractsCache;
      }
    }
  } catch (err: any) {
    console.warn('Failed to load BingX contracts live:', err.message);
  }

  // Fallback defaults verified against live BingX Swap V2
  if (contractsCache.length === 0) {
    contractsCache = [
      { contractId: '100', symbol: 'BTC-USDT', size: '0.0001', quantityPrecision: 4, pricePrecision: 1, tradeMinQuantity: 0.0001, tradeMinUSDT: 2, feeRate: 0.0005, makerFeeRate: 0.0002, takerFeeRate: 0.0005, status: 1, apiStateOpen: 'true', apiStateClose: 'true' },
      { contractId: '101', symbol: 'ETH-USDT', size: '0.01', quantityPrecision: 2, pricePrecision: 2, tradeMinQuantity: 0.01, tradeMinUSDT: 2, feeRate: 0.0005, makerFeeRate: 0.0002, takerFeeRate: 0.0005, status: 1, apiStateOpen: 'true', apiStateClose: 'true' },
      { contractId: '102', symbol: 'SOL-USDT', size: '1', quantityPrecision: 2, pricePrecision: 3, tradeMinQuantity: 0.02, tradeMinUSDT: 2, feeRate: 0.0005, makerFeeRate: 0.0002, takerFeeRate: 0.0005, status: 1, apiStateOpen: 'true', apiStateClose: 'true' },
      { contractId: '103', symbol: 'XRP-USDT', size: '1', quantityPrecision: 0, pricePrecision: 4, tradeMinQuantity: 2, tradeMinUSDT: 2, feeRate: 0.0005, makerFeeRate: 0.0002, takerFeeRate: 0.0005, status: 1, apiStateOpen: 'true', apiStateClose: 'true' },
      { contractId: '104', symbol: 'DOGE-USDT', size: '1', quantityPrecision: 0, pricePrecision: 5, tradeMinQuantity: 21, tradeMinUSDT: 2, feeRate: 0.0005, makerFeeRate: 0.0002, takerFeeRate: 0.0005, status: 1, apiStateOpen: 'true', apiStateClose: 'true' },
      { contractId: '105', symbol: 'BNB-USDT', size: '0.01', quantityPrecision: 2, pricePrecision: 2, tradeMinQuantity: 0.01, tradeMinUSDT: 2, feeRate: 0.0005, makerFeeRate: 0.0002, takerFeeRate: 0.0005, status: 1, apiStateOpen: 'true', apiStateClose: 'true' },
      { contractId: '106', symbol: 'XAUT-USDT', size: '0.000001', quantityPrecision: 6, pricePrecision: 2, tradeMinQuantity: 0.000481, tradeMinUSDT: 2, feeRate: 0.0005, makerFeeRate: 0.0002, takerFeeRate: 0.0005, status: 1, apiStateOpen: 'true', apiStateClose: 'true' },
    ];
  }

  return contractsCache;
}

/**
 * Returns contract specification for a given symbol.
 */
export async function getContractSpecForSymbol(symbol: string): Promise<BingXContractSpec | null> {
  const specs = await getBingXContractSpecs();
  const target = normalizeToBingXSymbol(symbol);
  return specs.find(s => s.symbol === target) || null;
}

/**
 * Position Sizing Engine with Small Account & Micro-Balance Validation
 * Evaluates whether an account (down to 0.50 USDT) can trade according to BingX real minimum rules.
 */
export async function calculateValidatedPositionSize(params: {
  symbol: string;
  availableBalance: number;
  price: number;
  leverage: number;
  requestedMargin: number;
}): Promise<PositionSizeResult> {
  const bingxSymbol = normalizeToBingXSymbol(params.symbol);
  const spec = await getContractSpecForSymbol(params.symbol);

  const price = params.price > 0 ? params.price : 100;
  const leverage = Math.max(1, params.leverage || 10);
  const availableBal = Math.max(0, params.availableBalance || 0);

  const minNotional = spec?.tradeMinUSDT ?? 2.0; // BingX standard minimum notional is 2 USDT
  const minQty = spec?.tradeMinQuantity ?? 0.001;
  const precision = spec?.quantityPrecision ?? 4;
  const feeRate = spec?.feeRate ?? 0.0005;

  // Minimum required margin for this leverage to reach tradeMinUSDT
  const requiredMarginForMinOrder = parseFloat((minNotional / leverage).toFixed(4));
  // Fee reserve (order fee buffer)
  const feeReserve = parseFloat((minNotional * feeRate * 2).toFixed(4));
  const totalMinCapitalNeeded = parseFloat((requiredMarginForMinOrder + feeReserve).toFixed(4));

  // Small Account Evaluation
  if (availableBal < totalMinCapitalNeeded) {
    const shortfall = parseFloat((totalMinCapitalNeeded - availableBal).toFixed(4));
    return {
      canTrade: false,
      symbol: params.symbol,
      bingxSymbol,
      currentPrice: price,
      leverage,
      requestedMargin: params.requestedMargin,
      availableBalance: availableBal,
      minNotionalUsdt: minNotional,
      minQuantity: minQty,
      requiredMarginForMinOrder,
      calculatedQuantity: 0,
      formattedQuantity: '0',
      calculatedNotionalUsdt: 0,
      shortfallUsdt: shortfall,
      estimatedFeeUsdt: 0,
      reason: 'INSUFFICIENT_BALANCE_FOR_MIN_ORDER',
      messageArabic: `الرصيد المتاح (${availableBal.toFixed(2)} USDT) غير كافٍ لتلبية الحد الأدنى لعقد ${params.symbol} على BingX (${minNotional} USDT برافعة ${leverage}x تتطلب هامش ${requiredMarginForMinOrder} USDT + رسوم). العجز: ${shortfall.toFixed(2)} USDT.`,
    };
  }

  // Determine actual margin to allocate
  let allocatedMargin = params.requestedMargin > 0 ? params.requestedMargin : requiredMarginForMinOrder;
  // If requested margin is less than required minimum for this leverage, raise to minimum
  if (allocatedMargin < requiredMarginForMinOrder) {
    allocatedMargin = requiredMarginForMinOrder;
  }
  // Cap at 98% of available balance to safeguard fees
  if (allocatedMargin > availableBal * 0.98) {
    allocatedMargin = parseFloat((availableBal * 0.98).toFixed(2));
  }

  const calculatedNotional = allocatedMargin * leverage;
  if (calculatedNotional < minNotional) {
    return {
      canTrade: false,
      symbol: params.symbol,
      bingxSymbol,
      currentPrice: price,
      leverage,
      requestedMargin: params.requestedMargin,
      availableBalance: availableBal,
      minNotionalUsdt: minNotional,
      minQuantity: minQty,
      requiredMarginForMinOrder,
      calculatedQuantity: 0,
      formattedQuantity: '0',
      calculatedNotionalUsdt: calculatedNotional,
      estimatedFeeUsdt: calculatedNotional * feeRate,
      reason: 'BELOW_MINIMUM_NOTIONAL',
      messageArabic: `حجم الصفقة الإجمالي (${calculatedNotional.toFixed(2)} USDT) أقل من الحد الأدنى للعقد (${minNotional} USDT). يرجى زيادة الهامش أو رفع الرافعة.`,
    };
  }

  // Calculate base coin quantity
  const rawQuantity = calculatedNotional / price;
  // Apply BingX precision formatting
  let formattedQtyStr: string;
  let finalQtyNum: number;

  if (precision === 0) {
    finalQtyNum = Math.max(minQty, Math.floor(rawQuantity));
    formattedQtyStr = String(finalQtyNum);
  } else {
    const factor = Math.pow(10, precision);
    finalQtyNum = Math.max(minQty, Math.floor(rawQuantity * factor) / factor);
    formattedQtyStr = finalQtyNum.toFixed(precision);
  }

  if (finalQtyNum < minQty) {
    return {
      canTrade: false,
      symbol: params.symbol,
      bingxSymbol,
      currentPrice: price,
      leverage,
      requestedMargin: params.requestedMargin,
      availableBalance: availableBal,
      minNotionalUsdt: minNotional,
      minQuantity: minQty,
      requiredMarginForMinOrder,
      calculatedQuantity: finalQtyNum,
      formattedQuantity: formattedQtyStr,
      calculatedNotionalUsdt: calculatedNotional,
      estimatedFeeUsdt: calculatedNotional * feeRate,
      reason: 'BELOW_MINIMUM_QUANTITY',
      messageArabic: `الكمية المحسوبة (${finalQtyNum}) أقل من الحد الأدنى للكمية المسموح بها على BingX (${minQty}).`,
    };
  }

  const finalNotional = finalQtyNum * price;
  const estimatedFee = finalNotional * feeRate;

  return {
    canTrade: true,
    symbol: params.symbol,
    bingxSymbol,
    currentPrice: price,
    leverage,
    requestedMargin: allocatedMargin,
    availableBalance: availableBal,
    minNotionalUsdt: minNotional,
    minQuantity: minQty,
    requiredMarginForMinOrder,
    calculatedQuantity: finalQtyNum,
    formattedQuantity: formattedQtyStr,
    calculatedNotionalUsdt: parseFloat(finalNotional.toFixed(2)),
    estimatedFeeUsdt: parseFloat(estimatedFee.toFixed(4)),
    messageArabic: `جاهز للتنفيذ الحقيقي: كمية ${formattedQtyStr} (${finalNotional.toFixed(2)} USDT) بهامش ${allocatedMargin.toFixed(2)} USDT`,
  };
}

/**
 * Duplicate Protection and Idempotency Guard
 * Verifies no duplicate order was submitted for the same symbol & side within 20 seconds.
 */
export function checkDuplicateOrder(symbol: string, side: string): { isDuplicate: boolean; remainingSeconds?: number } {
  const key = `${normalizeToBingXSymbol(symbol)}_${side.toUpperCase()}`;
  const now = Date.now();
  const existing = recentOrdersMap.get(key);

  if (existing && now - existing.timestamp < 20000) {
    const remaining = Math.ceil((20000 - (now - existing.timestamp)) / 1000);
    return { isDuplicate: true, remainingSeconds: remaining };
  }

  return { isDuplicate: false };
}

/**
 * Registers an executed order in the idempotency cache.
 */
export function recordOrderInDuplicateCache(symbol: string, side: string, clientOrderId: string) {
  const key = `${normalizeToBingXSymbol(symbol)}_${side.toUpperCase()}`;
  recentOrdersMap.set(key, {
    symbol: normalizeToBingXSymbol(symbol),
    side: side.toUpperCase(),
    timestamp: Date.now(),
    clientOrderId,
  });
}

/**
 * Emergency Stop Controller (Backend-Enforced)
 */
export function setEmergencyStop(active: boolean, reason?: string) {
  isEmergencyStopActive = active;
  if (active) {
    emergencyStopReason = reason || 'تم تفعيل التوقف الفوري للطوارئ بواسطة المستخدم';
    emergencyStopTimestamp = new Date().toISOString();
  } else {
    emergencyStopReason = '';
    emergencyStopTimestamp = null;
  }
}

export function getEmergencyStopStatus(): { active: boolean; reason: string; timestamp: string | null } {
  return {
    active: isEmergencyStopActive,
    reason: emergencyStopReason,
    timestamp: emergencyStopTimestamp,
  };
}

/**
 * Execution Logs Controller
 */
export function logExecutionEntry(entry: Omit<ExecutionLogEntry, 'id'>): ExecutionLogEntry {
  const fullEntry: ExecutionLogEntry = {
    ...entry,
    id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  executionLogs.unshift(fullEntry);
  if (executionLogs.length > 200) {
    executionLogs.pop();
  }
  return fullEntry;
}

export function getExecutionLogs(): ExecutionLogEntry[] {
  return executionLogs;
}

/**
 * Query Order Status directly from BingX Swap API
 */
export async function queryBingXOrderStatus(params: {
  symbol: string;
  orderId?: string;
  clientOrderId?: string;
  apiKey: string;
  secretKey: string;
}): Promise<{ success: boolean; data?: any; rawCode?: number; error?: string }> {
  try {
    const timestamp = Date.now();
    const queryParams: Record<string, any> = {
      symbol: normalizeToBingXSymbol(params.symbol),
      timestamp,
    };
    if (params.orderId) queryParams.orderId = params.orderId;
    if (params.clientOrderId) queryParams.clientOrderID = params.clientOrderId;

    const { fullQuery } = buildBingXSignedQuery(queryParams, params.secretKey);
    const url = `https://open-api.bingx.com/openApi/swap/v2/trade/order?${fullQuery}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-BX-APIKEY': params.apiKey.trim(),
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && json.data) {
        return { success: true, data: json.data?.order || json.data };
      }
      return { success: false, rawCode: json.code, error: json.msg };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify Position Exists on BingX Swap
 */
export async function verifyBingXPositionActive(params: {
  symbol: string;
  expectedSide: 'LONG' | 'SHORT';
  apiKey: string;
  secretKey: string;
}): Promise<{
  verified: boolean;
  position?: any;
  entryPrice?: number;
  contractQuantity?: number;
  markPrice?: number;
  leverage?: number;
  pnl?: number;
  error?: string;
}> {
  try {
    const bingxSymbol = normalizeToBingXSymbol(params.symbol);
    const timestamp = Date.now();
    const { fullQuery } = buildBingXSignedQuery({ symbol: bingxSymbol, timestamp }, params.secretKey);
    const url = `https://open-api.bingx.com/openApi/swap/v2/user/positions?${fullQuery}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-BX-APIKEY': params.apiKey.trim(),
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.code === 0 && Array.isArray(json.data)) {
        const match = json.data.find((p: any) => {
          const amt = Math.abs(parseFloat(String(p.positionAmt || '0')));
          if (amt <= 0) return false;
          const posSide = (p.positionSide === 'SHORT' || parseFloat(String(p.positionAmt)) < 0) ? 'SHORT' : 'LONG';
          return posSide === params.expectedSide;
        });

        if (match) {
          const amt = Math.abs(parseFloat(String(match.positionAmt || '0')));
          const entry = parseFloat(String(match.entryPrice || match.avgPrice || '0'));
          const mark = parseFloat(String(match.markPrice || '0'));
          const lev = Number(match.leverage) || 10;
          const pnl = parseFloat(String(match.unrealizedProfit || '0'));

          return {
            verified: true,
            position: match,
            entryPrice: entry,
            contractQuantity: amt,
            markPrice: mark,
            leverage: lev,
            pnl,
          };
        }
      }
    }
  } catch (err: any) {
    return { verified: false, error: err.message };
  }

  return { verified: false };
}

/**
 * Places Stop Loss / Take Profit protection trigger orders on BingX Swap
 */
export async function placeBingXProtectionTriggerOrders(params: {
  symbol: string;
  positionSide: 'LONG' | 'SHORT';
  quantity: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  apiKey: string;
  secretKey: string;
}): Promise<{ slPlaced: boolean; tpPlaced: boolean; details: string }> {
  const bingxSymbol = normalizeToBingXSymbol(params.symbol);
  const closeSide = params.positionSide === 'LONG' ? 'SELL' : 'BUY';
  let slPlaced = false;
  let tpPlaced = false;
  const messages: string[] = [];

  // 1. Submit Take Profit Trigger Order
  if (params.takeProfitPrice && params.takeProfitPrice > 0) {
    try {
      const timestamp = Date.now();
      const tpQuery = {
        symbol: bingxSymbol,
        side: closeSide,
        positionSide: params.positionSide,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: params.takeProfitPrice,
        quantity: params.quantity,
        timestamp,
      };
      const { fullQuery } = buildBingXSignedQuery(tpQuery, params.secretKey);
      const res = await fetch(`https://open-api.bingx.com/openApi/swap/v2/trade/order?${fullQuery}`, {
        method: 'POST',
        headers: {
          'X-BX-APIKEY': params.apiKey.trim(),
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(5000),
      });
      const json = await res.json();
      if (json.code === 0) {
        tpPlaced = true;
        messages.push(`TP مؤكد على $${params.takeProfitPrice}`);
      }
    } catch {}
  }

  // 2. Submit Stop Loss Trigger Order
  if (params.stopLossPrice && params.stopLossPrice > 0) {
    try {
      const timestamp = Date.now();
      const slQuery = {
        symbol: bingxSymbol,
        side: closeSide,
        positionSide: params.positionSide,
        type: 'STOP_MARKET',
        stopPrice: params.stopLossPrice,
        quantity: params.quantity,
        timestamp,
      };
      const { fullQuery } = buildBingXSignedQuery(slQuery, params.secretKey);
      const res = await fetch(`https://open-api.bingx.com/openApi/swap/v2/trade/order?${fullQuery}`, {
        method: 'POST',
        headers: {
          'X-BX-APIKEY': params.apiKey.trim(),
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(5000),
      });
      const json = await res.json();
      if (json.code === 0) {
        slPlaced = true;
        messages.push(`SL مؤكد على $${params.stopLossPrice}`);
      }
    } catch {}
  }

  return {
    slPlaced,
    tpPlaced,
    details: messages.join(' | ') || 'لم يتم تأكيد أوامر الحماية الإضافية',
  };
}

/**
 * Translates BingX API error codes into precise, helpful Arabic descriptions
 */
export function translateBingXErrorCode(code: number, rawMsg?: string): string {
  switch (code) {
    case 100001:
      return 'توقيع API غير صالح (Signature Mismatch) - تأكد من دقة Secret Key ومطابقة التوقيت';
    case 100204:
      return 'الرصيد في محفظة العقود الآجلة غير كافٍ لتغطية الهامش المطلوب للصفقة';
    case 100400:
      return 'مفتاح API ينقصه تصريح تداول العقود (Futures Trading Permission)';
    case 100410:
      return 'مفتاح API غير صالح أو تم حذفه من حساب BingX';
    case 100412:
      return 'عنوان IP غير مصرح في القائمة البيضاء (IP Whitelist) لحساب BingX';
    case 100413:
      return 'مفتاح API غير معترف به على خوادم BingX';
    case 100414:
      return 'رمز الزوج غير مدعوم في سوق العقود الدائمة';
    case 100421:
      return 'حجم الطلب أقل من الحد الأدنى المسموح به لهذا العقد';
    case 100500:
    case 109400:
      return 'تعارض في وضعية التحوط (Hedge Mode / One-Way Mode)';
    case 100440:
      return 'سعر الأمر يتجاوز نطاق الحماية من الانزلاق السعري';
    default:
      return rawMsg || `خطأ من خادم BingX (كود: ${code})`;
  }
}
