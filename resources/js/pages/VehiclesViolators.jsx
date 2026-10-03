import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Pagination } from "../components/ui/Pagination";
import ActionButton from "../components/ui/ActionButton";
import { byFields } from "../lib/sortBy";
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getViolators,
  createViolator,
  updateViolator,
  deleteViolator,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Pencil,
  Archive,
  Search,
  Car,
  Users,
  RefreshCw,
  Loader2,
  X,
  Filter,
  Calendar,
  Palette,
  Tag,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { useAlert } from "../components/ui/AlertProvider";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const ITEMS_PER_PAGE = 10;

const GENDER_OPTIONS = [
  { value: "", label: "All Genders" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

const PRESETS = [
  { label: "Last 7d", days: 6 },
  { label: "Last 30d", days: 29 },
  { label: "Last 90d", days: 89 },
];

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

const toISODate = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
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

const isExpiringSoon = (expiry) => {
  if (!expiry) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 90);
  return new Date(expiry) <= cutoff;
};

const VIOLATOR_ROW =
  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
  'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,14rem)] md:gap-4';

const VEHICLE_ROW =
  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
  'md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,14rem)] md:gap-4';

const ViewToggle = ({ view, setView }) => (
  <div className="ml-auto flex bg-[#E9ECF2] rounded-full p-1 text-xs" role="group" aria-label="Choose layout">
    {[["list", "List", ListIcon], ["cards", "Cards", LayoutGrid]].map(([v, label, I]) => (
      <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${view === v ? "bg-[#16233F] text-white" : "text-[#64748B] hover:text-[#16233F]"}`}>
        <I className="w-3.5 h-3.5" />{label}
      </button>
    ))}
  </div>
);

const L = ({ icon: I, children }) => (
  <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
    {I && <I className="w-3.5 h-3.5 text-[#92600A]" />}
    {children}
  </label>
);

const DateRange = ({ from, to, onFrom, onTo, children }) => (
  <div className="flex flex-wrap items-center gap-2">
    <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="w-36 focus-visible:ring-[#F0B429]" />
    <span className="text-[#64748B] text-sm">to</span>
    <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="w-36 focus-visible:ring-[#F0B429]" />
    {children}
  </div>
);

const Quick = ({ apply }) => (
  <div className="flex items-center gap-1.5 flex-wrap mt-2">
    <span className="text-xs text-[#92600A]/70 mr-1">Quick:</span>
    {PRESETS.map((p) => (
      <button key={p.label} type="button" onClick={() => apply(p.days)}
        className="text-xs px-2.5 py-1 rounded-full bg-white text-[#16233F] hover:bg-[#16233F] hover:text-white transition-colors font-medium">
        {p.label}
      </button>
    ))}
  </div>
);

/* Filters live in a side drawer that pushes the list over */
const FilterShell = ({ title, onClose, onReset, children }) => (
  <aside className="self-start rounded-xl bg-[#FBF1DC] border-t-4 border-[#F0B429] p-5 space-y-5 lg:sticky lg:top-4">
    <div className="flex justify-between items-center">
      <h3 className="text-base font-['Oswald'] font-medium text-[#16233F]">{title}</h3>
      <button onClick={onClose} className="p-1 rounded hover:bg-[#F0B429]/25"><X className="w-4 h-4 text-[#92600A]" /></button>
    </div>
    {children}
    <div className="flex gap-2 pt-3 border-t border-[#F0B429]/30">
      <Button onClick={onClose} className="bg-[#1E8449] hover:bg-[#186B3B]">Apply Filters</Button>
      <Button onClick={onReset} variant="ghost" className="text-[#64748B] hover:text-[#C8202F]"><X className="w-4 h-4 mr-1" />Reset</Button>
    </div>
  </aside>
);

/* One section layout shared by both tabs */
const Section = ({ title, hint, icon: Icon, accent, placeholder, search, setSearch, showFilters, setShowFilters, count, panel, chips, loading, items, noneText, renderItem, renderRow, columns, rowClass, view, setView, meta, setPage }) => (
  <div className={`grid gap-6 ${showFilters ? "lg:grid-cols-[300px_minmax(0,1fr)]" : ""}`}>
    {showFilters && panel}
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setShowFilters((v) => !v)} className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]">
          <Filter className="w-4 h-4 mr-2" />Filters
          {count > 0 && <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">{count}</span>}
        </Button>
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]" />
          {search && (
            <button onClick={() => setSearch("")} title="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"><X className="w-4 h-4" /></button>
          )}
        </div>
        <ViewToggle view={view} setView={setView} />
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">{chips.map(([label, clear]) => <Chip key={label} label={label} onClear={clear} />)}</div>
      )}
      <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
        <Icon className="w-5 h-5" style={{ color: accent }} />{title}
        <span className="text-xs font-normal text-[#64748B] font-['Inter']">{hint}</span>
      </h2>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#16233F]" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-[#64748B]">{noneText}</div>
      ) : (
        <>
          {view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{items.map(renderItem)}</div>
          ) : (
            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
              <div className={`hidden ${rowClass} bg-[#16233F] text-white text-xs font-semibold`}>
                {columns.map((c) => <span key={c}>{c}</span>)}
              </div>
              <ul className="divide-y divide-[#EEF0F4]">{items.map(renderRow)}</ul>
            </div>
          )}
          <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={setPage} totalItems={meta.total} itemsPerPage={ITEMS_PER_PAGE} />
        </>
      )}
    </div>
  </div>
);

const Spec = ({ label, children, mono, danger }) => (
  <div className="min-w-0">
    <dt className="text-[10px] text-[#94A3B8]">{label}</dt>
    <dd className={`text-sm truncate ${mono ? "font-mono text-[#16233F]" : "text-[#1F2937]"} ${danger ? "text-[#C8202F] font-medium" : ""}`}>{children}</dd>
  </div>
);

const VehiclesViolators = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();
  const { isAdmin } = useAuth();
  const [view, setView] = useState("list"); // "list" | "cards"

  /* ---------------- Violators state ---------------- */
  const [violatorPage, setViolatorPage] = useState(1);
  const [violatorSearchTerm, setViolatorSearchTerm] = useState("");
  const [isViolatorDialogOpen, setIsViolatorDialogOpen] = useState(false);
  const [editingViolator, setEditingViolator] = useState(null);
  const [violatorFormData, setViolatorFormData] = useState({
    firstname: "",
    middlename: "",
    lastname: "",
    license: "",
    expiry: "",
    birthday: "",
    gender: "Male",
    nationality: "Filipino",
    profile_photo: null,
  });
  const [violatorPhotoPreview, setViolatorPhotoPreview] = useState(null);

  // Violator filters
  const [violatorShowFilters, setViolatorShowFilters] = useState(false);
  const [violatorFilters, setViolatorFilters] = useState({
    gender: "",
    nationality: "",
    expiry_from: "",
    expiry_to: "",
    created_from: "",
    created_to: "",
    license_expiring: false, // only show expiring within 90 days
  });

  /* ---------------- Vehicles state ---------------- */
  const [vehiclePage, setVehiclePage] = useState(1);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState("");
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    platenumber: "",
    owner: "",
    make: "",
    model: "",
    color: "",
  });

  // Vehicle filters
  const [vehicleShowFilters, setVehicleShowFilters] = useState(false);
  const [vehicleFilters, setVehicleFilters] = useState({
    make: "",
    color: "",
    registration_from: "",
    registration_to: "",
    created_from: "",
    created_to: "",
  });

  const debouncedViolatorSearch = useDebouncedValue(violatorSearchTerm, 350);
  const debouncedVehicleSearch = useDebouncedValue(vehicleSearchTerm, 350);

  useEffect(() => {
    setViolatorPage(1);
  }, [debouncedViolatorSearch, violatorFilters]);

  useEffect(() => {
    setVehiclePage(1);
  }, [debouncedVehicleSearch, vehicleFilters]);

  /* ---------------- Queries ---------------- */
  const {
    data: violatorsResponse,
    isLoading: violatorsLoading,
    refetch: refetchViolators,
    error: violatorsError,
  } = useQuery({
    queryKey: ["violators", violatorPage, debouncedViolatorSearch, violatorFilters],
    queryFn: () =>
      getViolators(violatorPage, ITEMS_PER_PAGE, {
        search: debouncedViolatorSearch || undefined,
        gender: violatorFilters.gender || undefined,
        nationality: violatorFilters.nationality || undefined,
        expiry_from: violatorFilters.expiry_from || undefined,
        expiry_to: violatorFilters.expiry_to || undefined,
        created_from: violatorFilters.created_from || undefined,
        created_to: violatorFilters.created_to || undefined,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: vehiclesResponse,
    isLoading: vehiclesLoading,
    refetch: refetchVehicles,
    error: vehiclesError,
  } = useQuery({
    queryKey: ["vehicles", vehiclePage, debouncedVehicleSearch, vehicleFilters],
    queryFn: () =>
      getVehicles(vehiclePage, ITEMS_PER_PAGE, {
        search: debouncedVehicleSearch || undefined,
        make: vehicleFilters.make || undefined,
        color: vehicleFilters.color || undefined,
        registration_from: vehicleFilters.registration_from || undefined,
        registration_to: vehicleFilters.registration_to || undefined,
        created_from: vehicleFilters.created_from || undefined,
        created_to: vehicleFilters.created_to || undefined,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  /* ---------------- Mutations ---------------- */
  const createViolatorMutation = useMutation({
    mutationFn: createViolator,
    onSuccess: () => {
      queryClient.invalidateQueries(["violators"]);
      setIsViolatorDialogOpen(false);
      resetViolatorForm();
      notify.success("Violator created successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error creating violator");
    },
  });

  const updateViolatorMutation = useMutation({
    mutationFn: ({ id, data }) => updateViolator(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["violators"]);
      setIsViolatorDialogOpen(false);
      resetViolatorForm();
      notify.success("Violator updated successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error updating violator");
    },
  });

  const archiveViolatorMutation = useMutation({
    mutationFn: deleteViolator,
    onSuccess: () => {
      queryClient.invalidateQueries(["violators"]);
      queryClient.invalidateQueries(["archives"]);
      notify.success("Violator archived successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error archiving violator");
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      setIsVehicleDialogOpen(false);
      resetVehicleForm();
      notify.success("Vehicle created successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error creating vehicle");
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }) => updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      setIsVehicleDialogOpen(false);
      resetVehicleForm();
      notify.success("Vehicle updated successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error updating vehicle");
    },
  });

  const archiveVehicleMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      queryClient.invalidateQueries(["archives"]);
      notify.success("Vehicle archived successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error archiving vehicle");
    },
  });

  /* ---------------- Helpers ---------------- */
  const getImageUrl = (profilePhoto) => {
    if (!profilePhoto) return null;
    if (profilePhoto.startsWith("http")) return profilePhoto;
    return `${API_BASE_URL}/storage/${profilePhoto}`;
  };

  const handleViolatorPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setViolatorFormData({ ...violatorFormData, profile_photo: file });
      const reader = new FileReader();
      reader.onload = (event) => setViolatorPhotoPreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleViolatorSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(violatorFormData).forEach((key) => {
      const value = violatorFormData[key];
      if (key === "profile_photo") {
        if (value instanceof File) formData.append(key, value);
      } else if (value !== null && value !== undefined && value !== "") {
        formData.append(key, String(value));
      }
    });

    if (editingViolator) {
      updateViolatorMutation.mutate({
        id: editingViolator.violator_id,
        data: formData,
      });
    } else {
      createViolatorMutation.mutate(formData);
    }
  };

  const handleArchiveViolator = async (id) => {
    const ok = await notify.confirm(
      "Archive this violator? You can restore it later from the Archives page.",
      { destructive: true, confirmText: "Archive" },
    );
    if (ok) archiveViolatorMutation.mutate(id);
  };

  const handleEditViolator = (violator) => {
    setEditingViolator(violator);
    setViolatorFormData({
      firstname: violator.firstname || "",
      middlename: violator.middlename || "",
      lastname: violator.lastname || "",
      license: violator.license || "",
      expiry: violator.expiry ? String(violator.expiry).slice(0, 10) : "",
      birthday: violator.birthday ? String(violator.birthday).slice(0, 10) : "",
      gender: violator.gender || "Male",
      nationality: violator.nationality || "Filipino",
      profile_photo: null,
    });
    setViolatorPhotoPreview(getImageUrl(violator.profile_photo));
    setIsViolatorDialogOpen(true);
  };

  const resetViolatorForm = () => {
    setEditingViolator(null);
    setViolatorFormData({
      firstname: "",
      middlename: "",
      lastname: "",
      license: "",
      expiry: "",
      birthday: "",
      gender: "Male",
      nationality: "Filipino",
      profile_photo: null,
    });
    setViolatorPhotoPreview(null);
  };

  const handleVehicleSubmit = (e) => {
    e.preventDefault();
    if (editingVehicle) {
      updateVehicleMutation.mutate({
        id: editingVehicle.vehicle_id,
        data: vehicleFormData,
      });
    } else {
      createVehicleMutation.mutate(vehicleFormData);
    }
  };

  const handleArchiveVehicle = async (id) => {
    const ok = await notify.confirm(
      "Archive this vehicle? You can restore it later from the Archives page.",
      { destructive: true, confirmText: "Archive" },
    );
    if (ok) archiveVehicleMutation.mutate(id);
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleFormData({
      platenumber: vehicle.platenumber || "",
      owner: vehicle.owner || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      color: vehicle.color || "",
    });
    setIsVehicleDialogOpen(true);
  };

  const resetVehicleForm = () => {
    setEditingVehicle(null);
    setVehicleFormData({
      platenumber: "",
      owner: "",
      make: "",
      model: "",
      color: "",
    });
  };

  const clearViolatorFilters = () =>
    setViolatorFilters({
      gender: "",
      nationality: "",
      expiry_from: "",
      expiry_to: "",
      created_from: "",
      created_to: "",
      license_expiring: false,
    });

  const clearVehicleFilters = () =>
    setVehicleFilters({
      make: "",
      color: "",
      registration_from: "",
      registration_to: "",
      created_from: "",
      created_to: "",
    });

  const applyViolatorPreset = (days) => {
    setViolatorFilters((prev) => ({
      ...prev,
      created_from: daysAgoISO(days),
      created_to: daysAgoISO(0),
    }));
  };

  const applyVehiclePreset = (days) => {
    setVehicleFilters((prev) => ({
      ...prev,
      created_from: daysAgoISO(days),
      created_to: daysAgoISO(0),
    }));
  };

  const violatorActiveFilterCount = useMemo(() => {
    let c = 0;
    Object.values(violatorFilters).forEach((v) => {
      if (v) c++;
    });
    if (violatorSearchTerm) c++;
    return c;
  }, [violatorFilters, violatorSearchTerm]);

  const vehicleActiveFilterCount = useMemo(() => {
    let c = 0;
    Object.values(vehicleFilters).forEach((v) => {
      if (v) c++;
    });
    if (vehicleSearchTerm) c++;
    return c;
  }, [vehicleFilters, vehicleSearchTerm]);

  /* ---------------- Derived ---------------- */
  const violatorsMeta = getMeta(violatorsResponse);
  const vehiclesMeta = getMeta(vehiclesResponse);
  const violators = getDataArray(violatorsResponse);
  const vehicles = getDataArray(vehiclesResponse);
  const isLoading = violatorsLoading || vehiclesLoading;

  /* ---------------- Filter + Sort (client-side refinement) ---------------- */

  const filteredViolators = useMemo(() => {
    const term = debouncedViolatorSearch.trim().toLowerCase();

    let list = violators;

    // Client-side license-expiring refinement (server sends all matching rows)
    if (violatorFilters.license_expiring) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 90);
      list = list.filter((v) => {
        if (!v.expiry) return false;
        const exp = new Date(v.expiry);
        return exp <= cutoff;
      });
    }

    const matching = term
      ? list.filter((v) => {
        const haystack = [
          v.firstname,
          v.middlename,
          v.lastname,
          v.license,
          v.nationality,
          v.gender,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      : list;

    return [...matching].sort(byFields("lastname", "firstname"));
  }, [violators, debouncedViolatorSearch, violatorFilters.license_expiring]);

  const filteredVehicles = useMemo(() => {
    const term = debouncedVehicleSearch.trim().toLowerCase();

    const matching = term
      ? vehicles.filter((v) => {
        const haystack = [v.platenumber, v.owner, v.make, v.model, v.color]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      : vehicles;

    return [...matching].sort(byFields("platenumber"));
  }, [vehicles, debouncedVehicleSearch]);

  /* ---------------- Early returns ---------------- */
  if (violatorsError || vehiclesError) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-[#C8202F] mb-4">
          Error loading data:{" "}
          {violatorsError?.message || vehiclesError?.message}
        </p>
        <Button
          onClick={() => {
            refetchViolators();
            refetchVehicles();
          }}
          variant="outline"
          className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading && !violatorsResponse && !vehiclesResponse) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#16233F]" />
      </div>
    );
  }

  const setVF = (patch) => setViolatorFilters((p) => ({ ...p, ...patch }));
  const setVhF = (patch) => setVehicleFilters((p) => ({ ...p, ...patch }));
  const range = (a, b) => `${a || "…"} → ${b || "…"}`;

  const vChips = [
    violatorSearchTerm && [`Search: ${violatorSearchTerm}`, () => setViolatorSearchTerm("")],
    violatorFilters.gender && [`Gender: ${violatorFilters.gender}`, () => setVF({ gender: "" })],
    violatorFilters.nationality && [`Nationality: ${violatorFilters.nationality}`, () => setVF({ nationality: "" })],
    (violatorFilters.expiry_from || violatorFilters.expiry_to) && [`Expiry: ${range(violatorFilters.expiry_from, violatorFilters.expiry_to)}`, () => setVF({ expiry_from: "", expiry_to: "" })],
    violatorFilters.license_expiring && ["Expiring within 90 days", () => setVF({ license_expiring: false })],
    (violatorFilters.created_from || violatorFilters.created_to) && [`Added: ${range(violatorFilters.created_from, violatorFilters.created_to)}`, () => setVF({ created_from: "", created_to: "" })],
  ].filter(Boolean);

  const vhChips = [
    vehicleSearchTerm && [`Search: ${vehicleSearchTerm}`, () => setVehicleSearchTerm("")],
    vehicleFilters.make && [`Make: ${vehicleFilters.make}`, () => setVhF({ make: "" })],
    vehicleFilters.color && [`Color: ${vehicleFilters.color}`, () => setVhF({ color: "" })],
    (vehicleFilters.registration_from || vehicleFilters.registration_to) && [`Reg. expiry: ${range(vehicleFilters.registration_from, vehicleFilters.registration_to)}`, () => setVhF({ registration_from: "", registration_to: "" })],
    (vehicleFilters.created_from || vehicleFilters.created_to) && [`Added: ${range(vehicleFilters.created_from, vehicleFilters.created_to)}`, () => setVhF({ created_from: "", created_to: "" })],
  ].filter(Boolean);

  const violatorPanel = (
    <FilterShell title="Filter Violators" onClose={() => setViolatorShowFilters(false)} onReset={clearViolatorFilters}>
      <div>
        <L>Gender</L>
        <select className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={violatorFilters.gender} onChange={(e) => setVF({ gender: e.target.value })}>
          {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <L>Nationality</L>
        <Input placeholder="e.g., Filipino" value={violatorFilters.nationality} onChange={(e) => setVF({ nationality: e.target.value })} className="focus-visible:ring-[#F0B429]" />
      </div>
      <div>
        <L icon={Calendar}>License expiry range</L>
        <DateRange from={violatorFilters.expiry_from} to={violatorFilters.expiry_to} onFrom={(v) => setVF({ expiry_from: v })} onTo={(v) => setVF({ expiry_to: v })} />
        <label className="flex items-center gap-2 text-sm text-[#92600A] cursor-pointer mt-3">
          <input type="checkbox" checked={violatorFilters.license_expiring} onChange={(e) => setVF({ license_expiring: e.target.checked })} className="w-4 h-4 accent-[#92600A]" />
          Expiring within 90 days
        </label>
      </div>
      <div>
        <L>Added to system</L>
        <DateRange from={violatorFilters.created_from} to={violatorFilters.created_to} onFrom={(v) => setVF({ created_from: v })} onTo={(v) => setVF({ created_to: v })} />
        <Quick apply={applyViolatorPreset} />
      </div>
    </FilterShell>
  );

  const vehiclePanel = (
    <FilterShell title="Filter Vehicles" onClose={() => setVehicleShowFilters(false)} onReset={clearVehicleFilters}>
      <div>
        <L icon={Tag}>Make</L>
        <Input placeholder="e.g., Toyota" value={vehicleFilters.make} onChange={(e) => setVhF({ make: e.target.value })} className="focus-visible:ring-[#F0B429]" />
      </div>
      <div>
        <L icon={Palette}>Color</L>
        <Input placeholder="e.g., White" value={vehicleFilters.color} onChange={(e) => setVhF({ color: e.target.value })} className="focus-visible:ring-[#F0B429]" />
      </div>
      <div>
        <L icon={Calendar}>Registration expiry range</L>
        <DateRange from={vehicleFilters.registration_from} to={vehicleFilters.registration_to} onFrom={(v) => setVhF({ registration_from: v })} onTo={(v) => setVhF({ registration_to: v })} />
      </div>
      <div>
        <L>Added to system</L>
        <DateRange from={vehicleFilters.created_from} to={vehicleFilters.created_to} onFrom={(v) => setVhF({ created_from: v })} onTo={(v) => setVhF({ created_to: v })} />
        <Quick apply={applyVehiclePreset} />
      </div>
    </FilterShell>
  );

  const tiles = [
    { value: "violators", label: "Violators", icon: Users, total: violatorsMeta.total || 0 },
    { value: "vehicles", label: "Vehicles", icon: Car, total: vehiclesMeta.total || 0 },
  ];

  return (
    <div className="space-y-6 font-['Inter']">
      <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)" }} />
        <div className="relative">
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">Vehicles &amp; Violators</h1>
          <p className="text-[#C7CEDB] text-sm mt-1">Manage vehicle and violator records</p>
        </div>
        <Button onClick={() => { refetchViolators(); refetchVehicles(); }} variant="outline"
          className="relative bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </header>

      <Tabs defaultValue="violators" className="space-y-6">
        <TabsList className="grid grid-cols-2 gap-3 h-auto bg-transparent p-0">
          {tiles.map((t) => (
            <TabsTrigger key={t.value} value={t.value}
              className="group justify-between gap-3 rounded-xl border border-[#E3E7EE] bg-white px-5 py-4 text-[#16233F] shadow-none transition-all hover:border-[#16233F]/40 data-[state=active]:bg-[#16233F] data-[state=active]:text-white data-[state=active]:border-[#16233F] data-[state=active]:shadow-lg">
              <span className="flex items-center gap-3 text-base font-['Oswald'] font-medium"><t.icon className="w-5 h-5" />{t.label}</span>
              <span className="text-3xl font-['Oswald'] font-semibold tabular-nums">{t.total}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="violators" className="mt-0">
          <Section title="Violators List" hint="(alphabetical by last name)" icon={Users} accent="#F0B429"
            placeholder="Search by name or license..." search={violatorSearchTerm} setSearch={setViolatorSearchTerm}
            showFilters={violatorShowFilters} setShowFilters={setViolatorShowFilters} count={violatorActiveFilterCount}
            panel={violatorPanel} chips={vChips} loading={violatorsLoading} items={filteredViolators}
            noneText={violatorActiveFilterCount > 0 ? "No violators match the current filters." : "No violators found."}
            meta={violatorsMeta} setPage={setViolatorPage}
            view={view} setView={setView} rowClass={VIOLATOR_ROW}
            columns={["Name", "License #", "Expiry", "Gender", "Nationality", "Actions"]}
            renderRow={(v) => {
              const soon = isExpiringSoon(v.expiry);
              return (
                <li key={v.violator_id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-l-4 hover:bg-[#F8F9FB] transition-colors ${VIOLATOR_ROW}`}
                  style={{ borderLeftColor: soon ? "#C8202F" : "transparent" }}>
                  <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
                    {v.profile_photo ? (
                      <img src={getImageUrl(v.profile_photo)} alt={`${v.firstname} ${v.lastname}`}
                        className="w-10 h-10 shrink-0 rounded-full object-cover border border-[#E9ECF2]"
                        onError={(e) => { e.target.src = ""; e.target.alt = "No photo"; }} />
                    ) : (
                      <div className="w-10 h-10 shrink-0 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">{v.firstname?.[0]}{v.lastname?.[0]}</div>
                    )}
                    <span className="font-medium text-[#1F2937] truncate">{v.lastname}, {v.firstname}{v.middlename ? ` ${v.middlename[0]}.` : ""}</span>
                  </div>
                  <span className="font-mono text-sm text-[#16233F]"><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">License #</i>{v.license}</span>
                  <span className={`text-sm ${soon ? "text-[#C8202F] font-medium" : "text-[#1F2937]"}`}><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">Expiry</i>{new Date(v.expiry).toLocaleDateString()}{soon && <span className="ml-1 text-[10px]">⚠</span>}</span>
                  <span className="text-sm text-[#1F2937]"><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">Gender</i>{v.gender}</span>
                  <span className="text-sm text-[#1F2937]"><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">Nationality</i>{v.nationality}</span>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton icon={Pencil} variant="primary" onClick={() => handleEditViolator(v)}>Edit</ActionButton>
                    {isAdmin() && <ActionButton icon={Archive} variant="danger" onClick={() => handleArchiveViolator(v.violator_id)}>Archive</ActionButton>}
                  </div>
                </li>
              );
            }}
            renderItem={(v) => {
              const soon = isExpiringSoon(v.expiry);
              return (
                <article key={v.violator_id} className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  <div className="h-2" style={{ background: soon ? "#C8202F" : "#F0B429" }} />
                  <div className="p-4 flex gap-4">
                    {v.profile_photo ? (
                      <img src={getImageUrl(v.profile_photo)} alt={`${v.firstname} ${v.lastname}`}
                        className="w-20 h-24 shrink-0 rounded-md object-cover border border-[#E9ECF2]"
                        onError={(e) => { e.target.src = ""; e.target.alt = "No photo"; }} />
                    ) : (
                      <div className="w-20 h-24 shrink-0 rounded-md bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xl font-['Oswald'] font-semibold">
                        {v.firstname?.[0]}{v.lastname?.[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                        {v.lastname}, {v.firstname}{v.middlename ? ` ${v.middlename[0]}.` : ""}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
                        <Spec label="License #" mono>{v.license}</Spec>
                        <Spec label="Expiry" danger={soon}>{new Date(v.expiry).toLocaleDateString()}{soon && <span className="ml-1 text-[10px]">⚠</span>}</Spec>
                        <Spec label="Gender">{v.gender}</Spec>
                        <Spec label="Nationality">{v.nationality}</Spec>
                      </dl>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 px-4 pb-4">
                    <ActionButton icon={Pencil} variant="primary" onClick={() => handleEditViolator(v)}>Edit</ActionButton>
                    {isAdmin() && <ActionButton icon={Archive} variant="danger" onClick={() => handleArchiveViolator(v.violator_id)}>Archive</ActionButton>}
                  </div>
                </article>
              );
            }} />
        </TabsContent>

        <TabsContent value="vehicles" className="mt-0">
          <Section title="Vehicles List" hint="(alphabetical by plate)" icon={Car} accent="#1E8449"
            placeholder="Search by plate, owner, make, or color..." search={vehicleSearchTerm} setSearch={setVehicleSearchTerm}
            showFilters={vehicleShowFilters} setShowFilters={setVehicleShowFilters} count={vehicleActiveFilterCount}
            panel={vehiclePanel} chips={vhChips} loading={vehiclesLoading} items={filteredVehicles}
            noneText={vehicleActiveFilterCount > 0 ? "No vehicles match the current filters." : "No vehicles found."}
            meta={vehiclesMeta} setPage={setVehiclePage}
            view={view} setView={setView} rowClass={VEHICLE_ROW}
            columns={["Plate Number", "Owner", "Make", "Model", "Color", "Actions"]}
            renderRow={(v) => (
              <li key={v.vehicle_id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-[#F8F9FB] transition-colors ${VEHICLE_ROW}`}>
                <span className="justify-self-start rounded border-2 border-[#16233F] bg-[#FFF6D6] px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-[#16233F]">{v.platenumber}</span>
                <span className="text-sm text-[#1F2937]"><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">Owner</i>{v.owner}</span>
                <span className="text-sm text-[#1F2937]"><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">Make</i>{v.make || "-"}</span>
                <span className="text-sm text-[#1F2937]"><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">Model</i>{v.model || "-"}</span>
                <span className="text-sm text-[#1F2937]"><i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">Color</i>{v.color || "-"}</span>
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={Pencil} variant="primary" onClick={() => handleEditVehicle(v)}>Edit</ActionButton>
                  <ActionButton icon={Archive} variant="danger" onClick={() => handleArchiveVehicle(v.vehicle_id)}>Archive</ActionButton>
                </div>
              </li>
            )}
            renderItem={(v) => (
              <article key={v.vehicle_id} className="rounded-xl bg-white border border-[#E3E7EE] p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <div className="rounded-md border-2 border-[#16233F] bg-[#FFF6D6] py-2 text-center font-mono text-xl font-bold tracking-[0.25em] text-[#16233F]">{v.platenumber}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 mt-4">
                  <Spec label="Owner">{v.owner}</Spec>
                  <Spec label="Make">{v.make || "-"}</Spec>
                  <Spec label="Model">{v.model || "-"}</Spec>
                  <Spec label="Color">{v.color || "-"}</Spec>
                </dl>
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">
                  <ActionButton icon={Pencil} variant="primary" onClick={() => handleEditVehicle(v)}>Edit</ActionButton>
                  <ActionButton icon={Archive} variant="danger" onClick={() => handleArchiveVehicle(v.vehicle_id)}>Archive</ActionButton>
                </div>
              </article>
            )} />
        </TabsContent>
      </Tabs>

      {/* -------------------- VIOLATOR DIALOG -------------------- */}
      <Dialog
        open={isViolatorDialogOpen}
        onOpenChange={(open) => {
          setIsViolatorDialogOpen(open);
          if (!open) resetViolatorForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Oswald'] text-[#16233F]">
              {editingViolator ? "Edit Violator" : "Add New Violator"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleViolatorSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#1F2937]">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                {violatorPhotoPreview && (
                  <img
                    src={violatorPhotoPreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover border border-[#E9ECF2]"
                  />
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleViolatorPhotoChange}
                    className="flex-1 focus-visible:ring-[#F0B429]"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="First Name *"
                value={violatorFormData.firstname}
                onChange={(e) =>
                  setViolatorFormData({
                    ...violatorFormData,
                    firstname: e.target.value,
                  })
                }
                required
                className="focus-visible:ring-[#F0B429]"
              />
              <Input
                placeholder="Middle Name"
                value={violatorFormData.middlename}
                onChange={(e) =>
                  setViolatorFormData({
                    ...violatorFormData,
                    middlename: e.target.value,
                  })
                }
                className="focus-visible:ring-[#F0B429]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Last Name *"
                value={violatorFormData.lastname}
                onChange={(e) =>
                  setViolatorFormData({
                    ...violatorFormData,
                    lastname: e.target.value,
                  })
                }
                required
                className="focus-visible:ring-[#F0B429]"
              />
              <Input
                placeholder="License Number *"
                value={violatorFormData.license}
                onChange={(e) =>
                  setViolatorFormData({
                    ...violatorFormData,
                    license: e.target.value.toUpperCase(),
                  })
                }
                required
                className="focus-visible:ring-[#F0B429]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#1F2937]">
                  Expiry Date *
                </label>
                <Input
                  type="date"
                  value={violatorFormData.expiry}
                  onChange={(e) =>
                    setViolatorFormData({
                      ...violatorFormData,
                      expiry: e.target.value,
                    })
                  }
                  required
                  className="focus-visible:ring-[#F0B429]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1F2937]">
                  Birthday *
                </label>
                <Input
                  type="date"
                  value={violatorFormData.birthday}
                  onChange={(e) =>
                    setViolatorFormData({
                      ...violatorFormData,
                      birthday: e.target.value,
                    })
                  }
                  required
                  className="focus-visible:ring-[#F0B429]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                value={violatorFormData.gender}
                onChange={(e) =>
                  setViolatorFormData({
                    ...violatorFormData,
                    gender: e.target.value,
                  })
                }
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <Input
                placeholder="Nationality"
                value={violatorFormData.nationality}
                onChange={(e) =>
                  setViolatorFormData({
                    ...violatorFormData,
                    nationality: e.target.value,
                  })
                }
                className="focus-visible:ring-[#F0B429]"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsViolatorDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#1E8449] hover:bg-[#186B3B]"
                disabled={
                  createViolatorMutation.isPending ||
                  updateViolatorMutation.isPending
                }
              >
                {createViolatorMutation.isPending ||
                  updateViolatorMutation.isPending
                  ? "Saving..."
                  : editingViolator
                    ? "Update Violator"
                    : "Create Violator"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------------------- VEHICLE DIALOG -------------------- */}
      <Dialog
        open={isVehicleDialogOpen}
        onOpenChange={(open) => {
          setIsVehicleDialogOpen(open);
          if (!open) resetVehicleForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Oswald'] text-[#16233F]">
              {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVehicleSubmit} className="space-y-4">
            <Input
              placeholder="Plate Number *"
              value={vehicleFormData.platenumber}
              onChange={(e) =>
                setVehicleFormData({
                  ...vehicleFormData,
                  platenumber: e.target.value.toUpperCase(),
                })
              }
              required
              className="focus-visible:ring-[#F0B429]"
            />
            <Input
              placeholder="Owner Name *"
              value={vehicleFormData.owner}
              onChange={(e) =>
                setVehicleFormData({
                  ...vehicleFormData,
                  owner: e.target.value,
                })
              }
              required
              className="focus-visible:ring-[#F0B429]"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Make (e.g., Toyota)"
                value={vehicleFormData.make}
                onChange={(e) =>
                  setVehicleFormData({
                    ...vehicleFormData,
                    make: e.target.value,
                  })
                }
                className="focus-visible:ring-[#F0B429]"
              />
              <Input
                placeholder="Model"
                value={vehicleFormData.model}
                onChange={(e) =>
                  setVehicleFormData({
                    ...vehicleFormData,
                    model: e.target.value,
                  })
                }
                className="focus-visible:ring-[#F0B429]"
              />
            </div>
            <Input
              placeholder="Color"
              value={vehicleFormData.color}
              onChange={(e) =>
                setVehicleFormData({
                  ...vehicleFormData,
                  color: e.target.value,
                })
              }
              className="focus-visible:ring-[#F0B429]"
            />
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsVehicleDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#1E8449] hover:bg-[#186B3B]"
                disabled={
                  createVehicleMutation.isPending ||
                  updateVehicleMutation.isPending
                }
              >
                {createVehicleMutation.isPending ||
                  updateVehicleMutation.isPending
                  ? "Saving..."
                  : editingVehicle
                    ? "Update Vehicle"
                    : "Create Vehicle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehiclesViolators;