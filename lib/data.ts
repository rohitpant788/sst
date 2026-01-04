import { getCandles, insertCandles, DailyCandle } from "./db";
import { fetchCandles } from "./yahoo";
import { subYears, addDays, parseISO, format, isBefore, subDays } from "date-fns";

/**
 * Smart fetch: Checks DB first, fetches missing data if needed.
 * Returns candles covering the requested period.
 */
export async function getSmartStockData(symbol: string, startDate: Date, endDate: Date = new Date()): Promise<DailyCandle[]> {
    const startDateStr = format(startDate, "yyyy-MM-dd");
    const endDateStr = format(endDate, "yyyy-MM-dd");

    // 1. Get all existing data from DB
    let candles = getCandles(symbol);

    // 2. Case: No data at all
    if (candles.length === 0) {
        const freshData = await fetchCandles(symbol, startDate, endDate);
        if (freshData.length > 0) {
            insertCandles(freshData);
            return freshData; // Already sorted
        }
        return [];
    }

    // 3. Case: Have data, check if we need to sync tail (latest data)
    const lastCandle = candles[candles.length - 1];
    const lastDate = parseISO(lastCandle.date);
    const nextDay = addDays(lastDate, 1);

    // If existing data ends BEFORE the requested end date
    // We use !isBefore(endDate, nextDay) to say "if endDate is >= nextDay"
    if (!isBefore(endDate, nextDay)) {
        const freshTail = await fetchCandles(symbol, nextDay, endDate);
        if (freshTail.length > 0) {
            insertCandles(freshTail);
            candles = getCandles(symbol);
        }
    }

    // 4. Case: Filling HEAD if requested start is older than what we have
    const firstCandle = candles[0];
    const firstDate = parseISO(firstCandle.date);

    if (isBefore(startDate, firstDate)) {
        const gapEnd = subDays(firstDate, 1);
        // Only fetch if gap is real
        if (!isBefore(gapEnd, startDate)) {
            const freshHead = await fetchCandles(symbol, startDate, gapEnd);
            if (freshHead.length > 0) {
                insertCandles(freshHead);
                candles = getCandles(symbol);
            }
        }
    }

    // Filter to return only requested range
    return candles.filter(c => c.date >= startDateStr && c.date <= endDateStr);
}
