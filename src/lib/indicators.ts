import type { KlineBar } from '../components/TradingChart.tsx';

export interface IndicatorData {
  ema20: (number | null)[];
  ema50: (number | null)[];
  sma200: (number | null)[];
  bollingerBands: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  };
  rsi: (number | null)[];
  macd: {
    macdLine: (number | null)[];
    signalLine: (number | null)[];
    histogram: (number | null)[];
  };
  opportunities: TradingOpportunity[];
}

export interface TradingOpportunity {
  index: number;
  time: number;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signal: string;
  reason: string;
  confidence: number;
  price: number;
}

// 1. Exponential Moving Average (EMA)
export function calculateEMA(prices: number[], period: number): (number | null)[] {
  if (prices.length < period) return prices.map(() => null);
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  
  // Seed with SMA
  const initialSum = prices.slice(0, period).reduce((acc, val) => acc + val, 0);
  let currentEma = initialSum / period;

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      result.push(currentEma);
    } else {
      currentEma = prices[i] * k + currentEma * (1 - k);
      result.push(currentEma);
    }
  }
  return result;
}

// 2. Simple Moving Average (SMA)
export function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, val) => acc + val, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// 3. Bollinger Bands (20 period, 2 StdDev)
export function calculateBollingerBands(prices: number[], period = 20, multiplier = 2): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = calculateSMA(prices, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < prices.length; i++) {
    const mid = middle[i];
    if (mid === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - mid, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(mid + multiplier * stdDev);
      lower.push(mid - multiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}

// 4. Relative Strength Index (RSI, 14)
export function calculateRSI(prices: number[], period = 14): (number | null)[] {
  if (prices.length <= period) return prices.map(() => null);
  const result: (number | null)[] = [null]; // first candle has no delta

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(...Array(period - 1).fill(null));
  result.push(100 - (100 / (1 + rs)));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - (100 / (1 + rs)));
  }

  return result;
}

// 5. Moving Average Convergence Divergence (MACD 12, 26, 9)
export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const macdLine: (number | null)[] = [];
  const validMacdValues: number[] = [];
  const validMacdIndices: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    const fast = fastEMA[i];
    const slow = slowEMA[i];
    if (fast !== null && slow !== null) {
      const val = fast - slow;
      macdLine.push(val);
      validMacdValues.push(val);
      validMacdIndices.push(i);
    } else {
      macdLine.push(null);
    }
  }

  // Calculate signal line over valid MACD values
  const rawSignal = calculateEMA(validMacdValues, signalPeriod);
  const signalLine: (number | null)[] = Array(prices.length).fill(null);
  const histogram: (number | null)[] = Array(prices.length).fill(null);

  validMacdIndices.forEach((origIndex, idx) => {
    const sigVal = rawSignal[idx];
    signalLine[origIndex] = sigVal;
    if (sigVal !== null && macdLine[origIndex] !== null) {
      histogram[origIndex] = macdLine[origIndex]! - sigVal;
    }
  });

  return { macdLine, signalLine, histogram };
}

// 6. Technical Opportunity Scanner
export function detectTradingOpportunities(
  klines: KlineBar[],
  ema20: (number | null)[],
  ema50: (number | null)[],
  rsi: (number | null)[],
  macd: { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] },
  bb: { upper: (number | null)[]; lower: (number | null)[] }
): TradingOpportunity[] {
  const opportunities: TradingOpportunity[] = [];
  const len = klines.length;
  if (len < 5) return opportunities;

  for (let i = 20; i < len; i++) {
    const kline = klines[i];
    const prevKline = klines[i - 1];
    const currentRsi = rsi[i];
    const prevRsi = rsi[i - 1];
    const currentEma20 = ema20[i];
    const currentEma50 = ema50[i];
    const prevEma20 = ema20[i - 1];
    const prevEma50 = ema50[i - 1];
    const currentHist = macd.histogram[i];
    const prevHist = macd.histogram[i - 1];
    const lowerBb = bb.lower[i];
    const upperBb = bb.upper[i];

    // Check EMA 20/50 Golden Cross
    if (
      prevEma20 !== null &&
      prevEma50 !== null &&
      currentEma20 !== null &&
      currentEma50 !== null
    ) {
      if (prevEma20 <= prevEma50 && currentEma20 > currentEma50) {
        opportunities.push({
          index: i,
          time: kline.time,
          type: 'BULLISH',
          signal: 'تقاطع ذهبي (EMA 20/50 Cross)',
          reason: 'تقاطع المتوسط المتحرك 20 صعوداً فوق 50 مشيراً لبداية زخم صاعد قوي',
          confidence: 84,
          price: kline.close,
        });
        continue;
      }
      if (prevEma20 >= prevEma50 && currentEma20 < currentEma50) {
        opportunities.push({
          index: i,
          time: kline.time,
          type: 'BEARISH',
          signal: 'تقاطع الموت (EMA 20/50 Bear Cross)',
          reason: 'تقاطع المتوسط 20 هبوطاً أسفل 50 مؤكداً ضغط بيعي',
          confidence: 82,
          price: kline.close,
        });
        continue;
      }
    }

    // Check RSI Oversold bounce (Bullish)
    if (prevRsi !== null && currentRsi !== null) {
      if (prevRsi < 30 && currentRsi >= 30) {
        opportunities.push({
          index: i,
          time: kline.time,
          type: 'BULLISH',
          signal: 'ارتداد ذروة البيع (RSI Oversold Rebound)',
          reason: `خروج مؤشر القوة النسبية من منطقة التشبع البيعي عند ${currentRsi.toFixed(1)}`,
          confidence: 79,
          price: kline.close,
        });
        continue;
      }
      // RSI Overbought rejection (Bearish)
      if (prevRsi > 70 && currentRsi <= 70) {
        opportunities.push({
          index: i,
          time: kline.time,
          type: 'BEARISH',
          signal: 'هبوط من ذروة الشراء (RSI Overbought Pullback)',
          reason: `كسر مؤشر RSI مستوى 70 هبوطاً عند ${currentRsi.toFixed(1)}`,
          confidence: 78,
          price: kline.close,
        });
        continue;
      }
    }

    // Check MACD Histogram Bullish Reversal
    if (prevHist !== null && currentHist !== null) {
      if (prevHist < 0 && currentHist >= 0) {
        opportunities.push({
          index: i,
          time: kline.time,
          type: 'BULLISH',
          signal: 'انعكاس عزم MACD (Histogram Bullish Shift)',
          reason: 'تحول هيستوجرام الماكد من النطاق السالب إلى الموجب',
          confidence: 76,
          price: kline.close,
        });
        continue;
      }
      if (prevHist > 0 && currentHist <= 0) {
        opportunities.push({
          index: i,
          time: kline.time,
          type: 'BEARISH',
          signal: 'ضعف عزم MACD (Histogram Bearish Shift)',
          reason: 'تحول هيستوجرام الماكد للنطاق السالب أسفل خط الصفر',
          confidence: 75,
          price: kline.close,
        });
        continue;
      }
    }

    // Bollinger Band Squeeze / Rebound
    if (lowerBb !== null && kline.low <= lowerBb && kline.close > kline.open) {
      opportunities.push({
        index: i,
        time: kline.time,
        type: 'BULLISH',
        signal: 'ارتداد من قاع بولينجر (Bollinger Lower Bounce)',
        reason: 'ملامسة الحد السفلي لمؤشر بولينجر باند مع ظهور شمعة انعكاسية صاعدة',
        confidence: 77,
        price: kline.close,
      });
      continue;
    }
  }

  return opportunities;
}

// 7. Dynamic Support and Resistance Detection
export interface SupportResistanceLevels {
  supports: number[];
  resistances: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
}

export function calculateSupportResistance(klines: KlineBar[], currentPrice?: number): SupportResistanceLevels {
  if (klines.length < 10) {
    const p = currentPrice || (klines.length ? klines[klines.length - 1].close : 65000);
    return {
      supports: [Number((p * 0.985).toFixed(2)), Number((p * 0.965).toFixed(2))],
      resistances: [Number((p * 1.018).toFixed(2)), Number((p * 1.038).toFixed(2))],
      nearestSupport: Number((p * 0.985).toFixed(2)),
      nearestResistance: Number((p * 1.018).toFixed(2)),
    };
  }

  const price = currentPrice || klines[klines.length - 1].close;
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  // Look for pivot highs and pivot lows (window of 2 on each side)
  for (let i = 2; i < klines.length - 2; i++) {
    const c = klines[i];
    const isPivotHigh =
      c.high >= klines[i - 1].high &&
      c.high >= klines[i - 2].high &&
      c.high >= klines[i + 1].high &&
      c.high >= klines[i + 2].high;

    const isPivotLow =
      c.low <= klines[i - 1].low &&
      c.low <= klines[i - 2].low &&
      c.low <= klines[i + 1].low &&
      c.low <= klines[i + 2].low;

    if (isPivotHigh) swingHighs.push(c.high);
    if (isPivotLow) swingLows.push(c.low);
  }

  // Cluster and filter levels within 0.4% tolerance
  const clusterLevels = (levels: number[]) => {
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[] = [];
    for (const lvl of sorted) {
      if (!clusters.length) {
        clusters.push(lvl);
      } else {
        const last = clusters[clusters.length - 1];
        if (Math.abs(lvl - last) / last < 0.005) {
          clusters[clusters.length - 1] = Number(((last + lvl) / 2).toFixed(2));
        } else {
          clusters.push(Number(lvl.toFixed(2)));
        }
      }
    }
    return clusters;
  };

  const allResistances = clusterLevels(swingHighs).filter(h => h > price * 1.002);
  const allSupports = clusterLevels(swingLows).filter(l => l < price * 0.998).reverse();

  const finalResistances = allResistances.length ? allResistances.slice(0, 3) : [Number((price * 1.018).toFixed(2)), Number((price * 1.035).toFixed(2))];
  const finalSupports = allSupports.length ? allSupports.slice(0, 3) : [Number((price * 0.982).toFixed(2)), Number((price * 0.965).toFixed(2))];

  return {
    supports: finalSupports,
    resistances: finalResistances,
    nearestSupport: finalSupports[0] || null,
    nearestResistance: finalResistances[0] || null,
  };
}

// 8. Candlestick Pattern Recognition Engine
export interface CandlestickPattern {
  name: string;
  nameArabic: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  candleIndex: number;
}

export function detectCandlestickPatterns(klines: KlineBar[]): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];
  if (klines.length < 3) return patterns;

  const len = klines.length;
  // Inspect last 3 candles
  for (let i = Math.max(1, len - 3); i < len; i++) {
    const curr = klines[i];
    const prev = klines[i - 1];

    const body = Math.abs(curr.close - curr.open);
    const totalRange = curr.high - curr.low;
    if (totalRange <= 0) continue;

    const isBullish = curr.close >= curr.open;
    const upperWick = curr.high - Math.max(curr.close, curr.open);
    const lowerWick = Math.min(curr.close, curr.open) - curr.low;

    // 1. Hammer / Pin Bar (Bullish rejection at bottom)
    if (lowerWick >= body * 2 && upperWick <= body * 0.5 && lowerWick / totalRange >= 0.55) {
      patterns.push({
        name: 'Hammer / Bullish Pin Bar',
        nameArabic: 'شمعة المطرقة الانعكاسية (Bullish Pin Bar)',
        type: 'BULLISH',
        significance: 'HIGH',
        description: 'ذيل سفلي طويل يعكس رفضاً قوياً لأسعار الهبوط وتدخل مشتري السيولة',
        candleIndex: i,
      });
    }

    // 2. Shooting Star / Bearish Pin Bar (Rejection at top)
    if (upperWick >= body * 2 && lowerWick <= body * 0.5 && upperWick / totalRange >= 0.55) {
      patterns.push({
        name: 'Shooting Star / Bearish Pin Bar',
        nameArabic: 'شمعة الشهاب الساقط (Shooting Star)',
        type: 'BEARISH',
        significance: 'HIGH',
        description: 'ذيل علوي طويل يظهر رفضاً لمستويات المقاومة وضغطاً بيانياً عاجلاً',
        candleIndex: i,
      });
    }

    // 3. Bullish Engulfing
    if (
      prev.close < prev.open && // prev was red
      isBullish &&              // curr is green
      curr.open <= prev.close &&
      curr.close >= prev.open &&
      body > Math.abs(prev.close - prev.open)
    ) {
      patterns.push({
        name: 'Bullish Engulfing',
        nameArabic: 'شمعة ابتلاعية شرائية (Bullish Engulfing)',
        type: 'BULLISH',
        significance: 'HIGH',
        description: 'شمعة صاعدة تبتلع بالكامل جسم الشمعة السابقة مشيرة لتحول زخم السيطرة للثيران',
        candleIndex: i,
      });
    }

    // 4. Bearish Engulfing
    if (
      prev.close > prev.open && // prev was green
      !isBullish &&             // curr is red
      curr.open >= prev.close &&
      curr.close <= prev.open &&
      body > Math.abs(prev.close - prev.open)
    ) {
      patterns.push({
        name: 'Bearish Engulfing',
        nameArabic: 'شمعة ابتلاعية بيعية (Bearish Engulfing)',
        type: 'BEARISH',
        significance: 'HIGH',
        description: 'شمعة هابطة تبتلع الشمعة السابقة دلالة على هيمنة الدببة وكسر المسار',
        candleIndex: i,
      });
    }

    // 5. Doji (Indecision)
    if (body / totalRange <= 0.1) {
      patterns.push({
        name: 'Doji',
        nameArabic: 'شمعة دوجي المحايدة (Doji Indecision)',
        type: 'NEUTRAL',
        significance: 'MEDIUM',
        description: 'تساوي قوى الشراء والبيع وترقب كسر انفجاري قادم',
        candleIndex: i,
      });
    }
  }

  return patterns;
}

// 9. Comprehensive Technical & Candlestick Summary for Bots & AI
export interface FullTechnicalSummary {
  currentPrice: number;
  ema20: number | null;
  ema50: number | null;
  sma200: number | null;
  emaAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi14: number | null;
  rsiState: 'OVERSOLD' | 'OVERBOUGHT' | 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'NEUTRAL';
  macd: {
    macdLine: number | null;
    signalLine: number | null;
    histogram: number | null;
    trend: 'BULLISH' | 'BEARISH' | 'EXPANDING';
  };
  supportResistance: SupportResistanceLevels;
  candlestickPatterns: CandlestickPattern[];
  predictedPriceTarget: number;
  predictedStopLoss: number;
  predictedTakeProfit: number;
  directionalBias: 'LONG' | 'SHORT' | 'WAIT';
  confidenceScore: number;
}

export function getFullTechnicalSummary(klines: KlineBar[], pair = 'BTC-USDT'): FullTechnicalSummary {
  const prices = klines.map(k => k.close);
  const currentPrice = prices.length ? prices[prices.length - 1] : 65000;

  const ema20Arr = calculateEMA(prices, 20);
  const ema50Arr = calculateEMA(prices, 50);
  const sma200Arr = calculateSMA(prices, Math.min(200, Math.max(50, prices.length)));
  const rsiArr = calculateRSI(prices, 14);
  const macdObj = calculateMACD(prices, 12, 26, 9);

  const lastIdx = prices.length - 1;
  const ema20 = lastIdx >= 0 ? ema20Arr[lastIdx] : null;
  const ema50 = lastIdx >= 0 ? ema50Arr[lastIdx] : null;
  const sma200 = lastIdx >= 0 ? sma200Arr[lastIdx] : null;
  const rsi14 = lastIdx >= 0 && rsiArr[lastIdx] !== null ? Number(rsiArr[lastIdx]?.toFixed(1)) : 50;

  const macdLine = lastIdx >= 0 && macdObj.macdLine[lastIdx] !== null ? Number(macdObj.macdLine[lastIdx]?.toFixed(2)) : 0;
  const signalLine = lastIdx >= 0 && macdObj.signalLine[lastIdx] !== null ? Number(macdObj.signalLine[lastIdx]?.toFixed(2)) : 0;
  const histogram = lastIdx >= 0 && macdObj.histogram[lastIdx] !== null ? Number(macdObj.histogram[lastIdx]?.toFixed(2)) : 0;

  // EMA Alignment
  let emaAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (ema20 && ema50) {
    if (ema20 > ema50 && currentPrice > ema20) emaAlignment = 'BULLISH';
    else if (ema20 < ema50 && currentPrice < ema20) emaAlignment = 'BEARISH';
  }

  // RSI State
  let rsiState: 'OVERSOLD' | 'OVERBOUGHT' | 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'NEUTRAL' = 'NEUTRAL';
  if (rsi14 < 32) rsiState = 'OVERSOLD';
  else if (rsi14 > 68) rsiState = 'OVERBOUGHT';
  else if (rsi14 >= 52) rsiState = 'BULLISH_MOMENTUM';
  else if (rsi14 <= 48) rsiState = 'BEARISH_MOMENTUM';

  // MACD Trend
  const macdTrend = histogram > 0 ? (macdLine > signalLine ? 'BULLISH' : 'EXPANDING') : 'BEARISH';

  // Support & Resistance
  const supportResistance = calculateSupportResistance(klines, currentPrice);

  // Candlestick Patterns
  const candlestickPatterns = detectCandlestickPatterns(klines);

  // Directional Bias Synthesis
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (emaAlignment === 'BULLISH') bullishPoints += 30;
  if (emaAlignment === 'BEARISH') bearishPoints += 30;

  if (rsiState === 'BULLISH_MOMENTUM' || rsiState === 'OVERSOLD') bullishPoints += 25;
  if (rsiState === 'BEARISH_MOMENTUM' || rsiState === 'OVERBOUGHT') bearishPoints += 25;

  if (macdTrend === 'BULLISH') bullishPoints += 25;
  if (macdTrend === 'BEARISH') bearishPoints += 25;

  for (const p of candlestickPatterns) {
    if (p.type === 'BULLISH') bullishPoints += 20;
    if (p.type === 'BEARISH') bearishPoints += 20;
  }

  const isGold = pair.includes('XAU') || pair.includes('GOLD');
  const slPct = isGold ? 0.012 : 0.018;
  const tpPct = isGold ? 0.032 : 0.045;

  let directionalBias: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT';
  let confidenceScore = 75;

  if (bullishPoints >= bearishPoints + 15) {
    directionalBias = 'LONG';
    confidenceScore = Math.min(94, 76 + Math.round((bullishPoints - bearishPoints) / 5));
  } else if (bearishPoints >= bullishPoints + 15) {
    directionalBias = 'SHORT';
    confidenceScore = Math.min(94, 76 + Math.round((bearishPoints - bullishPoints) / 5));
  } else {
    directionalBias = bullishPoints > bearishPoints ? 'LONG' : 'SHORT';
    confidenceScore = 80;
  }

  const isLong = directionalBias === 'LONG';
  const predictedStopLoss = Number((isLong ? currentPrice * (1 - slPct) : currentPrice * (1 + slPct)).toFixed(2));
  const predictedTakeProfit = Number((isLong ? currentPrice * (1 + tpPct) : currentPrice * (1 - tpPct)).toFixed(2));
  const predictedPriceTarget = predictedTakeProfit;

  return {
    currentPrice,
    ema20: ema20 !== null ? Number(ema20.toFixed(2)) : null,
    ema50: ema50 !== null ? Number(ema50.toFixed(2)) : null,
    sma200: sma200 !== null ? Number(sma200.toFixed(2)) : null,
    emaAlignment,
    rsi14,
    rsiState,
    macd: {
      macdLine,
      signalLine,
      histogram,
      trend: macdTrend,
    },
    supportResistance,
    candlestickPatterns,
    predictedPriceTarget,
    predictedStopLoss,
    predictedTakeProfit,
    directionalBias,
    confidenceScore,
  };
}

// 10. Average True Range (ATR) & Volatility Spike Engine
export function calculateATR(klines: KlineBar[], period = 14): (number | null)[] {
  if (klines.length === 0) return [];
  const trList: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    const curr = klines[i];
    if (i === 0) {
      trList.push(curr.high - curr.low);
    } else {
      const prev = klines[i - 1];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      trList.push(tr);
    }
  }

  // Calculate smoothed moving average of TR
  const atr: (number | null)[] = [];
  let sum = 0;

  for (let i = 0; i < trList.length; i++) {
    if (i < period - 1) {
      sum += trList[i];
      atr.push(null);
    } else if (i === period - 1) {
      sum += trList[i];
      atr.push(sum / period);
    } else {
      const prevAtr = atr[i - 1]!;
      const currentAtr = (prevAtr * (period - 1) + trList[i]) / period;
      atr.push(currentAtr);
    }
  }

  return atr;
}

export interface VolatilitySpike {
  candleIndex: number;
  time: number;
  pair?: string;
  type: 'BULLISH_SPIKE' | 'BEARISH_SPIKE' | 'VOLATILITY_EXPANSION';
  severity: 'EXTREME' | 'HIGH' | 'ELEVATED';
  range: number;
  atr: number;
  spikeRatio: number; // e.g. 2.5x ATR
  priceChangePct: number;
  candle: KlineBar;
  color: string;
  glowColor: string;
  badgeLabel: string;
  titleArabic: string;
  messageArabic: string;
  actionTipArabic: string;
}

export function detectVolatilitySpikes(
  klines: KlineBar[],
  options?: {
    sensitivity?: 'SENSITIVE' | 'NORMAL' | 'EXTREME';
    atrPeriod?: number;
    pair?: string;
  }
): VolatilitySpike[] {
  const spikes: VolatilitySpike[] = [];
  if (klines.length < 5) return spikes;

  const sensitivity = options?.sensitivity || 'NORMAL';
  const atrPeriod = options?.atrPeriod || 14;
  const pair = options?.pair || 'BTC-USDT';
  const atrValues = calculateATR(klines, atrPeriod);

  // Multiplier thresholds based on sensitivity
  let multThreshold = 1.9;
  let pctThreshold = 1.4;

  if (sensitivity === 'SENSITIVE') {
    multThreshold = 1.5;
    pctThreshold = 1.0;
  } else if (sensitivity === 'EXTREME') {
    multThreshold = 2.6;
    pctThreshold = 2.5;
  }

  // For gold (XAU), price change % is naturally lower than crypto
  if (pair.includes('XAU') || pair.includes('GOLD')) {
    pctThreshold *= 0.55;
  }

  for (let i = Math.max(1, atrPeriod); i < klines.length; i++) {
    const candle = klines[i];
    const prevCandle = klines[i - 1];
    const currentAtr = atrValues[i] || atrValues[i - 1] || ((candle.high - candle.low) * 0.8);
    const range = candle.high - candle.low;
    const body = Math.abs(candle.close - candle.open);
    const priceChangePct = ((candle.close - prevCandle.close) / prevCandle.close) * 100;
    const absChangePct = Math.abs(priceChangePct);

    const spikeRatio = currentAtr > 0 ? range / currentAtr : 1;

    // A spike occurs when candle range is >= multThreshold * ATR OR price change % exceeds threshold
    const isSpike = (currentAtr > 0 && spikeRatio >= multThreshold) || absChangePct >= pctThreshold;

    if (isSpike) {
      const isBullish = candle.close >= candle.open && priceChangePct >= 0;
      const isBearish = candle.close < candle.open && priceChangePct < 0;

      let type: 'BULLISH_SPIKE' | 'BEARISH_SPIKE' | 'VOLATILITY_EXPANSION' = 'VOLATILITY_EXPANSION';
      if (isBullish) type = 'BULLISH_SPIKE';
      else if (isBearish) type = 'BEARISH_SPIKE';

      let severity: 'EXTREME' | 'HIGH' | 'ELEVATED' = 'ELEVATED';
      if (spikeRatio >= 2.8 || absChangePct >= 3.0) {
        severity = 'EXTREME';
      } else if (spikeRatio >= 2.1 || absChangePct >= 1.8) {
        severity = 'HIGH';
      }

      let color = '#f59e0b'; // Amber
      let glowColor = 'rgba(245, 158, 11, 0.7)';
      let badgeLabel = `⚡ ${absChangePct.toFixed(1)}%`;
      let titleArabic = 'توسع نطاق تذبذب حاد (Volatility Expansion)';
      let messageArabic = `شمعة تذبذب واسعة تجاوزت نطاق ATR بمقدار ${spikeRatio.toFixed(1)}x مع حركة سريعة بنسبة ${priceChangePct > 0 ? '+' : ''}${priceChangePct.toFixed(2)}%.`;
      let actionTipArabic = 'احذر من تصفية السيولة واصطياد وقوف الخسارة على الجانبين.';

      if (type === 'BULLISH_SPIKE') {
        color = '#00ff9d'; // Vivid Electric Neon Emerald
        glowColor = 'rgba(0, 255, 157, 0.75)';
        badgeLabel = `🚀 +${absChangePct.toFixed(1)}%`;
        titleArabic = severity === 'EXTREME' ? '🚨 انفجار سعري صعودي فائق (Extreme Pump Surge)' : '⚡ طفرة صعودية مفاجئة (Bullish Volatility Spike)';
        messageArabic = `صعود سعري انفجاري بنسبة +${priceChangePct.toFixed(2)}% يتجاوز متوسط تقلبات السوق بـ ${spikeRatio.toFixed(1)}x ضعفاً.`;
        actionTipArabic = 'تجنب الشراء المطارد في القمة (FOMO)؛ انتظر إعادة اختبار مناطق الدعم وكتل الطلب.';
      } else if (type === 'BEARISH_SPIKE') {
        color = '#ff0055'; // Vivid Electric Neon Crimson
        glowColor = 'rgba(255, 0, 85, 0.75)';
        badgeLabel = `💥 -${absChangePct.toFixed(1)}%`;
        titleArabic = severity === 'EXTREME' ? '🚨 هبوط سعري حاد فائق (Flash Dump Spike)' : '⚡ انخفاض بيعي مفاجئ (Bearish Volatility Spike)';
        messageArabic = `انخفاض سعري حاد ومفاجئ بنسبة ${priceChangePct.toFixed(2)}% بحجم تداول وتذبذب يفوق الـ ATR بـ ${spikeRatio.toFixed(1)}x.`;
        actionTipArabic = 'تحقق من تفعيل أمر وقف الخسارة وتجنب محاولة التقاط السكين الساقط دون ارتداد مؤكد.';
      }

      spikes.push({
        candleIndex: i,
        time: candle.time,
        pair,
        type,
        severity,
        range,
        atr: currentAtr,
        spikeRatio,
        priceChangePct,
        candle,
        color,
        glowColor,
        badgeLabel,
        titleArabic,
        messageArabic,
        actionTipArabic,
      });
    }
  }

  return spikes;
}

