// web/src/pages/Archives.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '../components/ui/card';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '../components/ui/table';
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '../components/ui/tabs';
import { Pagination } from '../components/ui/Pagination';
import ActionButton from '../components/ui/ActionButton';
import { byFields } from '../lib/sortBy';
import { getArchived, restoreArchived } from '../services/api';
import {
    Archive,
    ArchiveRestore,
    Search,
    RefreshCw,
    Loader2,
    X,
    Users,
    Car,
    AlertTriangle,
    Ticket,
    UserCog,
    Inbox,
    Filter,
    Calendar,
    LayoutGrid,
    List as ListIcon,
} from 'lucide-react';
import { useAlert } from '../components/ui/AlertProvider';
import { useAuth } from '../contexts/AuthContext';

const ITEMS_PER_PAGE = 20;

const RESOURCES = [
    {
        key: 'violators',
        label: 'Violators',
        icon: Users,
        accent: '#F0B429',
        sortKeys: ['lastname', 'firstname'],
        columns: ['Name', 'License', 'Email', 'Contact'],
    },
    {
        key: 'vehicles',
        label: 'Vehicles',
        icon: Car,
        accent: '#1E8449',
        sortKeys: ['platenumber'],
        columns: ['Plate', 'Owner', 'Make/Model', 'Color'],
    },
    {
        key: 'violations',
        label: 'Violations',
        icon: AlertTriangle,
        accent: '#C2541F',
        sortKeys: ['violation_name'],
        columns: ['Code', 'Violation', 'Category', 'Fine'],
    },
    {
        key: 'tickets',
        label: 'Tickets',
        icon: Ticket,
        accent: '#16233F',
        sortKeys: ['ticket_number'],
        columns: ['Ticket #', 'Violator', 'Plate', 'Status'],
    },
    {
        key: 'users',
        label: 'Users',
        icon: UserCog,
        accent: '#3B5170',
        sortKeys: ['lastname', 'firstname'],
        columns: ['Name', 'Email', 'Role', 'Contact'],
    },
];

const PRESETS = [
    { label: 'Last 7d', days: 6 },
    { label: 'Last 30d', days: 29 },
    { label: 'Last 90d', days: 89 },
];

const ROW_CLASS_BY_RESOURCE = {
    violators:
        'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
        'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,8rem)] md:gap-4',
    vehicles:
        'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
        'md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,8rem)] md:gap-4',
    violations:
        'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
        'md:grid md:grid-cols-[minmax(0,.9fr)_minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,8rem)] md:gap-4',
    tickets:
        'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
        'md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,8rem)] md:gap-4',
    users:
        'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
        'md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,8rem)] md:gap-4',
};

const toISODate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const daysAgoISO = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toISODate(d);
};

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
    if (response.current_page !== undefined) {
        return {
            current_page: response.current_page,
            last_page: response.last_page,
            total: response.total,
        };
    }
    if (response.data && response.data.current_page !== undefined) {
        return {
            current_page: response.data.current_page,
            last_page: response.data.last_page,
            total: response.data.total,
        };
    }
    if (response.meta) return response.meta;
    return { current_page: 1, last_page: 1, total: 0 };
};

const formatDate = (v) => {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString();
    } catch {
        return '—';
    }
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

const Spec = ({ label, children, mono }) => (
    <div className="min-w-0">
        <dt className="text-[10px] text-[#94A3B8]">{label}</dt>
        <dd
            className={`text-sm truncate ${mono ? 'font-mono text-[#16233F]' : 'text-[#1F2937]'
                }`}
        >
            {children}
        </dd>
    </div>
);

/* ---------- Row renderers for each resource ---------- */
const renderViolatorCells = (row) => [
    `${row.firstname} ${row.middlename ? row.middlename[0] + '. ' : ''}${row.lastname}`,
    row.license,
    row.email || '—',
    row.contact_number || '—',
];

const renderVehicleCells = (row) => [
    row.platenumber,
    row.owner,
    [row.make, row.model].filter(Boolean).join(' ') || '—',
    row.color || '—',
];

const renderViolationCells = (row) => [
    row.violation_code || '—',
    row.violation_name,
    row.category || '—',
    `₱${parseFloat(row.fine_amount || 0).toLocaleString()}`,
];

const renderTicketCells = (row) => [
    row.ticket_number,
    `${row.violator?.firstname || ''} ${row.violator?.lastname || ''}`.trim() ||
    '—',
    row.vehicle?.platenumber || '—',
    row.status?.toUpperCase() || '—',
];

const renderUserCells = (row) => [
    `${row.firstname} ${row.lastname}`,
    row.email,
    row.role?.toUpperCase() || '—',
    row.contact_number || '—',
];

const ROW_RENDERERS = {
    violators: renderViolatorCells,
    vehicles: renderVehicleCells,
    violations: renderViolationCells,
    tickets: renderTicketCells,
    users: renderUserCells,
};

const Archives = () => {
    const queryClient = useQueryClient();
    const notify = useAlert();
    const { isAdmin } = useAuth();

    const [tab, setTab] = useState('violators');
    const [view, setView] = useState('list');
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const emptyFilters = () => ({
        date_from: '',
        date_to: '',
        role: '',
        category: '',
        status: '',
        gender: '',
    });

    const [filters, setFilters] = useState({
        violators: emptyFilters(),
        vehicles: emptyFilters(),
        violations: emptyFilters(),
        tickets: emptyFilters(),
        users: emptyFilters(),
    });

    const currentFilters = filters[tab] || emptyFilters();

    useEffect(() => {
        setPage(1);
    }, [tab, searchTerm, filters]);

    const {
        data: response,
        isLoading,
        isFetching,
        refetch,
        error,
    } = useQuery({
        queryKey: ['archives', tab, page, searchTerm, currentFilters],
        queryFn: () =>
            getArchived(tab, page, ITEMS_PER_PAGE, {
                search: searchTerm || undefined,
                date_from: currentFilters.date_from || undefined,
                date_to: currentFilters.date_to || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 30,
    });

    const restoreMutation = useMutation({
        mutationFn: ({ resource, id }) => restoreArchived(resource, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['archives'] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['violators'] });
            queryClient.invalidateQueries({ queryKey: ['vehicles'] });
            queryClient.invalidateQueries({ queryKey: ['violations'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            notify.success('Record restored successfully');
        },
        onError: (err) => {
            notify.error(
                err.response?.data?.message || 'Failed to restore record',
            );
        },
    });

    const rows = getDataArray(response);
    const meta = getMeta(response);

    const refinedRows = useMemo(() => {
        let list = rows;

        if (tab === 'users' && currentFilters.role) {
            list = list.filter((r) => r.role === currentFilters.role);
        }
        if (tab === 'violations' && currentFilters.category) {
            list = list.filter(
                (r) => (r.category || '') === currentFilters.category,
            );
        }
        if (tab === 'tickets' && currentFilters.status) {
            list = list.filter((r) => r.status === currentFilters.status);
        }
        if (tab === 'violators' && currentFilters.gender) {
            list = list.filter((r) => r.gender === currentFilters.gender);
        }

        const resource = RESOURCES.find((r) => r.key === tab);
        if (!resource) return list;
        return [...list].sort(byFields(...resource.sortKeys));
    }, [rows, tab, currentFilters]);

    const setFilter = (patch) =>
        setFilters((prev) => ({
            ...prev,
            [tab]: { ...prev[tab], ...patch },
        }));

    const clearFilters = () =>
        setFilters((prev) => ({ ...prev, [tab]: emptyFilters() }));

    const applyPreset = (days) =>
        setFilter({
            date_from: daysAgoISO(days),
            date_to: daysAgoISO(0),
        });

    const activeFilterCount = useMemo(() => {
        let c = 0;
        if (searchTerm) c++;
        if (currentFilters.date_from || currentFilters.date_to) c++;
        if (currentFilters.role) c++;
        if (currentFilters.category) c++;
        if (currentFilters.status) c++;
        if (currentFilters.gender) c++;
        return c;
    }, [searchTerm, currentFilters]);

    const handleRestore = async (id, label) => {
        const ok = await notify.confirm(
            `Restore ${label}? It will reappear in the live list.`,
            { confirmText: 'Restore' },
        );
        if (ok) restoreMutation.mutate({ resource: tab, id });
    };

    const activeResource = RESOURCES.find((r) => r.key === tab);
    const rowRenderer = ROW_RENDERERS[tab] || (() => []);
    const rowClass = ROW_CLASS_BY_RESOURCE[tab];

    const idKey = {
        violators: 'violator_id',
        vehicles: 'vehicle_id',
        violations: 'violation_id',
        tickets: 'ticket_id',
        users: 'user_id',
    }[tab];

    const chips = [
        searchTerm && [`Search: ${searchTerm}`, () => setSearchTerm('')],
        (currentFilters.date_from || currentFilters.date_to) && [
            `Archived: ${currentFilters.date_from || '…'} → ${currentFilters.date_to || '…'
            }`,
            () => setFilter({ date_from: '', date_to: '' }),
        ],
        currentFilters.role && [
            `Role: ${currentFilters.role}`,
            () => setFilter({ role: '' }),
        ],
        currentFilters.category && [
            `Category: ${currentFilters.category}`,
            () => setFilter({ category: '' }),
        ],
        currentFilters.status && [
            `Status: ${currentFilters.status}`,
            () => setFilter({ status: '' }),
        ],
        currentFilters.gender && [
            `Gender: ${currentFilters.gender}`,
            () => setFilter({ gender: '' }),
        ],
    ].filter(Boolean);

    const panel = (
        <FilterShell
            title={`Filter Archived ${activeResource?.label || ''}`}
            onClose={() => setShowFilters(false)}
            onReset={clearFilters}
        >
            <div>
                <L icon={Calendar}>Archived date range</L>
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="date"
                        value={currentFilters.date_from}
                        onChange={(e) =>
                            setFilter({ date_from: e.target.value })
                        }
                        className="w-36 focus-visible:ring-[#F0B429]"
                    />
                    <span className="text-[#64748B] text-sm">to</span>
                    <Input
                        type="date"
                        value={currentFilters.date_to}
                        onChange={(e) =>
                            setFilter({ date_to: e.target.value })
                        }
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

            {tab === 'users' && (
                <div>
                    <L>Role</L>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
                        value={currentFilters.role}
                        onChange={(e) => setFilter({ role: e.target.value })}
                    >
                        <option value="">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="enforcer">Enforcer</option>
                    </select>
                </div>
            )}

            {tab === 'violations' && (
                <div>
                    <L>Category</L>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
                        value={currentFilters.category}
                        onChange={(e) =>
                            setFilter({ category: e.target.value })
                        }
                    >
                        <option value="">All Categories</option>
                        <option value="Traffic Rules">Traffic Rules</option>
                        <option value="Documents">Documents</option>
                        <option value="Vehicle Condition">
                            Vehicle Condition
                        </option>
                        <option value="Motorcycle">Motorcycle</option>
                        <option value="Loading/Unloading">
                            Loading/Unloading
                        </option>
                        <option value="Attire/Conduct">Attire/Conduct</option>
                    </select>
                </div>
            )}

            {tab === 'tickets' && (
                <div>
                    <L>Status</L>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
                        value={currentFilters.status}
                        onChange={(e) => setFilter({ status: e.target.value })}
                    >
                        <option value="">All Statuses</option>
                        <option value="issued">Issued</option>
                        <option value="partial_paid">Partial Paid</option>
                        <option value="paid">Paid</option>
                        <option value="contested">Contested</option>
                        <option value="dismissed">Dismissed</option>
                    </select>
                </div>
            )}

            {tab === 'violators' && (
                <div>
                    <L>Gender</L>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
                        value={currentFilters.gender}
                        onChange={(e) => setFilter({ gender: e.target.value })}
                    >
                        <option value="">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            )}
        </FilterShell>
    );

    return (
        <div className="space-y-6 font-['Inter']">
            {/* Navy banner */}
            <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
                <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{
                        backgroundImage:
                            'repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)',
                    }}
                />
                <div className="relative">
                    <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight flex items-center gap-3">
                        <Archive className="w-8 h-8 text-[#F0B429]" />
                        Archives
                    </h1>
                    <p className="text-[#C7CEDB] text-sm mt-1">
                        Restore records that were archived. Restoring puts them
                        back into the live list immediately.
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

            {/* Tabs: switch resource */}
            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                <TabsList className="bg-[#E9ECF2] flex-wrap h-auto">
                    {RESOURCES.map((r) => {
                        const Icon = r.icon;
                        const isActive = tab === r.key;
                        return (
                            <TabsTrigger
                                key={r.key}
                                value={r.key}
                                className={`flex items-center gap-2 ${isActive
                                        ? 'data-[state=active]:bg-[#16233F] data-[state=active]:text-white'
                                        : ''
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {r.label}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>

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
                                    placeholder={`Search archived ${activeResource?.label.toLowerCase() ||
                                        'records'
                                        }…`}
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
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

                        {/* Chips */}
                        {chips.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {chips.map(([label, clear]) => (
                                    <Chip
                                        key={label}
                                        label={label}
                                        onClear={clear}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Section title */}
                        <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
                            {activeResource && (
                                <activeResource.icon
                                    className="w-5 h-5"
                                    style={{ color: activeResource.accent }}
                                />
                            )}
                            Archived {activeResource?.label}
                            <span className="text-xs font-normal text-[#64748B] font-['Inter']">
                                ({meta.total} total)
                            </span>
                        </h2>

                        {/* Body */}
                        {isLoading && !response ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-10 text-[#C8202F]">
                                Error loading archives: {error.message}
                            </div>
                        ) : refinedRows.length === 0 ? (
                            <div className="text-center py-14">
                                <Inbox className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                                <p className="text-sm text-[#64748B]">
                                    {activeFilterCount > 0
                                        ? 'No archived records match your filters.'
                                        : `No archived ${activeResource?.label.toLowerCase()} yet.`}
                                </p>
                            </div>
                        ) : view === 'cards' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {refinedRows.map((row) => {
                                    const cells = rowRenderer(row);
                                    const id = row[idKey];
                                    const label =
                                        row.resource_label || `#${id}`;
                                    return (
                                        <article
                                            key={id}
                                            className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                                        >
                                            <div
                                                className="h-2"
                                                style={{
                                                    background:
                                                        activeResource?.accent ||
                                                        '#16233F',
                                                }}
                                            />
                                            <div className="p-4">
                                                <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937] mb-3 truncate">
                                                    {cells[0]}
                                                </p>
                                                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                                                    {activeResource?.columns
                                                        .slice(1)
                                                        .map((col, i) => (
                                                            <Spec
                                                                key={col}
                                                                label={col}
                                                            >
                                                                {cells[i + 1]}
                                                            </Spec>
                                                        ))}
                                                </dl>
                                                <div className="mt-3 pt-3 border-t border-dashed border-[#CBD5E1] text-xs text-[#64748B]">
                                                    <p>
                                                        <strong className="text-[#16233F]">
                                                            Archived at:
                                                        </strong>{' '}
                                                        {formatDate(
                                                            row.archived_at,
                                                        )}
                                                    </p>
                                                    <p className="truncate">
                                                        <strong className="text-[#16233F]">
                                                            By:
                                                        </strong>{' '}
                                                        {row.archived_by_name ||
                                                            '—'}
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">
                                                    {isAdmin() ? (
                                                        <ActionButton
                                                            icon={
                                                                ArchiveRestore
                                                            }
                                                            variant="primary"
                                                            onClick={() =>
                                                                handleRestore(
                                                                    id,
                                                                    label,
                                                                )
                                                            }
                                                            disabled={
                                                                restoreMutation.isPending
                                                            }
                                                        >
                                                            Restore
                                                        </ActionButton>
                                                    ) : (
                                                        <span className="text-xs text-[#94A3B8]">
                                                            Admin only
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                                <div
                                    className={`hidden ${rowClass} bg-[#16233F] text-white text-xs font-semibold`}
                                >
                                    {[
                                        ...(activeResource?.columns || []),
                                        'Archived At',
                                        'Archived By',
                                        'Action',
                                    ].map((c) => (
                                        <span key={c}>{c}</span>
                                    ))}
                                </div>
                                <ul className="divide-y divide-[#EEF0F4]">
                                    {refinedRows.map((row) => {
                                        const cells = rowRenderer(row);
                                        const id = row[idKey];
                                        const label =
                                            row.resource_label || `#${id}`;
                                        return (
                                            <li
                                                key={id}
                                                className={`${rowClass} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                                                style={{
                                                    borderLeftColor:
                                                        activeResource?.accent ||
                                                        '#16233F',
                                                }}
                                            >
                                                {cells.map((val, i) => (
                                                    <span
                                                        key={i}
                                                        className={`min-w-0 truncate ${i === 0
                                                                ? 'font-medium text-[#1F2937]'
                                                                : 'text-sm text-[#1F2937]'
                                                            }`}
                                                    >
                                                        {i === 0 && (
                                                            <Mini>
                                                                {
                                                                    activeResource
                                                                        ?.columns[
                                                                    i
                                                                    ]
                                                                }
                                                            </Mini>
                                                        )}
                                                        {val}
                                                    </span>
                                                ))}
                                                <span className="text-xs text-[#64748B] whitespace-nowrap">
                                                    <Mini>Archived</Mini>
                                                    {formatDate(row.archived_at)}
                                                </span>
                                                <span className="text-xs text-[#64748B] truncate">
                                                    <Mini>By</Mini>
                                                    {row.archived_by_name ||
                                                        '—'}
                                                </span>
                                                <div className="justify-self-end md:justify-self-start">
                                                    {isAdmin() ? (
                                                        <ActionButton
                                                            icon={
                                                                ArchiveRestore
                                                            }
                                                            variant="primary"
                                                            onClick={() =>
                                                                handleRestore(
                                                                    id,
                                                                    label,
                                                                )
                                                            }
                                                            disabled={
                                                                restoreMutation.isPending
                                                            }
                                                        >
                                                            Restore
                                                        </ActionButton>
                                                    ) : (
                                                        <span className="text-xs text-[#94A3B8]">
                                                            Admin only
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {!isLoading && refinedRows.length > 0 && (
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
            </Tabs>
        </div>
    );
};

export default Archives;