// web/src/components/map/DutyMap.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  ZoomControl,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Search,
  RefreshCw,
  Crosshair,
  Loader2,
  X,
  Check,
  AlertCircle,
  MousePointer,
  Clock,
  Wifi,
  WifiOff,
  LocateFixed,
  Satellite,
  Layers,
  Maximize2,
  Minimize2,
  ChevronRight,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  MapPinned,
  Navigation,
} from "lucide-react";
import { useAlert } from "../ui/AlertProvider";

// ==================== LEAFLET SETUP ====================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const draggableIcon = new L.Icon({
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

const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    label: "Satellite",
    icon: Satellite,
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    label: "Street",
    icon: Layers,
  },
};

// ==================== MAP HELPERS ====================

const MapEventHandler = ({
  onMapClick,
  onMarkerDrag,
  markerPosition,
  setMarkerPosition,
  isPlacingMode,
}) => {
  const map = useMap();
  const draggableMarkerRef = useRef(null);

  useMapEvents({
    click(e) {
      if (!isPlacingMode) return;
      const { lat, lng } = e.latlng;
      setMarkerPosition({ lat, lng });
      if (onMapClick) onMapClick({ lat, lng });

      const pulse = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "click-marker",
          html: '<div style="background: #16233F; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 20px rgba(22,35,63,0.6);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map);
      setTimeout(() => map.removeLayer(pulse), 1000);
    },
  });

  useEffect(() => {
    if (!markerPosition || !map) return;
    if (draggableMarkerRef.current) {
      map.removeLayer(draggableMarkerRef.current);
      draggableMarkerRef.current = null;
    }

    const marker = L.marker([markerPosition.lat, markerPosition.lng], {
      icon: draggableIcon,
      draggable: true,
    }).addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      const newPos = { lat: pos.lat, lng: pos.lng };
      setMarkerPosition(newPos);
      if (onMarkerDrag) onMarkerDrag(newPos);
    });

    draggableMarkerRef.current = marker;

    return () => {
      if (draggableMarkerRef.current) {
        map.removeLayer(draggableMarkerRef.current);
        draggableMarkerRef.current = null;
      }
    };
  }, [markerPosition, map]);

  return null;
};

const FlyToTarget = ({ target, zoom = 16, requestId }) => {
  const map = useMap();
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (!target || target.lat == null || target.lng == null) return;
    if (requestId === lastIdRef.current) return;
    lastIdRef.current = requestId;
    map.flyTo([target.lat, target.lng], zoom, {
      animate: true,
      duration: 1.2,
    });
  }, [target, zoom, map, requestId]);

  return null;
};

const InvalidateOnResize = () => {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 200);
    const handler = () => map.invalidateSize();
    window.addEventListener("resize", handler);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handler);
    };
  }, [map]);
  return null;
};

const EnforcerMarkers = ({ enforcers, onSelectEnforcer, onLocate }) => {
  const map = useMap();
  const markersRef = useRef({});
  const circlesRef = useRef({});

  useEffect(() => {
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    Object.values(circlesRef.current).forEach((c) => map.removeLayer(c));
    markersRef.current = {};
    circlesRef.current = {};

    enforcers.forEach((enforcer) => {
      if (!enforcer.latitude || !enforcer.longitude) return;

      const isOnline =
        enforcer.is_online &&
        enforcer.last_updated &&
        new Date(enforcer.last_updated) >
        new Date(Date.now() - 2 * 60 * 1000);

      const markerHtml = `
        <div class="enforcer-marker ${isOnline ? "enforcer-marker-online" : "enforcer-marker-offline"
        }">
          <div class="enforcer-marker-bubble ${isOnline ? "enforcer-marker-bubble-online" : "enforcer-marker-bubble-offline"
        }">
            ${enforcer.firstname?.[0] || "E"}${enforcer.lastname?.[0] || ""}
          </div>
          <div class="enforcer-marker-dot ${isOnline ? "enforcer-marker-dot-online" : "enforcer-marker-dot-offline"
        }"></div>
          ${isOnline ? '<div class="enforcer-marker-pulse"></div>' : ""}
        </div>
      `;

      const marker = L.marker([enforcer.latitude, enforcer.longitude], {
        icon: L.divIcon({
          className: "enforcer-marker-wrapper",
          html: markerHtml,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        riseOnHover: true,
      }).addTo(map);

      const popupContent = `
        <div class="enforcer-popup-content">
          <div class="enforcer-popup-header">
            <div class="enforcer-popup-avatar ${isOnline ? "online" : "offline"}">
              ${enforcer.firstname?.[0] || "E"}${enforcer.lastname?.[0] || ""}
            </div>
            <div class="enforcer-popup-name-wrap">
              <div class="enforcer-popup-name">${enforcer.firstname} ${enforcer.lastname}</div>
              <div class="enforcer-popup-role">${enforcer.role || "Enforcer"}</div>
            </div>
            <div class="enforcer-popup-status-dot ${isOnline ? "online" : "offline"}"></div>
          </div>
          <div class="enforcer-popup-meta">
            <div class="enforcer-popup-row">
              <span class="enforcer-popup-label">Status</span>
              <span class="enforcer-popup-value ${isOnline ? "online" : "offline"}">
                ${isOnline ? "● Online" : "● Offline"}
              </span>
            </div>
            <div class="enforcer-popup-row">
              <span class="enforcer-popup-label">Updated</span>
              <span class="enforcer-popup-value">${enforcer.last_updated
          ? new Date(enforcer.last_updated).toLocaleTimeString()
          : "N/A"
        }</span>
            </div>
            <div class="enforcer-popup-row">
              <span class="enforcer-popup-label">Coords</span>
              <span class="enforcer-popup-value mono">${enforcer.latitude.toFixed(
          5,
        )}, ${enforcer.longitude.toFixed(5)}</span>
            </div>
            ${enforcer.accuracy
          ? `<div class="enforcer-popup-row">
                    <span class="enforcer-popup-label">Accuracy</span>
                    <span class="enforcer-popup-value">±${enforcer.accuracy.toFixed(0)}m</span>
                  </div>`
          : ""
        }
          </div>
          <button class="enforcer-popup-btn" onclick="window.__dutyMapLocate(${enforcer.user_id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
            Center on Map
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 280,
        className: "enforcer-popup",
        closeButton: true,
      });

      marker.on("click", () => {
        if (onSelectEnforcer) onSelectEnforcer(enforcer);
      });

      markersRef.current[enforcer.user_id] = marker;

      if (isOnline && enforcer.accuracy) {
        const circle = L.circle(
          [enforcer.latitude, enforcer.longitude],
          {
            radius: enforcer.accuracy || 50,
            color: "#F0B429",
            fillColor: "#F0B429",
            fillOpacity: 0.08,
            weight: 1,
            opacity: 0.4,
          },
        ).addTo(map);
        circlesRef.current[enforcer.user_id] = circle;
      }
    });

    window.__dutyMapLocate = (id) => onLocate && onLocate(id);

    return () => {
      delete window.__dutyMapLocate;
    };
  }, [enforcers, map, onSelectEnforcer, onLocate]);

  useEffect(() => {
    return () => {
      Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
      Object.values(circlesRef.current).forEach((c) => map.removeLayer(c));
    };
  }, [map]);

  return null;
};

// ==================== MAIN COMPONENT ====================

const DutyMap = () => {
  const notify = useAlert();

  const [enforcers, setEnforcers] = useState([]);
  const [dutyLocations, setDutyLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedEnforcer, setSelectedEnforcer] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  const [tileLayer, setTileLayer] = useState("satellite");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDuty, setEditingDuty] = useState(null);
  const [isPlacingMode, setIsPlacingMode] = useState(false);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius: 100,
  });

  const mapCenter = useMemo(() => [8.558004, 124.524832], []);
  const mapZoom = 15;

  const fetchEnforcerLocations = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/location/active", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (res.ok) return await res.json();
      return [];
    } catch (err) {
      console.error("Error fetching enforcer locations:", err);
      return [];
    }
  }, []);

  const fetchEnforcers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users?role=enforcer", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      const list = json.data || [];
      const locations = await fetchEnforcerLocations();

      const merged = list.map((enforcer) => {
        const loc = locations.find((l) => l.enforcer_id === enforcer.user_id);
        return {
          ...enforcer,
          latitude: loc?.latitude ?? null,
          longitude: loc?.longitude ?? null,
          accuracy: loc?.accuracy ?? null,
          speed: loc?.speed ?? null,
          is_online: loc?.is_online ?? false,
          last_updated: loc?.last_updated ?? null,
        };
      });
      setEnforcers(merged);
      setLastSync(new Date());
    } catch (err) {
      console.error("Error fetching enforcers:", err);
    }
  }, [fetchEnforcerLocations]);

  const fetchDutyLocations = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/duty-locations", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      setDutyLocations(json.data || []);
    } catch (err) {
      console.error("Error fetching duty locations:", err);
    }
  }, []);

  const fetchData = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      await Promise.all([fetchEnforcers(), fetchDutyLocations()]);
      setLoading(false);
      setRefreshing(false);
    },
    [fetchEnforcers, fetchDutyLocations],
  );

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchEnforcers(), 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchEnforcers]);

  const onlineEnforcers = useMemo(
    () => enforcers.filter((e) => e.is_online && e.latitude),
    [enforcers],
  );
  const offlineEnforcers = useMemo(
    () => enforcers.filter((e) => !e.is_online || !e.latitude),
    [enforcers],
  );

  const filterMatches = (list) => {
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(
      (e) =>
        `${e.firstname} ${e.lastname}`.toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q),
    );
  };

  const visibleOnline =
    statusFilter === "offline" ? [] : filterMatches(onlineEnforcers);
  const visibleOffline =
    statusFilter === "online" ? [] : filterMatches(offlineEnforcers);

  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return dutyLocations;
    const q = searchTerm.toLowerCase();
    return dutyLocations.filter(
      (loc) =>
        loc.name?.toLowerCase().includes(q) ||
        loc.address?.toLowerCase().includes(q),
    );
  }, [dutyLocations, searchTerm]);

  const handleLocateEnforcer = (enforcer) => {
    if (!enforcer?.latitude || !enforcer?.longitude) return;
    setFlyTarget({
      lat: enforcer.latitude,
      lng: enforcer.longitude,
      requestId: Date.now() + Math.random(),
    });
    setSelectedEnforcer(enforcer);
  };

  const handleLocateEnforcerById = (id) => {
    const enforcer = enforcers.find((e) => e.user_id === id);
    if (enforcer) handleLocateEnforcer(enforcer);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation)
      return notify.warning("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTarget({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          requestId: Date.now() + Math.random(),
        });
      },
      () => notify.error("Unable to get your location"),
      { enableHighAccuracy: true },
    );
  };

  const openAddDialog = () => {
    setEditingDuty(null);
    setFormData({ name: "", address: "", latitude: "", longitude: "", radius: 100 });
    setMarkerPosition(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (location) => {
    setEditingDuty(location);
    setFormData({
      name: location.name || "",
      address: location.address || "",
      latitude: location.latitude ?? "",
      longitude: location.longitude ?? "",
      radius: location.radius || 100,
    });
    setMarkerPosition({
      lat: Number(location.latitude),
      lng: Number(location.longitude),
    });
    setIsDialogOpen(true);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation)
      return notify.warning("Geolocation not supported");
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMarkerPosition({ lat: latitude, lng: longitude });
        setFormData((f) => ({
          ...f,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
        setIsGettingLocation(false);
      },
      () => {
        notify.error("Unable to get your location. Check browser permissions.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const handleMapClick = ({ lat, lng }) => {
    setFormData((f) => ({
      ...f,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  };

  const handleMarkerDrag = ({ lat, lng }) => {
    setFormData((f) => ({
      ...f,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  };

  const handleSubmitDuty = async (e) => {
    e.preventDefault();
    if (!formData.latitude || !formData.longitude) {
      return notify.warning("Please select a location on the map first.");
    }

    try {
      const token = localStorage.getItem("token");
      const isEdit = !!editingDuty;
      const url = isEdit
        ? `/api/duty-locations/${editingDuty.id}`
        : "/api/duty-locations";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          radius: parseInt(formData.radius) || 100,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.message ||
          (data.errors ? Object.values(data.errors).flat().join("\n") : "Failed");
        return notify.error(msg);
      }

      await fetchDutyLocations();
      setIsDialogOpen(false);
      setIsPlacingMode(false);
      notify.success(isEdit ? "Duty location updated." : "Duty location added.");
    } catch (err) {
      console.error(err);
      notify.error("Failed to save duty location.");
    }
  };

  const handleDeleteDuty = async (id) => {
    const ok = await notify.confirm("Delete this duty location?", {
      destructive: true,
      confirmText: "Delete",
    });
    if (!ok) return;

    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/duty-locations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchDutyLocations();
      notify.success("Duty location deleted.");
    } catch (err) {
      console.error(err);
      notify.error("Failed to delete duty location.");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#16233F]" />
          <span className="text-[#64748B] font-['Inter']">
            Loading map data...
          </span>
        </div>
      </div>
    );
  }

  const ActiveTile = TILE_LAYERS[tileLayer];

  return (
    <div className="space-y-4">
      <style>{mapStyles}</style>

      {/* ---------- TOP HEADER ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
            Duty Map
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            Live enforcer tracking and duty location management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-white overflow-hidden">
            {Object.entries(TILE_LAYERS).map(([key, layer]) => {
              const Icon = layer.icon;
              const active = tileLayer === key;
              return (
                <button
                  key={key}
                  onClick={() => setTileLayer(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${active
                    ? "bg-[#16233F] text-white"
                    : "text-[#64748B] hover:bg-[#F5F6F8]"
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {layer.label}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={openAddDialog}
            className="bg-[#1E8449] hover:bg-[#186B3B]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Duty Location
          </Button>
        </div>
      </div>

      {/* ---------- STATS STRIP ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Wifi}
          label="Online Enforcers"
          value={onlineEnforcers.length}
          accent="#1E8449"
          tint="#E5F2EA"
        />
        <StatCard
          icon={WifiOff}
          label="Offline Enforcers"
          value={offlineEnforcers.length}
          accent="#64748B"
          tint="#F1F5F9"
        />
        <StatCard
          icon={MapPinned}
          label="Duty Locations"
          value={dutyLocations.length}
          accent="#92600A"
          tint="#FBF1DC"
        />
        <StatCard
          icon={Clock}
          label="Last Sync"
          value={lastSync ? lastSync.toLocaleTimeString() : "—"}
          accent="#16233F"
          tint="#E9ECF2"
          small
        />
      </div>

      {/* ---------- MAIN GRID ---------- */}
      <div
        className={`grid gap-4 transition-all duration-300 ${sidebarOpen ? "lg:grid-cols-[1fr_360px]" : "grid-cols-1"
          }`}
      >
        {/* ---------- MAP PANEL ---------- */}
        <div>
          <Card className="overflow-hidden">
            <CardContent className="p-0 relative">
              <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen((s) => !s)}
                  className="bg-white/95 backdrop-blur border shadow-md rounded-lg px-3 py-2 text-xs font-medium text-[#16233F] hover:bg-white flex items-center gap-1.5"
                  title={sidebarOpen ? "Hide panel" : "Show panel"}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="w-4 h-4" />
                  ) : (
                    <PanelLeftOpen className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {sidebarOpen ? "Hide" : "Show"} panel
                  </span>
                </button>
              </div>

              <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
                <button
                  onClick={handleLocateMe}
                  className="bg-white/95 backdrop-blur border shadow-md rounded-lg p-2 hover:bg-white"
                  title="Center on my location"
                >
                  <Crosshair className="w-4 h-4 text-[#16233F]" />
                </button>
                <button
                  onClick={() => setIsFullscreen((v) => !v)}
                  className="bg-white/95 backdrop-blur border shadow-md rounded-lg p-2 hover:bg-white"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-[#16233F]" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-[#16233F]" />
                  )}
                </button>
              </div>

              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] hidden md:flex">
                <div className="bg-[#16233F]/85 text-white text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <MousePointer className="w-3 h-3" />
                  Click the map to place a duty marker
                </div>
              </div>

              <div
                className={`w-full ${isFullscreen ? "h-[calc(100vh-120px)]" : "h-[620px]"
                  }`}
              >
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                  scrollWheelZoom
                >
                  <TileLayer
                    key={tileLayer}
                    attribution={ActiveTile.attribution}
                    url={ActiveTile.url}
                  />
                  <ZoomControl position="bottomright" />
                  <InvalidateOnResize />

                  <MapEventHandler
                    onMapClick={handleMapClick}
                    onMarkerDrag={handleMarkerDrag}
                    markerPosition={markerPosition}
                    setMarkerPosition={setMarkerPosition}
                    isPlacingMode={isPlacingMode}
                  />

                  {flyTarget && (
                    <FlyToTarget
                      target={{ lat: flyTarget.lat, lng: flyTarget.lng }}
                      zoom={16}
                      requestId={flyTarget.requestId}
                    />
                  )}

                  <EnforcerMarkers
                    enforcers={enforcers}
                    onSelectEnforcer={setSelectedEnforcer}
                    onLocate={handleLocateEnforcerById}
                  />

                  {filteredLocations.map((location) => (
                    <React.Fragment key={`duty-${location.id}`}>
                      <Marker
                        position={[location.latitude, location.longitude]}
                        icon={L.divIcon({
                          className: "duty-marker-wrapper",
                          html: `
                            <div class="duty-marker">
                              <div class="duty-marker-pin">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                  <circle cx="12" cy="10" r="3"/>
                                </svg>
                              </div>
                            </div>
                          `,
                          iconSize: [32, 40],
                          iconAnchor: [16, 40],
                        })}
                      >
                        <Popup>
                          <div className="p-1 min-w-[220px]">
                            <div className="flex items-start gap-2 mb-2">
                              <div className="w-8 h-8 rounded-lg bg-[#FBF1DC] flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-4 h-4 text-[#92600A]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-[#16233F] text-sm truncate">
                                  {location.name}
                                </h3>
                                {location.address && (
                                  <p className="text-xs text-[#64748B] mt-0.5">
                                    {location.address}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-[11px] font-mono text-[#64748B] bg-[#F5F6F8] rounded p-1.5 mb-2">
                              {location.latitude.toFixed(5)},{" "}
                              {location.longitude.toFixed(5)}
                            </div>
                            {location.radius > 0 && (
                              <div className="text-[11px] text-[#64748B] mb-2">
                                Radius: {location.radius}m
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => openEditDialog(location)}
                                className="flex-1 bg-[#16233F] text-white text-xs py-1.5 rounded hover:bg-[#0F1A2E]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDuty(location.id)}
                                className="flex-1 bg-[#FBE7E9] text-[#C8202F] text-xs py-1.5 rounded hover:bg-[#F5D0D4]"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>

                      {location.radius > 0 && (
                        <Circle
                          center={[location.latitude, location.longitude]}
                          radius={location.radius}
                          pathOptions={{
                            color: "#F0B429",
                            fillColor: "#F0B429",
                            fillOpacity: 0.12,
                            weight: 1.5,
                          }}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </MapContainer>
              </div>

              <div className="absolute bottom-3 left-3 z-[999] bg-white/95 backdrop-blur border shadow-md rounded-lg px-3 py-2 flex items-center gap-3 text-[11px] font-medium text-[#475569]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16233F] inline-block" />
                  Enforcer
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E8449] inline-block" />
                  Online
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F0B429] inline-block" />
                  Duty Zone
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------- SIDEBAR ---------- */}
        {sidebarOpen && (
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-[#F8F9FA]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#16233F]" />
                    <h3 className="font-['Oswald'] font-medium text-[#16233F] text-sm">
                      Enforcers
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    {onlineEnforcers.length} / {enforcers.length}
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                  <Input
                    placeholder="Search enforcers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {[
                    { key: "all", label: "All", count: enforcers.length },
                    { key: "online", label: "Online", count: onlineEnforcers.length },
                    { key: "offline", label: "Offline", count: offlineEnforcers.length },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      onClick={() => setStatusFilter(chip.key)}
                      className={`flex-1 text-[11px] px-2 py-1 rounded-md border font-medium transition-colors ${statusFilter === chip.key
                        ? "bg-[#16233F] text-white border-[#16233F]"
                        : "bg-white text-[#64748B] border-[#E9ECF2] hover:bg-[#F5F6F8]"
                        }`}
                    >
                      {chip.label} ({chip.count})
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[340px] overflow-y-auto p-3 space-y-4">
                {visibleOnline.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[#1E8449] mb-2 flex items-center gap-1.5">
                      <Wifi className="w-3 h-3" />
                      Online · {visibleOnline.length}
                    </p>
                    <div className="space-y-1.5">
                      {visibleOnline.map((e) => (
                        <EnforcerRow
                          key={`on-${e.user_id}`}
                          enforcer={e}
                          online
                          active={selectedEnforcer?.user_id === e.user_id}
                          onClick={() => handleLocateEnforcer(e)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {visibleOffline.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-2 flex items-center gap-1.5">
                      <WifiOff className="w-3 h-3" />
                      Offline / No Location · {visibleOffline.length}
                    </p>
                    <div className="space-y-1.5">
                      {visibleOffline.map((e) => (
                        <EnforcerRow
                          key={`off-${e.user_id}`}
                          enforcer={e}
                          online={false}
                          active={selectedEnforcer?.user_id === e.user_id}
                          onClick={() => handleLocateEnforcer(e)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {visibleOnline.length === 0 && visibleOffline.length === 0 && (
                  <div className="text-center py-6">
                    <Search className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    <p className="text-xs text-[#94A3B8]">
                      No enforcers match your filter
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-[#F8F9FA] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-[#92600A]" />
                  <h3 className="font-['Oswald'] font-medium text-[#16233F] text-sm">
                    Duty Locations
                  </h3>
                </div>
                <span className="text-[11px] text-[#64748B]">
                  {filteredLocations.length}
                </span>
              </div>

              <div className="max-h-[260px] overflow-y-auto p-3 space-y-2">
                {filteredLocations.map((loc) => (
                  <div
                    key={`loc-${loc.id}`}
                    className="group border border-[#E9ECF2] rounded-lg p-2.5 hover:border-[#F0B429] hover:bg-[#FFFBF0] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <MapPin className="w-3.5 h-3.5 text-[#F0B429] flex-shrink-0" />
                          <p className="text-xs font-medium text-[#1F2937] truncate">
                            {loc.name}
                          </p>
                        </div>
                        <p className="text-[10px] font-mono text-[#94A3B8] truncate">
                          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </p>
                        {loc.radius > 0 && (
                          <p className="text-[10px] text-[#94A3B8]">
                            Radius {loc.radius}m
                          </p>
                        )}
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditDialog(loc)}
                          className="p-1 rounded hover:bg-[#E9ECF2]"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3 text-[#16233F]" />
                        </button>
                        <button
                          onClick={() => handleDeleteDuty(loc.id)}
                          className="p-1 rounded hover:bg-[#FBE7E9]"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 text-[#C8202F]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredLocations.length === 0 && (
                  <div className="text-center py-6">
                    <MapPinned className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    <p className="text-xs text-[#94A3B8] mb-3">
                      {dutyLocations.length === 0
                        ? "No duty locations yet"
                        : "No matches for your search"}
                    </p>
                    {dutyLocations.length === 0 && (
                      <button
                        onClick={openAddDialog}
                        className="text-xs text-[#1E8449] font-medium hover:underline"
                      >
                        + Add your first duty location
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ---------- SELECTED ENFORCER DETAIL ---------- */}
      {selectedEnforcer && (
        <EnforcerDetailCard
          enforcer={selectedEnforcer}
          onClose={() => setSelectedEnforcer(null)}
          onLocate={() => handleLocateEnforcer(selectedEnforcer)}
          onCopy={(text) => copyToClipboard(text)}
        />
      )}

      {/* ---------- ADD / EDIT DUTY DIALOG ---------- */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setIsPlacingMode(false);
            setMarkerPosition(null);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="font-['Oswald'] text-[#16233F] text-lg">
              {editingDuty ? "Edit Duty Location" : "Add Duty Location"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-3 bg-[#FBF1DC] border-b border-[#F0B429]/30">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#92600A] mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs text-[#92600A] leading-relaxed">
                <p className="font-semibold mb-0.5">
                  Pick a location using any method:
                </p>
                <p>
                  <span className="font-mono bg-white/60 px-1 rounded">
                    1
                  </span>{" "}
                  Search address,{" "}
                  <span className="font-mono bg-white/60 px-1 rounded">
                    2
                  </span>{" "}
                  Click the map, or{" "}
                  <span className="font-mono bg-white/60 px-1 rounded">
                    3
                  </span>{" "}
                  Use "My Location."
                </p>
              </div>
            </div>
          </div>

          {isPlacingMode && (
            <div className="px-6 pt-4">
              <div className="rounded-lg overflow-hidden border border-[#E9ECF2] h-48 relative">
                <MapContainer
                  center={
                    markerPosition
                      ? [markerPosition.lat, markerPosition.lng]
                      : mapCenter
                  }
                  zoom={16}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution={ActiveTile.attribution}
                    url={ActiveTile.url}
                  />
                  <MapEventHandler
                    onMapClick={handleMapClick}
                    onMarkerDrag={handleMarkerDrag}
                    markerPosition={markerPosition}
                    setMarkerPosition={setMarkerPosition}
                    isPlacingMode
                  />
                  <InvalidateOnResize />
                </MapContainer>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitDuty} className="px-6 py-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-[#1F2937] mb-1.5 block">
                Search location
              </label>
              <LocationSearchInput
                onSelect={(result) => {
                  setFormData((f) => ({
                    ...f,
                    name: f.name || result.name,
                    address: result.address,
                    latitude: result.lat.toFixed(6),
                    longitude: result.lng.toFixed(6),
                  }));
                  setMarkerPosition({ lat: result.lat, lng: result.lng });
                  setIsPlacingMode(true);
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsPlacingMode((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-colors text-sm font-medium ${isPlacingMode
                ? "border-[#1E8449] bg-[#E5F2EA] text-[#1E8449]"
                : "border-dashed border-[#CBD5E1] bg-[#F8F9FA] text-[#64748B] hover:border-[#16233F] hover:text-[#16233F]"
                }`}
            >
              <span className="flex items-center gap-2">
                <MousePointer className="w-4 h-4" />
                {isPlacingMode
                  ? "Click on the map to adjust location"
                  : "Or place a pin on the map"}
              </span>
              {isPlacingMode ? (
                <Check className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useMyLocation}
                disabled={isGettingLocation}
                className="flex-1 border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
              >
                {isGettingLocation ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Crosshair className="w-4 h-4 mr-2" />
                )}
                Use My Location
              </Button>
              {markerPosition && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMarkerPosition(null);
                    setFormData((f) => ({
                      ...f,
                      latitude: "",
                      longitude: "",
                    }));
                  }}
                  className="text-[#64748B]"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {formData.latitude && formData.longitude && (
              <div className="bg-[#E5F2EA] border border-[#1E8449]/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-[#1E8449] text-xs font-medium mb-1">
                  <Check className="w-3.5 h-3.5" />
                  Location selected
                </div>
                <div className="font-mono text-xs text-[#1E8449] flex items-center justify-between">
                  <span>
                    {formData.latitude}, {formData.longitude}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(`${formData.latitude},${formData.longitude}`)
                    }
                    className="text-[#1E8449] hover:text-[#0F5A2E]"
                    title="Copy coordinates"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#1F2937] mb-1.5 block">
                  Location name *
                </label>
                <Input
                  placeholder="e.g., City Hall, Main Intersection"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#1F2937] mb-1.5 block">
                  Address
                </label>
                <Input
                  placeholder="Street or landmark"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-xs font-medium text-[#1F2937] mb-1.5 block">
                    Latitude *
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={formData.latitude}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, latitude: e.target.value }))
                    }
                    required
                    className="font-mono text-xs"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-xs font-medium text-[#1F2937] mb-1.5 block">
                    Longitude *
                  </label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, longitude: e.target.value }))
                    }
                    required
                    className="font-mono text-xs"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-xs font-medium text-[#1F2937] mb-1.5 block">
                    Radius (m)
                  </label>
                  <Input
                    type="number"
                    value={formData.radius}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, radius: e.target.value }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#1E8449] hover:bg-[#186B3B]"
                disabled={!formData.latitude || !formData.longitude}
              >
                {editingDuty ? "Save Changes" : "Add Location"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

const StatCard = ({ icon: Icon, label, value, accent, tint, small }) => (
  <div className="bg-white rounded-xl border border-[#E9ECF2] p-3 flex items-center gap-3">
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: tint }}
    >
      <Icon className="w-5 h-5" style={{ color: accent }} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-medium truncate">
        {label}
      </p>
      <p
        className={`font-bold text-[#1F2937] truncate ${small ? "text-sm" : "text-xl"}`}
      >
        {value}
      </p>
    </div>
  </div>
);

const EnforcerRow = ({ enforcer, online, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left flex items-center gap-2.5 p-2 rounded-lg border transition-all ${active
      ? "border-[#16233F] bg-[#E9ECF2] shadow-sm"
      : online
        ? "border-transparent hover:border-[#1E8449]/40 hover:bg-[#F0FBF5]"
        : "border-transparent hover:bg-[#F5F6F8] opacity-70"
      }`}
  >
    <div className="relative flex-shrink-0">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${online ? "bg-[#1E8449]" : "bg-[#94A3B8]"
          }`}
      >
        {enforcer.firstname?.[0] || "E"}
        {enforcer.lastname?.[0] || ""}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#1E8449] border-2 border-white"></span>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-[#1F2937] truncate">
        {enforcer.firstname} {enforcer.lastname}
      </p>
      <p className="text-[10px] text-[#94A3B8] flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        {enforcer.last_updated
          ? new Date(enforcer.last_updated).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "No data"}
      </p>
    </div>
    {online && (
      <LocateFixed className="w-3.5 h-3.5 text-[#16233F] flex-shrink-0" />
    )}
  </button>
);

const EnforcerDetailCard = ({ enforcer, onClose, onLocate, onCopy }) => (
  <div className="fixed bottom-6 right-6 z-[1000] w-80 bg-white rounded-2xl shadow-2xl border border-[#E9ECF2] overflow-hidden">
    <div
      className={`h-20 ${enforcer.is_online ? "bg-[#16233F]" : "bg-[#64748B]"
        } relative`}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="absolute -bottom-8 left-4">
        <div
          className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center text-white text-xl font-bold ${enforcer.is_online ? "bg-[#1E8449]" : "bg-[#94A3B8]"
            }`}
        >
          {enforcer.firstname?.[0] || "E"}
          {enforcer.lastname?.[0] || ""}
        </div>
      </div>
    </div>

    <div className="pt-10 px-4 pb-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-[#1F2937]">
          {enforcer.firstname} {enforcer.lastname}
        </h3>
        {enforcer.is_online && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#1E8449] bg-[#E5F2EA] px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E8449] animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <p className="text-xs text-[#64748B] capitalize mb-3">
        {enforcer.role || "Enforcer"}
      </p>

      {enforcer.latitude && enforcer.longitude ? (
        <div className="space-y-1.5 mb-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">Coordinates</span>
            <span className="font-mono text-[#1F2937] flex items-center gap-1">
              {enforcer.latitude.toFixed(5)}, {enforcer.longitude.toFixed(5)}
              <button
                onClick={() =>
                  onCopy(`${enforcer.latitude},${enforcer.longitude}`)
                }
                className="text-[#94A3B8] hover:text-[#16233F]"
                title="Copy"
              >
                <Copy className="w-3 h-3" />
              </button>
            </span>
          </div>
          {enforcer.accuracy != null && (
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Accuracy</span>
              <span className="text-[#1F2937]">
                ±{enforcer.accuracy.toFixed(0)}m
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Last update</span>
            <span className="text-[#1F2937]">
              {enforcer.last_updated
                ? new Date(enforcer.last_updated).toLocaleTimeString()
                : "—"}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[#94A3B8] mb-3">
          No location data available
        </p>
      )}

      <div className="flex gap-2">
        {enforcer.latitude && enforcer.longitude && (
          <button
            onClick={onLocate}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#16233F] hover:bg-[#0F1A2E] text-white text-xs font-medium py-2 rounded-lg"
          >
            <Navigation className="w-3.5 h-3.5" />
            Center
          </button>
        )}
      </div>
    </div>
  </div>
);

const LocationSearchInput = ({ onSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const doSearch = async (q) => {
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q,
        )}&limit=5&addressdetails=1`,
      );
      const data = await res.json();
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(v), 400);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
        <Input
          placeholder="Search address or landmark..."
          value={query}
          onChange={onChange}
          onFocus={() => results.length && setOpen(true)}
          className="pl-8 pr-8 h-9 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#16233F] animate-spin" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-[2000] w-full mt-1 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSelect({
                  lat: parseFloat(r.lat),
                  lng: parseFloat(r.lon),
                  name: r.display_name.split(",")[0],
                  address: r.display_name,
                });
                setQuery(r.display_name);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#E9ECF2] border-b last:border-b-0"
            >
              <p className="text-xs font-medium text-[#1F2937] truncate">
                {r.display_name.split(",")[0]}
              </p>
              <p className="text-[10px] text-[#94A3B8] truncate">
                {r.display_name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== STYLES ====================
const mapStyles = `
  .enforcer-marker-wrapper { background: none !important; border: none !important; }
  .enforcer-marker { position: relative; width: 44px; height: 44px; }
  .enforcer-marker-bubble {
    width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid #fff;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 13px; font-weight: 700;
    position: absolute; top: 0; left: 4px;
  }
  .enforcer-marker-bubble-online { background: #16233F; }
  .enforcer-marker-bubble-offline { background: #94A3B8; }
  .enforcer-marker-dot {
    position: absolute; bottom: 4px; right: 4px; width: 12px; height: 12px;
    border-radius: 50%; border: 2px solid #fff;
  }
  .enforcer-marker-dot-online { background: #1E8449; }
  .enforcer-marker-dot-offline { background: #94A3B8; }
  .enforcer-marker-pulse {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid #F0B429;
    animation: pulse-ring 2s ease-out infinite;
    pointer-events: none;
  }
  .enforcer-marker-online { animation: float 2.5s ease-in-out infinite; }
  .enforcer-marker-offline { opacity: 0.55; filter: grayscale(0.6); }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  @keyframes pulse-ring {
    0% { transform: scale(0.7); opacity: 0.8; }
    100% { transform: scale(1.6); opacity: 0; }
  }

  .duty-marker-wrapper { background: none !important; border: none !important; }
  .duty-marker {
    width: 32px; height: 40px; position: relative;
    filter: drop-shadow(0 3px 4px rgba(0,0,0,0.3));
  }
  .duty-marker-pin {
    width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
    background: #F0B429; transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fff;
  }
  .duty-marker-pin > svg { transform: rotate(45deg); }

  .enforcer-popup .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.18);
    padding: 0;
  }
  .enforcer-popup .leaflet-popup-content { margin: 0; }
  .enforcer-popup .leaflet-popup-tip { background: white; }
  .enforcer-popup-content { padding: 12px; min-width: 220px; font-family: inherit; }
  .enforcer-popup-header {
    display: flex; align-items: center; gap: 10px;
    padding-bottom: 10px; margin-bottom: 10px;
    border-bottom: 1px solid #F1F5F9;
  }
  .enforcer-popup-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 14px; font-weight: 700; flex-shrink: 0;
  }
  .enforcer-popup-avatar.online { background: #16233F; }
  .enforcer-popup-avatar.offline { background: #94A3B8; }
  .enforcer-popup-name-wrap { flex: 1; min-width: 0; }
  .enforcer-popup-name { font-size: 13px; font-weight: 600; color: #1F2937; }
  .enforcer-popup-role { font-size: 11px; color: #64748B; text-transform: capitalize; }
  .enforcer-popup-status-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  }
  .enforcer-popup-status-dot.online { background: #1E8449; box-shadow: 0 0 0 3px rgba(30,132,73,0.15); }
  .enforcer-popup-status-dot.offline { background: #94A3B8; }
  .enforcer-popup-meta { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .enforcer-popup-row { display: flex; justify-content: space-between; font-size: 11px; }
  .enforcer-popup-label { color: #94A3B8; }
  .enforcer-popup-value { color: #1F2937; font-weight: 500; }
  .enforcer-popup-value.mono { font-family: ui-monospace, monospace; font-size: 10px; }
  .enforcer-popup-value.online { color: #1E8449; }
  .enforcer-popup-value.offline { color: #94A3B8; }
  .enforcer-popup-btn {
    width: 100%; display: flex; align-items: center; justify-content: center;
    gap: 6px; background: #16233F; color: white; border: none;
    padding: 8px 12px; border-radius: 8px; font-size: 12px;
    font-weight: 600; cursor: pointer; transition: background 0.15s;
  }
  .enforcer-popup-btn:hover { background: #0F1A2E; }

  .click-marker { animation: click-pulse 1s ease-out forwards; pointer-events: none; }
  @keyframes click-pulse {
    0% { transform: scale(0.6); opacity: 1; }
    100% { transform: scale(2.2); opacity: 0; }
  }

  .leaflet-container { cursor: grab; }
  .leaflet-container:active { cursor: grabbing; }

  .overflow-y-auto::-webkit-scrollbar { width: 6px; }
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #CBD5E1; border-radius: 3px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
`;

export default DutyMap;