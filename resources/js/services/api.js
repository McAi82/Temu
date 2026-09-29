// web/src/services/api.js
import axios from 'axios';

const API_BASE_URL = 'https://ivory-gerbil-502781.hostingersite.com/api';

console.log('🌐 API Base URL:', API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
    withCredentials: false,
    timeout: 30000,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // avoid redirect loop on public ticket pages
            if (!window.location.pathname.startsWith('/public-ticket')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    },
);

// ==================== AUTH ====================
// Step 1 — credentials.
//   - For admin/staff:  response.data = { requires_otp: true, challenge_id, masked_email, expires_in }
//   - For enforcer:     response.data = { user, token, token_type }  (legacy, unchanged)
export const login = (email, password) => api.post('/Weblogin', { email, password });

// Step 2 — verify the 6-digit code.
//   - response.data = { user, token, token_type }
export const verifyLoginOtp = (challengeId, code) =>
    api.post('/Weblogin/otp/verify', {
        challenge_id: challengeId,
        code,
    });

export const logout = () => api.post('/logout');
export const getProfile = () => api.get('/profile');

// ==================== PASSWORD RESET ====================
export const requestPasswordReset = (email) =>
    api.post('/PasswordReset/request', { email });

export const verifyPasswordReset = (challengeId, code, password, passwordConfirmation) =>
    api.post('/PasswordReset/verify', {
        challenge_id: challengeId,
        code,
        password,
        password_confirmation: passwordConfirmation,
    });

// ==================== VIOLATORS ====================
export const getViolators = (page = 1, perPage = 20) =>
    api.get(`/violators?page=${page}&per_page=${perPage}`);
export const getViolator = (id) => api.get(`/violators/${id}`);
export const createViolator = (data) => api.post('/violators', data);
export const updateViolator = (id, data) => api.put(`/violators/${id}`, data);
export const deleteViolator = (id) => api.delete(`/violators/${id}`);
export const searchViolatorByLicense = (license) =>
    api.get(`/violators/search/license/${license}`);

// ==================== VEHICLES ====================
export const getVehicles = (page = 1, perPage = 20) =>
    api.get(`/vehicles?page=${page}&per_page=${perPage}`);
export const getVehicle = (id) => api.get(`/vehicles/${id}`);
export const createVehicle = (data) => api.post('/vehicles', data);
export const updateVehicle = (id, data) => api.put(`/vehicles/${id}`, data);
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}`);
export const searchVehicleByPlate = (plate) =>
    api.get(`/vehicles/search/plate/${plate}`);

// ==================== VIOLATIONS ====================
export const getViolations = (page = 1, perPage = 20) =>
    api.get(`/violations?page=${page}&per_page=${perPage}`);
export const getViolation = (id) => api.get(`/violations/${id}`);
export const createViolation = (data) => api.post('/violations', data);
export const updateViolation = (id, data) => api.put(`/violations/${id}`, data);
export const deleteViolation = (id) => api.delete(`/violations/${id}`);

// ==================== TICKETS ====================
export const getTickets = (page = 1, perPage = 20) =>
    api.get(`/tickets?page=${page}&per_page=${perPage}`);
export const getTicket = (id) => api.get(`/tickets/${id}`);
export const getTicketStatistics = async () => {
    try {
        return await api.get('/tickets/statistics');
    } catch (error) {
        return {
            data: {
                total_tickets: 0,
                paid_tickets: 0,
                issued_tickets: 0,
                contested_tickets: 0,
                dismissed_tickets: 0,
                total_fines: 0,
                collected_fines: 0,
                collection_rate: 0,
                tickets_by_month: [],
            },
        };
    }
};
export const createTicket = (data) => api.post('/tickets', data);
export const updateTicketStatus = (id, status) =>
    api.put(`/tickets/${id}/status`, { status });
export const deleteTicket = (id) => api.delete(`/tickets/${id}`);
export const getMyTickets = () => api.get('/my-tickets');
export const searchTickets = (params) => api.get('/tickets/search', { params });

// ==================== USERS ====================
export const getUsers = (page = 1, perPage = 20) =>
    api.get(`/users?page=${page}&per_page=${perPage}`);
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const toggleUserStatus = (id) => api.put(`/users/${id}/toggle-status`);
export const resetUserPassword = (id) => api.post(`/users/${id}/reset-password`);

// ==================== ATTENDANCE ====================
export const getAttendance = (page = 1, perPage = 20) =>
    api.get(`/attendance?page=${page}&per_page=${perPage}`);

// ==================== REPORTS ====================
export const getTodayReport = () => api.get('/reports/today');
export const getWeeklyReport = (params) => api.get('/reports/weekly', { params });
export const exportReport = (params) =>
    api.get('/reports/export', { params, responseType: 'blob' });

// ==================== NOTIFICATIONS ====================
export const getNotifications = (params = {}) => api.get('/notifications', { params });
export const getNotificationsSummary = () => api.get('/notifications/summary');
export const pollNotifications = (since = null) =>
    api.get('/notifications/poll', { params: since ? { since } : {} });
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.put('/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);
export const clearNotifications = () => api.delete('/notifications');

// ==================== SCHEDULES ====================
export const getSchedules = (params) => api.get('/schedules', { params });
export const getSchedulesRange = (params) => api.get('/schedules', { params });

// ==================== PAYMENTS ====================
export const getPayments = (page = 1, perPage = 20, filters = {}) =>
    api.get('/payments', { params: { page, per_page: perPage, ...filters } });

export const getPendingPayments = (page = 1, perPage = 20, filters = {}) =>
    api.get('/payments/pending', { params: { page, per_page: perPage, ...filters } });

export const getPayment = (id) => api.get(`/payments/${id}`);
export const getPaymentsByTicket = (ticketId) =>
    api.get(`/payments/ticket/${ticketId}`);
export const createPayment = (data) => api.post('/payments', data);
export const voidPayment = (id, reason) =>
    api.put(`/payments/${id}/void`, { reason });

export const getAvailableEnforcers = (date, excludeId = null, search = '') =>
    api.get('/schedules/available-enforcers', {
        params: {
            date,
            exclude_id: excludeId || undefined,
            search: search || undefined,
        },
    });

export const replaceScheduleEnforcer = (id, payload) =>
    api.put(`/schedules/${id}/replace-enforcer`, payload);

// ==================== BIOMETRIC REQUESTS ====================
export const getBiometricRequests = (page = 1, perPage = 20, filters = {}) =>
    api.get('/biometric-requests', {
        params: { page, per_page: perPage, ...filters },
    });

export const getBiometricRequestPendingCount = () =>
    api.get('/biometric-requests/pending-count');

export const approveBiometricRequest = (id, reviewNotes = '') =>
    api.put(`/biometric-requests/${id}/approve`, { review_notes: reviewNotes });

export const rejectBiometricRequest = (id, reviewNotes) =>
    api.put(`/biometric-requests/${id}/reject`, { review_notes: reviewNotes });

export default api;