import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card, CardHeader, CardTitle, CardContent,
} from "../components/ui/card";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "../components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Pagination } from "../components/ui/Pagination";
import {
  getBiometricRequests,
  approveBiometricRequest,
  rejectBiometricRequest,
} from "../services/api";
import {
  Fingerprint, CheckCircle, XCircle, Clock, RefreshCw,
  Loader2, AlertCircle, ShieldCheck, Search, X, MessageSquare,
} from "lucide-react";
import { useAlert } from "../components/ui/AlertProvider";

const ITEMS_PER_PAGE = 20;

const getDataArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data?.data && Array.isArray(response.data.data))
    return response.data.data;
  if (response.data && Array.isArray(response.data)) return response.data;
  return [];
};

const getMeta = (response) => {
  if (!response) return { current_page: 1, last_page: 1, total: 0 };
  const root = response.data ?? response;
  if (root.current_page !== undefined) {
    return {
      current_page: root.current_page,
      last_page: root.last_page,
      total: root.total,
    };
  }
  return { current_page: 1, last_page: 1, total: 0 };
};

const statusMeta = (status) => {
  switch (status) {
    case "pending":
      return { cls: "bg-[#FBF1DC] text-[#92600A]", Icon: Clock, label: "PENDING" };
    case "approved":
      return { cls: "bg-[#E5F2EA] text-[#1E8449]", Icon: CheckCircle, label: "APPROVED" };
    case "rejected":
      return { cls: "bg-[#FBE7E9] text-[#C8202F]", Icon: XCircle, label: "REJECTED" };
    default:
      return { cls: "bg-gray-100 text-gray-700", Icon: AlertCircle, label: status?.toUpperCase() };
  }
};

const typeLabel = (t) =>
  ({
    switch_to_fingerprint: "Switch to Fingerprint",
    switch_to_face: "Switch to Face",
    reset_biometric: "Reset Biometric",
  })[t] || t;

const sourceLabel = (s) =>
  s === "attendance" ? "Time In/Out" : s === "login" ? "Login" : s || "—";

const formatDateTime = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "—";
  }
};

const BiometricRequests = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();
  const [tab, setTab] = useState("pending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [reviewDialog, setReviewDialog] = useState({
    open: false,
    mode: null,
    request: null,
  });
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewError, setReviewError] = useState("");

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ["biometric-requests", tab, page],
    queryFn: () =>
      getBiometricRequests(page, ITEMS_PER_PAGE, {
        status: tab === "all" ? undefined : tab,
      }),
    keepPreviousData: true,
    staleTime: 1000 * 20,
  });

  const requests = getDataArray(data);
  const meta = getMeta(data);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter((r) => {
      const hay = [
        r.user?.firstname,
        r.user?.lastname,
        r.user?.email,
        r.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, search]);

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => approveBiometricRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(["biometric-requests"]);
      setReviewDialog({ open: false, mode: null, request: null });
      setReviewNotes("");
      notify.success("Request approved. The enforcer has been notified.");
    },
    onError: (e) =>
      notify.error(e.response?.data?.message || "Failed to approve request."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => rejectBiometricRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(["biometric-requests"]);
      setReviewDialog({ open: false, mode: null, request: null });
      setReviewNotes("");
      notify.success("Request rejected. The enforcer has been notified.");
    },
    onError: (e) =>
      notify.error(e.response?.data?.message || "Failed to reject request."),
  });

  const openApprove = (req) => {
    setReviewDialog({ open: true, mode: "approve", request: req });
    setReviewNotes("");
    setReviewError("");
  };

  const openReject = (req) => {
    setReviewDialog({ open: true, mode: "reject", request: req });
    setReviewNotes("");
    setReviewError("");
  };

  const closeDialog = () => {
    setReviewDialog({ open: false, mode: null, request: null });
    setReviewNotes("");
    setReviewError("");
  };

  const submitReview = () => {
    const { mode, request } = reviewDialog;
    if (!request) return;
    if (mode === "reject" && !reviewNotes.trim()) {
      setReviewError("A rejection reason is required.");
      return;
    }
    if (mode === "approve") {
      approveMutation.mutate({ id: request.request_id, notes: reviewNotes.trim() });
    } else {
      rejectMutation.mutate({ id: request.request_id, notes: reviewNotes.trim() });
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
            Biometric Change Requests
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            Review enforcer requests to change attendance verification.
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        className="space-y-4"
      >
        <TabsList className="bg-[#E9ECF2]">
          {[
            ["pending", "Pending", Clock],
            ["approved", "Approved", CheckCircle],
            ["rejected", "Rejected", XCircle],
            ["all", "All", ShieldCheck],
          ].map(([key, label, Icon]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === "pending" && pendingCount > 0 && (
                <span className="ml-1 text-xs bg-[#C8202F] text-white px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-[#F0B429]" />
                  Requests
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-72 focus-visible:ring-[#F0B429]"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading && !data ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                </div>
              ) : error ? (
                <div className="text-center py-8 text-[#C8202F]">
                  Failed to load requests.
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Fingerprint className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                  <p className="text-[#64748B]">
                    {tab === "pending"
                      ? "No pending biometric requests. All clear! 🎉"
                      : "No requests in this filter."}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                        <TableHead className="font-semibold text-[#16233F]">Enforcer</TableHead>
                        <TableHead className="font-semibold text-[#16233F]">Request</TableHead>
                        <TableHead className="font-semibold text-[#16233F]">Source</TableHead>
                        <TableHead className="font-semibold text-[#16233F]">Failures</TableHead>
                        <TableHead className="font-semibold text-[#16233F]">Reason</TableHead>
                        <TableHead className="font-semibold text-[#16233F]">Submitted</TableHead>
                        <TableHead className="font-semibold text-[#16233F]">Status</TableHead>
                        <TableHead className="font-semibold text-[#16233F] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => {
                        const s = statusMeta(r.status);
                        return (
                          <TableRow key={r.request_id} className="hover:bg-[#F8F9FA]">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">
                                  {r.user?.firstname?.[0]}
                                  {r.user?.lastname?.[0]}
                                </div>
                                <div>
                                  <div className="font-medium text-[#1F2937]">
                                    {r.user?.firstname} {r.user?.lastname}
                                  </div>
                                  <div className="text-xs text-[#64748B]">{r.user?.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#E9ECF2] text-xs font-medium text-[#16233F]">
                                <Fingerprint className="w-3.5 h-3.5" />
                                {typeLabel(r.request_type)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-[#64748B]">
                              {sourceLabel(r.source)}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-[#C8202F]">
                              {r.failure_count}
                            </TableCell>
                            <TableCell className="text-sm text-[#64748B] max-w-[200px] truncate">
                              {r.reason || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-[#1F2937]">
                              {formatDateTime(r.created_at)}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.cls}`}>
                                <s.Icon className="w-3 h-3" />
                                {s.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {r.status === "pending" ? (
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => openApprove(r)}
                                    className="bg-[#1E8449] hover:bg-[#186B3B]"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openReject(r)}
                                    className="border-[#C8202F]/30 text-[#C8202F] hover:bg-[#FBE7E9]"
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-xs text-[#64748B] text-right">
                                  <div>
                                    by {r.reviewer?.firstname} {r.reviewer?.lastname}
                                  </div>
                                  <div>{formatDateTime(r.reviewed_at)}</div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="px-4 py-2 border-t">
                    <Pagination
                      currentPage={meta.current_page}
                      totalPages={meta.last_page}
                      onPageChange={setPage}
                      totalItems={meta.total}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Oswald'] text-[#16233F] flex items-center gap-2">
              {reviewDialog.mode === "approve" ? (
                <>
                  <CheckCircle className="w-5 h-5 text-[#1E8449]" />
                  Approve Request
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-[#C8202F]" />
                  Reject Request
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {reviewDialog.request && (
            <div className="space-y-4">
              <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#E9ECF2] text-sm">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Enforcer</span>
                  <span className="font-medium text-[#1F2937]">
                    {reviewDialog.request.user?.firstname}{" "}
                    {reviewDialog.request.user?.lastname}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[#64748B]">Request</span>
                  <span className="text-[#1F2937]">
                    {typeLabel(reviewDialog.request.request_type)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[#64748B]">Source</span>
                  <span className="text-[#1F2937]">
                    {sourceLabel(reviewDialog.request.source)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[#64748B]">Failures</span>
                  <span className="font-mono text-[#C8202F]">
                    {reviewDialog.request.failure_count}
                  </span>
                </div>
                {reviewDialog.request.reason && (
                  <div className="mt-2 pt-2 border-t border-[#E9ECF2] text-xs text-[#64748B]">
                    <span className="font-medium text-[#1F2937]">Reason: </span>
                    {reviewDialog.request.reason}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {reviewDialog.mode === "approve"
                    ? "Notes (optional)"
                    : "Rejection reason *"}
                </label>
                <textarea
                  className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                  value={reviewNotes}
                  onChange={(e) => {
                    setReviewNotes(e.target.value);
                    if (reviewError) setReviewError("");
                  }}
                  placeholder={
                    reviewDialog.mode === "approve"
                      ? "Optional notes for the enforcer..."
                      : "Explain why this request is being declined..."
                  }
                />
                {reviewError && (
                  <p className="text-xs text-[#C8202F] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {reviewError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={closeDialog}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 ${reviewDialog.mode === "approve"
                      ? "bg-[#1E8449] hover:bg-[#186B3B]"
                      : "bg-[#C8202F] hover:bg-[#A01622]"
                    }`}
                  onClick={submitReview}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  {approveMutation.isPending || rejectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : reviewDialog.mode === "approve" ? (
                    "Confirm Approval"
                  ) : (
                    "Confirm Rejection"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BiometricRequests;