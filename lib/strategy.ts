import type { DailyCandle } from "./db";

export type SSTStatus = "NEUTRAL" | "TRACKING" | "BUY_TRIGGERED";

export interface SSTAnalysis {
    symbol: string;
    status: SSTStatus;
    currentPrice: number;
    twentyDayHigh: number;
    twentyDayLow: number;
    triggerDate?: string; // Date when it became TRACKING
    buyTriggerDate?: string; // Date when BUY was triggered
    distanceToTrigger: number; // % distance from current price to 20d high
}

/**
 * Analyze a stock for SST signals.
 * @param symbol - Stock symbol
 * @param candles - Daily candles, sorted by date ASCENDING (oldest first)
 * @returns SSTAnalysis object
 */
export function analyzeStock(symbol: string, candles: DailyCandle[]): SSTAnalysis | null {
    if (candles.length < 21) {
        // Need at least 21 days of data
        return null;
    }

    // Latest candle is the current day
    const latest = candles[candles.length - 1];
    // Previous 20 candles (excluding latest) for 20d High/Low calculation
    const lookbackCandles = candles.slice(-21, -1);

    const twentyDayHigh = Math.max(...lookbackCandles.map((c) => c.high));
    const twentyDayLow = Math.min(...lookbackCandles.map((c) => c.low));

    const currentPrice = latest.close;
    const distanceToTrigger = ((twentyDayHigh - currentPrice) / currentPrice) * 100;

    // Determine status
    let status: SSTStatus = "NEUTRAL";
    let triggerDate: string | undefined;
    let buyTriggerDate: string | undefined;

    // Scan history to determine current state
    // We need to track if at some point the stock touched 20d low (became TRACKING)
    // and if it then crossed 20d high (BUY_TRIGGERED)

    let isTracking = false;
    for (let i = 20; i < candles.length; i++) {
        const day = candles[i];
        const prev20 = candles.slice(i - 20, i);
        const dayTwentyDayHigh = Math.max(...prev20.map((c) => c.high));
        const dayTwentyDayLow = Math.min(...prev20.map((c) => c.low));

        if (!isTracking) {
            // Check if stock touched or went below 20d low
            if (day.low <= dayTwentyDayLow) {
                isTracking = true;
                triggerDate = day.date;
                status = "TRACKING";
            }
        } else {
            // Stock is in tracking mode, check for buy trigger
            if (day.high > dayTwentyDayHigh) {
                status = "BUY_TRIGGERED";
                buyTriggerDate = day.date;
                // Reset tracking after buy trigger
                isTracking = false;
            }
            // Also reset if it makes a new 20d low again while tracking (re-track)
            if (day.low <= dayTwentyDayLow) {
                triggerDate = day.date;
                status = "TRACKING";
            }
        }
    }

    return {
        symbol,
        status,
        currentPrice,
        twentyDayHigh,
        twentyDayLow,
        triggerDate,
        buyTriggerDate,
        distanceToTrigger,
    };
}

/**
 * Get the target percentage based on buy number.
 */
export function getTargetPercent(buyNumber: number): number {
    if (buyNumber === 1) return 10;
    if (buyNumber === 2) return 8;
    return 6;
}

/**
 * Calculate 20-day high and low for a set of candles (last 20 days).
 */
export function calculate20DayLevels(candles: DailyCandle[]): { high: number; low: number } | null {
    if (candles.length < 20) return null;
    const last20 = candles.slice(-20);
    return {
        high: Math.max(...last20.map((c) => c.high)),
        low: Math.min(...last20.map((c) => c.low)),
    };
}
