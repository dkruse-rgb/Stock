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
  Home,
  LineChart,
  PieChart,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react';

const DEFAULT_STARTING_CASH = 100000;
const STORAGE_KEY = 'trade-trainer-v2';
const OLD_STORAGE_KEY = 'trade-trainer-v1';

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

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'markets', label: 'Markets', icon: LineChart },
  { id: 'trade', label: 'Trade', icon: CandlestickChart },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function createFreshState(startingCash = DEFAULT_STARTING_CASH) {
  return {
    startingCash,
    cash: startingCash,
    positions: {},
    trades: [],
    journal: [],
  };
}

function normalizeState(saved) {
  if (!saved) return createFreshState();
  const startingCash = Number(saved.startingCash || DEFAULT_STARTING_CASH);
  return {
    startingCash,
    cash: Number.isFinite(saved.cash) ? saved.cash : startingCash,
    positions: saved.positions || {},
    trades: saved.trades || [],
    journal: saved.journal || [],
  };
}

function loadState() {
  try {
    const savedV2 = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (savedV2) return normalizeState(savedV2);

    const savedV1 = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    if (savedV1) return normalizeState(savedV1);
  } catch (error) {
    console.warn('Could not load saved trading state', error);
  }

  return createFreshState();
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

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

function nudgeAsset(asset) {
  const direction = Math.sin(Date.now() / 15000 + asset.symbol.length) * asset.volatility;
  return {
    ...asset,
    price: Math.max(0.01, Number((asset.price * (1 + direction * 0.03)).toFixed(2))),
    change24h: asset.change24h + direction * 3,
  };
}

function Card({ children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[1.75rem] border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-black/20 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function StatCard({ icon: Icon, label, value, subtext }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300">
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${active ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/20' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
    >
      {children}
    </button>
  );
}

function PriceChart({ data, selected }) {
  return (
    <div className="h-72 rounded-3xl bg-slate-900/70 p-3 md:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
          <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
          <Tooltip contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 18 }} labelStyle={{ color: '#cbd5e1' }} formatter={(value) => [currency(value), 'Price']} />
          <Area type="monotone" dataKey="price" stroke="currentColor" strokeWidth={3} fill="currentColor" fillOpacity={0.12} className={selected.change24h >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Watchlist({ assets, selectedSymbol, onSelect }) {
  return (
    <div className="space-y-3">
      {assets.map((asset) => {
        const active = selectedSymbol === asset.symbol;
        return (
          <button
            key={asset.symbol}
            onClick={() => onSelect(asset.symbol)}
            className={`w-full rounded-3xl border p-4 text-left transition ${active ? 'border-emerald-400/70 bg-emerald-400/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'}`}
          >
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
  const [query, setQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [capitalInput, setCapitalInput] = useState(String(state.startingCash));

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

  const filteredAssets = assets.filter((asset) => {
    const matchesType = filter === 'all' || asset.type === filter;
    const matchesQuery = `${asset.symbol} ${asset.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesQuery;
  });

  const chartData = useMemo(() => generateSeries(selected), [selected]);

  const positionsValue = useMemo(() => Object.entries(state.positions).reduce((total, [symbol, position]) => {
    const asset = assets.find((item) => item.symbol === symbol);
    return total + (asset?.price || 0) * position.quantity;
  }, 0), [assets, state.positions]);

  const equity = state.cash + positionsValue;
  const profitLoss = equity - state.startingCash;
  const profitLossPct = state.startingCash > 0 ? (profitLoss / state.startingCash) * 100 : 0;
  const qty = Number(quantity) || 0;
  const tradeValue = qty * selected.price;
  const position = state.positions[selected.symbol] || { quantity: 0, avgPrice: 0 };
  const stopLoss = selected.price * 0.96;
  const estimatedRisk = Math.max(0, (selected.price - stopLoss) * qty);
  const lesson = LESSONS[Math.abs(selected.symbol.charCodeAt(0) + state.trades.length) % LESSONS.length];

  function selectMarket(symbol) {
    setSelectedSymbol(symbol);
    setActiveTab('trade');
  }

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
        trades: [trade, ...current.trades].slice(0, 75),
        journal: note.trim()
          ? [{ id: trade.id, symbol: selected.symbol, text: note.trim(), createdAt: trade.timestamp }, ...current.journal].slice(0, 40)
          : current.journal,
      };
    });
  }

  function resetAccount(startingCash = state.startingCash) {
    const amount = Math.max(100, Number(startingCash) || DEFAULT_STARTING_CASH);
    const fresh = createFreshState(amount);
    setState(fresh);
    setCapitalInput(String(amount));
    saveState(fresh);
  }

  function applyStartingCapital() {
    resetAccount(capitalInput);
    setActiveTab('home');
  }

  function renderHeader() {
    return (
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-800/80 bg-slate-950/90 px-4 py-4 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
              <Sparkles size={14} /> Paper trading lab
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">TradeTrainer</h1>
          </div>
          <button onClick={refreshCryptoPrices} className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-3 py-3 font-bold text-white hover:bg-slate-700">
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>
    );
  }

  function renderStats() {
    return (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Equity" value={currency(equity)} subtext="Cash + open positions" />
        <StatCard icon={DollarSign} label="Cash" value={currency(state.cash)} subtext="Available paper balance" />
        <StatCard icon={PieChart} label="Positions" value={currency(positionsValue)} subtext="Marked to market" />
        <StatCard icon={profitLoss >= 0 ? ArrowUpRight : ArrowDownRight} label="Total P/L" value={`${currency(profitLoss)} (${percent(profitLossPct)})`} subtext={`Start: ${currency(state.startingCash)}`} />
      </section>
    );
  }

  function renderMarketCard() {
    return (
      <Card>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Selected market</p>
            <h2 className="mt-1 text-3xl font-black text-white">{selected.name} <span className="text-slate-500">{selected.symbol}</span></h2>
            <p className="mt-2 text-slate-400">Current quote: <span className="font-bold text-white">{currency(selected.price)}</span></p>
          </div>
          <div className={`rounded-2xl px-4 py-3 font-black ${selected.change24h >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
            {selected.change24h >= 0 ? <ArrowUpRight className="inline" size={18} /> : <ArrowDownRight className="inline" size={18} />} {percent(selected.change24h)}
          </div>
        </div>
        <PriceChart data={chartData} selected={selected} />
      </Card>
    );
  }

  function renderOrderTicket() {
    return (
      <Card>
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
          <div className="mt-2 flex justify-between"><span>Est. 4% risk</span><strong>{currency(estimatedRisk)}</strong></div>
        </div>

        <button onClick={executeTrade} className={`mt-5 w-full rounded-2xl py-4 text-lg font-black shadow-xl transition ${side === 'buy' ? 'bg-emerald-400 text-slate-950 shadow-emerald-400/20 hover:bg-emerald-300' : 'bg-rose-400 text-slate-950 shadow-rose-400/20 hover:bg-rose-300'}`}>
          Place paper {side}
        </button>
      </Card>
    );
  }

  function renderPositions() {
    return (
      <Card>
        <h2 className="flex items-center gap-2 text-xl font-black text-white"><BarChart3 size={21} /> Open positions</h2>
        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-800">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr><th className="p-3 sm:p-4">Asset</th><th className="p-3 sm:p-4">Qty</th><th className="p-3 sm:p-4">Value</th><th className="p-3 sm:p-4">P/L</th></tr>
            </thead>
            <tbody>
              {Object.entries(state.positions).length === 0 ? (
                <tr><td className="p-4 text-slate-500" colSpan="4">No open positions.</td></tr>
              ) : Object.entries(state.positions).map(([symbol, pos]) => {
                const asset = assets.find((item) => item.symbol === symbol);
                const value = (asset?.price || 0) * pos.quantity;
                const pnl = value - pos.avgPrice * pos.quantity;
                return (
                  <tr key={symbol} className="border-t border-slate-800">
                    <td className="p-3 font-black text-white sm:p-4">{symbol}</td>
                    <td className="p-3 text-slate-300 sm:p-4">{pos.quantity.toFixed(4)}</td>
                    <td className="p-3 text-slate-300 sm:p-4">{currency(value)}</td>
                    <td className={`p-3 font-black sm:p-4 ${pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{currency(pnl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  function renderRecentTrades() {
    return (
      <Card>
        <h2 className="flex items-center gap-2 text-xl font-black text-white"><Trophy size={21} /> Recent trades</h2>
        <div className="mt-4 space-y-3">
          {state.trades.length === 0 ? (
            <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">No trades yet. Make one and write a thesis. No thesis, no trade. That is the house rule.</p>
          ) : state.trades.slice(0, 12).map((trade) => (
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
      </Card>
    );
  }

  function renderJournal() {
    return (
      <Card>
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
      </Card>
    );
  }

  function renderHome() {
    return (
      <div className="space-y-5">
        {renderStats()}
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          {renderMarketCard()}
          <div className="space-y-5">
            <Card>
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><Brain size={21} /> Coach note</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{lesson}</p>
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><ShieldCheck size={21} /> Risk snapshot</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Est. 4% risk</p>
                  <p className="mt-1 text-xl font-black text-white">{currency(estimatedRisk)}</p>
                </div>
                <div className="rounded-2xl bg-slate-900 p-4">
                  <p className="text-xs text-slate-500">Owned</p>
                  <p className="mt-1 text-xl font-black text-white">{position.quantity.toFixed(4)}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  function renderMarkets() {
    return (
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><LineChart size={21} /> Markets</h2>
          </div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
            <Search size={18} className="text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticker or name" className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500" />
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <Pill active={filter === 'all'} onClick={() => setFilter('all')}>All</Pill>
            <Pill active={filter === 'stock'} onClick={() => setFilter('stock')}>Stocks</Pill>
            <Pill active={filter === 'crypto'} onClick={() => setFilter('crypto')}>Crypto</Pill>
          </div>
          <Watchlist assets={filteredAssets} selectedSymbol={selectedSymbol} onSelect={selectMarket} />
        </Card>
        {renderPositions()}
      </div>
    );
  }

  function renderTrade() {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-5">
          {renderMarketCard()}
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <h3 className="flex items-center gap-2 font-black text-white"><ShieldCheck size={19} /> Risk box</h3>
              <p className="mt-3 text-sm text-slate-400">Estimated 4% stop loss</p>
              <p className="mt-1 text-2xl font-black text-white">{currency(estimatedRisk)}</p>
            </Card>
            <Card>
              <h3 className="flex items-center gap-2 font-black text-white"><CandlestickChart size={19} /> Position</h3>
              <p className="mt-3 text-sm text-slate-400">Owned shares/coins</p>
              <p className="mt-1 text-2xl font-black text-white">{position.quantity.toFixed(4)}</p>
            </Card>
          </div>
        </div>
        {renderOrderTicket()}
      </div>
    );
  }

  function renderJournalScreen() {
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        {renderRecentTrades()}
        {renderJournal()}
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card>
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><SlidersHorizontal size={21} /> Account settings</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Change your starting paper capital. Applying this resets cash, positions, trades, and journal so your P/L starts clean.
          </p>
          <label className="mt-5 block text-sm font-bold text-slate-300">Starting capital</label>
          <div className="mt-2 flex gap-3">
            <input
              value={capitalInput}
              onChange={(event) => setCapitalInput(event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-lg font-black text-white outline-none focus:border-emerald-400"
              inputMode="decimal"
              placeholder="100000"
            />
            <button onClick={applyStartingCapital} className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 shadow-xl shadow-emerald-400/20 hover:bg-emerald-300">
              Apply
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[1000, 10000, 100000].map((amount) => (
              <button key={amount} onClick={() => setCapitalInput(String(amount))} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-bold text-slate-200 hover:bg-slate-800">
                {currency(amount)}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><Wallet size={21} /> Current account</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Starting capital</p>
              <p className="mt-1 text-2xl font-black text-white">{currency(state.startingCash)}</p>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current equity</p>
              <p className="mt-1 text-2xl font-black text-white">{currency(equity)}</p>
            </div>
          </div>
          <button onClick={() => resetAccount(state.startingCash)} className="mt-5 w-full rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-4 font-black text-rose-200 hover:bg-rose-400/20">
            Reset account with current starting capital
          </button>
        </Card>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === 'markets') return renderMarkets();
    if (activeTab === 'trade') return renderTrade();
    if (activeTab === 'journal') return renderJournalScreen();
    if (activeTab === 'settings') return renderSettings();
    return renderHome();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_50%,_#020617)] text-slate-100">
      {renderHeader()}
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:px-8">
        {renderActiveTab()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 pb-3 pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-2 py-2 text-xs font-bold transition ${active ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/20' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
              >
                <Icon size={20} className="mx-auto" />
                <span className="mt-1 block">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
