import React, { useEffect, useState, useMemo } from "react";
import { getTicketStatistics, getTickets } from "../services/api";
import {
  Ticket, CheckCircle, Clock, AlertTriangle, XCircle, TrendingUp, RefreshCw,
  Users, Car, Calendar, PhilippinePeso,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const STATUS = {
  paid: { label: "Paid", color: "#1E8449", soft: "#E5F2EA", text: "#1E8449", icon: CheckCircle },
  issued: { label: "Issued", color: "#F0B429", soft: "#FBF1DC", text: "#92600A", icon: Clock },
  contested: { label: "Contested", color: "#C2541F", soft: "#FBEAE2", text: "#C2541F", icon: AlertTriangle },
  dismissed: { label: "Dismissed", color: "#C8202F", soft: "#FBE7E9", text: "#C8202F", icon: XCircle },
};

/* numbers ease up to their value when data loads */
const useCountUp = (target, ms = 900) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf, t0;
    const tick = (t) => {
      t0 ??= t;
      const p = Math.min((t - t0) / ms, 1);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
};
const Count = ({ value, prefix = "", suffix = "" }) => {
  const raw = Number(value) || 0;
  const v = useCountUp(raw);
  return <>{prefix}{(Number.isInteger(raw) ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString()}{suffix}</>;
};

const Dashboard = () => {
  const [stats, setStats] = useState({ total_tickets: 0, paid_tickets: 0, issued_tickets: 0, contested_tickets: 0, dismissed_tickets: 0, total_fines: 0, collected_fines: 0, collection_rate: 0 });
  const [recentTickets, setRecentTickets] = useState([]);
  const [ticketsByMonth, setTicketsByMonth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(null); // click a status card to focus it
  const [range, setRange] = useState(0);      // trend window in months, 0 = all

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const statsRes = await getTicketStatistics();
      if (statsRes && statsRes.data) {
        const d = statsRes.data;
        setStats({
          total_tickets: d.total_tickets || 0, paid_tickets: d.paid_tickets || 0, issued_tickets: d.issued_tickets || 0,
          contested_tickets: d.contested_tickets || 0, dismissed_tickets: d.dismissed_tickets || 0,
          total_fines: d.total_fines || 0, collected_fines: d.collected_fines || 0, collection_rate: d.collection_rate || 0,
        });
        setTicketsByMonth(d.tickets_by_month || []);
      }
      const ticketsRes = await getTickets(1, 5);
      let list = [];
      if (ticketsRes?.data?.data) list = ticketsRes.data.data;
      else if (ticketsRes?.data) list = ticketsRes.data;
      setRecentTickets(Array.isArray(list) ? list.slice(0, 5) : []);
    } catch (e) {
      setError("Failed to load dashboard data. Please make sure the API is running.");
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const getTotalFine = (t) => {
    if (!t) return 0;
    if (Array.isArray(t.violations) && t.violations.length > 0)
      return t.violations.reduce((s, v) => s + (parseFloat(v?.fine_amount) || 0), 0);
    return t.total_fine ? parseFloat(t.total_fine) || 0 : 0;
  };

  const counts = { paid: stats.paid_tickets, issued: stats.issued_tickets, contested: stats.contested_tickets, dismissed: stats.dismissed_tickets };
  const pieData = Object.entries(STATUS).map(([k, s]) => ({ key: k, name: s.label, value: counts[k], color: s.color })).filter((d) => d.value > 0);
  const chartData = useMemo(() => (range ? ticketsByMonth.slice(-range) : ticketsByMonth), [ticketsByMonth, range]);
  const shownTickets = filter ? recentTickets.filter((t) => t.status === filter) : recentTickets;
  const pending = (stats.total_fines || 0) - (stats.collected_fines || 0);

  const statCards = [
    { key: null, title: "Total Tickets", value: stats.total_tickets, icon: Ticket, color: "#16233F", soft: "#E9ECF2", text: "#16233F" },
    { key: "paid", title: "Paid Tickets", value: stats.paid_tickets, icon: CheckCircle, ...STATUS.paid },
    { key: "issued", title: "Issued/Pending", value: stats.issued_tickets, icon: Clock, ...STATUS.issued },
    { key: "contested", title: "Contested", value: stats.contested_tickets, icon: AlertTriangle, ...STATUS.contested },
    { key: "dismissed", title: "Dismissed", value: stats.dismissed_tickets, icon: XCircle, ...STATUS.dismissed },
    { key: undefined, title: "Collection Rate", value: stats.collection_rate, suffix: "%", icon: TrendingUp, color: "#3B5170", soft: "#EEF1F5", text: "#3B5170" },
  ];
  const quick = [
    { icon: Users, bg: "#E9ECF2", fg: "#16233F", value: stats.total_tickets, label: "Total Violations" },
    { icon: CheckCircle, bg: "#E5F2EA", fg: "#1E8449", value: stats.paid_tickets, label: "Resolved Cases" },
    { icon: Clock, bg: "#FBF1DC", fg: "#92600A", value: stats.issued_tickets, label: "Active Cases" },
    { icon: TrendingUp, bg: "#EEF1F5", fg: "#3B5170", value: stats.collection_rate, suffix: "%", label: "Efficiency Rate" },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="flex gap-2">{["#C8202F", "#F0B429", "#1E8449"].map((c, i) => (
        <span key={c} className="w-4 h-4 rounded-full animate-pulse" style={{ background: c, animationDelay: `${i * 200}ms` }} />))}
      </div>
      <div className="text-gray-500">Loading dashboard...</div>
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center justify-center h-96">
      <div className="text-[#C8202F] mb-4 text-lg">⚠️ {error}</div>
      <Button onClick={fetchData} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
    </div>
  );

  const empty = <div className="text-center py-12 text-gray-500">No data available</div>;
  const rate = Math.min(Number(stats.collection_rate) || 0, 100);
  const Title = ({ icon: Icon, color, children }) => (
    <h2 className="text-lg font-['Oswald'] font-medium text-[#1F2937] flex items-center gap-2">
      <Icon className="w-5 h-5" style={{ color }} />{children}
    </h2>
  );

  return (
    <div className="space-y-6 font-['Inter']">
      {/* Banner header */}
      <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)" }} />
        <div className="relative">
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[#C7CEDB] mt-1 max-w-xl">Welcome back! Here's what's happening with your traffic enforcement today.</p>
        </div>
        <div className="relative flex items-center gap-4">
          <div className="hidden sm:flex gap-1.5">{["#C8202F", "#F0B429", "#1E8449"].map((c) => <span key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}</div>
          <Button onClick={fetchData} variant="outline" size="sm" className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
        </div>
      </header>

      {/* Ticket-stub strip: click a status to focus Recent Tickets */}
      <section className="bg-white rounded-xl border border-[#E3E7EE] grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 overflow-hidden">
        {statCards.map((s, i) => {
          const clickable = s.key !== undefined;
          const active = clickable && s.key !== null && filter === s.key;
          const dim = filter && clickable && s.key !== null && filter !== s.key;
          return (
            <button key={s.title} type="button" disabled={!clickable} aria-pressed={active}
              onClick={() => setFilter(s.key === null || filter === s.key ? null : s.key)}
              className={`relative text-left p-5 border-dashed border-[#CBD5E1] border-b border-r transition-all duration-300 ${clickable ? "hover:bg-[#F8F9FB] cursor-pointer" : "cursor-default"} ${dim ? "opacity-40" : ""}`}
              style={active ? { background: s.soft } : undefined}>
              <span className="absolute top-0 left-0 right-0 h-1.5 transition-transform origin-left duration-500" style={{ background: s.color, transform: `scaleX(${active ? 1 : 0.3})` }} />
              <s.icon className="w-5 h-5 mb-3" style={{ color: s.text }} />
              <p className="text-4xl font-['Oswald'] font-semibold text-gray-800 tabular-nums leading-none"><Count value={s.value} suffix={s.suffix} /></p>
              <p className="text-xs text-gray-500 mt-2">{s.title}</p>
            </button>
          );
        })}
      </section>

      {/* Trend (wide) + status donut (narrow) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border-t-4 border-[#16233F] rounded-b-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Title icon={Calendar} color="#16233F">Monthly Ticket Trend</Title>
            <div className="flex bg-[#EEF0F4] rounded-full p-1 text-xs">
              {[[3, "3M"], [6, "6M"], [0, "All"]].map(([v, l]) => (
                <button key={l} onClick={() => setRange(v)} className={`px-3 py-1 rounded-full transition-all ${range === v ? "bg-[#16233F] text-white" : "text-[#64748B] hover:text-[#16233F]"}`}>{l}</button>
              ))}
            </div>
          </div>
          {chartData.length === 0 ? empty : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F0B429" stopOpacity={0.5} /><stop offset="100%" stopColor="#F0B429" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#D5DAE3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 6px 24px #16233F22" }} />
                <Legend />
                <Area type="monotone" dataKey="tickets" name="Tickets Issued" stroke="#16233F" strokeWidth={2.5} fill="url(#tg)" dot={{ fill: "#16233F", r: 4 }} activeDot={{ r: 7, fill: "#F0B429", stroke: "#16233F", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="lg:col-span-4 bg-[#F6F1E4] rounded-xl p-6">
          <div className="mb-4"><Title icon={TrendingUp} color="#3B5170">Ticket Status Distribution</Title></div>
          {pieData.length === 0 ? empty : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  onClick={(d) => setFilter(filter === d.key ? null : d.key)} style={{ cursor: "pointer" }}>
                  {pieData.map((e) => <Cell key={e.key} fill={e.color} fillOpacity={!filter || filter === e.key ? 1 : 0.3} stroke={filter === e.key ? "#16233F" : "none"} strokeWidth={2} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* Finance (navy, road gauge) + ticket timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-[#16233F] text-white rounded-xl p-6">
          <div className="mb-6"><h2 className="text-lg font-['Oswald'] font-medium flex items-center gap-2"><PhilippinePeso className="w-5 h-5 text-[#F0B429]" />Financial Summary</h2></div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#C7CEDB]">Collection Rate</span>
            <span className="font-semibold text-[#F0B429]">{stats.collection_rate}%</span>
          </div>
          <div className="relative h-8 mb-6">
            <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[#0C1427]" />
            <div className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[#1E8449] transition-all duration-1000" style={{ width: `${rate}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 bg-[#F0B429] text-[#16233F] rounded-full p-1.5" style={{ left: `calc(${rate}% - 14px)` }}><Car className="w-4 h-4" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-[#C7CEDB] mb-1">Collected Fines</p>
              <p className="text-2xl font-['Oswald'] font-semibold text-[#5FD28C] tabular-nums"><Count value={stats.collected_fines} prefix="₱" /></p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-[#C7CEDB] mb-1">Pending Collection</p>
              <p className="text-2xl font-['Oswald'] font-semibold text-[#F0B429] tabular-nums"><Count value={pending} prefix="₱" /></p>
            </div>
          </div>
          <div className="flex justify-between items-baseline mt-6 pt-4 border-t border-white/10">
            <span className="text-[#C7CEDB] text-sm">Total Fines Issued</span>
            <span className="text-2xl font-['Oswald'] font-semibold tabular-nums"><Count value={stats.total_fines} prefix="₱" /></span>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white rounded-xl border border-[#E3E7EE] p-6">
          <div className="flex items-center justify-between mb-6">
            <Title icon={Ticket} color="#16233F">Recent Tickets</Title>
            {filter
              ? <button onClick={() => setFilter(null)} className="text-xs px-3 py-1 rounded-full bg-[#EEF0F4] text-[#16233F] hover:bg-[#E3E7EE]">{STATUS[filter].label} only · clear</button>
              : <span className="text-xs text-gray-400">Last 5 tickets</span>}
          </div>
          {shownTickets.length === 0 ? <div className="text-center py-12 text-gray-500">No tickets found</div> : (
            <ol className="relative ml-2 border-l-2 border-dashed border-[#CBD5E1] space-y-5">
              {shownTickets.map((t) => {
                const s = STATUS[t.status]; const Icon = s?.icon;
                return (
                  <li key={t.ticket_id} className="relative pl-6 group">
                    <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-[3px] border-white ring-2 transition-transform group-hover:scale-125" style={{ background: s?.color || "#CBD5E1", "--tw-ring-color": s?.color || "#CBD5E1" }} />
                    <div className="flex items-start justify-between gap-3 rounded-lg p-3 -my-1 group-hover:bg-[#F8F9FB] transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-sm font-semibold text-gray-800">{t.ticket_number}</span>
                          {s && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: s.soft, color: s.text }}><Icon className="w-3.5 h-3.5" />{t.status?.toUpperCase()}</span>}
                        </div>
                        <p className="text-sm text-gray-600">{t.violator?.firstname} {t.violator?.lastname}</p>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          <p className="text-xs text-gray-400"><Car className="w-3 h-3 inline mr-1" />{t.vehicle?.platenumber}</p>
                          <p className="text-xs text-gray-400"><Calendar className="w-3 h-3 inline mr-1" />{t.violation_datetime ? new Date(t.violation_datetime).toLocaleDateString() : "N/A"}</p>
                        </div>
                      </div>
                      <p className="text-lg font-['Oswald'] font-semibold text-[#C8202F] tabular-nums shrink-0">₱{getTotalFine(t).toLocaleString()}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Quick stats band */}
      <section className="bg-[#16233F] rounded-xl grid grid-cols-2 md:grid-cols-4 md:divide-x divide-white/10 text-white">
        {quick.map((q) => (
          <div key={q.label} className="p-5 flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: q.bg }}><q.icon className="w-5 h-5" style={{ color: q.fg }} /></div>
            <div>
              <p className="text-2xl font-['Oswald'] font-semibold tabular-nums"><Count value={q.value} suffix={q.suffix} /></p>
              <p className="text-xs text-[#C7CEDB]">{q.label}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Dashboard;