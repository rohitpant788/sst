"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PortfolioEntry {
    id: number;
    symbol: string;
    buy_date: string;
    quantity: number;
    buy_price: number;
    buy_number: number;
    target_percent: number;
    status: "OPEN" | "SOLD";
}

export default function PortfolioPage() {
    const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
    const [capital, setCapital] = useState(0);
    const [loading, setLoading] = useState(true);

    // Form state for new buy
    const [newSymbol, setNewSymbol] = useState("");
    const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
    const [newQuantity, setNewQuantity] = useState(10);
    const [newPrice, setNewPrice] = useState(100);
    const [newBuyNumber, setNewBuyNumber] = useState(1);

    useEffect(() => {
        fetchPortfolio();
    }, []);

    const fetchPortfolio = async () => {
        try {
            const res = await fetch("/api/portfolio");
            const data = await res.json();
            setPortfolio(data.portfolio || []);
            setCapital(data.capital || 0);
        } catch (e) {
            console.error("Failed to fetch portfolio:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddBuy = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch("/api/portfolio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "buy",
                    symbol: newSymbol,
                    buy_date: newDate,
                    quantity: newQuantity,
                    buy_price: newPrice,
                    buy_number: newBuyNumber,
                }),
            });
            setNewSymbol("");
            fetchPortfolio();
        } catch (e) {
            console.error("Failed to add buy:", e);
        }
    };

    const handleSell = async (id: number) => {
        const sellPrice = prompt("Enter sell price:");
        if (!sellPrice) return;

        try {
            await fetch("/api/portfolio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sell",
                    id,
                    sell_date: new Date().toISOString().split("T")[0],
                    sell_price: parseFloat(sellPrice),
                }),
            });
            fetchPortfolio();
        } catch (e) {
            console.error("Failed to sell:", e);
        }
    };

    const totalInvested = portfolio.reduce((sum, p) => sum + p.quantity * p.buy_price, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/" className="text-cyan-400 hover:underline text-sm mb-2 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold">Portfolio Tracker</h1>
                    <p className="text-gray-400">Manage your SST positions</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-gray-400 text-sm">Total Capital</p>
                        <p className="text-2xl font-bold text-cyan-400">₹{capital.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-gray-400 text-sm">Invested Amount</p>
                        <p className="text-2xl font-bold text-purple-400">₹{totalInvested.toLocaleString()}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-gray-400 text-sm">Open Positions</p>
                        <p className="text-2xl font-bold text-pink-400">{portfolio.length}</p>
                    </div>
                </div>

                {/* Add Buy Form */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-8">
                    <h3 className="text-lg font-semibold mb-4">Add New Buy</h3>
                    <form onSubmit={handleAddBuy} className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <input
                            type="text"
                            placeholder="Symbol (e.g., RELIANCE.NS)"
                            value={newSymbol}
                            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                            required
                        />
                        <input
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                            required
                        />
                        <input
                            type="number"
                            placeholder="Quantity"
                            value={newQuantity}
                            onChange={(e) => setNewQuantity(parseInt(e.target.value))}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                            required
                        />
                        <input
                            type="number"
                            placeholder="Buy Price"
                            value={newPrice}
                            onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                            step="0.01"
                            required
                        />
                        <select
                            value={newBuyNumber}
                            onChange={(e) => setNewBuyNumber(parseInt(e.target.value))}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-cyan-400"
                        >
                            <option value={1}>1st Buy (10%)</option>
                            <option value={2}>2nd Buy (8%)</option>
                            <option value={3}>3rd+ Buy (6%)</option>
                        </select>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-semibold hover:opacity-90"
                        >
                            Add Buy
                        </button>
                    </form>
                </div>

                {/* Portfolio Table */}
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                ) : portfolio.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">No open positions yet</div>
                ) : (
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left p-4 text-gray-400 font-medium">Symbol</th>
                                    <th className="text-left p-4 text-gray-400 font-medium">Buy Date</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Qty</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Buy Price</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Target %</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Target Price</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {portfolio.map((entry) => (
                                    <tr key={entry.id} className="border-t border-white/5 hover:bg-white/5">
                                        <td className="p-4 font-mono">{entry.symbol.replace(".NS", "")}</td>
                                        <td className="p-4">{entry.buy_date}</td>
                                        <td className="p-4 text-right">{entry.quantity}</td>
                                        <td className="p-4 text-right">₹{entry.buy_price.toFixed(2)}</td>
                                        <td className="p-4 text-right text-cyan-400">{entry.target_percent}%</td>
                                        <td className="p-4 text-right text-green-400">
                                            ₹{(entry.buy_price * (1 + entry.target_percent / 100)).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleSell(entry.id)}
                                                className="px-4 py-1 bg-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/30"
                                            >
                                                Sell
                                            </button>
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
