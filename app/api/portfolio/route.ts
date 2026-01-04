import { NextRequest, NextResponse } from "next/server";
import { getOpenPortfolio, addPortfolioEntry, sellPortfolioEntry, getTotalCapital } from "@/lib/db";
import { getTargetPercent } from "@/lib/strategy";

export async function GET() {
    const portfolio = getOpenPortfolio();
    const capital = getTotalCapital();
    return NextResponse.json({ portfolio, capital });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === "buy") {
            const { symbol, buy_date, quantity, buy_price, buy_number } = body;
            if (!symbol || !buy_date || !quantity || !buy_price) {
                return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
            }
            const target_percent = getTargetPercent(buy_number || 1);
            addPortfolioEntry({ symbol, buy_date, quantity, buy_price, buy_number: buy_number || 1, target_percent });
            return NextResponse.json({ success: true });
        }

        if (action === "sell") {
            const { id, sell_date, sell_price } = body;
            if (!id || !sell_date || !sell_price) {
                return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
            }
            sellPortfolioEntry(id, sell_date, sell_price);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("Portfolio error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
