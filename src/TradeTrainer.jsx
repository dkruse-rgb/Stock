import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, BarChart3, BookOpen, Brain, CandlestickChart, Coins, DollarSign, Home, LineChart, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Trophy, Wallet } from 'lucide-react';

const DEFAULT_CASH = 100000;
const STORAGE_KEY = 'trade-trainer-v3';
const LEGACY_KEYS = ['trade-trainer-v2', 'trade-trainer-v1'];
const ASSETS = [
  { id: 'apple', symbol: 'AAPL', name: 'Apple', type: 'stock', price: 271.35, change24h: 0.31, volatility: 0.012 },
  { id: 'tesla', symbol: 'TSLA', name: 'Tesla', type: 'stock', price: 291.4, change24h: -1.84, volatility: 0.026 },
  { id: 'nvidia', symbol: 'NVDA', name: 'NVIDIA', type: 'stock', price: 113.6, change24h: 1.21, volatility: 0.021 },
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', type: 'crypto', price: 65000, change24h: 2.4, volatility: 0.032 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', type: 'crypto', price: 3200, change24h: 1.6, volatility: 0.038 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', type: 'crypto', price: 145, change24h: -0.9, volatility: 0.047 },
];
const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'markets', label: 'Markets', icon: LineChart },
  { id: 'trade', label: 'Trade', icon: CandlestickChart },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const LESSONS = [
  'Good traders ask what proves them wrong before asking how high it can go.',
  'Risk size beats prediction. The goal is to survive bad guesses.',
  'No thesis, no trade. Otherwise it is just button-clicking with decorations.',
  'A stop loss is not pessimism. It is an escape hatch.',
  'Overtrading is how boredom dresses up as strategy.',
];

function fresh(startingCash = DEFAULT_CASH) {
  return { startingCash, cash: startingCash, positions: {}, trades: [], journal: [] };
}
function normalize(data) {
  if (!data) return fresh();
  const startingCash = Number(data.startingCash || DEFAULT_CASH);
  return { startingCash, cash: Number.isFinite(data.cash) ? data.cash : startingCash, positions: data.positions || {}, trades: data.trades || [], journal: data.journal || [] };
}
function loadState() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (current) return normalize(current);
    for (const key of LEGACY_KEYS) {
      const older = JSON.parse(localStorage.getItem(key));
      if (older) return normalize(older);
    }
  } catch (error) {
    console.warn('Failed to load account', error);
  }
  return fresh();
}
function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(Number.isFinite(value) ? value : 0);
}
function pct(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
function gradeClass(g) {
  return g === 'A' ? 'bg-emerald-400 text-slate-950' : g === 'B' ? 'bg-lime-300 text-slate-950' : g === 'C' ? 'bg-yellow-300 text-slate-950' : g === 'D' ? 'bg-orange-300 text-slate-950' : 'bg-rose-400 text-slate-950';
}
function nudge(asset) {
  const move = Math.sin(Date.now() / 15000 + asset.symbol.length) * asset.volatility;
  return { ...asset, price: Math.max(0.01, Number((asset.price * (1 + move * 0.03)).toFixed(2))), change24h: asset.change24h + move * 3 };
}
function series(asset) {
  const seed = asset.symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  let price = asset.price * (1 - asset.change24h / 100);
  return Array.from({ length: 48 }, (_, i) => {
    const wave = Math.sin((i + seed) / 4) * asset.volatility;
    price = Math.max(0.01, price * (1 + asset.change24h / 100 / 48 + wave * 0.08));
    return { time: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, price: Number((i === 47 ? asset.price : price).toFixed(2)) };
  });
}
function scoreTrade({ side, note, tradeValue, risk, equity, asset, owned }) {
  let score = 100;
  const feedback = [];
  const words = note.trim().split(/\s+/).filter(Boolean).length;
  const riskPct = equity ? (risk / equity) * 100 : 0;
  const sizePct = equity ? (tradeValue / equity) * 100 : 0;
  if (words < 5) { score -= 22; feedback.push('Trade thesis is weak. Write the setup, invalidation, and exit plan before entering.'); }
  else if (words < 12) { score -= 8; feedback.push('Thesis exists, but it needs more detail. Add what would prove the trade wrong.'); }
  else feedback.push('Good thesis. You are trading with a plan instead of vibes and caffeine.');
  if (riskPct > 5) { score -= 28; feedback.push(`Risk is ${riskPct.toFixed(2)}% of equity. That is danger-zone sizing.`); }
  else if (riskPct > 2) { score -= 14; feedback.push(`Risk is ${riskPct.toFixed(2)}% of equity. Manageable, but spicy.`); }
  else feedback.push(`Risk is ${riskPct.toFixed(2)}% of equity. Nice controlled risk.`);
  if (sizePct > 50) { score -= 22; feedback.push(`Position size is ${sizePct.toFixed(2)}% of equity. Way too concentrated.`); }
  else if (sizePct > 25) { score -= 10; feedback.push(`Position size is ${sizePct.toFixed(2)}% of equity. Concentrated, but not absurd.`); }
  if (side === 'buy' && asset.change24h > 4) { score -= 15; feedback.push('Asset is already up big today. Watch for chasing.'); }
  if (side === 'sell' && owned <= 0) { score -= 20; feedback.push('Selling without a position is bad process. Know what you own first.'); }
  score = Math.max(0, Math.round(score));
  return { score, grade: grade(score), riskPct, sizePct, feedback };
}
function Card({ children, className = '' }) {
  return <section className={`rounded-[1.75rem] border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-black/20 ${className}`}>{children}</section>;
}
function GradeBadge({ score }) {
  if (!score) return null;
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${gradeClass(score.grade)}`}>Grade {score.grade} · {score.score}</span>;
}

export default function TradeTrainer() {
  const [account, setAccount] = useState(loadState);
  const [assets, setAssets] = useState(ASSETS);
  const [symbol, setSymbol] = useState('BTC');
  const [tab, setTab] = useState('home');
  const [side, setSide] = useState('buy');
  const [qtyText, setQtyText] = useState('0.25');
  const [note, setNote] = useState('Breakout attempt with defined risk and invalidation.');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [capital, setCapital] = useState(String(account.startingCash));
  const [loading, setLoading] = useState(false);
  const [lastScore, setLastScore] = useState(null);
  const asset = assets.find((item) => item.symbol === symbol) || assets[0];
  const qty = Number(qtyText) || 0;
  const position = account.positions[asset.symbol] || { quantity: 0, avgPrice: 0 };
  const positionsValue = useMemo(() => Object.entries(account.positions).reduce((sum, [sym, pos]) => sum + (assets.find((item) => item.symbol === sym)?.price || 0) * pos.quantity, 0), [account.positions, assets]);
  const equity = account.cash + positionsValue;
  const pnl = equity - account.startingCash;
  const tradeValue = qty * asset.price;
  const risk = Math.max(0, (asset.price - asset.price * 0.96) * qty);
  const chart = useMemo(() => series(asset), [asset]);
  const previewScore = scoreTrade({ side, note, tradeValue, risk, equity, asset, owned: position.quantity });
  const avgScore = account.trades.length ? Math.round(account.trades.reduce((sum, trade) => sum + (trade.score?.score || 0), 0) / account.trades.length) : null;
  const lesson = LESSONS[account.trades.length % LESSONS.length];

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(account)), [account]);
  useEffect(() => { refreshPrices(); const id = setInterval(refreshPrices, 60000); return () => clearInterval(id); }, []);

  async function refreshPrices() {
    setLoading(true);
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
      if (!res.ok) throw new Error('CoinGecko failed');
      const data = await res.json();
      setAssets((items) => items.map((item) => {
        if (item.type !== 'crypto') return nudge(item);
        const live = data[item.id];
        return live?.usd ? { ...item, price: live.usd, change24h: live.usd_24h_change ?? item.change24h } : nudge(item);
      }));
    } catch (error) {
      setAssets((items) => items.map(nudge));
    } finally { setLoading(false); }
  }
  function placeTrade() {
    if (qty <= 0) return;
    setAccount((current) => {
      const currentPosition = current.positions[asset.symbol] || { quantity: 0, avgPrice: 0 };
      if (side === 'buy' && tradeValue > current.cash) return current;
      if (side === 'sell' && qty > currentPosition.quantity) return current;
      const currentEquity = current.cash + positionsValue;
      const score = scoreTrade({ side, note, tradeValue, risk, equity: currentEquity, asset, owned: currentPosition.quantity });
      const positions = { ...current.positions };
      let cash = current.cash;
      if (side === 'buy') {
        const newQty = currentPosition.quantity + qty;
        positions[asset.symbol] = { quantity: newQty, avgPrice: ((currentPosition.quantity * currentPosition.avgPrice) + tradeValue) / newQty };
        cash -= tradeValue;
      } else {
        const remaining = currentPosition.quantity - qty;
        cash += tradeValue;
        if (remaining <= 0.0000001) delete positions[asset.symbol];
        else positions[asset.symbol] = { ...currentPosition, quantity: remaining };
      }
      const trade = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), side, symbol: asset.symbol, name: asset.name, quantity: qty, price: asset.price, value: tradeValue, note, score };
      setLastScore(score);
      return { ...current, cash, positions, trades: [trade, ...current.trades].slice(0, 100), journal: [{ id: trade.id, symbol: asset.symbol, text: note.trim() || 'No thesis written.', createdAt: trade.timestamp, score }, ...current.journal].slice(0, 60) };
    });
  }
  function reset(newCapital = account.startingCash) {
    const amount = Math.max(100, Number(newCapital) || DEFAULT_CASH);
    const next = fresh(amount);
    setAccount(next);
    setCapital(String(amount));
    setLastScore(null);
  }
  function selectAsset(nextSymbol) { setSymbol(nextSymbol); setTab('trade'); }

  const filtered = assets.filter((item) => (filter === 'all' || item.type === filter) && `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase()));
  const cardStats = [
    ['Equity', money(equity), 'Cash + positions', Wallet],
    ['Cash', money(account.cash), 'Available balance', DollarSign],
    ['P/L', `${money(pnl)} (${pct(account.startingCash ? (pnl / account.startingCash) * 100 : 0)})`, `Start ${money(account.startingCash)}`, BarChart3],
    ['Avg grade', avgScore ? `${grade(avgScore)} / ${avgScore}` : '—', 'Trade discipline', Award],
  ];

  const Header = <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 px-4 py-4 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between"><div><div className="mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200"><Sparkles size={14}/> Paper trading lab</div><h1 className="text-2xl font-black text-white">TradeTrainer</h1></div><button onClick={refreshPrices} className="rounded-2xl bg-slate-800 p-3 text-white"><RefreshCw className={loading ? 'animate-spin' : ''} size={19}/></button></div></header>;
  const Stats = <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cardStats.map(([label, value, sub, Icon]) => <Card key={label} className="p-4"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div><div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><Icon size={20}/></div></div></Card>)}</section>;
  const ChartCard = <Card><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Selected market</p><h2 className="mt-1 text-3xl font-black text-white">{asset.name} <span className="text-slate-500">{asset.symbol}</span></h2><p className="mt-2 text-slate-400">Current quote <b className="text-white">{money(asset.price)}</b></p></div><div className={`rounded-2xl px-4 py-3 font-black ${asset.change24h >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{pct(asset.change24h)}</div></div><div className="h-72 rounded-3xl bg-slate-900/70 p-3"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)"/><XAxis dataKey="time" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/><YAxis domain={['dataMin','dataMax']} tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false} width={58}/><Tooltip contentStyle={{ background:'#020617', border:'1px solid #1e293b', borderRadius:18 }} formatter={(v) => [money(v), 'Price']}/><Area type="monotone" dataKey="price" stroke="currentColor" strokeWidth={3} fill="currentColor" fillOpacity={.12} className={asset.change24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}/></AreaChart></ResponsiveContainer></div></Card>;
  const ScoreCard = <Card><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-black text-white"><Award size={21}/> Trade score</h2><GradeBadge score={lastScore || previewScore}/></div><div className="mt-4 rounded-3xl bg-slate-900 p-4"><div className="flex justify-between text-sm font-bold text-slate-300"><span>Discipline score</span><span>{(lastScore || previewScore).score}/100</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${(lastScore || previewScore).score}%` }}/></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-500">Risk</p><p className="font-black text-white">{(lastScore || previewScore).riskPct.toFixed(2)}%</p></div><div className="rounded-2xl bg-slate-950 p-3"><p className="text-slate-500">Size</p><p className="font-black text-white">{(lastScore || previewScore).sizePct.toFixed(2)}%</p></div></div></div><div className="mt-4 space-y-2">{(lastScore || previewScore).feedback.map((line) => <p key={line} className="rounded-2xl bg-slate-900/70 p-3 text-sm leading-6 text-slate-300">{line}</p>)}</div></Card>;
  const Order = <Card><h2 className="flex items-center gap-2 text-xl font-black text-white"><Coins size={21}/> Order ticket</h2><div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-900 p-1"><button onClick={() => setSide('buy')} className={`rounded-xl py-3 font-black ${side === 'buy' ? 'bg-emerald-400 text-slate-950' : 'text-slate-400'}`}>Buy</button><button onClick={() => setSide('sell')} className={`rounded-xl py-3 font-black ${side === 'sell' ? 'bg-rose-400 text-slate-950' : 'text-slate-400'}`}>Sell</button></div><label className="mt-5 block text-sm font-bold text-slate-300">Quantity</label><input value={qtyText} onChange={(e)=>setQtyText(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-lg font-bold text-white outline-none focus:border-emerald-400" inputMode="decimal"/><label className="mt-5 block text-sm font-bold text-slate-300">Trade thesis</label><textarea value={note} onChange={(e)=>setNote(e.target.value)} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"/><div className="mt-5 rounded-3xl bg-slate-900/70 p-4 text-sm text-slate-300"><div className="flex justify-between"><span>Market</span><b>{asset.symbol}</b></div><div className="mt-2 flex justify-between"><span>Trade value</span><b>{money(tradeValue)}</b></div><div className="mt-2 flex justify-between"><span>Est. 4% risk</span><b>{money(risk)}</b></div><div className="mt-2 flex justify-between"><span>Preview grade</span><b>{previewScore.grade} / {previewScore.score}</b></div></div><button onClick={placeTrade} className={`mt-5 w-full rounded-2xl py-4 text-lg font-black shadow-xl ${side === 'buy' ? 'bg-emerald-400 text-slate-950' : 'bg-rose-400 text-slate-950'}`}>Place paper {side}</button></Card>;
  const Markets = <Card><h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><LineChart size={21}/> Markets</h2><div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"><Search size={18} className="text-slate-500"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search ticker or name" className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"/></div><div className="mb-4 flex gap-2"><button onClick={()=>setFilter('all')} className={`rounded-full px-4 py-2 text-sm font-bold ${filter==='all'?'bg-emerald-400 text-slate-950':'bg-slate-900 text-slate-300'}`}>All</button><button onClick={()=>setFilter('stock')} className={`rounded-full px-4 py-2 text-sm font-bold ${filter==='stock'?'bg-emerald-400 text-slate-950':'bg-slate-900 text-slate-300'}`}>Stocks</button><button onClick={()=>setFilter('crypto')} className={`rounded-full px-4 py-2 text-sm font-bold ${filter==='crypto'?'bg-emerald-400 text-slate-950':'bg-slate-900 text-slate-300'}`}>Crypto</button></div><div className="space-y-3">{filtered.map((item)=><button key={item.symbol} onClick={()=>selectAsset(item.symbol)} className={`w-full rounded-3xl border p-4 text-left ${symbol===item.symbol?'border-emerald-400/70 bg-emerald-400/10':'border-slate-800 bg-slate-900/60'}`}><div className="flex justify-between gap-3"><div><p className="font-black text-white">{item.symbol}</p><p className="text-sm text-slate-400">{item.name}</p></div><div className="text-right"><p className="font-bold text-white">{money(item.price)}</p><p className={`text-sm font-bold ${item.change24h>=0?'text-emerald-300':'text-rose-300'}`}>{pct(item.change24h)}</p></div></div></button>)}</div></Card>;
  const Positions = <Card><h2 className="flex items-center gap-2 text-xl font-black text-white"><BarChart3 size={21}/> Open positions</h2><div className="mt-4 space-y-3">{Object.entries(account.positions).length === 0 ? <p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">No open positions.</p> : Object.entries(account.positions).map(([sym,pos])=>{const item=assets.find((a)=>a.symbol===sym); const value=(item?.price||0)*pos.quantity; const pl=value-pos.avgPrice*pos.quantity; return <div key={sym} className="rounded-2xl bg-slate-900 p-4"><div className="flex justify-between"><b className="text-white">{sym}</b><b className={pl>=0?'text-emerald-300':'text-rose-300'}>{money(pl)}</b></div><p className="mt-1 text-sm text-slate-400">{pos.quantity.toFixed(4)} · value {money(value)}</p></div>})}</div></Card>;
  const Journal = <div className="grid gap-5 xl:grid-cols-2"><Card><h2 className="flex items-center gap-2 text-xl font-black text-white"><Trophy size={21}/> Recent trades</h2><div className="mt-4 space-y-3">{account.trades.length===0?<p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">No trades yet.</p>:account.trades.slice(0,15).map((t)=><div key={t.id} className="rounded-2xl bg-slate-900 p-4"><div className="flex justify-between gap-3"><div><p className="font-black text-white"><span className={t.side==='buy'?'text-emerald-300':'text-rose-300'}>{t.side.toUpperCase()}</span> {t.symbol}</p><p className="text-xs text-slate-500">{new Date(t.timestamp).toLocaleString()}</p></div><div className="text-right"><p className="font-bold text-white">{money(t.value)}</p><GradeBadge score={t.score}/></div></div><p className="mt-2 text-sm text-slate-400">{t.quantity} @ {money(t.price)}</p>{t.score?.feedback?.[0]&&<p className="mt-2 text-xs text-slate-500">{t.score.feedback[0]}</p>}</div>)}</div></Card><Card><h2 className="flex items-center gap-2 text-xl font-black text-white"><BookOpen size={21}/> Trade journal</h2><div className="mt-4 space-y-3">{account.journal.length===0?<p className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-400">Journal entries show up after trades.</p>:account.journal.map((j)=><div key={j.id} className="rounded-2xl bg-slate-900 p-4"><div className="flex justify-between"><b className="text-white">{j.symbol}</b><GradeBadge score={j.score}/></div><p className="mt-2 text-sm text-slate-300">{j.text}</p>{j.score?.feedback?.slice(0,2).map((f)=><p key={f} className="mt-2 text-xs text-slate-500">{f}</p>)}</div>)}</div></Card></div>;
  const SettingsScreen = <div className="mx-auto max-w-3xl space-y-5"><Card><h2 className="flex items-center gap-2 text-xl font-black text-white"><SlidersHorizontal size={21}/> Account settings</h2><p className="mt-2 text-sm leading-6 text-slate-400">Change starting paper capital. Applying it resets cash, positions, trades, journal, and score history.</p><label className="mt-5 block text-sm font-bold text-slate-300">Starting capital</label><div className="mt-2 flex gap-3"><input value={capital} onChange={(e)=>setCapital(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-lg font-black text-white outline-none focus:border-emerald-400" inputMode="decimal"/><button onClick={()=>{reset(capital); setTab('home');}} className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Apply</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[1000,10000,100000].map((amount)=><button key={amount} onClick={()=>setCapital(String(amount))} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-bold text-slate-200">{money(amount)}</button>)}</div></Card><Card><h2 className="flex items-center gap-2 text-xl font-black text-white"><Wallet size={21}/> Current account</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-900 p-4"><p className="text-xs uppercase tracking-widest text-slate-500">Starting</p><p className="mt-1 text-2xl font-black text-white">{money(account.startingCash)}</p></div><div className="rounded-2xl bg-slate-900 p-4"><p className="text-xs uppercase tracking-widest text-slate-500">Equity</p><p className="mt-1 text-2xl font-black text-white">{money(equity)}</p></div><div className="rounded-2xl bg-slate-900 p-4"><p className="text-xs uppercase tracking-widest text-slate-500">Avg score</p><p className="mt-1 text-2xl font-black text-white">{avgScore ?? '—'}</p></div></div><button onClick={()=>reset(account.startingCash)} className="mt-5 w-full rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-4 font-black text-rose-200">Reset account</button></Card></div>;
  const HomeScreen = <div className="space-y-5">{Stats}<div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">{ChartCard}<div className="space-y-5">{ScoreCard}<Card><h2 className="flex items-center gap-2 text-xl font-black text-white"><Brain size={21}/> Coach note</h2><p className="mt-3 text-sm leading-6 text-slate-300">{lesson}</p></Card></div></div></div>;
  const TradeScreen = <div className="grid gap-5 xl:grid-cols-[1.35fr_.95fr]"><div className="space-y-5">{ChartCard}{ScoreCard}<div className="grid gap-5 sm:grid-cols-2"><Card><h3 className="flex items-center gap-2 font-black text-white"><ShieldCheck size={19}/> Risk box</h3><p className="mt-3 text-sm text-slate-400">Estimated 4% stop loss</p><p className="mt-1 text-2xl font-black text-white">{money(risk)}</p></Card><Card><h3 className="flex items-center gap-2 font-black text-white"><CandlestickChart size={19}/> Position</h3><p className="mt-3 text-sm text-slate-400">Owned shares/coins</p><p className="mt-1 text-2xl font-black text-white">{position.quantity.toFixed(4)}</p></Card></div></div>{Order}</div>;
  const MarketsScreen = <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">{Markets}{Positions}</div>;
  const screen = tab === 'markets' ? MarketsScreen : tab === 'trade' ? TradeScreen : tab === 'journal' ? Journal : tab === 'settings' ? SettingsScreen : HomeScreen;

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,.18),_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_50%,_#020617)] text-slate-100">{Header}<main className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:px-8">{screen}</main><nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 pb-3 pt-2 backdrop-blur-xl"><div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">{TABS.map((item)=>{const Icon=item.icon; const active=tab===item.id; return <button key={item.id} onClick={()=>setTab(item.id)} className={`rounded-2xl px-2 py-2 text-xs font-bold transition ${active?'bg-emerald-400 text-slate-950':'text-slate-400 hover:bg-slate-900 hover:text-white'}`}><Icon size={20} className="mx-auto"/><span className="mt-1 block">{item.label}</span></button>})}</div></nav></div>;
}
