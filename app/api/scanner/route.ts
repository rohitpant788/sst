import { NextRequest, NextResponse } from "next/server";
import { getNifty100Stocks, getCandles } from "@/lib/db";
import { analyzeStock, type SSTAnalysis } from "@/lib/strategy";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // 'tracking' | 'triggered' | 'all'

    const stocks = getNifty100Stocks();
    const analyses: SSTAnalysis[] = [];

    for (const stock of stocks) {
        const candles = getCandles(stock.symbol);
        if (candles.length >= 21) {
            const analysis = analyzeStock(stock.symbol, candles);
            if (analysis) {
                if (filter === "tracking" && analysis.status !== "TRACKING") continue;
                if (filter === "triggered" && analysis.status !== "BUY_TRIGGERED") continue;
                analyses.push(analysis);
            }
        }
    }

    // Sort by distance to trigger (closest first)
    analyses.sort((a, b) => a.distanceToTrigger - b.distanceToTrigger);

    return NextResponse.json(analyses);
}
