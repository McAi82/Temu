// web/src/pages/FaceRegistrations.jsx
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Pagination } from "../components/ui/Pagination";
import ActionButton from "../components/ui/ActionButton";
import { useAlert } from "../components/ui/AlertProvider";
import {
    getFaceRegistrations,
    deleteFaceRegistration,
    restoreFaceRegistration,
} from "../services/api";
import {
    Search,
    RefreshCw,
    Loader2,
    X,
    ScanFace,
    Info,
    Archive,
    ArchiveRestore,
} from "lucide-react";

const ITEMS_PER_PAGE = 20;

/* ------------------------------------------------------------------ */
/* Image URL helper                                                    */
/* ------------------------------------------------------------------ */

const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    "https://ivory-gerbil-502781.hostingersite.com";

const getImageUrl = (path) => {
    if (!path) return null;
    if (typeof path !== "string") return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;

    const cleaned = path.startsWith("/") ? path.slice(1) : path;
    if (cleaned.startsWith("storage/")) return `${API_BASE_URL}/${cleaned}`;
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
        admin: "bg-[#16233F] text-white",
        staff: "bg-[#EEF1F5] text-[#3B5170]",
        enforcer: "bg-[#E5F2EA] text-[#1E8449]",
    };
    return (
        <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                map[role] || "bg-gray-100 text-gray-700"
            }`}
        >
            {role || "—"}
        </span>
    );
};

const FaceImage = ({ rawUrl, alt = "", className = "", fallback = null }) => {
    const url = getImageUrl(rawUrl);
    if (!url) return fallback;
    return (
        <img
            src={url}
            alt={alt}
            className={className}
            onError={(e) => {
                e.target.style.display = "none";
            }}
        />
    );
};

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

const FaceRegistrations = () => {
    const queryClient = useQueryClient();
    const notify = useAlert();
    const [regPage, setRegPage] = useState(1);
    const [regStatus, setRegStatus] = useState("active");
    const [regSearch, setRegSearch] = useState("");

    /* --- Queries --- */

    const {
        data: registrationsRes,
        isLoading: registrationsLoading,
        refetch: refetchRegistrations,
    } = useQuery({
        queryKey: ["face-registrations", regPage, regStatus, regSearch],
        queryFn: () =>
            getFaceRegistrations(regPage, ITEMS_PER_PAGE, {
                status: regStatus,
                search: regSearch || undefined,
            }),
        keepPreviousData: true,
        staleTime: 1000 * 60,
    });

    /* --- Archive --- */

    const archiveMutation = useMutation({
        mutationFn: deleteFaceRegistration,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["face-registrations"] });
            queryClient.invalidateQueries({ queryKey: ["archives"] });
            notify.success("Face registration archived successfully");
        },
        onError: (err) => {
            notify.error(
                err.response?.data?.message ||
                    "Failed to archive face registration",
            );
        },
    });

    const restoreMutation = useMutation({
        mutationFn: restoreFaceRegistration,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["face-registrations"] });
            notify.success("Face registration restored successfully");
        },
        onError: (err) => {
            notify.error(
                err.response?.data?.message ||
                    "Failed to restore face registration",
            );
        },
    });

    const handleRestore = async (id) => {
        const ok = await notify.confirm(
            "Restore this face registration? The user will be able to use face verification again.",
            { confirmText: "Restore" },
        );
        if (ok) restoreMutation.mutate(id);
    };

    const handleArchive = async (id) => {
        const ok = await notify.confirm("Archive this face registration?", {
            confirmText: "Archive",
            destructive: true,
        });
        if (ok) archiveMutation.mutate(id);
    };

    const registrations = getDataArray(registrationsRes);
    const registrationsMeta = getMeta(registrationsRes);

    /* --- Render --- */

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
                    <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight flex items-center gap-3">
                        <ScanFace className="w-8 h-8 text-[#F0B429]" />
                        Face Registrations
                    </h1>
                    <p className="text-[#C7CEDB] text-sm mt-1">
                        Review registered faces.
                    </p>
                </div>
                <div className="relative flex gap-2">
                    <Button
                        onClick={() => refetchRegistrations()}
                        variant="outline"
                        disabled={registrationsLoading}
                        className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
                    >
                        <RefreshCw
                            className={`w-4 h-4 mr-2 ${
                                registrationsLoading ? "animate-spin" : ""
                            }`}
                        />
                        Refresh
                    </Button>
                </div>
            </header>

            <div className="space-y-4">
                {/* Toolbar */}
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
                                onClick={() => setRegSearch("")}
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

                {/* Body */}
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
                                                {r.user?.firstname}{" "}
                                                {r.user?.lastname}
                                            </p>
                                            {r.user?.role && (
                                                <RoleBadge role={r.user.role} />
                                            )}
                                        </div>
                                        <p className="text-xs text-[#64748B] truncate font-mono">
                                            {r.user?.email}
                                        </p>
                                        <div className="mt-2 flex items-center gap-2 text-[10px] text-[#94A3B8]">
                                            <span className="font-mono truncate">
                                                {r.device_id || "—"}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[#94A3B8] mt-1">
                                            Registered{" "}
                                            {new Date(
                                                r.registered_at,
                                            ).toLocaleDateString()}
                                        </p>

                                        <div className="mt-3 pt-3 border-t border-dashed border-[#CBD5E1] flex items-center justify-between gap-2">
                                            {r.is_active === false ? (
                                                <>
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#F1F5F9] text-[#64748B]">
                                                        Archived
                                                    </span>
                                                    {r.can_restore !==
                                                        false && (
                                                        <ActionButton
                                                            icon={
                                                                ArchiveRestore
                                                            }
                                                            variant="primary"
                                                            onClick={() =>
                                                                handleRestore(
                                                                    r.face_registration_id,
                                                                )
                                                            }
                                                            disabled={
                                                                restoreMutation.isPending
                                                            }
                                                        >
                                                            Restore
                                                        </ActionButton>
                                                    )}
                                                </>
                                            ) : (
                                                <ActionButton
                                                    icon={Archive}
                                                    variant="danger"
                                                    onClick={() =>
                                                        handleArchive(
                                                            r.face_registration_id,
                                                        )
                                                    }
                                                    disabled={
                                                        archiveMutation.isPending
                                                    }
                                                >
                                                    Archive
                                                </ActionButton>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <Pagination
                            currentPage={registrationsMeta.current_page}
                            totalPages={registrationsMeta.last_page}
                            onPageChange={setRegPage}
                            totalItems={registrationsMeta.total}
                            itemsPerPage={ITEMS_PER_PAGE}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default FaceRegistrations;
