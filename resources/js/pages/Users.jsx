// web/src/pages/Users.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Pagination } from '../components/ui/Pagination';
import ActionButton from '../components/ui/ActionButton';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
} from '../services/api';
import {
  Plus,
  Pencil,
  Archive,
  Search,
  Key,
  Mail,
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
  Filter,
  RefreshCw,
  Users as UsersIcon,
  LayoutGrid,
  List as ListIcon,
  ScanFace,
} from 'lucide-react';
import { useAlert } from '../components/ui/AlertProvider';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = 'https://ivory-gerbil-502781.hostingersite.com';
const ITEMS_PER_PAGE = 20;

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'enforcer', label: 'Enforcer' },
];

const ROLE_META = {
  admin: {
    color: '#16233F',
    soft: '#E9ECF2',
    text: '#16233F',
    chip: 'bg-[#16233F] text-white',
  },
  staff: {
    color: '#3B5170',
    soft: '#EEF1F5',
    text: '#3B5170',
    chip: 'bg-[#EEF1F5] text-[#3B5170]',
  },
  enforcer: {
    color: '#1E8449',
    soft: '#E5F2EA',
    text: '#1E8449',
    chip: 'bg-[#E5F2EA] text-[#1E8449]',
  },
};

const ROW_CLASS =
  'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ' +
  'md:grid md:grid-cols-[minmax(0,auto)_minmax(0,1.6fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,14rem)] md:gap-4';

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
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

const Chip = ({ label, onClear }) => (
  <span className="inline-flex items-center gap-1 bg-[#E9ECF2] text-[#16233F] px-2.5 py-1 rounded-md text-xs">
    {label}
    <button onClick={onClear} className="hover:text-[#C8202F]">
      <X className="w-3 h-3" />
    </button>
  </span>
);

const L = ({ icon: I, children }) => (
  <label className="text-xs font-semibold text-[#16233F] mb-1.5 flex items-center gap-1.5">
    {I && <I className="w-3.5 h-3.5 text-[#92600A]" />}
    {children}
  </label>
);

const Mini = ({ children }) => (
  <i className="md:hidden not-italic text-[10px] text-[#94A3B8] mr-1">
    {children}
  </i>
);

const ViewToggle = ({ view, setView }) => (
  <div
    className="ml-auto flex bg-[#E9ECF2] rounded-full p-1 text-xs"
    role="group"
    aria-label="Choose layout"
  >
    {[['list', 'List', ListIcon], ['cards', 'Cards', LayoutGrid]].map(
      ([v, label, I]) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          aria-pressed={view === v}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${view === v
            ? 'bg-[#16233F] text-white'
            : 'text-[#64748B] hover:text-[#16233F]'
            }`}
        >
          <I className="w-3.5 h-3.5" />
          {label}
        </button>
      ),
    )}
  </div>
);

const FilterShell = ({ title, onClose, onReset, children }) => (
  <aside className="self-start rounded-xl bg-[#FBF1DC] border-t-4 border-[#F0B429] p-5 space-y-5 lg:sticky lg:top-4">
    <div className="flex justify-between items-center">
      <h3 className="text-base font-['Oswald'] font-medium text-[#16233F]">
        {title}
      </h3>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-[#F0B429]/25"
      >
        <X className="w-4 h-4 text-[#92600A]" />
      </button>
    </div>
    {children}
    <div className="flex gap-2 pt-3 border-t border-[#F0B429]/30">
      <Button onClick={onClose} className="bg-[#1E8449] hover:bg-[#186B3B]">
        Apply Filters
      </Button>
      <Button
        onClick={onReset}
        variant="ghost"
        className="text-[#64748B] hover:text-[#C8202F]"
      >
        <X className="w-4 h-4 mr-1" />
        Reset
      </Button>
    </div>
  </aside>
);

const Spec = ({ label, children, mono }) => (
  <div className="min-w-0">
    <dt className="text-[10px] text-[#94A3B8]">{label}</dt>
    <dd
      className={`text-sm truncate ${mono ? 'font-mono text-[#16233F]' : 'text-[#1F2937]'
        }`}
    >
      {children}
    </dd>
  </div>
);

/* ---------------- Credentials Modal ---------------- */

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

        {emailSent ? (
          <div className="flex items-start gap-2 bg-[#E5F2EA] border border-[#1E8449]/30 rounded-lg p-3 text-sm text-[#1E8449]">
            <MailCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Welcome email sent</p>
              <p className="text-xs mt-0.5">
                The user should receive their login credentials at{' '}
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
                  'Hand the credentials below to the user securely.'}
              </p>
            </div>
          </div>
        )}

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
                onClick={() => handleCopy('email', email)}
                title="Copy email"
              >
                {copied === 'email' ? (
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
                type={revealed ? 'text' : 'password'}
                value={password}
                className="font-mono text-sm bg-[#F8F9FA] tracking-wider"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setRevealed((r) => !r)}
                title={revealed ? 'Hide password' : 'Show password'}
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
                onClick={() => handleCopy('password', password)}
                title="Copy password"
              >
                {copied === 'password' ? (
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
            This password is shown <strong>once</strong>. Save it now. If you
            close this window, you'll need to reset the password to get a new
            one.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() =>
              handleCopy('both', `Email: ${email}\nPassword: ${password}`)
            }
          >
            {copied === 'both' ? (
              <Check className="w-4 h-4 mr-2 text-[#1E8449]" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied === 'both' ? 'Copied!' : 'Copy both'}
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

/* ---------------- Page ---------------- */

const Users = () => {
  const queryClient = useQueryClient();
  const notify = useAlert();
  const { user: currentUser } = useAuth();

  // Only admins can mutate; staff get a read-only view.
  const canManage = currentUser?.role === 'admin';

  const [view, setView] = useState('list');

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    role: '',
    // 'all' | 'active' | 'deactivated'
    account_status: 'active',
    // 'all' | 'registered' | 'unregistered'
    face_status: 'all',
  });

  const [freshCredentials, setFreshCredentials] = useState({});

  const [credentialsModal, setCredentialsModal] = useState({
    open: false,
    email: '',
    password: '',
    emailSent: true,
    emailError: null,
  });

  const [formData, setFormData] = useState({
    email: '',
    firstname: '',
    middlename: '',
    lastname: '',
    role: 'enforcer',
    contact_number: '',
    profile_image: null,
  });
  const [previewUrl, setPreviewUrl] = useState('');

  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const {
    data: usersResponse,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['users', page, debouncedSearch, filters],
    queryFn: () =>
      getUsers(page, ITEMS_PER_PAGE, {
        search: debouncedSearch || undefined,
        role: filters.role || undefined,
        sort_by: 'lastname',
        sort_dir: 'asc',
      }),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 2,
  });

  /* ---------------- Mutations ---------------- */

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDialogOpen(false);
      resetForm();

      const payload = response?.data || {};
      const email = payload?.user?.email || formData.email;
      const password = payload.generated_password || null;
      const emailSent = payload.email_sent !== false;
      const emailError = payload.email_error || null;

      if (password) {
        setFreshCredentials((prev) => ({
          ...prev,
          [payload.user?.user_id]: password,
        }));
      }

      setCredentialsModal({
        open: true,
        email,
        password: password || '(not returned by server)',
        emailSent,
        emailError,
      });
    },
    onError: (error) => {
      const payload = error.response?.data || {};
      let msg = payload.message || 'Error creating user';
      if (payload.errors) {
        const flat = Object.values(payload.errors).flat().join('\n');
        if (flat) msg = flat;
      }
      notify.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDialogOpen(false);
      resetForm();
      notify.success('User updated successfully');
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || 'Error updating user');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['archives'] });
      notify.success('User archived successfully');
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || 'Error archiving user');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: toggleUserStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success('User status updated successfully');
    },
    onError: (error) => {
      notify.error(
        error.response?.data?.message || 'Error updating user status',
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: (response, userId) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });

      const payload = response?.data || {};
      const email = payload.email || '';
      const password = payload.new_password || null;
      const emailSent = payload.email_sent !== false;
      const emailError = payload.email_error || null;

      if (password) {
        setFreshCredentials((prev) => ({
          ...prev,
          [userId]: password,
        }));
      }

      setCredentialsModal({
        open: true,
        email,
        password: password || '(not returned by server)',
        emailSent,
        emailError,
      });
    },
    onError: (error) => {
      notify.error(
        error.response?.data?.message || 'Error resetting password',
      );
    },
  });

  /* ---------------- Derived ---------------- */

  const allUsers = getDataArray(usersResponse);
  const meta = getMeta(usersResponse);

  // Account status counts are computed off the full server response so
  // the numbers stay stable while the user switches between views.
  const accountStats = useMemo(() => {
    const active = allUsers.filter((u) => u.is_active !== false);
    const deactivated = allUsers.filter((u) => u.is_active === false);
    return { active, deactivated, total: allUsers.length };
  }, [allUsers]);

  // Apply the account-status filter first.
  const users = useMemo(() => {
    if (filters.account_status === 'active') {
      return allUsers.filter((u) => u.is_active !== false);
    }
    if (filters.account_status === 'deactivated') {
      return allUsers.filter((u) => u.is_active === false);
    }
    return allUsers;
  }, [allUsers, filters.account_status]);

  // Face registration counts are computed on the account-status-filtered
  // list so the numbers reflect what the user is currently looking at.
  const faceStats = useMemo(() => {
    const registered = users.filter((u) => u.has_face_registered === true);
    const unregistered = users.filter((u) => u.has_face_registered !== true);
    return { registered, unregistered, total: users.length };
  }, [users]);

  // Apply the face filter on top of the account-status filter.
  const visibleUsers = useMemo(() => {
    if (filters.face_status === 'registered') return faceStats.registered;
    if (filters.face_status === 'unregistered') return faceStats.unregistered;
    return users;
  }, [users, filters.face_status, faceStats]);

  const getImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${API_BASE_URL}/storage/${profileImage}`;
  };

  /* ---------------- Handlers ---------------- */

  const handleSubmit = (e) => {
    e.preventDefault();

    const formDataToSend = new FormData();
    formDataToSend.append('email', formData.email);
    formDataToSend.append('firstname', formData.firstname);
    formDataToSend.append('middlename', formData.middlename || '');
    formDataToSend.append('lastname', formData.lastname);
    formDataToSend.append('role', formData.role);
    formDataToSend.append('contact_number', formData.contact_number || '');

    if (formData.profile_image instanceof File) {
      formDataToSend.append('profile_image', formData.profile_image);
    }

    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.user_id,
        data: formDataToSend,
      });
    } else {
      createMutation.mutate(formDataToSend);
    }
  };

  const handleArchive = async (id, email) => {
    const ok = await notify.confirm(
      `Archive ${email}? The account will be signed out and hidden from the users list. You can restore it later from the Archives page.`,
      { destructive: true, confirmText: 'Archive' },
    );
    if (ok) archiveMutation.mutate(id);
  };

  const handleToggleStatus = async (id, currentStatus, email) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    const ok = await notify.confirm(
      `Are you sure you want to ${action} ${email}?`,
      {
        destructive: currentStatus,
        confirmText: action === 'deactivate' ? 'Deactivate' : 'Activate',
      },
    );
    if (ok) toggleStatusMutation.mutate(id);
  };

  const handleResetPassword = async (id, email) => {
    const ok = await notify.confirm(`Reset password for ${email}?`, {
      confirmText: 'Reset',
    });
    if (ok) resetPasswordMutation.mutate(id);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstname: user.firstname,
      middlename: user.middlename || '',
      lastname: user.lastname,
      role: user.role,
      contact_number: user.contact_number || '',
      profile_image: null,
    });
    setPreviewUrl(getImageUrl(user.profile_image));
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      firstname: '',
      middlename: '',
      lastname: '',
      role: 'enforcer',
      contact_number: '',
      profile_image: null,
    });
    setPreviewUrl('');
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

  const handleViewFreshPassword = (user) => {
    const password = freshCredentials[user.user_id];
    if (!password) {
      notify.info(
        'This password is no longer available in this session. Use "Reset Password" to generate a new one.',
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

  const clearFilters = () =>
    setFilters({
      role: '',
      account_status: 'active',
      face_status: 'all',
    });

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchTerm) c++;
    if (filters.role) c++;
    if (filters.account_status !== 'active') c++;
    if (filters.face_status !== 'all') c++;
    return c;
  }, [searchTerm, filters]);

  const roleBadge = (role) => {
    const meta = ROLE_META[role] || ROLE_META.enforcer;
    return (
      <span
        className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.chip}`}
      >
        {role?.toUpperCase() || '—'}
      </span>
    );
  };

  const faceBadge = (registered) =>
    registered ? (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-[#E5F2EA] text-[#1E8449]"
        title="Face registered on mobile device"
      >
        <ScanFace className="w-3 h-3" />
        Face ✓
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-[#F1F5F9] text-[#64748B]"
        title="No face registered yet"
      >
        <ScanFace className="w-3 h-3" />
        No face
      </span>
    );

  const rowActions = (user) => {
    // Staff get a read-only view — no action buttons at all.
    if (!canManage) return null;

    return (
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
          variant={user.is_active ? 'warning' : 'primary'}
          onClick={() =>
            handleToggleStatus(user.user_id, user.is_active, user.email)
          }
        >
          {user.is_active ? 'Deactivate' : 'Activate'}
        </ActionButton>
        <ActionButton
          icon={Key}
          variant="warning"
          onClick={() => handleResetPassword(user.user_id, user.email)}
        >
          Reset Password
        </ActionButton>
        {freshCredentials[user.user_id] && (
          <ActionButton
            icon={Eye}
            variant="info"
            onClick={() => handleViewFreshPassword(user)}
          >
            Show Password
          </ActionButton>
        )}
        <ActionButton
          icon={Archive}
          variant="danger"
          onClick={() => handleArchive(user.user_id, user.email)}
        >
          Archive
        </ActionButton>
      </div>
    );
  };

  /* ---------------- Filter panel ---------------- */

  const panel = (
    <FilterShell
      title="Filter Users"
      onClose={() => setShowFilters(false)}
      onReset={clearFilters}
    >
      <div>
        <L icon={UsersIcon}>Role</L>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-[#1F2937] focus-visible:ring-[#F0B429]"
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* ------- Account status filter ------- */}
      <div>
        <L icon={UserCheck}>Account status</L>
        <div className="flex flex-col gap-1.5">
          {[
            {
              key: 'active',
              label: 'Active only',
              count: accountStats.active.length,
              Icon: UserCheck,
            },
            {
              key: 'deactivated',
              label: 'Deactivated only',
              count: accountStats.deactivated.length,
              Icon: UserX,
            },
            {
              key: 'all',
              label: 'All users',
              count: accountStats.total,
              Icon: UsersIcon,
            },
          ].map((opt) => {
            const active = filters.account_status === opt.key;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  setFilters({ ...filters, account_status: opt.key })
                }
                aria-pressed={active}
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${active
                  ? 'bg-[#16233F] text-white border-[#16233F]'
                  : 'bg-white text-[#64748B] border-[#E9ECF2] hover:bg-[#F5F6F8]'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </span>
                <span
                  className={`tabular-nums ${active ? 'text-white/80' : 'text-[#94A3B8]'
                    }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------- Face registration filter ------- */}
      <div>
        <L icon={ScanFace}>Face registration</L>
        <div className="flex flex-col gap-1.5">
          {[
            {
              key: 'all',
              label: 'All users',
              count: faceStats.total,
            },
            {
              key: 'registered',
              label: 'Face registered',
              count: faceStats.registered.length,
            },
            {
              key: 'unregistered',
              label: 'No face registered',
              count: faceStats.unregistered.length,
            },
          ].map((opt) => {
            const active = filters.face_status === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  setFilters({ ...filters, face_status: opt.key })
                }
                aria-pressed={active}
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${active
                  ? 'bg-[#16233F] text-white border-[#16233F]'
                  : 'bg-white text-[#64748B] border-[#E9ECF2] hover:bg-[#F5F6F8]'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <ScanFace className="w-3.5 h-3.5" />
                  {opt.label}
                </span>
                <span
                  className={`tabular-nums ${active ? 'text-white/80' : 'text-[#94A3B8]'
                    }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </FilterShell>
  );

  const chips = [
    searchTerm && [`Search: ${searchTerm}`, () => setSearchTerm('')],
    filters.role && [
      `Role: ${filters.role}`,
      () => setFilters({ ...filters, role: '' }),
    ],
    filters.account_status !== 'active' && [
      filters.account_status === 'deactivated'
        ? 'Deactivated only'
        : 'Showing all account statuses',
      () => setFilters({ ...filters, account_status: 'active' }),
    ],
    filters.face_status !== 'all' && [
      filters.face_status === 'registered'
        ? 'Face registered only'
        : 'No face registered only',
      () => setFilters({ ...filters, face_status: 'all' }),
    ],
  ].filter(Boolean);

  /* ---------------- Early returns ---------------- */

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
          <h1 className="text-4xl font-['Oswald'] font-semibold tracking-tight">
            User Management
          </h1>
          <p className="text-[#C7CEDB] text-sm mt-1">
            {canManage
              ? 'Manage system users and their access levels'
              : 'View system users and their face registration status'}
          </p>
        </div>
        <div className="relative flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          {canManage && (
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
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="First Name *"
                      value={formData.firstname}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          firstname: e.target.value,
                        })
                      }
                      required
                      className="focus-visible:ring-[#F0B429]"
                    />
                    <Input
                      placeholder="Middle Name"
                      value={formData.middlename}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          middlename: e.target.value,
                        })
                      }
                      className="focus-visible:ring-[#F0B429]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="Last Name *"
                      value={formData.lastname}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lastname: e.target.value,
                        })
                      }
                      required
                      className="focus-visible:ring-[#F0B429]"
                    />
                    <Input
                      placeholder="Contact Number"
                      value={formData.contact_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_number: e.target.value,
                        })
                      }
                      className="focus-visible:ring-[#F0B429]"
                    />
                  </div>
                  <Input
                    type="email"
                    placeholder="Email *"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target.value,
                      })
                    }
                    required
                    disabled={!!editingUser}
                    className="focus-visible:ring-[#F0B429]"
                  />
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[#F0B429]"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value,
                      })
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
                              setPreviewUrl('');
                              setFormData({
                                ...formData,
                                profile_image: null,
                              });
                              const fileInput =
                                document.getElementById(
                                  'profile_image_input',
                                );
                              if (fileInput) fileInput.value = '';
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
                            {previewUrl ? 'Change Photo' : 'Upload Photo'}
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
                        A random password will be generated and emailed to the
                        new user. You'll also see it on the next screen so you
                        can share it manually if needed.
                      </p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-[#1E8449] hover:bg-[#186B3B]"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving...'
                      : editingUser
                        ? 'Update User'
                        : 'Create User'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div
        className={`grid gap-6 ${showFilters ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : ''
          }`}
      >
        {showFilters && panel}

        <div className="space-y-4 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 bg-[#16233F] text-white text-xs rounded-full px-2 py-0.5">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 rounded-full focus-visible:ring-[#F0B429]"
              />
              {isFetching && (
                <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#94A3B8]" />
              )}
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  title="Clear"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <ViewToggle view={view} setView={setView} />
          </div>

          {/* Chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map(([label, clear]) => (
                <Chip key={label} label={label} onClear={clear} />
              ))}
            </div>
          )}

          {/* Section title */}
          <h2 className="font-['Oswald'] font-medium text-lg text-[#16233F] flex items-center gap-2 border-b-2 border-dashed border-[#CBD5E1] pb-2 flex-wrap">
            <UsersIcon className="w-5 h-5 text-[#F0B429]" />
            Users List
            <span className="text-xs font-normal text-[#64748B] font-['Inter']">
              (alphabetical by last name)
            </span>

            <span className="ml-auto flex flex-wrap items-center gap-3">
              {filters.account_status !== 'active' && (
                <span className="text-xs font-normal text-[#16233F] font-['Inter'] flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5 text-[#C8202F]" />
                  {filters.account_status === 'deactivated'
                    ? `${accountStats.deactivated.length} deactivated`
                    : `${accountStats.total} total`}
                </span>
              )}
              {filters.face_status !== 'all' && (
                <span className="text-xs font-normal text-[#16233F] font-['Inter'] flex items-center gap-1">
                  <ScanFace className="w-3.5 h-3.5 text-[#1E8449]" />
                  {filters.face_status === 'registered'
                    ? `${faceStats.registered.length} registered`
                    : `${faceStats.unregistered.length} not registered`}
                </span>
              )}
            </span>
          </h2>

          {/* Body */}
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#16233F]" />
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="text-center py-14 text-[#64748B]">
              {activeFilterCount > 0
                ? 'No users match the current filters.'
                : 'No users found.'}
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleUsers.map((user) => {
                const roleMeta = ROLE_META[user.role] || ROLE_META.enforcer;
                return (
                  <article
                    key={user.user_id}
                    className="rounded-xl bg-white border border-[#E3E7EE] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div
                      className="h-2"
                      style={{ background: roleMeta.color }}
                    />
                    <div className="p-4 flex gap-4">
                      {user.profile_image ? (
                        <img
                          src={getImageUrl(user.profile_image)}
                          alt={`${user.firstname} ${user.lastname}`}
                          className="w-16 h-20 shrink-0 rounded-md object-cover border border-[#E9ECF2]"
                          onError={(e) => {
                            e.target.src = '';
                            e.target.alt = 'No image';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-20 shrink-0 rounded-md bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xl font-['Oswald'] font-semibold">
                          {user.firstname?.[0]}
                          {user.lastname?.[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-['Oswald'] text-lg leading-tight text-[#1F2937]">
                          {user.lastname}, {user.firstname}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {roleBadge(user.role)}
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${user.is_active
                              ? 'bg-[#E5F2EA] text-[#1E8449]'
                              : 'bg-[#FBE7E9] text-[#C8202F]'
                              }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {faceBadge(user.has_face_registered)}
                        </div>
                        <dl className="grid grid-cols-1 gap-y-2 mt-3">
                          <Spec label="Email" mono>
                            {user.email}
                          </Spec>
                          {user.contact_number && (
                            <Spec label="Contact">
                              {user.contact_number}
                            </Spec>
                          )}
                        </dl>
                      </div>
                    </div>
                    {canManage && (
                      <div className="px-4 pb-4">{rowActions(user)}</div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#E3E7EE] bg-white overflow-hidden">
              <div
                className={`hidden ${ROW_CLASS} bg-[#16233F] text-white text-xs font-semibold`}
              >
                {[
                  'Photo',
                  'Name',
                  'Email',
                  'Role',
                  'Contact',
                  'Status / Face',
                  ...(canManage ? ['Actions'] : []),
                ].map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <ul className="divide-y divide-[#EEF0F4]">
                {visibleUsers.map((user) => {
                  const roleMeta = ROLE_META[user.role] || ROLE_META.enforcer;
                  return (
                    <li
                      key={user.user_id}
                      className={`${ROW_CLASS} hover:bg-[#F8F9FB] transition-colors border-l-4 min-w-0`}
                      style={{
                        borderLeftColor: user.is_active
                          ? roleMeta.color
                          : '#94A3B8',
                      }}
                    >
                      <span className="shrink-0">
                        {user.profile_image ? (
                          <img
                            src={getImageUrl(user.profile_image)}
                            alt={`${user.firstname} ${user.lastname}`}
                            className="w-10 h-10 rounded-full object-cover border border-[#E9ECF2]"
                            onError={(e) => {
                              e.target.src = '';
                              e.target.alt = 'No image';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#E9ECF2] flex items-center justify-center text-[#16233F] text-xs font-bold">
                            {user.firstname?.[0]}
                            {user.lastname?.[0]}
                          </div>
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-[#1F2937] truncate">
                          {user.lastname}, {user.firstname}
                          {user.middlename ? ` ${user.middlename[0]}.` : ''}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          ID: {user.user_id}
                        </div>
                      </div>
                      <span className="text-sm text-[#1F2937] min-w-0 truncate">
                        <Mini>Email</Mini>
                        {user.email}
                      </span>
                      <span className="justify-self-start">
                        <Mini>Role</Mini>
                        {roleBadge(user.role)}
                      </span>
                      <span className="text-sm text-[#1F2937] min-w-0 truncate">
                        <Mini>Contact</Mini>
                        {user.contact_number || '—'}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 justify-self-start">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${user.is_active
                            ? 'bg-[#E5F2EA] text-[#1E8449]'
                            : 'bg-[#FBE7E9] text-[#C8202F]'
                            }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {faceBadge(user.has_face_registered)}
                      </div>
                      {canManage && (
                        <div className="justify-self-end md:justify-self-start">
                          {rowActions(user)}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!isLoading && visibleUsers.length > 0 && (
            <Pagination
              currentPage={meta.current_page}
              totalPages={meta.last_page}
              onPageChange={setPage}
              totalItems={meta.total}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </div>
      </div>

      <CredentialsModal
        open={credentialsModal.open}
        onClose={() =>
          setCredentialsModal({
            open: false,
            email: '',
            password: '',
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