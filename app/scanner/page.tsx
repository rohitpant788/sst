"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SSTAnalysis {
    symbol: string;
    status: "NEUTRAL" | "TRACKING" | "BUY_TRIGGERED";
    currentPrice: number;
    twentyDayHigh: number;
    twentyDayLow: number;
    triggerDate?: string;
    buyTriggerDate?: string;
    distanceToTrigger: number;
}

export default function ScannerPage() {
    const [stocks, setStocks] = useState<SSTAnalysis[]>([]);
    const [filter, setFilter] = useState<string>("all");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [filter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/scanner?filter=${filter}`);
            const data = await res.json();
            setStocks(data);
        } catch (e) {
            console.error("Failed to fetch scanner data:", e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "TRACKING":
                return <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">Tracking</span>;
            case "BUY_TRIGGERED":
                return <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">Buy Triggered</span>;
            default:
                return <span className="px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 text-sm">Neutral</span>;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/" className="text-cyan-400 hover:underline text-sm mb-2 inline-block">
                            ← Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold">SST Scanner</h1>
                        <p className="text-gray-400">Stocks eligible for SST strategy</p>
                    </div>
                    <div className="flex gap-2">
                        {["all", "tracking", "triggered"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg transition-colors ${filter === f
                                        ? "bg-cyan-500 text-white"
                                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                ) : stocks.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-400 mb-4">No stocks found. Try syncing data first.</p>
                        <Link href="/" className="text-cyan-400 hover:underline">
                            Go to Dashboard to Sync
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left p-4 text-gray-400 font-medium">Symbol</th>
                                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Current Price</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">20D High</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">20D Low</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Distance to Trigger</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.map((stock) => (
                                    <tr key={stock.symbol} className="border-t border-white/5 hover:bg-white/5">
                                        <td className="p-4 font-mono">{stock.symbol.replace(".NS", "")}</td>
                                        <td className="p-4">{getStatusBadge(stock.status)}</td>
                                        <td className="p-4 text-right">₹{stock.currentPrice.toFixed(2)}</td>
                                        <td className="p-4 text-right text-cyan-400">₹{stock.twentyDayHigh.toFixed(2)}</td>
                                        <td className="p-4 text-right text-pink-400">₹{stock.twentyDayLow.toFixed(2)}</td>
                                        <td className={`p-4 text-right ${stock.distanceToTrigger > 0 ? "text-red-400" : "text-green-400"}`}>
                                            {stock.distanceToTrigger.toFixed(2)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
