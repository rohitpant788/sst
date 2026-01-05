import { NextRequest, NextResponse } from "next/server";
import { getSmartStockData } from "@/lib/data";
import { runBacktest, BacktestResult } from "@/lib/backtest";
import { subYears, parseISO } from "date-fns";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, symbols, yearsBack = 3, initialCapital = 500000, tradeSizePercent = 10, startDate: reqStartDate, endDate: reqEndDate, exitStrategy = "WEIGHTED_AVERAGE", avgLevels = 3, targetProfitPercent = 6 } = body;

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
                    return runBacktest(sym, candles, initialCapital, perTradeAmount, exitStrategy, targetProfitPercent, avgLevels);
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

        // --- Generate Portfolio Diary ---
        const dailyMap = new Map<string, {
            date: string;
            invested: number;
            totalProfit: number; // Accumulated profit from all stocks up to this day
            activities: any[];
        }>();

        // 1. Collect all days and sum up invested/profit
        results.forEach(res => {
            res.dailyLog.forEach(day => {
                if (!dailyMap.has(day.date)) {
                    dailyMap.set(day.date, { date: day.date, invested: 0, totalProfit: 0, activities: [] });
                }
                const entry = dailyMap.get(day.date)!;
                entry.invested += day.invested;
                // Profit contribution from this stock = Current Equity - Initial Allocation
                // Note: This assumes res.initialCapital was used as the base for this stock's run.
                // In our "Batch" mode, we passed the FULL capital to each runBacktest to calculate sizing,
                // but functionally they ran effectively with `initialCapital` as their starting cash.
                // Adjusted Logic:
                // each stock's `day.equity` includes its `initialCapital`.
                // We want just the delta (profit/loss).
                entry.totalProfit += (day.equity - res.initialCapital);

                if (day.activities.length > 0) {
                    entry.activities.push(...day.activities);
                }
            });
        });

        // 2. Sort and Format
        const portfolioDiary = Array.from(dailyMap.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(day => {
                const portfolioValue = initialCapital + day.totalProfit;
                const cash = portfolioValue - day.invested;
                return {
                    date: day.date,
                    cash,
                    invested: day.invested,
                    portfolioValue,
                    dayProfit: 0, // Can calculate relative to prev day in frontend or here
                    totalProfit: day.totalProfit,
                    activities: day.activities
                };
            });

        // Calculate daily P&L change
        for (let i = 1; i < portfolioDiary.length; i++) {
            portfolioDiary[i].dayProfit = portfolioDiary[i].portfolioValue - portfolioDiary[i - 1].portfolioValue;
        }

        return NextResponse.json({
            results,
            aggregate: {
                ...aggregate,
                winRate,
                totalProfitPercent
            },
            portfolioDiary // Add to response
        });

    } catch (error) {
        console.error("Backtest error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
