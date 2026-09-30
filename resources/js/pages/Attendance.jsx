// web/src/pages/Attendance.jsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Pagination } from "../components/ui/Pagination";
import api from "../services/api";
import {
  Search,
  Calendar,
  Camera,
  RefreshCw,
  Filter,
  X,
  Loader2,
  User,
  Clock,
  MapPin,
  LocateFixed,
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

const Attendance = () => {
  const notify = useAlert();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoType, setPhotoType] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    enforcer_id: "",
    status: "",
  });
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState(null);
  const [mapAttendance, setMapAttendance] = useState(null);
  const [mapType, setMapType] = useState(null);

  const {
    data: attendanceResponse,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["attendance", page, filters],
    queryFn: () => {
      const params = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.enforcer_id) params.enforcer_id = filters.enforcer_id;
      if (filters.status) params.status = filters.status;
      return api.get("/attendance", {
        params: { ...params, page, per_page: ITEMS_PER_PAGE },
      });
    },
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  const attendances = getDataArray(attendanceResponse);
  const meta = getMeta(attendanceResponse);

  React.useEffect(() => {
    let count = 0;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    if (filters.enforcer_id) count++;
    if (filters.status) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  const formatLocationDisplay = (locationStr) => {
    if (!locationStr || locationStr === "N/A") return "—";
    if (locationStr.includes(",")) {
      const [lat, lng] = locationStr.split(",").map(Number);
      return `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    return `📍 ${locationStr}`;
  };

  const parseCoordinates = (locationStr) => {
    if (!locationStr || !locationStr.includes(",")) return null;
    const [lat, lng] = locationStr.split(",").map(Number);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  };

  const handleViewPhoto = (attendance, type) => {
    setSelectedAttendance(attendance);
    setPhotoType(type);
    setImageLoading(true);

    const photoPath =
      type === "in" ? attendance.time_in_photo : attendance.time_out_photo;

    if (photoPath) {
      const fullUrl = `${API_BASE_URL}/api/attendance/photo/${photoPath}`;
      setCurrentImageUrl(fullUrl);

      const img = new Image();
      img.onload = () => {
        setImageLoading(false);
        setShowPhotoModal(true);
      };
      img.onerror = () => {
        console.error("Image failed to load:", fullUrl);
        setImageLoading(false);
        setCurrentImageUrl("");
        notify.error("Photo not found on server.");
      };
      img.src = fullUrl;
    } else {
      notify.warning("No photo available for this attendance record.");
      setImageLoading(false);
    }
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

    setMapLocation(coords);
    setMapAttendance(attendance);
    setMapType(type);
    setShowMapModal(true);
  };

  const handleResetFilters = () => {
    setFilters({
      date_from: "",
      date_to: "",
      enforcer_id: "",
      status: "",
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      present: "bg-[#E5F2EA] text-[#1E8449]",
      late: "bg-[#FBF1DC] text-[#92600A]",
      absent: "bg-[#FBE7E9] text-[#C8202F]",
      on_leave: "bg-[#EEF1F5] text-[#3B5170]",
      half_day: "bg-[#FBEAE2] text-[#C2541F]",
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  const formatDateTime = (datetime) => {
    if (!datetime) return "—";
    return new Date(datetime).toLocaleString();
  };

  const formatTime = (datetime) => {
    if (!datetime) return "—";
    return new Date(datetime).toLocaleTimeString();
  };

  const filteredAttendances = attendances.filter(
    (att) =>
      att.enforcer?.firstname
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      att.enforcer?.lastname
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      att.status?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
            Attendance Monitoring
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            Track and manage enforcer attendance records
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-6 border-[#F0B429]/30 bg-[#FBF1DC]">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-['Oswald'] font-medium text-[#16233F]">
                Filter Attendance Records
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Date From
                </label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) =>
                    setFilters({ ...filters, date_from: e.target.value })
                  }
                  className="focus-visible:ring-[#F0B429]"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Date To
                </label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) =>
                    setFilters({ ...filters, date_to: e.target.value })
                  }
                  className="focus-visible:ring-[#F0B429]"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-[#1F2937]">
                  Status
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">All Status</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="on_leave">On Leave</option>
                  <option value="half_day">Half Day</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => {
                  refetch();
                  setShowFilters(false);
                }}
                className="bg-[#1E8449] hover:bg-[#186B3B]"
              >
                Apply Filters
              </Button>
              <Button
                onClick={handleResetFilters}
                variant="ghost"
                className="text-[#64748B]"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.date_from && (
            <span className="bg-[#E9ECF2] text-[#16233F] px-2 py-1 rounded-md text-xs flex items-center gap-1">
              From: {filters.date_from}
              <button
                onClick={() => setFilters({ ...filters, date_from: "" })}
                className="hover:text-[#C8202F]"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.date_to && (
            <span className="bg-[#E9ECF2] text-[#16233F] px-2 py-1 rounded-md text-xs flex items-center gap-1">
              To: {filters.date_to}
              <button
                onClick={() => setFilters({ ...filters, date_to: "" })}
                className="hover:text-[#C8202F]"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.status && (
            <span className="bg-[#E9ECF2] text-[#16233F] px-2 py-1 rounded-md text-xs flex items-center gap-1">
              Status: {filters.status}
              <button
                onClick={() => setFilters({ ...filters, status: "" })}
                className="hover:text-[#C8202F]"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            placeholder="Search by enforcer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 focus-visible:ring-[#F0B429]"
          />
        </div>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
            </div>
          ) : filteredAttendances.length === 0 ? (
            <div className="text-center py-8 text-[#64748B]">
              No attendance records found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Date
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Enforcer
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Time In
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Time Out
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Status
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Late
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Overtime
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendances.map((att) => (
                    <TableRow
                      key={att.attendance_id}
                      className="hover:bg-[#F8F9FA]"
                    >
                      <TableCell className="font-medium text-[#1F2937]">
                        {new Date(att.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">
                            {att.enforcer?.firstname?.[0]}
                            {att.enforcer?.lastname?.[0]}
                          </div>
                          <span className="text-[#1F2937]">
                            {att.enforcer?.firstname} {att.enforcer?.lastname}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-[#64748B]" />
                            <span className="text-[#1F2937]">
                              {formatTime(att.time_in)}
                            </span>
                          </div>
                          {att.time_in_location && (
                            <span className="text-xs text-[#64748B] flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {formatLocationDisplay(att.time_in_location)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {att.time_out ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-[#64748B]" />
                              <span className="text-[#1F2937]">
                                {formatTime(att.time_out)}
                              </span>
                            </div>
                            {att.time_out_location && (
                              <span className="text-xs text-[#64748B] flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {formatLocationDisplay(att.time_out_location)}
                              </span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            att.status,
                          )}`}
                        >
                          {att.status?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-[#1F2937]">
                        {att.late_minutes > 0 ? `${att.late_minutes} min` : "—"}
                      </TableCell>
                      <TableCell className="text-[#1F2937]">
                        {att.overtime_minutes > 0
                          ? `${att.overtime_minutes} min`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {att.time_in_photo && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPhoto(att, "in")}
                              className="text-xs border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                            >
                              <Camera className="w-3 h-3 mr-1" />
                              Time In
                            </Button>
                          )}
                          {att.time_out_photo && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPhoto(att, "out")}
                              className="text-xs border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
                            >
                              <Camera className="w-3 h-3 mr-1" />
                              Time Out
                            </Button>
                          )}
                          {att.time_in_location && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewOnMap(att, "in")}
                              className="text-xs border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
                              title="View Time In Location on Map"
                            >
                              <LocateFixed className="w-3 h-3 mr-1" />
                              Map
                            </Button>
                          )}
                          {!att.time_in_photo &&
                            !att.time_out_photo &&
                            !att.time_in_location && (
                              <span className="text-xs text-[#94A3B8]">
                                No data
                              </span>
                            )}
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

      {/* Photo Modal */}
      <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-['Oswald'] text-[#16233F]">
              {photoType === "in" ? "Time In Photo" : "Time Out Photo"}
            </DialogTitle>
          </DialogHeader>
          {selectedAttendance && currentImageUrl && (
            <div className="flex flex-col items-center">
              {imageLoading ? (
                <div className="flex justify-center items-center h-96">
                  <Loader2 className="w-12 h-12 animate-spin text-[#16233F]" />
                </div>
              ) : (
                <>
                  <img
                    src={currentImageUrl}
                    alt={`Time ${photoType} photo`}
                    className="w-full max-h-96 object-contain rounded-lg shadow-lg mb-4"
                    onError={(e) => {
                      console.error("Failed to load image:", currentImageUrl);
                      e.target.style.display = "none";
                    }}
                  />
                  <div className="w-full bg-[#F8F9FA] p-4 rounded-lg">
                    <p className="text-sm text-[#1F2937]">
                      <strong className="text-[#16233F]">Time:</strong>{" "}
                      {formatDateTime(
                        photoType === "in"
                          ? selectedAttendance.time_in
                          : selectedAttendance.time_out,
                      )}
                    </p>
                    <p className="text-sm text-[#1F2937] mt-1">
                      <strong className="text-[#16233F]">Enforcer:</strong>{" "}
                      {selectedAttendance.enforcer?.firstname}{" "}
                      {selectedAttendance.enforcer?.lastname}
                    </p>
                    <p className="text-sm text-[#1F2937]">
                      <strong className="text-[#16233F]">Date:</strong>{" "}
                      {new Date(selectedAttendance.date).toLocaleDateString()}
                    </p>
                    {photoType === "in" &&
                      selectedAttendance.time_in_location && (
                        <p className="text-sm text-[#1F2937] mt-1">
                          <strong className="text-[#16233F]">
                            📍 Location:
                          </strong>{" "}
                          {formatLocationDisplay(
                            selectedAttendance.time_in_location,
                          )}
                        </p>
                      )}
                    {photoType === "out" &&
                      selectedAttendance.time_out_location && (
                        <p className="text-sm text-[#1F2937] mt-1">
                          <strong className="text-[#16233F]">
                            📍 Location:
                          </strong>{" "}
                          {formatLocationDisplay(
                            selectedAttendance.time_out_location,
                          )}
                        </p>
                      )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Map Modal */}
      <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-['Oswald'] text-[#16233F]">
              {mapType === "in" ? "Time In Location" : "Time Out Location"}
            </DialogTitle>
          </DialogHeader>
          {mapLocation && mapAttendance && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F8F9FA] p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <strong className="text-[#16233F]">Enforcer:</strong>{" "}
                    {mapAttendance.enforcer?.firstname}{" "}
                    {mapAttendance.enforcer?.lastname}
                  </p>
                  <p className="text-sm">
                    <strong className="text-[#16233F]">Date:</strong>{" "}
                    {new Date(mapAttendance.date).toLocaleDateString()}
                  </p>
                  <p className="text-sm">
                    <strong className="text-[#16233F]">Time:</strong>{" "}
                    {formatDateTime(
                      mapType === "in"
                        ? mapAttendance.time_in
                        : mapAttendance.time_out,
                    )}
                  </p>
                  <p className="text-sm">
                    <strong className="text-[#16233F]">📍 Coordinates:</strong>{" "}
                    {mapLocation.lat.toFixed(6)}, {mapLocation.lng.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${mapLocation.lat},${mapLocation.lng}`}
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
                      mapType === "in"
                        ? mapAttendance.time_in_location
                        : mapAttendance.time_out_location,
                    )}
                  </p>
                </div>
              </div>

              <div className="h-[400px] w-full rounded-lg overflow-hidden border border-[#E9ECF2]">
                <MapContainer
                  key={`map-${mapLocation.lat}-${mapLocation.lng}`}
                  center={[mapLocation.lat, mapLocation.lng]}
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
                    position={[mapLocation.lat, mapLocation.lng]}
                    icon={attendanceIcon}
                  >
                    <Popup>
                      <div className="p-2 min-w-[180px]">
                        <p className="font-bold text-[#16233F]">
                          {mapType === "in" ? "Time In" : "Time Out"}
                        </p>
                        <p className="text-sm text-[#64748B]">
                          {mapAttendance.enforcer?.firstname}{" "}
                          {mapAttendance.enforcer?.lastname}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {new Date(
                            mapType === "in"
                              ? mapAttendance.time_in
                              : mapAttendance.time_out,
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