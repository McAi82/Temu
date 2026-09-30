import React, { useState, useMemo } from "react";
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../components/ui/table";
import { Pagination } from "../components/ui/Pagination";
import ActionButton from "../components/ui/ActionButton";
import { byFields } from "../lib/sortBy";
import { getTickets, updateTicketStatus, deleteTicket } from "../services/api";
import {
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useAlert } from "../components/ui/AlertProvider";

const ITEMS_PER_PAGE = 20;

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
  if (response.meta) return response.meta;
  if (response.data && response.data.meta) return response.data.meta;
  if (response.data && response.data.current_page !== undefined) {
    return {
      current_page: response.data.current_page,
      last_page: response.data.last_page,
      total: response.data.total,
      per_page: response.data.per_page,
    };
  }
  return { current_page: 1, last_page: 1, total: 0 };
};

const Tickets = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const {
    data: ticketsResponse,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["tickets", page],
    queryFn: () => getTickets(page, ITEMS_PER_PAGE),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateTicketStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries(["tickets"]);
      notify.success("Ticket status updated successfully");
    },
    onError: (error) => {
      notify.error(
        error.response?.data?.message || "Failed to update ticket status",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTicket,
    onSuccess: () => {
      queryClient.invalidateQueries(["tickets"]);
      notify.success("Ticket deleted successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Failed to delete ticket");
    },
  });

  const tickets = getDataArray(ticketsResponse);
  const meta = getMeta(ticketsResponse);

  const handleStatusUpdate = async (id, status) => {
    const ok = await notify.confirm(
      `Change ticket status to ${status.toUpperCase()}?`,
      { confirmText: "Change" },
    );
    if (ok) updateStatusMutation.mutate({ id, status });
  };

  const handleDelete = async (id) => {
    const ok = await notify.confirm(
      "Are you sure you want to delete this ticket? This action cannot be undone.",
      { destructive: true, confirmText: "Delete" },
    );
    if (ok) deleteMutation.mutate(id);
  };

  const getStatusColor = (status) => {
    const colors = {
      paid: "bg-[#E5F2EA] text-[#1E8449]",
      issued: "bg-[#FBF1DC] text-[#92600A]",
      contested: "bg-[#FBEAE2] text-[#C2541F]",
      dismissed: "bg-[#FBE7E9] text-[#C8202F]",
      partial_paid: "bg-[#EEF1F5] text-[#3B5170]",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getStatusIcon = (status) => {
    const icons = {
      paid: <CheckCircle className="w-4 h-4 text-[#1E8449]" />,
      issued: <AlertCircle className="w-4 h-4 text-[#92600A]" />,
      contested: <AlertCircle className="w-4 h-4 text-[#C2541F]" />,
      dismissed: <XCircle className="w-4 h-4 text-[#C8202F]" />,
    };
    return icons[status] || null;
  };

  // Filter + sort alphabetically by violator last name → first name,
  // then by ticket number as a tie-breaker.
  const filteredTickets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const matching = tickets.filter((ticket) => {
      const matchesSearch =
        !term ||
        ticket.ticket_number?.toLowerCase().includes(term) ||
        ticket.violator?.firstname?.toLowerCase().includes(term) ||
        ticket.violator?.lastname?.toLowerCase().includes(term) ||
        ticket.vehicle?.platenumber?.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "" || ticket.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...matching].sort((a, b) => {
      const cmp = byFields("lastname", "firstname")(
        a.violator || {},
        b.violator || {},
      );
      if (cmp !== 0) return cmp;
      return (a.ticket_number || "").localeCompare(b.ticket_number || "");
    });
  }, [tickets, searchTerm, statusFilter]);

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
        <Button onClick={() => refetch()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
            Tickets Management
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            View and manage all traffic violation tickets
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

      <Card className="mb-6">
        <CardHeader>
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input
                placeholder="Search by ticket #, violator name, or plate #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 focus-visible:ring-[#F0B429]"
              />
            </div>
            <select
              className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="partial_paid">Partial Paid</option>
              <option value="contested">Contested</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("");
              }}
              className="border-[#C8202F]/30 text-[#C8202F] hover:bg-[#FBE7E9]"
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-[#64748B]">
              No tickets found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Ticket #
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Violator
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Vehicle
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Violations
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Total Fine
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Date
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Status
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow
                      key={ticket.ticket_id}
                      className="hover:bg-[#F8F9FA]"
                    >
                      <TableCell className="font-mono text-sm font-medium text-[#16233F]">
                        {ticket.ticket_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">
                            {ticket.violator?.firstname?.[0]}
                            {ticket.violator?.lastname?.[0]}
                          </div>
                          <div>
                            <div className="font-medium text-[#1F2937]">
                              {ticket.violator?.firstname}{" "}
                              {ticket.violator?.lastname}
                            </div>
                            <div className="text-xs text-[#64748B]">
                              {ticket.violator?.license}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-[#1F2937]">
                        {ticket.vehicle?.platenumber}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {ticket.violations?.map((v, idx) => (
                            <div key={idx} className="text-xs text-[#1F2937]">
                              <span className="font-medium">
                                {v.violation_type?.violation_name}
                              </span>
                              <span className="text-[#64748B] ml-2">
                                ₱{v.fine_amount?.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-[#C8202F]">
                        ₱
                        {ticket.total_fine?.toLocaleString() ||
                          ticket.violations
                            ?.reduce((sum, v) => sum + (v.fine_amount || 0), 0)
                            ?.toLocaleString() ||
                          "0"}
                      </TableCell>
                      <TableCell className="text-sm text-[#1F2937]">
                        {new Date(
                          ticket.violation_datetime,
                        ).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(ticket.status)}
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}
                          >
                            {ticket.status?.toUpperCase().replace("_", " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {ticket.status === "issued" && (
                            <>
                              <ActionButton
                                icon={CheckCircle}
                                variant="primary"
                                onClick={() =>
                                  handleStatusUpdate(ticket.ticket_id, "paid")
                                }
                              >
                                Mark Paid
                              </ActionButton>
                              <ActionButton
                                icon={AlertCircle}
                                variant="warning"
                                onClick={() =>
                                  handleStatusUpdate(
                                    ticket.ticket_id,
                                    "contested",
                                  )
                                }
                              >
                                Contest
                              </ActionButton>
                            </>
                          )}
                          {(ticket.status === "paid" ||
                            ticket.status === "partial_paid") && (
                            <ActionButton
                              icon={XCircle}
                              variant="danger"
                              onClick={() =>
                                handleStatusUpdate(
                                  ticket.ticket_id,
                                  "dismissed",
                                )
                              }
                            >
                              Dismiss
                            </ActionButton>
                          )}
                          {ticket.status === "contested" && (
                            <ActionButton
                              icon={AlertCircle}
                              variant="warning"
                              onClick={() =>
                                handleStatusUpdate(ticket.ticket_id, "issued")
                              }
                            >
                              Re-open
                            </ActionButton>
                          )}
                          <ActionButton
                            icon={Trash2}
                            variant="danger"
                            onClick={() => handleDelete(ticket.ticket_id)}
                          >
                            Delete
                          </ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
};

export default Tickets;