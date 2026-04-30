import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Brain,
  CandlestickChart,
  Coins,
  DollarSign,
  LineChart,
  PieChart,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react';

const STARTING_CASH = 100000;
const STORAGE_KEY = 'trade-trainer-v1';

const DEFAULT_ASSETS = [
  { id: 'apple', symbol: 'AAPL', name: 'Apple', type: 'stock', price: 271.35, change24h: 0.31, volatility: 0.012 },
  { id: 'tesla', symbol: 'TSLA', name: 'Tesla', type: 'stock', price: 291.4, change24h: -1.84, volatility: 0.026 },
  { id: 'nvidia', symbol: 'NVDA', name: 'NVIDIA', type: 'stock', price: 113.6, change24h: 1.21, volatility: 0.021 },
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'crypto', price: 65000, change24h: 2.4, volatility: 0.032 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', type: 'crypto', price: 3200, change24h: 1.6, volatility: 0.038 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', type: 'crypto', price: 145, change24h: -0.9, volatility: 0.047 },
];

const LESSONS = [
  'Do not buy just because the candle is green. Write down the setup first.',
  'Risk size beats prediction. A decent setup with smart sizing survives bad luck.',
  'If your stop loss is random, your entry probably is too.',
  'Good traders ask: what proves me wrong? Bad traders ask: how high can it go?',
  'Paper trading only works if you treat fake money like real money. No YOLO clown math.',
];

function currency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function percent(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function generateSeries(asset, points = 48) {
  const seed = asset.symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let price = asset.price * (1 - asset.change24h / 100);
  const rows = [];

  for (let i = 0; i < points; i += 1) {
    const drift = asset.change24h / 100 / points;
    const wave = Math.sin((i + seed) / 4) * asset.volatility;
    const noise = Math.cos((i * seed) / 19) * asset.volatility * 0.45;
    price = Math.max(0.01, price * (1 + drift + wave * 0.08 + noise * 0.05));
    rows.push({
      time: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      price: Number(price.toFixed(2)),
    });
  }

  rows[rows.length - 1].price = asset.price;
  return rows;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch (error) {
    console.warn('Could not load saved trading state', error);
  }

  return { cash: STARTING_CASH, positions: {}, trades: [], journal: [] };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nudgeAsset(asset) {
  const direction = Math.sin(Date.now() / 15000 + asset.symbol.length) * asset.volatility;
  return {
    ...asset,
    price: Math.max(0.01, Number((asset.price * (1 + direction * 0.03)).toFixed(2))),
    change24h: asset.change24h + direction * 3,
  };
}

function StatCard({ icon: Icon, label, value, subtext }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-800 bg-slate-950/75 p-5 shadow-2xl shadow-black/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300">
          <Icon size={22} />
        </div>
      </div>
    </motion.div>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/20' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
    >
      {children}
    </button>
  );
}

function App() {
  const [state, setState] = useState(loadState);
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [side, setSide] = useState('buy');
  const [quantity, setQuantity] = useState('0.25');
  const [note, setNote] = useState('Breakout attempt with defined risk.');
  const [filter, setFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selected = assets.find((asset) => asset.symbol === selectedSymbol) || assets[0];

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    refreshCryptoPrices();
    const timer = window.setInterval(refreshCryptoPrices, 60000);
    return () => window.clearInterval(timer);
  }, []);

  async function refreshCryptoPrices() {
    setIsRefreshing(true);
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
      if (!response.ok) throw new Error('CoinGecko request failed');
      const data = await response.json();

      setAssets((current) => current.map((asset) => {
        if (asset.type !== 'crypto') return nudgeAsset(asset);
        const live = data[asset.id];
        if (!live?.usd) return nudgeAsset(asset);
        return { ...asset, price: live.usd, change24h: live.usd_24h_change ?? asset.change24h };
      }));
    } catch (error) {
      console.warn('Using simulated market data fallback', error);
      setAssets((current) => current.map(nudgeAsset));
    } finally {
      setIsRefreshing(false);
    }
  }

  const filteredAssets = assets.filter((asset) => filter === 'all' || asset.type === filter);
  const chartData = useMemo(() => generateSeries(selected), [selected]);

  const positionsValue = useMemo(() => Object.entries(state.positions).reduce((total, [symbol, position]) => {
    const asset = assets.find((item) => item.symbol === symbol);
    return total + (asset?.price || 0) * position.quantity;
  }, 0), [assets, state.positions]);

  const equity = state.cash + positionsValue;
  const profitLoss = equity - STARTING_CASH;
  const profitLossPct = (profitLoss / STARTING_CASH) * 100;
  const qty = Number(quantity) || 0;
  const tradeValue = qty * selected.price;
  const position = state.positions[selected.symbol] || { quantity: 0, avgPrice: 0 };
  const stopLoss = selected.price * 0.96;
  const estimatedRisk = Math.max(0, (selected.price - stopLoss) * qty);
  const lesson = LESSONS[Math.abs(selected.symbol.charCodeAt(0) + state.trades.length) % LESSONS.length];

  function executeTrade() {
    if (qty <= 0) return;

    setState((current) => {
      const currentPosition = current.positions[selected.symbol] || { quantity: 0, avgPrice: 0 };
      const nextPositions = { ...current.positions };
      let nextCash = current.cash;

      if (side === 'buy') {
        if (tradeValue > current.cash) return current;
        const newQuantity = currentPosition.quantity + qty;
        const newAverage = (currentPosition.quantity * currentPosition.avgPrice + tradeValue) / newQuantity;
        nextPositions[selected.symbol] = { quantity: newQuantity, avgPrice: newAverage };
        nextCash -= tradeValue;
      } else {
        if (qty > currentPosition.quantity) return current;
        const remaining = currentPosition.quantity - qty;
        nextCash += tradeValue;
        if (remaining <= 0.0000001) delete nextPositions[selected.symbol];
        else nextPositions[selected.symbol] = { ...currentPosition, quantity: remaining };
      }

      const trade = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        side,
        symbol: selected.symbol,
        name: selected.name,
        quantity: qty,
        price: selected.price,
        value: tradeValue,
        note,
      };

      return {
        ...current,
        cash: nextCash,
        positions: nextPositions,
        trades: [trade, ...current.trades].slice(0, 50),
        journal: note.trim()
          ? [{ id: trade.id, symbol: selected.symbol, text: note.trim(), createdAt: trade.timestamp }, ...current.journal].slice(0, 20)
          : current.journal,
      };
    });
  }

  function resetAccount() {
    const fresh = { cash: STARTING_CASH, positions: {}, trades: [], journal: [] };
    setState(fresh);
    saveState(fresh);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_50%,_#020617)] p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
              <Sparkles size={16} /> Paper trading lab
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">TradeTrainer</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Practice entries, exits, sizing, and journaling without donating your paycheck to the market goblin.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={refreshCryptoPrices} className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 font-bold text-white hover:bg-slate-700">
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={resetAccount} className="rounded-2xl border border-slate-700 px-4 py-3 font-bold text-slate-200 hover:bg-slate-900">
              Reset paper account
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard icon={Wallet} label="Account equity" value={currency(equity)} subtext="Cash + open positions" />
          <StatCard icon={DollarSign} label="Available cash" value={currency(state.cash)} subtext="Paper balance" />
          <StatCard icon={PieChart} label="Positions value" value={currency(positionsValue)} subtext="Marked to market" />
          <StatCard icon={profitLoss >= 0 ? ArrowUpRight : ArrowDownRight} label="Total P/L" value={`${currency(profitLoss)} (${percent(profitLossPct)})`} subtext="Since account start" />
        </section>

        <main className="grid gap-6 lg:grid-cols-[1.05fr_1.7fr_0.95fr]">
          <aside className="rounded-[2rem] border border-slate-800 bg-slate-950/75 p-5 shadow-2xl shadow-black/20">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><LineChart size={21} /> Watchlist</h2>
            <div className="mb-4 flex gap-2">
              <Pill active={filter === 'all'} onClick={() => setFilter('all')}>All</Pill>
              <Pill active={filter === 'stock'} onClick={() => setFilter('stock')}>Stocks</Pill>
              <Pill active={filter === 'crypto'} onClick={() => setFilter('crypto')}>Crypto</Pill>
            </div>
            <div className="space-y-3">
              {filteredAssets.map((asset) => {
                const active = selected.symbol === asset.symbol;
                return (
                  <button key={asset.symbol} onClick={() => setSelectedSymbol(asset.symbol)} className={`w-full rounded-3xl border p-4 text-left transition ${active ? 'border-emerald-400/70 bg-emerald-400/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{asset.symbol}</p>
                        <p className="text-sm text-slate-400">{asset.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{currency(asset.price)}</p>
                        <p className={`text-sm font-bold ${asset.change24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{percent(asset.change24h)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-950/75 p-5 shadow-2xl shadow-black/20">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Selected market</p>
                  <h2 className="mt-1 text-3xl font-black text-white">{selected.name} <span className="text-slate-500">{selected.symbol}</span></h2>
                  <p className="mt-2 text-slate-400">Current quote: <span className="font-bold text-white">{currency(selected.price)}</span></p>
                </div>
                <div className={`rounded-2xl px-4 py-3 font-black ${selected.change24h >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                  {selected.change24h >= 0 ? <ArrowUpRight className="inline" size={18} /> : <ArrowDownRight className="inline" size={18} />} {percent(selected.change24h)}
                </div>
              </div>

              <div className="h-80 rounded-3xl bg-slate-900/70 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 18 }} labelStyle={{ color: '#cbd5e1' }} formatter={(value) => [currency(value), 'Price']} />
                    <Area type="monotone" dataKey="price" stroke="currentColor" strokeWidth={3} fill="currentColor" fillOpacity={0.12} className={selected.change24h >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-5">
                <h3 className="flex items-center gap-2 font-black text-white"><ShieldCheck size={19} /> Risk box</h3>
                <p className="mt-3 text-sm text-slate-400">Estimated 4% stop loss</p>
                <p className="mt-1 text-2xl font-black text-white">{currency(estimatedRisk)}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-5">
                <h3 className="flex items-center gap-2 font-black text-white"><CandlestickChart size={19} /> Position</h3>
                <p className="mt-3 text-sm text-slate-400">Owned shares/coins</p>
                <p className="mt-1 text-2xl font-black text-white">{position.quantity.toFixed(4)}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-5">
                <h3 className="flex items-center gap-2 font-black text-white"><Brain size={19} /> Coach note</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{lesson}</p>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-800 bg-slate-950/75 p-5 shadow-2xl shadow-black/20">
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><Coins size={21} /> Order ticket</h2>
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-900 p-1">
                <button onClick={() => setSide('buy')} className={`rounded-xl py-3 font-black ${side === 'buy' ? 'bg-emerald-400 text-slate-950' : 'text-slate-400'}`}>Buy</button>
                <button onClick={() => setSide('sell')} className={`rounded-xl py-3 font-black ${side === 'sell' ? 'bg-rose-400 text-slate-950' : 'text-slate-400'}`}>Sell</button>
              </div>

              <label className="mt-5 block text-sm font-bold text-slate-300">Quantity</label>
              <input value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-lg font-bold text-white outline-none focus:border-emerald-400" inputMode="decimal" />

              <label className="mt-5 block text-sm font-bold text-slate-300">Trade thesis / journal</label>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400" />

              <div className="mt-5 rounded-3xl bg-slate-900/70 p-4 text-sm text-slate-300">
                <div className="flex justify-between"><span>Market</span><strong>{selected.symbol}</strong></div>
                <div className="mt-2 flex justify-between"><span>Price</span><strong>{currency(selected.price)}</strong></div>
                <div className="mt-2 flex justify-between"><span>Trade value</span><strong>{currency(tradeValue)}</strong></div>
              </div>

              <button onClick={executeTrade} className={`mt-5 w-full rounded-2xl py-4 text-lg font-black shadow-xl transition ${side === 'buy' ? 'bg-emerald-400 text-slate-950 shadow-emerald-400/20 hover:bg-emerald-300' : 'bg-rose-400 text-slate-950 shadow-rose-400/20 hover:bg-rose-300'}`}>
                Place paper {side}
              </button>
            </section>

            <section className="rounded-[2rem] border border-slate-800 bg-slate-950/75 p-5 shadow-2xl shadow-black/20">
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><Trophy size={21} /> Recent trades</h2>
              <div className="mt-4 max-h-80 space-y-3 overflow-auto pr-1">
                {state.trades.length === 0 ? (
                  <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">No trades yet. Make one and write a thesis. No thesis, no trade. That is the house rule.</p>
                ) : state.trades.map((trade) => (
                  <div key={trade.id} className="rounded-2xl bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white"><span className={trade.side === 'buy' ? 'text-emerald-300' : 'text-rose-300'}>{trade.side.toUpperCase()}</span> {trade.symbol}</p>
                        <p className="text-xs text-slate-500">{new Date(trade.timestamp).toLocaleString()}</p>
                      </div>
                      <p className="font-bold text-white">{currency(trade.value)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{trade.quantity} @ {currency(trade.price)}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/75 p-5 shadow-2xl shadow-black/20">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><BarChart3 size={21} /> Open positions</h2>
            <div className="mt-4 overflow-hidden rounded-3xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr><th className="p-4">Asset</th><th className="p-4">Qty</th><th className="p-4">Avg</th><th className="p-4">Value</th><th className="p-4">P/L</th></tr>
                </thead>
                <tbody>
                  {Object.entries(state.positions).length === 0 ? (
                    <tr><td className="p-4 text-slate-500" colSpan="5">No open positions.</td></tr>
                  ) : Object.entries(state.positions).map(([symbol, pos]) => {
                    const asset = assets.find((item) => item.symbol === symbol);
                    const value = (asset?.price || 0) * pos.quantity;
                    const pnl = value - pos.avgPrice * pos.quantity;
                    return (
                      <tr key={symbol} className="border-t border-slate-800">
                        <td className="p-4 font-black text-white">{symbol}</td>
                        <td className="p-4 text-slate-300">{pos.quantity.toFixed(4)}</td>
                        <td className="p-4 text-slate-300">{currency(pos.avgPrice)}</td>
                        <td className="p-4 text-slate-300">{currency(value)}</td>
                        <td className={`p-4 font-black ${pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{currency(pnl)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/75 p-5 shadow-2xl shadow-black/20">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><BookOpen size={21} /> Trade journal</h2>
            <div className="mt-4 space-y-3">
              {state.journal.length === 0 ? (
                <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">Journal entries appear here after each trade. Future version: score entries, exits, risk, and discipline.</p>
              ) : state.journal.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-slate-900 p-4">
                  <p className="font-black text-white">{entry.symbol}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{entry.text}</p>
                  <p className="mt-2 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
