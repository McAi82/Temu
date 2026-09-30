import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../components/ui/table";
import { Pagination } from "../components/ui/Pagination";
import {
  getViolations,
  createViolation,
  updateViolation,
  deleteViolation,
} from "../services/api";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { useAlert } from "../components/ui/AlertProvider";

const ITEMS_PER_PAGE = 20;

/* ------------------------------------------------------------------ */
/* Debounce                                                            */
/* ------------------------------------------------------------------ */

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const getDataArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data && Array.isArray(response.data)) return response.data;
  if (
    response.data &&
    response.data.data &&
    Array.isArray(response.data.data)
  ) {
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

  if (response.meta) {
    return response.meta;
  }

  return { current_page: 1, last_page: 1, total: 0 };
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const Violations = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();

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

  /* ---------------- Debounced search ---------------- */
  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  // Reset to page 1 whenever the search actually changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  /* ---------------- Query ---------------- */
  // NOTE: no search term in the query key. We fetch one page of data
  // and filter it client-side — the /violations endpoint accepts a
  // `search` param, but keeping the filter local keeps typing instant
  // and avoids hammering the server on every keystroke.
  const {
    data: violationsResponse,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["violations", page],
    queryFn: () => getViolations(page, ITEMS_PER_PAGE),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  /* ---------------- Mutations ---------------- */
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

  const deleteMutation = useMutation({
    mutationFn: deleteViolation,
    onSuccess: () => {
      queryClient.invalidateQueries(["violations"]);
      notify.success("Violation deleted successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error deleting violation");
    },
  });

  /* ---------------- Derived data ---------------- */
  const violations = getDataArray(violationsResponse);
  const meta = getMeta(violationsResponse);

  /* ---------------- Client-side search filter ---------------- */
  const filteredViolations = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return violations;

    return violations.filter((v) => {
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
    });
  }, [violations, debouncedSearch]);

  /* ---------------- Handlers ---------------- */
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

  const handleDelete = async (id, name) => {
    const ok = await notify.confirm(
      `Are you sure you want to delete "${name}"?`,
      { destructive: true, confirmText: "Delete" },
    );
    if (ok) deleteMutation.mutate(id);
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

  /* ---------------- Early returns ---------------- */
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

  /* ---------------- Render ---------------- */
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
            Violations Management
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            Manage traffic violation types and fines
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
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
                    <option value="Traffic Rules" />
                    <option value="Documents" />
                    <option value="Vehicle Condition" />
                    <option value="Motorcycle" />
                    <option value="Loading/Unloading" />
                    <option value="Attire/Conduct" />
                  </datalist>
                </div>
                <Input
                  placeholder="Violation Name *"
                  value={formData.violation_name}
                  onChange={(e) =>
                    setFormData({ ...formData, violation_name: e.target.value })
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
                      setFormData({ ...formData, fine_amount: e.target.value })
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="font-['Oswald'] font-medium text-[#16233F]">
              Violations List
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input
                placeholder="Search by code, name, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 w-80 focus-visible:ring-[#F0B429]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="text-center py-8 text-[#64748B]">
              {searchTerm
                ? `No violations match "${searchTerm}"`
                : "No violations found."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Code
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Violation Name
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Category
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Fine Amount
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Points
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredViolations.map((violation) => (
                    <TableRow
                      key={violation.violation_id}
                      className="hover:bg-[#F8F9FA]"
                    >
                      <TableCell className="font-mono text-sm font-medium text-[#16233F]">
                        {violation.violation_code}
                      </TableCell>
                      <TableCell className="text-[#1F2937]">
                        {violation.violation_name}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(
                            violation.category,
                          )}`}
                        >
                          {violation.category || "Uncategorized"}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-[#C8202F]">
                        ₱{violation.fine_amount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            violation.demerit_points > 0
                              ? "bg-[#FBF1DC] text-[#92600A]"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {violation.demerit_points || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(violation)}
                            className="text-[#16233F] hover:bg-[#E9ECF2]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDelete(
                                violation.violation_id,
                                violation.violation_name,
                              )
                            }
                            className="text-[#C8202F] hover:bg-[#FBE7E9]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={meta.current_page}
                totalPages={meta.last_page}
                onPageChange={setPage}
                totalItems={meta.total}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Violations;