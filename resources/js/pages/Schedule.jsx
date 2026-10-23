// web/src/pages/Schedule.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import ActionButton from '../components/ui/ActionButton';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Pagination } from '../components/ui/Pagination';
import {
  Calendar,
  Plus,
  Pencil,
  Search,
  RefreshCw,
  Loader2,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  PlayCircle,
  Filter,
  X,
  List,
  CalendarDays,
  Users,
  Lock,
  Check,
  AlertCircle,
  LayoutGrid,
  List as ListIcon,
  Sun,
  Moon,
  Sunrise,
  CalendarRange,
  UserPlus,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { byFields } from '../lib/sortBy';
import { useAlert } from '../components/ui/AlertProvider';

const ITEMS_PER_PAGE = 20;
const MAX_ENFORCERS_PER_SHIFT = 2;

const SHIFT_DEFAULTS = {
  morning: {
    start: '08:00',
    end: '12:00',
    label: 'Morning',
    sublabel: '8:00 AM – 12:00 PM',
    Icon: Sunrise,
    tint: '#FBF1DC',
    accent: '#92600A',
  },
  afternoon: {
    start: '13:00',
    end: '17:00',
    label: 'Afternoon',
    sublabel: '1:00 PM – 5:00 PM',
    Icon: Sun,
    tint: '#FBEAE2',
    accent: '#C2541F',
  },
  night: {
    start: '18:00',
    end: '22:00',
    label: 'Night',
    sublabel: '6:00 PM – 10:00 PM',
    Icon: Moon,
    tint: '#E9ECF2',
    accent: '#16233F',
  },
  full: {
    start: '08:00',
    end: '17:00',
    label: 'Full Day',
    sublabel: '8:00 AM – 5:00 PM',
    Icon: CalendarRange,
    tint: '#E5F2EA',
    accent: '#1E8449',
  },
};

const SHIFT_LABELS = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  night: '🌙 Night',
  full: '📅 Full Day',
};

const STATUS_META = {
  scheduled: {
    label: 'Scheduled',
    color: '#F0B429',
    chip: 'bg-[#FBF1DC] text-[#92600A]',
    Icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    color: '#C2541F',
    chip: 'bg-[#FBEAE2] text-[#C2541F]',
    Icon: PlayCircle,
  },
  completed: {
    label: 'Completed',
    color: '#1E8449',
    chip: 'bg-[#E5F2EA] text-[#1E8449]',
    Icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: '#C8202F',
    chip: 'bg-[#FBE7E9] text-[#C8202F]',
    Icon: XCircle,
  },
};

const ROW_CLASS =
  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
  'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,.9fr)_minmax(0,10rem)] md:gap-4';

const toISODate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const todayISO = () => toISODate(new Date());

const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
};

const daysFromNowISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

const formatDisplayDate = (iso) => {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'EEEE, MMMM d, yyyy');
  } catch {
    return iso;
  }
};

const formatTimeDisplay = (value) => {
  if (!value) return 'N/A';
  try {
    if (/^\d{2}:\d{2}$/.test(value)) {
      return format(new Date(`2000-01-01T${value}:00`), 'h:mm a');
    }
    const parsed = value.includes('T') ? parseISO(value) : new Date(value);
    if (!isNaN(parsed.getTime())) return format(parsed, 'h:mm a');
    return 'N/A';
  } catch {
    return 'N/A';
  }
};

const getDataArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data && Array.isArray(response.data)) return response.data;
  if (response.data?.data && Array.isArray(response.data.data))
    return response.data.data;
  return [];
};

const getMeta = (response) => {
  if (!response) return { current_page: 1, last_page: 1, total: 0 };
  if (response.meta) return response.meta;
  if (response.current_page !== undefined) {
    return {
      current_page: response.current_page,
      last_page: response.last_page,
      total: response.total,
      per_page: response.per_page,
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

const Schedule = () => {
  const notify = useAlert();
  const [view, setView] = useState('cards');
  const [viewMode, setViewMode] = useState('date');
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [range, setRange] = useState({
    start_date: todayISO(),
    end_date: daysFromNowISO(30),
  });
  const [rangeDraft, setRangeDraft] = useState({
    start_date: todayISO(),
    end_date: daysFromNowISO(30),
  });

  const [selectedEnforcer, setSelectedEnforcer] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [schedulesData, setSchedulesData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [enforcers, setEnforcers] = useState([]);
  const [dutyLocations, setDutyLocations] = useState([]);
  const [isLoadingEnforcers, setIsLoadingEnforcers] = useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const [selectedEnforcerIds, setSelectedEnforcerIds] = useState([]);
  const [enforcerSearch, setEnforcerSearch] = useState('');

  const defaultForm = {
    duty_location_id: '',
    schedule_date: tomorrowISO(),
    shift_type: 'morning',
    start_time: SHIFT_DEFAULTS.morning.start,
    end_time: SHIFT_DEFAULTS.morning.end,
    duties: '',
    notes: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  const fetchEnforcers = async () => {
    setIsLoadingEnforcers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users?role=enforcer&per_page=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const list = data.data || [];
      setEnforcers([...list].sort(byFields('lastname', 'firstname')));
    } catch (err) {
      console.error('Error fetching enforcers:', err);
    } finally {
      setIsLoadingEnforcers(false);
    }
  };

  const fetchDutyLocations = async () => {
    setIsLoadingLocations(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/duty-locations?per_page=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const list = data.data || [];
      setDutyLocations(
        [...list].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', undefined, {
            sensitivity: 'base',
          }),
        ),
      );
    } catch (err) {
      console.error('Error fetching duty locations:', err);
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const fetchSchedules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      let url = `/api/schedules?page=${page}&per_page=${ITEMS_PER_PAGE}`;

      if (viewMode === 'date') {
        url += `&date=${selectedDate}`;
      } else {
        if (!range.start_date || !range.end_date) {
          setError('Please select both a start and end date.');
          setIsLoading(false);
          return;
        }
        if (range.start_date > range.end_date) {
          setError('Start date must come before end date.');
          setIsLoading(false);
          return;
        }
        url += `&start_date=${range.start_date}&end_date=${range.end_date}`;
      }

      if (selectedEnforcer) url += `&enforcer_id=${selectedEnforcer}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch schedules');
      const data = await response.json();
      setSchedulesData(data);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnforcers();
    fetchDutyLocations();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    viewMode,
    selectedDate,
    range.start_date,
    range.end_date,
    selectedEnforcer,
    selectedStatus,
    selectedLocation,
    selectedShift,
    searchTerm,
  ]);

  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    selectedDate,
    range.start_date,
    range.end_date,
    selectedEnforcer,
    selectedStatus,
    selectedLocation,
    selectedShift,
    searchTerm,
    page,
  ]);

  const createSchedule = useMutation({
    mutationFn: async (data) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create schedule');
      }
      return response.json();
    },
    onError: (error) =>
      notify.error(error.message || 'Failed to create schedule'),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, data }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update schedule');
      }
      return response.json();
    },
    onError: (error) =>
      notify.error(error.message || 'Failed to update schedule'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schedules/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => fetchSchedules(),
    onError: (error) =>
      notify.error(error.message || 'Failed to update status'),
  });

  const schedules = getDataArray(schedulesData);
  const meta = getMeta(schedulesData);

  const refinedSchedules = useMemo(() => {
    let list = schedules;
    if (selectedLocation) {
      list = list.filter(
        (s) => String(s.duty_location_id) === String(selectedLocation),
      );
    }
    if (selectedShift) {
      list = list.filter((s) => s.shift_type === selectedShift);
    }
    return list;
  }, [schedules, selectedLocation, selectedShift]);

  const groupedByDate = useMemo(() => {
    if (viewMode !== 'all') return null;
    const map = new Map();
    refinedSchedules.forEach((s) => {
      const key = s.schedule_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([date, items]) => ({ date, items }));
  }, [refinedSchedules, viewMode]);

  const groupSchedules = (list) => {
    const map = new Map();
    list.forEach((s) => {
      const key = [
        s.schedule_date,
        s.shift_type || '',
        s.duty_location_id || 'none',
        s.start_time || '',
        s.end_time || '',
      ].join('|');
      if (!map.has(key)) {
        map.set(key, {
          key,
          date: s.schedule_date,
          shift_type: s.shift_type,
          duty_location_id: s.duty_location_id,
          start_time: s.start_time,
          end_time: s.end_time,
          duties: s.duties,
          notes: s.notes,
          items: [],
        });
      }
      map.get(key).items.push(s);
    });

    const groups = Array.from(map.values());
    groups.forEach((g) => {
      g.items.sort((a, b) =>
        byFields('lastname', 'firstname')(
          enforcers.find((e) => e.user_id === a.enforcer_id) || {},
          enforcers.find((e) => e.user_id === b.enforcer_id) || {},
        ),
      );
    });

    return groups;
  };

  const summaryCounts = useMemo(() => {
    const c = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 };
    refinedSchedules.forEach((s) => {
      if (c[s.status] !== undefined) c[s.status]++;
    });
    return c;
  }, [refinedSchedules]);

  const handleShiftTypeChange = (value) => {
    const defaults = SHIFT_DEFAULTS[value] || SHIFT_DEFAULTS.morning;
    setFormData((prev) => ({
      ...prev,
      shift_type: value,
      start_time: defaults.start,
      end_time: defaults.end,
    }));
  };

  const toggleEnforcer = (id) => {
    setSelectedEnforcerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ENFORCERS_PER_SHIFT) {
        setTimeout(
          () =>
            notify.warning(
              `A shift can have at most ${MAX_ENFORCERS_PER_SHIFT} enforcers. Remove one before adding another.`,
              { title: 'Limit Reached' },
            ),
          0,
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const clearSelectedEnforcers = () => setSelectedEnforcerIds([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!editingSchedule) {
      const minDate = tomorrowISO();
      if (!formData.schedule_date || formData.schedule_date < minDate) {
        notify.warning(
          'You cannot schedule for today or a past date. Please choose tomorrow or a later date.',
          { title: 'Invalid Date' },
        );
        return;
      }
    }

    if (selectedEnforcerIds.length === 0) {
      notify.warning('Please select at least one enforcer.');
      return;
    }
    if (selectedEnforcerIds.length > MAX_ENFORCERS_PER_SHIFT) {
      notify.warning(
        `Too many enforcers. A shift can have at most ${MAX_ENFORCERS_PER_SHIFT}.`,
      );
      return;
    }

    const defaults =
      SHIFT_DEFAULTS[formData.shift_type] || SHIFT_DEFAULTS.morning;

    const base = {
      duty_location_id: formData.duty_location_id
        ? parseInt(formData.duty_location_id)
        : null,
      schedule_date: formData.schedule_date,
      shift_type: formData.shift_type,
      start_time: defaults.start,
      end_time: defaults.end,
      duties: formData.duties || '',
      notes: formData.notes || '',
    };

    if (editingSchedule) {
      // Edit mode: update the primary schedule (either with the original
      // enforcer still selected, or with the first new enforcer), then
      // create any additional schedules for the newly added enforcers.
      try {
        const primaryEnforcerId = selectedEnforcerIds[0];
        const additionalEnforcerIds = selectedEnforcerIds.slice(1);

        await updateSchedule.mutateAsync({
          id: editingSchedule.schedule_id,
          data: { ...base, enforcer_id: primaryEnforcerId },
        });

        for (const enforcerId of additionalEnforcerIds) {
          await createSchedule.mutateAsync({
            ...base,
            enforcer_id: enforcerId,
          });
        }

        await fetchSchedules();
        setIsDialogOpen(false);
        resetForm();
        notify.success(
          `Schedule updated (${selectedEnforcerIds.length} enforcer${selectedEnforcerIds.length === 1 ? '' : 's'
          })`,
        );
      } catch {
        /* errors already alerted by mutation onError */
      }
      return;
    }

    let success = 0;
    let failed = 0;

    for (const enforcerId of selectedEnforcerIds) {
      try {
        await createSchedule.mutateAsync({
          ...base,
          enforcer_id: enforcerId,
        });
        success++;
      } catch {
        failed++;
      }
    }

    await fetchSchedules();
    setIsDialogOpen(false);
    resetForm();

    if (failed === 0) {
      notify.success(
        `Created ${success} schedule${success === 1 ? '' : 's'}`,
      );
    } else {
      notify.warning(`${success} created, ${failed} failed.`);
    }
  };

  const handleEditGroup = (group) => {
    const first = group.items[0];
    const shiftType = group.shift_type || 'morning';
    const defaults = SHIFT_DEFAULTS[shiftType] || SHIFT_DEFAULTS.morning;

    const preselect = group.items
      .map((i) => i.enforcer_id)
      .slice(0, MAX_ENFORCERS_PER_SHIFT);

    setEditingSchedule(first);
    setFormData({
      duty_location_id: group.duty_location_id || '',
      schedule_date: group.date,
      shift_type: shiftType,
      start_time: defaults.start,
      end_time: defaults.end,
      duties: group.duties || '',
      notes: group.notes || '',
    });
    setSelectedEnforcerIds(preselect);
    setIsDialogOpen(true);
  };

  const handleStatusChange = async (id, newStatus) => {
    const ok = await notify.confirm(
      `Change status to ${newStatus.replace('_', ' ')}?`,
      { confirmText: 'Change' },
    );
    if (ok) updateStatus.mutate({ id, status: newStatus });
  };

  const handleStatusChangeGroup = async (group, newStatus) => {
    const ok = await notify.confirm(
      `Change status for all ${group.items.length} schedule(s) to ${newStatus.replace(
        '_',
        ' ',
      )}?`,
      { confirmText: 'Change All' },
    );
    if (!ok) return;
    group.items.forEach((s) =>
      updateStatus.mutate({ id: s.schedule_id, status: newStatus }),
    );
  };

  const resetForm = () => {
    setEditingSchedule(null);
    setFormData({ ...defaultForm });
    setSelectedEnforcerIds([]);
    setEnforcerSearch('');
  };

  const clearFilters = () => {
    setSelectedEnforcer('');
    setSelectedStatus('');
    setSelectedLocation('');
    setSelectedShift('');
    setSearchTerm('');
  };

  const applyRange = () => setRange(rangeDraft);

  const applyPreset = (days) => {
    const next = {
      start_date: todayISO(),
      end_date: daysFromNowISO(days),
    };
    setRangeDraft(next);
    setRange(next);
  };

  const getEnforcerName = (id) => {
    const enforcer = enforcers.find((e) => e.user_id === id);
    return enforcer
      ? `${enforcer.firstname} ${enforcer.lastname}`
      : 'Unknown';
  };

  const getLocationName = (id) => {
    const location = dutyLocations.find((l) => l.id === id);
    return location ? location.name : 'No location';
  };

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchTerm) c++;
    if (selectedEnforcer) c++;
    if (selectedStatus) c++;
    if (selectedLocation) c++;
    if (selectedShift) c++;
    return c;
  }, [
    searchTerm,
    selectedEnforcer,
    selectedStatus,
    selectedLocation,
    selectedShift,
  ]);

  const chips = [
    searchTerm && [`Search: ${searchTerm}`, () => setSearchTerm('')],
    selectedEnforcer && [
      `Enforcer: ${enforcers.find(
        (e) => String(e.user_id) === String(selectedEnforcer),
      )?.firstname || selectedEnforcer
      }`,
      () => setSelectedEnforcer(''),
    ],
    selectedStatus && [
      `Status: ${STATUS_META[selectedStatus]?.label || selectedStatus}`,
      () => setSelectedStatus(''),
    ],
    selectedLocation && [
      `Location: ${getLocationName(Number(selectedLocation))}`,
      () => setSelectedLocation(''),
    ],
    selectedShift && [
      `Shift: ${SHIFT_LABELS[selectedShift] || selectedShift}`,
      () => setSelectedShift(''),
    ],
  ].filter(Boolean);

  const panel = (
    <FilterShell
      title="Filter Schedules"
      onClose={() => setShowFilters(false)}
      onReset={clearFilters}
    >
      <div>
        <L icon={Users}>Enforcer</L>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={selectedEnforcer}
          onChange={(e) => setSelectedEnforcer(e.target.value)}
        >
          <option value="">All Enforcers</option>
          {enforcers.map((e) => (
            <option key={e.user_id} value={e.user_id}>
              {e.firstname} {e.lastname}
            </option>
          ))}
        </select>
      </div>

      <div>
        <L>Status</L>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <L icon={MapPin}>Duty Location</L>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
        >
          <option value="">All Locations</option>
          {dutyLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <L icon={Clock}>Shift Type</L>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={selectedShift}
          onChange={(e) => setSelectedShift(e.target.value)}
        >
          <option value="">All Shifts</option>
          {Object.entries(SHIFT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </FilterShell>
  );

  const renderScheduleGroup = (group) => {
    const isGroup = group.items.length > 1;
    const first = group.items[0];
    const meta = STATUS_META[first.status] || STATUS_META.scheduled;
    const StatusIcon = meta.Icon;

    return (
      <li
        key={group.key}
        className={`${ROW_CLASS} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
        style={{ borderLeftColor: meta.color }}
      >
        <span className="text-sm font-medium text-[#16233F] whitespace-nowrap">
          <Mini>Date</Mini>
          {formatDisplayDate(group.date).split(',')[1]?.trim() || group.date}
        </span>

        <div className="min-w-0 flex items-center gap-2">
          <div className="w-9 h-9 shrink-0 rounded-full bg-[#16233F] flex items-center justify-center text-white text-xs font-bold">
            {isGroup ? (
              <Users className="w-4 h-4" />
            ) : (
              <>
                {getEnforcerName(first.enforcer_id)
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[#1F2937] truncate">
              {isGroup
                ? `${group.items.length} Enforcers`
                : getEnforcerName(first.enforcer_id)}
            </div>
            {isGroup && (
              <div className="text-xs text-[#64748B] truncate">
                {group.items
                  .map((i) => getEnforcerName(i.enforcer_id))
                  .join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-sm text-[#1F2937] flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-[#64748B] flex-shrink-0" />
            <span className="truncate">
              {formatTimeDisplay(group.start_time)} –{' '}
              {formatTimeDisplay(group.end_time)}
            </span>
          </div>
          {group.shift_type && (
            <div className="text-[11px] text-[#64748B] truncate">
              {SHIFT_LABELS[group.shift_type] || group.shift_type}
            </div>
          )}
        </div>

        <div className="min-w-0 flex items-center gap-1.5 text-sm text-[#1F2937]">
          <MapPin className="w-3 h-3 text-[#64748B] flex-shrink-0" />
          <span className="truncate">
            {group.duty_location_id
              ? getLocationName(group.duty_location_id)
              : '—'}
          </span>
        </div>

        <span className="justify-self-start">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.chip}`}
          >
            <StatusIcon className="w-3 h-3" />
            {meta.label.toUpperCase()}
          </span>
        </span>

        <select
          className="text-xs border rounded-lg px-2 py-1 border-[#E9ECF2] focus-visible:ring-[#F0B429] bg-white"
          value={isGroup ? '' : first.status}
          onChange={(e) =>
            isGroup
              ? handleStatusChangeGroup(group, e.target.value)
              : handleStatusChange(first.schedule_id, e.target.value)
          }
        >
          {isGroup && <option value="">Set all…</option>}
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>

        <div className="justify-self-end md:justify-self-start">
          <ActionButton
            icon={Pencil}
            variant="info"
            onClick={() => handleEditGroup(group)}
          >
            Edit
          </ActionButton>
        </div>
      </li>
    );
  };

  const renderScheduleCard = (group) => {
    const isGroup = group.items.length > 1;
    const first = group.items[0];
    const meta = STATUS_META[first.status] || STATUS_META.scheduled;
    const StatusIcon = meta.Icon;

    return (
      <article
        key={group.key}
        className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
      >
        <div className="h-2" style={{ background: meta.color }} />
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <span className="font-mono text-sm font-semibold text-[#16233F]">
              {formatDisplayDate(group.date)}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${meta.chip}`}
            >
              <StatusIcon className="w-3 h-3" />
              {meta.label.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#16233F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {isGroup ? (
                <Users className="w-5 h-5" />
              ) : (
                <>
                  {getEnforcerName(first.enforcer_id)
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                {isGroup
                  ? `${group.items.length} Enforcers`
                  : getEnforcerName(first.enforcer_id)}
              </p>
              {isGroup && (
                <p className="text-xs text-[#64748B] truncate">
                  {group.items
                    .map((i) => getEnforcerName(i.enforcer_id))
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p className="text-[10px] text-[#94A3B8]">Time</p>
              <p className="text-sm text-[#1F2937]">
                {formatTimeDisplay(group.start_time)} –{' '}
                {formatTimeDisplay(group.end_time)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#94A3B8]">Shift</p>
              <p className="text-sm text-[#1F2937]">
                {group.shift_type
                  ? SHIFT_LABELS[group.shift_type] || group.shift_type
                  : '—'}
              </p>
            </div>
            <div className="min-w-0 col-span-2">
              <p className="text-[10px] text-[#94A3B8]">Location</p>
              <p className="text-sm text-[#1F2937] flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#64748B]" />
                {group.duty_location_id
                  ? getLocationName(group.duty_location_id)
                  : '—'}
              </p>
            </div>
          </div>

          {group.duties && (
            <p className="mt-3 text-xs text-[#64748B] line-clamp-2">
              📋 {group.duties}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">
            <ActionButton
              icon={Pencil}
              variant="info"
              onClick={() => handleEditGroup(group)}
            >
              Edit
            </ActionButton>
          </div>
        </div>
      </article>
    );
  };

  const currentShift =
    SHIFT_DEFAULTS[formData.shift_type] || SHIFT_DEFAULTS.morning;

  const filteredEnforcersForPicker = enforcers.filter((e) => {
    if (!enforcerSearch.trim()) return true;
    const q = enforcerSearch.toLowerCase();
    return `${e.firstname} ${e.lastname} ${e.email || ''}`
      .toLowerCase()
      .includes(q);
  });

  const atCap = selectedEnforcerIds.length >= MAX_ENFORCERS_PER_SHIFT;
  const isLoadingAny = isLoadingEnforcers || isLoadingLocations;

  if (isLoadingAny) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#16233F]" />
      </div>
    );
  }

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
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">
            Enforcer Schedule
          </h1>
          <p className="text-[#C7CEDB] text-sm mt-1">
            {viewMode === 'all'
              ? `All schedules from ${range.start_date} to ${range.end_date}`
              : `Daily duty assignments for ${formatDisplayDate(selectedDate)}`}
          </p>
        </div>

        <div className="relative flex flex-wrap gap-2">
          <Button
            onClick={fetchSchedules}
            variant="outline"
            className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={resetForm}
                className="bg-[#1E8449] hover:bg-[#186B3B]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Schedule
              </Button>
            </DialogTrigger>

            {/* ============================================ */}
            {/*  REDESIGNED MODAL — 80% width, two columns   */}
            {/* ============================================ */}
            <DialogContent className="w-[80vw] max-w-[1200px] max-h-[90vh] overflow-hidden p-0 gap-0">
              <DialogHeader className="px-7 pt-6 pb-5 border-b border-dashed border-[#CBD5E1] bg-white">
                <DialogTitle className="font-['Oswald'] text-2xl text-[#16233F] flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-[#FBF1DC] flex items-center justify-center flex-shrink-0">
                    {editingSchedule ? (
                      <Pencil className="w-5 h-5 text-[#92600A]" />
                    ) : (
                      <CalendarDays className="w-5 h-5 text-[#92600A]" />
                    )}
                  </span>
                  <div>
                    <div className="leading-tight">
                      {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
                    </div>
                    <div className="text-xs font-normal text-[#64748B] font-['Inter'] mt-0.5">
                      {editingSchedule
                        ? `Editing ${selectedEnforcerIds.length} enforcer${selectedEnforcerIds.length === 1 ? '' : 's'
                        } for this shift`
                        : 'Assign up to 2 enforcers to a shift'}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col max-h-[calc(90vh-100px)]"
              >
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                    {/* ============ LEFT: FORM FIELDS ============ */}
                    <div className="lg:col-span-2 p-7 space-y-7 border-r border-dashed border-[#CBD5E1]">
                      {/* ──── WHEN ──── */}
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <CalendarDays className="w-4 h-4 text-[#F0B429]" />
                          <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                            When
                          </h3>
                          <span className="h-px flex-1 bg-[#E3E7EE]" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <L icon={Calendar}>
                              Date{' '}
                              <span className="text-[#C8202F]">*</span>
                            </L>
                            <Input
                              type="date"
                              value={formData.schedule_date}
                              min={
                                editingSchedule ? undefined : tomorrowISO()
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  schedule_date: e.target.value,
                                })
                              }
                              required
                              className="focus-visible:ring-[#F0B429] h-11"
                            />
                            <p className="mt-1.5 flex items-center gap-1 text-xs text-[#64748B]">
                              <AlertCircle className="h-3 w-3" />
                              Schedules must be created at least one day in
                              advance.
                            </p>
                          </div>
                          <div>
                            <L icon={Clock}>Shift type</L>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(SHIFT_DEFAULTS).map(
                                ([key, shift]) => {
                                  const active =
                                    formData.shift_type === key;
                                  const Icon = shift.Icon;
                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() =>
                                        handleShiftTypeChange(key)
                                      }
                                      className={`relative text-left p-3 rounded-xl border-2 transition-all ${active
                                          ? 'border-[#16233F] shadow-sm'
                                          : 'border-[#E3E7EE] hover:border-[#94A3B8]'
                                        }`}
                                      style={
                                        active
                                          ? { background: shift.tint }
                                          : undefined
                                      }
                                    >
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <Icon
                                          className="w-4 h-4"
                                          style={{
                                            color: active
                                              ? shift.accent
                                              : '#94A3B8',
                                          }}
                                        />
                                        <span
                                          className={`text-xs font-semibold ${active
                                              ? 'text-[#16233F]'
                                              : 'text-[#64748B]'
                                            }`}
                                        >
                                          {shift.label}
                                        </span>
                                        {active && (
                                          <Check className="w-3.5 h-3.5 text-[#16233F] ml-auto" />
                                        )}
                                      </div>
                                      <p
                                        className={`text-[10px] tabular-nums ${active
                                            ? 'text-[#16233F]/70'
                                            : 'text-[#94A3B8]'
                                          }`}
                                      >
                                        {shift.sublabel}
                                      </p>
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-5">
                          <div>
                            <L icon={Lock}>Start time</L>
                            <Input
                              type="time"
                              value={formData.start_time}
                              readOnly
                              disabled
                              tabIndex={-1}
                              aria-readonly="true"
                              className="bg-[#F5F6F8] text-[#64748B] cursor-not-allowed focus-visible:ring-0 h-11 tabular-nums"
                            />
                          </div>
                          <div>
                            <L icon={Lock}>End time</L>
                            <Input
                              type="time"
                              value={formData.end_time}
                              readOnly
                              disabled
                              tabIndex={-1}
                              aria-readonly="true"
                              className="bg-[#F5F6F8] text-[#64748B] cursor-not-allowed focus-visible:ring-0 h-11 tabular-nums"
                            />
                          </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-lg border border-[#E3E7EE] bg-[#F8F9FA] px-3 py-2.5 text-xs text-[#64748B] mt-3">
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                          <span>
                            Times are locked to the{' '}
                            <strong className="text-[#16233F]">
                              {currentShift.label}
                            </strong>{' '}
                            shift. Choose a different shift type above to
                            change them.
                          </span>
                        </div>
                      </section>

                      {/* ──── WHERE ──── */}
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="w-4 h-4 text-[#F0B429]" />
                          <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                            Where
                          </h3>
                          <span className="h-px flex-1 bg-[#E3E7EE]" />
                        </div>

                        <div>
                          <L icon={MapPin}>Duty location</L>
                          <select
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                            value={formData.duty_location_id}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                duty_location_id: e.target.value,
                              })
                            }
                          >
                            <option value="">No specific location</option>
                            {dutyLocations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </section>

                      {/* ──── WHAT ──── */}
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <List className="w-4 h-4 text-[#F0B429]" />
                          <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                            What
                          </h3>
                          <span className="h-px flex-1 bg-[#E3E7EE]" />
                        </div>

                        <div className="space-y-4">
                          <div>
                            <L>Specific duties</L>
                            <textarea
                              className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                              placeholder="List specific duties for this shift…"
                              value={formData.duties}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  duties: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <L>Notes</L>
                            <Input
                              placeholder="Additional notes (optional)"
                              value={formData.notes}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  notes: e.target.value,
                                })
                              }
                              className="focus-visible:ring-[#F0B429] h-11"
                            />
                          </div>
                        </div>
                      </section>
                    </div>

                    {/* ============ RIGHT: SUMMARY + PICKER ============ */}
                    <div className="p-7 space-y-6 bg-[#F8F9FA]">
                      {/* Live preview */}
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="w-4 h-4 text-[#1E8449]" />
                          <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                            Preview
                          </h3>
                        </div>
                        <div className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden">
                          <div
                            className="h-1.5"
                            style={{ background: currentShift.accent }}
                          />
                          <div className="p-4 space-y-3">
                            <PreviewRow
                              icon={CalendarDays}
                              label="Date"
                              value={
                                formData.schedule_date
                                  ? formatDisplayDate(formData.schedule_date)
                                  : '—'
                              }
                            />
                            <PreviewRow
                              icon={currentShift.Icon}
                              label="Shift"
                              value={`${currentShift.label} · ${currentShift.sublabel}`}
                            />
                            <PreviewRow
                              icon={MapPin}
                              label="Location"
                              value={
                                formData.duty_location_id
                                  ? getLocationName(
                                    Number(formData.duty_location_id),
                                  )
                                  : 'No location'
                              }
                            />
                            <PreviewRow
                              icon={Users}
                              label="Enforcers"
                              value={`${selectedEnforcerIds.length} / ${MAX_ENFORCERS_PER_SHIFT}`}
                              accent={atCap ? '#C8202F' : '#1E8449'}
                            />
                          </div>
                        </div>
                      </section>

                      {/* Enforcer picker */}
                      <section>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-[#1E8449]" />
                            <h3 className="font-['Oswald'] text-lg text-[#16233F]">
                              Assign enforcers
                            </h3>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${atCap
                                ? 'bg-[#FBE7E9] text-[#C8202F]'
                                : 'bg-[#E5F2EA] text-[#1E8449]'
                              }`}
                          >
                            {selectedEnforcerIds.length} /{' '}
                            {MAX_ENFORCERS_PER_SHIFT}
                          </span>
                        </div>

                        <p className="text-xs text-[#64748B] mb-3">
                          Maximum {MAX_ENFORCERS_PER_SHIFT} enforcers per shift.
                        </p>

                        {selectedEnforcerIds.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {selectedEnforcerIds.map((id) => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-full bg-[#16233F] px-2.5 py-1 text-xs text-white"
                              >
                                {getEnforcerName(id)}
                                <button
                                  type="button"
                                  onClick={() => toggleEnforcer(id)}
                                  className="rounded-full p-0.5 hover:bg-white/20"
                                  aria-label={`Remove ${getEnforcerName(id)}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                          <input
                            type="text"
                            placeholder="Search enforcers…"
                            value={enforcerSearch}
                            onChange={(e) =>
                              setEnforcerSearch(e.target.value)
                            }
                            className="w-full rounded-full border border-input bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#F0B429]"
                          />
                        </div>

                        <div className="flex items-center justify-between mb-2 text-xs">
                          <button
                            type="button"
                            onClick={clearSelectedEnforcers}
                            className="text-[#C8202F] hover:underline font-medium"
                          >
                            Clear all
                          </button>
                          <span className="text-[#94A3B8]">
                            {filteredEnforcersForPicker.length} available
                          </span>
                        </div>

                        <div className="max-h-[340px] overflow-y-auto rounded-xl border border-[#E3E7EE] bg-white">
                          {isLoadingEnforcers ? (
                            <div className="flex items-center justify-center py-8 text-sm text-[#64748B]">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading…
                            </div>
                          ) : filteredEnforcersForPicker.length === 0 ? (
                            <div className="py-8 text-center text-sm text-[#64748B]">
                              No enforcers match your search.
                            </div>
                          ) : (
                            filteredEnforcersForPicker.map((e) => {
                              const checked =
                                selectedEnforcerIds.includes(e.user_id);
                              const disabled = atCap && !checked;
                              return (
                                <button
                                  key={e.user_id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => toggleEnforcer(e.user_id)}
                                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors border-b border-[#EEF0F4] last:border-b-0 ${checked
                                      ? 'bg-[#E5F2EA]'
                                      : disabled
                                        ? 'cursor-not-allowed opacity-50'
                                        : 'hover:bg-[#F8F9FA]'
                                    }`}
                                  title={
                                    disabled
                                      ? `Limit is ${MAX_ENFORCERS_PER_SHIFT} per shift`
                                      : undefined
                                  }
                                >
                                  <span
                                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${checked
                                        ? 'border-[#1E8449] bg-[#1E8449]'
                                        : 'border-[#CBD5E1] bg-white'
                                      }`}
                                  >
                                    {checked && (
                                      <Check className="h-3.5 w-3.5 text-white" />
                                    )}
                                  </span>
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#16233F] text-[11px] font-bold text-white">
                                    {e.firstname?.[0]}
                                    {e.lastname?.[0]}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-medium text-[#1F2937]">
                                      {e.firstname} {e.lastname}
                                    </p>
                                    {e.email && (
                                      <p className="truncate text-[11px] text-[#94A3B8]">
                                        {e.email}
                                      </p>
                                    )}
                                  </div>
                                  {checked && (
                                    <CheckCircle className="h-4 w-4 text-[#1E8449] flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-dashed border-[#CBD5E1] bg-white">
                  <div className="text-xs text-[#64748B] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
                    {selectedEnforcerIds.length === 0 ? (
                      <span>Select at least one enforcer to continue.</span>
                    ) : (
                      <span>
                        Ready to{' '}
                        {editingSchedule ? 'update' : 'create'}{' '}
                        <strong className="text-[#16233F]">
                          {selectedEnforcerIds.length}
                        </strong>{' '}
                        schedule
                        {selectedEnforcerIds.length === 1 ? '' : 's'}.
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="min-w-[100px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-[#1E8449] hover:bg-[#186B3B] min-w-[180px]"
                      disabled={
                        createSchedule.isPending ||
                        updateSchedule.isPending ||
                        selectedEnforcerIds.length === 0
                      }
                    >
                      {createSchedule.isPending ||
                        updateSchedule.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving…
                        </>
                      ) : editingSchedule ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Update Schedule
                          {selectedEnforcerIds.length > 1
                            ? ` (${selectedEnforcerIds.length})`
                            : ''}
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create{' '}
                          {selectedEnforcerIds.length > 1
                            ? `${selectedEnforcerIds.length} Schedules`
                            : 'Schedule'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* View mode + range selector */}
      <div className="bg-white rounded-xl border border-[#E3E7EE] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-[#F5F6F8] p-1">
            <button
              type="button"
              onClick={() => setViewMode('date')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'date'
                  ? 'bg-[#16233F] text-white'
                  : 'text-[#64748B] hover:text-[#16233F]'
                }`}
            >
              <CalendarDays className="w-4 h-4" />
              By Date
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'all'
                  ? 'bg-[#16233F] text-white'
                  : 'text-[#64748B] hover:text-[#16233F]'
                }`}
            >
              <List className="w-4 h-4" />
              All Schedules
            </button>
          </div>
        </div>

        {viewMode === 'date' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#16233F]" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44 focus-visible:ring-[#F0B429]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(todayISO())}
              className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
            >
              Today
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={rangeDraft.start_date}
                onChange={(e) =>
                  setRangeDraft((r) => ({
                    ...r,
                    start_date: e.target.value,
                  }))
                }
                className="w-40 focus-visible:ring-[#F0B429]"
              />
              <span className="text-[#64748B] text-sm">to</span>
              <Input
                type="date"
                value={rangeDraft.end_date}
                onChange={(e) =>
                  setRangeDraft((r) => ({ ...r, end_date: e.target.value }))
                }
                className="w-40 focus-visible:ring-[#F0B429]"
              />
              <Button
                onClick={applyRange}
                className="bg-[#16233F] hover:bg-[#0F1A2E] text-white"
                size="sm"
              >
                Apply
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#94A3B8] mr-1">Quick:</span>
              {[
                { label: 'Today', days: 0 },
                { label: 'Next 7d', days: 7 },
                { label: 'Next 30d', days: 30 },
                { label: 'Next 90d', days: 90 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="text-xs px-2.5 py-1 rounded-md bg-[#E9ECF2] text-[#16233F] hover:bg-[#DCE1EA] font-medium"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
            placeholder="Search enforcer, location, duties…"
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

      <div
        className={`grid gap-6 ${showFilters ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : ''
          }`}
      >
        {showFilters && panel}

        <div className="space-y-4 min-w-0">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map(([label, clear]) => (
                <Chip key={label} label={label} onClear={clear} />
              ))}
            </div>
          )}

          {refinedSchedules.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const Icon = meta.Icon;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 flex items-center gap-2"
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: meta.color }}
                    />
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: meta.color }}
                    >
                      {summaryCounts[key] || 0}
                    </span>
                    <span className="text-xs text-[#64748B]">
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
            <CalendarDays className="w-5 h-5 text-[#F0B429]" />
            Schedules
            <span className="text-xs font-normal text-[#64748B] font-['Inter']">
              {isLoading
                ? 'Loading…'
                : `${refinedSchedules.length} shown${meta.total ? ` · ${meta.total} total` : ''
                }`}
            </span>
          </h2>

          {error ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <XCircle className="w-12 h-12 text-[#C8202F] mx-auto mb-3" />
              <p className="text-[#C8202F] mb-4">{error}</p>
              <Button
                onClick={fetchSchedules}
                variant="outline"
                className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try again
              </Button>
            </div>
          ) : isLoading && refinedSchedules.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#16233F]" />
            </div>
          ) : refinedSchedules.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E3E7EE] p-12 text-center">
              <Calendar className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#1F2937]">
                No Schedules Found
              </h3>
              <p className="text-[#64748B] mt-1">
                {viewMode === 'all'
                  ? 'No schedules match your filters in this date range.'
                  : 'No schedules match your filters on this date.'}
              </p>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  className="mt-4 border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              )}
              <Button
                className="mt-4 ml-2 bg-[#1E8449] hover:bg-[#186B3B]"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Schedule
              </Button>
            </div>
          ) : viewMode === 'date' ? (
            view === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {groupSchedules(refinedSchedules).map(renderScheduleCard)}
              </div>
            ) : (
              <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                <div
                  className={`hidden ${ROW_CLASS} bg-[#16233F] text-white text-xs font-semibold`}
                >
                  {[
                    'Date',
                    'Enforcer(s)',
                    'Time / Shift',
                    'Location',
                    'Status',
                    'Set all…',
                    'Actions',
                  ].map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                <ul className="divide-y divide-[#EEF0F4]">
                  {groupSchedules(refinedSchedules).map(renderScheduleGroup)}
                </ul>
              </div>
            )
          ) : view === 'cards' ? (
            <div className="space-y-6">
              {groupedByDate.map(({ date, items }) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-[#16233F]" />
                    <h3 className="text-sm font-semibold text-[#16233F]">
                      {formatDisplayDate(date)}
                    </h3>
                    <span className="text-xs text-[#94A3B8]">
                      ({items.length}{' '}
                      {items.length === 1 ? 'schedule' : 'schedules'})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupSchedules(items).map(renderScheduleCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDate.map(({ date, items }) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4 text-[#16233F]" />
                    <h3 className="text-sm font-semibold text-[#16233F]">
                      {formatDisplayDate(date)}
                    </h3>
                    <span className="text-xs text-[#94A3B8]">
                      ({items.length}{' '}
                      {items.length === 1 ? 'schedule' : 'schedules'})
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                    <div
                      className={`hidden ${ROW_CLASS} bg-[#16233F] text-white text-xs font-semibold`}
                    >
                      {[
                        'Date',
                        'Enforcer(s)',
                        'Time / Shift',
                        'Location',
                        'Status',
                        'Set all…',
                        'Actions',
                      ].map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </div>
                    <ul className="divide-y divide-[#EEF0F4]">
                      {groupSchedules(items).map(renderScheduleGroup)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && refinedSchedules.length > 0 && meta.last_page > 1 && (
            <Pagination
              currentPage={meta.current_page || 1}
              totalPages={meta.last_page || 1}
              onPageChange={setPage}
              totalItems={meta.total || 0}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const PreviewRow = ({ icon: Icon, label, value, accent }) => (
  <div className="flex items-start gap-2.5">
    <div className="w-7 h-7 rounded-md bg-[#F5F6F8] flex items-center justify-center flex-shrink-0">
      <Icon className="w-3.5 h-3.5 text-[#64748B]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">
        {label}
      </p>
      <p
        className="text-sm text-[#1F2937] truncate"
        style={accent ? { color: accent, fontWeight: 600 } : undefined}
      >
        {value}
      </p>
    </div>
  </div>
);

export default Schedule;