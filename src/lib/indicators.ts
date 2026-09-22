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
