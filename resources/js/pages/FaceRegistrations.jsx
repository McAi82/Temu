// web/src/pages/FaceRegistrations.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '../components/ui/tabs';
import { Pagination } from '../components/ui/Pagination';
import ActionButton from '../components/ui/ActionButton';
import {
    getFaceRegistrations,
    getFaceTakeoverRequests,
    getFaceTakeoverPendingCount,
    approveFaceTakeover,
    rejectFaceTakeover,
    transferFaceRegistration,
    getUsers,
} from '../services/api';
import {
    Search,
    RefreshCw,
    Loader2,
    X,
    ScanFace,
    CheckCircle,
    XCircle,
    Clock,
    ArrowRightLeft,
    Eye,
    Info,
    AlertCircle,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { useAlert } from '../components/ui/AlertProvider';
import { useAuth } from '../contexts/AuthContext';

const ITEMS_PER_PAGE = 20;

/* ------------------------------------------------------------------ */
/* Image URL helper — mirrors the logic used in Users.jsx              */
/* ------------------------------------------------------------------ */

const API_BASE_URL =
    'https://ivory-gerbil-502781.hostingersite.com';

/**
 * Turn a raw image path into a fully-qualified URL.
 *
 * Handles:
 *   - null / undefined / non-string → null
 *   - full URL already             → unchanged
 *   - "/storage/..."               → prepend API_BASE_URL
 *   - "storage/..."                → prepend API_BASE_URL + "/"
 *   - "faces/..."                  → prepend API_BASE_URL + "/storage/"
 */
const getImageUrl = (path) => {
    if (!path) return null;
    if (typeof path !== 'string') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    const cleaned = path.startsWith('/') ? path.slice(1) : path;

    if (cleaned.startsWith('storage/')) {
        return `${API_BASE_URL}/${cleaned}`;
    }

    return `${API_BASE_URL}/storage/${cleaned}`;
};

/* ------------------------------------------------------------------ */
/* Data helpers                                                        */
/* ------------------------------------------------------------------ */

const getDataArray = (r) => {
    if (!r) return [];
    if (Array.isArray(r)) return r;
    if (r.data && Array.isArray(r.data)) return r.data;
    if (r.data?.data && Array.isArray(r.data.data)) return r.data.data;
    return [];
};

const getMeta = (r) => {
    if (!r) return { current_page: 1, last_page: 1, total: 0 };
    if (r.current_page !== undefined) return r;
    if (r.data && r.data.current_page !== undefined) return r.data;
    if (r.meta) return r.meta;
    return { current_page: 1, last_page: 1, total: 0 };
};

/* ------------------------------------------------------------------ */
/* Small UI primitives                                                 */
/* ------------------------------------------------------------------ */

const RoleBadge = ({ role }) => {
    const map = {
        admin: 'bg-[#16233F] text-white',
        staff: 'bg-[#EEF1F5] text-[#3B5170]',
        enforcer: 'bg-[#E5F2EA] text-[#1E8449]',
    };
    return (
        <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${map[role] || 'bg-gray-100 text-gray-700'
                }`}
        >
            {role || '—'}
        </span>
    );
};

const StatusBadge = ({ status }) => {
    const map = {
        pending: { color: 'bg-[#FBF1DC] text-[#92600A]', Icon: Clock },
        approved: { color: 'bg-[#E5F2EA] text-[#1E8449]', Icon: CheckCircle },
        rejected: { color: 'bg-[#FBE7E9] text-[#C8202F]', Icon: XCircle },
    };
    const meta = map[status] || map.pending;
    const Icon = meta.Icon;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}
        >
            <Icon className="w-3 h-3" />
            {status?.toUpperCase() || '—'}
        </span>
    );
};

/**
 * Reusable image renderer. Handles:
 *   - normalising the URL
 *   - hiding on error
 *   - fallback slot when the URL is missing
 */
const FaceImage = ({
    rawUrl,
    alt = '',
    className = '',
    fallback = null,
}) => {
    const url = getImageUrl(rawUrl);
    if (!url) return fallback;
    return (
        <img
            src={url}
            alt={alt}
            className={className}
            onError={(e) => {
                e.target.style.display = 'none';
            }}
        />
    );
};

/* ------------------------------------------------------------------ */
/* Compare panel (used inside the takeover modal)                      */
/* ------------------------------------------------------------------ */

const FaceComparePanel = ({
    title,
    name,
    role,
    imageUrl,
    accent = '#16233F',
}) => (
    <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
        <div className="h-1.5" style={{ background: accent }} />
        <div className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                    {title}
                </span>
                {role && <RoleBadge role={role} />}
            </div>
            <div className="aspect-[3/4] rounded-lg bg-[#F5F6F8] overflow-hidden mb-3">
                <FaceImage
                    rawUrl={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    fallback={
                        <div className="w-full h-full flex items-center justify-center text-[#CBD5E1]">
                            <ScanFace className="w-12 h-12" />
                        </div>
                    }
                />
            </div>
            <p className="font-['Oswald'] text-base leading-tight text-[#1F2937] truncate">
                {name || '—'}
            </p>
        </div>
    </div>
);

/* ------------------------------------------------------------------ */
/* Takeover compare modal                                              */
/* ------------------------------------------------------------------ */

const TakeoverCompareModal = ({
    open,
    onClose,
    request,
    onApprove,
    onReject,
    busy,
}) => {
    const [notes, setNotes] = useState('');

    if (!open || !request) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="w-[80vw] max-w-[1100px] max-h-[90vh] overflow-hidden p-0 gap-0">
                <DialogHeader className="px-7 pt-6 pb-5 border-b border-dashed border-[#CBD5E1] bg-white">
                    <DialogTitle className="font-['Oswald'] text-2xl text-[#16233F] flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-[#FBF1DC] flex items-center justify-center flex-shrink-0">
                            <ArrowRightLeft className="w-5 h-5 text-[#92600A]" />
                        </span>
                        <div>
                            <div className="leading-tight">
                                Face Takeover Review
                            </div>
                            <div className="text-xs font-normal text-[#64748B] font-['Inter'] mt-0.5">
                                Compare the two faces and decide whether to
                                reassign ownership.
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[calc(90vh-100px)] overflow-y-auto">
                    {/* Meta strip */}
                    <div className="px-7 py-4 bg-[#F8F9FA] border-b border-dashed border-[#CBD5E1] grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                                Device
                            </p>
                            <p className="font-mono text-xs text-[#16233F] truncate">
                                {request.device_id}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                                Match similarity
                            </p>
                            <p className="text-sm font-semibold text-[#C8202F] tabular-nums">
                                {(request.similarity * 100).toFixed(2)}%
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                                Submitted
                            </p>
                            <p className="text-sm text-[#1F2937]">
                                {new Date(
                                    request.created_at,
                                ).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Face comparison */}
                    <div className="p-7">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FaceComparePanel
                                title="Current owner (existing registration)"
                                name={
                                    request.current_owner
                                        ? `${request.current_owner.firstname} ${request.current_owner.lastname}`
                                        : 'Unknown'
                                }
                                role={request.current_owner?.role}
                                imageUrl={request.existing_front_image_url}
                                accent="#16233F"
                            />
                            <FaceComparePanel
                                title="Requester (wants this face)"
                                name={
                                    request.requester
                                        ? `${request.requester.firstname} ${request.requester.lastname}`
                                        : 'Unknown'
                                }
                                role={request.requester?.role}
                                imageUrl={request.requester_front_image_url}
                                accent="#1E8449"
                            />
                        </div>

                        {/* The other two poses for each side */}
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                                    Owner · Left
                                </p>
                                <div className="aspect-square rounded bg-[#F5F6F8] overflow-hidden">
                                    <FaceImage
                                        rawUrl={
                                            request.existing_left_image_url
                                        }
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                                    Owner · Right
                                </p>
                                <div className="aspect-square rounded bg-[#F5F6F8] overflow-hidden">
                                    <FaceImage
                                        rawUrl={
                                            request.existing_right_image_url
                                        }
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                                    Requester · Left
                                </p>
                                <div className="aspect-square rounded bg-[#F5F6F8] overflow-hidden">
                                    <FaceImage
                                        rawUrl={
                                            request.requester_left_image_url
                                        }
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                                    Requester · Right
                                </p>
                                <div className="aspect-square rounded bg-[#F5F6F8] overflow-hidden">
                                    <FaceImage
                                        rawUrl={
                                            request.requester_right_image_url
                                        }
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Decision notes */}
                        <div className="mt-6">
                            <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                Review notes (required for rejection)
                            </label>
                            <textarea
                                className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                                placeholder="e.g., Photos match — same person, previous registration is stale."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Sticky footer */}
                <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-dashed border-[#CBD5E1] bg-white">
                    <div className="text-xs text-[#64748B] flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span>
                            Approving transfers the face to the requester.
                            Rejecting leaves everything as-is.
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={busy}
                            className="min-w-[100px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => onReject(notes)}
                            disabled={busy || !notes.trim()}
                            className="bg-[#C8202F] hover:bg-[#A01622] text-white min-w-[140px]"
                        >
                            {busy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Reject'
                            )}
                        </Button>
                        <Button
                            onClick={() => onApprove(notes)}
                            disabled={busy}
                            className="bg-[#1E8449] hover:bg-[#186B3B] text-white min-w-[160px]"
                        >
                            {busy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Approve & Transfer'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

const FaceRegistrations = () => {
    const queryClient = useQueryClient();
    const notify = useAlert();
    const { isAdmin } = useAuth();

    const [tab, setTab] = useState('requests');

    const [requestStatus, setRequestStatus] = useState('pending');
    const [requestPage, setRequestPage] = useState(1);

    const [regPage, setRegPage] = useState(1);
    const [regStatus, setRegStatus] = useState('active');
    const [regSearch, setRegSearch] = useState('');

    const [compareRequest, setCompareRequest] = useState(null);
    const [busy, setBusy] = useState(false);

    const [transferTarget, setTransferTarget] = useState(null);
    const [transferUserId, setTransferUserId] = useState('');

    /* --- Queries --- */

    const { data: pendingCountRes, refetch: refetchPendingCount } = useQuery({
        queryKey: ['face-takeover-pending-count'],
        queryFn: getFaceTakeoverPendingCount,
        refetchInterval: 30000,
    });
    const pendingCount = pendingCountRes?.data?.count || 0;

    const {
        data: requestsRes,
        isLoading: requestsLoading,
        refetch: refetchRequests,
    } = useQuery({
        queryKey: ['face-takeover-requests', requestStatus, requestPage],
        queryFn: () =>
            getFaceTakeoverRequests(requestPage, ITEMS_PER_PAGE, {
                status: requestStatus,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 30,
    });

    const requests = getDataArray(requestsRes);
    const requestsMeta = getMeta(requestsRes);

    const {
        data: registrationsRes,
        isLoading: registrationsLoading,
        refetch: refetchRegistrations,
    } = useQuery({
        queryKey: ['face-registrations', regPage, regStatus, regSearch],
        queryFn: () =>
            getFaceRegistrations(regPage, ITEMS_PER_PAGE, {
                status: regStatus,
                search: regSearch || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 60,
    });

    const registrations = getDataArray(registrationsRes);
    const registrationsMeta = getMeta(registrationsRes);

    const { data: usersRes } = useQuery({
        queryKey: ['users', 'enforcer', 'all-for-face'],
        queryFn: () => getUsers(1, 200, { role: 'enforcer' }),
        staleTime: 1000 * 60 * 10,
    });
    const users = getDataArray(usersRes);

    /* --- Mutations --- */

    const approveMutation = useMutation({
        mutationFn: ({ id, notes }) => approveFaceTakeover(id, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['face-takeover-requests'],
            });
            queryClient.invalidateQueries({
                queryKey: ['face-registrations'],
            });
            queryClient.invalidateQueries({
                queryKey: ['face-takeover-pending-count'],
            });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            notify.success(
                'Takeover approved. The requester now owns the face.',
            );
            setCompareRequest(null);
        },
        onError: (err) => {
            notify.error(
                err.response?.data?.message ||
                'Failed to approve takeover.',
            );
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, notes }) => rejectFaceTakeover(id, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['face-takeover-requests'],
            });
            queryClient.invalidateQueries({
                queryKey: ['face-takeover-pending-count'],
            });
            notify.success('Takeover request rejected.');
            setCompareRequest(null);
        },
        onError: (err) => {
            notify.error(
                err.response?.data?.message ||
                'Failed to reject takeover.',
            );
        },
    });

    const transferMutation = useMutation({
        mutationFn: ({ id, userId }) =>
            transferFaceRegistration(id, { new_user_id: userId }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['face-registrations'],
            });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            notify.success('Face transferred to the new owner.');
            setTransferTarget(null);
            setTransferUserId('');
        },
        onError: (err) => {
            notify.error(
                err.response?.data?.message || 'Failed to transfer face.',
            );
        },
    });

    /* --- Handlers --- */

    const handleApprove = async (notes) => {
        if (!compareRequest) return;
        setBusy(true);
        try {
            await approveMutation.mutateAsync({
                id: compareRequest.request_id,
                notes,
            });
        } finally {
            setBusy(false);
        }
    };

    const handleReject = async (notes) => {
        if (!compareRequest || !notes.trim()) return;
        setBusy(true);
        try {
            await rejectMutation.mutateAsync({
                id: compareRequest.request_id,
                notes,
            });
        } finally {
            setBusy(false);
        }
    };

    const handleTransfer = async () => {
        if (!transferTarget || !transferUserId) return;
        setBusy(true);
        try {
            await transferMutation.mutateAsync({
                id: transferTarget.face_registration_id,
                userId: transferUserId,
            });
        } finally {
            setBusy(false);
        }
    };

    /* --- Render --- */

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
                        <ScanFace className="w-8 h-8 text-[#F0B429]" />
                        Face Registrations
                    </h1>
                    <p className="text-[#C7CEDB] text-sm mt-1">
                        Review registered faces and arbitrate takeover
                        requests.
                    </p>
                </div>
                <div className="relative flex gap-2">
                    {pendingCount > 0 && (
                        <span className="px-3 py-2 rounded-full bg-[#F0B429] text-[#16233F] text-xs font-bold flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {pendingCount} pending
                        </span>
                    )}
                    <Button
                        onClick={() => {
                            refetchRequests();
                            refetchRegistrations();
                            refetchPendingCount();
                        }}
                        variant="outline"
                        className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </header>

            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                <TabsList className="bg-[#E9ECF2] flex-wrap h-auto">
                    <TabsTrigger
                        value="requests"
                        className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        Takeover Requests
                        {pendingCount > 0 && (
                            <span className="ml-1 text-xs bg-[#C8202F] text-white px-2 py-0.5 rounded-full tabular-nums">
                                {pendingCount}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="registrations"
                        className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
                    >
                        <ScanFace className="w-4 h-4" />
                        Registered Faces
                    </TabsTrigger>
                </TabsList>

                {/* ==================== REQUESTS TAB ==================== */}
                <TabsContent value="requests" className="mt-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            className="flex h-10 rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                            value={requestStatus}
                            onChange={(e) => {
                                setRequestStatus(e.target.value);
                                setRequestPage(1);
                            }}
                        >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="all">All</option>
                        </select>
                    </div>

                    {requestsLoading && !requestsRes ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-14">
                            <CheckCircle className="w-12 h-12 text-[#1E8449] mx-auto mb-3" />
                            <p className="text-[#64748B]">
                                {requestStatus === 'pending'
                                    ? 'No pending takeover requests. All clear.'
                                    : 'No requests to show.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
                                <ul className="divide-y divide-[#EEF0F4]">
                                    {requests.map((r) => (
                                        <li
                                            key={r.request_id}
                                            className="flex flex-wrap items-center gap-4 px-4 py-4 hover:bg-[#F8F9FB] transition-colors border-l-4"
                                            style={{
                                                borderLeftColor:
                                                    r.status === 'pending'
                                                        ? '#F0B429'
                                                        : r.status ===
                                                            'approved'
                                                            ? '#1E8449'
                                                            : '#C8202F',
                                            }}
                                        >
                                            {/* Owner thumbnail */}
                                            <div className="w-14 h-16 rounded-md overflow-hidden bg-[#F5F6F8] flex-shrink-0">
                                                <FaceImage
                                                    rawUrl={
                                                        r.existing_front_image_url
                                                    }
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm text-[#64748B]">
                                                        Current owner
                                                    </span>
                                                    <span className="font-medium text-[#1F2937] truncate">
                                                        {
                                                            r.current_owner
                                                                ?.firstname
                                                        }{' '}
                                                        {
                                                            r.current_owner
                                                                ?.lastname
                                                        }
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                                    <span className="text-[#94A3B8]">
                                                        →
                                                    </span>
                                                    <span className="text-sm text-[#64748B]">
                                                        Requested by
                                                    </span>
                                                    <span className="font-medium text-[#1F2937] truncate">
                                                        {r.requester?.firstname}{' '}
                                                        {r.requester?.lastname}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-[#94A3B8] font-mono mt-1 truncate">
                                                    Device {r.device_id} ·
                                                    Similarity{' '}
                                                    {(
                                                        r.similarity * 100
                                                    ).toFixed(2)}
                                                    % ·{' '}
                                                    {new Date(
                                                        r.created_at,
                                                    ).toLocaleString()}
                                                </div>
                                            </div>

                                            <StatusBadge status={r.status} />

                                            <ActionButton
                                                icon={Eye}
                                                variant="info"
                                                onClick={() =>
                                                    setCompareRequest(r)
                                                }
                                            >
                                                Compare
                                            </ActionButton>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Pagination
                                currentPage={requestsMeta.current_page}
                                totalPages={requestsMeta.last_page}
                                onPageChange={setRequestPage}
                                totalItems={requestsMeta.total}
                                itemsPerPage={ITEMS_PER_PAGE}
                            />
                        </>
                    )}
                </TabsContent>

                {/* ==================== REGISTRATIONS TAB ==================== */}
                <TabsContent
                    value="registrations"
                    className="mt-0 space-y-4"
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[240px] max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                            <Input
                                placeholder="Search by name or email..."
                                value={regSearch}
                                onChange={(e) => {
                                    setRegSearch(e.target.value);
                                    setRegPage(1);
                                }}
                                className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]"
                            />
                            {regSearch && (
                                <button
                                    onClick={() => setRegSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <select
                            className="flex h-10 rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                            value={regStatus}
                            onChange={(e) => {
                                setRegStatus(e.target.value);
                                setRegPage(1);
                            }}
                        >
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                            <option value="all">All</option>
                        </select>
                    </div>

                    {registrationsLoading && !registrationsRes ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                        </div>
                    ) : registrations.length === 0 ? (
                        <div className="text-center py-14">
                            <ScanFace className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                            <p className="text-[#64748B]">
                                No face registrations to show.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {registrations.map((r) => (
                                    <article
                                        key={r.face_registration_id}
                                        className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
                                    >
                                        <div className="h-1.5 bg-[#F0B429]" />

                                        {/* Three-pose thumbnail grid */}
                                        <div className="grid grid-cols-3 gap-1 p-1 bg-[#F5F6F8]">
                                            {[
                                                r.front_image_url,
                                                r.left_image_url,
                                                r.right_image_url,
                                            ].map((rawUrl, i) => (
                                                <div
                                                    key={i}
                                                    className="aspect-square rounded overflow-hidden bg-white"
                                                >
                                                    <FaceImage
                                                        rawUrl={rawUrl}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-['Oswald'] text-base leading-tight text-[#1F2937] truncate">
                                                    {r.user?.firstname}{' '}
                                                    {r.user?.lastname}
                                                </p>
                                                {r.user?.role && (
                                                    <RoleBadge
                                                        role={r.user.role}
                                                    />
                                                )}
                                            </div>
                                            <p className="text-xs text-[#64748B] truncate font-mono">
                                                {r.user?.email}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2 text-[10px] text-[#94A3B8]">
                                                <span className="font-mono truncate">
                                                    {r.device_id || '—'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-[#94A3B8] mt-1">
                                                Registered{' '}
                                                {new Date(
                                                    r.registered_at,
                                                ).toLocaleDateString()}
                                            </p>

                                            {isAdmin() && r.is_active && (
                                                <div className="mt-3 pt-3 border-t border-dashed border-[#CBD5E1]">
                                                    <ActionButton
                                                        icon={
                                                            ArrowRightLeft
                                                        }
                                                        variant="warning"
                                                        onClick={() => {
                                                            setTransferTarget(
                                                                r,
                                                            );
                                                            setTransferUserId(
                                                                '',
                                                            );
                                                        }}
                                                    >
                                                        Transfer
                                                    </ActionButton>
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <Pagination
                                currentPage={
                                    registrationsMeta.current_page
                                }
                                totalPages={registrationsMeta.last_page}
                                onPageChange={setRegPage}
                                totalItems={registrationsMeta.total}
                                itemsPerPage={ITEMS_PER_PAGE}
                            />
                        </>
                    )}
                </TabsContent>
            </Tabs>

            {/* Compare modal */}
            <TakeoverCompareModal
                open={!!compareRequest}
                onClose={() => setCompareRequest(null)}
                request={compareRequest}
                onApprove={handleApprove}
                onReject={handleReject}
                busy={busy}
            />

            {/* Transfer modal (admin only) */}
            <Dialog
                open={!!transferTarget}
                onOpenChange={(v) => {
                    if (!v) {
                        setTransferTarget(null);
                        setTransferUserId('');
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-['Oswald'] text-[#16233F] flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-[#F0B429]" />
                            Transfer Face Ownership
                        </DialogTitle>
                    </DialogHeader>
                    {transferTarget && (
                        <div className="space-y-4">
                            <div className="rounded-lg bg-[#F8F9FA] p-3">
                                <p className="text-xs text-[#64748B]">
                                    Currently owned by
                                </p>
                                <p className="text-sm font-medium text-[#1F2937]">
                                    {transferTarget.user?.firstname}{' '}
                                    {transferTarget.user?.lastname}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-[#16233F] mb-1.5 block">
                                    Transfer to
                                </label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                                    value={transferUserId}
                                    onChange={(e) =>
                                        setTransferUserId(e.target.value)
                                    }
                                >
                                    <option value="">
                                        Select an enforcer…
                                    </option>
                                    {users
                                        .filter(
                                            (u) =>
                                                u.user_id !==
                                                transferTarget.user?.user_id,
                                        )
                                        .map((u) => (
                                            <option
                                                key={u.user_id}
                                                value={u.user_id}
                                            >
                                                {u.firstname} {u.lastname} (
                                                {u.email})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="rounded-lg bg-[#FBF1DC] border border-[#F0B429]/40 p-3 text-xs text-[#92600A] flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>
                                    The current owner's face flag will be
                                    turned off. They will need to register
                                    again on their next login.
                                </span>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button
                                    variant="outline"
                                    onClick={() => setTransferTarget(null)}
                                    disabled={busy}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleTransfer}
                                    disabled={busy || !transferUserId}
                                    className="flex-1 bg-[#1E8449] hover:bg-[#186B3B]"
                                >
                                    {busy ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        'Confirm Transfer'
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

export default FaceRegistrations;