import { NextResponse } from "next/server";
import { fetchHistoricalData, NIFTY_100_SYMBOLS, getStockInfo } from "@/lib/yahoo";
import { upsertStock, insertCandles } from "@/lib/db";

export async function POST() {
    const results: { symbol: string; status: string; candles?: number }[] = [];

    for (const symbol of NIFTY_100_SYMBOLS.slice(0, 10)) {
        // Limit to first 10 for demo
        try {
            // Get stock info
            const info = await getStockInfo(symbol);
            if (info) {
                upsertStock({ symbol: info.symbol, name: info.name, is_nifty100: 1 });
            }

            // Fetch historical data
            const candles = await fetchHistoricalData(symbol, 3);
            if (candles.length > 0) {
                insertCandles(candles);
                results.push({ symbol, status: "success", candles: candles.length });
            } else {
                results.push({ symbol, status: "no_data" });
            }
        } catch (error) {
            results.push({ symbol, status: "error" });
            console.error(`Error syncing ${symbol}:`, error);
        }
    }

    return NextResponse.json({ message: "Sync complete", results });
}
