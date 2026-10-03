// web/src/pages/Tickets.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Pagination } from '../components/ui/Pagination';
import ActionButton from '../components/ui/ActionButton';
import { byFields } from '../lib/sortBy';
import {
  getTickets,
  updateTicketStatus,
  deleteTicket,
  getUsers,
  getViolations,
} from '../services/api';
import {
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Archive,
  RefreshCw,
  Loader2,
  Filter,
  X,
  Calendar,
  Eye,
  LayoutGrid,
  List as ListIcon,
  Ticket as TicketIcon,
} from 'lucide-react';
import { useAlert } from '../components/ui/AlertProvider';

const ITEMS_PER_PAGE = 20;

const STATUS_META = {
  issued: {
    label: 'Issued',
    color: '#F0B429',
    soft: '#FBF1DC',
    text: '#92600A',
    chip: 'bg-[#FBF1DC] text-[#92600A]',
    icon: AlertCircle,
  },
  partial_paid: {
    label: 'Partial Paid',
    color: '#3B5170',
    soft: '#EEF1F5',
    text: '#3B5170',
    chip: 'bg-[#EEF1F5] text-[#3B5170]',
    icon: AlertCircle,
  },
  paid: {
    label: 'Paid',
    color: '#1E8449',
    soft: '#E5F2EA',
    text: '#1E8449',
    chip: 'bg-[#E5F2EA] text-[#1E8449]',
    icon: CheckCircle,
  },
  contested: {
    label: 'Contested',
    color: '#C2541F',
    soft: '#FBEAE2',
    text: '#C2541F',
    chip: 'bg-[#FBEAE2] text-[#C2541F]',
    icon: AlertCircle,
  },
  dismissed: {
    label: 'Dismissed',
    color: '#C8202F',
    soft: '#FBE7E9',
    text: '#C8202F',
    chip: 'bg-[#FBE7E9] text-[#C8202F]',
    icon: XCircle,
  },
};

const STATUS_OPTIONS = Object.keys(STATUS_META).map((key) => ({
  value: key,
  label: STATUS_META[key].label,
}));

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7d', days: 6 },
  { label: 'Last 30d', days: 29 },
  { label: 'Last 90d', days: 89 },
];

const toISODate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const getDataArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data && Array.isArray(response.data)) return response.data;
  if (response.data?.data && Array.isArray(response.data.data)) {
    return response.data.data;
  }
  return [];
};

const getMeta = (response) => {
  if (!response) return { current_page: 1, last_page: 1, total: 0 };
  if (response.meta) return response.meta;
  if (response.data?.meta) return response.data.meta;
  if (response.data && response.data.current_page !== undefined) {
    return {
      current_page: response.data.current_page,
      last_page: response.data.last_page,
      total: response.data.total,
    };
  }
  return { current_page: 1, last_page: 1, total: 0 };
};

const Chip = ({ label, onClear }) => (
  <span className="inline-flex items-center gap-1 bg-[#E9ECF2] text-[#16233F] px-2.5 py-1 rounded-md text-xs">
    {label}
    <button onClick={onClear} className="hover:text-[#C8202F]">
      <X className="w-3 h-3" />
    </button>
  </span>
);

const L = ({ icon: I, children }) => (
  <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
    {I && <I className="w-3.5 h-3.5 text-[#92600A]" />}
    {children}
  </label>
);

const Mini = ({ children }) => (
  <i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">
    {children}
  </i>
);

const ViewToggle = ({ view, setView }) => (
  <div
    className="ml-auto flex bg-[#E9ECF2] rounded-full p-1 text-xs"
    role="group"
    aria-label="Choose layout"
  >
    {[['list', 'List', ListIcon], ['cards', 'Cards', LayoutGrid]].map(
      ([v, label, I]) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          aria-pressed={view === v}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${view === v
              ? 'bg-[#16233F] text-white'
              : 'text-[#64748B] hover:text-[#16233F]'
            }`}
        >
          <I className="w-3.5 h-3.5" />
          {label}
        </button>
      ),
    )}
  </div>
);

const FilterShell = ({ title, onClose, onReset, children }) => (
  <aside className="self-start rounded-xl bg-[#FBF1DC] border-t-4 border-[#F0B429] p-5 space-y-5 lg:sticky lg:top-4">
    <div className="flex justify-between items-center">
      <h3 className="text-base font-['Oswald'] font-medium text-[#16233F]">
        {title}
      </h3>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-[#F0B429]/25"
      >
        <X className="w-4 h-4 text-[#92600A]" />
      </button>
    </div>
    {children}
    <div className="flex gap-2 pt-3 border-t border-[#F0B429]/30">
      <Button onClick={onClose} className="bg-[#1E8449] hover:bg-[#186B3B]">
        Apply Filters
      </Button>
      <Button
        onClick={onReset}
        variant="ghost"
        className="text-[#64748B] hover:text-[#C8202F]"
      >
        <X className="w-4 h-4 mr-1" />
        Reset
      </Button>
    </div>
  </aside>
);

const Spec = ({ label, children, mono, danger }) => (
  <div className="min-w-0">
    <dt className="text-[10px] text-[#94A3B8]">{label}</dt>
    <dd
      className={`text-sm truncate ${mono ? 'font-mono text-[#16233F]' : 'text-[#1F2937]'
        } ${danger ? 'text-[#C8202F] font-medium' : ''}`}
    >
      {children}
    </dd>
  </div>
);

/* Shared grid: flex-wrap on mobile, 7-column grid on md+ */
const ROW_CLASS =
  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
  'md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)_minmax(0,.9fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,14rem)] md:gap-4';

const Tickets = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [enforcerId, setEnforcerId] = useState('');
  const [violationId, setViolationId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, enforcerId, violationId]);

  /* ------------- Lookups for filter dropdowns ------------- */
  const { data: enforcersResponse } = useQuery({
    queryKey: ['users', 'enforcer'],
    queryFn: () => getUsers(1, 200, { role: 'enforcer' }),
    staleTime: 1000 * 60 * 10,
  });
  const enforcers = getDataArray(enforcersResponse);

  const { data: violationsResponse } = useQuery({
    queryKey: ['violations', 'all'],
    queryFn: () => getViolations({ all: 1 }),
    staleTime: 1000 * 60 * 10,
  });
  const violations = getDataArray(violationsResponse);

  /* ------------- Tickets query ------------- */
  const {
    data: ticketsResponse,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: [
      'tickets',
      page,
      debouncedSearch,
      statusFilter,
      dateFrom,
      dateTo,
      enforcerId,
      violationId,
    ],
    queryFn: () =>
      getTickets(page, ITEMS_PER_PAGE, {
        search: debouncedSearch || undefined,
        status: statusFilter.length ? statusFilter.join(',') : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        enforcer_id: enforcerId || undefined,
        violation_id: violationId || undefined,
        sort_by: 'created_at',
        sort_dir: 'desc',
      }),
    keepPreviousData: true,
    staleTime: 1000 * 30,
  });

  const tickets = getDataArray(ticketsResponse);
  const meta = getMeta(ticketsResponse);

  /* ------------- Mutations ------------- */
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateTicketStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      notify.success('Ticket status updated successfully');
    },
    onError: (err) => {
      notify.error(
        err.response?.data?.message || 'Failed to update ticket status',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: deleteTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      notify.success('Ticket archived successfully');
    },
    onError: (err) => {
      notify.error(
        err.response?.data?.message || 'Failed to archive ticket',
      );
    },
  });

  const handleStatusUpdate = async (id, status) => {
    const ok = await notify.confirm(
      `Change ticket status to ${status.toUpperCase().replace('_', ' ')}?`,
      { confirmText: 'Change' },
    );
    if (ok) updateStatusMutation.mutate({ id, status });
  };

  const handleArchive = async (id) => {
    const ok = await notify.confirm(
      'Archive this ticket? You can restore it later from the Archives page.',
      { confirmText: 'Archive', destructive: true },
    );
    if (ok) archiveMutation.mutate(id);
  };

  const toggleStatus = (value) => {
    setStatusFilter((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  };

  const applyPreset = (days) => {
    setDateFrom(daysAgoISO(days));
    setDateTo(daysAgoISO(0));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setDateFrom('');
    setDateTo('');
    setEnforcerId('');
    setViolationId('');
  };

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchTerm) c++;
    if (statusFilter.length) c++;
    if (dateFrom || dateTo) c++;
    if (enforcerId) c++;
    if (violationId) c++;
    return c;
  }, [searchTerm, statusFilter, dateFrom, dateTo, enforcerId, violationId]);

  const filteredTickets = useMemo(() => {
    return [...tickets].sort((a, b) => {
      const cmp = byFields('lastname', 'firstname')(
        a.violator || {},
        b.violator || {},
      );
      if (cmp !== 0) return cmp;
      return (a.ticket_number || '').localeCompare(b.ticket_number || '');
    });
  }, [tickets]);

  const getTotalFine = (ticket) => {
    if (!ticket) return 0;
    if (Array.isArray(ticket.violations) && ticket.violations.length > 0) {
      return ticket.violations.reduce(
        (s, v) => s + (parseFloat(v.fine_amount) || 0),
        0,
      );
    }
    return parseFloat(ticket.total_fine) || 0;
  };

  const chips = [
    searchTerm && [`Search: ${searchTerm}`, () => setSearchTerm('')],
    statusFilter.length > 0 && [
      `Status: ${statusFilter.join(', ')}`,
      () => setStatusFilter([]),
    ],
    (dateFrom || dateTo) && [
      `Date: ${dateFrom || '…'} → ${dateTo || '…'}`,
      () => {
        setDateFrom('');
        setDateTo('');
      },
    ],
    enforcerId && [
      `Enforcer: ${enforcers.find((u) => String(u.user_id) === String(enforcerId))
        ?.firstname || enforcerId
      }`,
      () => setEnforcerId(''),
    ],
    violationId && [
      `Violation: ${violations.find(
        (v) => String(v.violation_id) === String(violationId),
      )?.violation_name || violationId
      }`,
      () => setViolationId(''),
    ],
  ].filter(Boolean);

  const statusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.issued;
    const Icon = meta.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.chip}`}
      >
        <Icon className="w-3 h-3" />
        {meta.label.toUpperCase()}
      </span>
    );
  };

  const rowActions = (ticket) => (
    <div className="flex flex-wrap gap-2">
      {ticket.status === 'issued' && (
        <>
          <ActionButton
            icon={CheckCircle}
            variant="primary"
            onClick={() =>
              handleStatusUpdate(ticket.ticket_id, 'paid')
            }
          >
            Mark Paid
          </ActionButton>
          <ActionButton
            icon={AlertCircle}
            variant="warning"
            onClick={() =>
              handleStatusUpdate(ticket.ticket_id, 'contested')
            }
          >
            Contest
          </ActionButton>
        </>
      )}
      {(ticket.status === 'paid' ||
        ticket.status === 'partial_paid') && (
          <ActionButton
            icon={XCircle}
            variant="danger"
            onClick={() =>
              handleStatusUpdate(ticket.ticket_id, 'dismissed')
            }
          >
            Dismiss
          </ActionButton>
        )}
      {ticket.status === 'contested' && (
        <ActionButton
          icon={AlertCircle}
          variant="warning"
          onClick={() =>
            handleStatusUpdate(ticket.ticket_id, 'issued')
          }
        >
          Re-open
        </ActionButton>
      )}
      <ActionButton
        icon={Archive}
        variant="danger"
        onClick={() => handleArchive(ticket.ticket_id)}
        disabled={archiveMutation.isPending}
      >
        Archive
      </ActionButton>
    </div>
  );

  const panel = (
    <FilterShell
      title="Filter Tickets"
      onClose={() => setShowFilters(false)}
      onReset={clearAllFilters}
    >
      <div>
        <L icon={Calendar}>Date range</L>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36 focus-visible:ring-[#F0B429]"
          />
          <span className="text-[#64748B] text-sm">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 focus-visible:ring-[#F0B429]"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-xs text-[#92600A]/70 mr-1">
            Quick:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.days)}
              className="text-xs px-2.5 py-1 rounded-full bg-white text-[#16233F] hover:bg-[#16233F] hover:text-white transition-colors font-medium"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <L>Status</L>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatus(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${active
                    ? 'bg-[#16233F] text-white border-[#16233F]'
                    : 'bg-white text-[#64748B] border-[#E9ECF2] hover:bg-[#F5F6F8]'
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <L>Enforcer</L>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={enforcerId}
          onChange={(e) => setEnforcerId(e.target.value)}
        >
          <option value="">All Enforcers</option>
          {enforcers.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.firstname} {u.lastname}
            </option>
          ))}
        </select>
      </div>

      <div>
        <L>Violation type</L>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={violationId}
          onChange={(e) => setViolationId(e.target.value)}
        >
          <option value="">All Violations</option>
          {violations.map((v) => (
            <option key={v.violation_id} value={v.violation_id}>
              {v.violation_name}
            </option>
          ))}
        </select>
      </div>
    </FilterShell>
  );

  if (isLoading && !ticketsResponse) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#16233F]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-[#C8202F] mb-4">
          Error loading tickets: {error.message}
        </p>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Inter']">
      {/* Navy banner header */}
      <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)',
          }}
        />
        <div className="relative">
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">
            Tickets Management
          </h1>
          <p className="text-[#C7CEDB] text-sm mt-1">
            View, filter, and manage all traffic violation tickets
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="relative bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''
              }`}
          />
          Refresh
        </Button>
      </header>

      <div
        className={`grid gap-6 ${showFilters ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : ''
          }`}
      >
        {showFilters && panel}

        <div className="space-y-4 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input
                placeholder="Search by ticket #, violator, or plate..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  title="Clear"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <ViewToggle view={view} setView={setView} />
          </div>

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map(([label, clear]) => (
                <Chip key={label} label={label} onClear={clear} />
              ))}
            </div>
          )}

          {/* Section heading */}
          <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
            <TicketIcon className="w-5 h-5 text-[#F0B429]" />
            Tickets List
            <span className="text-xs font-normal text-[#64748B] font-['Inter']">
              (alphabetical by violator)
            </span>
          </h2>

          {/* Body */}
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-14">
              <Eye className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
              <p className="text-sm text-[#64748B]">
                {activeFilterCount > 0
                  ? 'No tickets match the current filters.'
                  : 'No tickets found.'}
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-[#1E8449] hover:underline mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTickets.map((ticket) => {
                const meta =
                  STATUS_META[ticket.status] ||
                  STATUS_META.issued;
                return (
                  <article
                    key={ticket.ticket_id}
                    className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div
                      className="h-2"
                      style={{ background: meta.color }}
                    />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-[#16233F]">
                          {ticket.ticket_number}
                        </span>
                        {statusBadge(ticket.status)}
                      </div>
                      <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                        {ticket.violator?.firstname}{' '}
                        {ticket.violator?.lastname}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                        <Spec label="Plate" mono>
                          {ticket.vehicle
                            ?.platenumber || '—'}
                        </Spec>
                        <Spec label="License" mono>
                          {ticket.violator
                            ?.license || '—'}
                        </Spec>
                        <Spec label="Date">
                          {ticket.violation_datetime
                            ? new Date(
                              ticket.violation_datetime,
                            ).toLocaleDateString()
                            : '—'}
                        </Spec>
                        <Spec
                          label="Total fine"
                          danger
                        >
                          ₱
                          {getTotalFine(
                            ticket,
                          ).toLocaleString()}
                        </Spec>
                      </dl>
                      <div className="mt-3 text-xs text-[#64748B] line-clamp-2">
                        {ticket.violations
                          ?.slice(0, 2)
                          .map(
                            (v) =>
                              v.violation_type
                                ?.violation_name,
                          )
                          .filter(Boolean)
                          .join(' · ')}
                        {ticket.violations?.length >
                          2 &&
                          ` +${ticket.violations
                            .length - 2
                          } more`}
                      </div>
                      <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">
                        {rowActions(ticket)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
              {/* Header row uses the exact same grid as the body rows */}
              <div
                className={`hidden ${ROW_CLASS} bg-[#16233F] text-white text-xs font-semibold`}
              >
                {[
                  'Ticket #',
                  'Violator',
                  'Vehicle',
                  'Violations',
                  'Fine',
                  'Status',
                  'Actions',
                ].map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <ul className="divide-y divide-[#EEF0F4]">
                {filteredTickets.map((ticket) => {
                  const meta =
                    STATUS_META[ticket.status] ||
                    STATUS_META.issued;
                  return (
                    <li
                      key={ticket.ticket_id}
                      className={`${ROW_CLASS} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                      style={{
                        borderLeftColor: meta.color,
                      }}
                    >
                      <span className="font-mono text-sm font-medium text-[#16233F] min-w-0 truncate">
                        <Mini>Ticket</Mini>
                        {ticket.ticket_number}
                      </span>

                      <div className="min-w-0">
                        <div className="text-sm text-[#1F2937] truncate">
                          {ticket.violator?.firstname}{' '}
                          {ticket.violator?.lastname}
                        </div>
                        <div className="text-xs text-[#64748B] font-mono truncate">
                          {ticket.violator?.license}
                        </div>
                      </div>

                      <span className="font-mono text-sm text-[#1F2937] min-w-0 truncate">
                        <Mini>Plate</Mini>
                        {ticket.vehicle?.platenumber ||
                          '—'}
                      </span>

                      <div className="space-y-0.5 min-w-0">
                        {ticket.violations
                          ?.slice(0, 2)
                          .map((v, i) => (
                            <div
                              key={i}
                              className="text-xs text-[#1F2937] truncate"
                            >
                              {
                                v.violation_type
                                  ?.violation_name
                              }
                            </div>
                          ))}
                        {ticket.violations?.length >
                          2 && (
                            <div className="text-xs text-[#94A3B8]">
                              +
                              {ticket.violations
                                .length - 2}{' '}
                              more
                            </div>
                          )}
                      </div>

                      <span className="font-bold text-[#C8202F] tabular-nums whitespace-nowrap">
                        <Mini>Fine</Mini>₱
                        {getTotalFine(
                          ticket,
                        ).toLocaleString()}
                      </span>

                      <span className="justify-self-start">
                        {statusBadge(ticket.status)}
                      </span>

                      <div className="justify-self-end md:justify-self-start">
                        {rowActions(ticket)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!isLoading && filteredTickets.length > 0 && (
            <Pagination
              currentPage={meta.current_page}
              totalPages={meta.last_page}
              onPageChange={setPage}
              totalItems={meta.total}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Tickets;