// web/src/pages/Users.jsx
import React, { useState, useEffect } from "react";
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
import ActionButton from "../components/ui/ActionButton";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
} from "../services/api";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Key,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Loader2,
  Camera,
  X,
  Copy,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  MailCheck,
  MailX,
} from "lucide-react";
import { useAlert } from "../components/ui/AlertProvider";

const API_BASE_URL = "https://ivory-gerbil-502781.hostingersite.com";
const ITEMS_PER_PAGE = 20;

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

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
  if (response.data?.data && Array.isArray(response.data.data))
    return response.data.data;
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

const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */
/* Credential Modal                                                    */
/* ------------------------------------------------------------------ */

const CredentialsModal = ({
  open,
  onClose,
  email,
  password,
  emailSent,
  emailError,
}) => {
  const [revealed, setRevealed] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (open) {
      setRevealed(true);
      setCopied(null);
    }
  }, [open]);

  const handleCopy = async (label, value) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-['Oswald'] text-[#16233F] flex items-center gap-2">
            <Key className="w-5 h-5 text-[#F0B429]" />
            New User Credentials
          </DialogTitle>
        </DialogHeader>

        {/* Status banner */}
        {emailSent ? (
          <div className="flex items-start gap-2 bg-[#E5F2EA] border border-[#1E8449]/30 rounded-lg p-3 text-sm text-[#1E8449]">
            <MailCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Welcome email sent</p>
              <p className="text-xs mt-0.5">
                The user should receive their login credentials at{" "}
                <span className="font-mono">{email}</span> shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-[#FBF1DC] border border-[#F0B429]/40 rounded-lg p-3 text-sm text-[#92600A]">
            <MailX className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Email could not be sent</p>
              <p className="text-xs mt-0.5">
                {emailError ||
                  "Hand the credentials below to the user securely."}
              </p>
            </div>
          </div>
        )}

        {/* Credential rows */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Email
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                readOnly
                value={email}
                className="font-mono text-sm bg-[#F8F9FA]"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy("email", email)}
                title="Copy email"
              >
                {copied === "email" ? (
                  <Check className="w-4 h-4 text-[#1E8449]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Temporary Password
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                readOnly
                type={revealed ? "text" : "password"}
                value={password}
                className="font-mono text-sm bg-[#F8F9FA] tracking-wider"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setRevealed((r) => !r)}
                title={revealed ? "Hide password" : "Show password"}
              >
                {revealed ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy("password", password)}
                title="Copy password"
              >
                {copied === "password" ? (
                  <Check className="w-4 h-4 text-[#1E8449]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-[#FBE7E9] border border-[#C8202F]/30 rounded-lg p-3 text-xs text-[#C8202F]">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            This password is shown <strong>once</strong>. Save it now. If
            you close this window, you'll need to reset the password to get a
            new one.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => handleCopy("both", `Email: ${email}\nPassword: ${password}`)}
          >
            {copied === "both" ? (
              <Check className="w-4 h-4 mr-2 text-[#1E8449]" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied === "both" ? "Copied!" : "Copy both"}
          </Button>
          <Button
            type="button"
            className="flex-1 bg-[#16233F] hover:bg-[#0F1A2E]"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Users = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Session-only map of { [userId]: plaintextPassword } — set when a
  // new user is created. Never persisted. Cleared on page reload.
  const [freshCredentials, setFreshCredentials] = useState({});

  // Credentials modal state
  const [credentialsModal, setCredentialsModal] = useState({
    open: false,
    email: "",
    password: "",
    emailSent: true,
    emailError: null,
  });

  const [formData, setFormData] = useState({
    email: "",
    firstname: "",
    middlename: "",
    lastname: "",
    role: "enforcer",
    contact_number: "",
    profile_image: null,
  });
  const [previewUrl, setPreviewUrl] = useState("");

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const {
    data: usersResponse,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["users", page, debouncedSearch],
    queryFn: () =>
      getUsers(page, ITEMS_PER_PAGE, {
        search: debouncedSearch || undefined,
        sort_by: "lastname",
        sort_dir: "asc",
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  /* -------------------------- Mutations -------------------------- */

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsDialogOpen(false);
      resetForm();

      const payload = response?.data || {};
      const email = payload?.user?.email || formData.email;
      const password = payload.generated_password || null;
      const emailSent = payload.email_sent !== false; // default true if omitted
      const emailError = payload.email_error || null;

      if (password) {
        setFreshCredentials((prev) => ({
          ...prev,
          [payload.user?.user_id]: password,
        }));
      }

      // Always show the modal so the admin can copy the password —
      // even when email was sent, it's useful as a fallback.
      setCredentialsModal({
        open: true,
        email,
        password: password || "(not returned by server)",
        emailSent,
        emailError,
      });
    },
    onError: (error) => {
      const payload = error.response?.data || {};
      let msg = payload.message || "Error creating user";

      if (payload.errors) {
        const flat = Object.values(payload.errors).flat().join("\n");
        if (flat) msg = flat;
      }
      notify.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsDialogOpen(false);
      resetForm();
      notify.success("User updated successfully");
    },
    onError: (error) => {
      console.error("Update error:", error);
      notify.error(error.response?.data?.message || "Error updating user");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      notify.success("User deleted successfully");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error deleting user");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: toggleUserStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      notify.success("User status updated successfully");
    },
    onError: (error) => {
      notify.error(
        error.response?.data?.message || "Error updating user status",
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: (response, userId) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });

      const payload = response?.data || {};
      const email = payload.email || "";
      const password = payload.new_password || null;
      const emailSent = payload.email_sent !== false;
      const emailError = payload.email_error || null;

      if (password) {
        setFreshCredentials((prev) => ({ ...prev, [userId]: password }));
      }

      setCredentialsModal({
        open: true,
        email,
        password: password || "(not returned by server)",
        emailSent,
        emailError,
      });
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Error resetting password");
    },
  });

  /* -------------------------- Handlers -------------------------- */

  const users = getDataArray(usersResponse);
  const meta = getMeta(usersResponse);

  const getImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith("http")) return profileImage;
    return `${API_BASE_URL}/storage/${profileImage}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const formDataToSend = new FormData();
    formDataToSend.append("email", formData.email);
    formDataToSend.append("firstname", formData.firstname);
    formDataToSend.append("middlename", formData.middlename || "");
    formDataToSend.append("lastname", formData.lastname);
    formDataToSend.append("role", formData.role);
    formDataToSend.append("contact_number", formData.contact_number || "");

    if (formData.profile_image instanceof File) {
      formDataToSend.append("profile_image", formData.profile_image);
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.user_id, data: formDataToSend });
    } else {
      createMutation.mutate(formDataToSend);
    }
  };

  const handleDelete = async (id, email) => {
    const ok = await notify.confirm(
      `Are you sure you want to delete ${email}?`,
      { destructive: true, confirmText: "Delete" },
    );
    if (ok) deleteMutation.mutate(id);
  };

  const handleToggleStatus = async (id, currentStatus, email) => {
    const action = currentStatus ? "deactivate" : "activate";
    const ok = await notify.confirm(
      `Are you sure you want to ${action} ${email}?`,
      {
        destructive: currentStatus,
        confirmText: action === "deactivate" ? "Deactivate" : "Activate",
      },
    );
    if (ok) toggleStatusMutation.mutate(id);
  };

  const handleResetPassword = async (id, email) => {
    const ok = await notify.confirm(`Reset password for ${email}?`, {
      confirmText: "Reset",
    });
    if (ok) resetPasswordMutation.mutate(id);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstname: user.firstname,
      middlename: user.middlename || "",
      lastname: user.lastname,
      role: user.role,
      contact_number: user.contact_number || "",
      profile_image: null,
    });
    setPreviewUrl(getImageUrl(user.profile_image));
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      firstname: "",
      middlename: "",
      lastname: "",
      role: "enforcer",
      contact_number: "",
      profile_image: null,
    });
    setPreviewUrl("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, profile_image: file });
      const reader = new FileReader();
      reader.onload = (event) => setPreviewUrl(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: "bg-[#16233F] text-white",
      staff: "bg-[#EEF1F5] text-[#3B5170]",
      enforcer: "bg-[#E5F2EA] text-[#1E8449]",
    };
    return colors[role] || "bg-gray-100 text-gray-700";
  };

  const handleViewFreshPassword = (user) => {
    const password = freshCredentials[user.user_id];
    if (!password) {
      notify.info(
        "This password is no longer available in this session. Use \"Reset Password\" to generate a new one.",
      );
      return;
    }
    setCredentialsModal({
      open: true,
      email: user.email,
      password,
      emailSent: true,
      emailError: null,
    });
  };

  /* -------------------------- Render -------------------------- */

  if (isLoading && !usersResponse) {
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
          Error loading users: {error.message}
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
            User Management
          </h1>
          <p className="text-[#64748B] font-['Inter'] text-sm mt-1">
            Manage system users and their access levels
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="bg-[#1E8449] hover:bg-[#186B3B]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-['Oswald'] text-[#16233F]">
                {editingUser ? "Edit User" : "Add New User"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="First Name *"
                  value={formData.firstname}
                  onChange={(e) =>
                    setFormData({ ...formData, firstname: e.target.value })
                  }
                  required
                  className="focus-visible:ring-[#F0B429]"
                />
                <Input
                  placeholder="Middle Name"
                  value={formData.middlename}
                  onChange={(e) =>
                    setFormData({ ...formData, middlename: e.target.value })
                  }
                  className="focus-visible:ring-[#F0B429]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Last Name *"
                  value={formData.lastname}
                  onChange={(e) =>
                    setFormData({ ...formData, lastname: e.target.value })
                  }
                  required
                  className="focus-visible:ring-[#F0B429]"
                />
                <Input
                  placeholder="Contact Number"
                  value={formData.contact_number}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_number: e.target.value })
                  }
                  className="focus-visible:ring-[#F0B429]"
                />
              </div>
              <Input
                type="email"
                placeholder="Email *"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                disabled={!!editingUser}
                className="focus-visible:ring-[#F0B429]"
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                required
              >
                <option value="admin">Admin (Full Access)</option>
                <option value="staff">Staff (View Only)</option>
                <option value="enforcer">Enforcer (Mobile Only)</option>
              </select>

              <div>
                <label className="block text-sm font-medium mb-1 text-[#1F2937]">
                  Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  {previewUrl && (
                    <div className="relative">
                      <img
                        src={previewUrl}
                        alt="Profile preview"
                        className="w-16 h-16 rounded-full object-cover border border-[#E9ECF2]"
                      />
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 bg-[#C8202F] text-white rounded-full p-0.5 hover:bg-[#A01622]"
                        onClick={() => {
                          setPreviewUrl("");
                          setFormData({ ...formData, profile_image: null });
                          const fileInput = document.getElementById(
                            "profile_image_input",
                          );
                          if (fileInput) fileInput.value = "";
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1">
                    <label
                      htmlFor="profile_image_input"
                      className="flex items-center justify-center w-full px-4 py-2 border border-[#E9ECF2] rounded-lg cursor-pointer hover:bg-[#F5F6F8] transition-colors"
                    >
                      <Camera className="w-4 h-4 mr-2 text-[#64748B]" />
                      <span className="text-sm text-[#64748B]">
                        {previewUrl ? "Change Photo" : "Upload Photo"}
                      </span>
                      <Input
                        id="profile_image_input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      JPG, PNG, GIF up to 2MB
                    </p>
                  </div>
                </div>
              </div>

              {!editingUser && (
                <div className="bg-[#FBF1DC] p-3 rounded-md border border-[#F0B429]/30 flex items-start gap-2">
                  <Mail className="w-4 h-4 mt-0.5 text-[#92600A] flex-shrink-0" />
                  <p className="text-sm text-[#92600A]">
                    A random password will be generated and emailed to the new
                    user. You'll also see it on the next screen so you can
                    share it manually if needed.
                  </p>
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-[#1E8449] hover:bg-[#186B3B]"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingUser
                    ? "Update User"
                    : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="font-['Oswald'] font-medium text-[#16233F] flex items-center gap-2">
              Users List
              <span className="text-xs font-normal text-[#64748B] font-['Inter']">
                (alphabetical by last name)
              </span>
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 w-80 focus-visible:ring-[#F0B429]"
              />
              {isFetching && (
                <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#94A3B8]" />
              )}
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                  title="Clear"
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
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-[#64748B]">
              {searchTerm
                ? `No users match "${searchTerm}"`
                : "No users found."}
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
                      Email
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Role
                    </TableHead>
                    <TableHead className="font-['Inter'] font-semibold text-[#16233F]">
                      Contact
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
                  {users.map((user) => (
                    <TableRow
                      key={user.user_id}
                      className="hover:bg-[#F8F9FA]"
                    >
                      <TableCell>
                        {user.profile_image ? (
                          <img
                            src={getImageUrl(user.profile_image)}
                            alt={`${user.firstname} ${user.lastname}`}
                            className="w-10 h-10 rounded-full object-cover border border-[#E9ECF2]"
                            onError={(e) => {
                              e.target.src = "";
                              e.target.alt = "No image";
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">
                            {user.firstname?.[0]}
                            {user.lastname?.[0]}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-[#1F2937]">
                          {user.lastname}, {user.firstname}
                          {user.middlename ? ` ${user.middlename[0]}.` : ""}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          ID: {user.user_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-[#64748B]" />
                          <span className="text-sm text-[#1F2937]">
                            {user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                            user.role,
                          )}`}
                        >
                          {user.role.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.contact_number ? (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3 text-[#64748B]" />
                            <span className="text-sm text-[#1F2937]">
                              {user.contact_number}
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${user.is_active
                              ? "bg-[#E5F2EA] text-[#1E8449]"
                              : "bg-[#FBE7E9] text-[#C8202F]"
                            }`}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            icon={Pencil}
                            variant="primary"
                            onClick={() => handleEdit(user)}
                          >
                            Edit
                          </ActionButton>
                          <ActionButton
                            icon={user.is_active ? UserX : UserCheck}
                            variant={user.is_active ? "warning" : "primary"}
                            onClick={() =>
                              handleToggleStatus(
                                user.user_id,
                                user.is_active,
                                user.email,
                              )
                            }
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </ActionButton>
                          <ActionButton
                            icon={Key}
                            variant="warning"
                            onClick={() =>
                              handleResetPassword(user.user_id, user.email)
                            }
                          >
                            Reset Password
                          </ActionButton>
                          {freshCredentials[user.user_id] ? (
                            <ActionButton
                              icon={Eye}
                              variant="info"
                              onClick={() => handleViewFreshPassword(user)}
                            >
                              Show Password
                            </ActionButton>
                          ) : null}
                          <ActionButton
                            icon={Trash2}
                            variant="danger"
                            onClick={() =>
                              handleDelete(user.user_id, user.email)
                            }
                          >
                            Delete
                          </ActionButton>
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

      {/* Credentials Modal */}
      <CredentialsModal
        open={credentialsModal.open}
        onClose={() =>
          setCredentialsModal({
            open: false,
            email: "",
            password: "",
            emailSent: true,
            emailError: null,
          })
        }
        email={credentialsModal.email}
        password={credentialsModal.password}
        emailSent={credentialsModal.emailSent}
        emailError={credentialsModal.emailError}
      />
    </div>
  );
};

export default Users;