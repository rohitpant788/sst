import { NextRequest, NextResponse } from "next/server";
import { getSmartStockData } from "@/lib/data";
import { runBacktest, BacktestResult } from "@/lib/backtest";
import { subYears, parseISO } from "date-fns";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, symbols, yearsBack = 3, initialCapital = 500000, tradeSizePercent = 10, startDate: reqStartDate, endDate: reqEndDate } = body;

        let targetSymbols: string[] = [];
        if (symbols && Array.isArray(symbols) && symbols.length > 0) {
            targetSymbols = symbols;
        } else if (symbol) {
            targetSymbols = [symbol];
        } else {
            return NextResponse.json({ error: "Symbol or symbols array is required" }, { status: 400 });
        }

        // Determine Date Range
        let endDate = new Date();
        if (reqEndDate) {
            endDate = parseISO(reqEndDate);
        }

        let startDate = subYears(endDate, yearsBack);
        if (reqStartDate) {
            startDate = parseISO(reqStartDate);
        }

        const results: BacktestResult[] = [];

        // Calculate per trade amount based on percentage
        const perTradeAmount = (initialCapital * tradeSizePercent) / 100;

        // Process in chunks to avoid rate limiting
        const CHUNK_SIZE = 5;
        for (let i = 0; i < targetSymbols.length; i += CHUNK_SIZE) {
            const chunk = targetSymbols.slice(i, i + CHUNK_SIZE);

            const chunkPromises = chunk.map(async (sym) => {
                try {
                    const candles = await getSmartStockData(sym, startDate, endDate);
                    // We might get less data than requested, but runBacktest handles what it gets.
                    // We still enforce minimum length for MA calculation.
                    if (candles.length < 21) {
                        return null;
                    }
                    return runBacktest(sym, candles, initialCapital, perTradeAmount);
                } catch (e) {
                    console.error(`Error processing ${sym}:`, e);
                    return null;
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            chunkResults.forEach(r => {
                if (r) results.push(r);
            });
        }

        if (results.length === 0) {
            return NextResponse.json(
                { error: "No valid backtests generated (check data availability)" },
                { status: 500 }
            );
        }

        // Aggregate Results
        // Fetch Benchmark Data (Nifty 50) covering the same range
        let benchmarkData = null;
        try {
            const niftyCandles = await getSmartStockData("^NSEI", startDate, endDate);
            if (niftyCandles.length > 0) {
                const startPrice = niftyCandles[0].close; // Approximate start of period
                const endPrice = niftyCandles[niftyCandles.length - 1].close;
                const totalReturnPercent = ((endPrice - startPrice) / startPrice) * 100;

                benchmarkData = {
                    symbol: "^NSEI",
                    totalReturnPercent,
                    startPrice,
                    endPrice,
                    finalCapital: initialCapital * (1 + totalReturnPercent / 100)
                };
            }
        } catch (err) {
            console.error("Failed to fetch benchmark data:", err);
        }

        // Aggregate Results
        const aggregate = {
            totalTrades: results.reduce((sum, r) => sum + r.totalTrades, 0),
            totalProfit: results.reduce((sum, r) => sum + r.totalProfit, 0),
            realizedProfit: results.reduce((sum, r) => sum + r.realizedProfit, 0),
            unrealizedProfit: results.reduce((sum, r) => sum + r.unrealizedProfit, 0),
            blockedCapital: results.reduce((sum, r) => sum + r.blockedCapital, 0),
            winningTrades: results.reduce((sum, r) => sum + r.winningTrades, 0),
            losingTrades: results.reduce((sum, r) => sum + r.losingTrades, 0),
            finalCapital: initialCapital + results.reduce((sum, r) => sum + r.totalProfit, 0),
            benchmark: benchmarkData
        };

        const winRate = aggregate.totalTrades > 0 ? (aggregate.winningTrades / aggregate.totalTrades) * 100 : 0;
        const totalProfitPercent = (aggregate.totalProfit / initialCapital) * 100;

        return NextResponse.json({
            results,
            aggregate: {
                ...aggregate,
                winRate,
                totalProfitPercent
            }
        });

    } catch (error) {
        console.error("Backtest error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
