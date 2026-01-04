import Database from "better-sqlite3";
import path from "path";

// Database path is at the root of the project
const dbPath = path.join(process.cwd(), "sst.db");
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS stocks (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    is_nifty100 INTEGER DEFAULT 0,
    is_nifty200 INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS daily_candles (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    PRIMARY KEY (symbol, date)
  );

  CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    buy_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    buy_price REAL NOT NULL,
    buy_number INTEGER DEFAULT 1, -- 1st buy, 2nd buy, etc.
    target_percent REAL NOT NULL,
    sell_date TEXT,
    sell_price REAL,
    status TEXT DEFAULT 'OPEN' -- OPEN, SOLD
  );

  CREATE TABLE IF NOT EXISTS capital (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL -- 'ADD' or 'WITHDRAW'
  );
`);

export default db;

// --- Helper Functions ---

export interface Stock {
  symbol: string;
  name: string;
  is_nifty100: number;
  is_nifty200: number;
}

export interface DailyCandle {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioEntry {
  id: number;
  symbol: string;
  buy_date: string;
  quantity: number;
  buy_price: number;
  buy_number: number;
  target_percent: number;
  sell_date: string | null;
  sell_price: number | null;
  status: "OPEN" | "SOLD";
}

// Upsert a stock
export function upsertStock(stock: Omit<Stock, "is_nifty100" | "is_nifty200"> & { is_nifty100?: number; is_nifty200?: number }) {
  const stmt = db.prepare(`
    INSERT INTO stocks (symbol, name, is_nifty100, is_nifty200)
    VALUES (@symbol, @name, @is_nifty100, @is_nifty200)
    ON CONFLICT(symbol) DO UPDATE SET
      name = excluded.name,
      is_nifty100 = CASE WHEN excluded.is_nifty100 = 1 THEN 1 ELSE stocks.is_nifty100 END,
      is_nifty200 = CASE WHEN excluded.is_nifty200 = 1 THEN 1 ELSE stocks.is_nifty200 END
  `);
  stmt.run({ ...stock, is_nifty100: stock.is_nifty100 ?? 0, is_nifty200: stock.is_nifty200 ?? 0 });
}

// Insert candles (ignores duplicates)
export function insertCandles(candles: DailyCandle[]) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO daily_candles (symbol, date, open, high, low, close, volume)
    VALUES (@symbol, @date, @open, @high, @low, @close, @volume)
  `);
  const insertMany = db.transaction((items: DailyCandle[]) => {
    for (const item of items) {
      stmt.run(item);
    }
  });
  insertMany(candles);
}

// Get candles for a symbol, ordered by date
export function getCandles(symbol: string, limit?: number): DailyCandle[] {
  const query = limit
    ? `SELECT * FROM daily_candles WHERE symbol = ? ORDER BY date DESC LIMIT ?`
    : `SELECT * FROM daily_candles WHERE symbol = ? ORDER BY date ASC`;
  const params = limit ? [symbol, limit] : [symbol];
  return db.prepare(query).all(...params) as DailyCandle[];
}

// Get all Nifty 100 stocks
export function getNifty100Stocks(): Stock[] {
  return db.prepare(`SELECT * FROM stocks WHERE is_nifty100 = 1`).all() as Stock[];
}

// Get all Nifty 200 stocks
export function getNifty200Stocks(): Stock[] {
  return db.prepare(`SELECT * FROM stocks WHERE is_nifty200 = 1`).all() as Stock[];
}

// Add a portfolio entry
export function addPortfolioEntry(entry: Omit<PortfolioEntry, "id" | "sell_date" | "sell_price" | "status">) {
  const stmt = db.prepare(`
    INSERT INTO portfolio (symbol, buy_date, quantity, buy_price, buy_number, target_percent)
    VALUES (@symbol, @buy_date, @quantity, @buy_price, @buy_number, @target_percent)
  `);
  return stmt.run(entry);
}

// Get open portfolio entries
export function getOpenPortfolio(): PortfolioEntry[] {
  return db.prepare(`SELECT * FROM portfolio WHERE status = 'OPEN' ORDER BY buy_date DESC`).all() as PortfolioEntry[];
}

// Sell a portfolio entry
export function sellPortfolioEntry(id: number, sell_date: string, sell_price: number) {
  const stmt = db.prepare(`UPDATE portfolio SET sell_date = ?, sell_price = ?, status = 'SOLD' WHERE id = ?`);
  return stmt.run(sell_date, sell_price, id);
}

// Get total capital
export function getTotalCapital(): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'ADD' THEN amount ELSE -amount END), 0) as total
    FROM capital
  `).get() as { total: number };
  return result.total;
}

// Add capital entry
export function addCapitalEntry(date: string, amount: number, type: "ADD" | "WITHDRAW") {
  const stmt = db.prepare(`INSERT INTO capital (date, amount, type) VALUES (?, ?, ?)`);
  return stmt.run(date, amount, type);
}
