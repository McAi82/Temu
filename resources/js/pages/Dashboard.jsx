import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getTicketStatistics, getTickets, getOverduePayments } from "../services/api";
import {
  Ticket, CheckCircle, Clock, XCircle, TrendingUp, RefreshCw,
  Users, Car, Calendar, PhilippinePeso, Gavel, ArrowRight,
  TrendingDown, Minus, Check,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";

const STATUS = {
  paid: { label: "Paid", color: "#1E8449", soft: "#E5F2EA", text: "#1E8449", icon: CheckCircle },
  issued: { label: "Issued", color: "#F0B429", soft: "#FBF1DC", text: "#92600A", icon: Clock },
};
const ARCHIVED = { label: "Archived", color: "#C8202F", soft: "#FBE7E9", text: "#C8202F", icon: XCircle };

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

// Recency of an in-court row: uses the first date field present, falling back to the id.
const courtSortKey = (r) => {
  const t = r?.ticket || r || {};
  const raw = r?.due_date ?? r?.deadline ?? t.due_date ?? t.deadline ?? t.violation_datetime ?? t.created_at ?? r?.created_at;
  const time = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isNaN(time)) return time;
  return Number(t.ticket_id ?? r?.id) || 0;
};

const EMPTY_STATS = {
  total_tickets: 0,
  paid_tickets: 0,
  issued_tickets: 0,
  total_fines: 0,
  collected_fines: 0,
  collection_rate: 0,
  court_total: 0,
  tickets_by_day: [],
  top_violations: [],
  trend: null,
  status: null,
};

const DeltaPill = ({ direction, delta, suffix = "" }) => {
  const isUp = direction === "up";
  const isDown = direction === "down";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const cls = isUp
    ? "bg-[#E5F2EA] text-[#1E8449]"
    : isDown
      ? "bg-[#FBE7E9] text-[#C8202F]"
      : "bg-[#EEF0F4] text-[#5F6779]";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {isUp ? "+" : ""}{delta}{suffix}
    </span>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [recentTickets, setRecentTickets] = useState([]);
  const [courtViolators, setCourtViolators] = useState([]);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const navigate = useNavigate();
  const [ticketsByMonth, setTicketsByMonth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(null);
  const [range, setRange] = useState(0);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const statsRes = await getTicketStatistics();
      if (statsRes && statsRes.data) {
        const d = statsRes.data;
        setStats({
          total_tickets: d.total_tickets || 0,
          paid_tickets: d.paid_tickets || 0,
          issued_tickets: d.issued_tickets || 0,
          total_fines: d.total_fines || 0,
          collected_fines: d.collected_fines || 0,
          collection_rate: d.collection_rate || 0,
          court_total: d.court_total || 0,
          tickets_by_day: d.tickets_by_day || [],
          top_violations: d.top_violations || [],
          trend: d.trend || null,
          status: d.status || null,
        });
        setArchivedTotal(d.archived_tickets || 0);
        setTicketsByMonth(d.tickets_by_month || []);
      }

      // Only the 5 rows for the In Court table — the count now comes from stats.
      const ticketsRes = await getTickets(1, 5);
      let list = [];
      if (ticketsRes?.data?.data) list = ticketsRes.data.data;
      else if (ticketsRes?.data) list = ticketsRes.data;
      setRecentTickets(Array.isArray(list) ? list.slice(0, 5) : []);

      try {
        const courtRes = await getOverduePayments(1, 5);
        const body = courtRes?.data;
        const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setCourtViolators(
          [...rows].sort((a, b) => courtSortKey(b) - courtSortKey(a)).slice(0, 5)
        );
      } catch {
        setCourtViolators([]);
      }
    } catch (e) {
      setError("Failed to load dashboard data. Please make sure the API is running.");
    } finally {
      setLoading(false);
      setTimeout(() => setRefreshing(false), 600);
    }
  };
  useEffect(() => { fetchData(); }, []);

  const getTotalFine = (t) => {
    if (!t) return 0;
    if (Array.isArray(t.violations) && t.violations.length > 0)
      return t.violations.reduce((s, v) => s + (parseFloat(v?.fine_amount) || 0), 0);
    return t.total_fine ? parseFloat(t.total_fine) || 0 : 0;
  };

  const getBalance = (t) => {
    if (!t) return 0;
    if (t.balance != null) return parseFloat(t.balance) || 0;
    return Math.max(0, getTotalFine(t) - (parseFloat(t.total_paid) || 0));
  };

  const counts = {
    paid: stats.paid_tickets,
    issued: stats.issued_tickets,
  };
  const pieData = [
    ...Object.entries(STATUS).map(([k, s]) => ({ key: k, name: s.label, value: counts[k], color: s.color })),
    { key: "archived", name: ARCHIVED.label, value: archivedTotal, color: ARCHIVED.color },
  ].filter((d) => d.value > 0);
  const chartData = useMemo(() => (range ? ticketsByMonth.slice(-range) : ticketsByMonth), [ticketsByMonth, range]);
  const shownTickets = filter ? recentTickets.filter((t) => t.status === filter) : recentTickets;
  const pending = (stats.total_fines || 0) - (stats.collected_fines || 0);

  // Server-computed insights (no more JS math). The chart still responds to
  // the 3M/6M/All toggle, but the strip's "peak"/"average" are anchored to the
  // full monthly window, so toggling never silently changes the headline.
  const trendInsight = stats.trend;
  const statusInsight = stats.status;
  const courtTotal = stats.court_total || 0;

  const statCards = [
    { to: "/tickets", title: "Total Tickets", value: stats.total_tickets, icon: Ticket, color: "#16233F", soft: "#E9ECF2", text: "#16233F" },
    { to: "/tickets?status=paid", title: "Paid Tickets", value: stats.paid_tickets, icon: CheckCircle, ...STATUS.paid },
    { to: "/tickets?status=issued", title: "Issued/Pending", value: stats.issued_tickets, icon: Clock, ...STATUS.issued },
    { to: "/archives?tab=tickets", title: "Archived", value: archivedTotal, icon: XCircle, ...ARCHIVED },
    { to: "/payments", title: "In Court", value: courtTotal, icon: Gavel, color: "#7A1621", soft: "#F6E3E5", text: "#7A1621" },
    { to: "/payments", title: "Collection Rate", value: stats.collection_rate, suffix: "%", icon: TrendingUp, color: "#3B5170", soft: "#EEF1F5", text: "#3B5170" },
  ];
  const quick = [
    { to: "/tickets", icon: Users, bg: "#E9ECF2", fg: "#16233F", value: stats.total_tickets, label: "Total Violations" },
    { to: "/tickets?status=paid", icon: CheckCircle, bg: "#E5F2EA", fg: "#1E8449", value: stats.paid_tickets, label: "Resolved Cases" },
    { to: "/tickets?status=issued", icon: Clock, bg: "#FBF1DC", fg: "#92600A", value: stats.issued_tickets, label: "Active Cases" },
    { to: "/payments", icon: TrendingUp, bg: "#EEF1F5", fg: "#3B5170", value: stats.collection_rate, suffix: "%", label: "Efficiency Rate" },
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
      <Button onClick={() => fetchData()} variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
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
      <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)" }} />
        <div className="relative">
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[#C7CEDB] mt-1 max-w-xl">Welcome back! Here's what's happening with your traffic enforcement today.</p>
        </div>
        <div className="relative flex items-center gap-4">
          <div className="hidden sm:flex gap-1.5">{["#C8202F", "#F0B429", "#1E8449"].map((c) => <span key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}</div>
          <Button
            onClick={() => fetchData(true)}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </header>

      <section className="bg-white rounded-xl border border-[#E3E7EE] grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 overflow-hidden">
        {statCards.map((s) => (
          <Link key={s.title} to={s.to}
            className="group relative block text-left p-5 border-dashed border-[#CBD5E1] border-b border-r transition-colors duration-200 hover:bg-[#F8F9FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#16233F] focus-visible:-outline-offset-2"
            style={{ "--card-soft": s.soft }}>
            <span className="absolute top-0 left-0 right-0 h-1.5 transition-transform origin-left duration-300 scale-x-[0.3] group-hover:scale-x-100" style={{ background: s.color }} />
            <s.icon className="w-5 h-5 mb-3" style={{ color: s.text }} />
            <p className="text-4xl font-['Oswald'] font-semibold text-gray-800 tabular-nums leading-none"><Count value={s.value} suffix={s.suffix} /></p>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">{s.title}<ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" /></p>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ---------------- MONTHLY TREND (with insight strip) ---------------- */}
        <section className="lg:col-span-8 bg-white border-t-4 border-[#16233F] rounded-b-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Title icon={Calendar} color="#16233F">Monthly Ticket Trend</Title>
            <div className="flex bg-[#EEF0F4] rounded-full p-1 text-xs">
              {[[3, "3M"], [6, "6M"], [0, "All"]].map(([v, l]) => (
                <button key={l} onClick={() => setRange(v)} className={`px-3 py-1 rounded-full transition-all ${range === v ? "bg-[#16233F] text-white" : "text-[#64748B] hover:text-[#16233F]"}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* 7-day sparkline — backed by GROUP BY, not a 5-row sample */}
          {stats.tickets_by_day?.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">Last 7 days</p>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={stats.tickets_by_day} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                  <Tooltip
                    cursor={{ fill: "#16233F0A" }}
                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 6px 24px #16233F22" }}
                  />
                  <Bar dataKey="tickets" radius={[4, 4, 0, 0]}>
                    {stats.tickets_by_day.map((_, i, arr) => (
                      <Cell key={i} fill={i === arr.length - 1 ? "#F0B429" : "#16233F"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Insight strip — the "so what" above the chart */}
          {trendInsight ? (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-[#F8F9FB] border border-[#E3E7EE] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Latest month</p>
                <p className="text-lg font-['Oswald'] font-semibold text-[#16233F] tabular-nums leading-tight">
                  {trendInsight.latest.tickets || 0}
                </p>
                <p className="text-[10px] text-[#5F6779] truncate">{trendInsight.latest.name}</p>
              </div>
              <div className="rounded-lg bg-[#F8F9FB] border border-[#E3E7EE] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">vs previous</p>
                <div className="mt-1">
                  <DeltaPill direction={trendInsight.direction} delta={trendInsight.delta} />
                </div>
              </div>
              <div className="rounded-lg bg-[#F8F9FB] border border-[#E3E7EE] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Peak month</p>
                <p className="text-lg font-['Oswald'] font-semibold text-[#16233F] tabular-nums leading-tight">
                  {trendInsight.peak.tickets || 0}
                </p>
                <p className="text-[10px] text-[#5F6779] truncate">{trendInsight.peak.name}</p>
              </div>
              <div className="rounded-lg bg-[#F8F9FB] border border-[#E3E7EE] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Avg / month</p>
                <p className="text-lg font-['Oswald'] font-semibold text-[#16233F] tabular-nums leading-tight">
                  {trendInsight.average}
                </p>
                <p className="text-[10px] text-[#5F6779]">{trendInsight.buckets} mo total</p>
              </div>
            </div>
          ) : null}

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

        {/* ---------------- STATUS DISTRIBUTION (with insight strip) ---------------- */}
        <section className="lg:col-span-4 bg-[#F6F1E4] rounded-xl p-6">
          <div className="mb-4"><Title icon={TrendingUp} color="#3B5170">Ticket Status Distribution</Title></div>

          {statusInsight && statusInsight.total > 0 ? (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#5F6779]">Paid vs open</span>
                <span className="font-semibold text-[#16233F] tabular-nums">
                  {statusInsight.paid_pct}% / {statusInsight.open_pct}%
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-[#E4E7EE] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#1E8449] transition-all duration-700"
                  style={{ width: `${statusInsight.paid_pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[#5F6779]">
                <span>
                  {statusInsight.dominant ? (
                    <>Most common: <strong className="text-[#16233F]">{statusInsight.dominant.label}</strong></>
                  ) : (
                    "No dominant status"
                  )}
                </span>
                <span className="tabular-nums">{statusInsight.total} total</span>
              </div>
              {courtTotal > 0 ? (
                <div className="flex items-center gap-2 pt-2 border-t border-dashed border-[#CBD5E1]">
                  <Gavel className="w-3.5 h-3.5 text-[#7A1621]" />
                  <p className="text-xs text-[#5F6779] flex-1">
                    <strong className="text-[#7A1621]">{courtTotal}</strong> escalated to court
                  </p>
                  <Link to="/payments" className="text-xs text-[#7A1621] font-semibold hover:underline">Review</Link>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2 border-t border-dashed border-[#CBD5E1]">
                  <Check className="w-3.5 h-3.5 text-[#1E8449]" />
                  <p className="text-xs text-[#5F6779]">No cases escalated to court.</p>
                </div>
              )}
            </div>
          ) : null}

          {pieData.length === 0 ? empty : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  onClick={(d) => (d.key === "archived" ? navigate("/archives?tab=tickets") : setFilter(filter === d.key ? null : d.key))} style={{ cursor: "pointer" }}>
                  {pieData.map((e) => <Cell key={e.key} fill={e.color} fillOpacity={!filter || filter === e.key ? 1 : 0.3} stroke={filter === e.key ? "#16233F" : "none"} strokeWidth={2} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

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

      <section className="bg-white rounded-xl border border-[#E3E7EE] border-t-4 border-t-[#7A1621] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <Title icon={Gavel} color="#7A1621">In Court Violators</Title>
          <Link to="/payments" className="text-xs flex items-center gap-1 px-3 py-1 rounded-full bg-[#F6E3E5] text-[#7A1621] hover:bg-[#EFD0D3] transition-colors">
            View all ({courtTotal.toLocaleString()}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {courtViolators.length === 0 ? <div className="text-center py-12 text-gray-500">No violators in court</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#94A3B8] border-b border-dashed border-[#CBD5E1]">
                  <th className="py-2 pr-4 font-medium">Violator</th>
                  <th className="py-2 pr-4 font-medium">Ticket #</th>
                  <th className="py-2 pr-4 font-medium">Plate</th>
                  <th className="py-2 text-right font-medium">Amount Due</th>
                </tr>
              </thead>
              <tbody>
                {courtViolators.map((r, i) => {
                  const t = r.ticket || r;
                  return (
                    <tr key={t.ticket_id ?? r.id ?? i} className="border-b border-[#EEF0F4] last:border-0 hover:bg-[#F8F9FB] transition-colors">
                      <td className="py-3 pr-4 text-gray-800">{t.violator?.firstname} {t.violator?.lastname}</td>
                      <td className="py-3 pr-4 font-mono font-semibold text-gray-800">{t.ticket_number || "—"}</td>
                      <td className="py-3 pr-4 text-gray-600"><Car className="w-3 h-3 inline mr-1 text-gray-400" />{t.vehicle?.platenumber || "—"}</td>
                      <td className="py-3 text-right font-['Oswald'] font-semibold text-[#C8202F] tabular-nums">₱{getBalance(t).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-[#16233F] rounded-xl grid grid-cols-2 md:grid-cols-4 md:divide-x divide-white/10 text-white">
        {quick.map((q) => (
          <Link key={q.label} to={q.to} className="p-5 flex items-center gap-3 hover:bg-white/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0B429] focus-visible:-outline-offset-2">
            <div className="p-2 rounded-lg" style={{ background: q.bg }}><q.icon className="w-5 h-5" style={{ color: q.fg }} /></div>
            <div>
              <p className="text-2xl font-['Oswald'] font-semibold tabular-nums"><Count value={q.value} suffix={q.suffix} /></p>
              <p className="text-xs text-[#C7CEDB]">{q.label}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
};

export default Dashboard;