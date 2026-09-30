// web/src/pages/Schedule.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../components/ui/card';
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
  Trash2,
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
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAlert } from '../components/ui/AlertProvider';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ITEMS_PER_PAGE = 20;

const MAX_ENFORCERS_PER_SHIFT = 2;

const SHIFT_DEFAULTS = {
  morning: { start: '08:00', end: '12:00', label: '🌅 Morning (8:00 AM – 12:00 PM)' },
  afternoon: { start: '13:00', end: '17:00', label: '☀️ Afternoon (1:00 PM – 5:00 PM)' },
  night: { start: '18:00', end: '22:00', label: '🌙 Night (6:00 PM – 10:00 PM)' },
  full: { start: '08:00', end: '17:00', label: '📅 Full Day (8:00 AM – 5:00 PM)' },
};

const STATUS_META = {
  scheduled: {
    label: 'Scheduled',
    color: 'text-[#92600A]',
    bg: 'bg-[#FBF1DC]',
    border: 'border-[#F0B429]/20',
    Icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-[#C2541F]',
    bg: 'bg-[#FBEAE2]',
    border: 'border-[#C2541F]/20',
    Icon: PlayCircle,
  },
  completed: {
    label: 'Completed',
    color: 'text-[#1E8449]',
    bg: 'bg-[#E5F2EA]',
    border: 'border-[#1E8449]/20',
    Icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-[#C8202F]',
    bg: 'bg-[#FBE7E9]',
    border: 'border-[#C8202F]/20',
    Icon: XCircle,
  },
};

const SHIFT_LABELS = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  night: '🌙 Night',
  full: '📅 Full Day',
};

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

const Schedule = () => {
  const notify = useAlert();

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
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

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
  const [enforcerPickerOpen, setEnforcerPickerOpen] = useState(false);
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
      setEnforcers(data.data || []);
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
      setDutyLocations(data.data || []);
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

  const deleteSchedule = useMutation({
    mutationFn: async (id) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete schedule');
    },
    onError: (error) =>
      notify.error(error.message || 'Failed to delete schedule'),
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

  const groupedByDate = useMemo(() => {
    if (viewMode !== 'all') return null;
    const map = new Map();
    schedules.forEach((s) => {
      const key = s.schedule_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [schedules, viewMode]);

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
    return Array.from(map.values());
  };

  const summaryCounts = useMemo(() => {
    const c = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 };
    schedules.forEach((s) => {
      if (c[s.status] !== undefined) c[s.status]++;
    });
    return c;
  }, [schedules]);

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

  const selectAllVisibleEnforcers = () => {
    setSelectedEnforcerIds((prev) => {
      const remaining = MAX_ENFORCERS_PER_SHIFT - prev.length;
      if (remaining <= 0) {
        setTimeout(
          () =>
            notify.warning(
              `A shift can have at most ${MAX_ENFORCERS_PER_SHIFT} enforcers.`,
              { title: 'Limit Reached' },
            ),
          0,
        );
        return prev;
      }

      const visible = enforcers
        .filter((e) => {
          if (!enforcerSearch.trim()) return true;
          const q = enforcerSearch.toLowerCase();
          return `${e.firstname} ${e.lastname}`.toLowerCase().includes(q);
        })
        .map((e) => e.user_id)
        .filter((id) => !prev.includes(id));

      const toAdd = visible.slice(0, remaining);
      if (visible.length > remaining) {
        setTimeout(
          () =>
            notify.warning(
              `Only ${remaining} more enforcer${remaining === 1 ? '' : 's'} can be added (limit: ${MAX_ENFORCERS_PER_SHIFT} per shift).`,
              { title: 'Limit Reached' },
            ),
          0,
        );
      }
      return [...prev, ...toAdd];
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
      const originalEnforcerId = editingSchedule.enforcer_id;
      const stillIncluded = selectedEnforcerIds.includes(originalEnforcerId);
      const additions = selectedEnforcerIds.filter(
        (id) => id !== originalEnforcerId,
      );

      try {
        if (stillIncluded) {
          await updateSchedule.mutateAsync({
            id: editingSchedule.schedule_id,
            data: { ...base, enforcer_id: originalEnforcerId },
          });
        } else {
          await deleteSchedule.mutateAsync(editingSchedule.schedule_id);
        }

        for (const enforcerId of additions) {
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

  const handleDeleteGroup = async (group) => {
    const ok = await notify.confirm(
      `Delete all ${group.items.length} schedule(s) in this shift?`,
      { destructive: true, confirmText: 'Delete' },
    );
    if (!ok) return;
    group.items.forEach((s) => deleteSchedule.mutate(s.schedule_id));
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
      `Change status for all ${group.items.length} schedule(s) to ${newStatus.replace('_', ' ')}?`,
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
    setEnforcerPickerOpen(false);
  };

  const clearFilters = () => {
    setSelectedEnforcer('');
    setSelectedStatus('');
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
    return enforcer ? `${enforcer.firstname} ${enforcer.lastname}` : 'Unknown';
  };

  const getLocationName = (id) => {
    const location = dutyLocations.find((l) => l.id === id);
    return location ? location.name : 'No location';
  };

  const hasActiveFilters = selectedEnforcer || selectedStatus || searchTerm;
  const isLoadingAny = isLoadingEnforcers || isLoadingLocations;

  if (isLoadingAny) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#16233F]" />
      </div>
    );
  }

  const renderScheduleGroup = (group) => {
    const isGroup = group.items.length > 1;
    const first = group.items[0];
    const meta = STATUS_META[first.status] || STATUS_META.scheduled;
    const StatusIcon = meta.Icon;

    return (
      <div
        key={group.key}
        className="bg-white rounded-xl shadow-sm border border-[#E9ECF2] overflow-hidden hover:shadow-md transition-shadow"
      >
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#16233F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {isGroup ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    <>
                      {getEnforcerName(first.enforcer_id)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-[#1F2937]">
                    {isGroup
                      ? `${group.items.length} Enforcers Assigned`
                      : getEnforcerName(first.enforcer_id)}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-[#64748B]">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatTimeDisplay(group.start_time)} –{' '}
                      {formatTimeDisplay(group.end_time)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#64748B] ml-[52px]">
                {group.duty_location_id && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{getLocationName(group.duty_location_id)}</span>
                  </div>
                )}
                {group.shift_type && (
                  <div className="flex items-center gap-1">
                    <span>
                      {SHIFT_LABELS[group.shift_type] || group.shift_type}
                    </span>
                  </div>
                )}
                {group.duties && (
                  <div className="flex items-center gap-1 text-[#64748B]">
                    📋 {group.duties}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.color} flex items-center gap-1`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {meta.label}
              </span>

              {isGroup ? (
                <select
                  className="text-sm border rounded-lg px-2 py-1 border-[#E9ECF2] focus-visible:ring-[#F0B429] bg-white"
                  value=""
                  onChange={(e) =>
                    handleStatusChangeGroup(group, e.target.value)
                  }
                >
                  <option value="">Set all…</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              ) : (
                <select
                  className="text-sm border rounded-lg px-2 py-1 border-[#E9ECF2] focus-visible:ring-[#F0B429] bg-white"
                  value={first.status}
                  onChange={(e) =>
                    handleStatusChange(first.schedule_id, e.target.value)
                  }
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditGroup(group)}
                className="text-[#16233F] hover:bg-[#E9ECF2]"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteGroup(group)}
                className="text-[#C8202F] hover:bg-[#FBE7E9]"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isGroup && (
            <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
              <div className="flex flex-wrap gap-2">
                {group.items.map((s) => (
                  <span
                    key={s.schedule_id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F6F8] px-2.5 py-1 text-xs text-[#1F2937]"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#16233F] text-[9px] font-bold text-white">
                      {getEnforcerName(s.enforcer_id)
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                    {getEnforcerName(s.enforcer_id)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
            Enforcer Schedule
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            {viewMode === 'all'
              ? `All schedules from ${range.start_date} to ${range.end_date}`
              : `Daily duty assignments for ${formatDisplayDate(selectedDate)}`}
          </p>
        </div>

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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-['Oswald'] text-[#16233F]">
                {editingSchedule
                  ? `Edit Schedule${selectedEnforcerIds.length > 1
                    ? ` (${selectedEnforcerIds.length} enforcers)`
                    : ''
                  }`
                  : 'Add New Schedule'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-[#1F2937]">
                    Enforcers *
                  </label>
                  <span
                    className={`text-xs font-semibold ${atCap ? 'text-[#C8202F]' : 'text-[#64748B]'
                      }`}
                  >
                    {selectedEnforcerIds.length} / {MAX_ENFORCERS_PER_SHIFT}
                  </span>
                </div>

                {selectedEnforcerIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedEnforcerIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-[#16233F] px-2 py-0.5 text-xs text-white"
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

                <button
                  type="button"
                  onClick={() => setEnforcerPickerOpen((v) => !v)}
                  className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-[#F8F9FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0B429]"
                >
                  <span className="text-[#64748B]">
                    {selectedEnforcerIds.length === 0
                      ? 'Select enforcers…'
                      : atCap
                        ? 'Limit reached — remove one to change'
                        : 'Change selection'}
                  </span>
                  <Users className="h-4 w-4 text-[#64748B]" />
                </button>

                {enforcerPickerOpen && (
                  <div className="mt-2 rounded-md border border-[#E9ECF2] bg-white shadow-sm">
                    <div className="border-b border-[#E9ECF2] p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                        <input
                          type="text"
                          placeholder="Search enforcers…"
                          value={enforcerSearch}
                          onChange={(e) => setEnforcerSearch(e.target.value)}
                          className="w-full rounded border border-input bg-background pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F0B429]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#E9ECF2] px-2 py-1.5 text-xs">
                      <button
                        type="button"
                        onClick={selectAllVisibleEnforcers}
                        className="text-[#16233F] hover:underline font-medium"
                      >
                        Select up to {MAX_ENFORCERS_PER_SHIFT}
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectedEnforcers}
                        className="text-[#C8202F] hover:underline font-medium"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto">
                      {isLoadingEnforcers ? (
                        <div className="flex items-center justify-center py-6 text-sm text-[#64748B]">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading…
                        </div>
                      ) : filteredEnforcersForPicker.length === 0 ? (
                        <div className="py-6 text-center text-sm text-[#64748B]">
                          No enforcers match your search.
                        </div>
                      ) : (
                        filteredEnforcersForPicker.map((e) => {
                          const checked = selectedEnforcerIds.includes(
                            e.user_id,
                          );
                          const disabled = atCap && !checked;
                          return (
                            <button
                              key={e.user_id}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleEnforcer(e.user_id)}
                              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors ${checked
                                ? 'bg-[#E5F2EA]'
                                : disabled
                                  ? 'cursor-not-allowed opacity-50'
                                  : 'hover:bg-[#F5F6F8]'
                                }`}
                              title={
                                disabled
                                  ? `Limit is ${MAX_ENFORCERS_PER_SHIFT} per shift`
                                  : undefined
                              }
                            >
                              <span
                                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked
                                  ? 'border-[#1E8449] bg-[#1E8449]'
                                  : 'border-[#CBD5E1] bg-white'
                                  }`}
                              >
                                {checked && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </span>
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#16233F] text-[10px] font-bold text-white">
                                {e.firstname?.[0]}
                                {e.lastname?.[0]}
                              </span>
                              <span className="flex-1 truncate text-[#1F2937]">
                                {e.firstname} {e.lastname}
                              </span>
                              {e.role && (
                                <span className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                                  {e.role}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <p className="mt-1 flex items-center gap-1 text-xs text-[#64748B]">
                  <AlertCircle className="h-3 w-3" />
                  Maximum of {MAX_ENFORCERS_PER_SHIFT} enforcers per shift.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Duty Location
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                  value={formData.duty_location_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duty_location_id: e.target.value,
                    })
                  }
                >
                  <option value="">No Location</option>
                  {dutyLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Date *
                </label>
                <Input
                  type="date"
                  value={formData.schedule_date}
                  min={editingSchedule ? undefined : tomorrowISO()}
                  onChange={(e) =>
                    setFormData({ ...formData, schedule_date: e.target.value })
                  }
                  required
                  className="focus-visible:ring-[#F0B429]"
                />
                <p className="mt-1 flex items-center gap-1 text-xs text-[#64748B]">
                  <AlertCircle className="h-3 w-3" />
                  Schedules must be created at least one day in advance.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Shift Type *
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                  value={formData.shift_type}
                  onChange={(e) => handleShiftTypeChange(e.target.value)}
                  required
                >
                  {Object.entries(SHIFT_DEFAULTS).map(([key, shift]) => (
                    <option key={key} value={key}>
                      {shift.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[#64748B]">
                  Start and end time are set automatically based on the shift
                  type.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 flex items-center gap-1.5 text-[#1F2937]">
                    Start Time
                    <Lock className="w-3 h-3 text-[#94A3B8]" />
                  </label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    readOnly
                    disabled
                    tabIndex={-1}
                    aria-readonly="true"
                    className="bg-[#F5F6F8] text-[#64748B] cursor-not-allowed focus-visible:ring-0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 flex items-center gap-1.5 text-[#1F2937]">
                    End Time
                    <Lock className="w-3 h-3 text-[#94A3B8]" />
                  </label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    readOnly
                    disabled
                    tabIndex={-1}
                    aria-readonly="true"
                    className="bg-[#F5F6F8] text-[#64748B] cursor-not-allowed focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md border border-[#E9ECF2] bg-[#F8F9FA] px-3 py-2 text-xs text-[#64748B]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                <span>
                  Times are locked to the shift type&nbsp;
                  <strong className="text-[#16233F]">
                    {currentShift.label}
                  </strong>
                  . To change them, select a different shift type.
                </span>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Specific Duties
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                  placeholder="List specific duties for this shift"
                  value={formData.duties}
                  onChange={(e) =>
                    setFormData({ ...formData, duties: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Notes
                </label>
                <Input
                  placeholder="Additional notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="focus-visible:ring-[#F0B429]"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#1E8449] hover:bg-[#186B3B]"
                disabled={
                  createSchedule.isPending || updateSchedule.isPending
                }
              >
                {createSchedule.isPending || updateSchedule.isPending
                  ? 'Saving…'
                  : editingSchedule
                    ? `Update Schedule${selectedEnforcerIds.length > 1
                      ? ` (${selectedEnforcerIds.length} enforcers)`
                      : ''
                    }`
                    : selectedEnforcerIds.length > 1
                      ? `Create ${selectedEnforcerIds.length} Schedules`
                      : 'Create Schedule'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E9ECF2] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          <Button
            variant="outline"
            size="sm"
            onClick={fetchSchedules}
            disabled={isLoading}
            className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
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

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#F1F5F9]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#16233F]" />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-[#F0B429]"
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

          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-[#F0B429]"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <Input
              placeholder="Search enforcer, location, duties…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 focus-visible:ring-[#F0B429]"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-[#64748B] hover:text-[#C8202F]"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {schedules.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(STATUS_META).map(([key, meta]) => {
            const Icon = meta.Icon;
            return (
              <div
                key={key}
                className={`rounded-lg border ${meta.border} ${meta.bg} px-3 py-2 flex items-center gap-2`}
              >
                <Icon className={`w-4 h-4 ${meta.color}`} />
                <span className={`text-sm font-medium ${meta.color}`}>
                  {summaryCounts[key] || 0}
                </span>
                <span className="text-xs text-[#64748B]">{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#64748B]">
        <div>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading schedules…
            </span>
          ) : (
            <>
              Showing{' '}
              <strong className="text-[#16233F]">{schedules.length}</strong>{' '}
              {schedules.length === 1 ? 'schedule' : 'schedules'}
              {meta.total > 0 && <> · {meta.total} total</>}
            </>
          )}
        </div>

        {viewMode === 'all' && (
          <div className="flex items-center gap-1 text-xs">
            <Users className="w-3.5 h-3.5" />
            Grouped by day & shift
          </div>
        )}
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
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
      ) : isLoading && schedules.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#16233F]" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Calendar className="w-16 h-16 text-[#94A3B8] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1F2937]">
            No Schedules Found
          </h3>
          <p className="text-[#64748B] mt-1">
            {viewMode === 'all'
              ? 'No schedules match your filters in this date range.'
              : 'No schedules match your filters on this date.'}
          </p>
          {hasActiveFilters && (
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
      ) : (
        <>
          {viewMode === 'date' ? (
            <div className="space-y-3">
              {groupSchedules(schedules).map(renderScheduleGroup)}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDate.map(({ date, items }) => (
                <div key={date}>
                  <div className="flex items-center justify-between mb-2 sticky top-0 z-10 bg-[#F5F6F8] py-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-[#16233F]" />
                      <h3 className="text-sm font-semibold text-[#16233F]">
                        {formatDisplayDate(date)}
                      </h3>
                      <span className="text-xs text-[#94A3B8]">
                        ({items.length}{' '}
                        {items.length === 1 ? 'schedule' : 'schedules'})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {groupSchedules(items).map(renderScheduleGroup)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {meta.last_page > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={meta.current_page || 1}
                totalPages={meta.last_page || 1}
                onPageChange={setPage}
                totalItems={meta.total || 0}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Schedule;