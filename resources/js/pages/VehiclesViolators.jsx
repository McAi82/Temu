import React, { useState } from "react";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Pagination } from "../components/ui/Pagination";
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
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Car,
  Users,
  RefreshCw,
  Loader2,
  User,
  Phone,
  Calendar,
  MapPin,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const ITEMS_PER_PAGE = 10;

const VehiclesViolators = () => {
  const queryClient = useQueryClient();

  // ==================== VIOLATORS STATE ====================
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

  // ==================== VEHICLES STATE ====================
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

  // ==================== QUERIES ====================
  const {
    data: violatorsResponse,
    isLoading: violatorsLoading,
    refetch: refetchViolators,
    error: violatorsError,
  } = useQuery({
    queryKey: ["violators", violatorPage, violatorSearchTerm],
    queryFn: () => getViolators(violatorPage, ITEMS_PER_PAGE),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: vehiclesResponse,
    isLoading: vehiclesLoading,
    refetch: refetchVehicles,
    error: vehiclesError,
  } = useQuery({
    queryKey: ["vehicles", vehiclePage, vehicleSearchTerm],
    queryFn: () => getVehicles(vehiclePage, ITEMS_PER_PAGE),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  // ==================== MUTATIONS ====================
  const createViolatorMutation = useMutation({
    mutationFn: createViolator,
    onSuccess: () => {
      queryClient.invalidateQueries(["violators"]);
      setIsViolatorDialogOpen(false);
      resetViolatorForm();
      alert("Violator created successfully");
    },
    onError: (error) => {
      alert(error.response?.data?.message || "Error creating violator");
    },
  });

  const updateViolatorMutation = useMutation({
    mutationFn: ({ id, data }) => updateViolator(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["violators"]);
      setIsViolatorDialogOpen(false);
      resetViolatorForm();
      alert("Violator updated successfully");
    },
    onError: (error) => {
      alert(error.response?.data?.message || "Error updating violator");
    },
  });

  const deleteViolatorMutation = useMutation({
    mutationFn: deleteViolator,
    onSuccess: () => {
      queryClient.invalidateQueries(["violators"]);
      alert("Violator deleted successfully");
    },
    onError: (error) => {
      alert(error.response?.data?.message || "Error deleting violator");
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      setIsVehicleDialogOpen(false);
      resetVehicleForm();
      alert("Vehicle created successfully");
    },
    onError: (error) => {
      alert(error.response?.data?.message || "Error creating vehicle");
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }) => updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      setIsVehicleDialogOpen(false);
      resetVehicleForm();
      alert("Vehicle updated successfully");
    },
    onError: (error) => {
      alert(error.response?.data?.message || "Error updating vehicle");
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      alert("Vehicle deleted successfully");
    },
    onError: (error) => {
      alert(error.response?.data?.message || "Error deleting vehicle");
    },
  });

  // ==================== HELPERS ====================
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
      if (key === "profile_photo" && violatorFormData[key]) {
        formData.append(key, violatorFormData[key]);
      } else if (key !== "profile_photo" && violatorFormData[key]) {
        formData.append(key, violatorFormData[key]);
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

  const handleDeleteViolator = (id) => {
    if (window.confirm("Are you sure you want to delete this violator?")) {
      deleteViolatorMutation.mutate(id);
    }
  };

  const handleEditViolator = (violator) => {
    setEditingViolator(violator);
    setViolatorFormData({
      firstname: violator.firstname,
      middlename: violator.middlename || "",
      lastname: violator.lastname,
      license: violator.license,
      expiry: violator.expiry,
      birthday: violator.birthday,
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

  const handleDeleteVehicle = (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
      deleteVehicleMutation.mutate(id);
    }
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleFormData(vehicle);
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

  // ==================== EXTRACT DATA ====================
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

  // For Violators tab
  const violatorsMeta = getMeta(violatorsResponse);

  // For Vehicles tab
  const vehiclesMeta = getMeta(vehiclesResponse);

  const violators = getDataArray(violatorsResponse);

  const vehicles = getDataArray(vehiclesResponse);

  const isLoading = violatorsLoading || vehiclesLoading;

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-['Oswald'] font-semibold text-[#16233F]">
            Vehicles & Violators
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            Manage vehicle and violator records
          </p>
        </div>
        <Button
          onClick={() => {
            refetchViolators();
            refetchVehicles();
          }}
          variant="outline"
          className="border-[#1E8449]/30 text-[#1E8449] hover:bg-[#E5F2EA]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="violators" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList className="bg-[#E9ECF2]">
            <TabsTrigger
              value="violators"
              className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Violators
              <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {violatorsMeta.total || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="vehicles"
              className="data-[state=active]:bg-[#16233F] data-[state=active]:text-white flex items-center gap-2"
            >
              <Car className="w-4 h-4" />
              Vehicles
              <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {vehiclesMeta.total || 0}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ==================== VIOLATORS TAB ==================== */}
        <TabsContent value="violators">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#F0B429]" />
                  Violators List
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <Input
                      placeholder="Search by name or license..."
                      value={violatorSearchTerm}
                      onChange={(e) => setViolatorSearchTerm(e.target.value)}
                      className="pl-10 w-64 focus-visible:ring-[#F0B429]"
                    />
                  </div>
                  <Dialog
                    open={isViolatorDialogOpen}
                    onOpenChange={setIsViolatorDialogOpen}
                  >
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="font-['Oswald'] text-[#16233F]">
                          {editingViolator
                            ? "Edit Violator"
                            : "Add New Violator"}
                        </DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={handleViolatorSubmit}
                        className="space-y-4"
                      >
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
                        <Button
                          type="submit"
                          className="w-full bg-[#1E8449] hover:bg-[#186B3B]"
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
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {violatorsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                </div>
              ) : violators.length === 0 ? (
                <div className="text-center py-8 text-[#64748B]">
                  No violators found.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Photo
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Name
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          License #
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Expiry
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Gender
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Nationality
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {violators.map((violator) => (
                        <TableRow
                          key={violator.violator_id}
                          className="hover:bg-[#F8F9FA]"
                        >
                          <TableCell>
                            {violator.profile_photo ? (
                              <img
                                src={getImageUrl(violator.profile_photo)}
                                alt={`${violator.firstname} ${violator.lastname}`}
                                className="w-10 h-10 rounded-full object-cover border border-[#E9ECF2]"
                                onError={(e) => {
                                  e.target.src = "";
                                  e.target.alt = "No photo";
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">
                                {violator.firstname?.[0]}
                                {violator.lastname?.[0]}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-[#1F2937]">
                              {violator.firstname} {violator.middlename}{" "}
                              {violator.lastname}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-[#16233F]">
                            {violator.license}
                          </TableCell>
                          <TableCell className="text-[#1F2937]">
                            {new Date(violator.expiry).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-[#1F2937]">
                            {violator.gender}
                          </TableCell>
                          <TableCell className="text-[#1F2937]">
                            {violator.nationality}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditViolator(violator)}
                                className="text-[#16233F] hover:bg-[#E9ECF2]"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDeleteViolator(violator.violator_id)
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
                    currentPage={violatorsMeta.current_page}
                    totalPages={violatorsMeta.last_page}
                    onPageChange={setViolatorPage}
                    totalItems={violatorsMeta.total}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== VEHICLES TAB ==================== */}
        <TabsContent value="vehicles">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2">
                  <Car className="w-5 h-5 text-[#1E8449]" />
                  Vehicles List
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <Input
                      placeholder="Search by plate or owner..."
                      value={vehicleSearchTerm}
                      onChange={(e) => setVehicleSearchTerm(e.target.value)}
                      className="pl-10 w-64 focus-visible:ring-[#F0B429]"
                    />
                  </div>
                  <Dialog
                    open={isVehicleDialogOpen}
                    onOpenChange={setIsVehicleDialogOpen}
                  >
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-['Oswald'] text-[#16233F]">
                          {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
                        </DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={handleVehicleSubmit}
                        className="space-y-4"
                      >
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
                        <Button
                          type="submit"
                          className="w-full bg-[#1E8449] hover:bg-[#186B3B]"
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
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {vehiclesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
                </div>
              ) : vehicles.length === 0 ? (
                <div className="text-center py-8 text-[#64748B]">
                  No vehicles found.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#E9ECF2] hover:bg-[#E9ECF2]">
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Plate Number
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Owner
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Make
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Model
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Color
                        </TableHead>
                        <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicles.map((vehicle) => (
                        <TableRow
                          key={vehicle.vehicle_id}
                          className="hover:bg-[#F8F9FA]"
                        >
                          <TableCell className="font-mono font-medium text-[#16233F]">
                            {vehicle.platenumber}
                          </TableCell>
                          <TableCell className="text-[#1F2937]">
                            {vehicle.owner}
                          </TableCell>
                          <TableCell className="text-[#1F2937]">
                            {vehicle.make || "-"}
                          </TableCell>
                          <TableCell className="text-[#1F2937]">
                            {vehicle.model || "-"}
                          </TableCell>
                          <TableCell className="text-[#1F2937]">
                            {vehicle.color || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditVehicle(vehicle)}
                                className="text-[#16233F] hover:bg-[#E9ECF2]"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDeleteVehicle(vehicle.vehicle_id)
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
                    currentPage={vehiclesMeta.current_page}
                    totalPages={vehiclesMeta.last_page}
                    onPageChange={setVehiclePage}
                    totalItems={vehiclesMeta.total}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VehiclesViolators;
