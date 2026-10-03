// web/src/pages/Attendance.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Pagination } from "../components/ui/Pagination";
import { byFields } from "../lib/sortBy";
import api from "../services/api";
import {
  Search,
  RefreshCw,
  Filter,
  X,
  Loader2,
  Clock,
  MapPin,
  Camera,
  LocateFixed,
  Calendar,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import { useAlert } from "../components/ui/AlertProvider";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const attendanceIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const ITEMS_PER_PAGE = 20;

const STATUS_META = {
  present: {
    label: "Present",
    color: "#1E8449",
    chip: "bg-[#E5F2EA] text-[#1E8449]",
  },
  late: {
    label: "Late",
    color: "#92600A",
    chip: "bg-[#FBF1DC] text-[#92600A]",
  },
  absent: {
    label: "Absent",
    color: "#C8202F",
    chip: "bg-[#FBE7E9] text-[#C8202F]",
  },
  on_leave: {
    label: "On Leave",
    color: "#3B5170",
    chip: "bg-[#EEF1F5] text-[#3B5170]",
  },
  half_day: {
    label: "Half Day",
    color: "#C2541F",
    chip: "bg-[#FBEAE2] text-[#C2541F]",
  },
};

const STATUS_OPTIONS = Object.keys(STATUS_META).map((k) => ({
  value: k,
  label: STATUS_META[k].label,
}));

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7d", days: 6 },
  { label: "Last 30d", days: 29 },
  { label: "Last 90d", days: 89 },
];

const ROW_CLASS =
  "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 " +
  "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,14rem)] md:gap-4";

const toISODate = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
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
  if (response.current_page !== undefined) {
    return {
      current_page: response.current_page,
      last_page: response.last_page,
      total: response.total,
      per_page: response.per_page,
    };
  }
  if (response.data && response.data.current_page !== undefined) {
    return {
      current_page: response.data.current_page,
      last_page: response.data.last_page,
      total: response.data.total,
      per_page: response.data.per_page,
    };
  }
  if (response.meta) return response.meta;
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

const FieldLabel = ({ icon: I, children }) => (
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
    {[["list", "List", ListIcon], ["cards", "Cards", LayoutGrid]].map(
      ([v, label, I]) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          aria-pressed={view === v}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${view === v
            ? "bg-[#16233F] text-white"
            : "text-[#64748B] hover:text-[#16233F]"
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

const formatLocationDisplay = (locationStr) => {
  if (!locationStr || locationStr === "N/A") return "—";
  if (locationStr.includes(",")) {
    const [lat, lng] = locationStr.split(",").map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }
  return locationStr;
};

const parseCoordinates = (locationStr) => {
  if (!locationStr || !locationStr.includes(",")) return null;
  const [lat, lng] = locationStr.split(",").map(Number);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
};

const formatDateTime = (datetime) => {
  if (!datetime) return "—";
  return new Date(datetime).toLocaleString();
};

const formatTime = (datetime) => {
  if (!datetime) return "—";
  return new Date(datetime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Attendance = () => {
  const notify = useAlert();
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    status: [],
    only_with_location: false,
    only_with_photo: false,
  });

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  // Photo dialog state
  const [photoModal, setPhotoModal] = useState({
    open: false,
    attendance: null,
    type: null,
    url: "",
    loading: false,
  });

  // Map dialog state
  const [mapModal, setMapModal] = useState({
    open: false,
    location: null,
    attendance: null,
    type: null,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const {
    data: attendanceResponse,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["attendance", page, filters],
    queryFn: () => {
      const params = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.status.length === 1) params.status = filters.status[0];
      return api.get("/attendance", {
        params: { ...params, page, per_page: ITEMS_PER_PAGE },
      });
    },
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  const attendances = getDataArray(attendanceResponse);
  const meta = getMeta(attendanceResponse);

  const handleViewPhoto = (attendance, type) => {
    const photoPath =
      type === "in" ? attendance.time_in_photo : attendance.time_out_photo;

    if (!photoPath) {
      notify.warning("No photo available for this attendance record.");
      return;
    }

    const fullUrl = `${API_BASE_URL}/api/attendance/photo/${photoPath}`;
    setPhotoModal({
      open: true,
      attendance,
      type,
      url: fullUrl,
      loading: true,
    });

    const img = new Image();
    img.onload = () => setPhotoModal((s) => ({ ...s, loading: false }));
    img.onerror = () => {
      setPhotoModal((s) => ({ ...s, loading: false, url: "" }));
      notify.error("Photo not found on server.");
    };
    img.src = fullUrl;
  };

  const handleViewOnMap = (attendance, type) => {
    const locationStr =
      type === "in"
        ? attendance.time_in_location
        : attendance.time_out_location;
    const coords = parseCoordinates(locationStr);

    if (!coords) {
      notify.warning("No valid coordinates found for this attendance record.");
      return;
    }

    setMapModal({
      open: true,
      location: coords,
      attendance,
      type,
    });
  };

  const clearFilters = () =>
    setFilters({
      date_from: "",
      date_to: "",
      status: [],
      only_with_location: false,
      only_with_photo: false,
    });

  const toggleStatus = (value) =>
    setFilters((f) => ({
      ...f,
      status: f.status.includes(value)
        ? f.status.filter((s) => s !== value)
        : [...f.status, value],
    }));

  const applyPreset = (days) =>
    setFilters((f) => ({
      ...f,
      date_from: daysAgoISO(days),
      date_to: daysAgoISO(0),
    }));

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchTerm) c++;
    if (filters.date_from || filters.date_to) c++;
    if (filters.status.length) c++;
    if (filters.only_with_location) c++;
    if (filters.only_with_photo) c++;
    return c;
  }, [searchTerm, filters]);

  const filteredAttendances = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    let list = attendances;

    if (filters.status.length > 1) {
      list = list.filter((a) => filters.status.includes(a.status));
    }
    if (filters.only_with_location) {
      list = list.filter((a) => a.time_in_location || a.time_out_location);
    }
    if (filters.only_with_photo) {
      list = list.filter((a) => a.time_in_photo || a.time_out_photo);
    }

    const matching = term
      ? list.filter((a) => {
        const haystack = [
          a.enforcer?.firstname,
          a.enforcer?.lastname,
          a.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      : list;

    return [...matching].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return byFields("lastname", "firstname")(
        a.enforcer || {},
        b.enforcer || {},
      );
    });
  }, [attendances, debouncedSearch, filters]);

  const statusBadge = (status) => {
    const meta = STATUS_META[status] || STATUS_META.present;
    return (
      <span
        className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.chip}`}
      >
        {meta.label.toUpperCase()}
      </span>
    );
  };

  const rowActions = (a) => (
    <div className="flex flex-wrap gap-2">
      {a.time_in_photo && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewPhoto(a, "in")}
          className="border-[#16233F]/25 bg-white text-[#16233F] hover:bg-[#E9ECF2] text-xs gap-1.5"
        >
          <Camera className="w-3.5 h-3.5" />
          In Photo
        </Button>
      )}
      {a.time_out_photo && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewPhoto(a, "out")}
          className="border-[#16233F]/25 bg-white text-[#16233F] hover:bg-[#E9ECF2] text-xs gap-1.5"
        >
          <Camera className="w-3.5 h-3.5" />
          Out Photo
        </Button>
      )}
      {a.time_in_location && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewOnMap(a, "in")}
          className="border-[#1E8449]/30 bg-white text-[#1E8449] hover:bg-[#E5F2EA] text-xs gap-1.5"
          title="View Time In location on map"
        >
          <LocateFixed className="w-3.5 h-3.5" />
          Map
        </Button>
      )}
      {!a.time_in_photo && !a.time_out_photo && !a.time_in_location && (
        <span className="text-xs text-[#94A3B8]">No data</span>
      )}
    </div>
  );

  const panel = (
    <FilterShell
      title="Filter Attendance"
      onClose={() => setShowFilters(false)}
      onReset={clearFilters}
    >
      <div>
        <FieldLabel icon={Calendar}>Date range</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) =>
              setFilters({ ...filters, date_from: e.target.value })
            }
            className="w-36 focus-visible:ring-[#F0B429]"
          />
          <span className="text-[#64748B] text-sm">to</span>
          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) =>
              setFilters({ ...filters, date_to: e.target.value })
            }
            className="w-36 focus-visible:ring-[#F0B429]"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-xs text-[#92600A]/70 mr-1">Quick:</span>
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
        <FieldLabel>Status</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const active = filters.status.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatus(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${active
                  ? "bg-[#16233F] text-white border-[#16233F]"
                  : "bg-white text-[#64748B] border-[#E9ECF2] hover:bg-[#F5F6F8]"
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Extra</FieldLabel>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-[#92600A] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.only_with_location}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  only_with_location: e.target.checked,
                })
              }
              className="w-4 h-4 accent-[#92600A]"
            />
            Only with GPS location
          </label>
          <label className="flex items-center gap-2 text-sm text-[#92600A] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.only_with_photo}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  only_with_photo: e.target.checked,
                })
              }
              className="w-4 h-4 accent-[#92600A]"
            />
            Only with photo
          </label>
        </div>
      </div>
    </FilterShell>
  );

  const chips = [
    searchTerm && [`Search: ${searchTerm}`, () => setSearchTerm("")],
    (filters.date_from || filters.date_to) && [
      `Date: ${filters.date_from || "…"} → ${filters.date_to || "…"}`,
      () => setFilters({ ...filters, date_from: "", date_to: "" }),
    ],
    filters.status.length > 0 && [
      `Status: ${filters.status.join(", ")}`,
      () => setFilters({ ...filters, status: [] }),
    ],
    filters.only_with_location && [
      "Only with location",
      () => setFilters({ ...filters, only_with_location: false }),
    ],
    filters.only_with_photo && [
      "Only with photo",
      () => setFilters({ ...filters, only_with_photo: false }),
    ],
  ].filter(Boolean);

  if (isLoading && !attendanceResponse) {
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
          Error loading attendance: {error.message}
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
      {/* Navy banner */}
      <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)",
          }}
        />
        <div className="relative">
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">
            Attendance Monitoring
          </h1>
          <p className="text-[#C7CEDB] text-sm mt-1">
            Track and manage enforcer attendance records
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="relative bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </header>

      <div
        className={`grid gap-6 ${showFilters ? "lg:grid-cols-[300px_minmax(0,1fr)]" : ""
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
                placeholder="Search by enforcer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
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
                <Chip key={label} label={label} onClear={clear} />
              ))}
            </div>
          )}

          {/* Section title */}
          <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
            <Clock className="w-5 h-5 text-[#F0B429]" />
            Attendance Records
            <span className="text-xs font-normal text-[#64748B] font-['Inter']">
              (most recent first)
            </span>
          </h2>

          {/* Body */}
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
            </div>
          ) : filteredAttendances.length === 0 ? (
            <div className="text-center py-14 text-[#64748B]">
              {activeFilterCount > 0
                ? "No attendance records match the current filters."
                : "No attendance records found."}
            </div>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAttendances.map((a) => {
                const statusMeta =
                  STATUS_META[a.status] || STATUS_META.present;
                return (
                  <article
                    key={a.attendance_id}
                    className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div
                      className="h-2"
                      style={{ background: statusMeta.color }}
                    />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-[#16233F]">
                          {new Date(a.date).toLocaleDateString()}
                        </span>
                        {statusBadge(a.status)}
                      </div>
                      <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                        {a.enforcer?.firstname} {a.enforcer?.lastname}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                        <div className="min-w-0">
                          <dt className="text-[10px] text-[#94A3B8]">
                            Time in
                          </dt>
                          <dd className="text-sm text-[#1F2937]">
                            {formatTime(a.time_in)}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[10px] text-[#94A3B8]">
                            Time out
                          </dt>
                          <dd className="text-sm text-[#1F2937]">
                            {a.time_out ? formatTime(a.time_out) : "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[10px] text-[#94A3B8]">Late</dt>
                          <dd className="text-sm text-[#1F2937]">
                            {a.late_minutes > 0
                              ? `${a.late_minutes} min`
                              : "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[10px] text-[#94A3B8]">
                            Overtime
                          </dt>
                          <dd className="text-sm text-[#1F2937]">
                            {a.overtime_minutes > 0
                              ? `${a.overtime_minutes} min`
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      {(a.time_in_location || a.time_out_location) && (
                        <div className="mt-3 text-xs text-[#64748B] flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="truncate">
                            {formatLocationDisplay(
                              a.time_in_location || a.time_out_location,
                            )}
                          </span>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">
                        {rowActions(a)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
              <div
                className={`hidden ${ROW_CLASS} bg-[#16233F] text-white text-xs font-semibold`}
              >
                {[
                  "Date",
                  "Enforcer",
                  "Time In",
                  "Time Out",
                  "Status",
                  "Late",
                  "Overtime",
                  "Actions",
                ].map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <ul className="divide-y divide-[#EEF0F4]">
                {filteredAttendances.map((a) => {
                  const statusMeta =
                    STATUS_META[a.status] || STATUS_META.present;
                  return (
                    <li
                      key={a.attendance_id}
                      className={`${ROW_CLASS} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                      style={{ borderLeftColor: statusMeta.color }}
                    >
                      <span className="text-sm font-medium text-[#16233F] whitespace-nowrap">
                        <Mini>Date</Mini>
                        {new Date(a.date).toLocaleDateString()}
                      </span>

                      <div className="min-w-0 flex items-center gap-2">
                        <div className="w-9 h-9 shrink-0 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">
                          {a.enforcer?.firstname?.[0]}
                          {a.enforcer?.lastname?.[0]}
                        </div>
                        <span className="text-sm text-[#1F2937] truncate">
                          {a.enforcer?.firstname} {a.enforcer?.lastname}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm text-[#1F2937]">
                          <Mini>In</Mini>
                          {formatTime(a.time_in)}
                        </div>
                        {a.time_in_location && (
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {formatLocationDisplay(a.time_in_location)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm text-[#1F2937]">
                          <Mini>Out</Mini>
                          {a.time_out ? formatTime(a.time_out) : "—"}
                        </div>
                        {a.time_out_location && (
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {formatLocationDisplay(a.time_out_location)}
                            </span>
                          </div>
                        )}
                      </div>

                      <span className="justify-self-start">
                        {statusBadge(a.status)}
                      </span>

                      <span className="text-sm text-[#1F2937] whitespace-nowrap">
                        <Mini>Late</Mini>
                        {a.late_minutes > 0 ? `${a.late_minutes} min` : "—"}
                      </span>

                      <span className="text-sm text-[#1F2937] whitespace-nowrap">
                        <Mini>OT</Mini>
                        {a.overtime_minutes > 0
                          ? `${a.overtime_minutes} min`
                          : "—"}
                      </span>

                      <div className="justify-self-end md:justify-self-start">
                        {rowActions(a)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!isLoading && filteredAttendances.length > 0 && (
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

      {/* ---------------- Photo Modal ---------------- */}
      <Dialog
        open={photoModal.open}
        onOpenChange={(o) => setPhotoModal((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-['Oswald'] text-[#16233F]">
              {photoModal.type === "in" ? "Time In Photo" : "Time Out Photo"}
            </DialogTitle>
          </DialogHeader>
          {photoModal.attendance && photoModal.url && (
            <div className="flex flex-col items-center">
              {photoModal.loading ? (
                <div className="flex justify-center items-center h-96">
                  <Loader2 className="w-12 h-12 animate-spin text-[#16233F]" />
                </div>
              ) : (
                <>
                  <img
                    src={photoModal.url}
                    alt={`Time ${photoModal.type} photo`}
                    className="w-full max-h-96 object-contain rounded-lg shadow-lg mb-4"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <div className="w-full bg-[#F8F9FA] p-4 rounded-lg">
                    <p className="text-sm text-[#1F2937]">
                      <strong className="text-[#16233F]">Time:</strong>{" "}
                      {formatDateTime(
                        photoModal.type === "in"
                          ? photoModal.attendance.time_in
                          : photoModal.attendance.time_out,
                      )}
                    </p>
                    <p className="text-sm text-[#1F2937] mt-1">
                      <strong className="text-[#16233F]">Enforcer:</strong>{" "}
                      {photoModal.attendance.enforcer?.firstname}{" "}
                      {photoModal.attendance.enforcer?.lastname}
                    </p>
                    <p className="text-sm text-[#1F2937]">
                      <strong className="text-[#16233F]">Date:</strong>{" "}
                      {new Date(
                        photoModal.attendance.date,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- Map Modal ---------------- */}
      <Dialog
        open={mapModal.open}
        onOpenChange={(o) => setMapModal((s) => ({ ...s, open: o }))}
      >
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-['Oswald'] text-[#16233F]">
              {mapModal.type === "in"
                ? "Time In Location"
                : "Time Out Location"}
            </DialogTitle>
          </DialogHeader>
          {mapModal.location && mapModal.attendance && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F8F9FA] p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <strong className="text-[#16233F]">Enforcer:</strong>{" "}
                    {mapModal.attendance.enforcer?.firstname}{" "}
                    {mapModal.attendance.enforcer?.lastname}
                  </p>
                  <p className="text-sm">
                    <strong className="text-[#16233F]">Date:</strong>{" "}
                    {new Date(mapModal.attendance.date).toLocaleDateString()}
                  </p>
                  <p className="text-sm">
                    <strong className="text-[#16233F]">Time:</strong>{" "}
                    {formatDateTime(
                      mapModal.type === "in"
                        ? mapModal.attendance.time_in
                        : mapModal.attendance.time_out,
                    )}
                  </p>
                  <p className="text-sm">
                    <strong className="text-[#16233F]">
                      Coordinates:
                    </strong>{" "}
                    {mapModal.location.lat.toFixed(6)},{" "}
                    {mapModal.location.lng.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${mapModal.location.lat},${mapModal.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#16233F] hover:underline"
                  >
                    <LocateFixed className="w-4 h-4" />
                    Open in Google Maps
                  </a>
                </div>
                <div className="bg-[#F8F9FA] p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-[#16233F]">
                    Location Details
                  </p>
                  <p className="text-sm text-[#64748B]">
                    {formatLocationDisplay(
                      mapModal.type === "in"
                        ? mapModal.attendance.time_in_location
                        : mapModal.attendance.time_out_location,
                    )}
                  </p>
                </div>
              </div>

              <div className="h-[400px] w-full rounded-lg overflow-hidden border border-[#E9ECF2]">
                <MapContainer
                  key={`map-${mapModal.location.lat}-${mapModal.location.lng}`}
                  center={[mapModal.location.lat, mapModal.location.lng]}
                  zoom={16}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                  scrollWheelZoom={false}
                  dragging={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                  <ZoomControl position="topright" />
                  <Marker
                    position={[
                      mapModal.location.lat,
                      mapModal.location.lng,
                    ]}
                    icon={attendanceIcon}
                  >
                    <Popup>
                      <div className="p-2 min-w-[180px]">
                        <p className="font-bold text-[#16233F]">
                          {mapModal.type === "in" ? "Time In" : "Time Out"}
                        </p>
                        <p className="text-sm text-[#64748B]">
                          {mapModal.attendance.enforcer?.firstname}{" "}
                          {mapModal.attendance.enforcer?.lastname}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {new Date(
                            mapModal.type === "in"
                              ? mapModal.attendance.time_in
                              : mapModal.attendance.time_out,
                          ).toLocaleString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Attendance;