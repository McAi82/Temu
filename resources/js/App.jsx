import React from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import BiometricRequests from './pages/BiometricRequests';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import VehiclesViolators from './pages/VehiclesViolators';
import Violations from './pages/Violations';
import Tickets from './pages/Tickets';
import Users from './pages/Users';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import DutyMap from './components/map/DutyMap';
import Schedule from './pages/Schedule';
import PublicTicketView from './pages/PublicTicket';
import NotificationToasts from './components/notifications/NotificationToasts';
import Payments from './pages/Payments';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 1000 * 60 * 2,
            gcTime: 1000 * 60 * 5,
        },
    },
});

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#16233F]"></div>
            </div>
        );
    }
    if (!user) return <Navigate to="/login" />;
    return children;
};

const AppRoutes = () => {
    const { user } = useAuth();

    return (
        <NotificationProvider>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Dashboard />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/vehicles-violators"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <VehiclesViolators />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/public-ticket/:ticketNumber"
                    element={<PublicTicketView />}
                />
                <Route
                    path="/violations"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Violations />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/tickets"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Tickets />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/users"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Users />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/biometric-requests"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <BiometricRequests />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Reports />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/attendance"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Attendance />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/duty-map"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <DutyMap />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/schedule"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Schedule />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/payments"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Payments />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
            </Routes>

            {user && <NotificationToasts />}
        </NotificationProvider>
    );
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </Router>
        </QueryClientProvider>
    );
}

export default App;