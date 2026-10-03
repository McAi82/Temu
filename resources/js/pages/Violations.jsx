import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Pagination } from "../components/ui/Pagination";
import ActionButton from "../components/ui/ActionButton";
import { byFields } from "../lib/sortBy";
import {
  getViolations,
  createViolation,
  updateViolation,
  deleteViolation,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  Pencil,
  Archive,
  Search,
  RefreshCw,
  Loader2,
  X,
  Filter,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { useAlert } from "../components/ui/AlertProvider";

const ITEMS_PER_PAGE = 20;

const CATEGORY_OPTIONS = [
  "Traffic Rules",
  "Documents",
  "Vehicle Condition",
  "Motorcycle",
  "Loading/Unloading",
  "Attire/Conduct",
];

const FINE_PRESETS = [
  { label: "≤ ₱500", min: "", max: "500" },
  { label: "₱500 – ₱1,500", min: "500", max: "1500" },
  { label: "₱1,500 – ₱3,000", min: "1500", max: "3000" },
  { label: "> ₱3,000", min: "3000", max: "" },
];

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

const ROW =
  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
  'md:grid md:grid-cols-[minmax(0,.9fr)_minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,.7fr)_minmax(0,14rem)] md:gap-4';

const L = ({ children }) => (
  <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">{children}</label>
);

const Mini = ({ children }) => (
  <i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">{children}</i>
);

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

const FineBar = ({ value, max }) => (
  <div className="h-1 mt-1.5 rounded bg-[#EEF0F4] overflow-hidden">
    <div className="h-full rounded bg-[#C8202F]/70 transition-all duration-500" style={{ width: `${Math.min(100, ((parseFloat(value) || 0) / max) * 100)}%` }} />
  </div>
);

const Violations = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();
  const { isAdmin } = useAuth();
  const [view, setView] = useState("list"); // "list" | "cards"

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingViolation, setEditingViolation] = useState(null);
  const [formData, setFormData] = useState({
    violation_code: "",
    violation_name: "",
    fine_amount: "",
    description: "",
    category: "",
    demerit_points: 0,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: "",
    active_only: true,
    min_fine: "",
    max_fine: "",
    min_points: "",
    max_points: "",
  });

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const {
    data: violationsResponse,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["violations", page, debouncedSearch, filters],
    queryFn: () =>
      getViolations(page, ITEMS_PER_PAGE, {
        search: debouncedSearch || undefined,
        category: filters.category || undefined,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  const createMutation = useMutation({
    mutationFn: createViolation,
    onSuccess: () => {
      queryClient.invalidateQueries(["violations"]);
      setIsDialogOpen(false);
      resetForm();
      notify.success("Violation created successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error creating violation");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateViolation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["violations"]);
      setIsDialogOpen(false);
      resetForm();
      notify.success("Violation updated successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error updating violation");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: deleteViolation,
    onSuccess: () => {
      queryClient.invalidateQueries(["violations"]);
      queryClient.invalidateQueries(["archives"]);
      notify.success("Violation archived successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error archiving violation");
    },
  });

  const violations = getDataArray(violationsResponse);
  const meta = getMeta(violationsResponse);

  /* ---------------- Filter + Sort ---------------- */
  const filteredViolations = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    let list = violations;

    // Client-side refinement for the numeric ranges and active flag
    if (filters.active_only) {
      list = list.filter((v) => v.is_active !== false);
    }
    if (filters.min_fine !== "") {
      list = list.filter(
        (v) => parseFloat(v.fine_amount || 0) >= parseFloat(filters.min_fine),
      );
    }
    if (filters.max_fine !== "") {
      list = list.filter(
        (v) => parseFloat(v.fine_amount || 0) <= parseFloat(filters.max_fine),
      );
    }
    if (filters.min_points !== "") {
      list = list.filter(
        (v) =>
          parseInt(v.demerit_points || 0) >= parseInt(filters.min_points),
      );
    }
    if (filters.max_points !== "") {
      list = list.filter(
        (v) =>
          parseInt(v.demerit_points || 0) <= parseInt(filters.max_points),
      );
    }

    const matching = term
      ? list.filter((v) => {
        const haystack = [
          v.violation_code,
          v.violation_name,
          v.category,
          v.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      : list;

    return [...matching].sort(byFields("violation_name"));
  }, [violations, debouncedSearch, filters]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSend = {
      ...formData,
      fine_amount: parseFloat(formData.fine_amount) || 0,
      demerit_points: parseInt(formData.demerit_points) || 0,
    };

    if (editingViolation) {
      updateMutation.mutate({
        id: editingViolation.violation_id,
        data: dataToSend,
      });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  const handleArchive = async (id, name) => {
    const ok = await notify.confirm(
      `Archive "${name}"? You can restore it later from the Archives page.`,
      { destructive: true, confirmText: "Archive" },
    );
    if (ok) archiveMutation.mutate(id);
  };

  const handleEdit = (violation) => {
    setEditingViolation(violation);
    setFormData({
      violation_code: violation.violation_code || "",
      violation_name: violation.violation_name || "",
      fine_amount: violation.fine_amount || "",
      description: violation.description || "",
      category: violation.category || "",
      demerit_points: violation.demerit_points || 0,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingViolation(null);
    setFormData({
      violation_code: "",
      violation_name: "",
      fine_amount: "",
      description: "",
      category: "",
      demerit_points: 0,
    });
  };

  const clearFilters = () =>
    setFilters({
      category: "",
      active_only: true,
      min_fine: "",
      max_fine: "",
      min_points: "",
      max_points: "",
    });

  const applyFinePreset = (preset) =>
    setFilters((f) => ({ ...f, min_fine: preset.min, max_fine: preset.max }));

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchTerm) c++;
    if (filters.category) c++;
    if (!filters.active_only) c++;
    if (filters.min_fine || filters.max_fine) c++;
    if (filters.min_points || filters.max_points) c++;
    return c;
  }, [searchTerm, filters]);

  const getCategoryBadgeColor = (category) => {
    const colors = {
      "Traffic Rules": "bg-[#16233F] text-white",
      Documents: "bg-[#EEF1F5] text-[#3B5170]",
      "Vehicle Condition": "bg-[#FBF1DC] text-[#92600A]",
      Motorcycle: "bg-[#FBEAE2] text-[#C2541F]",
      "Loading/Unloading": "bg-[#E5F2EA] text-[#1E8449]",
      "Attire/Conduct": "bg-[#FBE7E9] text-[#C8202F]",
    };
    return colors[category] || "bg-gray-100 text-gray-700";
  };

  if (isLoading && !violationsResponse) {
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
          Error loading violations: {error.message}
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

  const setF = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const maxFine = Math.max(1, ...filteredViolations.map((v) => parseFloat(v.fine_amount) || 0));

  const chips = [
    searchTerm && [`Search: ${searchTerm}`, () => setSearchTerm("")],
    filters.category && [`Category: ${filters.category}`, () => setF({ category: "" })],
    !filters.active_only && ["Showing inactive too", () => setF({ active_only: true })],
    (filters.min_fine || filters.max_fine) && [`Fine: ₱${filters.min_fine || "0"} → ₱${filters.max_fine || "∞"}`, () => setF({ min_fine: "", max_fine: "" })],
    (filters.min_points || filters.max_points) && [`Points: ${filters.min_points || "0"} → ${filters.max_points || "∞"}`, () => setF({ min_points: "", max_points: "" })],
  ].filter(Boolean);

  const catBadge = (v) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(v.category)}`}>{v.category || "Uncategorized"}</span>
  );
  const ptsBadge = (v) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.demerit_points > 0 ? "bg-[#FBF1DC] text-[#92600A]" : "bg-gray-100 text-gray-500"}`}>{v.demerit_points || 0}</span>
  );
  const actions = (v) => isAdmin() ? (
    <div className="flex flex-wrap gap-2">
      <ActionButton icon={Pencil} variant="primary" onClick={() => handleEdit(v)}>Edit</ActionButton>
      <ActionButton icon={Archive} variant="danger" onClick={() => handleArchive(v.violation_id, v.violation_name)}>Archive</ActionButton>
    </div>
  ) : (
    <span className="text-xs text-[#94A3B8]">View only</span>
  );

  const rangeInputs = (minKey, maxKey) => (
    <>
      <Input type="number" placeholder="Min" value={filters[minKey]} onChange={(e) => setF({ [minKey]: e.target.value })} className="w-24 focus-visible:ring-[#F0B429]" />
      <span className="text-[#64748B] text-sm">to</span>
      <Input type="number" placeholder="Max" value={filters[maxKey]} onChange={(e) => setF({ [maxKey]: e.target.value })} className="w-24 focus-visible:ring-[#F0B429]" />
    </>
  );

  const panel = (
    <aside className="self-start rounded-xl bg-[#FBF1DC] border-t-4 border-[#F0B429] p-5 space-y-5 lg:sticky lg:top-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-['Oswald'] font-medium text-[#16233F]">Filter Violations</h3>
        <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-[#F0B429]/25"><X className="w-4 h-4 text-[#92600A]" /></button>
      </div>
      <div>
        <L>Category</L>
        <select className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={filters.category} onChange={(e) => setF({ category: e.target.value })}>
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#92600A] cursor-pointer mt-3">
          <input type="checkbox" checked={filters.active_only} onChange={(e) => setF({ active_only: e.target.checked })} className="w-4 h-4 accent-[#92600A]" />
          Show active violations only
        </label>
      </div>
      <div>
        <L>Fine amount (₱)</L>
        <div className="flex flex-wrap items-center gap-2">{rangeInputs("min_fine", "max_fine")}</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FINE_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => applyFinePreset(p)}
              className="text-xs px-2.5 py-1 rounded-full bg-white text-[#16233F] hover:bg-[#16233F] hover:text-white transition-colors font-medium">{p.label}</button>
          ))}
        </div>
      </div>
      <div>
        <L>Demerit points</L>
        <div className="flex flex-wrap items-center gap-2">{rangeInputs("min_points", "max_points")}</div>
      </div>
      <div className="flex gap-2 pt-3 border-t border-[#F0B429]/30">
        <Button onClick={() => setShowFilters(false)} className="bg-[#1E8449] hover:bg-[#186B3B]">Apply Filters</Button>
        <Button onClick={clearFilters} variant="ghost" className="text-[#64748B] hover:text-[#C8202F]"><X className="w-4 h-4 mr-1" />Reset</Button>
      </div>
    </aside>
  );

  return (
    <div className="space-y-6 font-['Inter']">
      <header className="relative overflow-hidden rounded-2xl bg-[#16233F] text-white px-6 py-7 flex flex-wrap items-center justify-between gap-4">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 40px, #F0B429 40px 42px)" }} />
        <div className="relative">
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">Violations Management</h1>
          <p className="text-[#C7CEDB] text-sm mt-1">Manage traffic violation types and fines</p>
        </div>
        <div className="relative flex gap-2">
          <Button onClick={() => refetch()} variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          {isAdmin() && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={resetForm}
                  className="bg-[#1E8449] hover:bg-[#186B3B]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Violation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-['Oswald'] text-[#16233F]">
                    {editingViolation ? "Edit Violation" : "Add New Violation"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="Violation Code *"
                      value={formData.violation_code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          violation_code: e.target.value.toUpperCase(),
                        })
                      }
                      required
                      className="focus-visible:ring-[#F0B429]"
                    />
                    <Input
                      placeholder="Category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      list="categories"
                      className="focus-visible:ring-[#F0B429]"
                    />
                    <datalist id="categories">
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <Input
                    placeholder="Violation Name *"
                    value={formData.violation_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        violation_name: e.target.value,
                      })
                    }
                    required
                    className="focus-visible:ring-[#F0B429]"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      placeholder="Fine Amount (₱)"
                      value={formData.fine_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fine_amount: e.target.value,
                        })
                      }
                      required
                      className="focus-visible:ring-[#F0B429]"
                    />
                    <Input
                      type="number"
                      placeholder="Demerit Points"
                      value={formData.demerit_points}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          demerit_points: e.target.value,
                        })
                      }
                      className="focus-visible:ring-[#F0B429]"
                    />
                  </div>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                    placeholder="Description (optional)"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                  <Button
                    type="submit"
                    className="w-full bg-[#1E8449] hover:bg-[#186B3B]"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingViolation
                        ? "Update Violation"
                        : "Create Violation"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className={`grid gap-6 ${showFilters ? "lg:grid-cols-[300px_minmax(0,1fr)]" : ""}`}>
        {showFilters && panel}
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setShowFilters((v) => !v)} className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]">
              <Filter className="w-4 h-4 mr-2" />Filters
              {activeFilterCount > 0 && <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
            </Button>
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input placeholder="Search by code, name, or category..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]" />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} title="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"><X className="w-4 h-4" /></button>
              )}
            </div>
            <ViewToggle view={view} setView={setView} />
          </div>

          {chips.length > 0 && <div className="flex flex-wrap gap-2">{chips.map(([label, clear]) => <Chip key={label} label={label} onClear={clear} />)}</div>}

          <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2">
            Violations List
            <span className="text-xs font-normal text-[#64748B] font-['Inter']">(alphabetical by name)</span>
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#16233F]" /></div>
          ) : filteredViolations.length === 0 ? (
            <div className="text-center py-10 text-[#64748B]">
              {activeFilterCount > 0 ? "No violations match the current filters." : "No violations found."}
            </div>
          ) : (
            <>
              {view === "cards" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredViolations.map((v) => (
                    <article key={v.violation_id} className="flex flex-col rounded-xl bg-white border border-[#E3E7EE] p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#16233F] bg-[#FFF6D6] border border-[#16233F]/30 rounded px-2 py-1">{v.violation_code}</span>
                        {catBadge(v)}
                      </div>
                      <p className="font-['Oswald'] text-lg leading-snug text-[#1F2937] mt-3 flex-1">{v.violation_name}</p>
                      <div className="flex items-end justify-between mt-4">
                        <div>
                          <p className="text-[10px] text-[#94A3B8]">Fine Amount</p>
                          <p className="text-2xl font-['Oswald'] font-semibold text-[#C8202F] tabular-nums">₱{v.fine_amount?.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[#94A3B8] mb-1">Points</p>
                          {ptsBadge(v)}
                        </div>
                      </div>
                      <FineBar value={v.fine_amount} max={maxFine} />
                      <div className="mt-4 pt-4 border-t border-dashed border-[#CBD5E1]">{actions(v)}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                  <div className={`hidden gap-4 px-4 py-2.5 bg-[#16233F] text-white text-xs font-semibold ${ROW}`}>
                    {["Code", "Violation Name", "Category", "Fine Amount", "Points", "Actions"].map((c) => <span key={c}>{c}</span>)}
                  </div>
                  <ul className="divide-y divide-[#EEF0F4]">
                    {filteredViolations.map((v) => (
                      <li key={v.violation_id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-[#F8F9FB] transition-colors ${ROW}`}>
                        <span className="font-mono text-sm font-medium text-[#16233F]"><Mini>Code</Mini>{v.violation_code}</span>
                        <span className="text-[#1F2937] w-full md:w-auto">{v.violation_name}</span>
                        <span>{catBadge(v)}</span>
                        <div className="min-w-[96px]">
                          <span className="font-medium text-[#C8202F]"><Mini>Fine</Mini>₱{v.fine_amount?.toLocaleString()}</span>
                          <FineBar value={v.fine_amount} max={maxFine} />
                        </div>
                        <span><Mini>Points</Mini>{ptsBadge(v)}</span>
                        <div>{actions(v)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={setPage} totalItems={meta.total} itemsPerPage={ITEMS_PER_PAGE} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Violations;