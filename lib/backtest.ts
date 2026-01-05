import type { DailyCandle } from "./db";
import { getTargetPercent } from "./strategy";

export interface BacktestTrade {
    symbol: string;
    buyDate: string;
    buyPrice: number;
    sellDate: string;
    sellPrice: number;
    buyNumber: number;
    targetPercent: number;
    profit: number;
    profitPercent: number;
    holdingDays: number;
}

export interface OpenPosition {
    buyDate: string;
    buyPrice: number;
    quantity: number;
    buyNumber: number;
    targetPercent: number;
    currentPrice: number;
    currentValue: number;
    pnl: number;
    pnlPercent: number;
}

export interface TradeActivity {
    symbol: string;
    type: "BUY" | "SELL" | "SKIPPED";
    price: number;
    quantity: number;
    amount: number; // Invested Amount or Sale Amount
    buyNumber: number; // 1 = Initial, >1 = Scale-in/Re-entry
    profit?: number; // Only for SELL
    date: string;
    holdingDays?: number; // Only for SELL
    purchaseDate?: string; // Only for SELL: Reference to when it was bought
}

export interface DailyState {
    date: string;
    cash: number;
    invested: number;
    equity: number;
    profit: number; // Day's profit (Realized + Unrealized change)
    activities: TradeActivity[]; // Trades (Buy/Sell) on this day
}

export interface BacktestResult {
    symbol: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalCapital: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfit: number; // Realized + Unrealized
    totalProfitPercent: number;
    cagr: number; // Compound Annual Growth Rate
    realizedProfit: number;
    unrealizedProfit: number;
    blockedCapital: number; // Cost basis of open positions
    maxDrawdown: number;
    trades: BacktestTrade[];
    openPositions: OpenPosition[];
    dailyLog: DailyState[]; // Replaces simple equityCurve
}

/**
 * Run backtest on historical data for a single stock.
 * @param symbol - Stock symbol
 * @param candles - Daily candles sorted by date ASCENDING
 * @param initialCapital - Starting capital
 * @param perTradeAmount - Amount to invest per trade (default: initialCapital / 50)
 */
export type ExitStrategy = "WEIGHTED_AVERAGE" | "LIFO";

export function runBacktest(
    symbol: string,
    candles: DailyCandle[],
    initialCapital: number = 500000,
    perTradeAmount?: number,
    exitStrategy: ExitStrategy = "WEIGHTED_AVERAGE",
    targetProfitPercent: number = 6, // Default to 6%
    avgLevels: number = 3 // Default to 3 levels (1 initial + 2 re-entries)
): BacktestResult | null {
    if (candles.length < 21) {
        return null;
    }

    const tradeAmount = perTradeAmount ?? initialCapital / 50;
    const trades: BacktestTrade[] = [];
    const dailyLog: DailyState[] = [];

    let cash = initialCapital;
    let isTracking = false;
    let currentBuyNumber = 0;
    let internalOpenPositions: {
        buyDate: string;
        buyPrice: number;
        quantity: number;
        buyNumber: number;
        targetPercent: number;
    }[] = [];

    let maxEquity = initialCapital;
    let maxDrawdown = 0;

    for (let i = 20; i < candles.length; i++) {
        const day = candles[i];
        const prev20 = candles.slice(i - 20, i);
        const twentyDayHigh = Math.max(...prev20.map((c) => c.high));
        const twentyDayLow = Math.min(...prev20.map((c) => c.low));

        // -- 1. Calculate Start-of-Day Equity (before today's trades) to track daily change if needed
        // simplified: we'll just log end-of-day state

        // -- 2. Check for Sells (Target Reached) --
        const positionsToClose: number[] = [];
        const activitiesToday: TradeActivity[] = [];

        if (exitStrategy === "WEIGHTED_AVERAGE" && internalOpenPositions.length > 0) {
            // --- Strategy: Weighted Average Exit ---
            // Calculate Weighted Average Price
            const totalQty = internalOpenPositions.reduce((sum, p) => sum + p.quantity, 0);
            const totalCost = internalOpenPositions.reduce((sum, p) => sum + (p.quantity * p.buyPrice), 0);
            const weightedAvgPrice = totalQty > 0 ? totalCost / totalQty : 0;

            // Use the target percent of the INITIAL entry (buyNumber = 1) or the first position?
            // Assuming the target percent logic is consistent, we'll use the target calculated for the FIRST position in the stack.
            // Or better, use a standard 6% if implied, but let's stick to the positions' data.
            const baseTargetPercent = internalOpenPositions[0].targetPercent;
            const aggregateTargetPrice = weightedAvgPrice * (1 + baseTargetPercent / 100);



            if (day.high >= aggregateTargetPrice) {
                // Sell ALL positions
                const sellPrice = aggregateTargetPrice; // Assume we sell at target

                internalOpenPositions.forEach((pos, idx) => {
                    const profit = (sellPrice - pos.buyPrice) * pos.quantity;
                    const profitPercent = ((sellPrice - pos.buyPrice) / pos.buyPrice) * 100;
                    const buyDateObj = new Date(pos.buyDate);
                    const sellDateObj = new Date(day.date);
                    const holdingDays = Math.ceil((sellDateObj.getTime() - buyDateObj.getTime()) / (1000 * 60 * 60 * 24));

                    const trade: BacktestTrade = {
                        symbol,
                        buyDate: pos.buyDate,
                        buyPrice: pos.buyPrice,
                        sellDate: day.date,
                        sellPrice,
                        buyNumber: pos.buyNumber,
                        targetPercent: pos.targetPercent, // Note: They sold at aggregate target, not individual
                        profit,
                        profitPercent,
                        holdingDays,
                    };
                    trades.push(trade);

                    // Log Activity
                    activitiesToday.push({
                        symbol,
                        type: "SELL",
                        price: sellPrice,
                        quantity: pos.quantity,
                        amount: pos.quantity * sellPrice,
                        buyNumber: pos.buyNumber,
                        profit,
                        date: day.date,
                        holdingDays,
                        purchaseDate: pos.buyDate
                    });

                    cash += pos.quantity * sellPrice;
                    positionsToClose.push(idx);
                });
            }

        } else {
            // --- Strategy: LIFO / Individual Exit (Legacy) ---
            for (let j = 0; j < internalOpenPositions.length; j++) {
                const pos = internalOpenPositions[j];
                const targetPrice = pos.buyPrice * (1 + pos.targetPercent / 100);

                // Sell logic: If high >= target
                if (day.high >= targetPrice) {
                    const sellPrice = targetPrice;
                    const profit = (sellPrice - pos.buyPrice) * pos.quantity;
                    const profitPercent = ((sellPrice - pos.buyPrice) / pos.buyPrice) * 100;
                    const buyDateObj = new Date(pos.buyDate);
                    const sellDateObj = new Date(day.date);
                    const holdingDays = Math.ceil((sellDateObj.getTime() - buyDateObj.getTime()) / (1000 * 60 * 60 * 24));

                    // Log Closed Trade for Stats
                    const trade: BacktestTrade = {
                        symbol,
                        buyDate: pos.buyDate,
                        buyPrice: pos.buyPrice,
                        sellDate: day.date,
                        sellPrice,
                        buyNumber: pos.buyNumber,
                        targetPercent: pos.targetPercent,
                        profit,
                        profitPercent,
                        holdingDays,
                    };
                    trades.push(trade);

                    // Log Activity for Journal
                    activitiesToday.push({
                        symbol,
                        type: "SELL",
                        price: sellPrice,
                        quantity: pos.quantity,
                        amount: pos.quantity * sellPrice,
                        buyNumber: pos.buyNumber,
                        profit,
                        date: day.date,
                        holdingDays,
                        purchaseDate: pos.buyDate // Add reference to original purchase date
                    });

                    cash += pos.quantity * sellPrice;
                    positionsToClose.push(j);
                }
            }
        }

        // Remove closed positions
        internalOpenPositions = internalOpenPositions.filter((_, idx) => !positionsToClose.includes(idx));

        // If all positions closed and we were in a buying sequence, reset buy number and tracking
        if (internalOpenPositions.length === 0 && currentBuyNumber > 0) {
            currentBuyNumber = 0;
            isTracking = false;
        }



        // -- 3. Check for Entry Signals --
        // Check for tracking (20d low touched)
        if (day.low <= twentyDayLow) {
            isTracking = true;
        }

        // Check for buy signal (20d high crossed while tracking)
        // Also ensure we haven't exceeded the max allowed levels
        if (isTracking && day.high > twentyDayHigh) {
            // Only buy if we are below the limit
            if (currentBuyNumber < avgLevels) {
                currentBuyNumber++;
                const targetPercent = targetProfitPercent;
                const buyPrice = twentyDayHigh; // Assume we buy at the breakout price
                const quantity = Math.floor(tradeAmount / buyPrice);

                if (quantity > 0 && cash >= quantity * buyPrice) {
                    cash -= quantity * buyPrice;
                    internalOpenPositions.push({
                        buyDate: day.date,
                        buyPrice,
                        quantity,
                        buyNumber: currentBuyNumber,
                        targetPercent,
                    });

                    // Log Activity for Journal
                    activitiesToday.push({
                        symbol,
                        type: "BUY",
                        price: buyPrice,
                        quantity,
                        amount: quantity * buyPrice,
                        buyNumber: currentBuyNumber,
                        date: day.date
                    });
                } else if (quantity > 0 && cash < quantity * buyPrice) {
                    // Log Skipped Trade
                    activitiesToday.push({
                        symbol,
                        type: "SKIPPED",
                        price: buyPrice,
                        quantity: 0,
                        amount: 0,
                        buyNumber: currentBuyNumber,
                        date: day.date,
                        // Note: We might need to extend the TradeActivity interface to support 'SKIPPED' or use a generic info field
                    });
                    // console.log(`[Funds] Skipped BUY for ${symbol} on ${day.date}. Cash: ${cash.toFixed(2)} < Req: ${(quantity * buyPrice).toFixed(2)}`);
                }
            }

            // Reset tracking after processed (whether bought or skipped due to limit)
            isTracking = false;
        }

        // -- 4. End-of-Day Accounting --
        let invested = 0;
        for (const pos of internalOpenPositions) {
            invested += pos.quantity * day.close; // Mark to Market
        }
        const currentEquity = cash + invested;

        // Track max drawdown
        if (currentEquity > maxEquity) {
            maxEquity = currentEquity;
        }
        const drawdown = ((maxEquity - currentEquity) / maxEquity) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }

        dailyLog.push({
            date: day.date,
            cash,
            invested,
            equity: currentEquity,
            profit: 0, // Calculated later or relative to previous day
            activities: activitiesToday
        });
    }

    // --- Final Calculation ---
    const lastPrice = candles[candles.length - 1].close;

    // Realized Profit (from closed trades)
    const realizedProfit = trades.reduce((sum, t) => sum + t.profit, 0);

    // Unrealized Positions
    const openPositions: OpenPosition[] = internalOpenPositions.map(pos => {
        const currentValue = pos.quantity * lastPrice;
        const costBasis = pos.quantity * pos.buyPrice;
        const pnl = currentValue - costBasis;
        const pnlPercent = (pnl / costBasis) * 100;

        return {
            buyDate: pos.buyDate,
            buyPrice: pos.buyPrice,
            quantity: pos.quantity,
            buyNumber: pos.buyNumber,
            targetPercent: pos.targetPercent,
            currentPrice: lastPrice,
            currentValue,
            pnl,
            pnlPercent
        };
    });

    const unrealizedProfit = openPositions.reduce((sum, p) => sum + p.pnl, 0);
    const blockedCapital = openPositions.reduce((sum, p) => sum + (p.quantity * p.buyPrice), 0);
    const closingPositionValue = openPositions.reduce((sum, p) => sum + p.currentValue, 0);

    // Final Capital = Cash + Value of Open Positions
    // Total Profit = Realized + Unrealized
    const finalCapital = cash + closingPositionValue;
    const totalProfit = finalCapital - initialCapital;
    const totalProfitPercent = (totalProfit / initialCapital) * 100;

    // Calculate CAGR
    const startDateObj = new Date(candles[20].date);
    const endDateObj = new Date(candles[candles.length - 1].date);
    const durationDays = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24);
    const durationYears = durationDays / 365.25; // Use 365.25 for leap year adjustment

    let cagr = 0;
    if (durationYears > 0 && finalCapital > 0) {
        cagr = (Math.pow(finalCapital / initialCapital, 1 / durationYears) - 1) * 100;
    }

    const winningTrades = trades.filter((t) => t.profit > 0).length;
    const losingTrades = trades.filter((t) => t.profit <= 0).length;

    return {
        symbol,
        startDate: candles[20].date,
        endDate: candles[candles.length - 1].date,
        initialCapital,
        finalCapital,
        totalTrades: trades.length,
        winningTrades,
        losingTrades,
        winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
        totalProfit,
        totalProfitPercent,
        cagr,
        realizedProfit,
        unrealizedProfit,
        blockedCapital,
        maxDrawdown,
        trades,
        openPositions,
        dailyLog,
    };
}
